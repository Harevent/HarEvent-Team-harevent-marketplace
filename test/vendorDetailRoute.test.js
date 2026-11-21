
const process = require("node:process");

process.env.NODE_ENV = "test";
process.env.MONGODB_URI = "mongodb://127.0.0.1:27017/harevent_test";
process.env.FIREBASE_PROJECT_ID = "harevent-test";
process.env.CLIENT_URL = "http://localhost:5173";

const test = require("node:test");
const assert = require("node:assert/strict");

const { firebaseAuth } = require("../config/firebase");
const User = require("../models/User");
const Customer = require("../models/Customer");
const Vendor = require("../models/Vendor");

const app = require("../app");

async function startServer() {
  const server = app.listen(0);

  await new Promise((resolve) => server.once("listening", resolve));

  return {
    server,
    baseUrl: `http://127.0.0.1:${server.address().port}`,
  };
}

async function closeServer(server) {
  await new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

function createApprovedVendor() {
  return {
    publicVendorId: "HV-TEST-001",
    businessName: "Demo Photography",
    description: "Wedding photography services",
    categoryIds: [],
    selectedCategories: [],
    eventTypeIds: [],
    location: {
      address: "Test Address",
      city: "Mumbai",
      country: "India",
    },
    images: [],
    startingPrice: 15000,
    currency: "INR",
  };
}

// 1. Missing Firebase token.
test("GET /api/vendors/:id returns 401 without authentication", async (t) => {
  const { server, baseUrl } = await startServer();

  try {
    const response = await fetch(
      `${baseUrl}/api/vendors/507f1f77bcf86cd799439011`,
    );

    const body = await response.json();

    assert.equal(response.status, 401);
    assert.equal(body.success, false);
  } finally {
    await closeServer(server);
  }
});

// 2. Invalid vendor ID.

test("GET /api/vendors/:id rejects an invalid vendor ID", async (t) => {
  t.mock.method(firebaseAuth, "verifyIdToken", async () => ({
    uid: "firebase-customer-001",
    phone_number: "+911234567890",
  }));

  t.mock.method(User, "findOne", async () => ({
    _id: "507f1f77bcf86cd799439012",
    firebaseUid: "firebase-customer-001",
    phoneNumber: "+911234567890",
    role: "customer",
    accountStatus: "active",
  }));

  t.mock.method(Customer, "findOne", async () => ({
    _id: "507f1f77bcf86cd799439013",
    userId: "507f1f77bcf86cd799439012",
  }));

  const { server, baseUrl } = await startServer();

  try {
    const response = await fetch(`${baseUrl}/api/vendors/123`, {
      headers: {
        Authorization: "Bearer valid-test-token",
      },
    });

    const body = await response.json();

    assert.equal(response.status, 400);
    assert.equal(body.success, false);
    assert.equal(body.message, "Invalid vendor ID.");
  } finally {
    await closeServer(server);
  }
});

// 3. Customer can retrieve an approved vendor.
test("GET /api/vendors/:id returns an approved vendor to a customer", async (t) => {
  const vendorId = "507f1f77bcf86cd799439011";

  const vendorData = createApprovedVendor();

  t.mock.method(firebaseAuth, "verifyIdToken", async () => ({
    uid: "firebase-customer-001",
    phone_number: "+911234567890",
  }));

  t.mock.method(User, "findOne", async () => ({
    _id: "507f1f77bcf86cd799439012",
    firebaseUid: "firebase-customer-001",
    phoneNumber: "+911234567890",
    role: "customer",
    accountStatus: "active",
  }));

  t.mock.method(Customer, "findOne", async () => ({
    _id: "507f1f77bcf86cd799439013",
    userId: "507f1f77bcf86cd799439012",
  }));

  let capturedFilter;

  t.mock.method(Vendor, "findOne", (filter) => {
    capturedFilter = filter;

    return {
      select() {
        return this;
      },
      populate() {
        return this;
      },
      lean: async () => vendorData,
    };
  });

  const { server, baseUrl } = await startServer();

  try {
    const response = await fetch(
      `${baseUrl}/api/vendors/${vendorId}`,
      {
        headers: {
          Authorization: "Bearer valid-test-token",
        },
      },
    );

    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.data.businessName, "Demo Photography");

    assert.deepEqual(capturedFilter, {
      _id: vendorId,
      approvalStatus: "approved",
      isActive: true,
      deletedAt: null,
    });
  } finally {
    await closeServer(server);
  }
});

// 4. Non-customer cannot retrieve vendor details.
test("GET /api/vendors/:id rejects a vendor account", async (t) => {
  t.mock.method(firebaseAuth, "verifyIdToken", async () => ({
    uid: "firebase-vendor-001",
    phone_number: "+911234567890",
  }));

  t.mock.method(User, "findOne", async () => ({
    _id: "507f1f77bcf86cd799439012",
    firebaseUid: "firebase-vendor-001",
    phoneNumber: "+911234567890",
    role: "vendor",
    accountStatus: "active",
  }));

  t.mock.method(Vendor, "findOne", async () => null);

  const { server, baseUrl } = await startServer();

  try {
    const response = await fetch(
      `${baseUrl}/api/vendors/507f1f77bcf86cd799439011`,
      {
        headers: {
          Authorization: "Bearer valid-test-token",
        },
      },
    );

    const body = await response.json();

    assert.equal(response.status, 403);
    assert.equal(body.success, false);
  } finally {
    await closeServer(server);
  }
});

// 5. Pending or unavailable vendor is not returned.
test("GET /api/vendors/:id returns 404 when vendor is unavailable", async (t) => {
  t.mock.method(firebaseAuth, "verifyIdToken", async () => ({
    uid: "firebase-customer-001",
    phone_number: "+911234567890",
  }));

  t.mock.method(User, "findOne", async () => ({
    _id: "507f1f77bcf86cd799439012",
    firebaseUid: "firebase-customer-001",
    phoneNumber: "+911234567890",
    role: "customer",
    accountStatus: "active",
  }));

  t.mock.method(Customer, "findOne", async () => ({
    _id: "507f1f77bcf86cd799439013",
    userId: "507f1f77bcf86cd799439012",
  }));

  t.mock.method(Vendor, "findOne", () => ({
    select() {
      return this;
    },
    populate() {
      return this;
    },
    lean: async () => null,
  }));

  const { server, baseUrl } = await startServer();

  try {
    const response = await fetch(
      `${baseUrl}/api/vendors/507f1f77bcf86cd799439011`,
      {
        headers: {
          Authorization: "Bearer valid-test-token",
        },
      },
    );

    const body = await response.json();

    assert.equal(response.status, 404);
    assert.equal(body.success, false);
    assert.equal(body.message, "Vendor not found.");
  } finally {
    await closeServer(server);
  }
});
