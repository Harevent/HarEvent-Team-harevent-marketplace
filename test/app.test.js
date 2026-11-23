const process = require("node:process");

process.env.NODE_ENV = "test";
process.env.MONGODB_URI = "mongodb://127.0.0.1:27017/harevent_test";
process.env.FIREBASE_PROJECT_ID = "harevent-test";
process.env.CLIENT_URL = "http://localhost:5173";

const test = require("node:test");
const assert = require("node:assert/strict");
const app = require("../app");
const errorHandler = app.errorHandler;

// Helper for testing the actual centralized error handler.
function createErrorHandlerMocks() {
  const req = {};

  const res = {
    headersSent: false,
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

// Existing test 1: Health endpoint.
test("GET /health returns a healthy response", async () => {
  const server = app.listen(0);

  try {
    const address = server.address();
    const response = await fetch(`http://127.0.0.1:${address.port}/health`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(body, {
      success: true,
      status: "healthy",
    });
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }
});

// Existing test 2: 404 handling.
test("unknown routes return a JSON 404 response", async () => {
  const server = app.listen(0);

  try {
    const address = server.address();
    const response = await fetch(
      `http://127.0.0.1:${address.port}/not-a-real-route`,
    );
    const body = await response.json();

    assert.equal(response.status, 404);
    assert.deepEqual(body, {
      success: false,
      message: "Route not found",
    });
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }
});

// Existing test 3: Welcome endpoint.
test("GET / returns the API welcome message", async () => {
  const server = app.listen(0);

  try {
    const address = server.address();
    const response = await fetch(`http://127.0.0.1:${address.port}/`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(body, {
      success: true,
      message: "Welcome to Harevent Backend API!",
    });
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }
});

// Existing test 4: Allowed CORS origin.
test("CORS allows the local frontend origin", async () => {
  const server = app.listen(0);

  try {
    const response = await fetch(
      `http://127.0.0.1:${server.address().port}/health`,
      { headers: { Origin: "http://localhost:5173" } },
    );

    assert.equal(
      response.headers.get("access-control-allow-origin"),
      "http://localhost:5173",
    );
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

// Existing test 5: Rejected CORS origin.
test("CORS does not allow an unrelated origin", async () => {
  const server = app.listen(0);

  try {
    const response = await fetch(
      `http://127.0.0.1:${server.address().port}/health`,
      { headers: { Origin: "https://example.com" } },
    );

    assert.equal(response.headers.get("access-control-allow-origin"), null);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

// Existing test 6: Oversized JSON.
test("oversized JSON request bodies are rejected", async () => {
  const server = app.listen(0);

  try {
    const response = await fetch(
      `http://127.0.0.1:${server.address().port}/api/auth/signup`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: "x".repeat(1024 * 1024 + 100) }),
      },
    );

    assert.equal(response.status, 413);
    assert.deepEqual(await response.json(), {
      success: false,
      message: "Request body too large.",
    });
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }
});

// New test 7: Mongoose validation error.
test("Mongoose validation errors return 400", () => {
  const { req, res, next, nextCalls } = createErrorHandlerMocks();

  const error = new Error("Validation failed");
  error.name = "ValidationError";

  errorHandler(error, req, res, next);

  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.responseBody, {
    success: false,
    message: "Validation failed.",
  });
  assert.equal(nextCalls.length, 0);
});

// New test 8: MongoDB duplicate-key error.
test("MongoDB duplicate-key errors return 409", () => {
  const { req, res, next, nextCalls } = createErrorHandlerMocks();

  const error = new Error("Duplicate key");
  error.code = 11000;

  errorHandler(error, req, res, next);

  assert.equal(res.statusCode, 409);
  assert.deepEqual(res.responseBody, {
    success: false,
    message: "Resource already exists.",
  });
  assert.equal(nextCalls.length, 0);
});

// New test 9: Unexpected internal error.
test("unexpected errors return a safe 500 response", () => {
  const { req, res, next, nextCalls } = createErrorHandlerMocks();

  const error = new Error("Sensitive database details");

  errorHandler(error, req, res, next);

  assert.equal(res.statusCode, 500);
  assert.deepEqual(res.responseBody, {
    success: false,
    message: "Internal server error",
  });
  assert.equal(nextCalls.length, 0);
});

// New test 10: Valid custom HTTP status.
test("valid custom HTTP error statuses are preserved", () => {
  const { req, res, next, nextCalls } = createErrorHandlerMocks();

  const error = new Error("Access denied");
  error.status = 403;

  errorHandler(error, req, res, next);

  assert.equal(res.statusCode, 403);
  assert.deepEqual(res.responseBody, {
    success: false,
    message: "Access denied",
  });
  assert.equal(nextCalls.length, 0);
});

// New test 11: statusCode fallback.
test("statusCode 429 is preserved when status is undefined", () => {
  const { req, res, next, nextCalls } = createErrorHandlerMocks();

  const error = new Error("Too many requests");
  error.statusCode = 429;

  errorHandler(error, req, res, next);

  assert.equal(res.statusCode, 429);
  assert.deepEqual(res.responseBody, {
    success: false,
    message: "Too many requests",
  });
  assert.equal(nextCalls.length, 0);
});

// New test 12: Invalid HTTP statuses.
test("invalid HTTP error statuses fall back to 500", () => {
  const invalidStatuses = [200, 399, 600, 999, "400", NaN];

  for (const invalidStatus of invalidStatuses) {
    const { req, res, next, nextCalls } = createErrorHandlerMocks();

    const error = new Error("Internal details");
    error.status = invalidStatus;

    errorHandler(error, req, res, next);

    assert.equal(res.statusCode, 500);
    assert.deepEqual(res.responseBody, {
      success: false,
      message: "Internal server error",
    });
    assert.equal(nextCalls.length, 0);
  }
});

// New test 13: Headers already sent.
test("forwards errors when response headers have already been sent", () => {
  const { req, res, next, nextCalls } = createErrorHandlerMocks();

  const error = new Error("Response already started");
  res.headersSent = true;

  errorHandler(error, req, res, next);

  assert.equal(res.statusCode, null);
  assert.equal(res.responseBody, null);
  assert.equal(nextCalls.length, 1);
  assert.equal(nextCalls[0], error);
});

// New test 14: Malformed JSON.
test("malformed JSON request bodies return 400", async () => {
  const server = app.listen(0);

  try {
    const response = await fetch(
      `http://127.0.0.1:${server.address().port}/api/auth/signup`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: '{"name": "Danish"',
      },
    );

    const body = await response.json();

    assert.equal(response.status, 400);
    assert.deepEqual(body, {
      success: false,
      message: "Invalid JSON request body.",
    });
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }
});
