require("dotenv").config();

const test = require("node:test");
const assert = require("node:assert/strict");

const { firebaseAuth } = require("../config/firebase");
const { verifyFirebaseToken } = require("../middleware/firebaseAuth");

function createMockResponse() {
  return {
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
}

function createMockRequest(authorization) {
  return {
    headers: authorization === undefined ? {} : { authorization },
  };
}

function createFirebaseError(code) {
  return Object.assign(new Error(`Firebase test error: ${code}`), {
    code,
  });
}

async function runMiddleware(req) {
  const res = createMockResponse();
  let nextCalled = false;
  let nextError = null;

  await verifyFirebaseToken(req, res, (error) => {
    nextCalled = true;
    nextError = error;
  });

  return { req, res, nextCalled, nextError };
}

test("missing Authorization header returns 401", async () => {
  const req = createMockRequest();

  const { res, nextCalled } = await runMiddleware(req);

  assert.equal(res.statusCode, 401);
  assert.equal(
    res.responseBody.message,
    "Access denied. Please provide a Firebase ID token.",
  );
  assert.equal(nextCalled, false);
});

test("malformed Bearer header returns 401", async () => {
  const req = createMockRequest("Basic some-token");

  const { res, nextCalled } = await runMiddleware(req);

  assert.equal(res.statusCode, 401);
  assert.equal(nextCalled, false);
});

test("empty Bearer token returns 401", async () => {
  const req = createMockRequest("Bearer    ");

  const { res, nextCalled } = await runMiddleware(req);

  assert.equal(res.statusCode, 401);
  assert.equal(res.responseBody.message, "Firebase ID token is missing.");
  assert.equal(nextCalled, false);
});

test("invalid Firebase token returns 401", async (t) => {
  const verifyStub = t.mock.method(firebaseAuth, "verifyIdToken", async () => {
    throw Object.assign(new Error("Invalid Firebase token"), {
      code: "auth/invalid-id-token",
    });
  });

  const req = createMockRequest("Bearer invalid-token");

  const { res, nextCalled } = await runMiddleware(req);

  assert.equal(verifyStub.mock.calls.length, 1);
  assert.equal(verifyStub.mock.calls[0].arguments[0], "invalid-token");
  assert.equal(res.statusCode, 401);
  assert.equal(
    res.responseBody.message,
    "Invalid or expired Firebase ID token.",
  );
  assert.equal(nextCalled, false);
});

test("expired Firebase token returns 401", async (t) => {
  t.mock.method(firebaseAuth, "verifyIdToken", async () => {
    throw createFirebaseError("auth/id-token-expired");
  });

  const req = createMockRequest("Bearer expired-token");
  const { res, nextCalled } = await runMiddleware(req);

  assert.equal(res.statusCode, 401);
  assert.equal(nextCalled, false);
});

test("revoked Firebase token returns 401", async (t) => {
  t.mock.method(firebaseAuth, "verifyIdToken", async () => {
    throw createFirebaseError("auth/id-token-revoked");
  });

  const req = createMockRequest("Bearer revoked-token");
  const { res, nextCalled } = await runMiddleware(req);

  assert.equal(res.statusCode, 401);
  assert.equal(nextCalled, false);
});

test("disabled Firebase user returns 401", async (t) => {
  t.mock.method(firebaseAuth, "verifyIdToken", async () => {
    throw createFirebaseError("auth/user-disabled");
  });

  const req = createMockRequest("Bearer disabled-user-token");
  const { res, nextCalled } = await runMiddleware(req);

  assert.equal(res.statusCode, 401);
  assert.equal(nextCalled, false);
});

test("valid Firebase token attaches verified identity and calls next", async (t) => {
  const decodedToken = {
    uid: "firebase-test-uid",
    phone_number: "+911234567890",
  };

  const verifyStub = t.mock.method(
    firebaseAuth,
    "verifyIdToken",
    async () => decodedToken,
  );

  const req = createMockRequest("Bearer valid-test-token");

  const { res, nextCalled } = await runMiddleware(req);

  assert.equal(verifyStub.mock.calls.length, 1);
  assert.equal(verifyStub.mock.calls[0].arguments[0], "valid-test-token");
  assert.equal(verifyStub.mock.calls[0].arguments[1], true);

  assert.deepEqual(req.firebaseUser, {
    firebaseUid: "firebase-test-uid",
    phoneNumber: "+911234567890",
  });

  assert.equal(nextCalled, true);
  assert.equal(res.statusCode, null);
});

test("Firebase token without verified phone number returns 401", async (t) => {
  t.mock.method(firebaseAuth, "verifyIdToken", async () => ({
    uid: "firebase-test-uid",
  }));

  const req = createMockRequest("Bearer token-without-phone");

  const { res, nextCalled } = await runMiddleware(req);

  assert.equal(res.statusCode, 401);
  assert.equal(
    res.responseBody.message,
    "Firebase token does not contain a verified phone identity.",
  );
  assert.equal(nextCalled, false);
});

test("Firebase internal error is forwarded to next", async (t) => {
  const error = createFirebaseError("auth/internal-error");

  t.mock.method(firebaseAuth, "verifyIdToken", async () => {
    throw error;
  });

  const req = createMockRequest("Bearer test-token");
  const { res, nextCalled, nextError } = await runMiddleware(req);

  assert.equal(nextCalled, true);
  assert.equal(nextError, error);
  assert.equal(res.statusCode, null);
});

test("Firebase credential configuration error is forwarded to next", async (t) => {
  const error = createFirebaseError("app/invalid-credential");

  t.mock.method(firebaseAuth, "verifyIdToken", async () => {
    throw error;
  });

  const req = createMockRequest("Bearer test-token");
  const { res, nextCalled, nextError } = await runMiddleware(req);

  assert.equal(nextCalled, true);
  assert.equal(nextError, error);
  assert.equal(res.statusCode, null);
});

test("Firebase certificate-fetch failure is forwarded to next", async (t) => {
  const error = createFirebaseError("auth/certificate-fetch-failed");

  t.mock.method(firebaseAuth, "verifyIdToken", async () => {
    throw error;
  });

  const req = createMockRequest("Bearer test-token");
  const { res, nextCalled, nextError } = await runMiddleware(req);

  assert.equal(nextCalled, true);
  assert.equal(nextError, error);
  assert.equal(res.statusCode, null);
});
