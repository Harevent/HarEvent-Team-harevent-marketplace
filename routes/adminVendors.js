
const express = require("express");

const {
  verifyFirebaseToken,
} = require("../middleware/firebaseAuth");

const { requireAuth } = require("../middleware/requireAuth");
const { requireRole } = require("../middleware/requireRole");

const {
  getVendorApplications,
  getVendorApplicationById,
  approveVendor,
  rejectVendor,
} = require("../controllers/adminVendorController");

const router = express.Router();

// All Admin Vendor Management routes require authentication.
router.use(
  verifyFirebaseToken,
  requireAuth,
  requireRole("admin", "super_admin")
);

// GET /api/admin/vendors
router.get("/", getVendorApplications);

// GET /api/admin/vendors/:id
router.get("/:id", getVendorApplicationById);

// PATCH /api/admin/vendors/:id/approve
router.patch("/:id/approve", approveVendor);

// PATCH /api/admin/vendors/:id/reject
router.patch("/:id/reject", rejectVendor);

module.exports = router;
