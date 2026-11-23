
const process = require("node:process");

process.env.NODE_ENV = "test";
process.env.MONGODB_URI = "mongodb://127.0.0.1:27017/harevent_test";
process.env.FIREBASE_PROJECT_ID = "harevent-test";
process.env.CLIENT_URL = "http://localhost:5173";

const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");

const Vendor = require("../models/Vendor");
const EventType = require("../models/EventType");
const Category = require("../models/Category");
const app = require("../app");

// Creates a mock Mongoose query chain.
function createQueryChain(result) {
  const query = {};

  for (const method of ["select", "populate", "sort", "skip", "limit"]) {
    query[method] = () => query;
  }

  query.lean = async () => result;

  return query;
}

// Starts a temporary HTTP server.
async function startServer() {
  const server = app.listen(0);

  await new Promise((resolve) => server.once("listening", resolve));

  return {
    server,
    baseUrl: `http://127.0.0.1:${server.address().port}`,
  };
}

// Closes the temporary HTTP server.
async function closeServer(server) {
  await new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

// 1. Public vendor listing.
test("GET /api/vendors returns public vendor listings without authentication", async (t) => {
  const vendorData = [
    {
      publicVendorId: "test-vendor-001",
      businessName: "Demo Photography",
      description: "Wedding photography services",
    },
  ];

  let capturedFilter;

  t.mock.method(Vendor, "find", (filter) => {
    capturedFilter = filter;
    return createQueryChain(vendorData);
  });

  t.mock.method(Vendor, "countDocuments", async () => 1);

  const { server, baseUrl } = await startServer();

  try {
    const response = await fetch(`${baseUrl}/api/vendors`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.count, 1);
    assert.equal(body.total, 1);
    assert.equal(body.data[0].businessName, "Demo Photography");

    assert.deepEqual(capturedFilter, {
      approvalStatus: "approved",
      isActive: true,
      deletedAt: null,
    });
  } finally {
    await closeServer(server);
  }
});

// 2. Vendor listing filters.
test("GET /api/vendors applies category, event type, city and search filters", async (t) => {
  const categoryId = new mongoose.Types.ObjectId().toString();
  const eventTypeId = new mongoose.Types.ObjectId().toString();

  let capturedFilter;

  t.mock.method(Vendor, "find", (filter) => {
    capturedFilter = filter;
    return createQueryChain([]);
  });

  t.mock.method(Vendor, "countDocuments", async () => 0);

  const { server, baseUrl } = await startServer();

  try {
    const url = new URL(`${baseUrl}/api/vendors`);

    url.searchParams.set("categoryId", categoryId);
    url.searchParams.set("eventTypeId", eventTypeId);
    url.searchParams.set("city", "Mumbai");
    url.searchParams.set("search", "Photography");

    const response = await fetch(url);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.success, true);

    assert.equal(capturedFilter.approvalStatus, "approved");
    assert.equal(capturedFilter.isActive, true);
    assert.equal(capturedFilter.deletedAt, null);
    assert.equal(capturedFilter.categoryIds, categoryId);
    assert.equal(capturedFilter.eventTypeIds, eventTypeId);
    assert.equal(capturedFilter["location.city"].$options, "i");
    assert.equal(capturedFilter.$or.length, 2);
  } finally {
    await closeServer(server);
  }
});

// 3. Invalid category ID.
test("GET /api/vendors rejects an invalid category ID", async (t) => {
  const findMock = t.mock.method(Vendor, "find");

  const { server, baseUrl } = await startServer();

  try {
    const response = await fetch(
      `${baseUrl}/api/vendors?categoryId=123`,
    );
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.equal(body.success, false);
    assert.equal(body.message, "Invalid category ID.");
    assert.equal(findMock.mock.calls.length, 0);
  } finally {
    await closeServer(server);
  }
});

// 4. Event type vendor categories.
test("GET /api/event-types/:eventTypeId/vendor-categories returns active categories", async (t) => {
  const eventTypeId = new mongoose.Types.ObjectId();
  const categoryId = new mongoose.Types.ObjectId();

  const eventType = {
    _id: eventTypeId,
    name: "Wedding",
    slug: "wedding",
    vendorCategoryIds: [categoryId],
  };

  const categories = [
    {
      _id: categoryId,
      name: "Photography",
      slug: "photography",
    },
  ];

  t.mock.method(EventType, "findOne", () => ({
    lean: async () => eventType,
  }));

  let capturedCategoryFilter;

  t.mock.method(Category, "find", (filter) => {
    capturedCategoryFilter = filter;
    return createQueryChain(categories);
  });

  const { server, baseUrl } = await startServer();

  try {
    const response = await fetch(
      `${baseUrl}/api/event-types/${eventTypeId}/vendor-categories`,
    );
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.eventType.name, "Wedding");
    assert.equal(body.count, 1);
    assert.equal(body.data[0].name, "Photography");

    assert.equal(capturedCategoryFilter.isActive, true);
    assert.equal(capturedCategoryFilter.parentId, null);
  } finally {
    await closeServer(server);
  }
});

// 5. Invalid event type ID.
test("GET /api/event-types/:eventTypeId/vendor-categories rejects invalid IDs", async (t) => {
  const findOneMock = t.mock.method(EventType, "findOne");

  const { server, baseUrl } = await startServer();

  try {
    const response = await fetch(
      `${baseUrl}/api/event-types/123/vendor-categories`,
    );
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.equal(body.success, false);
    assert.equal(body.message, "Invalid event type ID.");
    assert.equal(findOneMock.mock.calls.length, 0);
  } finally {
    await closeServer(server);
  }
});

// 6. Non-existing or inactive event type.
test("GET /api/event-types/:eventTypeId/vendor-categories returns 404 when event type is unavailable", async (t) => {
  const eventTypeId = new mongoose.Types.ObjectId();

  t.mock.method(EventType, "findOne", () => ({
    lean: async () => null,
  }));

  const categoryFindMock = t.mock.method(Category, "find");

  const { server, baseUrl } = await startServer();

  try {
    const response = await fetch(
      `${baseUrl}/api/event-types/${eventTypeId}/vendor-categories`,
    );
    const body = await response.json();

    assert.equal(response.status, 404);
    assert.equal(body.success, false);
    assert.equal(body.message, "Event type not found.");
    assert.equal(categoryFindMock.mock.calls.length, 0);
  } finally {
    await closeServer(server);
  }
});

// 7. Public event type listing.
test("GET /api/event-types returns active event types without authentication", async (t) => {
  const eventTypes = [
    { name: "Wedding", slug: "wedding", description: "Wedding events" },
    { name: "Birthday", slug: "birthday", description: "Birthday events" },
  ];

  t.mock.method(EventType, "find", () => createQueryChain(eventTypes));

  const { server, baseUrl } = await startServer();

  try {
    const response = await fetch(`${baseUrl}/api/event-types`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.count, 2);
    assert.equal(body.data[0].name, "Wedding");
  } finally {
    await closeServer(server);
  }
});

// 8. Public main vendor categories using both supported paths.
test("GET category routes return active main categories without authentication", async (t) => {
  const categories = [
    { name: "Photography", slug: "photography" },
    { name: "Catering", slug: "catering" },
  ];

  const findMock = t.mock.method(
    Category,
    "find",
    () => createQueryChain(categories),
  );

  const { server, baseUrl } = await startServer();

  try {
    for (const path of ["/api/categories", "/api/vendor-categories"]) {
      const response = await fetch(`${baseUrl}${path}`);
      const body = await response.json();

      assert.equal(response.status, 200);
      assert.equal(body.success, true);
      assert.equal(body.count, 2);
      assert.equal(body.data[0].name, "Photography");
    }

    assert.equal(findMock.mock.calls.length, 2);
  } finally {
    await closeServer(server);
  }
});

// 9. Public services under a main vendor category.
test("GET /api/vendor-categories/:id/services returns active services", async (t) => {
  const categoryId = new mongoose.Types.ObjectId();

  const services = [
    { name: "Wedding Photography", slug: "wedding-photography" },
    { name: "Pre-wedding Photography", slug: "pre-wedding-photography" },
  ];

  t.mock.method(Category, "findOne", () => ({
    lean: async () => ({
      _id: categoryId,
      name: "Photography",
      parentId: null,
      isActive: true,
    }),
  }));

  let capturedFilter;

  t.mock.method(Category, "find", (filter) => {
    capturedFilter = filter;
    return createQueryChain(services);
  });

  const { server, baseUrl } = await startServer();

  try {
    const response = await fetch(
      `${baseUrl}/api/vendor-categories/${categoryId}/services`,
    );
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.count, 2);
    assert.equal(body.data[0].name, "Wedding Photography");

    assert.equal(capturedFilter.parentId, categoryId.toString());
    assert.equal(capturedFilter.isActive, true);
  } finally {
    await closeServer(server);
  }
});

// 10. Invalid category ID for services.
test("GET /api/vendor-categories/:id/services rejects invalid IDs", async (t) => {
  const findOneMock = t.mock.method(Category, "findOne");

  const { server, baseUrl } = await startServer();

  try {
    const response = await fetch(
      `${baseUrl}/api/vendor-categories/123/services`,
    );
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.equal(body.success, false);
    assert.equal(body.message, "Invalid category ID.");
    assert.equal(findOneMock.mock.calls.length, 0);
  } finally {
    await closeServer(server);
  }
});

