
const mongoose = require("mongoose");

const EventType = require("../models/EventType");
const Category = require("../models/Category");

const {
  createEventTypeSchema,
  updateEventTypeSchema,
} = require("../validators/eventTypeValidator");

// Get all active event types for the public frontend.
async function getEventTypes(req, res, next) {
  try {
    const eventTypes = await EventType.find({ isActive: true })
      .select("name slug description")
      .sort({ name: 1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: eventTypes.length,
      data: eventTypes,
    });
  } catch (error) {
    return next(error);
  }
}

// Check that all mapped IDs belong to active main categories.
async function validateVendorCategories(categoryIds) {
  if (!categoryIds) return null;

  const uniqueIds = [...new Set(categoryIds)];

  if (uniqueIds.length !== categoryIds.length) {
    return "Duplicate vendor category IDs are not allowed.";
  }

  if (!uniqueIds.every((id) => mongoose.isValidObjectId(id))) {
    return "One or more vendor category IDs are invalid.";
  }

  const categories = await Category.find({
    _id: { $in: uniqueIds },
    isActive: true,
    parentId: null,
  }).select("_id").lean();

  if (categories.length !== uniqueIds.length) {
    return "All vendor categories must be active main categories.";
  }

  return null;
}

// Admin: Create an event type.
async function createEventType(req, res, next) {
  try {
    const result = createEventTypeSchema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.error.issues[0].message,
      });
    }

    const categoryError = await validateVendorCategories(
      result.data.vendorCategoryIds
    );

    if (categoryError) {
      return res.status(400).json({
        success: false,
        message: categoryError,
      });
    }

    const eventType = await EventType.create(result.data);

    return res.status(201).json({
      success: true,
      message: "Event type created successfully.",
      data: eventType,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "An event type with this name or slug already exists.",
      });
    }

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return next(error);
  }
}

// Admin: Update or deactivate an event type.
async function updateEventType(req, res, next) {
  try {
    const { eventTypeId } = req.params;

    if (!mongoose.isValidObjectId(eventTypeId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid event type ID.",
      });
    }

    const result = updateEventTypeSchema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.error.issues[0].message,
      });
    }

    const categoryError = await validateVendorCategories(
      result.data.vendorCategoryIds
    );

    if (categoryError) {
      return res.status(400).json({
        success: false,
        message: categoryError,
      });
    }

    const eventType = await EventType.findByIdAndUpdate(
      eventTypeId,
      { $set: result.data },
      { new: true, runValidators: true }
    );

    if (!eventType) {
      return res.status(404).json({
        success: false,
        message: "Event type not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Event type updated successfully.",
      data: eventType,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "An event type with this name or slug already exists.",
      });
    }

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return next(error);
  }
}

module.exports = {
  getEventTypes,
  createEventType,
  updateEventType,
};
