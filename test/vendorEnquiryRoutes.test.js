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

const app = require("../app");

const userId = "507f1f77bcf86cd799439012";
const vendorId = "507f1f77bcf86cd799439021";
const enquiryId = "507f1f77bcf86cd799439031";

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

function mockVendorAuthentication(t, role = "vendor") {
  t.mock.method(firebaseAuth, "verifyIdToken", async () => ({
    uid: "firebase-vendor-enquiry-test",
    phone_number: "+911234567890",
  }));

  t.mock.method(User, "findOne", async () => ({
    _id: userId,
    firebaseUid: "firebase-vendor-enquiry-test",
    phoneNumber: "+911234567890",
    role,
    accountStatus: "active",
  }));

  if (role === "vendor") {
    t.mock.method(Vendor, "findOne", async () => ({
      _id: vendorId,
      userId,
      approvalStatus: "approved",
      isActive: true,
      deletedAt: null,
    }));
  }
  if (role === "customer") {
  t.mock.method(Customer, "findOne", async () => ({
    _id: vendorId,
    userId,
  }));
}
}

function createQuery(result) {
  return {
    sort() {
      return this;
    },
    lean: async () => result,
  };
}

// 1. Unauthenticated users cannot list vendor enquiries.
test("GET /api/vendor/enquiries returns 401 without authentication", async () => {
  const { server, baseUrl } = await startServer();

  try {
    const response = await fetch(`${baseUrl}/api/vendor/enquiries`);
    const body = await response.json();

    assert.equal(response.status, 401);
    assert.equal(body.success, false);
  } finally {
    await closeServer(server);
  }
});

// 2. Customers cannot access vendor enquiries.
test("GET /api/vendor/enquiries returns 403 for a customer", async (t) => {
  mockVendorAuthentication(t, "customer");

  const { server, baseUrl } = await startServer();

  try {
    const response = await fetch(`${baseUrl}/api/vendor/enquiries`, {
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

// 3. Approved vendors can list their own enquiries.
test("GET /api/vendor/enquiries allows an approved vendor to list enquiries", async (t) => {
  mockVendorAuthentication(t);

  const enquiries = [
    {
      _id: enquiryId,
      vendorId,
      status: "pending",
      message: "Wedding catering enquiry",
    },
  ];

  let capturedFilter;

  t.mock.method(Enquiry, "find", (filter) => {
    capturedFilter = filter;
    return createQuery(enquiries);
  });

  const { server, baseUrl } = await startServer();

  try {
    const response = await fetch(`${baseUrl}/api/vendor/enquiries`, {
      headers: {
        Authorization: "Bearer valid-test-token",
      },
    });

    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.count, 1);
    assert.equal(body.data[0].message, "Wedding catering enquiry");
    assert.equal(String(capturedFilter.vendorId), vendorId);
  } finally {
    await closeServer(server);
  }
});

// 4. Invalid enquiry IDs are rejected.
test("GET /api/vendor/enquiries/:id returns 400 for an invalid ID", async (t) => {
  mockVendorAuthentication(t);

  const { server, baseUrl } = await startServer();

  try {
    const response = await fetch(
      `${baseUrl}/api/vendor/enquiries/invalid-id`,
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

// 5. Vendors cannot view enquiries belonging to another vendor.
test("GET /api/vendor/enquiries/:id returns 404 for another vendor's enquiry", async (t) => {
  mockVendorAuthentication(t);

  let capturedFilter;

  t.mock.method(Enquiry, "findOne", (filter) => {
    capturedFilter = filter;
    return createQuery(null);
  });

  const { server, baseUrl } = await startServer();

  try {
    const response = await fetch(
      `${baseUrl}/api/vendor/enquiries/${enquiryId}`,
      {
        headers: {
          Authorization: "Bearer valid-test-token",
        },
      },
    );

    const body = await response.json();

    assert.equal(response.status, 404);
    assert.equal(body.success, false);
    assert.equal(String(capturedFilter.vendorId), vendorId);
    assert.equal(String(capturedFilter._id), enquiryId);
  } finally {
    await closeServer(server);
  }
});

// 6. Vendors can view their own enquiry details.
test("GET /api/vendor/enquiries/:id returns an enquiry belonging to the vendor", async (t) => {
  mockVendorAuthentication(t);

  const enquiry = {
    _id: enquiryId,
    vendorId,
    status: "pending",
    message: "Wedding catering enquiry",
  };

  t.mock.method(Enquiry, "findOne", () => createQuery(enquiry));

  const { server, baseUrl } = await startServer();

  try {
    const response = await fetch(
      `${baseUrl}/api/vendor/enquiries/${enquiryId}`,
      {
        headers: {
          Authorization: "Bearer valid-test-token",
        },
      },
    );

    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.data.message, "Wedding catering enquiry");
    assert.equal(String(body.data.vendorId), vendorId);
  } finally {
    await closeServer(server);
  }
});

// 7. Vendors cannot update enquiries with invalid IDs.
test("PATCH /api/vendor/enquiries/:id/status returns 400 for invalid ID", async (t) => {
  mockVendorAuthentication(t);

  const { server, baseUrl } = await startServer();

  try {
    const response = await fetch(
      `${baseUrl}/api/vendor/enquiries/invalid-id/status`,
      {
        method: "PATCH",
        headers: {
          Authorization: "Bearer valid-test-token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: "accepted" }),
      },
    );

    assert.equal(response.status, 400);
  } finally {
    await closeServer(server);
  }
});

// 8. Vendors cannot update enquiries they do not own.
test("PATCH /api/vendor/enquiries/:id/status returns 404 for another vendor's enquiry", async (t) => {
  mockVendorAuthentication(t);

  t.mock.method(Enquiry, "findOne", async () => null);

  const { server, baseUrl } = await startServer();

  try {
    const response = await fetch(
      `${baseUrl}/api/vendor/enquiries/${enquiryId}/status`,
      {
        method: "PATCH",
        headers: {
          Authorization: "Bearer valid-test-token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: "accepted" }),
      },
    );

    assert.equal(response.status, 404);
  } finally {
    await closeServer(server);
  }
});

// 9. Vendors cannot make invalid status transitions.
test("PATCH /api/vendor/enquiries/:id/status rejects invalid transitions", async (t) => {
  mockVendorAuthentication(t);

  const enquiry = {
    _id: enquiryId,
    vendorId,
    status: "accepted",
  };

  t.mock.method(Enquiry, "findOne", async () => enquiry);

  const { server, baseUrl } = await startServer();

  try {
    const response = await fetch(
      `${baseUrl}/api/vendor/enquiries/${enquiryId}/status`,
      {
        method: "PATCH",
        headers: {
          Authorization: "Bearer valid-test-token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: "pending" }),
      },
    );

    assert.equal(response.status, 400);
  } finally {
    await closeServer(server);
  }
});

// 10. Vendors cannot submit an excessively long response.
test("PATCH /api/vendor/enquiries/:id/status rejects responses over 2000 characters", async (t) => {
  mockVendorAuthentication(t);

  const enquiry = {
    _id: enquiryId,
    vendorId,
    status: "pending",
    save: async () => {},
  };

  t.mock.method(Enquiry, "findOne", async () => enquiry);

  const { server, baseUrl } = await startServer();

  try {
    const response = await fetch(
      `${baseUrl}/api/vendor/enquiries/${enquiryId}/status`,
      {
        method: "PATCH",
        headers: {
          Authorization: "Bearer valid-test-token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: "accepted",
          vendorResponse: "A".repeat(2001),
        }),
      },
    );

    assert.equal(response.status, 400);
  } finally {
    await closeServer(server);
  }
});

// 11. Vendors can accept their own pending enquiries.
test("PATCH /api/vendor/enquiries/:id/status allows a vendor to accept an enquiry", async (t) => {
  mockVendorAuthentication(t);

  const enquiry = {
    _id: enquiryId,
    vendorId,
    status: "pending",
    statusUpdatedAt: null,
    vendorResponse: "",
    save: async () => {},
  };

  t.mock.method(Enquiry, "findOne", async () => enquiry);

  const { server, baseUrl } = await startServer();

  try {
    const response = await fetch(
      `${baseUrl}/api/vendor/enquiries/${enquiryId}/status`,
      {
        method: "PATCH",
        headers: {
          Authorization: "Bearer valid-test-token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: "accepted",
          vendorResponse: "We would be happy to serve your event.",
        }),
      },
    );

    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.data.status, "accepted");
    assert.equal(
      body.data.vendorResponse,
      "We would be happy to serve your event.",
    );
    assert.ok(!Number.isNaN(Date.parse(body.data.statusUpdatedAt)));
  } finally {
    await closeServer(server);
  }
});
