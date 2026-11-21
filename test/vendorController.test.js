const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");

const User = require("../models/User");
const Vendor = require("../models/Vendor");
const Category = require("../models/Category");
const EventType = require("../models/EventType");

const {
  registerVendor,
  getMyVendorProfile,
  updateMyVendorProfile,
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

async function runController(req, t, options = {}) {
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

  // Registration mock: retain the original behavior.
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

// --------------------------------------------------
// Vendor registration tests
// --------------------------------------------------

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
    return [{ ...documents[0], _id: vendorId }];
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

test("invalid main category returns 400", async (t) => {
  const { res } = await runController(
    createMockRequest(),
    t,
    { categories: [] },
  );

  assert.equal(res.statusCode, 400);
  assert.match(res.responseBody.message, /categories/i);
});

test("invalid event type returns 400", async (t) => {
  const { res } = await runController(
    createMockRequest(),
    t,
    { eventTypes: [] },
  );

  assert.equal(res.statusCode, 400);
  assert.match(res.responseBody.message, /event types/i);
});

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

// --------------------------------------------------
// GET and PUT: Authenticated vendor profile tests
// --------------------------------------------------

function createMockVendorProfile(overrides = {}) {
  const vendor = {
    categoryIds: [new mongoose.Types.ObjectId(categoryId)],
    eventTypeIds: [new mongoose.Types.ObjectId(eventTypeId)],
    selectedCategories: [],
    businessName: "Test Events",
    description: "Original description",
    contactPhone: "+919876543210",
    contactEmail: "business@example.com",
    location: {
      address: "Test Road",
      city: "Mumbai",
      state: "Maharashtra",
      country: "India",
      toObject() {
        return {
          address: this.address,
          city: this.city,
          state: this.state,
          country: this.country,
        };
      },
    },
    serviceAreas: ["Mumbai"],
    startingPrice: 5000,
    approvalStatus: "pending",
    isActive: false,

    set(field, value) {
      this[field] = value;
    },

    save: async function () {},

    populate: async function () {
      return this;
    },

    ...overrides,
  };

  return vendor;
}

async function runProfileUpdate(req, t, vendor, options = {}) {
  t.mock.method(Vendor, "findOne", async () => vendor);

  t.mock.method(Category, "find", (filter) => ({
    select: async () => {
      if (filter.parentId === null) {
        return options.categories ?? [
          { _id: new mongoose.Types.ObjectId(categoryId) },
        ];
      }

      return options.services ?? [];
    },
  }));

  // Capture the query so tests can verify inactive event types
  // are not filtered out during unrelated profile updates.
  let eventTypeFindFilter;

  t.mock.method(EventType, "find", (filter) => {
    eventTypeFindFilter = filter;

    return {
      select: async () => {
        const defaultEventType = {
          _id: new mongoose.Types.ObjectId(eventTypeId),
          vendorCategoryIds: [
            new mongoose.Types.ObjectId(categoryId),
          ],
        };

        if (filter.isActive === true) {
          return options.activeEventTypes ?? [defaultEventType];
        }

        return options.eventTypes ?? [defaultEventType];
      },
    };
  });

  const res = createMockResponse();
  let nextError = null;

  await updateMyVendorProfile(req, res, (error) => {
    nextError = error;
  });

  return { res, nextError, eventTypeFindFilter };
}

function createProfileUpdateRequest(
  body = { description: "Updated description" },
) {
  return {
    body,
    user: {
      userId: new mongoose.Types.ObjectId().toString(),
    },
  };
}

test("GET vendor profile returns the authenticated vendor profile", async (t) => {
  const vendor = { businessName: "Test Events" };

  const query = {
    select() {
      return this;
    },
    populate() {
      return this;
    },
    lean: async () => vendor,
  };

  t.mock.method(Vendor, "findOne", () => query);

  const res = createMockResponse();
  let nextError = null;

  await getMyVendorProfile(
    { user: { userId: "test-user-id" } },
    res,
    (error) => {
      nextError = error;
    },
  );

  assert.equal(res.statusCode, 200);
  assert.equal(res.responseBody.success, true);
  assert.equal(res.responseBody.data, vendor);
  assert.equal(nextError, null);
});

test("GET vendor profile returns 404 when profile is not found", async (t) => {
  const query = {
    select() {
      return this;
    },
    populate() {
      return this;
    },
    lean: async () => null,
  };

  t.mock.method(Vendor, "findOne", () => query);

  const res = createMockResponse();

  await getMyVendorProfile(
    { user: { userId: "test-user-id" } },
    res,
    () => {},
  );

  assert.equal(res.statusCode, 404);
  assert.equal(res.responseBody.success, false);
});

test("GET vendor profile passes database errors to next", async (t) => {
  const databaseError = new Error("Database unavailable");

  t.mock.method(Vendor, "findOne", () => {
    throw databaseError;
  });

  const res = createMockResponse();
  let nextError = null;

  await getMyVendorProfile(
    { user: { userId: "test-user-id" } },
    res,
    (error) => {
      nextError = error;
    },
  );

  assert.equal(nextError, databaseError);
  assert.equal(res.statusCode, null);
});

test("PUT vendor profile updates permitted fields", async (t) => {
  const vendor = createMockVendorProfile();

  const { res, nextError } = await runProfileUpdate(
    createProfileUpdateRequest(),
    t,
    vendor,
  );

  assert.equal(res.statusCode, 200);
  assert.equal(res.responseBody.success, true);
  assert.equal(vendor.description, "Updated description");
  assert.equal(nextError, null);
});

test("PUT vendor profile returns 400 for an empty update", async (t) => {
  const vendor = createMockVendorProfile();

  const { res } = await runProfileUpdate(
    createProfileUpdateRequest({}),
    t,
    vendor,
  );

  assert.equal(res.statusCode, 400);
  assert.equal(res.responseBody.success, false);
});

test("PUT preserves approved vendor status after profile update", async (t) => {
  const vendor = createMockVendorProfile({
    approvalStatus: "approved",
    isActive: true,
  });

  const { res } = await runProfileUpdate(
    createProfileUpdateRequest(),
    t,
    vendor,
  );

  assert.equal(res.statusCode, 200);
  assert.equal(vendor.approvalStatus, "approved");
  assert.equal(vendor.isActive, true);
});

test("PUT keeps pending vendor status unchanged", async (t) => {
  const vendor = createMockVendorProfile({
    approvalStatus: "pending",
    isActive: false,
  });

  const { res } = await runProfileUpdate(
    createProfileUpdateRequest(),
    t,
    vendor,
  );

  assert.equal(res.statusCode, 200);
  assert.equal(vendor.approvalStatus, "pending");
  assert.equal(vendor.isActive, false);
});

test("PUT keeps rejected vendor status unchanged", async (t) => {
  const vendor = createMockVendorProfile({
    approvalStatus: "rejected",
    isActive: false,
  });

  const { res } = await runProfileUpdate(
    createProfileUpdateRequest(),
    t,
    vendor,
  );

  assert.equal(res.statusCode, 200);
  assert.equal(vendor.approvalStatus, "rejected");
  assert.equal(vendor.isActive, false);
});

test("PUT vendor profile passes database errors to next", async (t) => {
  const databaseError = new Error("Database unavailable");

  t.mock.method(Vendor, "findOne", async () => {
    throw databaseError;
  });

  const res = createMockResponse();
  let nextError = null;

  await updateMyVendorProfile(
    createProfileUpdateRequest(),
    res,
    (error) => {
      nextError = error;
    },
  );

  assert.equal(nextError, databaseError);
  assert.equal(res.statusCode, null);
});

test("PUT allows unrelated profile updates when existing category and service are inactive", async (t) => {
  const inactiveServiceId = new mongoose.Types.ObjectId();

  const vendor = createMockVendorProfile({
    selectedCategories: [
      {
        categoryId: new mongoose.Types.ObjectId(categoryId),
        serviceIds: [inactiveServiceId],
      },
    ],
  });

  const { res, nextError } = await runProfileUpdate(
    createProfileUpdateRequest(),
    t,
    vendor,
    {
      categories: [],
      services: [],
    },
  );

  assert.equal(res.statusCode, 200);
  assert.equal(vendor.description, "Updated description");

  assert.equal(vendor.categoryIds[0].toString(), categoryId);

  assert.equal(
    vendor.selectedCategories[0].serviceIds[0].toString(),
    inactiveServiceId.toString(),
  );

  assert.equal(nextError, null);
});

test("PUT rejects an inactive category when category selection is updated", async (t) => {
  const vendor = createMockVendorProfile();

  const { res } = await runProfileUpdate(
    createProfileUpdateRequest({
      categoryIds: [categoryId],
    }),
    t,
    vendor,
    {
      categories: [],
    },
  );

  assert.equal(res.statusCode, 400);
  assert.equal(res.responseBody.success, false);
});

test("PUT rejects an inactive service when service selection is updated", async (t) => {
  const inactiveServiceId = new mongoose.Types.ObjectId();

  const vendor = createMockVendorProfile();

  const { res } = await runProfileUpdate(
    createProfileUpdateRequest({
      selectedCategories: [
        {
          categoryId,
          serviceIds: [inactiveServiceId.toString()],
        },
      ],
    }),
    t,
    vendor,
    {
      services: [],
    },
  );

  assert.equal(res.statusCode, 400);
  assert.equal(res.responseBody.success, false);
});

// --------------------------------------------------
// Event type lifecycle regression tests
// --------------------------------------------------

test("PUT allows unrelated profile updates when an existing event type is inactive", async (t) => {
  const existingEventType = {
    _id: new mongoose.Types.ObjectId(eventTypeId),
    isActive: false, // Explicitly inactive
    vendorCategoryIds: [
      new mongoose.Types.ObjectId(categoryId),
    ],
  };

  const vendor = createMockVendorProfile({
    eventTypeIds: [new mongoose.Types.ObjectId(eventTypeId)],
  });

  const { res, nextError, eventTypeFindFilter } = await runProfileUpdate(
    createProfileUpdateRequest({
      description: "Updated description",
    }),
    t,
    vendor,
    {
      eventTypes: [existingEventType],
    },
  );

  assert.equal(res.statusCode, 200);
  assert.equal(res.responseBody.success, true);
  assert.equal(vendor.description, "Updated description");

  assert.equal(
    vendor.eventTypeIds[0].toString(),
    eventTypeId,
  );

  // Confirm that the query does NOT require active event types
  // when the vendor is only updating an unrelated field.
  assert.equal(
    Object.hasOwn(eventTypeFindFilter, "isActive"),
    false,
    "Unrelated profile updates must not filter event types by isActive",
  );

  assert.equal(nextError, null);
});

test("PUT rejects an inactive event type when event type selection is updated", async (t) => {
  const vendor = createMockVendorProfile();

  const { res } = await runProfileUpdate(
    createProfileUpdateRequest({
      eventTypeIds: [eventTypeId],
    }),
    t,
    vendor,
    {
      activeEventTypes: [],
    },
  );

  assert.equal(res.statusCode, 400);
  assert.equal(res.responseBody.success, false);
  assert.match(res.responseBody.message, /event types/i);
});