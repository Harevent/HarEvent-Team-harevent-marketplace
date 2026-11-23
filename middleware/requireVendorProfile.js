const Vendor = require("../models/Vendor");

async function requireVendorProfile(req, res, next) {
  try {
    // Authentication must happen before vendor authorization.
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    // Only authenticated vendor accounts are allowed.
    if (req.user.role !== "vendor") {
      return res.status(403).json({
        success: false,
        message: "Vendor access required.",
      });
    }

    // Find the vendor profile linked to the authenticated user.
    const vendor = await Vendor.findOne({
      userId: req.user.userId,
    });

    if (!vendor || vendor.deletedAt != null) {
      return res.status(403).json({
        success: false,
        message: "Active vendor profile not found.",
      });
    }

    return next();
  } catch (error) {
    return next(error);
  }
}

module.exports = { requireVendorProfile };
