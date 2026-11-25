
const process = require("node:process");

process.env.NODE_ENV = "test";
process.env.MONGODB_URI = "mongodb://127.0.0.1:27017/harevent_test";
process.env.FIREBASE_PROJECT_ID = "harevent-test";
process.env.CLIENT_URL = "http://localhost:5173";

const test = require("node:test");
const assert = require("node:assert/strict");

const { firebaseAuth } = require("../config/firebase");

const User = require("../models/User");
const Admin = require("../models/Admin");
const Customer = require("../models/Customer");
const Vendor = require("../models/Vendor");

const app = require("../app");

const adminUserId = "507f1f77bcf86cd799439012";
const adminId = "507f1f77bcf86cd799439013";
const vendorId = "507f1f77bcf86cd799439021";

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

// adminType distinguishes admin and super_admin.
// Both have User.role === "admin".
function mockAuthentication(t, role = "admin", adminType = "admin") {
  t.mock.method(firebaseAuth, "verifyIdToken", async () => ({
    uid: "firebase-vendor-admin-test",
    phone_number: "+911234567890",
  }));

  t.mock.method(User, "findOne", async () => ({
    _id: adminUserId,
    firebaseUid: "firebase-vendor-admin-test",
    phoneNumber: "+911234567890",
    role,
    accountStatus: "active",
  }));

  if (role === "admin") {
    t.mock.method(Admin, "findOne", async () => ({
      _id: adminId,
      userId: adminUserId,
      adminType,
    }));
  }

  if (role === "customer") {
    t.mock.method(Customer, "findOne", async () => ({
      _id: adminId,
      userId: adminUserId,
    }));
  }

  if (role === "vendor") {
    t.mock.method(Vendor, "findOne", async () => ({
      _id: vendorId,
      userId: adminUserId,
      approvalStatus: "approved",
      isActive: true,
      deletedAt: null,
    }));
  }
}

function createQuery(result) {
  return {
    select() {
      return this;
    },
    populate() {
      return this;
    },
    sort() {
      return this;
    },
    skip() {
      return this;
    },
    limit() {
      return this;
    },
    lean: async () => result,
  };
}

// 1. Unauthenticated users cannot list vendor applications.
test("GET /api/admin/vendors returns 401 without authentication", async () => {
  const { server, baseUrl } = await startServer();

  try {
    const response = await fetch(`${baseUrl}/api/admin/vendors`);
    const body = await response.json();

    assert.equal(response.status, 401);
    assert.equal(body.success, false);
  } finally {
    await closeServer(server);
  }
});

// 2. Customers cannot access Admin vendor applications.
test("GET /api/admin/vendors returns 403 for a customer", async (t) => {
  mockAuthentication(t, "customer");

  const { server, baseUrl } = await startServer();

  try {
    const response = await fetch(`${baseUrl}/api/admin/vendors`, {
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

// 3. Vendors cannot access Admin vendor applications.
test("GET /api/admin/vendors returns 403 for a vendor", async (t) => {
  mockAuthentication(t, "vendor");

  const { server, baseUrl } = await startServer();

  try {
    const response = await fetch(`${baseUrl}/api/admin/vendors`, {
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

// 4. Admin can list pending vendor applications.
test("GET /api/admin/vendors allows an admin to list applications", async (t) => {
  mockAuthentication(t, "admin", "admin");

  const vendor = {
    _id: vendorId,
    businessName: "Test Wedding Events",
    approvalStatus: "pending",
    isActive: false,
  };

  t.mock.method(Vendor, "find", () => createQuery([vendor]));
  t.mock.method(Vendor, "countDocuments", async () => 1);

  const { server, baseUrl } = await startServer();

  try {
    const response = await fetch(`${baseUrl}/api/admin/vendors`, {
      headers: {
        Authorization: "Bearer valid-test-token",
      },
    });

    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.total, 1);
    assert.equal(body.data[0].businessName, "Test Wedding Events");
  } finally {
    await closeServer(server);
  }
});

// 5. Super admin can list pending vendor applications.
test("GET /api/admin/vendors allows a super_admin to list applications", async (t) => {
  mockAuthentication(t, "admin", "super_admin");

  const vendor = {
    _id: vendorId,
    businessName: "Test Wedding Events",
    approvalStatus: "pending",
    isActive: false,
  };

  t.mock.method(Vendor, "find", () => createQuery([vendor]));
  t.mock.method(Vendor, "countDocuments", async () => 1);

  const { server, baseUrl } = await startServer();

  try {
    const response = await fetch(`${baseUrl}/api/admin/vendors`, {
      headers: {
        Authorization: "Bearer valid-test-token",
      },
    });

    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.total, 1);
  } finally {
    await closeServer(server);
  }
});

// 6. Invalid vendor IDs are rejected.
test("GET /api/admin/vendors/:id returns 400 for an invalid ID", async (t) => {
  mockAuthentication(t);

  const { server, baseUrl } = await startServer();

  try {
    const response = await fetch(
      `${baseUrl}/api/admin/vendors/invalid-id`,
      {
        headers: {
          Authorization: "Bearer valid-test-token",
        },
      },
    );

    const body = await response.json();

    assert.equal(response.status, 400);
    assert.equal(body.success, false);
  } finally {
    await closeServer(server);
  }
});

// 7. Admin can approve a pending vendor.
test("PATCH /api/admin/vendors/:id/approve approves a pending vendor", async (t) => {
  mockAuthentication(t);

  const approvedVendor = {
    _id: vendorId,
    approvalStatus: "approved",
    isActive: true,
    reviewedBy: adminUserId,
  };

  let capturedFilter;
  let capturedUpdate;
  let capturedOptions;

  t.mock.method(
    Vendor,
    "findOneAndUpdate",
    async (filter, update, options) => {
      capturedFilter = filter;
      capturedUpdate = update;
      capturedOptions = options;
      return approvedVendor;
    },
  );

  const { server, baseUrl } = await startServer();

  try {
    const response = await fetch(
      `${baseUrl}/api/admin/vendors/${vendorId}/approve`,
      {
        method: "PATCH",
        headers: {
          Authorization: "Bearer valid-test-token",
        },
      },
    );

    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.data.approvalStatus, "approved");
    assert.equal(body.data.isActive, true);

    assert.equal(capturedFilter.approvalStatus, "pending");
    assert.equal(capturedUpdate.$set.reviewedBy, adminUserId);
    assert.ok(capturedUpdate.$set.reviewedAt instanceof Date);
    assert.equal(capturedOptions.new, true);
  } finally {
    await closeServer(server);
  }
});

// 8. Admin cannot reject without a reason.
test("PATCH /api/admin/vendors/:id/reject requires a rejection reason", async (t) => {
  mockAuthentication(t);

  const { server, baseUrl } = await startServer();

  try {
    const response = await fetch(
      `${baseUrl}/api/admin/vendors/${vendorId}/reject`,
      {
        method: "PATCH",
        headers: {
          Authorization: "Bearer valid-test-token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      },
    );

    const body = await response.json();

    assert.equal(response.status, 400);
    assert.equal(body.success, false);
  } finally {
    await closeServer(server);
  }
});

// 9. Admin can reject a pending vendor with a reason.
test("PATCH /api/admin/vendors/:id/reject rejects a pending vendor", async (t) => {
  mockAuthentication(t);

  const rejectedVendor = {
    _id: vendorId,
    approvalStatus: "rejected",
    isActive: false,
    rejectionReason: "Incomplete business details",
    reviewedBy: adminUserId,
  };

  let capturedFilter;
  let capturedUpdate;

  t.mock.method(
    Vendor,
    "findOneAndUpdate",
    async (filter, update) => {
      capturedFilter = filter;
      capturedUpdate = update;
      return rejectedVendor;
    },
  );

  const { server, baseUrl } = await startServer();

  try {
    const response = await fetch(
      `${baseUrl}/api/admin/vendors/${vendorId}/reject`,
      {
        method: "PATCH",
        headers: {
          Authorization: "Bearer valid-test-token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          rejectionReason: "  Incomplete business details  ",
        }),
      },
    );

    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.data.approvalStatus, "rejected");
    assert.equal(body.data.isActive, false);

    assert.equal(capturedFilter.approvalStatus, "pending");
    assert.equal(
      capturedUpdate.$set.rejectionReason,
      "Incomplete business details",
    );
    assert.equal(capturedUpdate.$set.reviewedBy, adminUserId);
    assert.ok(capturedUpdate.$set.reviewedAt instanceof Date);
  } finally {
    await closeServer(server);
  }
});
