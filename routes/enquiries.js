
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
  createEnquiry,
  getCustomerEnquiries,
  getEnquiryById,
  cancelEnquiry,
} = require("../controllers/enquiryController");

const router = express.Router();

// All enquiry routes require Firebase authentication
// and a registered application account.
router.use(verifyFirebaseToken, requireAuth);

// Customer-only routes.
router.post(
  "/",
  requireRole("customer"),
  createEnquiry
);

router.get(
  "/my",
  requireRole("customer"),
  getCustomerEnquiries
);

// Customer can cancel their own pending enquiry.
router.patch(
  "/:id/cancel",
  requireRole("customer"),
  cancelEnquiry
);

// Customer or vendor can view an enquiry
// only when they are associated with it.
router.get(
  "/:id",
  requireRole("customer", "vendor"),
  getEnquiryById
);

module.exports = router;
