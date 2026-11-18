
const { z } = require("zod");

// Validation for customer registration request
const customerRegistrationSchema = z.strictObject({
  name: z
    .string()
    .trim()
    .min(1, "Name is required"),

  city: z
    .string()
    .trim()
    .min(1, "City is required"),

  state: z
    .string()
    .trim()
    .optional(),

  email: z
    .string()
    .trim()
    .email("Please provide a valid email address")
    .optional()
});

module.exports = {
  customerRegistrationSchema
};
