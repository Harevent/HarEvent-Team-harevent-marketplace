const Vendor = require("../models/Vendor");

async function requireApprovedVendor(req, res, next) {
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

    // A vendor profile must exist.
    if (!vendor) {
      return res.status(403).json({
        success: false,
        message: "Vendor profile not found.",
      });
    }

    // Only approved vendors can access marketplace operations.
    if (vendor.approvalStatus !== "approved") {
      return res.status(403).json({
        success: false,
        message: "Vendor approval required.",
      });
    }

    // Vendor must be operationally active.
    if (vendor.isActive !== true) {
      return res.status(403).json({
        success: false,
        message: "Vendor account is inactive.",
      });
    }

    // Reject soft-deleted profiles.
    // Both null and undefined mean the profile is not deleted.
    if (vendor.deletedAt !== null && vendor.deletedAt !== undefined) {
      return res.status(403).json({
        success: false,
        message: "Vendor profile is no longer available.",
      });
    }

    return next();
  } catch (error) {
    return next(error);
  }
}

module.exports = { requireApprovedVendor };
