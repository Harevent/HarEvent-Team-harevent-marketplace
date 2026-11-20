const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { execFileSync } = require("node:child_process");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const User = require("../models/User");
const Vendor = require("../models/Vendor");
const Category = require("../models/Category");
const EventType = require("../models/EventType");
const { requireApprovedVendor } = require("../middleware/requireApprovedVendor");
const { CATEGORY_DATA, EVENT_TYPE_DATA, slugify } = require("../scripts/seedReferenceData");
const { buildPlan: buildReferencePlan } = require("../scripts/referenceDataSeed");
const { generateVendorData, previewSnapshot, main } = require("../scripts/seedVendorData");
const { parseArguments, buildPlan, runSeed } = require("../scripts/vendorDataSeed");

const { EJSON } = mongoose.mongo.BSON;
const objectId = () => new mongoose.Types.ObjectId();
// Normal driver reads promote BSON numeric types to JavaScript numbers.
const clone = (value) => mongoose.mongo.BSON.deserialize(
  mongoose.mongo.BSON.serialize({ value }),
).value;
const env = {
  MONGODB_URI: "mongodb://localhost/harevent_dev",
  NODE_ENV: "development",
  SEED_DEV_DATABASE: "harevent_dev",
};
const referencePlan = buildReferencePlan({
  snapshot: { categories: [], events: [], vendors: [] },
  categoryData: CATEGORY_DATA, eventData: EVENT_TYPE_DATA, slugify, Category, EventType,
});
const fixtures = (count = 3, seed = 42) => generateVendorData({ count, seed });

async function snapshot() {
  return { ...clone((await referencePlan).state), users: [] };
}

function plan(initial, vendorData = fixtures()) {
  return buildPlan({ snapshot: initial, vendorData, User, Vendor });
}

function addTargets(initial, prepared) {
  return {
    ...clone(initial),
    users: [...clone(initial.users), ...clone(prepared.targets.users)],
    vendors: [...clone(initial.vendors), ...clone(prepared.targets.vendors)],
  };
}

async function withOriginalRecord() {
  const initial = await snapshot();
  const [entry] = fixtures(1);
  const vendor = (await plan(initial, [entry])).targets.vendors[0];
  initial.users.push({
    ...entry.user,
    _id: new mongoose.Types.ObjectId("6afd80818bfcaf9d73fe8620"),
    firebaseUid: "original-vendor-account",
    phoneNumber: "+919876543210",
    fullName: "Original vendor",
    email: "vendor@example.com",
  });
  initial.vendors.push({
    ...vendor,
    _id: new mongoose.Types.ObjectId("6afd80818bfcaf9d73fe8621"),
    userId: initial.users[0]._id,
    publicVendorId: "df7255f1-8139-4940-b9cd-28ee4036c37a",
    businessName: "Test Events",
    description: "Providing event management services",
    contactPhone: "+919876543210",
    contactEmail: "vendor@example.com",
    approvalStatus: "pending",
    isActive: false,
    createdAt: new Date("2026-11-18T10:40:01.689Z"),
    updatedAt: new Date("2026-11-18T10:40:01.689Z"),
    historicalField: { preserved: true },
  });
  return initial;
}

async function temporaryRoot(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "harevent-vendor-seed-test-"));
  t.after(async () => {
    const resolved = path.resolve(root);
    assert.ok(resolved.startsWith(path.resolve(os.tmpdir()) + path.sep));
    assert.ok(path.basename(resolved).startsWith("harevent-vendor-seed-test-"));
    await fs.rm(resolved, { recursive: true, force: true });
  });
  return root;
}

// Driver double for orchestration, not a simulation of server isolation/indexes.
function fakeConnection(initial, failures = {}) {
  let persisted = clone(initial);
  let staged;
  let transaction = false;
  let session;
  const calls = {
    connects: 0, disconnects: 0, reads: [], writes: [], starts: 0,
    aborts: 0, commits: 0, ends: 0, connectionOptions: null,
  };
  const stateKey = { categories: "categories", eventtypes: "events", users: "users", vendors: "vendors" };
  const indexes = {
    categories: [{ unique: true, key: { parentId: 1, slug: 1 } }],
    eventtypes: [{ unique: true, key: { slug: 1 } }],
    users: [{ unique: true, key: { firebaseUid: 1 } }, { unique: true, key: { phoneNumber: 1 } }],
    vendors: [{ unique: true, key: { userId: 1 } }, { unique: true, key: { publicVendorId: 1 } }],
  };
  const db = {
    databaseName: failures.databaseName || "harevent_dev",
    admin: () => ({
      command: async () => failures.standalone
        ? { logicalSessionTimeoutMinutes: 30, maxWireVersion: 25 }
        : { setName: "rs0", logicalSessionTimeoutMinutes: 30, maxWireVersion: 25 },
    }),
    collection(name) {
      assert.ok(Object.hasOwn(stateKey, name));
      return {
        listIndexes: () => ({
          toArray: async () => {
            if (failures.missingCollection === name) {
              const error = new Error("namespace missing");
              error.code = 26;
              throw error;
            }
            if (failures.missingIndexes) return [];
            return indexes[name].map((index) => ({
              ...index,
              ...(name === "vendors" ? failures.indexOptions : {}),
            }));
          },
        }),
        find(query, options = {}) {
          assert.deepEqual(query, {});
          calls.reads.push(name);
          if (failures.read === name) throw new Error("injected read failure");
          const source = options.session && transaction ? staged : persisted;
          let documents = clone(source[stateKey[name]]);
          if (name === "vendors" &&
              ((failures.verification === "before" && options.session && calls.writes.length) ||
               (failures.verification === "after" && !options.session && calls.commits))) {
            documents = documents.slice(0, -1);
          }
          return { toArray: async () => documents };
        },
        async bulkWrite(operations, options) {
          assert.equal(options.session, session);
          assert.equal(options.ordered, true);
          assert.ok(transaction);
          calls.writes.push(name);
          if (failures.write === name) throw new Error("injected write failure");
          for (const operation of operations) {
            assert.deepEqual(Object.keys(operation), ["insertOne"], "Existing documents must never be updated");
            staged[stateKey[name]].push(clone(operation.insertOne.document));
          }
          return { insertedCount: operations.length - (failures.writeCount ? 1 : 0) };
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
      calls.starts += 1;
      session = {
        startTransaction(options) {
          assert.deepEqual(options, {
            readConcern: { level: "snapshot" },
            writeConcern: { w: "majority" },
            readPreference: "primary",
          });
          staged = clone(persisted);
          transaction = true;
        },
        inTransaction: () => transaction,
        async abortTransaction() {
          calls.aborts += 1;
          if (failures.abort) throw new Error("injected abort failure");
          transaction = false;
          staged = undefined;
        },
        async commitTransaction() {
          calls.commits += 1;
          persisted = staged;
          transaction = false;
          if (failures.commit) throw new Error("injected lost commit acknowledgement");
        },
        async endSession() {
          calls.ends += 1;
          transaction = false;
          if (failures.end) throw new Error("injected session cleanup failure");
        },
      };
      return session;
    },
  };
}

function execute(connection, recoveryRoot, extra = {}) {
  return runSeed({
    options: parseArguments(["--apply", "--confirm-dev", "--count", "3"]),
    mongoose: connection, User, Vendor, vendorData: fixtures(),
    env, log: () => {}, recoveryRoot, ...extra,
  });
}

async function recoveryFiles(root) {
  const directories = await fs.readdir(root);
  assert.equal(directories.length, 1);
  const directory = path.join(root, directories[0]);
  const journal = (await fs.readFile(path.join(directory, "journal.jsonl"), "utf8"))
    .trim().split("\n").map(JSON.parse);
  return { directory, journal };
}

test("vendor seed accepts explicit modes and bounded count/seed options", () => {
  assert.deepEqual(parseArguments(["--dry-run"]), {
    mode: "dry-run", confirmDev: false, count: 10, seed: 42,
  });
  assert.deepEqual(parseArguments(["--count", "1", "--compare", "--seed", "0"]), {
    mode: "compare", confirmDev: false, count: 1, seed: 0,
  });
  assert.deepEqual(parseArguments(["--confirm-dev", "--seed", "4294967295", "--apply", "--count", "1000"]), {
    mode: "apply", confirmDev: true, count: 1000, seed: 4294967295,
  });
});

test("ambiguous, unconfirmed, repeated, unknown, and invalid arguments fail", () => {
  for (const argv of [
    [], ["--apply"], ["--confirm-dev"], ["--compare", "--apply", "--confirm-dev"],
    ["--dry-run", "--confirm-dev"], ["--compare", "--confirm-dev"],
    ["--dry-run", "--dry-run"], ["--dry-run", "--unknown"],
    ["--dry-run", "--reconcile", "x.json"],
    ...["0", "1001", "-1", "1.5", "1e2", "abc", "--compare"].map((value) => ["--dry-run", "--count", value]),
    ...["-1", "4294967296", "1.5", "0x42", "abc"].map((value) => ["--dry-run", "--seed", value]),
    ["--dry-run", "--count"], ["--dry-run", "--seed"],
    ["--dry-run", "--count", "1", "--count", "2"],
    ["--dry-run", "--seed", "1", "--seed", "2"],
  ]) {
    assert.throws(() => parseArguments(argv), /Use exactly one/);
  }
});

test("generated identities and random details are reproducible and remain stable as count grows", () => {
  const first = fixtures(2);
  assert.deepEqual(first, fixtures(2));
  assert.deepEqual(first, fixtures(10).slice(0, 2));
  assert.notDeepEqual(first, fixtures(2, 43));
  assert.notEqual(first[0].user._id.toString(), "6afd80818bfcaf9d73fe8620");
  assert.notEqual(first[0].vendor._id.toString(), "6afd80818bfcaf9d73fe8621");
  assert.notEqual(first[0].vendor.publicVendorId, "df7255f1-8139-4940-b9cd-28ee4036c37a");
  for (const count of [0, 1001, 1.5]) assert.throws(() => generateVendorData({ count }));
  for (const seed of [-1, 4294967296, 1.5]) assert.throws(() => generateVendorData({ seed }));
});

test("maximum-size generated batches have distinct account/profile identities and synthetic contacts", () => {
  const data = fixtures(1000, 4294967295);
  for (const key of ["firebaseUid", "phoneNumber", "_id"]) {
    assert.equal(new Set(data.map((entry) => String(entry.user[key]))).size, 1000);
  }
  for (const key of ["publicVendorId", "_id"]) {
    assert.equal(new Set(data.map((entry) => String(entry.vendor[key]))).size, 1000);
  }
  assert.equal(new Set(data.slice(0, 19).map((entry) => entry.categorySelections[0].categorySlug)).size, 19);
  for (const entry of data) {
    assert.match(entry.user.phoneNumber, /^\+91[6-9]\d{9}$/);
    assert.match(entry.user.email, /@example\.com$/);
    assert.match(entry.vendor.publicVendorId, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    assert.ok(entry.vendor.userId.equals(entry.user._id));
  }
});

test("the planner resolves real reference seed IDs and produces valid approved active vendors", async () => {
  const initial = await snapshot();
  const prepared = await plan(initial);
  assert.equal(prepared.changes.length, 6);
  const planner = initial.categories.find((category) => category.slug === "event-planners" && !category.parentId);
  const wedding = initial.events.find((event) => event.slug === "wedding");
  const first = prepared.targets.vendors[0];
  assert.ok(first.categoryIds[0].equals(planner._id));
  assert.ok(first.eventTypeIds[0].equals(wedding._id));
  assert.ok(!first.categoryIds[0].equals(previewSnapshot().categories.find((category) => category.slug === "event-planners")._id));
  assert.equal(first.startingPrice, 5000);
  for (const [index, vendor] of prepared.targets.vendors.entries()) {
    await new Vendor(vendor).validate();
    const user = prepared.targets.users[index];
    await new User(user).validate();
    assert.ok(vendor.userId.equals(user._id));
    assert.equal(user.role, "vendor");
    assert.equal(user.accountStatus, "active");
    assert.equal(vendor.approvalStatus, "approved");
    assert.equal(vendor.isActive, true);
    assert.equal(vendor.deletedAt, null);
    for (const selection of vendor.selectedCategories) {
      for (const serviceId of selection.serviceIds) {
        const service = initial.categories.find((category) => category._id.equals(serviceId));
        assert.ok(service.parentId.equals(selection.categoryId));
        assert.equal(service.isActive, true);
      }
    }
  }
});

test("a generated profile passes the real approved-vendor middleware", async (t) => {
  const prepared = await plan(await snapshot(), fixtures(1));
  const vendor = prepared.targets.vendors[0];
  const find = t.mock.method(Vendor, "findOne", async (query) => {
    assert.ok(query.userId.equals(vendor.userId));
    return vendor;
  });
  const next = t.mock.fn();
  const response = {
    status() { assert.fail("A seeded active vendor must be authorized"); },
  };
  await requireApprovedVendor({
    user: { userId: vendor.userId, role: "vendor" },
  }, response, next);
  assert.equal(find.mock.calls.length, 1);
  assert.equal(next.mock.calls.length, 1);
  assert.deepEqual(next.mock.calls[0].arguments, []);
});

test("reruns preserve original and manually edited seed records and only insert newly requested fixtures", async () => {
  const original = await withOriginalRecord();
  const before = clone(original);
  const first = await plan(original, fixtures(1));
  const current = addTargets(original, first);
  current.users[1].accountStatus = "disabled";
  current.users[1].fullName = "Manually edited test account";
  current.vendors[1].approvalStatus = "pending";
  current.vendors[1].isActive = false;
  current.vendors[1].startingPrice = 6250;
  current.vendors[1].customDetails = { keep: true };
  const currentBefore = clone(current);
  const second = await plan(current, fixtures(1));
  assert.deepEqual(second.changes, []);
  assert.equal(second.existing.length, 2);
  assert.ok(second.existing.some((entry) => entry.differences.some((difference) => difference.field === "isActive")));
  assert.deepEqual(second.targets.users[0], current.users[1]);
  assert.deepEqual(second.targets.vendors[0], current.vendors[1]);
  const expanded = await plan(current, fixtures(4));
  assert.equal(expanded.changes.length, 6);
  assert.deepEqual(current, currentBefore);
  assert.deepEqual(original, before);
  assert.ok(expanded.changes.every((entry) => entry.action === "insert"));
});

test("seed fixtures cannot adopt another User or repeat a generated identity", async () => {
  const initial = await snapshot();
  const data = fixtures(1);
  const foreign = clone(data[0]);
  foreign.vendor.userId = objectId();
  await assert.rejects(plan(initial, [foreign]), /its own generated User/);
  await assert.rejects(plan(initial, [data[0], data[0]]), /duplicate seed identities/);
});

test("occupied User/Vendor identities stop the plan without modifying existing data", async () => {
  const initial = await snapshot();
  const data = fixtures(1);
  const expected = (await plan(initial, data)).targets;
  const cases = [
    { users: [{ ...expected.users[0], firebaseUid: "unrelated-account" }] },
    { users: [{ ...expected.users[0], _id: objectId(), phoneNumber: "+919000000001" }] },
    { users: [{ ...expected.users[0], _id: objectId(), firebaseUid: "unrelated-account" }] },
    { vendors: [{ ...expected.vendors[0], publicVendorId: "unrelated-profile" }] },
    { vendors: [{ ...expected.vendors[0], _id: objectId(), userId: objectId() }] },
    { vendors: [{ ...expected.vendors[0], _id: objectId(), publicVendorId: "unrelated-profile" }] },
  ];
  for (const occupied of cases) {
    const current = { ...clone(initial), ...occupied };
    const before = clone(current);
    await assert.rejects(plan(current, data), /identity collision|does not match this seed identity/);
    assert.deepEqual(current, before);
  }
});

test("missing, inactive, ambiguous, and mismapped references stop new seed proposals", async () => {
  const initial = await snapshot();
  const planner = initial.categories.find((category) => category.slug === "event-planners");
  const service = initial.categories.find((category) => category.slug === "wedding-planners");
  const wedding = initial.events.find((event) => event.slug === "wedding");
  const cases = [
    [({ categories }) => categories.splice(categories.findIndex((entry) => entry._id.equals(planner._id)), 1), /Missing main category/],
    [({ categories }) => categories.splice(categories.findIndex((entry) => entry._id.equals(service._id)), 1), /Missing service/],
    [({ events }) => events.splice(events.findIndex((entry) => entry._id.equals(wedding._id)), 1), /Missing EventType/],
    [({ categories }) => { categories.find((entry) => entry._id.equals(planner._id)).isActive = false; }, /active category/],
    [({ categories }) => { categories.find((entry) => entry._id.equals(service._id)).isActive = false; }, /active service/],
    [({ events }) => { events.find((entry) => entry._id.equals(wedding._id)).isActive = false; }, /active EventType/],
    [({ events }) => { events.find((entry) => entry._id.equals(wedding._id)).vendorCategoryIds = []; }, /does not map/],
    [({ categories }) => categories.push({ ...planner, _id: objectId() }), /duplicate category identity/],
    [({ events }) => events.push({ ...wedding, _id: objectId() }), /duplicate EventType slug/],
  ];
  for (const [mutate, pattern] of cases) {
    const current = clone(initial);
    mutate(current);
    await assert.rejects(plan(current, fixtures(1)), pattern);
  }
});

test("schema-invalid generated data fails explicit validation before writes", async () => {
  const initial = await snapshot();
  for (const mutate of [
    (entry) => { entry.user.phoneNumber = "9876543210"; },
    (entry) => { entry.user.role = "admin"; },
    (entry) => { entry.vendor.contactEmail = "invalid-email"; },
    (entry) => { entry.vendor.startingPrice = -1; },
    (entry) => { entry.vendor.location.city = ""; },
    (entry) => { entry.vendor.serviceAreas = ["Pune", " pune "]; },
    (entry) => { entry.categorySelections[0].serviceSlugs.push("wedding-planners"); },
    (entry) => { entry.categorySelections = []; },
    (entry) => { entry.eventTypeSlugs = []; },
  ]) {
    const data = fixtures(1);
    mutate(data[0]);
    const connection = fakeConnection(initial);
    await assert.rejects(execute(connection, undefined, { vendorData: data }));
    assert.deepEqual(connection.calls.writes, []);
    assert.equal(connection.calls.commits, 0);
    assert.equal(connection.calls.disconnects, 1);
  }
});

test("compare reads actual references and identities without transactions, writes, or recovery files", async (t) => {
  const root = await temporaryRoot(t);
  const connection = fakeConnection(await withOriginalRecord());
  const report = await execute(connection, root, {
    options: parseArguments(["--compare", "--count", "3"]),
  });
  assert.equal(report.readyToApply, true);
  assert.deepEqual(report.counts, { inserts: 6, updates: 0, unchanged: 0 });
  assert.deepEqual(report.collectionCounts, {
    users: { inserts: 3, updates: 0, unchanged: 0 },
    vendors: { inserts: 3, updates: 0, unchanged: 0 },
  });
  assert.equal(report.activeVendorCount, 3);
  assert.deepEqual(connection.calls.reads, ["categories", "eventtypes", "users", "vendors"]);
  assert.deepEqual(connection.calls.writes, []);
  assert.equal(connection.calls.starts, 0);
  assert.equal(connection.calls.commits, 0);
  assert.equal(connection.calls.disconnects, 1);
  assert.deepEqual(connection.calls.connectionOptions, {
    autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 10000,
  });
  assert.deepEqual(await fs.readdir(root), []);
});

test("comparison reports unsafe environments, standalone servers, and missing or unsuitable indexes", async (t) => {
  const root = await temporaryRoot(t);
  for (const [failures, overrideEnv] of [
    [{}, { ...env, NODE_ENV: "production" }],
    [{ standalone: true }, env],
    [{ missingIndexes: true }, env],
    [{ missingCollection: "vendors" }, env],
    [{ indexOptions: { sparse: true } }, env],
    [{ indexOptions: { partialFilterExpression: { isActive: true } } }, env],
    [{ indexOptions: { buildUUID: "building" } }, env],
    [{ indexOptions: { collation: { locale: "en" } } }, env],
  ]) {
    const connection = fakeConnection(await snapshot(), failures);
    const report = await execute(connection, root, {
      options: parseArguments(["--compare"]), env: overrideEnv,
    });
    assert.equal(report.readyToApply, false);
    assert.ok(report.indexProblems.length || report.prerequisiteProblems.length);
    if (failures.missingIndexes) assert.equal(report.indexProblems.length, 6);
    assert.deepEqual(connection.calls.writes, []);
    assert.equal(connection.calls.starts, 0);
    assert.equal(connection.calls.disconnects, 1);
  }
  assert.deepEqual(await fs.readdir(root), []);
});

test("unconfirmed apply, unsafe development targets, and missing URIs fail before connecting", async () => {
  for (const extra of [
    { options: { mode: "apply", confirmDev: false } },
    { env: { ...env, NODE_ENV: "production" } },
    { env: { ...env, NODE_ENV: "test" } },
    { env: { ...env, SEED_DEV_DATABASE: "other_dev" } },
    { env: { ...env, MONGODB_URI: "mongodb://localhost/harevent_prod_dev", SEED_DEV_DATABASE: "harevent_prod_dev" } },
    { env: { ...env, MONGODB_URI: "mongodb://localhost/harevent", SEED_DEV_DATABASE: "harevent" } },
    { env: { ...env, MONGODB_URI: "mongodb://localhost/" } },
    { env: { ...env, MONGODB_URI: "" } },
    { env: { ...env, MONGODB_URI: "replace_with_your_mongodb_connection_string" } },
  ]) {
    const connection = fakeConnection(await snapshot());
    await assert.rejects(execute(connection, undefined, extra));
    assert.equal(connection.calls.connects, 0);
    assert.deepEqual(connection.calls.writes, []);
  }
});

test("connection, DNS, deployment, index, read, and identity failures clean up without writes", async (t) => {
  const root = await temporaryRoot(t);
  for (const failures of [
    { connect: true }, { standalone: true }, { missingIndexes: true },
    { databaseName: "harevent_prod" }, { read: "users" },
    { indexOptions: { unique: false } },
  ]) {
    const connection = fakeConnection(await snapshot(), failures);
    await assert.rejects(execute(connection, root));
    assert.equal(connection.calls.disconnects, 1);
    assert.deepEqual(connection.calls.writes, []);
  }
  const dnsConnection = fakeConnection(await snapshot());
  await assert.rejects(execute(dnsConnection, root, {
    env: { ...env, MONGODB_DNS_SERVERS: "invalid" },
  }), /MONGODB_DNS_SERVERS must be/);
  assert.equal(dnsConnection.calls.connects, 0);
  assert.equal(dnsConnection.calls.disconnects, 1);

  const occupied = await snapshot();
  occupied.users.push({ ...fixtures(1)[0].user, _id: objectId() });
  const collisionConnection = fakeConnection(occupied);
  await assert.rejects(execute(collisionConnection, root), /identity collision/);
  assert.deepEqual(collisionConnection.calls.writes, []);
  assert.equal(collisionConnection.calls.aborts, 1);
  assert.deepEqual(await fs.readdir(root), []);
});

test("a backup filesystem failure aborts before the User or Vendor insert", async (t) => {
  const root = await temporaryRoot(t);
  const blocked = path.join(root, "not-a-directory");
  await fs.writeFile(blocked, "occupied");
  const connection = fakeConnection(await snapshot());
  await assert.rejects(execute(connection, blocked));
  assert.deepEqual(connection.calls.writes, []);
  assert.equal(connection.calls.aborts, 1);
  assert.equal(connection.calls.ends, 1);
  assert.equal(connection.calls.disconnects, 1);
});

test("a Vendor write failure rolls back its User inserts and leaves the original record intact", async (t) => {
  const root = await temporaryRoot(t);
  const initial = await withOriginalRecord();
  const connection = fakeConnection(initial, { write: "vendors" });
  await assert.rejects(execute(connection, root), /injected write failure/);
  assert.deepEqual(connection.persisted, initial);
  assert.deepEqual(connection.calls.writes, ["users", "vendors"]);
  assert.equal(connection.calls.aborts, 1);
  assert.equal(connection.calls.commits, 0);
  const { directory, journal } = await recoveryFiles(root);
  assert.equal(journal.at(-1).status, "aborted");
  const backupText = await fs.readFile(path.join(directory, "backup.ejson"), "utf8");
  assert.equal(createHash("sha256").update(backupText).digest("hex"), journal[0].backupSha256);
  const backup = EJSON.parse(backupText, { relaxed: false });
  assert.deepEqual(clone(backup.users), initial.users);
  assert.deepEqual(clone(backup.vendors), initial.vendors);
  assert.ok(backup.vendors[0]._id instanceof mongoose.Types.ObjectId);
  assert.ok(backup.vendors[0].createdAt instanceof Date);
});

test("write-count and pre-commit verification failures roll back all new records", async (t) => {
  for (const failure of [{ writeCount: true }, { verification: "before" }]) {
    const root = await temporaryRoot(t);
    const initial = await snapshot();
    const connection = fakeConnection(initial, failure);
    await assert.rejects(execute(connection, root), /Write counts|verification failed/);
    assert.deepEqual(connection.persisted, initial);
    assert.equal(connection.calls.commits, 0);
    assert.equal(connection.calls.aborts, 1);
    const { journal } = await recoveryFiles(root);
    assert.equal(journal.at(-1).status, "aborted");
  }
});

test("apply inserts valid linked records, verifies both sides of commit, and backs up complete before-images", async (t) => {
  const root = await temporaryRoot(t);
  const initial = await withOriginalRecord();
  const connection = fakeConnection(initial);
  const report = await execute(connection, root);
  assert.equal(connection.calls.commits, 1);
  assert.equal(connection.calls.aborts, 0);
  assert.equal(connection.calls.ends, 1);
  assert.equal(connection.calls.disconnects, 1);
  assert.deepEqual(connection.calls.writes, ["users", "vendors"]);
  assert.equal(connection.persisted.users.length, 4);
  assert.equal(connection.persisted.vendors.length, 4);
  assert.deepEqual(connection.persisted.users[0], initial.users[0]);
  assert.deepEqual(connection.persisted.vendors[0], initial.vendors[0]);
  assert.deepEqual(connection.persisted.categories, initial.categories);
  assert.deepEqual(connection.persisted.events, initial.events);
  for (const [index, vendor] of connection.persisted.vendors.slice(1).entries()) {
    const user = connection.persisted.users[index + 1];
    await new User(user).validate();
    await new Vendor(vendor).validate();
    assert.ok(vendor.userId.equals(user._id));
    assert.ok(user.createdAt instanceof Date);
    assert.ok(vendor.createdAt instanceof Date);
    assert.deepEqual(user.createdAt, user.updatedAt);
    assert.deepEqual(vendor.createdAt, vendor.updatedAt);
    assert.equal(vendor.__v, 0);
    assert.equal(vendor.isActive, true);
    assert.equal(vendor.approvalStatus, "approved");
  }
  const { directory, journal } = await recoveryFiles(root);
  assert.equal(journal.at(-1).status, "verified-after-commit");
  assert.ok(journal.some((entry) => entry.status === "verified-before-commit"));
  const backup = EJSON.parse(await fs.readFile(path.join(directory, "backup.ejson"), "utf8"), { relaxed: false });
  assert.deepEqual(clone(backup.users), initial.users);
  assert.deepEqual(clone(backup.vendors), initial.vendors);
  const savedReport = JSON.parse(await fs.readFile(path.join(directory, "report.json"), "utf8"));
  assert.equal(savedReport.status, "committed-and-verified");
  assert.deepEqual(savedReport.counts, report.counts);
  const savedPlan = EJSON.parse(await fs.readFile(path.join(directory, "plan.ejson"), "utf8"), { relaxed: false });
  assert.equal(savedPlan.changes.length, 6);
  assert.ok(savedPlan.changes.every((entry) => entry.action === "insert"));
  const after = await plan(connection.persisted);
  assert.deepEqual(after.changes, []);
});

test("reapplying an existing batch does not write, back up, or reactivate edited test records", async (t) => {
  const initial = await snapshot();
  const current = addTargets(initial, await plan(initial));
  current.vendors[0].isActive = false;
  current.vendors[0].approvalStatus = "pending";
  const root = await temporaryRoot(t);
  const connection = fakeConnection(current);
  const report = await execute(connection, root);
  assert.deepEqual(report.counts, { inserts: 0, updates: 0, unchanged: 6 });
  assert.equal(report.activeVendorCount, 2);
  assert.deepEqual(connection.persisted, current);
  assert.deepEqual(connection.calls.writes, []);
  assert.equal(connection.calls.commits, 0);
  assert.equal(connection.calls.aborts, 1);
  assert.deepEqual(await fs.readdir(root), []);
});

test("lost commit acknowledgement is recorded as unknown and the transaction is never retried", async (t) => {
  const root = await temporaryRoot(t);
  const initial = await snapshot();
  const connection = fakeConnection(initial, { commit: true });
  await assert.rejects(execute(connection, root), /lost commit acknowledgement/);
  assert.equal(connection.calls.commits, 1);
  assert.equal(connection.calls.aborts, 0);
  assert.equal(connection.persisted.users.length, 3);
  assert.equal(connection.persisted.vendors.length, 3);
  const { journal } = await recoveryFiles(root);
  assert.equal(journal.at(-1).status, "commit-outcome-unknown");
});

test("post-commit verification failures are reported as committed and are not rolled back", async (t) => {
  const root = await temporaryRoot(t);
  const connection = fakeConnection(await snapshot(), { verification: "after" });
  await assert.rejects(execute(connection, root), /verification failed/);
  assert.equal(connection.calls.commits, 1);
  assert.equal(connection.calls.aborts, 0);
  assert.equal(connection.persisted.vendors.length, 3);
  const { journal } = await recoveryFiles(root);
  assert.equal(journal.at(-1).status, "committed-followup-failed");
});

test("an unacknowledged abort is journaled and session-cleanup failure still disconnects", async (t) => {
  const root = await temporaryRoot(t);
  const connection = fakeConnection(await snapshot(), { write: "vendors", abort: true });
  await assert.rejects(execute(connection, root), /write failure/);
  const { journal } = await recoveryFiles(root);
  assert.equal(journal.at(-1).status, "abort-unconfirmed");
  assert.equal(connection.calls.disconnects, 1);
  const cleanupConnection = fakeConnection(await snapshot(), { end: true, read: "users" });
  await assert.rejects(execute(cleanupConnection, root), /session cleanup failure/);
  assert.equal(cleanupConnection.calls.disconnects, 1);
});

test("main dry-run validates and previews all generated values without loading .env or connecting", async (t) => {
  const config = t.mock.method(dotenv, "config", () => { assert.fail("Dry-run must not load .env"); });
  const connect = t.mock.method(mongoose, "connect", () => { assert.fail("Dry-run must not connect"); });
  t.mock.method(console, "log", () => {});
  const report = await main(["--dry-run", "--count", "1", "--seed", "7"]);
  assert.equal(report.mode, "dry-run");
  assert.equal(report.seed, 7);
  assert.equal(report.vendorCount, 1);
  assert.equal(report.userCount, 1);
  assert.equal(report.referenceIdsArePlaceholders, true);
  await new Vendor(report.records[0].vendor).validate();
  await new User(report.records[0].user).validate();
  assert.equal(config.mock.calls.length, 0);
  assert.equal(connect.mock.calls.length, 0);
});

test("CLI dry-run and invalid commands do not depend on a usable MongoDB URI", () => {
  const script = path.join(__dirname, "..", "scripts", "seedVendorData.js");
  const childOptions = {
    encoding: "utf8",
    env: { ...process.env, MONGODB_URI: "invalid-secret-value", NODE_ENV: "production" },
    stdio: "pipe",
  };
  assert.match(execFileSync(process.execPath, [script, "--dry-run", "--count", "1"], childOptions), /No database connection or writes/);
  for (const argv of [[], ["--apply"], ["--dry-run", "--count", "0"]]) {
    assert.throws(() => execFileSync(process.execPath, [script, ...argv], childOptions), (error) => {
      assert.equal(error.status, 1);
      assert.match(error.stderr, /Use exactly one/);
      assert.ok(!error.stderr.includes("invalid-secret-value"));
      return true;
    });
  }
});

async function assertMainCompare(t, runMain, expectedCount) {
  const originalDb = mongoose.connection.db;
  const keys = [...Object.keys(env), "MONGODB_DNS_SERVERS"];
  const originalEnvironment = new Map(keys.map((key) => [key, process.env[key]]));
  t.after(() => {
    mongoose.connection.db = originalDb;
    for (const [key, value] of originalEnvironment) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  for (const [key, value] of Object.entries(env)) process.env[key] = value;
  delete process.env.MONGODB_DNS_SERVERS;
  t.mock.method(dotenv, "config", () => ({ parsed: {} }));
  const log = t.mock.method(console, "log", () => {});
  const connection = fakeConnection(await snapshot());
  const connect = t.mock.method(mongoose, "connect", async () => {
    mongoose.connection.db = connection.connection.db;
  });
  const disconnect = t.mock.method(mongoose, "disconnect", async () => {});
  const startSession = t.mock.method(mongoose, "startSession", () => {
    assert.fail("Compare must not start a write transaction");
  });
  const report = await runMain();
  assert.equal(report.readyToApply, true);
  assert.equal(report.vendorCount, expectedCount);
  assert.equal(report.activeVendorCount, expectedCount);
  assert.deepEqual(report.counts, { inserts: expectedCount * 2, updates: 0, unchanged: 0 });
  assert.deepEqual(connection.calls.reads, ["categories", "eventtypes", "users", "vendors"]);
  assert.deepEqual(connection.calls.writes, []);
  assert.deepEqual(connect.mock.calls[0].arguments, [
    env.MONGODB_URI,
    { autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 10000 },
  ]);
  assert.equal(disconnect.mock.calls.length, 1);
  assert.equal(startSession.mock.calls.length, 0);
  assert.equal(log.mock.calls.length, 1);
  assert.deepEqual(JSON.parse(log.mock.calls[0].arguments[0]), JSON.parse(JSON.stringify(report)));
}

test("main --compare sends the default generated batch to the real runner without writes", async (t) => {
  await assertMainCompare(t, () => main(["--compare"]), 10);
});

test("main reads count, seed, and compare mode from process.argv", async (t) => {
  const originalArgv = process.argv;
  t.after(() => { process.argv = originalArgv; });
  process.argv = [process.execPath, "scripts/seedVendorData.js", "--compare", "--count", "1", "--seed", "99"];
  await assertMainCompare(t, () => main(), 1);
});
