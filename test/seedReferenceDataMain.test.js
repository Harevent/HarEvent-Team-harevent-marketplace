const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const {
  CATEGORY_DATA,
  EVENT_TYPE_DATA,
  main,
} = require("../scripts/seedReferenceData");

test("seed category and service names exactly match the documented taxonomy", async () => {
  const markdown = await fs.readFile(
    path.join(__dirname, "..", "docs", "referenceDataMappings.md"),
    "utf8",
  );
  const taxonomySection = markdown
    .split("## Complete Vendor Taxonomy")[1]
    ?.split("## Event Type Mappings")[0];
  assert.ok(
    taxonomySection,
    "The mapping document must contain the complete taxonomy section",
  );

  const documentedCategories = [
    ...taxonomySection.matchAll(
      /^\|\s*([^|]+?)\s*\|\s*(\d+)\s*\|\s*(.*?)\s*\|\s*$/gm,
    ),
  ].map((match) => ({
    name: match[1],
    count: Number(match[2]),
    services: match[3].split(";").map((name) => name.trim()),
  }));

  assert.equal(documentedCategories.length, 19);
  assert.deepEqual(
    CATEGORY_DATA.map(({ name }) => name),
    documentedCategories.map(({ name }) => name),
  );
  for (const [index, expected] of documentedCategories.entries()) {
    assert.equal(
      expected.services.length,
      expected.count,
      `${expected.name}: documented child count`,
    );
    assert.deepEqual(
      CATEGORY_DATA[index].services,
      expected.services,
      `${expected.name}: spelling, spacing and order`,
    );
  }
});

async function assertMainCompare(t, runMain) {
  // Stub only database access and local environment loading; main/runSeed remain real.
  const originalDb = mongoose.connection.db;
  const environment = {
    MONGODB_URI: "mongodb://localhost/harevent_dev",
    NODE_ENV: "development",
    SEED_DEV_DATABASE: "harevent_dev",
    MONGODB_DNS_SERVERS: undefined,
  };
  const originalEnvironment = new Map(
    Object.keys(environment).map((key) => [key, process.env[key]]),
  );
  t.after(() => {
    mongoose.connection.db = originalDb;
    for (const [key, value] of originalEnvironment) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  for (const [key, value] of Object.entries(environment)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  t.mock.method(dotenv, "config", () => ({ parsed: {} }));
  const log = t.mock.method(console, "log", () => {});
  const reads = [];
  const write = t.mock.fn(() => {
    throw new Error("Compare must never write database records");
  });
  const db = {
    databaseName: "harevent_dev",
    admin: () => ({
      command: async () => ({
        setName: "rs0",
        logicalSessionTimeoutMinutes: 30,
        maxWireVersion: 25,
      }),
    }),
    collection(name) {
      assert.ok(["categories", "eventtypes", "vendors"].includes(name));
      return {
        listIndexes: () => ({
          toArray: async () => [
            {
              unique: true,
              key:
                name === "categories" ? { parentId: 1, slug: 1 } : { slug: 1 },
            },
          ],
        }),
        find: () => {
          reads.push(name);
          return { toArray: async () => [] };
        },
        bulkWrite: write,
      };
    },
  };
  const connect = t.mock.method(mongoose, "connect", async () => {
    mongoose.connection.db = db;
  });
  const disconnect = t.mock.method(mongoose, "disconnect", async () => {});
  const startSession = t.mock.method(mongoose, "startSession", () => {
    throw new Error("Compare must never start a write transaction");
  });

  const report = await runMain();

  assert.equal(report.readyToApply, true);
  assert.deepEqual(report.counts, { inserts: 336, updates: 0, unchanged: 0 });
  const proposed = report.changes.map((change) => ({
    ...change,
    fields: Object.fromEntries(
      change.fields.map(({ field, after }) => [field, after]),
    ),
  }));
  const mainCategories = proposed.filter(
    (change) =>
      change.collection === "categories" && change.fields.parentId == null,
  );
  assert.deepEqual(
    mainCategories.map((change) => change.fields.name),
    CATEGORY_DATA.map(({ name }) => name),
  );
  for (const category of mainCategories) {
    const services = proposed.filter(
      (change) =>
        change.collection === "categories" &&
        String(change.fields.parentId) === category.id,
    );
    const expected = CATEGORY_DATA.find(
      ({ name }) => name === category.fields.name,
    );
    assert.deepEqual(
      services.map((change) => change.fields.name),
      expected.services,
      category.fields.name,
    );
  }
  const events = proposed.filter((change) => change.collection === "events");
  assert.deepEqual(
    events.map((change) => change.fields.name),
    EVENT_TYPE_DATA.map(({ name }) => name),
  );
  assert.equal(events.filter((change) => change.fields.isActive).length, 10);
  assert.equal(events.filter((change) => !change.fields.isActive).length, 19);
  assert.deepEqual(reads, ["categories", "eventtypes", "vendors"]);
  assert.deepEqual(
    connect.mock.calls.map(({ arguments: args }) => args),
    [
      [
        environment.MONGODB_URI,
        {
          autoIndex: false,
          autoCreate: false,
          serverSelectionTimeoutMS: 10000,
        },
      ],
    ],
  );
  assert.equal(disconnect.mock.calls.length, 1);
  assert.equal(startSession.mock.calls.length, 0);
  assert.equal(write.mock.calls.length, 0);
  const loggedReport = JSON.parse(log.mock.calls.at(-1).arguments[0]);
  assert.deepEqual(loggedReport.counts, report.counts);
}

test("main --compare passes the full taxonomy to the real seed planner without writes", async (t) => {
  await assertMainCompare(t, () => main(["--compare"]));
});

test("main() reads --compare from process.argv and passes CATEGORY_DATA to the real seed planner", async (t) => {
  const originalArgv = process.argv;
  t.after(() => {
    process.argv = originalArgv;
  });
  process.argv = [
    process.execPath,
    path.join(__dirname, "..", "scripts", "seedReferenceData.js"),
    "--compare",
  ];

  await assertMainCompare(t, () => main());
});
