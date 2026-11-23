const test = require("node:test");
const assert = require("node:assert/strict");

const Vendor = require("../models/Vendor");
const { requireVendorProfile } = require("../middleware/requireVendorProfile");

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
  vendorStatus: "pending",
};

function createVendor(overrides = {}) {
  return {
    _id: "vendor_123",
    userId: "user_123",
    approvalStatus: "pending",
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

  await requireVendorProfile(req, res, next);

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
});

test("returns 403 when the vendor profile is soft-deleted", async (t) => {
  const result = await executeMiddleware(t, {
    vendor: createVendor({
      deletedAt: new Date("2026-01-01"),
    }),
  });

  assertDenied(result, 403);
});

test("allows a vendor profile when deletedAt is null", async (t) => {
  const result = await executeMiddleware(t, {
    vendor: createVendor({
      deletedAt: null,
    }),
  });

  assert.equal(result.nextCalls.length, 1);
  assert.equal(result.res.statusCode, null);
});

test("allows a vendor profile when deletedAt is undefined", async (t) => {
  const vendor = createVendor();

  delete vendor.deletedAt;

  const result = await executeMiddleware(t, {
    vendor,
  });

  assert.equal(result.nextCalls.length, 1);
  assert.equal(result.res.statusCode, null);
});

// ==================================================
// 4. VENDOR APPROVAL AND ACTIVITY TESTS
// ==================================================

test("allows a vendor whose approval status is pending", async (t) => {
  const result = await executeMiddleware(t, {
    vendor: createVendor({
      approvalStatus: "pending",
      isActive: true,
    }),
  });

  assert.equal(result.nextCalls.length, 1);
  assert.equal(result.res.statusCode, null);
});

test("allows a vendor whose approval status is rejected", async (t) => {
  const result = await executeMiddleware(t, {
    vendor: createVendor({
      approvalStatus: "rejected",
      isActive: true,
    }),
  });

  assert.equal(result.nextCalls.length, 1);
  assert.equal(result.res.statusCode, null);
});

test("allows an inactive vendor to access permitted profile functionality", async (t) => {
  const result = await executeMiddleware(t, {
    vendor: createVendor({
      approvalStatus: "approved",
      isActive: false,
    }),
  });

  assert.equal(result.nextCalls.length, 1);
  assert.equal(result.res.statusCode, null);
});

test("allows an approved and active vendor with a non-deleted profile", async (t) => {
  const result = await executeMiddleware(t, {
    vendor: createVendor({
      approvalStatus: "approved",
      isActive: true,
      deletedAt: null,
    }),
  });

  assert.equal(result.nextCalls.length, 1);
  assert.equal(result.res.statusCode, null);
});

// ==================================================
// 5. AUTHENTICATED USER LOOKUP TEST
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
// 6. DATABASE ERROR TEST
// ==================================================

test("passes Vendor.findOne() database errors to next(error)", async (t) => {
  const databaseError = new Error("Database connection failed");

  const result = await executeMiddleware(t, {
    findOneImplementation: async () => {
      throw databaseError;
    },
  });

  assert.equal(result.res.statusCode, null);
  assert.equal(result.nextCalls.length, 1);
  assert.equal(result.nextCalls[0], databaseError);
});

test("calls next() exactly once when vendor profile access is allowed", async (t) => {
  const result = await executeMiddleware(t, {
    vendor: createVendor({
      approvalStatus: "approved",
      isActive: true,
      deletedAt: null,
    }),
  });

  assert.equal(result.nextCalls.length, 1);
  assert.equal(result.nextCalls[0], undefined);
  assert.equal(result.res.statusCode, null);
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
   - Vendor lookup is not performed without authentication.

2. Role authorization
   - Customer accounts are rejected.
   - Admin accounts are rejected.
   - Only req.user.role === "vendor" can continue.

3. Vendor profile existence
   - Missing Vendor profile is rejected.
   - Soft-deleted Vendor profile is rejected.
   - deletedAt === null is accepted.
   - deletedAt === undefined is accepted.

4. Approval and activity
   - Pending vendors are allowed.
   - Rejected vendors are allowed.
   - Inactive vendors are allowed limited profile access.
   - Approved and active vendors are allowed.

5. Trusted user lookup
   - Vendor.findOne() must use req.user.userId.
   - The lookup must not depend on client-supplied IDs.

6. Database error handling
   - Unexpected database errors are passed to next(error).
   - The middleware must not convert unexpected errors into
     authentication or authorization responses.

7. Test isolation
   - node:test manages the t.mock.method() mocks.
   - Each test receives its own test context.
   - No real MongoDB or Firebase connection is required.

RUN COMMAND
-----------
node --test test/requireVendorProfile.test.js

EXPECTED RESULT
---------------
15 tests
0 failures
*/
