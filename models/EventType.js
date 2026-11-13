const mongoose = require("mongoose");

function containsUniqueObjectIds(values) {
  if (!Array.isArray(values)) return true;

  const normalizedValues = values.map((value) => value.toString());
  return new Set(normalizedValues).size === normalizedValues.length;
}

const eventTypeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    vendorCategoryIds: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Category",
        },
      ],
      default: [],
      validate: {
        validator: containsUniqueObjectIds,
        message: "Vendor category IDs must not contain duplicates",
      },
    },
    isActive: {
      type: Boolean,
      required: true,
      default: true,
    },
  },
  { timestamps: true },
);

eventTypeSchema.index({ isActive: 1, name: 1 });

module.exports = mongoose.model("EventType", eventTypeSchema);
