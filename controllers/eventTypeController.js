
const EventType = require("../models/EventType");

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

module.exports = {
  getEventTypes,
};
