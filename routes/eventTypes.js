const express = require("express");
const mongoose = require("mongoose");

const EventType = require("../models/EventType");
const Category = require("../models/Category");

const { getEventTypes } = require("../controllers/eventTypeController");

const router = express.Router();

// PUBLIC: Retrieve all active event types.
router.get("/", getEventTypes);

// PUBLIC: Get active vendor categories associated with an event type.
router.get("/:eventTypeId/vendor-categories", async (req, res, next) => {
  try {
    const { eventTypeId } = req.params;

    // Validate event type ID.
    if (!mongoose.isValidObjectId(eventTypeId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid event type ID.",
      });
    }

    // Find the requested active event type.
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

    // Find active main vendor categories mapped to this event type.
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

module.exports = router;
