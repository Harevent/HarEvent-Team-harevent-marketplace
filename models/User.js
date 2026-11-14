
const mongoose = require("mongoose");

const E164_PHONE_PATTERN = /^\+[1-9]\d{1,14}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const userSchema = new mongoose.Schema(
  {
    firebaseUid: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    phoneNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      match: [
        E164_PHONE_PATTERN,
        "Phone number must be in E.164 format (for example, +919812345678)",
      ],
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      match: [EMAIL_PATTERN, "Email address is invalid"],
    },
    role: {
      type: String,
      required: true,
      enum: ["customer", "vendor", "admin"],
    },
    accountStatus: {
      type: String,
      required: true,
      enum: ["active", "suspended", "disabled"],
      default: "active",
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("User", userSchema);
