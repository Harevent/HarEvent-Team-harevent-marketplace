const express = require("express");

const User = require("../models/User");
const { verifyFirebaseToken } = require("../middleware/firebaseAuth");

const router = express.Router();

// FIREBASE AUTHENTICATION VERIFICATION API
router.post("/verify", verifyFirebaseToken, async (req, res, next) => {
  try {
    // Get the verified Firebase UID from the middleware.
    const { firebaseUid } = req.firebaseUser;

    // Check whether this Firebase identity has a HarEvent account.
    const user = await User.findOne({ firebaseUid }).select(
      "_id role accountStatus"
    );

    // Firebase identity is valid, but no HarEvent account exists.
    if (!user) {
      return res.status(200).json({
        isRegistered: false,
        requiresRegistration: true,
      });
    }

    // Existing registered HarEvent account.
    return res.status(200).json({
      isRegistered: true,
      requiresRegistration: false,
      user: {
        userId: user._id,
        role: user.role,
        accountStatus: user.accountStatus,
      },
    });
  } catch (error) {
    // Forward unexpected errors to the centralized error handler.
    return next(error);
  }
});

module.exports = router;
