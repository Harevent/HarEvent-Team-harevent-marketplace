const express = require("express");

const {
  verifyFirebaseToken,
} = require("../middleware/firebaseAuth");

const {
  requireAuth,
} = require("../middleware/requireAuth");

const {
  requireRole,
} = require("../middleware/requireRole");

const {
  requireApprovedVendor,
} = require("../middleware/requireApprovedVendor");

const {
  getVendorEnquiries,
  getVendorEnquiryById,
  updateVendorEnquiryStatus,
} = require("../controllers/vendorEnquiryController");

const router = express.Router();

// All vendor enquiry endpoints require an authenticated,
// registered, approved and active vendor.
router.use(
  verifyFirebaseToken,
  requireAuth,
  requireRole("vendor"),
  requireApprovedVendor,
);

// Retrieve enquiries received by the logged-in vendor.
router.get("/", getVendorEnquiries);

// Update the status of an enquiry received by the logged-in vendor.
router.patch("/:id/status", updateVendorEnquiryStatus);

// Retrieve one enquiry addressed to the logged-in vendor.
router.get("/:id", getVendorEnquiryById);

module.exports = router;
