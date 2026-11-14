const test = require("node:test");
const assert = require("node:assert/strict");
const app = require("../app");

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
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});
