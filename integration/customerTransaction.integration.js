const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { randomUUID, randomInt } = require("node:crypto");

const User = require("../models/User");
const Customer = require("../models/Customer");

const {
  registerCustomer,
} = require("../controllers/customerController");

const DATABASE_NAME = "harevent_test";

function createTestIdentity() {
  const uniqueId = randomUUID();

  return {
    firebaseUid: `integration-test-${uniqueId}`,
    phoneNumber: `+919${randomInt(100000000, 1000000000)}`,
  };
}

function createMockResponse() {
  return {
    statusCode: null,
    responseBody: null,

    status(code) {
      this.statusCode = code;
      return this;
    },

    json(body) {
      this.responseBody = body;
      return this;
    },
  };
}

function createMockRequest(identity) {
  return {
    body: {
      name: "Integration Test Customer",
      city: "Mumbai",
      state: "Maharashtra",
      email: `${identity.firebaseUid}@example.com`,
    },

    firebaseUser: identity,
  };
}

// Connect only to the explicitly approved test database.
before(async () => {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("Integration tests require NODE_ENV=test");
  }

  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error("MONGODB_URI is missing");
  }

  const databaseName = decodeURIComponent(
    new URL(uri).pathname.replace(/^\/+/, ""),
  );

  if (databaseName !== DATABASE_NAME) {
    throw new Error(
      `Unsafe database target: expected ${DATABASE_NAME}, got ${databaseName}`,
    );
  }

  await mongoose.connect(uri);

  if (mongoose.connection.name !== DATABASE_NAME) {
    await mongoose.disconnect();
    throw new Error("Connected database does not match the approved test database");
  }

  console.log(`Connected to ${DATABASE_NAME} for integration tests`);
});

// Disconnect after the tests.
after(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
});

// Delete only records belonging to this test's unique identity.
async function cleanupTestRecords(identity) {
  const user = await User.findOne({
    firebaseUid: identity.firebaseUid,
    phoneNumber: identity.phoneNumber,
  }).select("_id");

  if (user) {
    await Customer.deleteMany({ userId: user._id });
  }

  await User.deleteMany({
    firebaseUid: identity.firebaseUid,
    phoneNumber: identity.phoneNumber,
  });
}

// Test 1: Both records should be saved successfully.
test("successful registration commits User and Customer records", async () => {
  const identity = createTestIdentity();
  const req = createMockRequest(identity);
  const res = createMockResponse();

  let nextError = null;

  try {
    await registerCustomer(req, res, (error) => {
      nextError = error;
    });

    assert.equal(nextError, null);
    assert.equal(res.statusCode, 201);
    assert.equal(res.responseBody.success, true);

    const savedUser = await User.findOne({
      firebaseUid: identity.firebaseUid,
    });

    assert.ok(savedUser, "User record should exist in MongoDB");
    assert.equal(savedUser.phoneNumber, identity.phoneNumber);
    assert.equal(savedUser.role, "customer");

    const savedCustomer = await Customer.findOne({
      userId: savedUser._id,
    });

    assert.ok(savedCustomer, "Customer record should exist in MongoDB");
    assert.equal(savedCustomer.city, "Mumbai");
    assert.equal(savedCustomer.state, "Maharashtra");

    assert.equal(
      String(res.responseBody.data.userId),
      String(savedUser._id),
    );

    assert.equal(
      String(res.responseBody.data.customerId),
      String(savedCustomer._id),
    );
  } finally {
    await cleanupTestRecords(identity);
  }
});

// Test 2: User creation must roll back if Customer creation fails.
test("failed Customer creation rolls back the User transaction", async (t) => {
  const identity = createTestIdentity();
  const req = createMockRequest(identity);
  const res = createMockResponse();

  let nextError = null;
  let attemptedUserId = null;

  t.mock.method(Customer, "create", async (documents) => {
    attemptedUserId = documents[0].userId;

    throw new Error("Simulated Customer creation failure");
  });

  try {
    await registerCustomer(req, res, (error) => {
      nextError = error;
    });

    assert.ok(nextError, "The controller should forward the error");
    assert.match(nextError.message, /Simulated Customer creation failure/);

    const savedUser = await User.findOne({
      firebaseUid: identity.firebaseUid,
    });

    assert.equal(
      savedUser,
      null,
      "User record must be rolled back after transaction failure",
    );

    assert.ok(attemptedUserId, "Customer creation should have been attempted");

    const savedCustomer = await Customer.findOne({
      userId: attemptedUserId,
    });

    assert.equal(
      savedCustomer,
      null,
      "Customer record must not exist after the failed transaction",
    );
  } finally {
    await cleanupTestRecords(identity);
  }
});
