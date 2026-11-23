const mongoose = require("mongoose");

const E164_PHONE_PATTERN = /^\+[1-9]\d{1,14}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const enquirySchema = new mongoose.Schema(
  {
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
    },
    customerNameSnapshot: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
      immutable: true,
    },
    customerPhoneSnapshot: {
      type: String,
      required: true,
      trim: true,
      immutable: true,
      match: [E164_PHONE_PATTERN, "Customer phone snapshot must be in E.164 format"],
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      immutable: true,
      set: (value) => typeof value === "string" && !value.trim() ? undefined : value,
      match: [EMAIL_PATTERN, "Enquiry email address is invalid"],
    },
    eventTypeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "EventType",
      required: true,
    },
    eventDate: {
      type: Date,
      required: true,
    },
    eventLocation: {
      type: String,
      trim: true,
    },
    guestCount: {
      type: Number,
      min: [1, "Guest count must be at least one"],
      validate: {
        validator: (value) => value == null || Number.isSafeInteger(value),
        message: "Guest count must be a whole number",
      },
    },
    requiredServices: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Category", required: true }],
      default: [],
      validate: {
        validator: (values) => Array.isArray(values) &&
          values.every((value) => value != null) &&
          new Set(values.map(String)).size === values.length,
        message: "Required services must contain unique, non-null Category IDs",
      },
    },
    budget: {
      type: Number,
      required: true,
      min: [0, "Budget cannot be negative"],
      validate: { validator: Number.isFinite, message: "Budget must be a finite number" },
    },
    message: {
      type: String,
      trim: true,
      maxlength: 5000,
    },
    status: {
      type: String,
      required: true,
      enum: ["pending", "viewed", "accepted", "rejected", "cancelled"],
      default: "pending",
    },
    statusUpdatedAt: {
      type: Date,
      default: null,
    },
    vendorResponse: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true },
);

enquirySchema.index({ customerId: 1, createdAt: -1 });
enquirySchema.index({ vendorId: 1, createdAt: -1 });

module.exports = mongoose.model("Enquiry", enquirySchema);
