const mongoose = require("mongoose");

const DISPLAY_PRIORITIES = { PLATINUM: 1, GOLD: 2, BASIC: 3 };

const featuresSchema = new mongoose.Schema(
  {
    entitlements: {
      type: Map,
      of: Boolean,
      default: () => ({}),
    },
    limits: {
      type: Map,
      of: {
        type: Number,
        min: [0, "Feature limits cannot be negative"],
        validate: {
          validator: Number.isSafeInteger,
          message: "Feature limits must be nonnegative whole numbers",
        },
      },
      default: () => ({}),
    },
  },
  { _id: false, strict: "throw" },
);

const subscriptionPlanSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      trim: true,
      uppercase: true,
      enum: ["BASIC", "GOLD", "PLATINUM"],
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      default: function () { return this.name?.toLowerCase(); },
    },
    displayPriority: {
      type: Number,
      required: true,
      immutable: true,
      enum: [1, 2, 3],
      default: function () { return DISPLAY_PRIORITIES[this.name]; },
      validate: {
        validator(value) { return value === DISPLAY_PRIORITIES[this.name]; },
        message: "Display priority must be PLATINUM = 1, GOLD = 2, BASIC = 3",
      },
    },
    priceAmount: {
      type: Number,
      required: function () { return this.name === "BASIC"; },
      default: function () { return this.name === "BASIC" ? 0 : undefined; },
      min: [0, "Plan price amount cannot be negative"],
      validate: [
        {
          validator: (value) => value == null || Number.isFinite(value),
          message: "Plan price amount must be a finite number",
        },
        {
          validator(value) { return this.name !== "BASIC" || value === 0; },
          message: "BASIC is free and must have a price amount of zero",
        },
      ],
    },
    currency: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      enum: ["INR"],
      default: "INR",
    },
    billingPeriod: {
      type: String,
      enum: ["none", "monthly", "yearly"],
    },
    features: {
      type: featuresSchema,
      default: () => ({}),
    },
    isActive: {
      type: Boolean,
      required: true,
      default: true,
    },
  },
  { timestamps: true },
);

subscriptionPlanSchema.index({ isActive: 1, displayPriority: 1 });

module.exports = mongoose.model("SubscriptionPlan", subscriptionPlanSchema);
