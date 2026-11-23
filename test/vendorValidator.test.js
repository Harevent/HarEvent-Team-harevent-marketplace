
const test = require("node:test");
const assert = require("node:assert/strict");

const {
  vendorRegistrationSchema
} = require("../validators/vendorValidator");

const validVendor = {
  fullName: "Test Vendor",
  email: "vendor@example.com",
  businessName: "Royal Events",
  description: "Wedding and event services",
  categoryIds: ["6af81107853bb4f9f14911f4"],
  selectedCategories: [
    {
      categoryId: "6af81107853bb4f9f14911f4",
      serviceIds: []
    }
  ],
  eventTypeIds: ["6af81107853bb4f9f149145a"],
  contactPhone: "+919876543210",
  contactEmail: "business@example.com",
  location: {
    address: "Shop 12, Main Road",
    city: "Mumbai",
    state: "Maharashtra",
    country: "India"
  },
  serviceAreas: ["Mumbai", "Thane"],
  startingPrice: 15000
};

test("valid vendor registration data is accepted", () => {
  const result = vendorRegistrationSchema.safeParse(validVendor);
  assert.equal(result.success, true);
});

test("missing full name is rejected", () => {
  const { fullName, ...data } = validVendor;
  const result = vendorRegistrationSchema.safeParse(data);
  assert.equal(result.success, false);
});

test("missing business name is rejected", () => {
  const { businessName, ...data } = validVendor;
  const result = vendorRegistrationSchema.safeParse(data);
  assert.equal(result.success, false);
});

test("missing category IDs is rejected", () => {
  const { categoryIds, ...data } = validVendor;
  const result = vendorRegistrationSchema.safeParse(data);
  assert.equal(result.success, false);
});

test("missing event type IDs is rejected", () => {
  const { eventTypeIds, ...data } = validVendor;
  const result = vendorRegistrationSchema.safeParse(data);
  assert.equal(result.success, false);
});

test("invalid MongoDB category ID is rejected", () => {
  const result = vendorRegistrationSchema.safeParse({
    ...validVendor,
    categoryIds: ["invalid-id"]
  });
  assert.equal(result.success, false);
});

test("duplicate category IDs are rejected", () => {
  const result = vendorRegistrationSchema.safeParse({
    ...validVendor,
    categoryIds: [
      "6af81107853bb4f9f14911f4",
      "6af81107853bb4f9f14911f4"
    ]
  });
  assert.equal(result.success, false);
});

test("invalid email is rejected", () => {
  const result = vendorRegistrationSchema.safeParse({
    ...validVendor,
    email: "invalid-email"
  });
  assert.equal(result.success, false);
});

test("negative starting price is rejected", () => {
  const result = vendorRegistrationSchema.safeParse({
    ...validVendor,
    startingPrice: -100
  });
  assert.equal(result.success, false);
});

test("missing location is rejected", () => {
  const { location, ...data } = validVendor;
  const result = vendorRegistrationSchema.safeParse(data);
  assert.equal(result.success, false);
});

test("client cannot provide role or Firebase identity", () => {
  const result = vendorRegistrationSchema.safeParse({
    ...validVendor,
    role: "admin",
    firebaseUid: "untrusted-uid",
    phoneNumber: "+919999999999"
  });
  assert.equal(result.success, false);
});

test("optional profile fields can be omitted", () => {
  const {
    email,
    description,
    selectedCategories,
    contactEmail,
    serviceAreas,
    startingPrice,
    ...data
  } = validVendor;

  const result = vendorRegistrationSchema.safeParse(data);
  assert.equal(result.success, true);
});

test("duplicate service areas are rejected", () => {
  const result = vendorRegistrationSchema.safeParse({
    ...validVendor,
    serviceAreas: ["Mumbai", "mumbai"]
  });

  assert.equal(result.success, false);
});
