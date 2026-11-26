
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
const Customer = require("../models/Customer");
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
    uid: "firebase-category-test",
    phone_number: "+911234567890",
  }));

  t.mock.method(User, "findOne", async () => ({
    _id: "507f1f77bcf86cd799439012",
    firebaseUid: "firebase-category-test",
    phoneNumber: "+911234567890",
    role,
    accountStatus: "active",
  }));

  t.mock.method(Admin, "findOne", async () => ({
    _id: "507f1f77bcf86cd799439013",
    userId: "507f1f77bcf86cd799439012",
    adminType: "admin",
  }));

  t.mock.method(Customer, "findOne", async () => ({
    _id: "507f1f77bcf86cd799439014",
    userId: "507f1f77bcf86cd799439012",
  }));

  t.mock.method(Vendor, "findOne", async () => ({
    _id: "507f1f77bcf86cd799439015",
    userId: "507f1f77bcf86cd799439012",
    approvalStatus: "approved",
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
      headers: { Authorization: "Bearer valid-test-token" },
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
      headers: { Authorization: "Bearer valid-test-token" },
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
      headers: { Authorization: "Bearer valid-test-token" },
    });

    const body = await response.json();

    assert.equal(response.status, 409);
    assert.equal(body.success, false);
  } finally {
    await closeServer(server);
  }
});

// 4. Allow deactivating a category while preserving existing references.
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
      body: JSON.stringify({ isActive: false }),
    });

    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.data.isActive, false);
  } finally {
    await closeServer(server);
  }
});

// 5. Allow deactivating a service while preserving existing references.
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

  const { server, baseUrl } = await startServer();

  try {
    const response = await fetch(`${baseUrl}/api/services/${serviceId}`, {
      method: "PUT",
      headers: {
        Authorization: "Bearer valid-test-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ isActive: false }),
    });

    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.data.isActive, false);
  } finally {
    await closeServer(server);
  }
});

// 6. Successfully create a main category.
test("POST /api/categories creates a main category successfully", async (t) => {
  mockAuthentication(t);

  t.mock.method(Category, "create", async (data) => ({
    ...data,
    _id: categoryId,
    isActive: true,
  }));

  const { server, baseUrl } = await startServer();

  try {
    const response = await fetch(`${baseUrl}/api/categories`, {
      method: "POST",
      headers: {
        Authorization: "Bearer valid-test-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Photography",
        slug: "photography",
        description: "Photography services",
        sortOrder: 1,
      }),
    });

    const body = await response.json();

    assert.equal(response.status, 201);
    assert.equal(body.success, true);
    assert.equal(body.data.name, "Photography");
    assert.equal(body.data.slug, "photography");
    assert.equal(body.data.parentId, null);
  } finally {
    await closeServer(server);
  }
});

// 7. Successfully create a service under an active main category.
test("POST /api/categories creates a service under an active parent category", async (t) => {
  mockAuthentication(t);

  t.mock.method(Category, "findOne", async () => ({
    _id: categoryId,
    name: "Photography",
    parentId: null,
    isActive: true,
  }));

  t.mock.method(Category, "create", async (data) => ({
    ...data,
    _id: serviceId,
    isActive: true,
  }));

  const { server, baseUrl } = await startServer();

  try {
    const response = await fetch(`${baseUrl}/api/categories`, {
      method: "POST",
      headers: {
        Authorization: "Bearer valid-test-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Wedding Photography",
        slug: "wedding-photography",
        description: "Wedding photography service",
        parentId: categoryId,
        sortOrder: 1,
      }),
    });

    const body = await response.json();

    assert.equal(response.status, 201);
    assert.equal(body.success, true);
    assert.equal(body.data.name, "Wedding Photography");
    assert.equal(body.data.slug, "wedding-photography");
    assert.equal(body.data.parentId, categoryId);
  } finally {
    await closeServer(server);
  }
});

// 8. Reject category creation when required fields are missing.
test("POST /api/categories returns 400 when name or slug is missing", async (t) => {
  mockAuthentication(t);

  const { server, baseUrl } = await startServer();

  try {
    const response = await fetch(`${baseUrl}/api/categories`, {
      method: "POST",
      headers: {
        Authorization: "Bearer valid-test-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: "Photography" }),
    });

    const body = await response.json();

    assert.equal(response.status, 400);
    assert.equal(body.success, false);
    assert.equal(body.message, "Category name and slug are required.");
  } finally {
    await closeServer(server);
  }
});

// 9. Reject service creation with an invalid parent category ID.
test("POST /api/categories returns 400 when parent category ID is invalid", async (t) => {
  mockAuthentication(t);

  const { server, baseUrl } = await startServer();

  try {
    const response = await fetch(`${baseUrl}/api/categories`, {
      method: "POST",
      headers: {
        Authorization: "Bearer valid-test-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Wedding Photography",
        slug: "wedding-photography",
        parentId: "invalid-parent-id",
      }),
    });

    const body = await response.json();

    assert.equal(response.status, 400);
    assert.equal(body.success, false);
    assert.equal(body.message, "Invalid parent category ID.");
  } finally {
    await closeServer(server);
  }
});

// 10. Successfully update a main category.
test("PUT /api/categories/:id updates a category successfully", async (t) => {
  mockAuthentication(t);

  const category = {
    _id: categoryId,
    name: "Photography",
    slug: "photography",
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
      body: JSON.stringify({ name: "Wedding Photography" }),
    });

    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.data.name, "Wedding Photography");
  } finally {
    await closeServer(server);
  }
});

// 11. Successfully update a service.
test("PUT /api/services/:id updates a service successfully", async (t) => {
  mockAuthentication(t);

  const service = {
    _id: serviceId,
    parentId: categoryId,
    name: "Wedding Photography",
    slug: "wedding-photography",
    isActive: true,
  };

  t.mock.method(Category, "findOne", async () => service);

  t.mock.method(Category, "findOneAndUpdate", async (filter, updates) => ({
    ...service,
    ...updates,
  }));

  const { server, baseUrl } = await startServer();

  try {
    const response = await fetch(`${baseUrl}/api/services/${serviceId}`, {
      method: "PUT",
      headers: {
        Authorization: "Bearer valid-test-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: "Premium Wedding Photography" }),
    });

    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.data.name, "Premium Wedding Photography");
  } finally {
    await closeServer(server);
  }
});

// 12. Reject a category update when no update fields are provided.
test("PUT /api/categories/:id returns 400 when no update fields are provided", async (t) => {
  mockAuthentication(t);

  t.mock.method(Category, "findById", async () => ({
    _id: categoryId,
    name: "Photography",
    isActive: true,
  }));

  const { server, baseUrl } = await startServer();

  try {
    const response = await fetch(`${baseUrl}/api/categories/${categoryId}`, {
      method: "PUT",
      headers: {
        Authorization: "Bearer valid-test-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });

    const body = await response.json();

    assert.equal(response.status, 400);
    assert.equal(body.success, false);
  } finally {
    await closeServer(server);
  }
});

// 13. Reject a service update when no update fields are provided.
test("PUT /api/services/:id returns 400 when no update fields are provided", async (t) => {
  mockAuthentication(t);

  t.mock.method(Category, "findOne", async () => ({
    _id: serviceId,
    parentId: categoryId,
    name: "Wedding Photography",
    isActive: true,
  }));

  const { server, baseUrl } = await startServer();

  try {
    const response = await fetch(`${baseUrl}/api/services/${serviceId}`, {
      method: "PUT",
      headers: {
        Authorization: "Bearer valid-test-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });

    const body = await response.json();

    assert.equal(response.status, 400);
    assert.equal(body.success, false);
  } finally {
    await closeServer(server);
  }
});

// 14. Return 404 when the category to update does not exist.
test("PUT /api/categories/:id returns 404 when the category does not exist", async (t) => {
  mockAuthentication(t);

  t.mock.method(Category, "findById", async () => null);

  const { server, baseUrl } = await startServer();

  try {
    const response = await fetch(`${baseUrl}/api/categories/${categoryId}`, {
      method: "PUT",
      headers: {
        Authorization: "Bearer valid-test-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: "Updated Category" }),
    });

    const body = await response.json();

    assert.equal(response.status, 404);
    assert.equal(body.success, false);
  } finally {
    await closeServer(server);
  }
});

// 15. Return 404 when the service to update does not exist.
test("PUT /api/services/:id returns 404 when the service does not exist", async (t) => {
  mockAuthentication(t);

  t.mock.method(Category, "findOne", async () => null);

  const { server, baseUrl } = await startServer();

  try {
    const response = await fetch(`${baseUrl}/api/services/${serviceId}`, {
      method: "PUT",
      headers: {
        Authorization: "Bearer valid-test-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: "Updated Service" }),
    });

    const body = await response.json();

    assert.equal(response.status, 404);
    assert.equal(body.success, false);
  } finally {
    await closeServer(server);
  }
});

// 16. Reject category creation without authentication.
test("POST /api/categories returns 401 without an authentication token", async () => {
  const { server, baseUrl } = await startServer();

  try {
    const response = await fetch(`${baseUrl}/api/categories`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Photography",
        slug: "photography",
      }),
    });

    const body = await response.json();

    assert.equal(response.status, 401);
    assert.equal(body.success, false);
  } finally {
    await closeServer(server);
  }
});

// 17. Reject service updates without authentication.
test("PUT /api/services/:id returns 401 without an authentication token", async () => {
  const { server, baseUrl } = await startServer();

  try {
    const response = await fetch(`${baseUrl}/api/services/${serviceId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Updated Service" }),
    });

    const body = await response.json();

    assert.equal(response.status, 401);
    assert.equal(body.success, false);
  } finally {
    await closeServer(server);
  }
});

// 18. Customers cannot create categories.
test("POST /api/categories returns 403 for a customer", async (t) => {
  mockAuthentication(t, "customer");

  const { server, baseUrl } = await startServer();

  try {
    const response = await fetch(`${baseUrl}/api/categories`, {
      method: "POST",
      headers: {
        Authorization: "Bearer valid-test-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Photography",
        slug: "photography",
      }),
    });

    const body = await response.json();

    assert.equal(response.status, 403);
    assert.equal(body.success, false);
  } finally {
    await closeServer(server);
  }
});

// 19. Vendors cannot update services.
test("PUT /api/services/:id returns 403 for a vendor", async (t) => {
  mockAuthentication(t, "vendor");

  const { server, baseUrl } = await startServer();

  try {
    const response = await fetch(`${baseUrl}/api/services/${serviceId}`, {
      method: "PUT",
      headers: {
        Authorization: "Bearer valid-test-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: "Updated Service" }),
    });

    const body = await response.json();

    assert.equal(response.status, 403);
    assert.equal(body.success, false);
  } finally {
    await closeServer(server);
  }
});
