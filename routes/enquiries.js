const express = require("express");

const { verifyFirebaseToken } = require("../middleware/firebaseAuth");
const { requireAuth } = require("../middleware/requireAuth");
const { requireRole } = require("../middleware/requireRole");

const {
  createEnquiry,
} = require("../controllers/enquiryController");

const router = express.Router();

// All enquiry routes require an authenticated customer.
router.use(
  verifyFirebaseToken,
  requireAuth,
  requireRole("customer")
);

// POST /api/enquiries
router.post("/", createEnquiry);

module.exports = router;
