const express = require("express");
const mongoose = require("mongoose");

const Category = require("../models/Category");
const Vendor = require("../models/Vendor");

const { verifyFirebaseToken } = require("../middleware/firebaseAuth");
const { requireAuth } = require("../middleware/requireAuth");
const { requireRole } = require("../middleware/requireRole");

const router = express.Router();

// All service management routes require an authenticated admin.
router.use(
  verifyFirebaseToken,
  requireAuth,
  requireRole("admin", "super_admin"),
);
// PUT /api/services/:id
// Update an existing service.
router.put("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid service ID.",
      });
    }

    const service = await Category.findOne({
      _id: id,
      parentId: { $ne: null },
    });

    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Service not found.",
      });
    }

    const allowedFields = [
      "name",
      "slug",
      "description",
      "sortOrder",
      "isActive",
    ];

    const updates = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: "Provide at least one valid field to update.",
      });
    }

    const updatedService = await Category.findOneAndUpdate(
      { _id: id, parentId: { $ne: null } },
      updates,
      { new: true, runValidators: true },
    );

    return res.status(200).json({
      success: true,
      message: "Service updated successfully.",
      data: updatedService,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "A service with this slug already exists under this category.",
      });
    }

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: "Service validation failed.",
      });
    }

    return next(error);
  }
});

// DELETE /api/services/:id
// Delete a service only when it is not referenced by vendors or child records.
router.delete("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid service ID.",
      });
    }

    const service = await Category.findOne({
      _id: id,
      parentId: { $ne: null },
    });

    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Service not found.",
      });
    }

    const hasChildren = await Category.exists({ parentId: id });

    if (hasChildren) {
      return res.status(409).json({
        success: false,
        message: "Cannot delete a service that has child records.",
      });
    }

    const isUsedByVendor = await Vendor.exists({
      "selectedCategories.serviceIds": id,
    });

    if (isUsedByVendor) {
      return res.status(409).json({
        success: false,
        message: "Cannot delete a service currently selected by a vendor.",
      });
    }

    await service.deleteOne();

    return res.status(200).json({
      success: true,
      message: "Service deleted successfully.",
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
