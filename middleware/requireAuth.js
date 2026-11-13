const User = require("../models/User");
const Customer = require("../models/Customer");
const Vendor = require("../models/Vendor");
const Admin = require("../models/Admin");

async function requireAuth(req, res, next) {
  // 1. Clear any previously attached application identity.
  delete req.user;

  try {
    // 2. Read the identity verified by verifyFirebaseToken.
    const firebaseUser = req.firebaseUser;

    if (
      !firebaseUser ||
      typeof firebaseUser.firebaseUid !== "string" ||
      !firebaseUser.firebaseUid.trim() ||
      typeof firebaseUser.phoneNumber !== "string" ||
      !firebaseUser.phoneNumber.trim()
    ) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    // 3. Find the application user using Firebase UID.
    const user = await User.findOne({
      firebaseUid: firebaseUser.firebaseUid,
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Application account not registered.",
      });
    }

    // 4. Verify that the stored phone matches Firebase identity.
    if (user.phoneNumber !== firebaseUser.phoneNumber) {
      return res.status(401).json({
        success: false,
        message: "Authentication identity mismatch.",
      });
    }

    // 5. Reject suspended or disabled application accounts.
    if (user.accountStatus !== "active") {
      return res.status(403).json({
        success: false,
        message: "Your account is not active.",
      });
    }

    // 6. Resolve the profile associated with the user's role.
    let customer = null;
    let vendor = null;
    let admin = null;

    if (user.role === "customer") {
      customer = await Customer.findOne({
        userId: user._id,
      });

      if (!customer) {
        return res.status(403).json({
          success: false,
          message: "Customer profile is incomplete.",
        });
      }
    } else if (user.role === "vendor") {
      vendor = await Vendor.findOne({
        userId: user._id,
      });

      // A missing Vendor profile is allowed during onboarding.
    } else if (user.role === "admin") {
      admin = await Admin.findOne({
        userId: user._id,
      });

      if (!admin) {
        return res.status(403).json({
          success: false,
          message: "Admin profile is unavailable.",
        });
      }
    } else {
      return res.status(403).json({
        success: false,
        message: "Invalid application account role.",
      });
    }

    // 7. Attach trusted identity context from database records.
    req.user = {
      userId: user._id.toString(),
      firebaseUid: user.firebaseUid,
      phoneNumber: user.phoneNumber,

      role: user.role,

      adminType: admin?.adminType ?? null,

      accountStatus: user.accountStatus,

      vendorId: vendor?._id?.toString() ?? null,
      vendorStatus: vendor?.approvalStatus ?? null,
    };

    // 8. Continue to the next middleware or controller.
    return next();
  } catch (error) {
    // Forward unexpected database or application errors.
    return next(error);
  }
}

module.exports = { requireAuth };

// Explanation of each section
// Section	Responsibility
// 1. Clear identity	    Removes any existing req.user before processing.
// 2. Firebase identity	    Requires the verified UID and phone number from verifyFirebaseToken.
// 3. User lookup	        Finds the application User using Firebase UID.
// 4. Phone verification	Compares the database phone with Firebase's verified phone.
// 5. Account status	    Allows only active accounts.
// 6. Profile resolution	Loads Customer, Vendor or Admin according to the database role.
// 7. Identity attachment	Creates the trusted req.user object.
// 8. Error handling	    Sends unexpected errors to centralized Express error handling.
