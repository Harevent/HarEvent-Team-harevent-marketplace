
const test = require("node:test");
const assert = require("node:assert/strict");

const {
  customerRegistrationSchema
} = require("../validators/customerValidator");

test("valid customer registration data is accepted", () => {
  const result = customerRegistrationSchema.safeParse({
    name: "Test Customer",
    city: "Mumbai",
    state: "Maharashtra",
    email: "customer@example.com"
  });

  assert.equal(result.success, true);
});

test("missing name is rejected", () => {
  const result = customerRegistrationSchema.safeParse({
    city: "Mumbai"
  });

  assert.equal(result.success, false);
});

test("missing city is rejected", () => {
  const result = customerRegistrationSchema.safeParse({
    name: "Test Customer"
  });

  assert.equal(result.success, false);
});

test("empty name and city are rejected", () => {
  const result = customerRegistrationSchema.safeParse({
    name: "   ",
    city: "   "
  });

  assert.equal(result.success, false);
});

test("invalid email is rejected", () => {
  const result = customerRegistrationSchema.safeParse({
    name: "Test Customer",
    city: "Mumbai",
    email: "invalid-email"
  });

  assert.equal(result.success, false);
});

test("registration is accepted when optional fields are omitted", () => {
  const result = customerRegistrationSchema.safeParse({
    name: "Test Customer",
    city: "Mumbai"
  });

  assert.equal(result.success, true);
});

test("frontend cannot provide Firebase UID, phone number or role", () => {
  const result = customerRegistrationSchema.safeParse({
    name: "Test Customer",
    city: "Mumbai",
    firebaseUid: "untrusted-uid",
    phoneNumber: "9999999999",
    role: "admin"
  });

  assert.equal(result.success, false);
});
