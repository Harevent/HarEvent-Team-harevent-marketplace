const mongoose = require("mongoose");

function containsUniquePermissions(values) {
  if (!Array.isArray(values)) return true;

  const normalizedValues = values.map((value) => value.trim().toLowerCase());
  return new Set(normalizedValues).size === normalizedValues.length;
}

const adminSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    adminType: {
      type: String,
      required: true,
      enum: ["admin", "super_admin"],
      default: "admin",
    },
    permissions: {
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
          message: "Permissions must not contain blank values",
        },
        {
          validator: containsUniquePermissions,
          message: "Permissions must not contain duplicates",
        },
      ],
    },
    provisionedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    provisionedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Admin", adminSchema);
