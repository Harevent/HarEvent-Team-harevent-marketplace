
const mongoose = require("mongoose");

const vendorSchema = new mongoose.Schema(
  {
    businessName: {
      type: String,
      required: true,
      trim: true
    },

    category: {
      type: String,
      required: true,
      enum: [
        "Catering",
        "Photography",
        "Decoration",
        "Venue",
        "Music",
        "Other"
      ]
    },

    description: {
      type: String,
      required: true,
      trim: true
    },

    location: {
      type: String,
      required: true,
      trim: true
    },

    contactEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true
    },

    contactPhone: {
      type: String,
      required: true,
      trim: true
    },

    price: {
      type: Number,
      required: true,
      min: 0
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    }
  },
  { timestamps: true }
);

// Indexes help category and location searches
vendorSchema.index({ category: 1, location: 1 });

module.exports = mongoose.model("Vendor", vendorSchema);
