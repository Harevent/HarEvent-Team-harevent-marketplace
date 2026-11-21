const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { randomUUID, randomInt } = require("node:crypto");

const User = require("../models/User");
const Vendor = require("../models/Vendor");
const Category = require("../models/Category");
const EventType = require("../models/EventType");

const {
  registerVendor,
} = require("../controllers/vendorController");

const DATABASE_NAME = "harevent_test";

function createTestIdentity() {
  const uniqueId = randomUUID();

  return {
    firebaseUid: `vendor-integration-${uniqueId}`,
    phoneNumber: `+919${randomInt(100000000, 1000000000)}`,
  };
}

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

function createMockRequest(identity, categoryId, eventTypeId) {
  return {
    firebaseUser: identity,

    body: {
      fullName: "Integration Test Vendor",
      email: `${identity.firebaseUid}@example.com`,
      businessName: "Integration Test Events",
      description: "Vendor registration integration test",
      categoryIds: [categoryId],
      eventTypeIds: [eventTypeId],
      contactPhone: identity.phoneNumber,
      contactEmail: `${identity.firebaseUid}@business.example.com`,
      location: {
        address: "Test Address",
        city: "Mumbai",
        state: "Maharashtra",
        country: "India",
      },
      serviceAreas: ["Mumbai"],
      startingPrice: 10000,
    },
  };
}

// Connect only to the explicitly approved test database.
before(async () => {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("Integration tests require NODE_ENV=test");
  }

  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error("MONGODB_URI is missing");
  }

  const databaseName = decodeURIComponent(
    new URL(uri).pathname.replace(/^\/+/, ""),
  );

  if (databaseName !== DATABASE_NAME) {
    throw new Error(
      `Unsafe database target: expected ${DATABASE_NAME}, got ${databaseName}`,
    );
  }

  await mongoose.connect(uri);

  if (mongoose.connection.name !== DATABASE_NAME) {
    await mongoose.disconnect();
    throw new Error(
      "Connected database does not match the approved test database",
    );
  }

  console.log(`Connected to ${DATABASE_NAME} for vendor integration tests`);
});

// Disconnect after the test.
after(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
});

// Delete only records belonging to this test's unique identity.
async function cleanupTestRecords(identity) {
  const user = await User.findOne({
    firebaseUid: identity.firebaseUid,
    phoneNumber: identity.phoneNumber,
  }).select("_id");

  if (user) {
    await Vendor.deleteMany({ userId: user._id });
  }

  await User.deleteMany({
    firebaseUid: identity.firebaseUid,
    phoneNumber: identity.phoneNumber,
  });
}

test("successful vendor registration creates pending User and Vendor records", async () => {
  const identity = createTestIdentity();

  try {
    // Find an existing active main category.
    const category = await Category.findOne({
      parentId: null,
      isActive: true,
    }).select("_id");

    assert.ok(
      category,
      "harevent_test must contain an active main vendor category",
    );

    // Find an active EventType compatible with that category.
    const eventType = await EventType.findOne({
      isActive: true,
      vendorCategoryIds: category._id,
    }).select("_id");

    assert.ok(
      eventType,
      "harevent_test must contain an active EventType mapped to the selected category",
    );

    const req = createMockRequest(
      identity,
      category._id.toString(),
      eventType._id.toString(),
    );

    const res = createMockResponse();

    let nextError = null;

    await registerVendor(req, res, (error) => {
      nextError = error;
    });

    assert.equal(nextError, null, "Controller should not forward an error");
    assert.equal(res.statusCode, 201);
    assert.equal(res.responseBody.success, true);

    const savedUser = await User.findOne({
      firebaseUid: identity.firebaseUid,
    });

    assert.ok(savedUser, "Vendor User record should exist in MongoDB");
    assert.equal(savedUser.phoneNumber, identity.phoneNumber);
    assert.equal(savedUser.role, "vendor");

    const savedVendor = await Vendor.findOne({
      userId: savedUser._id,
    });

    assert.ok(savedVendor, "Vendor profile should exist in MongoDB");
    assert.equal(savedVendor.businessName, "Integration Test Events");
    assert.equal(savedVendor.approvalStatus, "pending");
    assert.equal(savedVendor.isActive, false);
    assert.ok(savedVendor.publicVendorId);

    assert.equal(
      String(res.responseBody.data.userId),
      String(savedUser._id),
    );

    assert.equal(
      String(res.responseBody.data.vendorId),
      String(savedVendor._id),
    );

    assert.equal(
      res.responseBody.data.approvalStatus,
      "pending",
    );

    assert.equal(
      res.responseBody.data.isActive,
      false,
    );
  } finally {
    await cleanupTestRecords(identity);
  }
});
