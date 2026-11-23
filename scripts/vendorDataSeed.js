const path = require("node:path");
const mongoose = require("mongoose");
const configureMongoDns = require("../config/mongoDns");
const {
  verifyDevelopmentTarget,
  databaseFromUri,
  equivalent,
  durableWrite,
  inspectIndexes: inspectReferenceIndexes,
  requireTransactions,
  createRecovery,
} = require("./referenceDataSeed");

const DEFAULT_COUNT = 10;
const DEFAULT_SEED = 42;
const USAGE =
  "Use exactly one of --dry-run, --compare, or --apply --confirm-dev. Optional --count <1-1000> and --seed <0-4294967295>.";
const USER_IDENTITIES = ["_id", "firebaseUid", "phoneNumber"];
const VENDOR_IDENTITIES = ["_id", "userId", "publicVendorId"];
const METADATA_FIELDS = ["_id", "__v", "createdAt", "updatedAt"];

function fail(message) {
  const error = new Error(message);
  error.seedMessage = message;
  throw error;
}

function formatSeedError(error, stage = "starting the seed") {
  if (error.seedMessage) return error.seedMessage;
  const causes = [error, error.cause, error.reason, error.reason?.error];
  const codes = new Set(causes.filter(Boolean).map((cause) => cause.code));
  let detail;
  if (stage === "configuring MongoDB DNS") {
    detail = "MONGODB_DNS_SERVERS must be a comma-separated list of DNS server IP addresses.";
  } else if (codes.has(18)) {
    detail = "MongoDB authentication failed. Check the database credentials and authentication database in MONGODB_URI.";
  } else if (codes.has(13)) {
    detail = "MongoDB denied this operation. Check the database user's read, index-listing, and write permissions.";
  } else if (codes.has(11000)) {
    detail = "MongoDB rejected a duplicate unique key. Run --compare and review the conflicting seed identity.";
  } else if (["ENOTFOUND", "EAI_AGAIN", "ENODATA", "ESERVFAIL", "EREFUSED"].some((code) => codes.has(code))) {
    detail = "MongoDB DNS lookup failed. Check MONGODB_DNS_SERVERS and the MongoDB hostname in MONGODB_URI.";
  } else if (codes.has("ECONNREFUSED")) {
    detail = "MongoDB refused the connection. Check that the server is running and reachable.";
  } else if (
    ["ETIMEDOUT", "ETIMEOUT", "ECONNRESET"].some((code) => codes.has(code)) ||
    ["MongoServerSelectionError", "MongooseServerSelectionError", "MongoNetworkError", "MongoNetworkTimeoutError"].includes(error.name)
  ) {
    detail = "Could not reach MongoDB. Check server availability, Atlas network access, and the firewall or VPN.";
  } else if (["ENOSPC", "EACCES", "EPERM", "ENOENT", "ENOTDIR"].some((code) => codes.has(code))) {
    detail = "A local file operation failed. Check the seed recovery directory, disk space, and filesystem permissions.";
  } else if (error.name === "TypeError" || error.name === "ReferenceError") {
    detail = "The seed scripts have an implementation or helper mismatch. Check that the reference and vendor seed files are compatible.";
  } else {
    detail = "A database or local operation failed. Review the execution journal if one was created.";
  }
  // Never print raw driver messages, causes, or stacks; they can contain the URI.
  return "Failed while " + stage + ". " + detail;
}

function parseArguments(argv) {
  const flags = new Set();
  let count = DEFAULT_COUNT;
  let seed = DEFAULT_SEED;
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flags.has(flag)) fail(USAGE);
    flags.add(flag);
    if (flag === "--count" || flag === "--seed") {
      const value = argv[++index];
      if (!value || !/^\d+$/.test(value)) fail(USAGE);
      const number = Number(value);
      if (flag === "--count") {
        if (!Number.isInteger(number) || number < 1 || number > 1000)
          fail(USAGE);
        count = number;
      } else {
        if (!Number.isInteger(number) || number < 0 || number > 4294967295)
          fail(USAGE);
        seed = number;
      }
    } else if (
      !["--dry-run", "--compare", "--apply", "--confirm-dev"].includes(flag)
    ) {
      fail(USAGE);
    }
  }
  const modes = ["dry-run", "compare", "apply"].filter((mode) =>
    flags.has("--" + mode),
  );
  if (modes.length !== 1) fail(USAGE);
  const mode = modes[0];
  const confirmDev = flags.has("--confirm-dev");
  if (confirmDev !== (mode === "apply")) fail(USAGE);
  return { mode, confirmDev, count, seed };
}

function id(value) {
  if (!value || !mongoose.isObjectIdOrHexString(value)) {
    fail("Vendor test data contains an invalid ObjectId.");
  }
  return value.toString();
}

function uniqueMap(documents, key, label, optional = false) {
  const result = new Map();
  for (const document of documents) {
    const value = key(document);
    // Legacy records without a newer identity field are unrelated to this seed.
    if (optional && value == null) continue;
    if (result.has(value))
      fail("Existing duplicate " + label + "; resolve it before seeding.");
    result.set(value, document);
  }
  return result;
}

function identityMaps(documents, fields, collection) {
  return Object.fromEntries(
    fields.map((field) => [
      field,
      uniqueMap(
        documents,
        (document) => {
          if (field === "_id") return id(document._id);
          if (document[field] == null) return null;
          return field === "userId" ? id(document[field]) : document[field];
        },
        collection + "." + field,
        field !== "_id",
      ),
    ]),
  );
}

function referenceMaps(snapshot) {
  const categoriesById = uniqueMap(
    snapshot.categories,
    (document) => id(document._id),
    "category ID",
  );
  const categoriesByKey = uniqueMap(
    snapshot.categories,
    (document) => {
      if (typeof document.slug !== "string" || !document.slug.trim())
        fail("Existing category has an invalid slug.");
      return (
        (document.parentId == null ? "main" : id(document.parentId)) +
        "/" +
        document.slug
      );
    },
    "category identity",
  );
  const eventsById = uniqueMap(
    snapshot.events,
    (document) => id(document._id),
    "EventType ID",
  );
  const eventsBySlug = uniqueMap(
    snapshot.events,
    (document) => {
      if (typeof document.slug !== "string" || !document.slug.trim())
        fail("Existing EventType has an invalid slug.");
      return document.slug;
    },
    "EventType slug",
  );
  return { categoriesById, categoriesByKey, eventsById, eventsBySlug };
}

function operational(vendor) {
  return (
    vendor.approvalStatus === "approved" &&
    vendor.isActive === true &&
    vendor.deletedAt == null
  );
}

function requireActive(document, label) {
  // Category/EventType schemas default to active for legacy records.
  if (document.isActive === false)
    fail("Vendor seed requires an active " + label + ".");
}

function resolveVendor(entry, references) {
  const selectedCategories = entry.categorySelections.map((selection) => {
    const category = references.categoriesByKey.get(
      "main/" + selection.categorySlug,
    );
    if (!category)
      fail(
        "Missing main category " +
          selection.categorySlug +
          ". Apply the reference-data seed first.",
      );
    requireActive(category, "category " + selection.categorySlug);
    const serviceIds = selection.serviceSlugs.map((slug) => {
      const service = references.categoriesByKey.get(
        id(category._id) + "/" + slug,
      );
      if (!service)
        fail(
          "Missing service " +
            selection.categorySlug +
            "/" +
            slug +
            ". Apply the reference-data seed first.",
        );
      requireActive(service, "service " + selection.categorySlug + "/" + slug);
      return service._id;
    });
    return { categoryId: category._id, serviceIds };
  });
  const eventTypeIds = entry.eventTypeSlugs.map((slug) => {
    const event = references.eventsBySlug.get(slug);
    if (!event)
      fail(
        "Missing EventType " + slug + ". Apply the reference-data seed first.",
      );
    requireActive(event, "EventType " + slug);
    return event._id;
  });
  return {
    ...entry.vendor,
    categoryIds: selectedCategories.map((selection) => selection.categoryId),
    selectedCategories,
    eventTypeIds,
  };
}

function matchExisting(maps, fields, expected, collection) {
  const documentId = id(expected._id);
  const existing = maps._id.get(documentId);
  for (const field of fields) {
    const value =
      field === "_id" || field === "userId"
        ? id(expected[field])
        : expected[field];
    const occupied = maps[field].get(value);
    if (occupied && id(occupied._id) !== documentId) {
      fail(
        "Seed identity collision in " +
          collection +
          "." +
          field +
          "; existing records are preserved.",
      );
    }
    if (existing && !equivalent(existing[field], expected[field])) {
      fail(
        "Existing " +
          collection +
          "/" +
          documentId +
          " does not match this seed identity.",
      );
    }
  }
  return existing;
}

async function validateTargets(targets, snapshot, User, Vendor) {
  const references = referenceMaps(snapshot);
  const users = new Map(
    snapshot.users.map((document) => [id(document._id), document]),
  );
  for (const user of targets.users) {
    await new User(user).validate();
    if (user.role !== "vendor")
      fail("A seeded vendor must belong to a vendor User.");
    users.set(id(user._id), user);
  }
  for (const vendor of targets.vendors) {
    await new Vendor(vendor).validate();
    const user = users.get(id(vendor.userId));
    if (!user || user.role !== "vendor")
      fail("Seeded vendor has a missing or non-vendor User.");
    if (vendor.reviewedBy != null && !users.has(id(vendor.reviewedBy))) {
      fail("Seeded vendor references a missing reviewer User.");
    }
    const categoryIds = vendor.categoryIds.map(id);
    for (const categoryId of categoryIds) {
      const category = references.categoriesById.get(categoryId);
      if (!category || category.parentId != null)
        fail("Seeded vendor references a missing or non-main category.");
      if (operational(vendor)) requireActive(category, "vendor category");
    }
    for (const selection of vendor.selectedCategories || []) {
      for (const serviceId of selection.serviceIds || []) {
        const service = references.categoriesById.get(id(serviceId));
        if (
          !service ||
          service.parentId == null ||
          id(service.parentId) !== id(selection.categoryId)
        ) {
          fail(
            "Seeded vendor references a missing service or a service under the wrong parent.",
          );
        }
        if (operational(vendor)) requireActive(service, "vendor service");
      }
    }
    const mappedCategories = new Set();
    for (const eventId of vendor.eventTypeIds) {
      const event = references.eventsById.get(id(eventId));
      if (!event) fail("Seeded vendor references a missing EventType.");
      if (operational(vendor)) requireActive(event, "vendor EventType");
      const mappedIds = (event.vendorCategoryIds || []).map(id);
      if (!categoryIds.some((categoryId) => mappedIds.includes(categoryId))) {
        fail("Seeded vendor EventType does not map to its categories.");
      }
      for (const categoryId of categoryIds) {
        if (mappedIds.includes(categoryId)) mappedCategories.add(categoryId);
      }
    }
    if (categoryIds.some((categoryId) => !mappedCategories.has(categoryId))) {
      fail("Seeded vendor category has no selected EventType mapping.");
    }
  }
}

async function buildPlan({ snapshot, vendorData, User, Vendor }) {
  const references = referenceMaps(snapshot);
  const maps = {
    users: identityMaps(snapshot.users, USER_IDENTITIES, "users"),
    vendors: identityMaps(snapshot.vendors, VENDOR_IDENTITIES, "vendors"),
  };
  const changes = [];
  const existing = [];
  const targets = { users: [], vendors: [] };
  const seen = { keys: new Set(), users: new Set(), vendors: new Set() };
  for (const entry of vendorData) {
    if (
      seen.keys.has(entry.key) ||
      seen.users.has(id(entry.user._id)) ||
      seen.vendors.has(id(entry.vendor._id))
    ) {
      fail("Generated fixtures contain duplicate seed identities.");
    }
    seen.keys.add(entry.key);
    seen.users.add(id(entry.user._id));
    seen.vendors.add(id(entry.vendor._id));
    if (id(entry.vendor.userId) !== id(entry.user._id)) {
      fail("Each vendor seed fixture must link to its own generated User.");
    }
    const userModel = new User(entry.user);
    const vendorModel = new Vendor(resolveVendor(entry, references));
    await userModel.validate();
    await vendorModel.validate();
    const proposed = {
      users: userModel.toObject(),
      vendors: vendorModel.toObject(),
    };
    for (const [collection, fields] of [
      ["users", USER_IDENTITIES],
      ["vendors", VENDOR_IDENTITIES],
    ]) {
      const expected = proposed[collection];
      const before = matchExisting(
        maps[collection],
        fields,
        expected,
        collection,
      );
      if (before) {
        existing.push({
          collection,
          id: id(before._id),
          identity: entry.key,
          differences: Object.keys(expected)
            .filter(
              (field) =>
                !METADATA_FIELDS.includes(field) &&
                !equivalent(before[field], expected[field]),
            )
            .map((field) => ({
              field,
              actual: before[field] ?? null,
              generated: expected[field],
            })),
        });
        targets[collection].push(before);
      } else {
        changes.push({
          collection,
          action: "insert",
          id: id(expected._id),
          identity: entry.key,
          fields: Object.keys(expected).filter(
            (field) => !METADATA_FIELDS.includes(field),
          ),
          before: null,
          after: expected,
        });
        targets[collection].push(expected);
        for (const field of fields) {
          const value =
            field === "_id" || field === "userId"
              ? id(expected[field])
              : expected[field];
          maps[collection][field].set(value, expected);
        }
      }
    }
  }
  await validateTargets(targets, snapshot, User, Vendor);
  return { changes, existing, targets };
}

async function loadSnapshot(db, session) {
  // Operations in a transaction must be sequential.
  const options = session ? { session } : {};
  const categories = await db
    .collection("categories")
    .find({}, options)
    .toArray();
  const events = await db.collection("eventtypes").find({}, options).toArray();
  const users = await db.collection("users").find({}, options).toArray();
  const vendors = await db.collection("vendors").find({}, options).toArray();
  return { categories, events, users, vendors };
}

async function inspectIndexes(db) {
  const problems = await inspectReferenceIndexes(db);
  for (const [collection, required] of [
    ["users", [{ firebaseUid: 1 }, { phoneNumber: 1 }]],
    ["vendors", [{ userId: 1 }, { publicVendorId: 1 }]],
  ]) {
    let indexes;
    try {
      indexes = await db.collection(collection).listIndexes().toArray();
    } catch (error) {
      if (error.code !== 26) throw error;
      indexes = [];
    }
    for (const keys of required) {
      if (
        !indexes.some(
          (index) =>
            index.unique === true &&
            !index.partialFilterExpression &&
            !index.sparse &&
            !index.buildUUID &&
            equivalent(index.key, keys) &&
            (!index.collation || index.collation.locale === "simple"),
        )
      ) {
        problems.push(
          collection +
            " requires a ready, full unique index on " +
            JSON.stringify(keys) +
            ".",
        );
      }
    }
  }
  return problems;
}

function comparisonReport(
  database,
  options,
  plan,
  indexProblems,
  prerequisiteProblems,
) {
  const inserts = plan.changes.length;
  return {
    database,
    seed: options.seed,
    vendorCount: plan.targets.vendors.length,
    activeVendorCount: plan.targets.vendors.filter(operational).length,
    readyToApply: !indexProblems.length && !prerequisiteProblems.length,
    indexProblems,
    prerequisiteProblems,
    counts: { inserts, updates: 0, unchanged: plan.existing.length },
    collectionCounts: Object.fromEntries(
      ["users", "vendors"].map((collection) => [
        collection,
        {
          inserts: plan.changes.filter(
            (entry) => entry.collection === collection,
          ).length,
          updates: 0,
          unchanged: plan.existing.filter(
            (entry) => entry.collection === collection,
          ).length,
        },
      ]),
    ),
    changes: plan.changes.map((entry) => ({
      collection: entry.collection,
      action: entry.action,
      id: entry.id,
      identity: entry.identity,
      fields: entry.fields.map((field) => ({
        field,
        before: null,
        after: entry.after[field],
      })),
    })),
    existing: plan.existing,
  };
}

async function writePlan(db, session, plan, recovery) {
  const now = new Date();
  for (const collection of ["users", "vendors"]) {
    const entries = plan.changes.filter(
      (entry) => entry.collection === collection,
    );
    if (!entries.length) continue;
    await recovery.append({
      status: "writing",
      collection,
      count: entries.length,
    });
    // Insert only: never promote, overwrite, or adopt an existing account/profile.
    const operations = entries.map((entry) => ({
      insertOne: {
        document: { ...entry.after, createdAt: now, updatedAt: now },
      },
    }));
    const result = await db
      .collection(collection)
      .bulkWrite(operations, { session, ordered: true });
    if (result.insertedCount !== entries.length)
      fail("Write counts did not match the prepared vendor seed plan.");
  }
}

async function verifyFinalState(db, session, plan, User, Vendor) {
  const actual = await loadSnapshot(db, session);
  const targets = { users: [], vendors: [] };
  for (const collection of ["users", "vendors"]) {
    const actualById = uniqueMap(
      actual[collection],
      (document) => id(document._id),
      collection + " ID",
    );
    const insertedIds = new Set(
      plan.changes
        .filter((entry) => entry.collection === collection)
        .map((entry) => entry.id),
    );
    for (const expected of plan.targets[collection]) {
      const document = actualById.get(id(expected._id));
      if (!document)
        fail(
          "Final vendor test-data verification failed: a planned record is missing.",
        );
      const fields = new Set([
        ...Object.keys(expected),
        ...Object.keys(document),
      ]);
      for (const field of fields) {
        if (
          insertedIds.has(id(expected._id)) &&
          ["createdAt", "updatedAt"].includes(field)
        )
          continue;
        if (!equivalent(document[field], expected[field]))
          fail("Final vendor test-data verification failed.");
      }
      if (
        insertedIds.has(id(expected._id)) &&
        (!(document.createdAt instanceof Date) ||
          !(document.updatedAt instanceof Date) ||
          !Number.isFinite(document.createdAt.getTime()) ||
          !Number.isFinite(document.updatedAt.getTime()))
      ) {
        fail("Final vendor seed timestamps are missing or invalid.");
      }
      targets[collection].push(document);
    }
  }
  await validateTargets(targets, actual, User, Vendor);
}

async function runSeed({
  options,
  mongoose: connection,
  User,
  Vendor,
  vendorData,
  env,
  log = console.log,
  recoveryRoot = path.join(__dirname, "..", ".seed-recovery", "vendors"),
}) {
  if (
    !["compare", "apply"].includes(options.mode) ||
    Boolean(options.confirmDev) !== (options.mode === "apply")
  )
    fail(USAGE);
  for (const [name, helper] of [
    ["equivalent", equivalent],
    ["durableWrite", durableWrite],
    ["createRecovery", createRecovery],
  ]) {
    if (typeof helper !== "function") {
      fail(
        "Missing seed helper " + name +
        " in scripts/referenceDataSeed.js. Keep the reference and vendor seed scripts in sync.",
      );
    }
  }
  const uri = (env.MONGODB_URI || "").trim();
  if (!uri || uri === "replace_with_your_mongodb_connection_string") {
    fail("Set MONGODB_URI before comparing or applying vendor test data.");
  }
  if (options.mode === "apply")
    verifyDevelopmentTarget(databaseFromUri(uri), env);
  let session;
  let recovery;
  let commitAttempted = false;
  let committed = false;
  let stage = "configuring MongoDB DNS";
  try {
    configureMongoDns(env.MONGODB_DNS_SERVERS);
    stage = "connecting to MongoDB";
    await connection.connect(uri, {
      autoIndex: false,
      autoCreate: false,
      serverSelectionTimeoutMS: 10000,
    });
    const db = connection.connection.db;
    const dbName = db.databaseName;
    const prerequisiteProblems = [];
    stage = "checking the database target and transaction support";
    if (options.mode === "apply") {
      verifyDevelopmentTarget(dbName, env);
      await requireTransactions(db);
    } else {
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
    stage = "checking unique indexes";
    const indexProblems = await inspectIndexes(db);
    if (options.mode === "apply" && indexProblems.length)
      fail(indexProblems.join(" "));
    if (options.mode === "apply") {
      stage = "starting the seed transaction";
      session = await connection.startSession();
      session.startTransaction({
        readConcern: { level: "snapshot" },
        writeConcern: { w: "majority" },
        readPreference: "primary",
      });
    }
    stage = "reading existing seed and reference data";
    const snapshot = await loadSnapshot(db, session);
    stage = "comparing generated seed records";
    const plan = await buildPlan({ snapshot, vendorData, User, Vendor });
    const report = comparisonReport(
      dbName,
      options,
      plan,
      indexProblems,
      prerequisiteProblems,
    );
    log(JSON.stringify(report, null, 2));
    if (options.mode === "compare") return report;
    if (!plan.changes.length) {
      await session.abortTransaction();
      log(
        "Requested vendor seed records already exist. No database writes were needed.",
      );
      return report;
    }
    stage = "preparing and verifying the seed backup";
    recovery = await createRecovery(dbName, snapshot, plan, recoveryRoot, {
      users: "users",
      vendors: "vendors",
    });
    log("Verified backup and journal: " + recovery.directory);
    stage = "inserting test Users and Vendors";
    await writePlan(db, session, plan, recovery);
    stage = "verifying inserted records before commit";
    await verifyFinalState(db, session, plan, User, Vendor);
    await recovery.append({ status: "verified-before-commit" });
    // A lost acknowledgement must not trigger a retry of this transaction.
    stage = "committing the seed transaction";
    commitAttempted = true;
    await session.commitTransaction();
    committed = true;
    await recovery.append({ status: "committed" });
    stage = "verifying inserted records after commit";
    await verifyFinalState(db, undefined, plan, User, Vendor);
    await recovery.append({ status: "verified-after-commit" });
    stage = "saving the seed execution report";
    await durableWrite(
      path.join(recovery.directory, "report.json"),
      JSON.stringify(
        {
          ...report,
          status: "committed-and-verified",
          backupSha256: recovery.backupSha256,
        },
        null,
        2,
      ),
    );
    log("Vendor test data committed and verified successfully.");
    return report;
  } catch (error) {
    if (error.name === "ValidationError" && !error.seedMessage) {
      error.seedMessage =
        "Proposed vendor test data failed schema validation for fields: " +
        Object.keys(error.errors).join(", ") +
        ".";
    }
    error.seedMessage = formatSeedError(error, stage);
    let status = committed
      ? "committed-followup-failed"
      : commitAttempted
        ? "commit-outcome-unknown"
        : "failed-before-writes";
    if (session?.inTransaction()) {
      try {
        await session.abortTransaction();
        if (!commitAttempted) status = "aborted";
      } catch {
        if (!commitAttempted) status = "abort-unconfirmed";
      }
    }
    if (recovery) {
      const failureReport = {
        status,
        reason:
          error.seedMessage ||
          "Database or local recovery-file operation failed.",
        recoveryDirectory: recovery.directory,
      };
      try {
        await recovery.append(failureReport);
        await durableWrite(
          path.join(recovery.directory, "failure.json"),
          JSON.stringify(failureReport, null, 2),
        );
      } catch {
        log(
          "Could not update recovery files; inspect the existing backup and journal.",
        );
      }
      log(
        "Execution status: " +
          status +
          ". Recovery files: " +
          recovery.directory,
      );
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
  DEFAULT_COUNT,
  DEFAULT_SEED,
  parseArguments,
  formatSeedError,
  buildPlan,
  validateTargets,
  inspectIndexes,
  runSeed,
};
