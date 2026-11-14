const test = require("node:test");
const assert = require("node:assert/strict");

const mongoose = require("mongoose");
const User = require("../models/User");
const Customer = require("../models/Customer");

const {
  registerCustomer,
} = require("../controllers/customerController");

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

function createMockRequest(body = {}) {
  return {
    body,
    firebaseUser: {
      firebaseUid: "verified-firebase-uid",
      phoneNumber: "+919876543210",
    },
  };
}

async function runController(req, t, existingUsers = []) {
  const res = createMockResponse();
  let nextError = null;

  // Mock the existing-account lookup.
  t.mock.method(User, "find", () => ({
    select: async () => existingUsers,
  }));

  // Mock the MongoDB transaction.
  t.mock.method(mongoose, "startSession", async () => ({
    withTransaction: async (callback) => callback(),
    endSession: async () => {},
  }));

  await registerCustomer(req, res, (error) => {
    nextError = error;
  });

  return { res, nextError };
}

// Test 1: Invalid registration details.
test("invalid customer data returns 400", async (t) => {
  const startSession = t.mock.method(mongoose, "startSession");

  const { res } = await runController(
    createMockRequest({ name: "", city: "Mumbai" }),
    t,
  );

  assert.equal(res.statusCode, 400);
  assert.equal(res.responseBody.success, false);
  assert.equal(startSession.mock.calls.length, 0);
});

// Test 2: Successful customer registration.
test("customer registration creates User and Customer records", async (t) => {
  const userId = new mongoose.Types.ObjectId();
  const customerId = new mongoose.Types.ObjectId();

  let createdUserData;
  let createdCustomerData;

  t.mock.method(User, "create", async (documents) => {
    createdUserData = documents[0];

    return [{ ...documents[0], _id: userId }];
  });

  t.mock.method(Customer, "create", async (documents) => {
    createdCustomerData = documents[0];

    return [{ ...documents[0], _id: customerId }];
  });

  const { res, nextError } = await runController(
    createMockRequest({
      name: "Test Customer",
      city: "Mumbai",
      state: "Maharashtra",
      email: "customer@example.com",
    }),
    t,
  );

  assert.equal(nextError, null);
  assert.equal(res.statusCode, 201);
  assert.equal(res.responseBody.success, true);

  assert.equal(createdUserData.firebaseUid, "verified-firebase-uid");
  assert.equal(createdUserData.phoneNumber, "+919876543210");
  assert.equal(createdUserData.fullName, "Test Customer");
  assert.equal(createdUserData.role, "customer");

  assert.equal(createdCustomerData.userId.toString(), userId.toString());
  assert.equal(createdCustomerData.city, "Mumbai");

  assert.equal(res.responseBody.data.userId.toString(), userId.toString());
  assert.equal(res.responseBody.data.customerId.toString(), customerId.toString());
  assert.equal(res.responseBody.data.role, "customer");
});

// Test 3: Existing customer should receive 409.
test("existing customer account returns 409", async (t) => {
  const { res } = await runController(
    createMockRequest({
      name: "Test Customer",
      city: "Mumbai",
    }),
    t,
    [{ role: "customer" }],
  );

  assert.equal(res.statusCode, 409);
  assert.equal(res.responseBody.success, false);
});

// Test 4: Existing vendor should receive 403.
test("existing vendor account returns 403", async (t) => {
  const { res } = await runController(
    createMockRequest({
      name: "Test Customer",
      city: "Mumbai",
    }),
    t,
    [{ role: "vendor" }],
  );

  assert.equal(res.statusCode, 403);
  assert.equal(res.responseBody.success, false);
});

// Test 5: Existing admin should receive 403.
test("existing admin account returns 403", async (t) => {
  const { res } = await runController(
    createMockRequest({
      name: "Test Customer",
      city: "Mumbai",
    }),
    t,
    [{ role: "admin" }],
  );

  assert.equal(res.statusCode, 403);
  assert.equal(res.responseBody.success, false);
});

// Test 6: Duplicate database record should receive 409.
test("duplicate database identity returns 409", async (t) => {
  const duplicateError = Object.assign(new Error("Duplicate key"), {
    code: 11000,
  });

  t.mock.method(User, "create", async () => {
    throw duplicateError;
  });

  const { res, nextError } = await runController(
    createMockRequest({
      name: "Test Customer",
      city: "Mumbai",
    }),
    t,
  );

  assert.equal(nextError, null);
  assert.equal(res.statusCode, 409);
  assert.equal(res.responseBody.success, false);
});


// Test 7: Unexpected database error should go to next().
test("unexpected database errors are passed to next", async (t) => {
  const databaseError = new Error("Database unavailable");

  t.mock.method(User, "create", async () => {
    throw databaseError;
  });

  const { res, nextError } = await runController(
    createMockRequest({
      name: "Test Customer",
      city: "Mumbai",
    }),
    t,
  );

  assert.equal(res.statusCode, null);
  assert.equal(nextError, databaseError);
});