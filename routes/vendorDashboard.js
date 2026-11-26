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
  getVendorDashboard,
} = require("../controllers/vendorDashboardController");

const router = express.Router();

// Only authenticated vendor accounts can access the dashboard.
// Pending and rejected vendors can still view their approval status.
router.get(
  "/",
  verifyFirebaseToken,
  requireAuth,
  requireRole("vendor"),
  getVendorDashboard,
);

module.exports = router;