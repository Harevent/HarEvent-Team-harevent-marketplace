const mongoose = require("mongoose");

const priceBreakdownSchema = new mongoose.Schema(
  {
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
      immutable: true,
    },
    amount: {
      type: Number,
      required: true,
      immutable: true,
      min: [0, "Snapshot amount cannot be negative"],
      validate: {
        validator: Number.isFinite,
        message: "Snapshot amount must be a finite number",
      },
    },
    currency: {
      type: String,
      required: true,
      immutable: true,
      trim: true,
      uppercase: true,
      enum: ["INR"],
      default: "INR",
    },
  },
  { _id: false },
);

const vendorSubscriptionSchema = new mongoose.Schema(
  {
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
      immutable: true,
    },
    planId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SubscriptionPlan",
      required: true,
      immutable: true,
    },
    selectedCategoryIds: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Category",
          required: true,
        },
      ],
      required: true,
      immutable: true,
      validate: {
        validator: (values) =>
          Array.isArray(values) &&
          values.length >= 1 &&
          values.every((value) => value != null) &&
          new Set(values.map(String)).size === values.length,
        message: "Select at least one unique, non-null Category ID",
      },
    },
    priceBreakdown: {
      type: [priceBreakdownSchema],
      default: [],
      immutable: true,
      validate: [
        {
          validator: (values) =>
            Array.isArray(values) &&
            values.every(
              (entry) => entry != null && entry.categoryId != null,
            ) &&
            new Set(values.map((entry) => String(entry.categoryId))).size ===
              values.length,
          message: "Price breakdown must contain unique Category IDs",
        },
        {
          validator(values) {
            if (
              !Array.isArray(values) ||
              !Array.isArray(this.selectedCategoryIds)
            )
              return true;
            const selectedIds = new Set(this.selectedCategoryIds.map(String));
            return values.every(
              (entry) =>
                !entry?.categoryId || selectedIds.has(String(entry.categoryId)),
            );
          },
          message:
            "Each price breakdown category must be in selectedCategoryIds",
        },
      ],
    },
    finalAmount: {
      type: Number,
      required: true,
      immutable: true,
      min: [0, "Final amount cannot be negative"],
      validate: {
        validator: Number.isFinite,
        message: "Final amount must be a finite number",
      },
    },
    status: {
      type: String,
      required: true,
      enum: ["pending", "active", "expired", "cancelled"],
      default: "pending",
    },
    startsAt: {
      type: Date,
      required: function () {
        return this.status === "active";
      },
      default: null,
    },
    expiresAt: {
      type: Date,
      default: null,
      validate: {
        validator(value) {
          return (
            value == null || this.startsAt == null || value > this.startsAt
          );
        },
        message: "Subscription expiry must be after its start date",
      },
    },
    paymentId: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true },
);

vendorSubscriptionSchema.pre("validate", function () {
  if (this.isNew) return;
  for (const field of [
    "vendorId",
    "planId",
    "selectedCategoryIds",
    "priceBreakdown",
    "finalAmount",
  ]) {
    if (this.isModified(field)) {
      this.invalidate(
        field,
        "Subscription purchase details are immutable; create a new subscription for changes",
      );
    }
  }
});

vendorSubscriptionSchema.index({ vendorId: 1, status: 1, createdAt: -1 });

vendorSubscriptionSchema.index(
  { vendorId: 1 },
  { unique: true, partialFilterExpression: { status: "active" } },
);

module.exports = mongoose.model("VendorSubscription", vendorSubscriptionSchema);
