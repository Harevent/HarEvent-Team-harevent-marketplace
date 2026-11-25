
const mongoose = require("mongoose");
const Vendor = require("../models/Vendor");

// GET: List vendor applications.
async function getVendorApplications(req, res, next) {
  try {
    const {
      status = "pending",
      page = 1,
      limit = 10,
    } = req.query;

    const pageNumber = Number(page);
    const limitNumber = Number(limit);

    if (
      !["pending", "approved", "rejected"].includes(status) ||
      !Number.isInteger(pageNumber) ||
      pageNumber < 1 ||
      !Number.isInteger(limitNumber) ||
      limitNumber < 1 ||
      limitNumber > 50
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid status or pagination parameters.",
      });
    }

    const filter = {
      approvalStatus: status,
      deletedAt: null,
    };

    const skip = (pageNumber - 1) * limitNumber;

    const [vendors, total] = await Promise.all([
      Vendor.find(filter)
        .select("-__v")
        .populate("userId", "fullName phoneNumber email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNumber)
        .lean(),

      Vendor.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      count: vendors.length,
      total,
      page: pageNumber,
      limit: limitNumber,
      totalPages: Math.ceil(total / limitNumber),
      data: vendors,
    });
  } catch (error) {
    return next(error);
  }
}

// GET: View one vendor application.
async function getVendorApplicationById(req, res, next) {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid vendor ID.",
      });
    }

    const vendor = await Vendor.findOne({
      _id: id,
      deletedAt: null,
    })
      .select("-__v")
      .populate("userId", "fullName phoneNumber email")
      .populate("categoryIds", "name slug")
      .populate("eventTypeIds", "name slug")
      .populate("reviewedBy", "fullName")
      .lean();

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor application not found.",
      });
    }

    return res.status(200).json({
      success: true,
      data: vendor,
    });
  } catch (error) {
    return next(error);
  }
}

// PATCH: Approve a pending vendor application.
async function approveVendor(req, res, next) {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid vendor ID.",
      });
    }

    const vendor = await Vendor.findOneAndUpdate(
      {
        _id: id,
        approvalStatus: "pending",
        deletedAt: null,
      },
      {
        $set: {
          approvalStatus: "approved",
          isActive: true,
          rejectionReason: null,
          reviewedBy: req.user.userId,
          reviewedAt: new Date(),
        },
      },
      {
        new: true,
        runValidators: true,
      },
    );

    if (!vendor) {
      const exists = await Vendor.exists({
        _id: id,
        deletedAt: null,
      });

      return res.status(exists ? 409 : 404).json({
        success: false,
        message: exists
          ? "Vendor application has already been reviewed."
          : "Vendor application not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Vendor approved successfully.",
      data: vendor,
    });
  } catch (error) {
    return next(error);
  }
}

// PATCH: Reject a pending vendor application.
async function rejectVendor(req, res, next) {
  try {
    const { id } = req.params;
    const { rejectionReason } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid vendor ID.",
      });
    }

    if (
      typeof rejectionReason !== "string" ||
      !rejectionReason.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "A rejection reason is required.",
      });
    }

    const vendor = await Vendor.findOneAndUpdate(
      {
        _id: id,
        approvalStatus: "pending",
        deletedAt: null,
      },
      {
        $set: {
          approvalStatus: "rejected",
          isActive: false,
          rejectionReason: rejectionReason.trim(),
          reviewedBy: req.user.userId,
          reviewedAt: new Date(),
        },
      },
      {
        new: true,
        runValidators: true,
      },
    );

    if (!vendor) {
      const exists = await Vendor.exists({
        _id: id,
        deletedAt: null,
      });

      return res.status(exists ? 409 : 404).json({
        success: false,
        message: exists
          ? "Vendor application has already been reviewed."
          : "Vendor application not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Vendor rejected successfully.",
      data: vendor,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getVendorApplications,
  getVendorApplicationById,
  approveVendor,
  rejectVendor,
};
