
const mongoose = require("mongoose");
const Enquiry = require("../models/Enquiry");

const VALID_TRANSITIONS = {
  pending: ["viewed", "accepted", "rejected"],
  viewed: ["accepted", "rejected"],
  accepted: [],
  rejected: [],
  cancelled: [],
};

// GET /api/vendor/enquiries
async function getVendorEnquiries(req, res, next) {
  try {
    const enquiries = await Enquiry.find({
      vendorId: req.user.vendorId,
    })
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: enquiries.length,
      data: enquiries,
    });
  } catch (error) {
    return next(error);
  }
}

// GET /api/vendor/enquiries/:id
async function getVendorEnquiryById(req, res, next) {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid enquiry ID.",
      });
    }

    const enquiry = await Enquiry.findOne({
      _id: id,
      vendorId: req.user.vendorId,
    }).lean();

    if (!enquiry) {
      return res.status(404).json({
        success: false,
        message: "Enquiry not found.",
      });
    }

    return res.status(200).json({
      success: true,
      data: enquiry,
    });
  } catch (error) {
    return next(error);
  }
}

// PATCH /api/vendor/enquiries/:id/status
async function updateVendorEnquiryStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status, vendorResponse } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid enquiry ID.",
      });
    }

    const enquiry = await Enquiry.findOne({
      _id: id,
      vendorId: req.user.vendorId,
    });

    if (!enquiry) {
      return res.status(404).json({
        success: false,
        message: "Enquiry not found.",
      });
    }

    const allowedStatuses = VALID_TRANSITIONS[enquiry.status] || [];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot change enquiry status from ${enquiry.status} to ${status}.`,
      });
    }

    if (
      vendorResponse !== undefined &&
      (typeof vendorResponse !== "string" ||
        vendorResponse.trim().length > 2000)
    ) {
      return res.status(400).json({
        success: false,
        message: "Vendor response must be a string of at most 2000 characters.",
      });
    }

    enquiry.status = status;
    enquiry.statusUpdatedAt = new Date();

    if (vendorResponse !== undefined) {
      enquiry.vendorResponse = vendorResponse.trim();
    }

    await enquiry.save();

    return res.status(200).json({
      success: true,
      message: "Enquiry status updated successfully.",
      data: enquiry,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getVendorEnquiries,
  getVendorEnquiryById,
  updateVendorEnquiryStatus,
};
