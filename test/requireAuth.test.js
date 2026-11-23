const test = require("node:test");
const assert = require("node:assert/strict");

const User = require("../models/User");
const Customer = require("../models/Customer");
const Vendor = require("../models/Vendor");
const Admin = require("../models/Admin");

const { requireAuth } = require("../middleware/requireAuth");

// --------------------------------------------------
// Test fixtures
// --------------------------------------------------

const firebaseIdentity = {
  firebaseUid: "firebase-test-uid",
  phoneNumber: "+911234567890",
};

function createUser(overrides = {}) {
  return {
    _id: "mongodb-user-id",
    firebaseUid: firebaseIdentity.firebaseUid,
    phoneNumber: firebaseIdentity.phoneNumber,
    fullName: "Test User",
    role: "customer",
    accountStatus: "active",
    ...overrides,
  };
}

function createCustomer(overrides = {}) {
  return {
    _id: "mongodb-customer-id",
    userId: "mongodb-user-id",
    city: "Akola",
    ...overrides,
  };
}

function createVendor(overrides = {}) {
  return {
    _id: "mongodb-vendor-id",
    userId: "mongodb-user-id",
    approvalStatus: "pending",
    isActive: false,
    deletedAt: null,
    ...overrides,
  };
}

function createAdmin(overrides = {}) {
  return {
    _id: "mongodb-admin-id",
    userId: "mongodb-user-id",
    adminType: "admin",
    ...overrides,
  };
}

// --------------------------------------------------
// Mock all four Mongoose models
// --------------------------------------------------

function mockModels(t, options = {}) {
  const user = options.user === undefined ? createUser() : options.user;

  const customer =
    options.customer === undefined ? createCustomer() : options.customer;

  const vendor = options.vendor === undefined ? createVendor() : options.vendor;

  const admin = options.admin === undefined ? createAdmin() : options.admin;

  const userFindOne = t.mock.method(
    User,
    "findOne",
    options.userFindOne || (async () => user),
  );

  const customerFindOne = t.mock.method(
    Customer,
    "findOne",
    options.customerFindOne || (async () => customer),
  );

  const vendorFindOne = t.mock.method(
    Vendor,
    "findOne",
    options.vendorFindOne || (async () => vendor),
  );

  const adminFindOne = t.mock.method(
    Admin,
    "findOne",
    options.adminFindOne || (async () => admin),
  );

  return {
    userFindOne,
    customerFindOne,
    vendorFindOne,
    adminFindOne,
  };
}

// --------------------------------------------------
// Request and response helpers
// --------------------------------------------------

async function executeMiddleware(t, options = {}) {
  const models = mockModels(t, options);

  const req = {
    headers: {},
    body: options.body || {},

    firebaseUser: Object.hasOwn(options, "firebaseUser")
      ? options.firebaseUser
      : { ...firebaseIdentity },
  };

  if (options.preexistingUser) {
    req.user = options.preexistingUser;
  }

  const res = {
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

  const nextCalls = [];

  await requireAuth(req, res, (error) => {
    nextCalls.push(error);
  });

  return { req, res, nextCalls, models };
}

function assertDenied(result, statusCode) {
  assert.equal(result.res.statusCode, statusCode);
  assert.equal(result.nextCalls.length, 0);

  assert.equal(
    Object.hasOwn(result.req, "user"),
    false,
    "Failed authentication must not populate req.user",
  );
}

// ==================================================
// A. Authentication and Firebase identity
// ==================================================

test("missing Firebase identity returns 401", async (t) => {
  const result = await executeMiddleware(t, {
    firebaseUser: undefined,
    preexistingUser: { role: "admin" },
  });

  assertDenied(result, 401);
});

test("missing Firebase UID returns 401", async (t) => {
  const result = await executeMiddleware(t, {
    firebaseUser: {
      phoneNumber: firebaseIdentity.phoneNumber,
    },
  });

  assertDenied(result, 401);
});

test("empty Firebase UID returns 401", async (t) => {
  const result = await executeMiddleware(t, {
    firebaseUser: {
      firebaseUid: " ",
      phoneNumber: firebaseIdentity.phoneNumber,
    },
  });

  assertDenied(result, 401);
});

test("missing verified phone number returns 401", async (t) => {
  const result = await executeMiddleware(t, {
    firebaseUser: {
      firebaseUid: firebaseIdentity.firebaseUid,
    },
  });

  assertDenied(result, 401);
});

test("empty verified phone number returns 401", async (t) => {
  const result = await executeMiddleware(t, {
    firebaseUser: {
      firebaseUid: firebaseIdentity.firebaseUid,
      phoneNumber: " ",
    },
  });

  assertDenied(result, 401);
});

test("non-string Firebase identity fields return 401", async (t) => {
  const result = await executeMiddleware(t, {
    firebaseUser: {
      firebaseUid: 12345,
      phoneNumber: firebaseIdentity.phoneNumber,
    },
  });

  assertDenied(result, 401);
});

test("User is looked up using Firebase UID", async (t) => {
  const { req, models } = await executeMiddleware(t);

  assert.equal(req.user.firebaseUid, firebaseIdentity.firebaseUid);

  assert.deepEqual(models.userFindOne.mock.calls[0].arguments[0], {
    firebaseUid: firebaseIdentity.firebaseUid,
  });
});

// ==================================================
// B. User lookup and identity consistency
// ==================================================

test("unregistered application user returns 401", async (t) => {
  const result = await executeMiddleware(t, {
    user: null,
    preexistingUser: { role: "admin" },
  });

  assertDenied(result, 401);
});

test("phone mismatch returns 401", async (t) => {
  const result = await executeMiddleware(t, {
    user: createUser({
      phoneNumber: "+919999999999",
    }),
  });

  assertDenied(result, 401);
});

test("matching Firebase UID and phone allow processing", async (t) => {
  const { req, nextCalls } = await executeMiddleware(t);

  assert.equal(req.user.firebaseUid, firebaseIdentity.firebaseUid);
  assert.equal(req.user.phoneNumber, firebaseIdentity.phoneNumber);
  assert.equal(nextCalls.length, 1);
  assert.equal(nextCalls[0], undefined);
});

// ==================================================
// C. Application account status
// ==================================================

test("active account is allowed", async (t) => {
  const { req, nextCalls } = await executeMiddleware(t, {
    user: createUser({ accountStatus: "active" }),
  });

  assert.equal(req.user.accountStatus, "active");
  assert.equal(nextCalls.length, 1);
});

test("suspended account returns 403", async (t) => {
  const result = await executeMiddleware(t, {
    user: createUser({ accountStatus: "suspended" }),
  });

  assertDenied(result, 403);
});

test("disabled account returns 403", async (t) => {
  const result = await executeMiddleware(t, {
    user: createUser({ accountStatus: "disabled" }),
  });

  assertDenied(result, 403);
});

// ==================================================
// D. Customer profile resolution
// ==================================================

test("customer with valid profile is authenticated", async (t) => {
  const { req, nextCalls, models } = await executeMiddleware(t, {
    user: createUser({ role: "customer" }),
    customer: createCustomer(),
  });

  assert.equal(req.user.role, "customer");
  assert.equal(req.user.adminType, null);
  assert.equal(req.user.vendorId, null);
  assert.equal(req.user.vendorStatus, null);
  assert.deepEqual(models.customerFindOne.mock.calls[0].arguments[0], {
    userId: "mongodb-user-id",
  });
  assert.equal(nextCalls.length, 1);
});

test("customer without Customer profile returns 403", async (t) => {
  const result = await executeMiddleware(t, {
    user: createUser({ role: "customer" }),
    customer: null,
  });

  assertDenied(result, 403);
});

// ==================================================
// E. Vendor profile resolution and onboarding
// ==================================================

test("vendor with pending profile is authenticated", async (t) => {
  const { req, nextCalls, models } = await executeMiddleware(t, {
    user: createUser({ role: "vendor" }),
    vendor: createVendor({ approvalStatus: "pending" }),
  });

  assert.equal(req.user.role, "vendor");
  assert.equal(req.user.vendorId, "mongodb-vendor-id");
  assert.equal(req.user.vendorStatus, "pending");
  assert.equal(req.user.adminType, null);
  assert.deepEqual(models.vendorFindOne.mock.calls[0].arguments[0], {
    userId: "mongodb-user-id",
  });
  assert.equal(nextCalls.length, 1);
});

test("vendor with approved profile receives approved status", async (t) => {
  const { req } = await executeMiddleware(t, {
    user: createUser({ role: "vendor" }),
    vendor: createVendor({ approvalStatus: "approved" }),
  });

  assert.equal(req.user.vendorStatus, "approved");
});

test("vendor with rejected profile receives rejected status", async (t) => {
  const { req } = await executeMiddleware(t, {
    user: createUser({ role: "vendor" }),
    vendor: createVendor({ approvalStatus: "rejected" }),
  });

  assert.equal(req.user.vendorStatus, "rejected");
});

test("vendor onboarding without Vendor profile is allowed", async (t) => {
  const { req, nextCalls } = await executeMiddleware(t, {
    user: createUser({ role: "vendor" }),
    vendor: null,
  });

  assert.equal(req.user.role, "vendor");
  assert.equal(req.user.vendorId, null);
  assert.equal(req.user.vendorStatus, null);
  assert.equal(nextCalls.length, 1);
});

test("inactive vendor is not rejected by requireAuth", async (t) => {
  const { req, nextCalls } = await executeMiddleware(t, {
    user: createUser({ role: "vendor" }),
    vendor: createVendor({
      isActive: false,
      approvalStatus: "approved",
    }),
  });

  assert.equal(req.user.vendorStatus, "approved");
  assert.equal(nextCalls.length, 1);
});

test("soft-deleted vendor is not rejected by requireAuth", async (t) => {
  const { req, nextCalls } = await executeMiddleware(t, {
    user: createUser({ role: "vendor" }),
    vendor: createVendor({
      deletedAt: new Date(),
    }),
  });

  assert.equal(req.user.vendorId, "mongodb-vendor-id");
  assert.equal(nextCalls.length, 1);
});

// ==================================================
// F. Admin profile resolution
// ==================================================

test("admin profile with admin type is authenticated", async (t) => {
  const { req, nextCalls, models } = await executeMiddleware(t, {
    user: createUser({ role: "admin" }),
    admin: createAdmin({ adminType: "admin" }),
  });

  assert.equal(req.user.role, "admin");
  assert.equal(req.user.adminType, "admin");
  assert.equal(req.user.vendorId, null);
  assert.equal(req.user.vendorStatus, null);
  assert.deepEqual(models.adminFindOne.mock.calls[0].arguments[0], {
    userId: "mongodb-user-id",
  });
  assert.equal(nextCalls.length, 1);
});

test("super_admin profile is authenticated", async (t) => {
  const { req } = await executeMiddleware(t, {
    user: createUser({ role: "admin" }),
    admin: createAdmin({ adminType: "super_admin" }),
  });

  assert.equal(req.user.role, "admin");
  assert.equal(req.user.adminType, "super_admin");
});

test("admin without Admin profile returns 403", async (t) => {
  const result = await executeMiddleware(t, {
    user: createUser({ role: "admin" }),
    admin: null,
  });

  assertDenied(result, 403);
});

// ==================================================
// G. Invalid roles and client-supplied identity
// ==================================================

test("unknown application role returns 403", async (t) => {
  const result = await executeMiddleware(t, {
    user: createUser({ role: "unknown" }),
  });

  assertDenied(result, 403);
});

test("request-body role cannot override database role", async (t) => {
  const { req, nextCalls } = await executeMiddleware(t, {
    user: createUser({ role: "customer" }),
    body: {
      role: "admin",
      adminType: "super_admin",
    },
  });

  assert.equal(req.user.role, "customer");
  assert.equal(req.user.adminType, null);
  assert.equal(nextCalls.length, 1);
});

test("pre-existing req.user is cleared before authentication", async (t) => {
  const result = await executeMiddleware(t, {
    firebaseUser: undefined,
    preexistingUser: {
      userId: "old-user",
      role: "admin",
    },
  });

  assertDenied(result, 401);
});

// ==================================================
// H. Unexpected database errors
// ==================================================

test("User lookup error is passed to next(error)", async (t) => {
  const databaseError = new Error("User database failure");

  const { req, res, nextCalls } = await executeMiddleware(t, {
    userFindOne: async () => {
      throw databaseError;
    },
  });

  assert.equal(nextCalls.length, 1);
  assert.equal(nextCalls[0], databaseError);
  assert.equal(res.statusCode, null);
  assert.equal(Object.hasOwn(req, "user"), false);
});

test("Customer lookup error is passed to next(error)", async (t) => {
  const databaseError = new Error("Customer database failure");

  const { req, res, nextCalls } = await executeMiddleware(t, {
    user: createUser({ role: "customer" }),
    customerFindOne: async () => {
      throw databaseError;
    },
  });

  assert.equal(nextCalls.length, 1);
  assert.equal(nextCalls[0], databaseError);
  assert.equal(res.statusCode, null);
  assert.equal(Object.hasOwn(req, "user"), false);
});

test("Vendor lookup error is passed to next(error)", async (t) => {
  const databaseError = new Error("Vendor database failure");

  const { req, res, nextCalls } = await executeMiddleware(t, {
    user: createUser({ role: "vendor" }),
    vendorFindOne: async () => {
      throw databaseError;
    },
  });

  assert.equal(nextCalls.length, 1);
  assert.equal(nextCalls[0], databaseError);
  assert.equal(res.statusCode, null);
  assert.equal(Object.hasOwn(req, "user"), false);
});

test("Admin lookup error is passed to next(error)", async (t) => {
  const databaseError = new Error("Admin database failure");

  const { req, res, nextCalls } = await executeMiddleware(t, {
    user: createUser({ role: "admin" }),
    adminFindOne: async () => {
      throw databaseError;
    },
  });

  assert.equal(nextCalls.length, 1);
  assert.equal(nextCalls[0], databaseError);
  assert.equal(res.statusCode, null);
  assert.equal(Object.hasOwn(req, "user"), false);
});

/*
=========================================================
REQUIRE AUTH MIDDLEWARE - TEST CASE REFERENCE
=========================================================

A. FIREBASE IDENTITY VALIDATION
---------------------------------------------------------
1.  Missing Firebase identity returns 401
    -> Checks whether authentication identity exists.

2.  Missing Firebase UID returns 401
    -> Checks whether Firebase UID is provided.

3.  Empty Firebase UID returns 401
    -> Rejects an empty or whitespace-only UID.

4.  Missing verified phone number returns 401
    -> Checks whether verified phone number exists.

5.  Empty verified phone number returns 401
    -> Rejects an empty or whitespace-only phone number.

6.  Non-string Firebase identity fields return 401
    -> Ensures UID and phone number have valid data types.


B. USER LOOKUP AND IDENTITY CONSISTENCY
---------------------------------------------------------
7.  User is looked up using Firebase UID
    -> Verifies the database lookup uses Firebase UID.

8.  Unregistered application user returns 401
    -> Rejects Firebase users without an application account.

9.  Phone mismatch returns 401
    -> Rejects requests when database and Firebase phone
       numbers do not match.

10. Matching Firebase UID and phone allow processing
    -> Allows authentication when both identities match.


C. APPLICATION ACCOUNT STATUS
---------------------------------------------------------
11. Active account is allowed
    -> Allows users whose accountStatus is active.

12. Suspended account returns 403
    -> Blocks suspended application accounts.

13. Disabled account returns 403
    -> Blocks disabled application accounts.


D. CUSTOMER PROFILE RESOLUTION
---------------------------------------------------------
14. Customer with valid profile is authenticated
    -> Loads Customer profile and attaches req.user.

15. Customer without Customer profile returns 403
    -> Rejects customers without a corresponding profile.


E. VENDOR PROFILE RESOLUTION AND ONBOARDING
---------------------------------------------------------
16. Vendor with pending profile is authenticated
    -> Allows pending vendors to authenticate.

17. Vendor with approved profile receives approved status
    -> Maps approved status into req.user.vendorStatus.

18. Vendor with rejected profile receives rejected status
    -> Maps rejected status into req.user.vendorStatus.

19. Vendor onboarding without Vendor profile is allowed
    -> Allows incomplete vendor onboarding with null vendorId
       and vendorStatus.

20. Inactive vendor is not rejected by requireAuth
    -> Confirms isActive checks belong to later authorization
       middleware.

21. Soft-deleted vendor is not rejected by requireAuth
    -> Confirms deletedAt checks belong to later authorization
       middleware.


F. ADMIN PROFILE RESOLUTION
---------------------------------------------------------
22. Admin profile with admin type is authenticated
    -> Loads Admin profile and attaches adminType.

23. Super_admin profile is authenticated
    -> Distinguishes super_admin from regular admin.

24. Admin without Admin profile returns 403
    -> Rejects admin users without an Admin document.


G. ROLE AND IDENTITY SECURITY
---------------------------------------------------------
25. Unknown application role returns 403
    -> Rejects unsupported database roles.

26. Request-body role cannot override database role
    -> Ensures client-supplied roles cannot change req.user.

27. Pre-existing req.user is cleared before authentication
    -> Prevents previously attached identity from being reused.


H. DATABASE ERRORS AND ERROR FORWARDING
---------------------------------------------------------
28. User lookup error is passed to next(error)
    -> Tests error handling when User lookup fails.

29. Customer lookup error is passed to next(error)
    -> Tests error handling when Customer lookup fails.

30. Vendor lookup error is passed to next(error)
    -> Tests error handling when Vendor lookup fails.

31. Admin lookup error is passed to next(error)
    -> Tests error handling when Admin lookup fails.


=========================================================
TOTAL: 31 TEST CASES
TEST RUNNER: NODE.JS BUILT-IN node:test
DATABASE: MOCKED (NO REAL MONGODB CONNECTION)
FIREBASE: NOT INITIALIZED FOR THESE TESTS
=========================================================
*/
