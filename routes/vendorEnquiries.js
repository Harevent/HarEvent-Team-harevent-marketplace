
const express = require("express");

const { verifyFirebaseToken } = require("../middleware/firebaseAuth");
const { requireAuth } = require("../middleware/requireAuth");
const {
  requireApprovedVendor,
} = require("../middleware/requireApprovedVendor");

const {
  getVendorEnquiries,
  getVendorEnquiryById,
  updateVendorEnquiryStatus,
} = require("../controllers/vendorEnquiryController");

const router = express.Router();

// All vendor enquiry routes require an authenticated,
// approved, active vendor account.
router.use(
  verifyFirebaseToken,
  requireAuth,
  requireApprovedVendor
);

// GET /api/vendor/enquiries
router.get("/", getVendorEnquiries);

// GET /api/vendor/enquiries/:id
router.get("/:id", getVendorEnquiryById);

// PATCH /api/vendor/enquiries/:id/status
router.patch("/:id/status", updateVendorEnquiryStatus);

module.exports = router;
