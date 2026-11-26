
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
const Enquiry = require("../models/Enquiry");
const VendorSubscription = require("../models/VendorSubscription");

const app = require("../app");

const USER_ID = "507f1f77bcf86cd799439012";
const CUSTOMER_ID = "507f1f77bcf86cd799439013";
const VENDOR_ID = "507f1f77bcf86cd799439014";

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

function mockVendorAuthentication(t, vendorProfile = {}) {
  t.mock.method(firebaseAuth, "verifyIdToken", async () => ({
    uid: "firebase-vendor-001",
    phone_number: "+919876543210",
  }));

  t.mock.method(User, "findOne", async () => ({
    _id: USER_ID,
    firebaseUid: "firebase-vendor-001",
    phoneNumber: "+919876543210",
    role: "vendor",
    accountStatus: "active",
  }));

  const authenticatedVendor = {
    _id: VENDOR_ID,
    userId: USER_ID,
    approvalStatus: "pending",
    isActive: false,
    deletedAt: null,
    ...vendorProfile,
  };

  return authenticatedVendor;
}

function mockCustomerAuthentication(t) {
  t.mock.method(firebaseAuth, "verifyIdToken", async () => ({
    uid: "firebase-customer-001",
    phone_number: "+911234567890",
  }));

  t.mock.method(User, "findOne", async () => ({
    _id: USER_ID,
    firebaseUid: "firebase-customer-001",
    phoneNumber: "+911234567890",
    role: "customer",
    accountStatus: "active",
  }));

  t.mock.method(Customer, "findOne", async () => ({
    _id: CUSTOMER_ID,
    userId: USER_ID,
  }));
}

function mockDashboardDatabase(t, vendorDocument, subscription = null) {
  let capturedVendorFilter;
  let capturedSubscriptionFilter;

  // Authentication performs a vendor lookup by userId.
  // The dashboard controller performs a second lookup by _id and userId.
  t.mock.method(Vendor, "findOne", (filter) => {
    if (filter._id) {
      capturedVendorFilter = filter;

      return {
        select() {
          return this;
        },
        populate() {
          return this;
        },
        lean: async () => vendorDocument,
      };
    }

    return vendorDocument;
  });

  const counts = {
    pending: 3,
    viewed: 2,
    accepted: 1,
    rejected: 1,
    cancelled: 0,
  };

  t.mock.method(Enquiry, "countDocuments", async (filter) => {
    assert.equal(String(filter.vendorId), VENDOR_ID);
    return counts[filter.status] ?? 0;
  });

  t.mock.method(VendorSubscription, "findOne", (filter) => {
    capturedSubscriptionFilter = filter;

    return {
      select() {
        return this;
      },
      populate() {
        return this;
      },
      lean: async () => subscription,
    };
  });

  return {
    getVendorFilter: () => capturedVendorFilter,
    getSubscriptionFilter: () => capturedSubscriptionFilter,
  };
}

// 1. Unauthenticated request.
test("GET /api/vendor/dashboard returns 401 without authentication", async () => {
  const { server, baseUrl } = await startServer();

  try {
    const response = await fetch(`${baseUrl}/api/vendor/dashboard`);
    const body = await response.json();

    assert.equal(response.status, 401);
    assert.equal(body.success, false);
  } finally {
    await closeServer(server);
  }
});

// 2. Customer cannot access the vendor dashboard.
test("GET /api/vendor/dashboard returns 403 for a customer", async (t) => {
  mockCustomerAuthentication(t);

  const { server, baseUrl } = await startServer();

  try {
    const response = await fetch(`${baseUrl}/api/vendor/dashboard`, {
      headers: {
        Authorization: "Bearer valid-test-token",
      },
    });

    const body = await response.json();

    assert.equal(response.status, 403);
    assert.equal(body.success, false);
  } finally {
    await closeServer(server);
  }
});

// 3. Pending vendor can access the dashboard.
test("GET /api/vendor/dashboard allows a pending vendor to view their dashboard", async (t) => {
  const vendorDocument = {
    _id: VENDOR_ID,
    userId: USER_ID,
    businessName: "Example Events",
    approvalStatus: "pending",
    isActive: false,
  };

  mockVendorAuthentication(t);

  const database = mockDashboardDatabase(t, vendorDocument);

  const { server, baseUrl } = await startServer();

  try {
    const response = await fetch(`${baseUrl}/api/vendor/dashboard`, {
      headers: {
        Authorization: "Bearer valid-test-token",
      },
    });

    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.success, true);

    assert.equal(body.data.vendor.businessName, "Example Events");
    assert.equal(body.data.vendor.approvalStatus, "pending");

    assert.deepEqual(body.data.enquiries, {
      pending: 3,
      viewed: 2,
      accepted: 1,
      rejected: 1,
      cancelled: 0,
      total: 7,
    });

    assert.equal(body.data.subscription, null);

    assert.deepEqual(database.getVendorFilter(), {
      _id: VENDOR_ID,
      userId: USER_ID,
      deletedAt: null,
    });

    assert.deepEqual(database.getSubscriptionFilter(), {
      vendorId: VENDOR_ID,
      status: "active",
    });
  } finally {
    await closeServer(server);
  }
});

// 4. Vendor without a profile receives 404.
test("GET /api/vendor/dashboard returns 404 when vendor profile does not exist", async (t) => {
  mockVendorAuthentication(t);

  // requireAuth finds no vendor profile.
  t.mock.method(Vendor, "findOne", async () => null);

  const { server, baseUrl } = await startServer();

  try {
    const response = await fetch(`${baseUrl}/api/vendor/dashboard`, {
      headers: {
        Authorization: "Bearer valid-test-token",
      },
    });

    const body = await response.json();

    assert.equal(response.status, 404);
    assert.equal(body.success, false);
    assert.equal(body.message, "Vendor profile not found.");
  } finally {
    await closeServer(server);
  }
});

// 5. Active subscription is included in the dashboard.
test("GET /api/vendor/dashboard returns the active subscription", async (t) => {
  const vendorDocument = {
    _id: VENDOR_ID,
    userId: USER_ID,
    businessName: "Example Events",
    approvalStatus: "approved",
    isActive: true,
  };

  const subscription = {
    status: "active",
    finalAmount: 5000,
    planId: {
      name: "GOLD",
      slug: "gold",
    },
  };

  mockVendorAuthentication(t);
  mockDashboardDatabase(t, vendorDocument, subscription);

  const { server, baseUrl } = await startServer();

  try {
    const response = await fetch(`${baseUrl}/api/vendor/dashboard`, {
      headers: {
        Authorization: "Bearer valid-test-token",
      },
    });

    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.deepEqual(body.data.subscription, subscription);
  } finally {
    await closeServer(server);
  }
});

// 6. Database errors are forwarded to the centralized error handler.
test("GET /api/vendor/dashboard returns a safe 500 when enquiry counting fails", async (t) => {
  const vendorDocument = {
    _id: VENDOR_ID,
    userId: USER_ID,
    businessName: "Example Events",
    approvalStatus: "approved",
    isActive: true,
  };

  mockVendorAuthentication(t);

  t.mock.method(Vendor, "findOne", (filter) => {
    if (filter._id) {
      return {
        select() {
          return this;
        },
        populate() {
          return this;
        },
        lean: async () => vendorDocument,
      };
    }

    return vendorDocument;
  });

  t.mock.method(Enquiry, "countDocuments", async () => {
    throw new Error("Sensitive database details");
  });

  const { server, baseUrl } = await startServer();

  try {
    const response = await fetch(`${baseUrl}/api/vendor/dashboard`, {
      headers: {
        Authorization: "Bearer valid-test-token",
      },
    });

    const body = await response.json();

    assert.equal(response.status, 500);
    assert.equal(body.success, false);
    assert.equal(body.message, "Internal server error");
    assert.equal(
      JSON.stringify(body).includes("Sensitive database details"),
      false,
    );
  } finally {
    await closeServer(server);
  }
});
