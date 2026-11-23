const { z } = require("zod");

// Validation for creating an Event Type
const createEventTypeSchema = z.object({
  name: z.string().trim().min(2, "Event type name must have at least 2 characters"),

  slug: z.string().trim().min(2, "Slug must have at least 2 characters"),

  description: z.string().trim().optional(),

  vendorCategoryIds: z
    .array(z.string().trim().min(1))
    .min(1, "At least one vendor category is required"),

  isActive: z.boolean().optional()
});

// Validation for updating an Event Type
const updateEventTypeSchema = z.object({
  name: z.string().trim().min(2).optional(),

  slug: z.string().trim().min(2).optional(),

  description: z.string().trim().optional(),

  vendorCategoryIds: z
    .array(z.string().trim().min(1))
    .min(1)
    .optional(),

  isActive: z.boolean().optional()
}).refine(
  (data) => Object.keys(data).length > 0,
  "At least one field must be provided for update"
);

module.exports = {
  createEventTypeSchema,
  updateEventTypeSchema
};