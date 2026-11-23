const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { execFileSync } = require("node:child_process");
const mongoose = require("mongoose");
const Category = require("../models/Category");
const EventType = require("../models/EventType");
const { CATEGORY_DATA, EVENT_TYPE_DATA, slugify, validateReferenceData } = require("../scripts/seedReferenceData");
const { parseArguments, verifyDevelopmentTarget, databaseFromUri, validateReconciliation, buildPlan, runSeed } = require("../scripts/referenceDataSeed");

const { EJSON } = mongoose.mongo.BSON;
const objectId = () => new mongoose.Types.ObjectId();
const clone = (value) => EJSON.parse(EJSON.stringify(value, { relaxed: false }), { relaxed: false });
const smallCategories = [{ name: "Venues", services: ["Hall"] }];
const smallEvents = [{ name: "Wedding", categoryNames: ["Venues"], isActive: true }, { name: "Unmapped", categoryNames: [], isActive: false }];
const env = { MONGODB_URI: "mongodb://localhost/harevent_dev", NODE_ENV: "development", SEED_DEV_DATABASE: "harevent_dev" };

function plan(snapshot, extra = {}) {
  return buildPlan({ snapshot, categoryData: smallCategories, eventData: smallEvents, slugify, Category, EventType, ...extra });
}

function emptySnapshot() {
  return { categories: [], events: [], vendors: [] };
}

async function temporaryRoot(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "harevent-seed-test-"));
  t.after(async () => {
    const resolved = path.resolve(root);
    assert.ok(resolved.startsWith(path.resolve(os.tmpdir()) + path.sep));
    assert.ok(path.basename(resolved).startsWith("harevent-seed-test-"));
    await fs.rm(resolved, { recursive: true, force: true });
  });
  return root;
}

// An in-memory driver double exercises orchestration and failures. It does not
// claim to reproduce MongoDB server transaction or index behavior.
function fakeConnection(initial = emptySnapshot(), failures = {}) {
  let persisted = clone(initial);
  let staged;
  let transaction = false;
  let session;
  let reads = 0;
  const calls = { connects: 0, disconnects: 0, writes: [], aborts: 0, commits: 0, ends: 0, connectionOptions: null };
  const stateKey = { categories: "categories", eventtypes: "events", vendors: "vendors" };
  const db = {
    databaseName: failures.databaseName || "harevent_dev",
    admin: () => ({ command: async () => failures.standalone ? { logicalSessionTimeoutMinutes: 30, maxWireVersion: 25 } : { setName: "rs0", logicalSessionTimeoutMinutes: 30, maxWireVersion: 25 } }),
    collection(name) {
      return {
        listIndexes: () => ({ toArray: async () => failures.missingIndexes ? [] : [{ unique: true, key: name === "categories" ? { parentId: 1, slug: 1 } : { slug: 1 } }] }),
        find(query, options = {}) {
          reads += 1;
          if (failures.read) throw new Error("injected read failure");
          const source = options.session && transaction ? staged : persisted;
          let documents = clone(source[stateKey[name]]);
          if (failures.verification && reads > 3 && name === "categories") documents = [];
          return { toArray: async () => documents };
        },
        async bulkWrite(operations, options) {
          assert.equal(options.session, session);
          assert.ok(transaction);
          calls.writes.push(name);
          if (failures.write === name) throw new Error("injected write failure");
          let insertedCount = 0;
          let matchedCount = 0;
          for (const operation of operations) {
            if (operation.insertOne) {
              staged[stateKey[name]].push(clone(operation.insertOne.document));
              insertedCount += 1;
            } else {
              const document = staged[stateKey[name]].find((entry) => entry._id.equals(operation.updateOne.filter._id));
              if (document) {
                Object.assign(document, clone(operation.updateOne.update.$set));
                matchedCount += 1;
              }
            }
          }
          return { insertedCount, matchedCount };
        },
      };
    },
  };
  return {
    calls,
    get persisted() { return persisted; },
    connection: { db },
    async connect(uri, options) {
      calls.connects += 1;
      calls.connectionOptions = options;
      if (failures.connect) throw new Error("injected connection failure");
    },
    async disconnect() { calls.disconnects += 1; },
    async startSession() {
      session = {
        startTransaction(options) {
          assert.deepEqual(options.readConcern, { level: "snapshot" });
          assert.deepEqual(options.writeConcern, { w: "majority" });
          staged = clone(persisted);
          transaction = true;
        },
        inTransaction: () => transaction,
        async abortTransaction() { calls.aborts += 1; transaction = false; staged = undefined; },
        async commitTransaction() {
          calls.commits += 1;
          persisted = staged;
          transaction = false;
          if (failures.commit) throw new Error("injected lost commit acknowledgement");
        },
        async endSession() { calls.ends += 1; },
      };
      return session;
    },
  };
}

function execute(connection, recoveryRoot, extra = {}) {
  return runSeed({ options: parseArguments(["--apply", "--confirm-dev"]), mongoose: connection, Category, EventType, categoryData: smallCategories, eventData: smallEvents, slugify, env, log: () => {}, recoveryRoot, ...extra });
}

async function recoveryFiles(root) {
  const directories = await fs.readdir(root);
  assert.equal(directories.length, 1);
  const directory = path.join(root, directories[0]);
  const journal = (await fs.readFile(path.join(directory, "journal.jsonl"), "utf8")).trim().split("\n").map(JSON.parse);
  return { directory, journal };
}

test("static data retains all events and the updated taxonomy counts", () => {
  assert.deepEqual(validateReferenceData(), { categoryCount: 19, serviceCount: 288, eventTypeCount: 29, activeEventTypeCount: 10, inactiveEventTypeCount: 19 });
});

test("every retained event has mappings, and the 19 pending events remain inactive", () => {
  const pendingNames = [
    "Award Ceremonies", "College Festivals", "School Events", "Farewell Party", "Graduation Ceremony",
    "Bachelor Party", "Reunion Party", "Cocktail Party", "Private Parties", "Family Get-Together",
    "Festival Celebrations", "Religious Events", "Cultural Events", "Concerts & Live Shows", "Fashion Shows",
    "Charity & Fundraising Events", "Sports Events", "Political Events", "Community Events",
  ];
  assert.deepEqual(EVENT_TYPE_DATA.filter((event) => !event.isActive).map((event) => event.name), pendingNames);
  for (const event of EVENT_TYPE_DATA) {
    assert.ok(event.categoryNames.length > 0, event.name);
    assert.ok(event.categoryNames.includes("Photography & Videography"), event.name);
    assert.ok(event.categoryNames.includes("Event Planners"), event.name);
    assert.ok(!event.categoryNames.includes("Photographers"), event.name);
  }
});

test("corporate labels resolve to the requested categories and separate services", () => {
  const byName = new Map(CATEGORY_DATA.map((category) => [category.name, category]));
  assert.ok(byName.get("Rangoli Artists").services.length > 0);
  for (const service of ["Photographers", "Videographers"]) {
    assert.ok(byName.get("Photography & Videography").services.includes(service));
  }
  for (const service of ["Corporate Event Planners", "Conference Event Planners"]) {
    assert.ok(byName.get("Event Planners").services.includes(service));
  }
  for (const service of ["Live Bands & Singers", "Anchors & Emcees", "Entertainment Artists"]) {
    assert.ok(byName.get("Entertainment").services.includes(service));
  }
  for (const service of ["Stage Setup", "Sound & Lighting", "LED Wall & Screen Rentals"]) {
    assert.ok(byName.get("Production & Technical Setup").services.includes(service));
    assert.ok(!byName.get("Decorators").services.includes(service));
  }
  assert.ok(!CATEGORY_DATA.some((category) => category.name === "Corporate Event Vendors" || category.services.includes("Corporate Event Vendors")));
  for (const name of ["Corporate Events", "Conferences & Seminars"]) {
    const event = EVENT_TYPE_DATA.find((entry) => entry.name === name);
    for (const categoryName of ["Venues", "Photography & Videography", "DJs", "Entertainment", "Production & Technical Setup", "Event Planners"]) {
      assert.ok(event.categoryNames.includes(categoryName), name + ": " + categoryName);
    }
  }
});

test("the seed rejects an active event without category mappings before writes", async () => {
  await assert.rejects(plan(emptySnapshot(), {
    eventData: [{ name: "School Events", categoryNames: [], isActive: true }],
  }), /Active EventType school-events has no mappings/);
});

test("normal re-seeding preserves saved category, service, and event activation settings", async () => {
  const baseline = (await plan(emptySnapshot())).state;
  for (const category of baseline.categories) category.isActive = false;
  baseline.events[0].isActive = false;
  const result = await plan(baseline);
  assert.ok(result.state.categories.every((category) => category.isActive === false));
  assert.ok(result.state.events.every((event) => event.isActive === false));
  assert.equal(result.changes.length, 0);
});

test("an inactive category is not silently reactivated to satisfy an active event", async () => {
  const baseline = (await plan(emptySnapshot())).state;
  for (const category of baseline.categories) category.isActive = false;
  await assert.rejects(plan(baseline), /Active EventType wedding references an inactive category/);
  assert.ok(baseline.categories.every((category) => category.isActive === false));
});

test("dry-run and unsupported CLI modes never connect, even with an invalid URI", () => {
  const script = path.join(__dirname, "..", "scripts", "seedReferenceData.js");
  const options = { encoding: "utf8", env: { ...process.env, MONGODB_URI: "invalid", NODE_ENV: "production" }, stdio: "pipe" };
  assert.match(execFileSync(process.execPath, [script, "--dry-run"], options), /No database connection or writes/);
  for (const argv of [[], ["--apply"], ["--compare", "--apply", "--confirm-dev"], ["--dry-run", "--confirm-dev"], ["--compare", "--unknown"], ["--compare", "--compare"], ["--dry-run", "--reconcile", "x.json"]]) {
    assert.throws(() => parseArguments(argv), /Use exactly one/);
  }
  assert.throws(() => execFileSync(process.execPath, [script], options), (error) => error.status === 1 && /Use exactly one/.test(error.stderr));
});

test("apply blocks unsafe names, environments, omitted URI databases, and allowlist mismatches", () => {
  verifyDevelopmentTarget("harevent_dev", env);
  verifyDevelopmentTarget("harevent-development", { ...env, SEED_DEV_DATABASE: "harevent-development" });
  for (const name of ["harevent_prod", "harevent_prod_dev", "harevent", "developer", "harevent_staging", "test"]) {
    assert.throws(() => verifyDevelopmentTarget(name, { ...env, SEED_DEV_DATABASE: name }));
  }
  for (const NODE_ENV of [undefined, "production", "test", "staging"]) assert.throws(() => verifyDevelopmentTarget("harevent_dev", { ...env, NODE_ENV }));
  assert.throws(() => verifyDevelopmentTarget("harevent_dev", { ...env, SEED_DEV_DATABASE: "other_dev" }));
  assert.equal(databaseFromUri("mongodb://user:password@host1:27017,host2:27017/harevent_dev?replicaSet=rs0"), "harevent_dev");
  assert.equal(databaseFromUri("mongodb+srv://host/harevent%5Fdev"), "harevent_dev");
  assert.throws(() => databaseFromUri("mongodb://host/"));
  assert.throws(() => databaseFromUri("mongodb://host"));
});

test("the full proposal explicitly validates, and a second plan is idempotent", async () => {
  const first = await plan(emptySnapshot(), { categoryData: CATEGORY_DATA, eventData: EVENT_TYPE_DATA });
  const summary = validateReferenceData();
  assert.equal(first.changes.length, summary.categoryCount + summary.serviceCount + summary.eventTypeCount);
  const categoriesById = new Map(first.state.categories.map((category) => [category._id.toString(), category]));
  for (const event of first.state.events) {
    assert.ok(event.vendorCategoryIds.length > 0, event.name);
    for (const categoryId of event.vendorCategoryIds) {
      const category = categoriesById.get(categoryId.toString());
      assert.equal(category.parentId, null);
      assert.ok(first.state.categories.some((service) => service.parentId?.equals(categoryId)), category.name);
    }
  }
  const second = await plan(first.state, { categoryData: CATEGORY_DATA, eventData: EVENT_TYPE_DATA });
  assert.equal(second.changes.length, 0);
});

test("seeding adds pending mappings without activating existing pending events", async () => {
  const baseline = (await plan(emptySnapshot(), { categoryData: CATEGORY_DATA, eventData: EVENT_TYPE_DATA })).state;
  for (const event of baseline.events.filter((event) => !event.isActive)) event.vendorCategoryIds = [];
  const result = await plan(baseline, { categoryData: CATEGORY_DATA, eventData: EVENT_TYPE_DATA });
  assert.equal(result.changes.filter((change) => change.collection === "events").length, 19);
  for (const event of result.state.events.filter((event) => !event.isActive)) assert.ok(event.vendorCategoryIds.length > 0);
  assert.equal(result.state.events.filter((event) => event.isActive).length, 10);
});

test("the declared photography rename preserves category, service, event, and vendor references", async () => {
  const baseline = (await plan(emptySnapshot(), { categoryData: CATEGORY_DATA, eventData: EVENT_TYPE_DATA })).state;
  const category = baseline.categories.find((entry) => entry.slug === "photography-and-videography" && !entry.parentId);
  const service = baseline.categories.find((entry) => entry.slug === "wedding-photography");
  const wedding = baseline.events.find((entry) => entry.slug === "wedding");
  category.slug = "photographers";
  category.name = "Photographers";
  baseline.vendors.push({ _id: objectId(), categoryIds: [category._id], selectedCategories: [{ categoryId: category._id, serviceIds: [service._id] }], eventTypeIds: [wedding._id] });
  const result = await plan(baseline, { categoryData: CATEGORY_DATA, eventData: EVENT_TYPE_DATA });
  const renamed = result.state.categories.find((entry) => entry.slug === "photography-and-videography");
  assert.ok(renamed._id.equals(category._id));
  assert.ok(result.state.categories.find((entry) => entry._id.equals(service._id)).parentId.equals(renamed._id));
  assert.ok(result.state.events.find((entry) => entry._id.equals(wedding._id)).vendorCategoryIds.some((value) => value.equals(renamed._id)));
  assert.deepEqual(result.state.vendors, baseline.vendors);
  assert.equal(result.unresolved.length, 0);
  assert.equal(result.changes.filter((entry) => entry.action === "insert").length, 0);
  const second = await plan(result.state, { categoryData: CATEGORY_DATA, eventData: EVENT_TYPE_DATA });
  assert.equal(second.changes.length, 0);
});

test("separate legacy and renamed photography categories still require explicit reconciliation", async () => {
  const baseline = (await plan(emptySnapshot(), { categoryData: CATEGORY_DATA, eventData: EVENT_TYPE_DATA })).state;
  const legacy = { _id: objectId(), name: "Photographers", slug: "photographers", parentId: null, isActive: true };
  baseline.categories.push(legacy);
  const result = await plan(baseline, { categoryData: CATEGORY_DATA, eventData: EVENT_TYPE_DATA });
  assert.deepEqual(result.unresolved, ["categories/" + legacy._id.toString()]);
  assert.ok(result.state.categories.some((entry) => entry._id.equals(legacy._id)));
});

test("vendor service references must remain under their selected main category", async () => {
  const categoryData = [
    { name: "Venues", services: ["Hall"] },
    { name: "Decorators", services: ["Floral Decorators"] },
  ];
  const baseline = (await plan(emptySnapshot(), { categoryData })).state;
  const venues = baseline.categories.find((category) => category.slug === "venues");
  const otherService = baseline.categories.find((category) => category.slug === "floral-decorators");
  baseline.vendors.push({
    _id: objectId(), categoryIds: [venues._id],
    selectedCategories: [{ categoryId: venues._id, serviceIds: [otherService._id] }],
    eventTypeIds: [baseline.events[0]._id],
  });
  await assert.rejects(plan(baseline, { categoryData }), /service under the wrong parent/);
});

test("existing extra mappings, active status, descriptions, and historical fields survive", async () => {
  const baseline = (await plan(emptySnapshot())).state;
  const extra = { _id: objectId(), name: "Manual category", slug: "manual", parentId: null, isActive: true };
  baseline.categories.push(extra);
  baseline.events[0].vendorCategoryIds.push(extra._id);
  baseline.events[0].description = "Manual description";
  baseline.events[0].historicalNote = { keep: true };
  baseline.events[1].vendorCategoryIds = [extra._id];
  baseline.events[1].isActive = true;
  const result = await plan(baseline, { reconciliation: { retainCategoryIds: [extra._id.toString()] } });
  assert.equal(result.state.events[0].vendorCategoryIds.length, 2);
  assert.equal(result.state.events[0].description, "Manual description");
  assert.deepEqual(result.state.events[0].historicalNote, { keep: true });
  assert.deepEqual(result.state.events[1].vendorCategoryIds, [extra._id]);
  assert.equal(result.state.events[1].isActive, true);
  assert.equal(result.unresolved.length, 0);
});

test("main, service, and event renames retain IDs and vendor relationships", async () => {
  const baseline = (await plan(emptySnapshot())).state;
  const main = baseline.categories[0];
  const service = baseline.categories[1];
  const event = baseline.events[0];
  main.slug = "old-venues";
  service.slug = "old-hall";
  event.slug = "old-wedding";
  baseline.vendors.push({ _id: objectId(), categoryIds: [main._id], selectedCategories: [{ categoryId: main._id, serviceIds: [service._id] }], eventTypeIds: [event._id] });
  const result = await plan(baseline, { reconciliation: { categoryRenames: [{ id: main._id.toString(), slug: "venues", parentSlug: null }, { id: service._id.toString(), slug: "hall", parentSlug: "venues" }], eventTypeRenames: [{ id: event._id.toString(), slug: "wedding" }] } });
  assert.ok(result.state.categories[0]._id.equals(main._id));
  assert.ok(result.state.categories[1]._id.equals(service._id));
  assert.ok(result.state.events[0]._id.equals(event._id));
  assert.equal(result.changes.filter((entry) => entry.action === "insert").length, 0);
});

test("stale records require a decision; unreferenced records can be deactivated without deletion", async () => {
  const snapshot = emptySnapshot();
  const stale = { _id: objectId(), name: "Retired", slug: "retired", parentId: null, isActive: true };
  snapshot.categories.push(stale);
  assert.equal((await plan(snapshot)).unresolved.length, 1);
  const result = await plan(snapshot, { reconciliation: { deactivateCategoryIds: [stale._id.toString()] } });
  assert.equal(result.unresolved.length, 0);
  assert.equal(result.state.categories.find((entry) => entry._id.equals(stale._id)).isActive, false);
  assert.equal(result.state.categories.length, 3);
  assert.equal(snapshot.categories[0].isActive, true);
});

test("legacy stale records missing isActive still require review", async () => {
  const snapshot = emptySnapshot();
  const legacy = { _id: objectId(), name: "Legacy", slug: "legacy", parentId: null };
  snapshot.categories.push(legacy);
  assert.equal((await plan(snapshot)).unresolved.length, 1);
  const result = await plan(snapshot, { reconciliation: { deactivateCategoryIds: [legacy._id.toString()] } });
  assert.equal(result.state.categories.find((entry) => entry._id.equals(legacy._id)).isActive, false);
});

test("inactive and deleted vendors, event mappings, and children protect stale records", async () => {
  for (const reference of ["vendor", "event", "child"]) {
    const snapshot = emptySnapshot();
    const stale = { _id: objectId(), name: "Manual", slug: "manual", parentId: null, isActive: true };
    snapshot.categories.push(stale);
    if (reference === "vendor") snapshot.vendors.push({ _id: objectId(), categoryIds: [stale._id], isActive: false, deletedAt: new Date() });
    if (reference === "event") snapshot.events.push({ _id: objectId(), name: "Past event", slug: "past-event", vendorCategoryIds: [stale._id], isActive: false });
    if (reference === "child") snapshot.categories.push({ _id: objectId(), name: "Child", slug: "child", parentId: stale._id, isActive: true });
    await assert.rejects(plan(snapshot, { reconciliation: { deactivateCategoryIds: [stale._id.toString()] } }), /Cannot deactivate referenced/);
  }
  const snapshot = (await plan(emptySnapshot())).state;
  const staleEvent = { _id: objectId(), name: "Past event", slug: "past-event", vendorCategoryIds: [], isActive: true };
  snapshot.events.push(staleEvent);
  snapshot.vendors.push({ _id: objectId(), eventTypeIds: [staleEvent._id], isActive: false });
  await assert.rejects(plan(snapshot, { reconciliation: { deactivateEventTypeIds: [staleEvent._id.toString()] } }), /Cannot deactivate referenced/);
});

test("inactive child categories protect their stale parent from deactivation", async () => {
  const parent = { _id: objectId(), name: "Manual", slug: "manual", parentId: null, isActive: true };
  const child = { _id: objectId(), name: "Inactive child", slug: "inactive-child", parentId: parent._id, isActive: false };
  const snapshot = { ...emptySnapshot(), categories: [parent, child] };
  const original = clone(snapshot);

  await assert.rejects(
    plan(snapshot, { reconciliation: { deactivateCategoryIds: [parent._id.toString()] } }),
    { message: `Cannot deactivate referenced categories/${parent._id}. Retain it or resolve its references separately.` },
  );
  assert.deepEqual(snapshot, original);

  const retained = await plan(snapshot, { reconciliation: { retainCategoryIds: [parent._id.toString()] } });
  assert.equal(retained.unresolved.length, 0);
  assert.equal(retained.state.categories.find((entry) => entry._id.equals(parent._id)).isActive, true);
  assert.equal(retained.state.categories.find((entry) => entry._id.equals(child._id)).isActive, false);
});

test("duplicates, bad preserved mappings, missing vendor references, and schema errors fail planning", async () => {
  const cases = [];
  const duplicate = emptySnapshot();
  duplicate.categories = [{ _id: objectId(), slug: "venues" }, { _id: objectId(), slug: "venues", parentId: null }];
  cases.push([duplicate, /duplicate category/]);
  const duplicateEvent = (await plan(emptySnapshot())).state;
  duplicateEvent.events.push({ ...duplicateEvent.events[0], _id: objectId() });
  cases.push([duplicateEvent, /duplicate EventType/]);
  const missing = (await plan(emptySnapshot())).state;
  missing.events[0].vendorCategoryIds.push(objectId());
  cases.push([missing, /missing or non-main category/]);
  const childMapping = (await plan(emptySnapshot())).state;
  childMapping.events[0].vendorCategoryIds.push(childMapping.categories[1]._id);
  cases.push([childMapping, /missing or non-main category/]);
  const duplicatedMapping = (await plan(emptySnapshot())).state;
  duplicatedMapping.events[0].vendorCategoryIds.push(duplicatedMapping.events[0].vendorCategoryIds[0]);
  cases.push([duplicatedMapping, /must not contain duplicates/]);
  const missingVendorRef = emptySnapshot();
  missingVendorRef.vendors.push({ _id: objectId(), categoryIds: [objectId()] });
  cases.push([missingVendorRef, /Vendor references a missing/]);
  for (const [snapshot, pattern] of cases) await assert.rejects(plan(snapshot), pattern);
});

test("service slug uniqueness follows the parent-scoped schema index", async () => {
  const result = await plan(emptySnapshot(), { categoryData: [{ name: "Venues", services: ["Hall"] }, { name: "Decorators", services: ["Hall"] }] });
  assert.equal(result.state.categories.filter((entry) => entry.slug === "hall").length, 2);
});

test("reconciliation rejects malformed, duplicate, conflicting, and unknown decisions", () => {
  const existingId = objectId().toString();
  for (const input of [[], null, { unknown: [] }, { categoryRenames: null }, { categoryRenames: [{ id: existingId, slug: "venues" }] }, { retainCategoryIds: [existingId], deactivateCategoryIds: [existingId] }, { retainEventTypeIds: ["invalid"] }]) {
    assert.throws(() => validateReconciliation(input));
  }
});

test("compare performs only reads and disables automatic collection and index creation", async (t) => {
  const root = await temporaryRoot(t);
  const connection = fakeConnection(emptySnapshot(), { missingIndexes: true, standalone: true });
  const report = await execute(connection, root, { options: parseArguments(["--compare"]) });
  assert.equal(report.readyToApply, false);
  assert.equal(report.indexProblems.length, 2);
  assert.equal(report.prerequisiteProblems.length, 1);
  assert.deepEqual(connection.calls.writes, []);
  assert.equal(connection.calls.commits, 0);
  assert.equal(connection.calls.disconnects, 1);
  assert.equal(connection.calls.connectionOptions.autoIndex, false);
  assert.equal(connection.calls.connectionOptions.autoCreate, false);
  assert.deepEqual(await fs.readdir(root), []);
});

test("comparison readiness includes environment and transaction prerequisites even with valid indexes", async (t) => {
  const root = await temporaryRoot(t);
  for (const [failures, overrideEnv] of [[{ standalone: true }, env], [{}, { ...env, NODE_ENV: "production" }]]) {
    const connection = fakeConnection(emptySnapshot(), failures);
    const report = await execute(connection, root, { options: parseArguments(["--compare"]), env: overrideEnv });
    assert.equal(report.indexProblems.length, 0);
    assert.equal(report.readyToApply, false);
    assert.equal(report.prerequisiteProblems.length, 1);
    assert.equal(connection.calls.writes.length, 0);
  }
});

test("unconfirmed apply and production targets fail before connection", async (t) => {
  const root = await temporaryRoot(t);
  for (const extra of [{ options: { mode: "apply" } }, { env: { ...env, MONGODB_URI: "mongodb://localhost/harevent_prod", SEED_DEV_DATABASE: "harevent_prod" } }]) {
    const connection = fakeConnection();
    await assert.rejects(execute(connection, root, extra));
    assert.equal(connection.calls.connects, 0);
    assert.equal(connection.calls.writes.length, 0);
  }
});

test("invalid DNS settings prevent the seed from connecting or writing", async () => {
  const connection = fakeConnection();
  await assert.rejects(
    execute(connection, undefined, { env: { ...env, MONGODB_DNS_SERVERS: "invalid" } }),
    /MONGODB_DNS_SERVERS must be/,
  );
  assert.equal(connection.calls.connects, 0);
  assert.deepEqual(connection.calls.writes, []);
});

test("connection failures, standalone deployments, missing indexes, read failures, and unresolved stale data clean up without writes", async (t) => {
  const root = await temporaryRoot(t);
  const stale = { _id: objectId(), name: "Old", slug: "old", parentId: null, isActive: true };
  for (const failures of [{ connect: true }, { standalone: true }, { missingIndexes: true }, { read: true }, { databaseName: "harevent_prod" }, { stale: true }]) {
    const connection = fakeConnection(failures.stale ? { ...emptySnapshot(), categories: [stale] } : emptySnapshot(), failures);
    await assert.rejects(execute(connection, root));
    assert.equal(connection.calls.disconnects, 1);
    assert.equal(connection.calls.writes.length, 0);
  }
  assert.deepEqual(await fs.readdir(root), []);
});

test("a backup filesystem failure aborts before writes", async (t) => {
  const root = await temporaryRoot(t);
  const blocked = path.join(root, "not-a-directory");
  await fs.writeFile(blocked, "occupied");
  const connection = fakeConnection();
  await assert.rejects(execute(connection, blocked));
  assert.deepEqual(connection.calls.writes, []);
  assert.equal(connection.calls.aborts, 1);
  assert.equal(connection.calls.ends, 1);
  assert.equal(connection.calls.disconnects, 1);
});

test("a mid-write failure aborts the whole plan and journals recovery", async (t) => {
  const root = await temporaryRoot(t);
  const initial = emptySnapshot();
  const connection = fakeConnection(initial, { write: "eventtypes" });
  await assert.rejects(execute(connection, root), /injected write failure/);
  assert.deepEqual(connection.persisted, initial);
  assert.deepEqual(connection.calls.writes, ["categories", "eventtypes"]);
  assert.equal(connection.calls.aborts, 1);
  assert.equal(connection.calls.commits, 0);
  const { directory, journal } = await recoveryFiles(root);
  assert.equal(journal.at(-1).status, "aborted");
  const backup = await fs.readFile(path.join(directory, "backup.ejson"), "utf8");
  assert.equal(createHash("sha256").update(backup).digest("hex"), journal[0].backupSha256);
});

test("verification failures abort before commit", async (t) => {
  const root = await temporaryRoot(t);
  const connection = fakeConnection(emptySnapshot(), { verification: true });
  await assert.rejects(execute(connection, root), /record count differs/);
  assert.equal(connection.calls.commits, 0);
  assert.equal(connection.calls.aborts, 1);
  assert.deepEqual(connection.persisted, emptySnapshot());
});

test("apply commits only after verification and produces a restorable backup, plan, and report", async (t) => {
  const root = await temporaryRoot(t);
  const initial = (await plan(emptySnapshot())).state;
  const wedding = initial.events[0];
  wedding.description = "Keep me";
  wedding.vendorCategoryIds = [];
  wedding.historicalField = "Keep this too";
  const connection = fakeConnection(initial);
  await execute(connection, root);
  assert.equal(connection.calls.commits, 1);
  assert.equal(connection.calls.aborts, 0);
  assert.equal(connection.calls.ends, 1);
  assert.equal(connection.calls.disconnects, 1);
  assert.equal(connection.persisted.events[0].description, "Keep me");
  assert.equal(connection.persisted.events[0].historicalField, "Keep this too");
  assert.equal(connection.persisted.events[0].vendorCategoryIds.length, 1);
  const { directory, journal } = await recoveryFiles(root);
  assert.equal(journal.at(-1).status, "verified-after-commit");
  const backup = EJSON.parse(await fs.readFile(path.join(directory, "backup.ejson"), "utf8"), { relaxed: false });
  assert.ok(backup.eventtypes[0]._id instanceof mongoose.Types.ObjectId);
  assert.deepEqual(backup.eventtypes[0].vendorCategoryIds, []);
  const report = JSON.parse(await fs.readFile(path.join(directory, "report.json"), "utf8"));
  assert.equal(report.status, "committed-and-verified");
  assert.ok((await fs.stat(path.join(directory, "plan.ejson"))).size > 0);
});

test("applying a photography rename and pending mappings preserves IDs and complete vendor documents", async (t) => {
  const root = await temporaryRoot(t);
  const baseline = (await plan(emptySnapshot(), {
    categoryData: [{ name: "Photographers", services: ["Wedding Photography"] }],
    eventData: [
      { name: "Wedding", categoryNames: ["Photographers"], isActive: true },
      { name: "School Events", categoryNames: [], isActive: false },
    ],
  })).state;
  const main = baseline.categories.find((category) => category.parentId === null);
  const service = baseline.categories.find((category) => category.parentId !== null);
  main.description = "Existing photography business category";
  service.isActive = false;
  baseline.vendors.push({
    _id: objectId(), businessName: "Existing photography vendor",
    categoryIds: [main._id], selectedCategories: [{ categoryId: main._id, serviceIds: [service._id] }],
    eventTypeIds: [baseline.events[0]._id], historicalDetails: { keep: true },
  });
  const before = clone(baseline);
  const categoryData = [{
    name: "Photography & Videography", legacySlugs: ["photographers"],
    services: ["Wedding Photography", "Photographers", "Videographers"],
  }];
  const eventData = [
    { name: "Wedding", categoryNames: ["Photography & Videography"], isActive: true },
    { name: "School Events", categoryNames: ["Photography & Videography"], isActive: false },
  ];
  const connection = fakeConnection(baseline);
  await execute(connection, root, { categoryData, eventData });
  const persisted = connection.persisted;
  assert.deepEqual(persisted.vendors, before.vendors);
  assert.deepEqual(connection.calls.writes, ["categories", "eventtypes"]);
  const renamed = persisted.categories.find((category) => category.slug === "photography-and-videography");
  assert.ok(renamed._id.equals(main._id));
  assert.equal(renamed.description, main.description);
  const oldService = persisted.categories.find((category) => category._id.equals(service._id));
  assert.ok(oldService.parentId.equals(main._id));
  assert.equal(oldService.isActive, false);
  for (const event of persisted.events) {
    assert.ok(before.events.some((previous) => previous._id.equals(event._id)));
    assert.deepEqual(event.vendorCategoryIds, [main._id]);
  }
  assert.equal(persisted.events.find((event) => event.slug === "school-events").isActive, false);
  const second = await plan(persisted, { categoryData, eventData });
  assert.equal(second.changes.length, 0);
});

test("a lost commit acknowledgement is journaled as unknown and never retried or reported as rolled back", async (t) => {
  const root = await temporaryRoot(t);
  const connection = fakeConnection(emptySnapshot(), { commit: true });
  await assert.rejects(execute(connection, root), /lost commit acknowledgement/);
  assert.equal(connection.calls.commits, 1);
  assert.equal(connection.persisted.categories.length, 2);
  const { journal } = await recoveryFiles(root);
  assert.equal(journal.at(-1).status, "commit-outcome-unknown");
});
