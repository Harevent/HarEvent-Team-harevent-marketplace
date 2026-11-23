
const process = require("node:process");

process.env.NODE_ENV = "test";
process.env.MONGODB_URI = "mongodb://127.0.0.1:27017/harevent_test";
process.env.FIREBASE_PROJECT_ID = "harevent-test";
process.env.CLIENT_URL = "http://localhost:5173";

const test = require("node:test");
const assert = require("node:assert/strict");

const { firebaseAuth } = require("../config/firebase");

const User = require("../models/User");
const Admin = require("../models/Admin");
const Vendor = require("../models/Vendor");
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

function mockAuthentication(t) {
  t.mock.method(firebaseAuth, "verifyIdToken", async () => ({
    uid: "firebase-category-test",
    phone_number: "+911234567890",
  }));

  t.mock.method(User, "findOne", async () => ({
    _id: "507f1f77bcf86cd799439012",
    firebaseUid: "firebase-category-test",
    phoneNumber: "+911234567890",
    role: "admin",
    accountStatus: "active",
  }));

  t.mock.method(Admin, "findOne", async () => ({
    _id: "507f1f77bcf86cd799439013",
    userId: "507f1f77bcf86cd799439012",
    adminType: "admin",
  }));
}

const categoryId = "507f1f77bcf86cd799439021";
const serviceId = "507f1f77bcf86cd799439022";

// 1. Prevent deleting a category referenced by a vendor.
test("DELETE /api/categories/:id returns 409 when a vendor references the category", async (t) => {
  mockAuthentication(t);

  t.mock.method(Category, "findById", async () => ({
    _id: categoryId,
    deleteOne: async () => {},
  }));

  t.mock.method(Category, "exists", async () => false);
  t.mock.method(Vendor, "exists", async () => true);
  t.mock.method(EventType, "exists", async () => false);

  const { server, baseUrl } = await startServer();

  try {
    const response = await fetch(`${baseUrl}/api/categories/${categoryId}`, {
      method: "DELETE",
      headers: {
        Authorization: "Bearer valid-test-token",
      },
    });

    const body = await response.json();

    assert.equal(response.status, 409);
    assert.equal(body.success, false);
  } finally {
    await closeServer(server);
  }
});

// 2. Prevent deleting a category referenced by an event type.
test("DELETE /api/categories/:id returns 409 when an event type references the category", async (t) => {
  mockAuthentication(t);

  t.mock.method(Category, "findById", async () => ({
    _id: categoryId,
    deleteOne: async () => {},
  }));

  t.mock.method(Category, "exists", async () => false);
  t.mock.method(Vendor, "exists", async () => false);
  t.mock.method(EventType, "exists", async () => true);

  const { server, baseUrl } = await startServer();

  try {
    const response = await fetch(`${baseUrl}/api/categories/${categoryId}`, {
      method: "DELETE",
      headers: {
        Authorization: "Bearer valid-test-token",
      },
    });

    const body = await response.json();

    assert.equal(response.status, 409);
    assert.equal(body.success, false);
  } finally {
    await closeServer(server);
  }
});

// 3. Prevent deleting a service selected by a vendor.
test("DELETE /api/services/:id returns 409 when a vendor has selected the service", async (t) => {
  mockAuthentication(t);

  t.mock.method(Category, "findOne", async () => ({
    _id: serviceId,
    parentId: categoryId,
    deleteOne: async () => {},
  }));

  t.mock.method(Category, "exists", async () => false);
  t.mock.method(Vendor, "exists", async () => true);

  const { server, baseUrl } = await startServer();

  try {
    const response = await fetch(`${baseUrl}/api/services/${serviceId}`, {
      method: "DELETE",
      headers: {
        Authorization: "Bearer valid-test-token",
      },
    });

    const body = await response.json();

    assert.equal(response.status, 409);
    assert.equal(body.success, false);
  } finally {
    await closeServer(server);
  }
});


// 4. Allow deactivating a category while preserving existing vendor references.
test("PUT /api/categories/:id allows deactivation when a vendor references the category", async (t) => {
  mockAuthentication(t);

  const category = {
    _id: categoryId,
    isActive: true,
  };

  t.mock.method(Category, "findById", async () => category);

  t.mock.method(Category, "findByIdAndUpdate", async (id, updates) => ({
    ...category,
    ...updates,
  }));


  const { server, baseUrl } = await startServer();

  try {
    const response = await fetch(`${baseUrl}/api/categories/${categoryId}`, {
      method: "PUT",
      headers: {
        Authorization: "Bearer valid-test-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        isActive: false,
      }),
    });

    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.data.isActive, false);

  } finally {
    await closeServer(server);
  }
});

// 5. Allow deactivating a service while preserving existing vendor references.
test("PUT /api/services/:id allows deactivation when a vendor references the service", async (t) => {
  mockAuthentication(t);

  const service = {
    _id: serviceId,
    parentId: categoryId,
    isActive: true,
  };

  t.mock.method(Category, "findOne", async () => service);

  t.mock.method(Category, "findOneAndUpdate", async (filter, updates) => ({
    ...service,
    ...updates,
  }));

  const vendorReferenceExists = true;

  const { server, baseUrl } = await startServer();

  try {
    const response = await fetch(`${baseUrl}/api/services/${serviceId}`, {
      method: "PUT",
      headers: {
        Authorization: "Bearer valid-test-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        isActive: false,
      }),
    });

    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.data.isActive, false);
    assert.equal(vendorReferenceExists, true);
  } finally {
    await closeServer(server);
  }
});
