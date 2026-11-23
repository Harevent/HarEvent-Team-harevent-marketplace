const test = require("node:test");
const assert = require("node:assert/strict");

const Vendor = require("../models/Vendor");
const {
  requireApprovedVendor,
} = require("../middleware/requireApprovedVendor");

// --------------------------------------------------
// Test fixtures
// --------------------------------------------------

const authenticatedVendor = {
  userId: "user_123",
  firebaseUid: "firebase_uid_123",
  phoneNumber: "+919876543210",
  role: "vendor",
  accountStatus: "active",
  adminType: null,
  vendorId: "vendor_123",
  vendorStatus: "approved",
};

function createVendor(overrides = {}) {
  return {
    _id: "vendor_123",
    userId: "user_123",
    approvalStatus: "approved",
    isActive: true,
    deletedAt: null,
    ...overrides,
  };
}

// --------------------------------------------------
// Mock request and response objects
// --------------------------------------------------

function createMocks(options = {}) {
  const req = {
    user: Object.hasOwn(options, "user")
      ? options.user
      : { ...authenticatedVendor },

    body: options.body || {},
    query: options.query || {},
    headers: options.headers || {},
  };

  const res = {
    statusCode: null,
    responseBody: null,

    status(code) {
      this.statusCode = code;
      return this;
    },

    json(data) {
      this.responseBody = data;
      return this;
    },
  };

  const nextCalls = [];

  function next(error) {
    nextCalls.push(error);
  }

  return { req, res, next, nextCalls };
}

// --------------------------------------------------
// Mock Vendor.findOne()
// --------------------------------------------------

function mockVendorModel(t, options = {}) {
  const findOneImplementation =
    options.findOneImplementation ||
    (async () =>
      Object.hasOwn(options, "vendor") ? options.vendor : createVendor());

  return t.mock.method(Vendor, "findOne", findOneImplementation);
}

// --------------------------------------------------
// Execute middleware with mocked dependencies
// --------------------------------------------------

async function executeMiddleware(t, options = {}) {
  const findOneMock = mockVendorModel(t, options);

  const { req, res, next, nextCalls } = createMocks(options);

  await requireApprovedVendor(req, res, next);

  return {
    req,
    res,
    nextCalls,
    findOneMock,
  };
}

// --------------------------------------------------
// Common assertion for denied requests
// --------------------------------------------------

function assertDenied(result, expectedStatus) {
  assert.equal(result.res.statusCode, expectedStatus);
  assert.equal(result.res.responseBody.success, false);
  assert.equal(result.nextCalls.length, 0);
}

// ==================================================
// 1. AUTHENTICATION TESTS
// ==================================================

test("returns 401 when req.user is missing", async (t) => {
  const result = await executeMiddleware(t, {
    user: undefined,
  });

  assertDenied(result, 401);

  assert.equal(result.res.responseBody.message, "Authentication required.");

  // Vendor lookup must not happen without authentication.
  assert.equal(result.findOneMock.mock.callCount(), 0);
});

test("returns 401 when req.user is null", async (t) => {
  const result = await executeMiddleware(t, {
    user: null,
  });

  assertDenied(result, 401);

  assert.equal(result.findOneMock.mock.callCount(), 0);
});

// ==================================================
// 2. ROLE AUTHORIZATION TESTS
// ==================================================

test("returns 403 when the authenticated user is a customer", async (t) => {
  const result = await executeMiddleware(t, {
    user: {
      ...authenticatedVendor,
      role: "customer",
    },
  });

  assertDenied(result, 403);

  assert.equal(result.findOneMock.mock.callCount(), 0);
});

test("returns 403 when the authenticated user is an admin", async (t) => {
  const result = await executeMiddleware(t, {
    user: {
      ...authenticatedVendor,
      role: "admin",
      adminType: "admin",
    },
  });

  assertDenied(result, 403);

  assert.equal(result.findOneMock.mock.callCount(), 0);
});

// ==================================================
// 3. VENDOR PROFILE EXISTENCE TESTS
// ==================================================

test("returns 403 when the vendor profile does not exist", async (t) => {
  const result = await executeMiddleware(t, {
    vendor: null,
  });

  assertDenied(result, 403);

  assert.equal(result.res.responseBody.message, "Vendor profile not found.");
});

// ==================================================
// 4. VENDOR APPROVAL STATUS TESTS
// ==================================================

test("returns 403 when vendor approval status is pending", async (t) => {
  const result = await executeMiddleware(t, {
    vendor: createVendor({
      approvalStatus: "pending",
    }),
  });

  assertDenied(result, 403);

  assert.equal(result.res.responseBody.message, "Vendor approval required.");
});

test("returns 403 when vendor approval status is rejected", async (t) => {
  const result = await executeMiddleware(t, {
    vendor: createVendor({
      approvalStatus: "rejected",
    }),
  });

  assertDenied(result, 403);
});

test("returns 403 when vendor approval status is missing", async (t) => {
  const vendor = createVendor();

  delete vendor.approvalStatus;

  const result = await executeMiddleware(t, {
    vendor,
  });

  assertDenied(result, 403);
});

// ==================================================
// 5. VENDOR ACTIVITY STATUS TESTS
// ==================================================

test("returns 403 when vendor is inactive", async (t) => {
  const result = await executeMiddleware(t, {
    vendor: createVendor({
      isActive: false,
    }),
  });

  assertDenied(result, 403);

  assert.equal(result.res.responseBody.message, "Vendor account is inactive.");
});

test("returns 403 when vendor isActive is missing", async (t) => {
  const vendor = createVendor();

  delete vendor.isActive;

  const result = await executeMiddleware(t, {
    vendor,
  });

  assertDenied(result, 403);
});

test("returns 403 when vendor isActive is not boolean true", async (t) => {
  const result = await executeMiddleware(t, {
    vendor: createVendor({
      isActive: 1,
    }),
  });

  assertDenied(result, 403);
});

// ==================================================
// 6. SOFT-DELETION TESTS
// ==================================================

test("returns 403 when the vendor profile is soft-deleted", async (t) => {
  const result = await executeMiddleware(t, {
    vendor: createVendor({
      deletedAt: new Date("2026-01-01"),
    }),
  });

  assertDenied(result, 403);

  assert.equal(
    result.res.responseBody.message,
    "Vendor profile is no longer available.",
  );
});

test("allows a vendor when deletedAt is null", async (t) => {
  const result = await executeMiddleware(t, {
    vendor: createVendor({
      deletedAt: null,
    }),
  });

  assert.equal(result.nextCalls.length, 1);
  assert.equal(result.res.statusCode, null);
});

test("allows a vendor when deletedAt is undefined", async (t) => {
  const vendor = createVendor();

  delete vendor.deletedAt;

  const result = await executeMiddleware(t, {
    vendor,
  });

  assert.equal(result.nextCalls.length, 1);
  assert.equal(result.res.statusCode, null);
});

// ==================================================
// 7. AUTHENTICATED USER LOOKUP TEST
// ==================================================

test("looks up the vendor profile using the authenticated user's userId", async (t) => {
  const authenticatedUserId = "authenticated_user_456";

  const result = await executeMiddleware(t, {
    user: {
      ...authenticatedVendor,
      userId: authenticatedUserId,
    },
  });

  assert.equal(result.nextCalls.length, 1);

  assert.deepEqual(result.findOneMock.mock.calls[0].arguments[0], {
    userId: authenticatedUserId,
  });
});

// ==================================================
// 8. UNTRUSTED REQUEST DATA TESTS
// ==================================================

test("does not trust a vendor ID supplied in the request body", async (t) => {
  const result = await executeMiddleware(t, {
    body: {
      vendorId: "attacker_vendor_id",
      userId: "attacker_user_id",
    },
  });

  assert.equal(result.nextCalls.length, 1);

  assert.deepEqual(result.findOneMock.mock.calls[0].arguments[0], {
    userId: authenticatedVendor.userId,
  });
});

test("does not trust role or approval status supplied in the request body", async (t) => {
  const result = await executeMiddleware(t, {
    user: {
      ...authenticatedVendor,
      role: "customer",
    },
    body: {
      role: "vendor",
      approvalStatus: "approved",
      isActive: true,
    },
  });

  assertDenied(result, 403);

  assert.equal(result.findOneMock.mock.callCount(), 0);
});

test("does not trust vendor identity or status supplied in query parameters", async (t) => {
  const result = await executeMiddleware(t, {
    query: {
      userId: "attacker_user_id",
      vendorId: "attacker_vendor_id",
      approvalStatus: "approved",
      isActive: "true",
    },
  });

  assert.equal(result.nextCalls.length, 1);

  assert.deepEqual(result.findOneMock.mock.calls[0].arguments[0], {
    userId: authenticatedVendor.userId,
  });
});

test("does not trust role or vendor status supplied in request headers", async (t) => {
  const result = await executeMiddleware(t, {
    headers: {
      role: "customer",
      "x-vendor-id": "attacker_vendor_id",
      "x-vendor-status": "approved",
    },
  });

  assert.equal(result.nextCalls.length, 1);

  assert.deepEqual(result.findOneMock.mock.calls[0].arguments[0], {
    userId: authenticatedVendor.userId,
  });
});

// ==================================================
// 9. SUCCESSFUL AUTHORIZATION TESTS
// ==================================================

test("allows an approved, active and non-deleted vendor", async (t) => {
  const result = await executeMiddleware(t, {
    vendor: createVendor({
      approvalStatus: "approved",
      isActive: true,
      deletedAt: null,
    }),
  });

  assert.equal(result.nextCalls.length, 1);
  assert.equal(result.res.statusCode, null);
  assert.equal(result.res.responseBody, null);
});

test("calls next() exactly once when authorization succeeds", async (t) => {
  const result = await executeMiddleware(t);

  assert.equal(result.nextCalls.length, 1);
  assert.equal(result.nextCalls[0], undefined);
});

// ==================================================
// 10. DATABASE ERROR TEST
// ==================================================

test("passes Vendor.findOne() database errors to next(error)", async (t) => {
  const databaseError = new Error("Database connection failed");

  const result = await executeMiddleware(t, {
    findOneImplementation: async () => {
      throw databaseError;
    },
  });

  assert.equal(result.res.statusCode, null);
  assert.equal(result.res.responseBody, null);
  assert.equal(result.nextCalls.length, 1);
  assert.equal(result.nextCalls[0], databaseError);
});

// ==================================================
// REFERENCE GUIDE
// ==================================================

/*
TEST REFERENCE GUIDE
--------------------

1. Authentication
   - Missing req.user returns 401.
   - Null req.user returns 401.
   - Vendor lookup does not happen without authentication.

2. Role authorization
   - Customer accounts are rejected.
   - Admin accounts are rejected.
   - Only req.user.role === "vendor" can continue.

3. Vendor profile existence
   - Missing Vendor profile returns 403.

4. Approval status
   - Pending vendors are rejected.
   - Rejected vendors are rejected.
   - Missing approvalStatus is rejected.
   - Only approvalStatus === "approved" is accepted.

5. Activity status
   - isActive === false is rejected.
   - Missing isActive is rejected.
   - Values other than boolean true are rejected.

6. Soft deletion
   - A non-null and non-undefined deletedAt is rejected.
   - deletedAt === null is accepted.
   - deletedAt === undefined is accepted.

7. Trusted identity
   - Vendor.findOne() uses req.user.userId.
   - Client-supplied vendor IDs are ignored.
   - Client-supplied roles and status values are ignored.

8. Successful authorization
   - Approved, active and non-deleted vendor is allowed.
   - next() is called exactly once.

9. Database errors
   - Unexpected errors are passed to next(error).
   - They are not converted into 401 or 403 responses.

10. Test isolation
    - Vendor.findOne() is mocked with t.mock.method().
    - Node's test context restores mocks after each test.
    - No MongoDB or Firebase connection is required.

RUN COMMAND
-----------
node --test test/requireApprovedVendor.test.js
*/
