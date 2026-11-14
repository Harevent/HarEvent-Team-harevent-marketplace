const fs = require("node:fs/promises");
const path = require("node:path");
const { createHash, randomUUID } = require("node:crypto");
const mongoose = require("mongoose");
const configureMongoDns = require("../config/mongoDns");

const { EJSON } = mongoose.mongo.BSON;
const USAGE = "Use exactly one of --dry-run, --compare, or --apply --confirm-dev. Optional --reconcile <file> is allowed for compare/apply.";

function fail(message) {
  const error = new Error(message);
  error.seedMessage = message;
  throw error;
}

function parseArguments(argv) {
  const flags = new Set();
  let reconcileFile;
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (flags.has(flag)) fail(USAGE);
    flags.add(flag);
    if (flag === "--reconcile") {
      reconcileFile = argv[++i];
      if (!reconcileFile || reconcileFile.startsWith("--")) fail(USAGE);
    } else if (!["--dry-run", "--compare", "--apply", "--confirm-dev"].includes(flag)) {
      fail(USAGE);
    }
  }
  const modes = ["dry-run", "compare", "apply"].filter((mode) => flags.has("--" + mode));
  if (modes.length !== 1) fail(USAGE);
  const mode = modes[0];
  if (flags.has("--confirm-dev") !== (mode === "apply")) fail(USAGE);
  if (mode === "dry-run" && reconcileFile) fail(USAGE);
  return { mode, reconcileFile, confirmDev: flags.has("--confirm-dev") };
}

function verifyDevelopmentTarget(databaseName, env) {
  if (env.NODE_ENV !== "development") fail("Apply requires NODE_ENV=development.");
  if (!databaseName || /prod/i.test(databaseName) || !/(^|[_-])dev(elopment)?($|[_-])/i.test(databaseName)) {
    fail("Apply requires a database with a dev/development name segment; production names are blocked.");
  }
  if (env.SEED_DEV_DATABASE !== databaseName) {
    fail("Set SEED_DEV_DATABASE to the exact intended development database name.");
  }
}

function databaseFromUri(uri) {
  const match = /^mongodb(?:\+srv)?:\/\/[^/?#]+\/([^/?#]+)(?:\?[^#]*)?$/.exec(uri);
  if (!match) fail("Apply requires an explicit database name in MONGODB_URI.");
  try {
    return decodeURIComponent(match[1]);
  } catch {
    fail("MONGODB_URI contains an invalid database name.");
  }
}

function id(value) {
  if (!value || !mongoose.isObjectIdOrHexString(value)) fail("Reference data contains an invalid ObjectId.");
  return value.toString();
}

function categoryKey(document) {
  return `${document.parentId == null ? "main" : id(document.parentId)}/${document.slug}`;
}

// Both schemas default to active. Legacy records without this field must not
// silently escape stale-record review or reference checks.
function isActive(document) {
  return document.isActive !== false;
}

function uniqueMap(documents, key, label) {
  const map = new Map();
  const ids = new Set();
  for (const document of documents) {
    const documentId = id(document._id);
    const identity = key(document);
    if (map.has(identity) || ids.has(documentId)) fail(`Existing duplicate ${label}: ${identity}. Resolve duplicates before applying.`);
    if (typeof document.slug !== "string" || !document.slug.trim()) fail(`Existing ${label} has an invalid slug.`);
    map.set(identity, document);
    ids.add(documentId);
  }
  return map;
}

const RECONCILIATION_KEYS = ["categoryRenames", "eventTypeRenames", "deactivateCategoryIds", "deactivateEventTypeIds", "retainCategoryIds", "retainEventTypeIds"];

function validateReconciliation(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) fail("Reconciliation must be a JSON object.");
  if (Object.keys(input).some((key) => !RECONCILIATION_KEYS.includes(key))) fail("Unknown reconciliation field.");
  const result = {};
  for (const key of RECONCILIATION_KEYS) {
    const entries = input[key] === undefined ? [] : input[key];
    if (!Array.isArray(entries)) fail(`Reconciliation ${key} must be an array.`);
    result[key] = entries;
  }
  for (const kind of ["category", "eventType"]) {
    const seen = new Set();
    const targets = new Set();
    for (const entry of result[`${kind}Renames`]) {
      const allowed = kind === "category" ? ["id", "slug", "parentSlug"] : ["id", "slug"];
      if (!entry || typeof entry !== "object" || Object.keys(entry).some((key) => !allowed.includes(key))) fail("Invalid rename entry.");
      const entryId = id(entry.id);
      if (typeof entry.slug !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.slug)) fail("Rename targets must use a valid seed slug.");
      if (kind === "category" && entry.parentSlug !== null && (typeof entry.parentSlug !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.parentSlug))) fail("Category renames require parentSlug: null for a main category, or its seed parent slug for a service.");
      const target = `${entry.parentSlug || "main"}/${entry.slug}`;
      if (seen.has(entryId) || targets.has(target)) fail("Duplicate or conflicting rename decisions.");
      seen.add(entryId);
      targets.add(target);
    }
    const suffix = kind === "category" ? "CategoryIds" : "EventTypeIds";
    for (const key of [`deactivate${suffix}`, `retain${suffix}`]) {
      for (const entryId of result[key]) {
        const normalized = id(entryId);
        if (seen.has(normalized)) fail("Duplicate or conflicting reconciliation decisions.");
        seen.add(normalized);
      }
    }
  }
  return result;
}

function equivalent(left, right) {
  return EJSON.stringify(left, { relaxed: false }) === EJSON.stringify(right, { relaxed: false });
}

function referenceSets(vendors, events, categories) {
  const categoryRefs = new Set();
  const eventRefs = new Set();
  for (const vendor of vendors) {
    for (const categoryId of vendor.categoryIds || []) categoryRefs.add(id(categoryId));
    for (const selection of vendor.selectedCategories || []) {
      categoryRefs.add(id(selection.categoryId));
      for (const serviceId of selection.serviceIds || []) categoryRefs.add(id(serviceId));
    }
    for (const eventId of vendor.eventTypeIds || []) eventRefs.add(id(eventId));
  }
  // Event mappings and child-to-parent links protect categories from retirement,
  // even when the referencing event or child category is inactive.
  for (const event of events) {
    for (const categoryId of event.vendorCategoryIds || []) categoryRefs.add(id(categoryId));
  }
  for (const category of categories) {
    if (category.parentId) categoryRefs.add(id(category.parentId));
  }
  return { categoryRefs, eventRefs };
}

async function validateProposedState(state, Category, EventType) {
  const categories = new Map(state.categories.map((document) => [id(document._id), document]));
  const events = new Map(state.events.map((document) => [id(document._id), document]));
  uniqueMap(state.categories, categoryKey, "category identity");
  uniqueMap(state.events, (document) => document.slug, "EventType slug");
  for (const category of state.categories) {
    await new Category(category).validate();
    if (category.parentId) {
      const parent = categories.get(id(category.parentId));
      if (!parent || parent.parentId != null) fail(`Service ${category.slug} has a missing or non-main parent.`);
      if (isActive(category) && !isActive(parent)) fail(`Active service ${category.slug} has an inactive parent.`);
    }
  }
  for (const event of state.events) {
    await new EventType(event).validate();
    if (isActive(event) && !event.vendorCategoryIds?.length) fail(`Active EventType ${event.slug} has no mappings.`);
    for (const categoryId of event.vendorCategoryIds || []) {
      const category = categories.get(id(categoryId));
      if (!category || category.parentId != null) fail(`EventType ${event.slug} references a missing or non-main category.`);
      if (isActive(event) && !isActive(category)) fail(`Active EventType ${event.slug} references an inactive category.`);
    }
  }
  for (const vendor of state.vendors) {
    const selected = new Set((vendor.categoryIds || []).map(id));
    for (const categoryId of selected) {
      if (!categories.has(categoryId) || categories.get(categoryId).parentId != null) fail("Vendor references a missing or non-main category.");
    }
    for (const selection of vendor.selectedCategories || []) {
      if (!selected.has(id(selection.categoryId))) fail("Vendor selection is absent from categoryIds.");
      for (const serviceId of selection.serviceIds || []) {
        const service = categories.get(id(serviceId));
        if (!service || !service.parentId || id(service.parentId) !== id(selection.categoryId)) fail("Vendor references a missing service or a service under the wrong parent.");
      }
    }
    for (const eventId of vendor.eventTypeIds || []) {
      if (!events.has(id(eventId))) fail("Vendor references a missing EventType.");
    }
  }
}

async function buildPlan({ snapshot, categoryData, eventData, slugify, Category, EventType, reconciliation }) {
  const decisions = validateReconciliation(reconciliation);
  const categoryByKey = uniqueMap(snapshot.categories, categoryKey, "category identity");
  const eventBySlug = uniqueMap(snapshot.events, (document) => document.slug, "EventType slug");
  const categoryById = new Map(snapshot.categories.map((document) => [id(document._id), document]));
  const eventById = new Map(snapshot.events.map((document) => [id(document._id), document]));
  const categories = new Map(categoryById);
  const events = new Map(eventById);
  const usedCategoryIds = new Set();
  const usedEventIds = new Set();
  const usedRenames = new Set();
  const mainIds = new Map();
  const changes = [];
  const stale = [];
  const unresolved = [];

  function prepare(Model, existing, fields) {
    const document = new Model({ ...existing, ...fields, _id: existing?._id || new mongoose.Types.ObjectId() }).toObject();
    // Keep unknown historical fields as well as manually maintained descriptions.
    return { ...existing, ...document };
  }

  function record(collection, existing, document) {
    const fields = Object.keys(document).filter((key) => !["_id", "__v", "createdAt", "updatedAt"].includes(key) && !equivalent(existing?.[key], document[key]));
    if (!existing || fields.length) {
      changes.push({ collection, action: existing ? "update" : "insert", id: id(document._id), slug: document.slug, fields, before: existing || null, after: document });
    }
  }

  function matchCategory(slug, parentSlug, parentId, legacySlugs = []) {
    const existing = categoryByKey.get(`${parentId ? id(parentId) : "main"}/${slug}`);
    const rename = decisions.categoryRenames.find((entry) => entry.slug === slug && entry.parentSlug === parentSlug);
    if (!rename) {
      if (existing) return existing;
      const legacyMatches = legacySlugs
        .map((legacySlug) => categoryByKey.get(`${parentId ? id(parentId) : "main"}/${legacySlug}`))
        .filter(Boolean);
      if (legacyMatches.length > 1) fail("Multiple legacy categories match a seed rename; provide an explicit reconciliation.");
      // Keep the parent ID and all service/vendor references for known renames.
      // When both identities exist, the old category needs stale-record review.
      return legacyMatches[0];
    }
    const source = categoryById.get(id(rename.id));
    if (!source) fail("Category rename source does not exist.");
    if (existing && id(existing._id) !== id(source._id)) fail("Category rename target already exists.");
    if ((source.parentId == null) !== (parentId == null) || (source.parentId && id(source.parentId) !== id(parentId))) fail("Category renames cannot move a service to another parent.");
    usedRenames.add(`category/${id(source._id)}`);
    return source;
  }

  for (const [sortOrder, category] of categoryData.entries()) {
    const slug = slugify(category.name);
    const existing = matchCategory(slug, null, null, category.legacySlugs);
    const document = prepare(Category, existing, {
      name: category.name, slug, parentId: null,
      isActive: existing ? isActive(existing) : true,
      sortOrder,
    });
    const documentId = id(document._id);
    if (usedCategoryIds.has(documentId)) fail("A category matches multiple seed identities; provide an explicit rename.");
    usedCategoryIds.add(documentId);
    mainIds.set(slug, document._id);
    categories.set(documentId, document);
    record("categories", existing, document);
  }
  for (const category of categoryData) {
    const parentSlug = slugify(category.name);
    const parentId = mainIds.get(parentSlug);
    for (const [sortOrder, name] of category.services.entries()) {
      const slug = slugify(name);
      const existing = matchCategory(slug, parentSlug, parentId);
      const document = prepare(Category, existing, {
        name, slug, parentId,
        isActive: existing ? isActive(existing) : true,
        sortOrder,
      });
      const documentId = id(document._id);
      if (usedCategoryIds.has(documentId)) fail("A service matches multiple seed identities; provide an explicit rename.");
      usedCategoryIds.add(documentId);
      categories.set(documentId, document);
      record("categories", existing, document);
    }
  }
  for (const event of eventData) {
    const slug = slugify(event.name);
    let existing = eventBySlug.get(slug);
    const rename = decisions.eventTypeRenames.find((entry) => entry.slug === slug);
    if (rename) {
      const source = eventById.get(id(rename.id));
      if (!source) fail("EventType rename source does not exist.");
      if (existing && id(existing._id) !== id(source._id)) fail("EventType rename target already exists.");
      existing = source;
      usedRenames.add(`eventType/${id(source._id)}`);
    }
    const vendorCategoryIds = [...(existing?.vendorCategoryIds || [])];
    const mappedIds = new Set(vendorCategoryIds.map(id));
    for (const name of event.categoryNames) {
      const categoryId = mainIds.get(slugify(name));
      if (!categoryId) fail(`Cannot resolve category ${name} for EventType ${event.name}.`);
      if (!mappedIds.has(id(categoryId))) vendorCategoryIds.push(categoryId);
      mappedIds.add(id(categoryId));
    }
    // Defaults apply to inserts. A routine seed must not re-activate a manually
    // disabled event or change the saved status of an already reviewed event.
    const document = prepare(EventType, existing, {
      name: event.name, slug, vendorCategoryIds,
      isActive: existing ? isActive(existing) : Boolean(event.isActive),
    });
    const documentId = id(document._id);
    if (usedEventIds.has(documentId)) fail("An EventType matches multiple seed identities; provide an explicit rename.");
    usedEventIds.add(documentId);
    events.set(documentId, document);
    record("events", existing, document);
  }
  for (const kind of ["category", "eventType"]) {
    for (const rename of decisions[`${kind}Renames`]) {
      if (!usedRenames.has(`${kind}/${id(rename.id)}`)) fail("Rename target is absent from the seed data.");
    }
  }

  for (const [collection, documents, used, suffix] of [
    ["categories", categories, usedCategoryIds, "CategoryIds"],
    ["events", events, usedEventIds, "EventTypeIds"],
  ]) {
    const deactivate = new Set(decisions[`deactivate${suffix}`].map(id));
    const retain = new Set(decisions[`retain${suffix}`].map(id));
    for (const documentId of [...deactivate, ...retain]) {
      if (!documents.has(documentId) || used.has(documentId)) fail("Retain/deactivate decisions must name existing records outside the seed.");
    }
    for (const [documentId, existing] of documents) {
      if (used.has(documentId)) continue;
      const action = deactivate.has(documentId) ? "deactivate" : retain.has(documentId) ? "retain" : isActive(existing) ? "unresolved" : "retain-inactive";
      stale.push({ collection, id: documentId, slug: existing.slug, action });
      if (action === "unresolved") unresolved.push(`${collection}/${documentId}`);
      if (action === "deactivate" && isActive(existing)) {
        const document = { ...existing, isActive: false };
        documents.set(documentId, document);
        record(collection, existing, document);
      }
    }
  }
  const state = { categories: [...categories.values()], events: [...events.values()], vendors: snapshot.vendors };
  const refs = referenceSets(snapshot.vendors, state.events, state.categories);
  for (const entry of stale.filter((entry) => entry.action === "deactivate")) {
    const references = entry.collection === "categories" ? refs.categoryRefs : refs.eventRefs;
    if (references.has(entry.id)) fail(`Cannot deactivate referenced ${entry.collection}/${entry.id}. Retain it or resolve its references separately.`);
  }
  // Validate the entire proposed state before creating any write operations.
  await validateProposedState(state, Category, EventType);
  return { changes, stale, unresolved, state };
}

async function loadSnapshot(db, session) {
  // MongoDB does not support concurrent operations within a transaction.
  const options = session ? { session } : {};
  const categories = await db.collection("categories").find({}, options).toArray();
  const events = await db.collection("eventtypes").find({}, options).toArray();
  const vendors = await db.collection("vendors").find({}, { ...options, projection: { categoryIds: 1, selectedCategories: 1, eventTypeIds: 1 } }).toArray();
  return { categories, events, vendors };
}

async function inspectIndexes(db) {
  const problems = [];
  for (const [collection, keys] of [["categories", { parentId: 1, slug: 1 }], ["eventtypes", { slug: 1 }]]) {
    let indexes;
    try {
      indexes = await db.collection(collection).listIndexes().toArray();
    } catch (error) {
      if (error.code !== 26) throw error;
      indexes = [];
    }
    const ready = indexes.some((index) => index.unique === true && !index.partialFilterExpression && !index.sparse && !index.buildUUID && equivalent(index.key, keys) && (!index.collation || index.collation.locale === "simple"));
    if (!ready) problems.push(`${collection} requires a ready, full unique index on ${JSON.stringify(keys)}.`);
  }
  return problems;
}

async function requireTransactions(db) {
  const hello = await db.admin().command({ hello: 1 });
  if (!hello.logicalSessionTimeoutMinutes || !(hello.setName || hello.msg === "isdbgrid") || hello.maxWireVersion < (hello.msg === "isdbgrid" ? 8 : 7)) {
    fail("Apply requires a replica set or sharded MongoDB deployment supporting transactions. No fallback writes are allowed.");
  }
}

function digest(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function durableWrite(filename, value, flag = "wx") {
  const handle = await fs.open(filename, flag, 0o600);
  try {
    await handle.writeFile(value, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function createRecovery(dbName, snapshot, plan, recoveryRoot) {
  const directory = path.join(recoveryRoot, `${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID()}`);
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  const backupPath = path.join(directory, "backup.ejson");
  const backup = EJSON.stringify({ version: 1, database: dbName, createdAt: new Date(), categories: snapshot.categories, eventtypes: snapshot.events }, { relaxed: false });
  const backupSha256 = digest(backup);
  await durableWrite(backupPath, backup);
  const persisted = await fs.readFile(backupPath, "utf8");
  if (digest(persisted) !== backupSha256 || !equivalent(EJSON.parse(persisted, { relaxed: false }), EJSON.parse(backup, { relaxed: false }))) fail("Backup verification failed. No database writes were attempted.");
  const journalPath = path.join(directory, "journal.jsonl");
  const append = (entry) => durableWrite(journalPath, JSON.stringify({ at: new Date().toISOString(), ...entry }) + "\n", "a");
  await append({ status: "prepared", database: dbName, backup: "backup.ejson", backupSha256, changes: plan.changes.map(({ collection, action, id: documentId, slug, fields }) => ({ collection, action, id: documentId, slug, fields })) });
  await durableWrite(path.join(directory, "plan.ejson"), EJSON.stringify({ changes: plan.changes, stale: plan.stale }, { relaxed: false }));
  return { directory, backupSha256, append };
}

function comparisonReport(dbName, plan, indexProblems, prerequisiteProblems) {
  return {
    database: dbName,
    readyToApply: !plan.unresolved.length && !indexProblems.length && !prerequisiteProblems.length,
    indexProblems,
    prerequisiteProblems,
    counts: { inserts: plan.changes.filter((entry) => entry.action === "insert").length, updates: plan.changes.filter((entry) => entry.action === "update").length, unchanged: plan.state.categories.length + plan.state.events.length - plan.changes.length },
    changes: plan.changes.map(({ collection, action, id: documentId, slug, fields, before, after }) => ({
      collection, action, id: documentId, slug,
      fields: fields.map((field) => ({ field, before: before?.[field] ?? null, after: after[field] })),
      ...(collection === "events" ? { preservedMappingIds: before?.vendorCategoryIds || [], addedMappingIds: after.vendorCategoryIds.filter((categoryId) => !(before?.vendorCategoryIds || []).some((existingId) => id(existingId) === id(categoryId))) } : {}),
    })),
    stale: plan.stale,
    unresolved: plan.unresolved,
  };
}

async function writePlan(db, session, plan, recovery) {
  for (const [collection, actualName] of [["categories", "categories"], ["events", "eventtypes"]]) {
    const entries = plan.changes.filter((entry) => entry.collection === collection);
    if (!entries.length) continue;
    await recovery.append({ status: "writing", collection: actualName, count: entries.length });
    const operations = entries.map((entry) => {
      const now = new Date();
      if (entry.action === "insert") return { insertOne: { document: { ...entry.after, createdAt: now, updatedAt: now } } };
      const values = Object.fromEntries(entry.fields.map((field) => [field, entry.after[field]]));
      return { updateOne: { filter: { _id: entry.after._id }, update: { $set: { ...values, updatedAt: now } } } };
    });
    const result = await db.collection(actualName).bulkWrite(operations, { session, ordered: true });
    if (result.insertedCount + result.matchedCount !== entries.length) fail("Write counts did not match the prepared plan.");
  }
}

async function verifyFinalState(db, session, plan, Category, EventType) {
  const actual = await loadSnapshot(db, session);
  for (const collection of ["categories", "events"]) {
    const actualById = new Map(actual[collection].map((document) => [id(document._id), document]));
    if (actualById.size !== plan.state[collection].length) fail("Final reference-data record count differs from the proposed state.");
    for (const expected of plan.state[collection]) {
      const document = actualById.get(id(expected._id));
      for (const key of Object.keys(expected).filter((field) => !["createdAt", "updatedAt"].includes(field))) {
        if (!document || !equivalent(document[key], expected[key])) fail("Final reference-data verification failed.");
      }
    }
  }
  await validateProposedState(actual, Category, EventType);
}

async function runSeed({ options, mongoose: connection, Category, EventType, categoryData, eventData, slugify, env, log = console.log, recoveryRoot = path.join(__dirname, "..", ".seed-recovery") }) {
  if (!["compare", "apply"].includes(options.mode) || Boolean(options.confirmDev) !== (options.mode === "apply")) fail(USAGE);
  const uri = (env.MONGODB_URI || "").trim();
  if (!uri || uri === "replace_with_your_mongodb_connection_string") fail("Set MONGODB_URI before comparing or applying reference data.");
  if (options.mode === "apply") verifyDevelopmentTarget(databaseFromUri(uri), env);
  let reconciliation = {};
  if (options.reconcileFile) {
    try {
      reconciliation = validateReconciliation(JSON.parse(await fs.readFile(options.reconcileFile, "utf8")));
    } catch (error) {
      if (error.seedMessage) throw error;
      fail("Cannot read reconciliation JSON file.");
    }
  }
  let session;
  let recovery;
  let commitAttempted = false;
  let committed = false;
  try {
    configureMongoDns(env.MONGODB_DNS_SERVERS);
    await connection.connect(uri, { autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 10000 });
    const db = connection.connection.db;
    const dbName = db.databaseName;
    const prerequisiteProblems = [];
    if (options.mode === "apply") {
      verifyDevelopmentTarget(dbName, env);
      await requireTransactions(db);
    } else {
      // Compare remains read-only on any target, but never labels an unsafe
      // environment or standalone database as ready to apply.
      try {
        verifyDevelopmentTarget(databaseFromUri(uri), env);
        verifyDevelopmentTarget(dbName, env);
      } catch (error) {
        if (!error.seedMessage) throw error;
        prerequisiteProblems.push(error.seedMessage);
      }
      try {
        await requireTransactions(db);
      } catch (error) {
        if (!error.seedMessage) throw error;
        prerequisiteProblems.push(error.seedMessage);
      }
    }
    const indexProblems = await inspectIndexes(db);
    if (options.mode === "apply" && indexProblems.length) fail(indexProblems.join(" "));
    if (options.mode === "apply") {
      session = await connection.startSession();
      session.startTransaction({ readConcern: { level: "snapshot" }, writeConcern: { w: "majority" }, readPreference: "primary" });
    }
    const snapshot = await loadSnapshot(db, session);
    const plan = await buildPlan({ snapshot, categoryData, eventData, slugify, Category, EventType, reconciliation });
    const report = comparisonReport(dbName, plan, indexProblems, prerequisiteProblems);
    log(JSON.stringify(report, null, 2));
    if (options.mode === "compare") return report;
    if (plan.unresolved.length) fail("Active records outside the seed require explicit rename, retain, or deactivate decisions in --reconcile <file>. Review --compare first.");
    recovery = await createRecovery(dbName, snapshot, plan, recoveryRoot);
    log(`Verified backup and journal: ${recovery.directory}`);
    await writePlan(db, session, plan, recovery);
    await verifyFinalState(db, session, plan, Category, EventType);
    await recovery.append({ status: "verified-before-commit" });
    // Do not retry the whole transaction: its backup and plan belong to this snapshot.
    commitAttempted = true;
    await session.commitTransaction();
    committed = true;
    await recovery.append({ status: "committed" });
    await verifyFinalState(db, undefined, plan, Category, EventType);
    await recovery.append({ status: "verified-after-commit" });
    await durableWrite(path.join(recovery.directory, "report.json"), JSON.stringify({ ...report, status: "committed-and-verified", backupSha256: recovery.backupSha256 }, null, 2));
    log("Reference data committed and verified successfully.");
    return report;
  } catch (error) {
    if (error.name === "ValidationError" && !error.seedMessage) {
      error.seedMessage = `Proposed reference data failed schema validation for fields: ${Object.keys(error.errors).join(", ")}.`;
    }
    let status = committed ? "committed-followup-failed" : commitAttempted ? "commit-outcome-unknown" : "failed-before-writes";
    if (session?.inTransaction()) {
      try {
        await session.abortTransaction();
        if (!commitAttempted) status = "aborted";
      } catch {
        if (!commitAttempted) status = "abort-unconfirmed";
      }
    }
    if (recovery) {
      const failureReport = { status, reason: error.seedMessage || "Database or local recovery-file operation failed.", recoveryDirectory: recovery.directory };
      try {
        await recovery.append(failureReport);
        await durableWrite(path.join(recovery.directory, "failure.json"), JSON.stringify(failureReport, null, 2));
      } catch {
        log("Could not update recovery files; inspect the existing backup and journal.");
      }
      log(`Execution status: ${status}. Recovery files: ${recovery.directory}`);
    }
    throw error;
  } finally {
    try {
      if (session) await session.endSession();
    } finally {
      await connection.disconnect();
    }
  }
}

module.exports = {
  parseArguments,
  verifyDevelopmentTarget,
  databaseFromUri,
  validateReconciliation,
  buildPlan,
  validateProposedState,
  inspectIndexes,
  requireTransactions,
  createRecovery,
  runSeed,
};
