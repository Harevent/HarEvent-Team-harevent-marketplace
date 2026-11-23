
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
const Admin = require("../models/Admin");
const Category = require("../models/Category");
const EventType = require("../models/EventType");

const app = require("../app");

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

function mockAuthentication(t, role = "admin") {
  t.mock.method(firebaseAuth, "verifyIdToken", async () => ({
    uid: "firebase-event-test",
    phone_number: "+911234567890",
  }));

  t.mock.method(User, "findOne", async () => ({
    _id: "507f1f77bcf86cd799439012",
    firebaseUid: "firebase-event-test",
    phoneNumber: "+911234567890",
    role,
    accountStatus: "active",
  }));

  if (role === "admin") {
    t.mock.method(Admin, "findOne", async () => ({
      _id: "507f1f77bcf86cd799439013",
      userId: "507f1f77bcf86cd799439012",
      adminType: "admin",
    }));
  }

  if (role === "customer") {
    t.mock.method(Customer, "findOne", async () => ({
      _id: "507f1f77bcf86cd799439014",
      userId: "507f1f77bcf86cd799439012",
    }));
  }
}

function mockCategoryLookup(t, categoryIds) {
  t.mock.method(Category, "find", () => ({
    select() {
      return this;
    },
    lean: async () => categoryIds.map((id) => ({ _id: id })),
  }));
}

const categoryId = "507f1f77bcf86cd799439021";
const eventTypeId = "507f1f77bcf86cd799439022";

// 1. Unauthenticated users cannot create event types.
test("POST /api/event-types returns 401 without authentication", async () => {
  const { server, baseUrl } = await startServer();

  try {
    const response = await fetch(`${baseUrl}/api/event-types`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Wedding",
        slug: "wedding",
        vendorCategoryIds: [categoryId],
      }),
    });

    const body = await response.json();

    assert.equal(response.status, 401);
    assert.equal(body.success, false);
  } finally {
    await closeServer(server);
  }
});

// 2. Customers cannot create event types.
test("POST /api/event-types returns 403 for a customer", async (t) => {
  mockAuthentication(t, "customer");

  const { server, baseUrl } = await startServer();

  try {
    const response = await fetch(`${baseUrl}/api/event-types`, {
      method: "POST",
      headers: {
        Authorization: "Bearer valid-test-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Wedding",
        slug: "wedding",
        vendorCategoryIds: [categoryId],
      }),
    });

    const body = await response.json();

    assert.equal(response.status, 403);
    assert.equal(body.success, false);
  } finally {
    await closeServer(server);
  }
});

// 3. Admin can create an event type.
test("POST /api/event-types allows an admin to create an event type", async (t) => {
  mockAuthentication(t);
  mockCategoryLookup(t, [categoryId]);

  const createdEventType = {
    _id: eventTypeId,
    name: "Wedding",
    slug: "wedding",
    description: "Wedding events",
    vendorCategoryIds: [categoryId],
    isActive: true,
  };

  t.mock.method(EventType, "create", async (data) => ({
    ...data,
    _id: eventTypeId,
  }));

  const { server, baseUrl } = await startServer();

  try {
    const response = await fetch(`${baseUrl}/api/event-types`, {
      method: "POST",
      headers: {
        Authorization: "Bearer valid-test-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: createdEventType.name,
        slug: createdEventType.slug,
        description: createdEventType.description,
        vendorCategoryIds: [categoryId],
      }),
    });

    const body = await response.json();

    assert.equal(response.status, 201);
    assert.equal(body.success, true);
    assert.equal(body.data.name, "Wedding");
    assert.equal(body.data.slug, "wedding");
  } finally {
    await closeServer(server);
  }
});

// 4. Invalid event type data is rejected.
test("POST /api/event-types returns 400 for invalid data", async (t) => {
  mockAuthentication(t);

  const { server, baseUrl } = await startServer();

  try {
    const response = await fetch(`${baseUrl}/api/event-types`, {
      method: "POST",
      headers: {
        Authorization: "Bearer valid-test-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "",
        slug: "",
        vendorCategoryIds: [],
      }),
    });

    const body = await response.json();

    assert.equal(response.status, 400);
    assert.equal(body.success, false);
  } finally {
    await closeServer(server);
  }
});

// 5. Admin can deactivate an event type.
test("PUT /api/event-types/:eventTypeId allows an admin to deactivate an event type", async (t) => {
  mockAuthentication(t);

  const updatedEventType = {
    _id: eventTypeId,
    name: "Wedding",
    slug: "wedding",
    vendorCategoryIds: [categoryId],
    isActive: false,
  };

  let capturedId;
  let capturedUpdate;

  t.mock.method(EventType, "findByIdAndUpdate", async (id, update) => {
    capturedId = id;
    capturedUpdate = update;
    return updatedEventType;
  });

  const { server, baseUrl } = await startServer();

  try {
    const response = await fetch(
      `${baseUrl}/api/event-types/${eventTypeId}`,
      {
        method: "PUT",
        headers: {
          Authorization: "Bearer valid-test-token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          isActive: false,
        }),
      }
    );

    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.data.isActive, false);

    assert.equal(capturedId, eventTypeId);
    assert.deepEqual(capturedUpdate, {
      $set: {
        isActive: false,
      },
    });
  } finally {
    await closeServer(server);
  }
});

// 6. Invalid event type IDs are rejected.
test("PUT /api/event-types/:eventTypeId returns 400 for an invalid ID", async (t) => {
  mockAuthentication(t);

  const { server, baseUrl } = await startServer();

  try {
    const response = await fetch(
      `${baseUrl}/api/event-types/invalid-id`,
      {
        method: "PUT",
        headers: {
          Authorization: "Bearer valid-test-token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          isActive: false,
        }),
      }
    );

    const body = await response.json();

    assert.equal(response.status, 400);
    assert.equal(body.success, false);
  } finally {
    await closeServer(server);
  }
});
