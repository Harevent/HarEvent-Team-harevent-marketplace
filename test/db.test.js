const { test } = require("node:test");
const assert = require("node:assert/strict");
const dns = require("node:dns");
const mongoose = require("mongoose");

// Use controlled settings without loading local credentials or accessing MongoDB.
process.env.MONGODB_URI = "mongodb+srv://cluster.example.com/harevent_test";
process.env.MONGODB_DNS_SERVERS = " 1.1.1.1,8.8.8.8 ";
process.env.FIREBASE_PROJECT_ID = "harevent-test";
process.env.NODE_ENV = "test";
delete process.env.CLIENT_URL;
delete process.env.PORT;

const connectDB = require("../config/db");

test("database startup applies DNS servers from the validated environment before connecting", async (t) => {
  const originalServers = dns.getServers();
  t.after(() => dns.setServers(originalServers));
  t.mock.method(console, "log", () => {});
  const connect = t.mock.method(mongoose, "connect", async (uri) => {
    assert.equal(uri, process.env.MONGODB_URI);
    assert.deepEqual(dns.promises.getServers(), ["1.1.1.1", "8.8.8.8"]);
  });

  await connectDB();

  assert.equal(connect.mock.calls.length, 1);
});
