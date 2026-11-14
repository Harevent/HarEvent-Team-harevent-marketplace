const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const Enquiry = require("../models/Enquiry");
const SubscriptionPlan = require("../models/SubscriptionPlan");
const PackageCategoryPrice = require("../models/PackageCategoryPrice");
const VendorSubscription = require("../models/VendorSubscription");

const objectId = () => new mongoose.Types.ObjectId();

function enquiryData(overrides = {}) {
  return {
    customerId: objectId(),
    vendorId: objectId(),
    customerNameSnapshot: "Customer Name",
    customerPhoneSnapshot: "+919812345678",
    eventTypeId: objectId(),
    eventDate: new Date("2026-11-12"),
    budget: 0,
    ...overrides,
  };
}

function subscriptionData(overrides = {}) {
  const categoryId = objectId();
  return {
    vendorId: objectId(),
    planId: objectId(),
    selectedCategoryIds: [categoryId],
    priceBreakdown: [{ categoryId, amount: 100 }],
    finalAmount: 100,
    ...overrides,
  };
}

async function assertInvalid(Model, data, path) {
  await assert.rejects(new Model(data).validate(), (error) => {
    assert.ok(
      error?.errors[path],
      `Expected a validation error for ${Model.modelName}.${path}`,
    );
    return true;
  });
}

test("an enquiry accepts required details, a zero budget, and no optional email", async () => {
  const enquiry = new Enquiry(enquiryData());
  assert.equal(await enquiry.validate(), undefined);
  assert.equal(enquiry.status, "pending");
  assert.equal(enquiry.email, undefined);
  assert.equal(enquiry.statusUpdatedAt, null);
  assert.deepEqual(enquiry.requiredServices, []);
});

test("enquiries reject missing identity, event, and budget fields", async () => {
  for (const field of [
    "customerId",
    "vendorId",
    "customerNameSnapshot",
    "customerPhoneSnapshot",
    "eventTypeId",
    "eventDate",
    "budget",
  ]) {
    await assertInvalid(Enquiry, enquiryData({ [field]: undefined }), field);
  }
  for (const field of ["customerId", "vendorId", "eventTypeId"]) {
    await assertInvalid(
      Enquiry,
      enquiryData({ [field]: "invalid-object-id" }),
      field,
    );
  }
  await assertInvalid(
    Enquiry,
    enquiryData({ eventDate: "invalid-date" }),
    "eventDate",
  );
  await assertInvalid(
    Enquiry,
    enquiryData({ customerNameSnapshot: "  " }),
    "customerNameSnapshot",
  );
});

test("enquiry contact snapshots validate E.164 phone and optional email", async () => {
  for (const phone of ["9812345678", "+09812345678", "+91 9812345678"]) {
    await assertInvalid(
      Enquiry,
      enquiryData({ customerPhoneSnapshot: phone }),
      "customerPhoneSnapshot",
    );
  }
  for (const email of [undefined, null, "", "   ", " CUSTOMER@EXAMPLE.COM "]) {
    const enquiry = new Enquiry(enquiryData({ email }));
    assert.equal(await enquiry.validate(), undefined);
    if (email?.includes("@"))
      assert.equal(enquiry.email, "customer@example.com");
  }
  await assertInvalid(
    Enquiry,
    enquiryData({ email: "invalid-email" }),
    "email",
  );
});

test("enquiries enforce documented statuses, counts, amounts, and message length", async () => {
  for (const status of [
    "pending",
    "viewed",
    "accepted",
    "rejected",
    "cancelled",
  ]) {
    assert.equal(
      await new Enquiry(enquiryData({ status })).validate(),
      undefined,
    );
  }
  await assertInvalid(Enquiry, enquiryData({ status: "completed" }), "status");
  for (const guestCount of [0, -1, 1.5, Infinity]) {
    await assertInvalid(Enquiry, enquiryData({ guestCount }), "guestCount");
  }
  for (const budget of [-1, Infinity, NaN]) {
    await assertInvalid(Enquiry, enquiryData({ budget }), "budget");
  }
  assert.equal(
    await new Enquiry(
      enquiryData({ guestCount: 1, message: "x".repeat(5000) }),
    ).validate(),
    undefined,
  );
  await assertInvalid(
    Enquiry,
    enquiryData({ message: "x".repeat(5001) }),
    "message",
  );
});

test("enquiries reject duplicate, null, and malformed required service IDs", async () => {
  const serviceId = objectId();
  await assertInvalid(
    Enquiry,
    enquiryData({ requiredServices: [serviceId, serviceId] }),
    "requiredServices",
  );
  await assertInvalid(
    Enquiry,
    enquiryData({ requiredServices: [null] }),
    "requiredServices",
  );
  await assertInvalid(
    Enquiry,
    enquiryData({ requiredServices: ["bad-id"] }),
    "requiredServices.0",
  );
  assert.equal(
    await new Enquiry(
      enquiryData({ requiredServices: [serviceId] }),
    ).validate(),
    undefined,
  );
});

test("existing enquiry snapshots remain unchanged while its status can change", async () => {
  const enquiry = Enquiry.hydrate({
    _id: objectId(),
    ...enquiryData({ email: "original@example.com" }),
  });
  enquiry.customerNameSnapshot = "Changed name";
  enquiry.customerPhoneSnapshot = "+919999999999";
  enquiry.email = "changed@example.com";
  enquiry.status = "viewed";
  assert.equal(enquiry.customerNameSnapshot, "Customer Name");
  assert.equal(enquiry.customerPhoneSnapshot, "+919812345678");
  assert.equal(enquiry.email, "original@example.com");
  assert.equal(enquiry.status, "viewed");
});

test("supported subscription plans normalize names and use the confirmed ranking", async () => {
  for (const [name, displayPriority] of [
    [" platinum ", 1],
    ["gold", 2],
    ["BASIC", 3],
  ]) {
    const plan = new SubscriptionPlan({ name });
    assert.equal(await plan.validate(), undefined);
    assert.equal(plan.name, name.trim().toUpperCase());
    assert.equal(plan.slug, name.trim().toLowerCase());
    assert.equal(plan.displayPriority, displayPriority);
    assert.equal(plan.currency, "INR");
    assert.equal(plan.isActive, true);
    assert.equal(plan.billingPeriod, undefined);
    assert.equal(plan.priceAmount, plan.name === "BASIC" ? 0 : undefined);
    assert.equal(plan.features.entitlements.size, 0);
    assert.equal(plan.features.limits.size, 0);
  }
});

test("unsupported packages, incorrect ranking, and nonzero BASIC prices are rejected", async () => {
  for (const name of ["Growth", "Premium", "Elite", "Free", ""]) {
    await assertInvalid(SubscriptionPlan, { name }, "name");
  }
  await assertInvalid(
    SubscriptionPlan,
    { name: "GOLD", displayPriority: 1 },
    "displayPriority",
  );
  for (const priceAmount of [1, -1, null, Infinity]) {
    await assertInvalid(
      SubscriptionPlan,
      { name: "BASIC", priceAmount },
      "priceAmount",
    );
  }
  await assertInvalid(
    SubscriptionPlan,
    { name: "GOLD", priceAmount: -1 },
    "priceAmount",
  );
  await assertInvalid(
    SubscriptionPlan,
    { name: "GOLD", priceAmount: Infinity },
    "priceAmount",
  );
  await assertInvalid(
    SubscriptionPlan,
    { name: "GOLD", billingPeriod: "weekly" },
    "billingPeriod",
  );
});

test("approved plan entitlements and limits can be configured without seeded benefits", async () => {
  const plan = new SubscriptionPlan({
    name: "GOLD",
    billingPeriod: "yearly",
    features: {
      entitlements: { analyticsDashboard: false },
      limits: { photoAlbums: 10, brochures: 0 },
    },
  });
  assert.equal(await plan.validate(), undefined);
  assert.equal(plan.features.entitlements.get("analyticsDashboard"), false);
  assert.equal(plan.features.limits.get("photoAlbums"), 10);
  for (const count of [-1, 1.5, Infinity, null]) {
    await assertInvalid(
      SubscriptionPlan,
      { name: "GOLD", features: { limits: { photoAlbums: count } } },
      "features.limits.photoAlbums",
    );
  }
  await assertInvalid(
    SubscriptionPlan,
    { name: "GOLD", features: { unrecognizedField: true } },
    "features",
  );
});

test("category prices require plan/category references and finite nonnegative amounts", async () => {
  const data = { planId: objectId(), categoryId: objectId(), amount: 0 };
  const price = new PackageCategoryPrice(data);
  assert.equal(await price.validate(), undefined);
  assert.equal(price.currency, "INR");
  assert.equal(price.isActive, true);
  for (const field of ["planId", "categoryId", "amount"]) {
    await assertInvalid(
      PackageCategoryPrice,
      { ...data, [field]: undefined },
      field,
    );
  }
  for (const field of ["planId", "categoryId"]) {
    await assertInvalid(
      PackageCategoryPrice,
      { ...data, [field]: "bad-id" },
      field,
    );
  }
  for (const amount of [-1, Infinity, NaN]) {
    await assertInvalid(PackageCategoryPrice, { ...data, amount }, "amount");
  }
});

test("a pending subscription stores a price snapshot without assuming dates or a gateway", async () => {
  const subscription = new VendorSubscription(subscriptionData());
  assert.equal(await subscription.validate(), undefined);
  assert.equal(subscription.status, "pending");
  assert.equal(subscription.startsAt, null);
  assert.equal(subscription.expiresAt, null);
  assert.equal(subscription.paymentId, undefined);
  assert.equal(subscription.priceBreakdown[0].currency, "INR");
  assert.equal(subscription.priceBreakdown[0]._id, undefined);
});

test("subscriptions require vendor, plan, categories, and a finite nonnegative final amount", async () => {
  for (const field of [
    "vendorId",
    "planId",
    "selectedCategoryIds",
    "finalAmount",
  ]) {
    await assertInvalid(
      VendorSubscription,
      subscriptionData({ [field]: undefined }),
      field,
    );
  }
  for (const field of ["vendorId", "planId"]) {
    await assertInvalid(
      VendorSubscription,
      subscriptionData({ [field]: "bad-id" }),
      field,
    );
  }
  for (const finalAmount of [-1, Infinity, NaN]) {
    await assertInvalid(
      VendorSubscription,
      subscriptionData({ finalAmount }),
      "finalAmount",
    );
  }
  assert.equal(
    await new VendorSubscription(
      subscriptionData({ finalAmount: 0 }),
    ).validate(),
    undefined,
  );
});

test("subscription categories and breakdown entries must be unique and consistent", async () => {
  const data = subscriptionData();
  const categoryId = data.selectedCategoryIds[0];
  for (const selectedCategoryIds of [[], [null], [categoryId, categoryId]]) {
    await assertInvalid(
      VendorSubscription,
      { ...data, selectedCategoryIds },
      "selectedCategoryIds",
    );
  }
  await assertInvalid(
    VendorSubscription,
    { ...data, selectedCategoryIds: ["bad-id"] },
    "selectedCategoryIds.0",
  );
  await assertInvalid(
    VendorSubscription,
    {
      ...data,
      priceBreakdown: [data.priceBreakdown[0], data.priceBreakdown[0]],
    },
    "priceBreakdown",
  );
  await assertInvalid(
    VendorSubscription,
    { ...data, priceBreakdown: [{ categoryId: objectId(), amount: 10 }] },
    "priceBreakdown",
  );
  await assertInvalid(
    VendorSubscription,
    { ...data, priceBreakdown: [{ categoryId }] },
    "priceBreakdown.0.amount",
  );
  await assertInvalid(
    VendorSubscription,
    { ...data, priceBreakdown: [{ categoryId, amount: -1 }] },
    "priceBreakdown.0.amount",
  );
  await assertInvalid(
    VendorSubscription,
    { ...data, priceBreakdown: [{ categoryId, amount: Infinity }] },
    "priceBreakdown.0.amount",
  );
});

test("subscription totals do not assume an unapproved multi-category sum formula", async () => {
  const firstCategory = objectId();
  const secondCategory = objectId();
  const subscription = new VendorSubscription(
    subscriptionData({
      selectedCategoryIds: [firstCategory, secondCategory],
      priceBreakdown: [
        { categoryId: firstCategory, amount: 100 },
        { categoryId: secondCategory, amount: 50 },
      ],
      finalAmount: 120,
    }),
  );
  assert.equal(await subscription.validate(), undefined);
});

test("active subscriptions require a start date and reject reversed expiry dates", async () => {
  const startsAt = new Date("2027-01-01");
  await assertInvalid(
    VendorSubscription,
    subscriptionData({ status: "active" }),
    "startsAt",
  );
  for (const expiresAt of [new Date("2026-12-31"), startsAt]) {
    await assertInvalid(
      VendorSubscription,
      subscriptionData({ status: "active", startsAt, expiresAt }),
      "expiresAt",
    );
  }
  for (const status of ["pending", "active", "expired", "cancelled"]) {
    assert.equal(
      await new VendorSubscription(
        subscriptionData({ status, startsAt }),
      ).validate(),
      undefined,
    );
  }
  await assertInvalid(
    VendorSubscription,
    subscriptionData({ status: "paid" }),
    "status",
  );
});

test("updating category prices does not rewrite existing subscription snapshots", async () => {
  const categoryId = objectId();
  const price = new PackageCategoryPrice({
    planId: objectId(),
    categoryId,
    amount: 100,
  });
  const subscription = VendorSubscription.hydrate({
    _id: objectId(),
    ...subscriptionData({
      planId: price.planId,
      selectedCategoryIds: [categoryId],
      priceBreakdown: [{ categoryId, amount: price.amount }],
    }),
  });
  price.amount = 200;
  subscription.finalAmount = 200;
  subscription.priceBreakdown[0].amount = 200;
  subscription.priceBreakdown = [];
  subscription.status = "cancelled";
  await subscription.validate();
  assert.equal(price.amount, 200);
  assert.equal(subscription.finalAmount, 100);
  assert.equal(subscription.priceBreakdown[0].amount, 100);
  assert.equal(subscription.status, "cancelled");
});

test("persisted subscriptions reject array mutations that bypass immutable setters", async () => {
  const subscription = VendorSubscription.hydrate({
    _id: objectId(),
    ...subscriptionData(),
  });
  subscription.priceBreakdown.pop();
  await assert.rejects(
    subscription.validate(),
    /purchase details are immutable/,
  );

  const categoryMutation = VendorSubscription.hydrate({
    _id: objectId(),
    ...subscriptionData(),
  });
  categoryMutation.selectedCategoryIds.push(objectId());
  await assert.rejects(
    categoryMutation.validate(),
    /purchase details are immutable/,
  );
});

test("schemas declare unique pricing, one-active-subscription, and enquiry listing indexes", async () => {
  const hasIndex = (Model, fields, options = {}) =>
    Model.schema
      .indexes()
      .some(
        ([actualFields, actualOptions]) =>
          JSON.stringify(actualFields) === JSON.stringify(fields) &&
          Object.entries(options).every(
            ([key, value]) =>
              JSON.stringify(actualOptions[key]) === JSON.stringify(value),
          ),
      );
  assert.ok(hasIndex(SubscriptionPlan, { name: 1 }, { unique: true }));
  assert.ok(hasIndex(SubscriptionPlan, { slug: 1 }, { unique: true }));
  assert.ok(
    hasIndex(
      PackageCategoryPrice,
      { planId: 1, categoryId: 1 },
      { unique: true },
    ),
  );
  assert.ok(
    hasIndex(
      VendorSubscription,
      { vendorId: 1 },
      { unique: true, partialFilterExpression: { status: "active" } },
    ),
  );
  assert.ok(
    hasIndex(VendorSubscription, { vendorId: 1, status: 1, createdAt: -1 }),
  );
  assert.ok(hasIndex(Enquiry, { customerId: 1, createdAt: -1 }));
  assert.ok(hasIndex(Enquiry, { vendorId: 1, createdAt: -1 }));
  for (const Model of [
    Enquiry,
    SubscriptionPlan,
    PackageCategoryPrice,
    VendorSubscription,
  ]) {
    assert.equal(Model.schema.options.timestamps, true);
  }
});
