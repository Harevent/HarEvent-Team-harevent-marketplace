
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

const USER_ID = "507f1f77bcf86cd799439012";
const CUSTOMER_ID = "507f1f77bcf86cd799439013";
const VENDOR_ID = "507f1f77bcf86cd799439014";
const OTHER_VENDOR_ID = "507f1f77bcf86cd799439019";
const ENQUIRY_ID = "507f1f77bcf86cd799439018";

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

function mockVendorAuthentication(t, vendorId = VENDOR_ID) {
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

  t.mock.method(Vendor, "findOne", async () => ({
    _id: vendorId,
    userId: USER_ID,
    approvalStatus: "approved",
    isActive: true,
    deletedAt: null,
  }));
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

async function sendVendorStatusUpdate(
  baseUrl,
  status,
  enquiryId = ENQUIRY_ID,
) {
  return fetch(
    `${baseUrl}/api/vendor/enquiries/${enquiryId}/status`,
    {
      method: "PATCH",
      headers: {
        Authorization: "Bearer valid-test-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status }),
    },
  );
}

// 1. Unauthenticated vendor enquiry request.
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

// 2. Vendor can retrieve only enquiries addressed to their vendor profile.
test("GET /api/vendor/enquiries returns enquiries belonging to the authenticated vendor", async (t) => {
  mockVendorAuthentication(t);

  const enquiryData = [
    {
      _id: ENQUIRY_ID,
      vendorId: VENDOR_ID,
      message: "First vendor enquiry",
    },
    {
      _id: "507f1f77bcf86cd799439021",
      vendorId: VENDOR_ID,
      message: "Second vendor enquiry",
    },
  ];

  let capturedFilter;
  let capturedSort;

  t.mock.method(Enquiry, "find", (filter) => {
    capturedFilter = filter;

    return {
      sort: async (sortOptions) => {
        capturedSort = sortOptions;
        return enquiryData;
      },
    };
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
    assert.equal(body.data.length, 2);
    assert.equal(body.data[0].message, "First vendor enquiry");

    assert.deepEqual(capturedFilter, {
      vendorId: VENDOR_ID,
    });

    assert.deepEqual(capturedSort, {
      createdAt: -1,
    });
  } finally {
    await closeServer(server);
  }
});

// 3. Customer accounts cannot access vendor enquiry listing.
test("GET /api/vendor/enquiries rejects a customer account", async (t) => {
  mockCustomerAuthentication(t);

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

// 4. Vendor can view an enquiry addressed to them.
test("GET /api/vendor/enquiries/:id allows a vendor to view their own enquiry", async (t) => {
  mockVendorAuthentication(t);

  t.mock.method(Enquiry, "findById", async () => ({
    _id: ENQUIRY_ID,
    vendorId: VENDOR_ID,
    customerId: CUSTOMER_ID,
    message: "Enquiry addressed to this vendor",
  }));

  const { server, baseUrl } = await startServer();

  try {
    const response = await fetch(
      `${baseUrl}/api/vendor/enquiries/${ENQUIRY_ID}`,
      {
        headers: {
          Authorization: "Bearer valid-test-token",
        },
      },
    );

    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.data.message, "Enquiry addressed to this vendor");
  } finally {
    await closeServer(server);
  }
});

// 5. Vendor cannot view an enquiry addressed to another vendor.
test("GET /api/vendor/enquiries/:id denies access to another vendor's enquiry", async (t) => {
  mockVendorAuthentication(t);

  t.mock.method(Enquiry, "findById", async () => ({
    _id: ENQUIRY_ID,
    vendorId: OTHER_VENDOR_ID,
    customerId: CUSTOMER_ID,
  }));

  const { server, baseUrl } = await startServer();

  try {
    const response = await fetch(
      `${baseUrl}/api/vendor/enquiries/${ENQUIRY_ID}`,
      {
        headers: {
          Authorization: "Bearer valid-test-token",
        },
      },
    );

    const body = await response.json();

    assert.equal(response.status, 403);
    assert.equal(body.success, false);
    assert.equal(
      body.message,
      "You are not authorized to view this enquiry",
    );
  } finally {
    await closeServer(server);
  }
});

// 6. Invalid enquiry ID is rejected.
test("GET /api/vendor/enquiries/:id rejects an invalid enquiry ID", async (t) => {
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
    assert.equal(body.message, "Invalid enquiry ID");
  } finally {
    await closeServer(server);
  }
});

// 7. Missing enquiry is returned as 404.
test("GET /api/vendor/enquiries/:id returns 404 when the enquiry does not exist", async (t) => {
  mockVendorAuthentication(t);

  t.mock.method(Enquiry, "findById", async () => null);

  const { server, baseUrl } = await startServer();

  try {
    const response = await fetch(
      `${baseUrl}/api/vendor/enquiries/${ENQUIRY_ID}`,
      {
        headers: {
          Authorization: "Bearer valid-test-token",
        },
      },
    );

    const body = await response.json();

    assert.equal(response.status, 404);
    assert.equal(body.success, false);
    assert.equal(body.message, "Enquiry not found");
  } finally {
    await closeServer(server);
  }
});

// 8. Vendor can change pending to viewed.
test("PATCH /api/vendor/enquiries/:id/status allows pending to viewed", async (t) => {
  mockVendorAuthentication(t);

  const existingEnquiry = {
    _id: ENQUIRY_ID,
    vendorId: VENDOR_ID,
    status: "pending",
  };

  const updatedEnquiry = {
    ...existingEnquiry,
    status: "viewed",
  };

  t.mock.method(Enquiry, "findOne", async (filter) => {
    assert.deepEqual(filter, {
      _id: ENQUIRY_ID,
      vendorId: VENDOR_ID,
    });

    return existingEnquiry;
  });

  let capturedFilter;
  let capturedUpdate;
  let capturedOptions;

  t.mock.method(
    Enquiry,
    "findOneAndUpdate",
    async (filter, update, options) => {
      capturedFilter = filter;
      capturedUpdate = update;
      capturedOptions = options;
      return updatedEnquiry;
    },
  );

  const { server, baseUrl } = await startServer();

  try {
    const response = await sendVendorStatusUpdate(baseUrl, "viewed");
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.data.status, "viewed");

    assert.deepEqual(capturedFilter, {
      _id: ENQUIRY_ID,
      vendorId: VENDOR_ID,
      status: "pending",
    });

    assert.equal(capturedUpdate.$set.status, "viewed");
    assert.ok(capturedUpdate.$set.statusUpdatedAt instanceof Date);
    assert.equal(capturedOptions.new, true);
    assert.equal(capturedOptions.runValidators, true);
  } finally {
    await closeServer(server);
  }
});

// 9. Vendor can accept an enquiry after it has been viewed.
test("PATCH /api/vendor/enquiries/:id/status allows viewed to accepted", async (t) => {
  mockVendorAuthentication(t);

  t.mock.method(Enquiry, "findOne", async () => ({
    _id: ENQUIRY_ID,
    vendorId: VENDOR_ID,
    status: "viewed",
  }));

  t.mock.method(Enquiry, "findOneAndUpdate", async () => ({
    _id: ENQUIRY_ID,
    vendorId: VENDOR_ID,
    status: "accepted",
  }));

  const { server, baseUrl } = await startServer();

  try {
    const response = await sendVendorStatusUpdate(baseUrl, "accepted");
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.data.status, "accepted");
  } finally {
    await closeServer(server);
  }
});

// 10. Vendor can reject an enquiry after it has been viewed.
test("PATCH /api/vendor/enquiries/:id/status allows viewed to rejected", async (t) => {
  mockVendorAuthentication(t);

  t.mock.method(Enquiry, "findOne", async () => ({
    _id: ENQUIRY_ID,
    vendorId: VENDOR_ID,
    status: "viewed",
  }));

  t.mock.method(Enquiry, "findOneAndUpdate", async () => ({
    _id: ENQUIRY_ID,
    vendorId: VENDOR_ID,
    status: "rejected",
  }));

  const { server, baseUrl } = await startServer();

  try {
    const response = await sendVendorStatusUpdate(baseUrl, "rejected");
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.data.status, "rejected");
  } finally {
    await closeServer(server);
  }
});

// 11. Vendor cannot directly accept a pending enquiry.
test("PATCH /api/vendor/enquiries/:id/status rejects pending to accepted", async (t) => {
  mockVendorAuthentication(t);

  t.mock.method(Enquiry, "findOne", async () => ({
    _id: ENQUIRY_ID,
    vendorId: VENDOR_ID,
    status: "pending",
  }));

  const updateMock = t.mock.method(
    Enquiry,
    "findOneAndUpdate",
    async () => null,
  );

  const { server, baseUrl } = await startServer();

  try {
    const response = await sendVendorStatusUpdate(baseUrl, "accepted");
    const body = await response.json();

    assert.equal(response.status, 409);
    assert.equal(body.success, false);
    assert.equal(updateMock.mock.callCount(), 0);
  } finally {
    await closeServer(server);
  }
});

// 12. Vendor cannot directly reject a pending enquiry.
test("PATCH /api/vendor/enquiries/:id/status rejects pending to rejected", async (t) => {
  mockVendorAuthentication(t);

  t.mock.method(Enquiry, "findOne", async () => ({
    _id: ENQUIRY_ID,
    vendorId: VENDOR_ID,
    status: "pending",
  }));

  const updateMock = t.mock.method(
    Enquiry,
    "findOneAndUpdate",
    async () => null,
  );

  const { server, baseUrl } = await startServer();

  try {
    const response = await sendVendorStatusUpdate(baseUrl, "rejected");
    const body = await response.json();

    assert.equal(response.status, 409);
    assert.equal(body.success, false);
    assert.equal(updateMock.mock.callCount(), 0);
  } finally {
    await closeServer(server);
  }
});

// 13. Vendor cannot set cancelled status.
test("PATCH /api/vendor/enquiries/:id/status rejects vendor cancellation", async (t) => {
  mockVendorAuthentication(t);

  const { server, baseUrl } = await startServer();

  try {
    const response = await sendVendorStatusUpdate(baseUrl, "cancelled");
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.equal(body.success, false);
  } finally {
    await closeServer(server);
  }
});

// 14. Accepted enquiries are final.
test("PATCH /api/vendor/enquiries/:id/status cannot change an accepted enquiry", async (t) => {
  mockVendorAuthentication(t);

  t.mock.method(Enquiry, "findOne", async () => ({
    _id: ENQUIRY_ID,
    vendorId: VENDOR_ID,
    status: "accepted",
  }));

  const updateMock = t.mock.method(
    Enquiry,
    "findOneAndUpdate",
    async () => null,
  );

  const { server, baseUrl } = await startServer();

  try {
    const response = await sendVendorStatusUpdate(baseUrl, "rejected");
    const body = await response.json();

    assert.equal(response.status, 409);
    assert.equal(body.success, false);
    assert.equal(updateMock.mock.callCount(), 0);
  } finally {
    await closeServer(server);
  }
});

// 15. Rejected enquiries are final.
test("PATCH /api/vendor/enquiries/:id/status cannot change a rejected enquiry", async (t) => {
  mockVendorAuthentication(t);

  t.mock.method(Enquiry, "findOne", async () => ({
    _id: ENQUIRY_ID,
    vendorId: VENDOR_ID,
    status: "rejected",
  }));

  const updateMock = t.mock.method(
    Enquiry,
    "findOneAndUpdate",
    async () => null,
  );

  const { server, baseUrl } = await startServer();

  try {
    const response = await sendVendorStatusUpdate(baseUrl, "viewed");
    const body = await response.json();

    assert.equal(response.status, 409);
    assert.equal(body.success, false);
    assert.equal(updateMock.mock.callCount(), 0);
  } finally {
    await closeServer(server);
  }
});

// 16. Vendor cannot update an enquiry belonging to another vendor.
test("PATCH /api/vendor/enquiries/:id/status denies another vendor's enquiry", async (t) => {
  mockVendorAuthentication(t);

  let capturedFilter;

  t.mock.method(Enquiry, "findOne", async (filter) => {
    capturedFilter = filter;
    return null;
  });

  const { server, baseUrl } = await startServer();

  try {
    const response = await sendVendorStatusUpdate(baseUrl, "viewed");
    const body = await response.json();

    assert.equal(response.status, 404);
    assert.equal(body.success, false);

    assert.deepEqual(capturedFilter, {
      _id: ENQUIRY_ID,
      vendorId: VENDOR_ID,
    });
  } finally {
    await closeServer(server);
  }
});

// 17. Invalid enquiry ID is rejected.
test("PATCH /api/vendor/enquiries/:id/status rejects an invalid enquiry ID", async (t) => {
  mockVendorAuthentication(t);

  const { server, baseUrl } = await startServer();

  try {
    const response = await sendVendorStatusUpdate(
      baseUrl,
      "viewed",
      "invalid-id",
    );
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.equal(body.success, false);
    assert.equal(body.message, "Invalid enquiry ID");
  } finally {
    await closeServer(server);
  }
});

// 18. Invalid status is rejected.
test("PATCH /api/vendor/enquiries/:id/status rejects an invalid status", async (t) => {
  mockVendorAuthentication(t);

  const { server, baseUrl } = await startServer();

  try {
    const response = await sendVendorStatusUpdate(baseUrl, "in_progress");
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.equal(body.success, false);
  } finally {
    await closeServer(server);
  }
});

// 19. Missing status is rejected.
test("PATCH /api/vendor/enquiries/:id/status rejects a missing status", async (t) => {
  mockVendorAuthentication(t);

  const { server, baseUrl } = await startServer();

  try {
    const response = await fetch(
      `${baseUrl}/api/vendor/enquiries/${ENQUIRY_ID}/status`,
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

// 20. Vendor cannot update a missing enquiry.
test("PATCH /api/vendor/enquiries/:id/status returns 404 for a missing enquiry", async (t) => {
  mockVendorAuthentication(t);

  t.mock.method(Enquiry, "findOne", async () => null);

  const { server, baseUrl } = await startServer();

  try {
    const response = await sendVendorStatusUpdate(baseUrl, "viewed");
    const body = await response.json();

    assert.equal(response.status, 404);
    assert.equal(body.success, false);
  } finally {
    await closeServer(server);
  }
});

// 21. Concurrent status changes cannot overwrite a newer status.
test("PATCH /api/vendor/enquiries/:id/status handles a concurrent status change", async (t) => {
  mockVendorAuthentication(t);

  t.mock.method(Enquiry, "findOne", async () => ({
    _id: ENQUIRY_ID,
    vendorId: VENDOR_ID,
    status: "pending",
  }));

  let capturedFilter;

  t.mock.method(
    Enquiry,
    "findOneAndUpdate",
    async (filter) => {
      capturedFilter = filter;
      return null;
    },
  );

  const { server, baseUrl } = await startServer();

  try {
    const response = await sendVendorStatusUpdate(baseUrl, "viewed");
    const body = await response.json();

    assert.equal(response.status, 409);
    assert.equal(body.success, false);

    assert.deepEqual(capturedFilter, {
      _id: ENQUIRY_ID,
      vendorId: VENDOR_ID,
      status: "pending",
    });
  } finally {
    await closeServer(server);
  }
});
