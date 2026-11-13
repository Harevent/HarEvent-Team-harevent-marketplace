const mongoose = require("mongoose");

const customerSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
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
    profileImageUrl: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Customer", customerSchema);
