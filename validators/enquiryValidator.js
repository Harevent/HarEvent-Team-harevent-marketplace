
const { z } = require("zod");

const objectIdSchema = z
  .string()
  .trim()
  .regex(/^[0-9a-fA-F]{24}$/, "Invalid MongoDB ID");

const uniqueIds = (ids) => new Set(ids).size === ids.length;

const enquiryCreateSchema = z.strictObject({
  vendorId: objectIdSchema,

  eventTypeId: objectIdSchema,

  eventDate: z.iso.date({
    error: "Please provide a valid event date in YYYY-MM-DD format",
  }).transform((value) => new Date(`${value}T00:00:00.000Z`)),

  eventLocation: z
    .string()
    .trim()
    .min(1, "Event location cannot be blank")
    .optional(),

  guestCount: z
    .number()
    .int("Guest count must be a whole number")
    .min(1, "Guest count must be at least one")
    .optional(),

  requiredServices: z
    .array(objectIdSchema)
    .refine(uniqueIds, "Duplicate required services are not allowed")
    .optional(),

  budget: z
    .number()
    .finite("Budget must be a finite number")
    .min(0, "Budget cannot be negative"),

  message: z
    .string()
    .trim()
    .max(5000, "Message cannot exceed 5000 characters")
    .optional(),
});

module.exports = {
  enquiryCreateSchema,
};
