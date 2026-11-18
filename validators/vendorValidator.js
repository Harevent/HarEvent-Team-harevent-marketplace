const { z } = require("zod");

const objectIdSchema = z
  .string()
  .trim()
  .regex(/^[0-9a-fA-F]{24}$/, "Invalid MongoDB ID");

const uniqueIds = (ids) => new Set(ids).size === ids.length;

const vendorRegistrationSchema = z.strictObject({
  fullName: z.string().trim().min(1, "Full name is required"),

  email: z
    .string()
    .trim()
    .email("Please provide a valid email address")
    .optional(),

  businessName: z.string().trim().min(1, "Business name is required"),

  description: z.string().trim().optional(),

  categoryIds: z
    .array(objectIdSchema)
    .min(1, "Select at least one vendor category")
    .refine(uniqueIds, "Duplicate vendor categories are not allowed"),

  selectedCategories: z
    .array(
      z.strictObject({
        categoryId: objectIdSchema,
        serviceIds: z
          .array(objectIdSchema)
          .refine(uniqueIds, "Duplicate services are not allowed")
      })
    )
    .optional(),

  eventTypeIds: z
    .array(objectIdSchema)
    .min(1, "Select at least one event type")
    .refine(uniqueIds, "Duplicate event types are not allowed"),

  contactPhone: z.string().trim().min(1, "Contact phone is required"),

  contactEmail: z
    .string()
    .trim()
    .email("Please provide a valid contact email")
    .optional(),

  location: z.strictObject({
    address: z.string().trim().min(1, "Address is required"),
    city: z.string().trim().min(1, "City is required"),
    state: z.string().trim().optional(),
    country: z.string().trim().optional()
  }),

 serviceAreas: z
  .array(z.string().trim().min(1))
  .refine(
    (areas) =>
      new Set(areas.map((area) => area.toLowerCase())).size === areas.length,
    "Duplicate service areas are not allowed"
  )
  .optional(),

  startingPrice: z.number().min(0).optional()
});

module.exports = {
  vendorRegistrationSchema
};
