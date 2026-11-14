const mongoose = require("mongoose");

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function containsUniqueObjectIds(values) {
  if (!Array.isArray(values)) return true;
  if (values.some((value) => value == null)) return true;

  const normalizedValues = values.map((value) => value.toString());
  return new Set(normalizedValues).size === normalizedValues.length;
}

function containsUniqueStrings(values) {
  if (!Array.isArray(values)) return true;

  const normalizedValues = values.map((value) => value.trim().toLowerCase());
  return new Set(normalizedValues).size === normalizedValues.length;
}

const selectedCategorySchema = new mongoose.Schema(
  {
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    serviceIds: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Category",
        },
      ],
      default: [],
      validate: {
        validator: containsUniqueObjectIds,
        message: "Service IDs must not contain duplicates",
      },
    },
  },
  { _id: false },
);

const locationSchema = new mongoose.Schema(
  {
    address: {
      type: String,
      required: true,
      trim: true,
    },
    city: {
      type: String,
      required: true,
      trim: true,
    },
    state: {
      type: String,
      trim: true,
    },
    country: {
      type: String,
      trim: true,
      default: "India",
    },
  },
  { _id: false },
);

const vendorSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    publicVendorId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    businessName: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    categoryIds: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Category",
        },
      ],
      required: true,
      validate: [
        {
          validator: (values) => values.length >= 1,
          message: "At least one category is required",
        },
        {
          validator: containsUniqueObjectIds,
          message: "Category IDs must not contain duplicates",
        },
      ],
    },
    selectedCategories: {
      type: [selectedCategorySchema],
      default: [],
      validate: [
        {
          validator(values) {
            const selectedCategoryIds = values
              .map((selection) => selection.categoryId)
              .filter(Boolean);

            if (selectedCategoryIds.length !== values.length) return true;

            return containsUniqueObjectIds(selectedCategoryIds);
          },
          message: "Selected categories must not contain duplicates",
        },
        {
          validator(values) {
            if (!Array.isArray(this.categoryIds)) return true;

            const categoryIds = new Set(
              this.categoryIds.map((categoryId) => categoryId.toString()),
            );

            return values.every(
              (selection) =>
                !selection.categoryId ||
                categoryIds.has(selection.categoryId.toString()),
            );
          },
          message: "Each selected category must also exist in categoryIds",
        },
      ],
    },
    eventTypeIds: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "EventType",
        },
      ],
      required: true,
      validate: [
        {
          validator: (values) => values.length >= 1,
          message: "At least one event type is required",
        },
        {
          validator: containsUniqueObjectIds,
          message: "Event type IDs must not contain duplicates",
        },
      ],
    },
    contactPhone: {
      type: String,
      required: true,
      trim: true,
    },
    contactEmail: {
      type: String,
      trim: true,
      lowercase: true,
      default: undefined,
      set: (value) => {
        if (typeof value === "string" && value.trim() === "") {
          return undefined;
        }
        return value;
      },
      match: [EMAIL_PATTERN, "Contact email address is invalid"],
    },
    location: {
      type: locationSchema,
      required: true,
    },
    serviceAreas: {
      type: [
        {
          type: String,
          trim: true,
        },
      ],
      default: [],
      validate: [
        {
          validator: (values) => values.every((value) => value.length > 0),
          message: "Service areas must not contain blank values",
        },
        {
          validator: containsUniqueStrings,
          message: "Service areas must not contain duplicates",
        },
      ],
    },
    images: {
      type: [
        {
          type: String,
          trim: true,
        },
      ],
      default: [],
      validate: {
        validator: (values) => values.every((value) => value.length > 0),
        message: "Images must not contain blank values",
      },
    },
    startingPrice: {
      type: Number,
      min: [0, "Starting price cannot be negative"],
    },
    currency: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      default: "INR",
    },
    approvalStatus: {
      type: String,
      required: true,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    rejectionReason: {
      type: String,
      trim: true,
      default: null,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

vendorSchema.index({
  approvalStatus: 1,
  isActive: 1,
  deletedAt: 1,
  "location.city": 1,
  categoryIds: 1,
});

vendorSchema.index({
  approvalStatus: 1,
  isActive: 1,
  deletedAt: 1,
  "location.city": 1,
  eventTypeIds: 1,
});

module.exports = mongoose.model("Vendor", vendorSchema);
