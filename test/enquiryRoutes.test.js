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
const EventType = require("../models/EventType");
const Category = require("../models/Category");
const Enquiry = require("../models/Enquiry");

const app = require("../app");

const USER_ID = "507f1f77bcf86cd799439012";
const CUSTOMER_ID = "507f1f77bcf86cd799439013";
const VENDOR_ID = "507f1f77bcf86cd799439014";
const EVENT_TYPE_ID = "507f1f77bcf86cd799439015";
const CATEGORY_ID = "507f1f77bcf86cd799439016";
const SERVICE_ID = "507f1f77bcf86cd799439017";
const ENQUIRY_ID = "507f1f77bcf86cd799439018";
const OTHER_VENDOR_ID = "507f1f77bcf86cd799439019";
const OTHER_CUSTOMER_ID = "507f1f77bcf86cd799439020";

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

function createValidEnquiryRequest() {
  return {
    vendorId: VENDOR_ID,
    eventTypeId: EVENT_TYPE_ID,
    eventDate: "2027-05-15",
    eventLocation: "Mumbai",
    guestCount: 100,
    budget: 50000,
    message: "Please share your quotation.",
  };
}

function createValidVendor() {
  return {
    _id: VENDOR_ID,
    approvalStatus: "approved",
    isActive: true,
    deletedAt: null,
    eventTypeIds: [EVENT_TYPE_ID],
    categoryIds: [CATEGORY_ID],
    selectedCategories: [],
  };
}

function mockValidEnquiryDependencies(t) {
  mockCustomerAuthentication(t);

  t.mock.method(User, "findById", async () => ({
    _id: USER_ID,
    fullName: "Test Customer",
    phoneNumber: "+911234567890",
    email: "customer@example.com",
  }));

  t.mock.method(Vendor, "findOne", async () => createValidVendor());

  t.mock.method(EventType, "findOne", () => ({
    select: async () => ({
      _id: EVENT_TYPE_ID,
      vendorCategoryIds: [CATEGORY_ID],
    }),
  }));

  t.mock.method(Enquiry, "create", async (data) => ({
    _id: ENQUIRY_ID,
    ...data,
  }));
}

// 1. Unauthenticated request.
test("GET /api/enquiries/my returns 401 without authentication", async () => {
  const { server, baseUrl } = await startServer();

  try {
    const response = await fetch(`${baseUrl}/api/enquiries/my`);
    const body = await response.json();

    assert.equal(response.status, 401);
    assert.equal(body.success, false);
  } finally {
    await closeServer(server);
  }
});

// 2. Customer can retrieve their enquiries.
test("GET /api/enquiries/my returns enquiries belonging to the authenticated customer", async (t) => {
  mockCustomerAuthentication(t);

  const enquiryData = [
    {
      _id: "507f1f77bcf86cd799439021",
      customerId: CUSTOMER_ID,
      message: "Recent enquiry",
    },
    {
      _id: "507f1f77bcf86cd799439022",
      customerId: CUSTOMER_ID,
      message: "Older enquiry",
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
    const response = await fetch(`${baseUrl}/api/enquiries/my`, {
      headers: {
        Authorization: "Bearer valid-test-token",
      },
    });

    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.data.length, 2);
    assert.equal(body.data[0].message, "Recent enquiry");

    assert.deepEqual(capturedFilter, {
      customerId: CUSTOMER_ID,
    });

    assert.deepEqual(capturedSort, {
      createdAt: -1,
    });
  } finally {
    await closeServer(server);
  }
});

// 3. Vendor account cannot access customer enquiries.
test("GET /api/enquiries/my rejects a vendor account", async (t) => {
  t.mock.method(firebaseAuth, "verifyIdToken", async () => ({
    uid: "firebase-vendor-001",
    phone_number: "+911234567890",
  }));

  t.mock.method(User, "findOne", async () => ({
    _id: USER_ID,
    firebaseUid: "firebase-vendor-001",
    phoneNumber: "+911234567890",
    role: "vendor",
    accountStatus: "active",
  }));

  t.mock.method(Vendor, "findOne", async () => null);

  const { server, baseUrl } = await startServer();

  try {
    const response = await fetch(`${baseUrl}/api/enquiries/my`, {
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

// 4. Customer profile is required for authentication.
test("GET /api/enquiries/my rejects a customer without a customer profile", async (t) => {
  t.mock.method(firebaseAuth, "verifyIdToken", async () => ({
    uid: "firebase-customer-002",
    phone_number: "+911234567891",
  }));

  t.mock.method(User, "findOne", async () => ({
    _id: USER_ID,
    firebaseUid: "firebase-customer-002",
    phoneNumber: "+911234567891",
    role: "customer",
    accountStatus: "active",
  }));

  t.mock.method(Customer, "findOne", async () => null);

  const { server, baseUrl } = await startServer();

  try {
    const response = await fetch(`${baseUrl}/api/enquiries/my`, {
      headers: {
        Authorization: "Bearer valid-test-token",
      },
    });

    const body = await response.json();

    assert.equal(response.status, 403);
    assert.equal(body.success, false);
    assert.equal(body.message, "Customer profile is incomplete.");
  } finally {
    await closeServer(server);
  }
});

// 5. Customer can successfully create an enquiry.
test("POST /api/enquiries creates an enquiry successfully", async (t) => {
  mockValidEnquiryDependencies(t);

  let capturedEnquiry;

  t.mock.method(Enquiry, "create", async (data) => {
    capturedEnquiry = data;

    return {
      _id: ENQUIRY_ID,
      ...data,
    };
  });

  const { server, baseUrl } = await startServer();

  try {
    const response = await fetch(`${baseUrl}/api/enquiries`, {
      method: "POST",
      headers: {
        Authorization: "Bearer valid-test-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(createValidEnquiryRequest()),
    });

    const body = await response.json();

    assert.equal(response.status, 201);
    assert.equal(body.success, true);
    assert.equal(body.message, "Enquiry created successfully");

    assert.equal(capturedEnquiry.customerId, CUSTOMER_ID);
    assert.equal(capturedEnquiry.vendorId, VENDOR_ID);
    assert.equal(capturedEnquiry.customerNameSnapshot, "Test Customer");
    assert.equal(capturedEnquiry.customerPhoneSnapshot, "+911234567890");
    assert.equal(capturedEnquiry.email, "customer@example.com");
    assert.equal(capturedEnquiry.status, "pending");
    assert.equal(capturedEnquiry.budget, 50000);
  } finally {
    await closeServer(server);
  }
});

// 6. Invalid request data is rejected.
test("POST /api/enquiries rejects invalid request data", async (t) => {
  mockCustomerAuthentication(t);

  const invalidRequest = {
    vendorId: "invalid-id",
    eventTypeId: EVENT_TYPE_ID,
    eventDate: "invalid-date",
    budget: -100,
  };

  const { server, baseUrl } = await startServer();

  try {
    const response = await fetch(`${baseUrl}/api/enquiries`, {
      method: "POST",
      headers: {
        Authorization: "Bearer valid-test-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(invalidRequest),
    });

    const body = await response.json();

    assert.equal(response.status, 400);
    assert.equal(body.success, false);
    assert.equal(body.message, "Validation failed");
    assert.ok(Array.isArray(body.errors));
    assert.ok(body.errors.length > 0);
  } finally {
    await closeServer(server);
  }
});

// 7. Unavailable vendor is rejected.
test("POST /api/enquiries rejects an unavailable vendor", async (t) => {
  mockCustomerAuthentication(t);

  t.mock.method(User, "findById", async () => ({
    _id: USER_ID,
    fullName: "Test Customer",
    phoneNumber: "+911234567890",
    email: "customer@example.com",
  }));

  t.mock.method(Vendor, "findOne", async () => null);

  const { server, baseUrl } = await startServer();

  try {
    const response = await fetch(`${baseUrl}/api/enquiries`, {
      method: "POST",
      headers: {
        Authorization: "Bearer valid-test-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(createValidEnquiryRequest()),
    });

    const body = await response.json();

    assert.equal(response.status, 404);
    assert.equal(body.success, false);
    assert.equal(body.message, "Vendor not found or unavailable");
  } finally {
    await closeServer(server);
  }
});

// 8. Unavailable event type is rejected.
test("POST /api/enquiries rejects an unavailable event type", async (t) => {
  mockCustomerAuthentication(t);

  t.mock.method(User, "findById", async () => ({
    _id: USER_ID,
    fullName: "Test Customer",
    phoneNumber: "+911234567890",
    email: "customer@example.com",
  }));

  t.mock.method(Vendor, "findOne", async () => createValidVendor());

  t.mock.method(EventType, "findOne", () => ({
    select: async () => null,
  }));

  const { server, baseUrl } = await startServer();

  try {
    const response = await fetch(`${baseUrl}/api/enquiries`, {
      method: "POST",
      headers: {
        Authorization: "Bearer valid-test-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(createValidEnquiryRequest()),
    });

    const body = await response.json();

    assert.equal(response.status, 400);
    assert.equal(body.success, false);
    assert.equal(body.message, "Selected event type is unavailable");
  } finally {
    await closeServer(server);
  }
});

// 9. Vendor must provide the selected event type.
test("POST /api/enquiries rejects an event type not provided by the vendor", async (t) => {
  mockCustomerAuthentication(t);

  t.mock.method(User, "findById", async () => ({
    _id: USER_ID,
    fullName: "Test Customer",
    phoneNumber: "+911234567890",
    email: "customer@example.com",
  }));

  t.mock.method(Vendor, "findOne", async () => ({
    ...createValidVendor(),
    eventTypeIds: [],
  }));

  t.mock.method(EventType, "findOne", () => ({
    select: async () => ({
      _id: EVENT_TYPE_ID,
      vendorCategoryIds: [CATEGORY_ID],
    }),
  }));

  const { server, baseUrl } = await startServer();

  try {
    const response = await fetch(`${baseUrl}/api/enquiries`, {
      method: "POST",
      headers: {
        Authorization: "Bearer valid-test-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(createValidEnquiryRequest()),
    });

    const body = await response.json();

    assert.equal(response.status, 400);
    assert.equal(body.success, false);
    assert.equal(
      body.message,
      "This vendor does not provide the selected event type",
    );
  } finally {
    await closeServer(server);
  }
});

// 10. Vendor must offer every requested service.
test("POST /api/enquiries rejects a service not offered by the vendor", async (t) => {
  mockCustomerAuthentication(t);

  t.mock.method(User, "findById", async () => ({
    _id: USER_ID,
    fullName: "Test Customer",
    phoneNumber: "+911234567890",
    email: "customer@example.com",
  }));

  t.mock.method(Vendor, "findOne", async () => createValidVendor());

  t.mock.method(EventType, "findOne", () => ({
    select: async () => ({
      _id: EVENT_TYPE_ID,
      vendorCategoryIds: [CATEGORY_ID],
    }),
  }));

  const request = {
    ...createValidEnquiryRequest(),
    requiredServices: [SERVICE_ID],
  };

  const { server, baseUrl } = await startServer();

  try {
    const response = await fetch(`${baseUrl}/api/enquiries`, {
      method: "POST",
      headers: {
        Authorization: "Bearer valid-test-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    });

    const body = await response.json();

    assert.equal(response.status, 400);
    assert.equal(body.success, false);
    assert.equal(
      body.message,
      "One or more selected services are not offered by this vendor",
    );
    assert.deepEqual(body.unavailableServices, [SERVICE_ID]);
  } finally {
    await closeServer(server);
  }
});

// 11. Customer can view their own enquiry.
test("GET /api/enquiries/:id allows a customer to view their own enquiry", async (t) => {
  mockCustomerAuthentication(t);

  t.mock.method(Enquiry, "findById", async () => ({
    _id: ENQUIRY_ID,
    customerId: CUSTOMER_ID,
    vendorId: VENDOR_ID,
    message: "My enquiry",
  }));

  const { server, baseUrl } = await startServer();

  try {
    const response = await fetch(`${baseUrl}/api/enquiries/${ENQUIRY_ID}`, {
      headers: {
        Authorization: "Bearer valid-test-token",
      },
    });

    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.data.message, "My enquiry");
  } finally {
    await closeServer(server);
  }
});

// 12. Customer cannot view another customer's enquiry.
test("GET /api/enquiries/:id denies a customer access to another customer's enquiry", async (t) => {
  mockCustomerAuthentication(t);

  t.mock.method(Enquiry, "findById", async () => ({
    _id: ENQUIRY_ID,
    customerId: OTHER_CUSTOMER_ID,
    vendorId: VENDOR_ID,
  }));

  const { server, baseUrl } = await startServer();

  try {
    const response = await fetch(`${baseUrl}/api/enquiries/${ENQUIRY_ID}`, {
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

// 13. Vendor can view an enquiry addressed to them.
test("GET /api/enquiries/:id allows a vendor to view their enquiry", async (t) => {
  mockVendorAuthentication(t);

  t.mock.method(Enquiry, "findById", async () => ({
    _id: ENQUIRY_ID,
    customerId: CUSTOMER_ID,
    vendorId: VENDOR_ID,
    message: "Enquiry for this vendor",
  }));

  const { server, baseUrl } = await startServer();

  try {
    const response = await fetch(`${baseUrl}/api/enquiries/${ENQUIRY_ID}`, {
      headers: {
        Authorization: "Bearer valid-test-token",
      },
    });

    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.data.message, "Enquiry for this vendor");
  } finally {
    await closeServer(server);
  }
});

// 14. Vendor cannot view another vendor's enquiry.
test("GET /api/enquiries/:id denies a vendor access to another vendor's enquiry", async (t) => {
  mockVendorAuthentication(t);

  t.mock.method(Enquiry, "findById", async () => ({
    _id: ENQUIRY_ID,
    customerId: CUSTOMER_ID,
    vendorId: OTHER_VENDOR_ID,
  }));

  const { server, baseUrl } = await startServer();

  try {
    const response = await fetch(`${baseUrl}/api/enquiries/${ENQUIRY_ID}`, {
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

// 15. Invalid enquiry ID is rejected.
test("GET /api/enquiries/:id rejects an invalid enquiry ID", async (t) => {
  mockCustomerAuthentication(t);

  const { server, baseUrl } = await startServer();

  try {
    const response = await fetch(`${baseUrl}/api/enquiries/invalid-id`, {
      headers: {
        Authorization: "Bearer valid-test-token",
      },
    });

    const body = await response.json();

    assert.equal(response.status, 400);
    assert.equal(body.success, false);
    assert.equal(body.message, "Invalid enquiry ID");
  } finally {
    await closeServer(server);
  }
});

// 16. Missing enquiry is returned as 404.
test("GET /api/enquiries/:id returns 404 when the enquiry does not exist", async (t) => {
  mockCustomerAuthentication(t);

  t.mock.method(Enquiry, "findById", async () => null);

  const { server, baseUrl } = await startServer();

  try {
    const response = await fetch(`${baseUrl}/api/enquiries/${ENQUIRY_ID}`, {
      headers: {
        Authorization: "Bearer valid-test-token",
      },
    });

    const body = await response.json();

    assert.equal(response.status, 404);
    assert.equal(body.success, false);
    assert.equal(body.message, "Enquiry not found");
  } finally {
    await closeServer(server);
  }
});

// 17. Customer can cancel their own pending enquiry.
test("PATCH /api/enquiries/:id/cancel cancels a pending enquiry", async (t) => {
  mockCustomerAuthentication(t);

  t.mock.method(Enquiry, "findById", async () => ({
    _id: ENQUIRY_ID,
    customerId: CUSTOMER_ID,
    status: "pending",
  }));

  let capturedFilter;
  let capturedUpdate;

  t.mock.method(Enquiry, "findOneAndUpdate", async (filter, update) => {
    capturedFilter = filter;
    capturedUpdate = update;

    return {
      _id: ENQUIRY_ID,
      customerId: CUSTOMER_ID,
      status: "cancelled",
    };
  });

  const { server, baseUrl } = await startServer();

  try {
    const response = await fetch(
      `${baseUrl}/api/enquiries/${ENQUIRY_ID}/cancel`,
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
    assert.equal(body.message, "Enquiry cancelled successfully");
    assert.equal(body.data.status, "cancelled");

    assert.deepEqual(capturedFilter, {
      _id: ENQUIRY_ID,
      customerId: CUSTOMER_ID,
      status: "pending",
    });

    assert.equal(capturedUpdate.$set.status, "cancelled");
    assert.ok(capturedUpdate.$set.statusUpdatedAt instanceof Date);
  } finally {
    await closeServer(server);
  }
});

// 18. Customer cannot cancel another customer's enquiry.
test("PATCH /api/enquiries/:id/cancel denies another customer's enquiry", async (t) => {
  mockCustomerAuthentication(t);

  t.mock.method(Enquiry, "findById", async () => ({
    _id: ENQUIRY_ID,
    customerId: OTHER_CUSTOMER_ID,
    status: "pending",
  }));

  const updateMock = t.mock.method(
    Enquiry,
    "findOneAndUpdate",
    async () => null,
  );

  const { server, baseUrl } = await startServer();

  try {
    const response = await fetch(
      `${baseUrl}/api/enquiries/${ENQUIRY_ID}/cancel`,
      {
        method: "PATCH",
        headers: {
          Authorization: "Bearer valid-test-token",
        },
      },
    );

    const body = await response.json();

    assert.equal(response.status, 403);
    assert.equal(body.success, false);
    assert.equal(updateMock.mock.callCount(), 0);
  } finally {
    await closeServer(server);
  }
});

// 19. Customer cannot cancel a viewed enquiry.
test("PATCH /api/enquiries/:id/cancel rejects a viewed enquiry", async (t) => {
  mockCustomerAuthentication(t);

  t.mock.method(Enquiry, "findById", async () => ({
    _id: ENQUIRY_ID,
    customerId: CUSTOMER_ID,
    status: "viewed",
  }));

  const updateMock = t.mock.method(
    Enquiry,
    "findOneAndUpdate",
    async () => null,
  );

  const { server, baseUrl } = await startServer();

  try {
    const response = await fetch(
      `${baseUrl}/api/enquiries/${ENQUIRY_ID}/cancel`,
      {
        method: "PATCH",
        headers: {
          Authorization: "Bearer valid-test-token",
        },
      },
    );

    const body = await response.json();

    assert.equal(response.status, 409);
    assert.equal(body.success, false);
    assert.equal(updateMock.mock.callCount(), 0);
  } finally {
    await closeServer(server);
  }
});

// 20. Customer cannot cancel an accepted enquiry.
test("PATCH /api/enquiries/:id/cancel rejects an accepted enquiry", async (t) => {
  mockCustomerAuthentication(t);

  t.mock.method(Enquiry, "findById", async () => ({
    _id: ENQUIRY_ID,
    customerId: CUSTOMER_ID,
    status: "accepted",
  }));

  const updateMock = t.mock.method(
    Enquiry,
    "findOneAndUpdate",
    async () => null,
  );

  const { server, baseUrl } = await startServer();

  try {
    const response = await fetch(
      `${baseUrl}/api/enquiries/${ENQUIRY_ID}/cancel`,
      {
        method: "PATCH",
        headers: {
          Authorization: "Bearer valid-test-token",
        },
      },
    );

    const body = await response.json();

    assert.equal(response.status, 409);
    assert.equal(body.success, false);
    assert.equal(updateMock.mock.callCount(), 0);
  } finally {
    await closeServer(server);
  }
});

// 21. Invalid enquiry ID is rejected.
test("PATCH /api/enquiries/:id/cancel rejects an invalid enquiry ID", async (t) => {
  mockCustomerAuthentication(t);

  const { server, baseUrl } = await startServer();

  try {
    const response = await fetch(
      `${baseUrl}/api/enquiries/invalid-id/cancel`,
      {
        method: "PATCH",
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

// 22. Missing enquiry returns 404.
test("PATCH /api/enquiries/:id/cancel returns 404 for a missing enquiry", async (t) => {
  mockCustomerAuthentication(t);

  t.mock.method(Enquiry, "findById", async () => null);

  const { server, baseUrl } = await startServer();

  try {
    const response = await fetch(
      `${baseUrl}/api/enquiries/${ENQUIRY_ID}/cancel`,
      {
        method: "PATCH",
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

// 23. Concurrent status change prevents customer cancellation.
test("PATCH /api/enquiries/:id/cancel handles a concurrent status change", async (t) => {
  mockCustomerAuthentication(t);

  t.mock.method(Enquiry, "findById", async () => ({
    _id: ENQUIRY_ID,
    customerId: CUSTOMER_ID,
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
    const response = await fetch(
      `${baseUrl}/api/enquiries/${ENQUIRY_ID}/cancel`,
      {
        method: "PATCH",
        headers: {
          Authorization: "Bearer valid-test-token",
        },
      },
    );

    const body = await response.json();

    assert.equal(response.status, 409);
    assert.equal(body.success, false);
    assert.equal(
      body.message,
      "This enquiry can no longer be cancelled",
    );

    assert.deepEqual(capturedFilter, {
      _id: ENQUIRY_ID,
      customerId: CUSTOMER_ID,
      status: "pending",
    });
  } finally {
    await closeServer(server);
  }
});
