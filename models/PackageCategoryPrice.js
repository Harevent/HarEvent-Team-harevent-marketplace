const mongoose = require("mongoose");

const packageCategoryPriceSchema = new mongoose.Schema(
  {
    planId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SubscriptionPlan",
      required: true,
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: [0, "Category price amount cannot be negative"],
      validate: {
        validator: Number.isFinite,
        message: "Category price amount must be a finite number",
      },
    },
    currency: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      enum: ["INR"],
      default: "INR",
    },
    isActive: {
      type: Boolean,
      required: true,
      default: true,
    },
  },
  { timestamps: true },
);

// The write service must verify that planId is GOLD/PLATINUM and categoryId is a main category.
packageCategoryPriceSchema.index({ planId: 1, categoryId: 1 }, { unique: true });

module.exports = mongoose.model("PackageCategoryPrice", packageCategoryPriceSchema);
