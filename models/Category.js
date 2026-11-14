
const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      default: null,
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    isActive: {
      type: Boolean,
      required: true,
      default: true,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true },
);

// Slugs are unique among main categories and within each parent category.
categorySchema.index({ parentId: 1, slug: 1 }, { unique: true });

// Supports ordered main-category and service/subcategory listings.
categorySchema.index({ parentId: 1, isActive: 1, sortOrder: 1, name: 1 });

module.exports = mongoose.model("Category", categorySchema);
