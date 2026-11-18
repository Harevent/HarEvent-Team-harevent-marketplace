const test = require("node:test");
const assert = require("node:assert/strict");

const mongoose = require("mongoose");

const User = require("../models/User");
const Vendor = require("../models/Vendor");
const Category = require("../models/Category");
const EventType = require("../models/EventType");

const {
  registerVendor,
} = require("../controllers/vendorController");

const categoryId = new mongoose.Types.ObjectId().toString();
const eventTypeId = new mongoose.Types.ObjectId().toString();
const serviceId = new mongoose.Types.ObjectId().toString();

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

function createMockRequest(body = validVendorData()) {
  return {
    body,
    firebaseUser: {
      firebaseUid: "verified-vendor-firebase-uid",
      phoneNumber: "+919876543210",
    },
  };
}

function validVendorData() {
  return {
    fullName: "Test Vendor",
    email: "vendor@example.com",
    businessName: "Test Events",
    description: "Event services",
    categoryIds: [categoryId],
    eventTypeIds: [eventTypeId],
    contactPhone: "+919876543210",
    contactEmail: "business@example.com",
    location: {
      address: "Test Road",
      city: "Mumbai",
      state: "Maharashtra",
      country: "India",
    },
    serviceAreas: ["Mumbai"],
    startingPrice: 5000,
  };
}

async function runController(
  req,
  t,
  options = {},
) {
  const res = createMockResponse();
  let nextError = null;

  const existingUsers = options.existingUsers || [];

  const session = {
    withTransaction: async (callback) => {
      await callback();

      if (options.transactionError) {
        throw options.transactionError;
      }
    },

    endSession: async () => {
      if (options.onEndSession) {
        options.onEndSession();
      }
    },
  };

  t.mock.method(User, "find", (query) => ({
    select: async () =>
      existingUsers.filter((user) =>
        query.$or.some((condition) =>
          Object.entries(condition).some(
            ([field, value]) => user[field] === value,
          ),
        ),
      ),
  }));

  t.mock.method(Category, "find", (query) => ({
    select: async () => {
      if (query.parentId === null) {
        return options.categories || [
          { _id: new mongoose.Types.ObjectId(categoryId) },
        ];
      }

      return options.services || [];
    },
  }));

  t.mock.method(EventType, "find", () => ({
    select: async () =>
      options.eventTypes || [
        {
          _id: new mongoose.Types.ObjectId(eventTypeId),
          vendorCategoryIds: [
            new mongoose.Types.ObjectId(categoryId),
          ],
        },
      ],
  }));

  t.mock.method(mongoose, "startSession", async () => session);

  await registerVendor(req, res, (error) => {
    nextError = error;
  });

  return { res, nextError };
}

// 1. Invalid request data.
test("invalid vendor data returns 400", async (t) => {
  const startSession = t.mock.method(mongoose, "startSession");

  const { res } = await runController(
    createMockRequest({ fullName: "" }),
    t,
  );

  assert.equal(res.statusCode, 400);
  assert.equal(res.responseBody.success, false);
  assert.equal(startSession.mock.calls.length, 0);
});

// 2. Successful vendor registration.
test("vendor registration creates User and Vendor records", async (t) => {
  const userId = new mongoose.Types.ObjectId();
  const vendorId = new mongoose.Types.ObjectId();

  let createdUserData;
  let createdVendorData;
  let sessionEnded = false;

  t.mock.method(User, "create", async (documents) => {
    createdUserData = documents[0];

    return [{ ...documents[0], _id: userId }];
  });

  t.mock.method(Vendor, "create", async (documents) => {
    createdVendorData = documents[0];

    return [{
      ...documents[0],
      _id: vendorId,
    }];
  });

  const { res, nextError } = await runController(
    createMockRequest(),
    t,
    {
      onEndSession: () => {
        sessionEnded = true;
      },
    },
  );

  assert.equal(nextError, null);
  assert.equal(res.statusCode, 201);
  assert.equal(res.responseBody.success, true);

  assert.equal(createdUserData.firebaseUid, "verified-vendor-firebase-uid");
  assert.equal(createdUserData.phoneNumber, "+919876543210");
  assert.equal(createdUserData.fullName, "Test Vendor");
  assert.equal(createdUserData.role, "vendor");

  assert.equal(createdVendorData.userId.toString(), userId.toString());
  assert.equal(createdVendorData.businessName, "Test Events");
  assert.equal(createdVendorData.approvalStatus, "pending");
  assert.equal(createdVendorData.isActive, false);
  assert.ok(createdVendorData.publicVendorId);

  assert.equal(res.responseBody.data.userId.toString(), userId.toString());
  assert.equal(res.responseBody.data.vendorId.toString(), vendorId.toString());
  assert.equal(res.responseBody.data.role, "vendor");
  assert.equal(res.responseBody.data.approvalStatus, "pending");

  assert.equal(sessionEnded, true);
});

// 3. Existing customer identity.
test("identity belonging to customer returns 403", async (t) => {
  const { res } = await runController(
    createMockRequest(),
    t,
    {
      existingUsers: [
        {
          firebaseUid: "verified-vendor-firebase-uid",
          phoneNumber: "+919876543210",
          role: "customer",
        },
      ],
    },
  );

  assert.equal(res.statusCode, 403);
  assert.equal(res.responseBody.success, false);
});

// 4. Existing admin identity.
test("identity belonging to admin returns 403", async (t) => {
  const { res } = await runController(
    createMockRequest(),
    t,
    {
      existingUsers: [
        {
          firebaseUid: "verified-vendor-firebase-uid",
          phoneNumber: "+919876543210",
          role: "admin",
        },
      ],
    },
  );

  assert.equal(res.statusCode, 403);
  assert.equal(res.responseBody.success, false);
});

// 5. Existing vendor identity.
test("existing vendor identity returns 409", async (t) => {
  const { res } = await runController(
    createMockRequest(),
    t,
    {
      existingUsers: [
        {
          firebaseUid: "verified-vendor-firebase-uid",
          phoneNumber: "+919876543210",
          role: "vendor",
        },
      ],
    },
  );

  assert.equal(res.statusCode, 409);
});

// 6. Invalid or inactive main category.
test("invalid main category returns 400", async (t) => {
  const { res } = await runController(
    createMockRequest(),
    t,
    { categories: [] },
  );

  assert.equal(res.statusCode, 400);
  assert.match(res.responseBody.message, /categories/i);
});

// 7. Invalid or inactive event type.
test("invalid event type returns 400", async (t) => {
  const { res } = await runController(
    createMockRequest(),
    t,
    { eventTypes: [] },
  );

  assert.equal(res.statusCode, 400);
  assert.match(res.responseBody.message, /event types/i);
});

// 8. Category incompatible with selected event type.
test("incompatible category and event type returns 400", async (t) => {
  const anotherCategoryId = new mongoose.Types.ObjectId().toString();

  const body = validVendorData();
  body.categoryIds = [anotherCategoryId];

  const { res } = await runController(
    createMockRequest(body),
    t,
    {
      categories: [
        { _id: new mongoose.Types.ObjectId(anotherCategoryId) },
      ],
      eventTypes: [
        {
          _id: new mongoose.Types.ObjectId(eventTypeId),
          vendorCategoryIds: [
            new mongoose.Types.ObjectId(categoryId),
          ],
        },
      ],
    },
  );

  assert.equal(res.statusCode, 400);
  assert.match(res.responseBody.message, /not available/i);
});

// 9. Service must belong to selected main category.
test("service belonging to another category returns 400", async (t) => {
  const anotherCategoryId = new mongoose.Types.ObjectId().toString();

  const body = validVendorData();
  body.selectedCategories = [
    {
      categoryId,
      serviceIds: [serviceId],
    },
  ];

  const { res } = await runController(
    createMockRequest(body),
    t,
    {
      services: [
        {
          _id: new mongoose.Types.ObjectId(serviceId),
          parentId: new mongoose.Types.ObjectId(anotherCategoryId),
        },
      ],
    },
  );

  assert.equal(res.statusCode, 400);
  assert.match(res.responseBody.message, /services/i);
});

// 10. Selected service category must be in categoryIds.
test("unselected main category in selectedCategories returns 400", async (t) => {
  const anotherCategoryId = new mongoose.Types.ObjectId().toString();

  const body = validVendorData();
  body.selectedCategories = [
    {
      categoryId: anotherCategoryId,
      serviceIds: [],
    },
  ];

  const { res } = await runController(
    createMockRequest(body),
    t,
  );

  assert.equal(res.statusCode, 400);
  assert.match(res.responseBody.message, /categoryIds/i);
});

// 11. Duplicate key error.
test("duplicate database key returns 409", async (t) => {
  const duplicateError = Object.assign(
    new Error("Duplicate key"),
    { code: 11000 },
  );

  let sessionEnded = false;

  t.mock.method(User, "create", async () => {
    throw duplicateError;
  });

  const { res, nextError } = await runController(
    createMockRequest(),
    t,
    {
      onEndSession: () => {
        sessionEnded = true;
      },
    },
  );

  assert.equal(nextError, null);
  assert.equal(res.statusCode, 409);
  assert.equal(sessionEnded, true);
});

// 12. Unexpected database error.
test("unexpected database error is passed to next", async (t) => {
  const databaseError = new Error("Database unavailable");

  t.mock.method(User, "create", async () => {
    throw databaseError;
  });

  const { res, nextError } = await runController(
    createMockRequest(),
    t,
  );

  assert.equal(res.statusCode, null);
  assert.equal(nextError, databaseError);
});

// 13. Transaction failure.
test("transaction failure is passed to next and ends session", async (t) => {
  const transactionError = new Error("Transaction commit failed");
  let sessionEnded = false;

  t.mock.method(User, "create", async (documents) => [
    {
      ...documents[0],
      _id: new mongoose.Types.ObjectId(),
    },
  ]);

  t.mock.method(Vendor, "create", async (documents) => [
    {
      ...documents[0],
      _id: new mongoose.Types.ObjectId(),
    },
  ]);

  const { res, nextError } = await runController(
    createMockRequest(),
    t,
    {
      transactionError,
      onEndSession: () => {
        sessionEnded = true;
      },
    },
  );

  assert.equal(res.statusCode, null);
  assert.equal(nextError, transactionError);
  assert.equal(sessionEnded, true);
});
