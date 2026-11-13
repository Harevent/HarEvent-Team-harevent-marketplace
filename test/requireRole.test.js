const test = require("node:test");
const assert = require("node:assert/strict");

const { requireRole } = require("../middleware/requireRole");

// Create mock request and response objects.
function createMocks(options = {}) {
  const req = {
    user: options.user,
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

// Verify the expected denied response.
function assertDenied(result, expectedStatus) {
  assert.equal(result.res.statusCode, expectedStatus);
  assert.equal(result.nextCalls.length, 0);
  assert.equal(result.res.responseBody.success, false);
}

// --------------------------------------------------
// Middleware configuration tests
// --------------------------------------------------

test("throws when no allowed roles are provided", () => {
  assert.throws(() => requireRole(), TypeError);
});

test("throws when an allowed role is an empty string", () => {
  assert.throws(() => requireRole(""), TypeError);
});

test("throws when an allowed role contains only whitespace", () => {
  assert.throws(() => requireRole("   "), TypeError);
});

test("throws when an allowed role is not a string", () => {
  assert.throws(() => requireRole("admin", 123), TypeError);
});

test("throws when an allowed role is null", () => {
  assert.throws(() => requireRole("admin", null), TypeError);
});

test("trims whitespace from configured role names", () => {
  const middleware = requireRole(" admin ");
  const result = createMocks({
    user: { role: "admin" },
  });

  middleware(result.req, result.res, result.next);

  assert.equal(result.nextCalls.length, 1);
  assert.equal(result.res.statusCode, null);
});

test("trims whitespace from multiple configured role names", () => {
  const middleware = requireRole(" admin ", " vendor ");
  const result = createMocks({
    user: { role: "vendor" },
  });

  middleware(result.req, result.res, result.next);

  assert.equal(result.nextCalls.length, 1);
  assert.equal(result.res.statusCode, null);
});

// --------------------------------------------------
// Authentication tests
// --------------------------------------------------

test("returns 401 when req.user is missing", () => {
  const middleware = requireRole("admin");
  const result = createMocks();

  middleware(result.req, result.res, result.next);

  assertDenied(result, 401);
  assert.equal(result.res.responseBody.message, "Authentication required.");
});

test("returns 401 when req.user is null", () => {
  const middleware = requireRole("admin");
  const result = createMocks({ user: null });

  middleware(result.req, result.res, result.next);

  assertDenied(result, 401);
});

// --------------------------------------------------
// Single-role authorization tests
// --------------------------------------------------

test("allows a user with the matching single role", () => {
  const middleware = requireRole("admin");
  const result = createMocks({
    user: { role: "admin" },
  });

  middleware(result.req, result.res, result.next);

  assert.equal(result.nextCalls.length, 1);
  assert.equal(result.res.statusCode, null);
});

test("rejects a user with a different role", () => {
  const middleware = requireRole("admin");
  const result = createMocks({
    user: { role: "customer" },
  });

  middleware(result.req, result.res, result.next);

  assertDenied(result, 403);
});

test("rejects a user whose authenticated role is missing", () => {
  const middleware = requireRole("admin");
  const result = createMocks({
    user: {},
  });

  middleware(result.req, result.res, result.next);

  assertDenied(result, 403);
});

// --------------------------------------------------
// Multiple-role authorization tests
// --------------------------------------------------

test("allows the first role in a multiple-role configuration", () => {
  const middleware = requireRole("admin", "vendor");
  const result = createMocks({
    user: { role: "admin" },
  });

  middleware(result.req, result.res, result.next);

  assert.equal(result.nextCalls.length, 1);
  assert.equal(result.res.statusCode, null);
});

test("allows the second role in a multiple-role configuration", () => {
  const middleware = requireRole("admin", "vendor");
  const result = createMocks({
    user: { role: "vendor" },
  });

  middleware(result.req, result.res, result.next);

  assert.equal(result.nextCalls.length, 1);
  assert.equal(result.res.statusCode, null);
});

test("rejects a role not included in multiple allowed roles", () => {
  const middleware = requireRole("admin", "vendor");
  const result = createMocks({
    user: { role: "customer" },
  });

  middleware(result.req, result.res, result.next);

  assertDenied(result, 403);
});

// --------------------------------------------------
// Trusted role source tests
// --------------------------------------------------

test("ignores a role supplied in the request body", () => {
  const middleware = requireRole("admin");
  const result = createMocks({
    user: { role: "customer" },
    body: { role: "admin" },
  });

  middleware(result.req, result.res, result.next);

  assertDenied(result, 403);
});

test("ignores a role supplied in query parameters", () => {
  const middleware = requireRole("admin");
  const result = createMocks({
    user: { role: "customer" },
    query: { role: "admin" },
  });

  middleware(result.req, result.res, result.next);

  assertDenied(result, 403);
});

test("ignores a role supplied in request headers", () => {
  const middleware = requireRole("admin");
  const result = createMocks({
    user: { role: "customer" },
    headers: { role: "admin" },
  });

  middleware(result.req, result.res, result.next);

  assertDenied(result, 403);
});

// --------------------------------------------------
// Role matching and next() tests
// --------------------------------------------------

test("role matching is case-sensitive", () => {
  const middleware = requireRole("admin");
  const result = createMocks({
    user: { role: "Admin" },
  });

  middleware(result.req, result.res, result.next);

  assertDenied(result, 403);
});

test("does not call next more than once when access is allowed", () => {
  const middleware = requireRole("vendor");
  const result = createMocks({
    user: { role: "vendor" },
  });

  middleware(result.req, result.res, result.next);

  assert.equal(result.nextCalls.length, 1);
});

test("does not use adminType for role authorization", () => {
  const middleware = requireRole("admin");
  const result = createMocks({
    user: {
      role: "admin",
      adminType: "customer",
    },
  });

  middleware(result.req, result.res, result.next);

  assert.equal(result.nextCalls.length, 1);
});

test("does not allow a customer based on adminType alone", () => {
  const middleware = requireRole("admin");
  const result = createMocks({
    user: {
      role: "customer",
      adminType: "super_admin",
    },
  });

  middleware(result.req, result.res, result.next);

  assertDenied(result, 403);
});

// ==================================================
// REQUIRE ROLE TEST REFERENCE GUIDE
// ==================================================
//
// MIDDLEWARE CONFIGURATION TESTS
//
// 1. No allowed roles
//    Checks that requireRole() throws an error when no roles are provided.
//
// 2. Empty role
//    Checks that an empty string is rejected as an invalid role.
//
// 3. Whitespace-only role
//    Checks that a role containing only spaces is rejected.
//
// 4. Non-string role
//    Checks that numbers or other non-string values are rejected.
//
// 5. Null role
//    Checks that null is rejected as an invalid role.
//
// 6. Trim single role
//    Checks that whitespace around a configured role is removed.
//
// 7. Trim multiple roles
//    Checks that whitespace is removed from multiple configured roles.
//
// AUTHENTICATION TESTS
//
// 8. Missing req.user
//    Checks that unauthenticated requests receive HTTP 401.
//
// 9. Null req.user
//    Checks that a null authenticated user receives HTTP 401.
//
// SINGLE-ROLE AUTHORIZATION TESTS
//
// 10. Matching role
//     Checks that a user with the allowed role gets access.
//
// 11. Different role
//     Checks that a user with a different role receives HTTP 403.
//
// 12. Missing user role
//     Checks that access is denied when req.user.role is missing.
//
// MULTIPLE-ROLE AUTHORIZATION TESTS
//
// 13. First allowed role
//     Checks that the first configured role is accepted.
//
// 14. Second allowed role
//     Checks that the second configured role is accepted.
//
// 15. Unlisted role
//     Checks that a role outside the allowed list is rejected.
//
// TRUSTED ROLE SOURCE TESTS
//
// 16. Request body role
//     Checks that a body-supplied admin role cannot override req.user.role.
//
// 17. Query parameter role
//     Checks that a query-supplied admin role cannot override req.user.role.
//
// 18. Request header role
//     Checks that a header-supplied admin role cannot override req.user.role.
//
// ROLE MATCHING AND NEXT TESTS
//
// 19. Case-sensitive matching
//     Checks that "Admin" and "admin" are treated as different roles.
//
// 20. next() called once
//     Checks that successful authorization calls next() exactly once.
//
// 21. adminType separation
//     Checks that adminType does not influence generic role authorization.
//
// 22. Customer with adminType
//     Checks that a customer cannot gain admin access just by having
//     adminType set to "super_admin".
//
// ==================================================
// IMPORTANT CONCEPTS
// ==================================================
//
// Authentication:
//    Verifies who the user is. Handled by verifyFirebaseToken
//    and requireAuth.
//
// Authorization:
//    Determines what an authenticated user is allowed to access.
//    Handled by requireRole and other authorization middleware.
//
// HTTP 401:
//    Authentication is missing or invalid.
//
// HTTP 403:
//    The user is authenticated but does not have permission.
//
// req.user.role:
//    The trusted application role attached by requireAuth.
//
// adminType:
//    Distinguishes "admin" and "super_admin" within the admin role.
//    It must be checked separately by admin-specific middleware.
//
// ==================================================
