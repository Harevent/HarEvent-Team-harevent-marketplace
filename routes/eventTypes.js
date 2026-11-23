
const express = require("express");
const mongoose = require("mongoose");

const EventType = require("../models/EventType");
const Category = require("../models/Category");

const {
  verifyFirebaseToken,
} = require("../middleware/firebaseAuth");

const { requireAuth } = require("../middleware/requireAuth");
const { requireRole } = require("../middleware/requireRole");

const {
  getEventTypes,
  createEventType,
  updateEventType,
} = require("../controllers/eventTypeController");

const router = express.Router();

// =============================================
// PUBLIC ROUTES
// =============================================

// GET /api/event-types
// Retrieve all active event types.
router.get("/", getEventTypes);

// GET /api/event-types/:eventTypeId/vendor-categories
// Retrieve active main vendor categories mapped to an event type.
router.get("/:eventTypeId/vendor-categories", async (req, res, next) => {
  try {
    const { eventTypeId } = req.params;

    if (!mongoose.isValidObjectId(eventTypeId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid event type ID.",
      });
    }

    const eventType = await EventType.findOne({
      _id: eventTypeId,
      isActive: true,
    }).lean();

    if (!eventType) {
      return res.status(404).json({
        success: false,
        message: "Event type not found.",
      });
    }

    const categories = await Category.find({
      _id: { $in: eventType.vendorCategoryIds || [] },
      isActive: true,
      parentId: null,
    })
      .select("name slug description sortOrder")
      .sort({ sortOrder: 1, name: 1 })
      .lean();

    return res.status(200).json({
      success: true,
      eventType: {
        id: eventType._id,
        name: eventType.name,
        slug: eventType.slug,
      },
      count: categories.length,
      data: categories,
    });
  } catch (error) {
    return next(error);
  }
});

// =============================================
// ADMIN-ONLY ROUTES
// =============================================

// All routes below require a verified Firebase token
// and an authenticated admin account.
router.use(
  verifyFirebaseToken,
  requireAuth,
  requireRole("admin")
);

// POST /api/event-types
// Create a new event type.
router.post("/", createEventType);

// PUT /api/event-types/:eventTypeId
// Update or deactivate an existing event type.
router.put("/:eventTypeId", updateEventType);

module.exports = router;
