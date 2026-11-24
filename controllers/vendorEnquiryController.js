
const Enquiry = require("../models/Enquiry");

const OBJECT_ID_PATTERN = /^[0-9a-fA-F]{24}$/;

async function getVendorEnquiries(req, res, next) {
  try {
    const vendorId = req.user.vendorId;

    if (!vendorId) {
      return res.status(404).json({
        success: false,
        message: "Vendor profile not found.",
      });
    }

    const enquiries = await Enquiry.find({
      vendorId,
    }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      message: "Vendor enquiries retrieved successfully",
      data: enquiries,
    });
  } catch (error) {
    return next(error);
  }
}

async function getVendorEnquiryById(req, res, next) {
  try {
    const { id } = req.params;
    const vendorId = req.user.vendorId;

    if (!OBJECT_ID_PATTERN.test(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid enquiry ID",
      });
    }

    if (!vendorId) {
      return res.status(404).json({
        success: false,
        message: "Vendor profile not found.",
      });
    }

    const enquiry = await Enquiry.findById(id);

    if (!enquiry) {
      return res.status(404).json({
        success: false,
        message: "Enquiry not found",
      });
    }

    if (enquiry.vendorId.toString() !== vendorId.toString()) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to view this enquiry",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Vendor enquiry retrieved successfully",
      data: enquiry,
    });
  } catch (error) {
    return next(error);
  }
}

async function updateVendorEnquiryStatus(req, res, next) {
  try {
    const { id } = req.params;
    const vendorId = req.user.vendorId;
    const { status } = req.body || {};

    if (!OBJECT_ID_PATTERN.test(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid enquiry ID",
      });
    }

    if (!vendorId) {
      return res.status(404).json({
        success: false,
        message: "Vendor profile not found.",
      });
    }

    const allowedRequestedStatuses = ["viewed", "accepted", "rejected"];

    if (
      !req.body ||
      typeof req.body !== "object" ||
      Array.isArray(req.body) ||
      Object.keys(req.body).length !== 1 ||
      typeof status !== "string" ||
      !allowedRequestedStatuses.includes(status)
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid status: viewed, accepted or rejected.",
      });
    }

    const enquiry = await Enquiry.findOne({
      _id: id,
      vendorId,
    });

    if (!enquiry) {
      return res.status(404).json({
        success: false,
        message: "Enquiry not found for this vendor.",
      });
    }

    const currentStatus = enquiry.status;

    const allowedTransitions = {
      pending: ["viewed"],
      viewed: ["accepted", "rejected"],
      accepted: [],
      rejected: [],
      cancelled: [],
    };

    if (!allowedTransitions[currentStatus]?.includes(status)) {
      return res.status(409).json({
        success: false,
        message: `Enquiry status cannot be changed from ${currentStatus} to ${status}.`,
      });
    }

    const updatedEnquiry = await Enquiry.findOneAndUpdate(
      {
        _id: id,
        vendorId,
        status: currentStatus,
      },
      {
        $set: {
          status,
          statusUpdatedAt: new Date(),
        },
      },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!updatedEnquiry) {
      return res.status(409).json({
        success: false,
        message: "The enquiry status has changed. Please refresh and try again.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Enquiry status updated successfully",
      data: updatedEnquiry,
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
