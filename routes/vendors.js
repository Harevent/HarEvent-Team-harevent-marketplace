const express = require("express");
const mongoose = require("mongoose");
const crypto = require("crypto");

const Vendor = require("../models/Vendor");
const Category = require("../models/Category");
const EventType = require("../models/EventType");
const authMiddleware = require("../middleware/auth");

const router = express.Router();

router.use(authMiddleware);

// Get the authenticated user's MongoDB ID
const getUserId = (req) => req.user?.id || req.user?._id;

// Validate an array of MongoDB ObjectIds
const validIdArray = (value) =>
  Array.isArray(value) &&
  value.length > 0 &&
  value.every((id) => mongoose.isValidObjectId(id));

// Validate category and service selections
const validateCategorySelections = async (
  categoryIds,
  selectedCategories = [],
) => {
  if (!validIdArray(categoryIds)) {
    return "Please provide at least one valid category ID.";
  }

  if (!Array.isArray(selectedCategories)) {
    return "selectedCategories must be an array.";
  }

  const uniqueCategoryIds = new Set(categoryIds.map(String));

  if (uniqueCategoryIds.size !== categoryIds.length) {
    return "Duplicate category IDs are not allowed.";
  }

  // Vendors must select active main categories
  const mainCategories = await Category.find({
    _id: { $in: categoryIds },
    parentId: null,
    isActive: true,
  }).select("_id");

  if (mainCategories.length !== categoryIds.length) {
    return "One or more category IDs are invalid, inactive, or are not main categories.";
  }

  const selectedCategoryIds = new Set();

  for (const selection of selectedCategories) {
    if (
      !selection ||
      !mongoose.isValidObjectId(selection.categoryId) ||
      !Array.isArray(selection.serviceIds)
    ) {
      return "Each selected category must have a valid categoryId and a serviceIds array.";
    }

    const categoryId = String(selection.categoryId);

    if (!uniqueCategoryIds.has(categoryId)) {
      return "Every selected category must also be included in categoryIds.";
    }

    if (selectedCategoryIds.has(categoryId)) {
      return "Duplicate selected categories are not allowed.";
    }

    selectedCategoryIds.add(categoryId);

    if (!selection.serviceIds.every((id) => mongoose.isValidObjectId(id))) {
      return "One or more service IDs are invalid.";
    }

    if (
      new Set(selection.serviceIds.map(String)).size !==
      selection.serviceIds.length
    ) {
      return "Duplicate service IDs are not allowed.";
    }

    if (selection.serviceIds.length > 0) {
      const services = await Category.find({
        _id: { $in: selection.serviceIds },
        parentId: selection.categoryId,
        isActive: true,
      }).select("_id");

      if (services.length !== selection.serviceIds.length) {
        return `One or more services do not belong to category ${categoryId}, or are inactive.`;
      }
    }
  }

  return null;
};

// Validate event type IDs
const validateEventTypes = async (eventTypeIds) => {
  if (!validIdArray(eventTypeIds)) {
    return "Please provide at least one valid event type ID.";
  }

  if (new Set(eventTypeIds.map(String)).size !== eventTypeIds.length) {
    return "Duplicate event type IDs are not allowed.";
  }

  const eventTypes = await EventType.find({
    _id: { $in: eventTypeIds },
  }).select("_id");

  if (eventTypes.length !== eventTypeIds.length) {
    return "One or more event type IDs do not exist.";
  }

  return null;
};

// CREATE VENDOR
router.post("/", async (req, res) => {
  try {
    const userId = getUserId(req);

    if (!userId || !mongoose.isValidObjectId(userId)) {
      return res.status(401).json({
        success: false,
        message: "A valid authenticated user is required.",
      });
    }

    const {
      businessName,
      description,
      categoryIds,
      selectedCategories = [],
      eventTypeIds,
      contactPhone,
      contactEmail,
      location,
      serviceAreas = [],
      images = [],
      startingPrice,
      currency = "INR",
    } = req.body;

    if (
      typeof businessName !== "string" ||
      !businessName.trim() ||
      typeof contactPhone !== "string" ||
      !contactPhone.trim() ||
      !location?.address?.trim() ||
      !location?.city?.trim()
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Business name, contact phone, location address, and city are required.",
      });
    }

    if (
      startingPrice !== undefined &&
      (!Number.isFinite(Number(startingPrice)) || Number(startingPrice) < 0)
    ) {
      return res.status(400).json({
        success: false,
        message: "Starting price must be a valid non-negative number.",
      });
    }

    if (!Array.isArray(serviceAreas) || !Array.isArray(images)) {
      return res.status(400).json({
        success: false,
        message: "serviceAreas and images must be arrays.",
      });
    }

    const categoryError = await validateCategorySelections(
      categoryIds,
      selectedCategories,
    );

    if (categoryError) {
      return res.status(400).json({
        success: false,
        message: categoryError,
      });
    }

    const eventTypeError = await validateEventTypes(eventTypeIds);

    if (eventTypeError) {
      return res.status(400).json({
        success: false,
        message: eventTypeError,
      });
    }

    // One vendor profile per user
    const existingVendor = await Vendor.findOne({ userId });

    if (existingVendor) {
      return res.status(409).json({
        success: false,
        message: "You already have a vendor profile.",
      });
    }

    const vendor = await Vendor.create({
      userId,
      publicVendorId: `VEN-${crypto.randomBytes(8).toString("hex").toUpperCase()}`,
      businessName: businessName.trim(),
      description: description || "",
      categoryIds,
      selectedCategories,
      eventTypeIds,
      contactPhone: contactPhone.trim(),
      contactEmail,
      location,
      serviceAreas,
      images,
      startingPrice:
        startingPrice === undefined || startingPrice === ""
          ? undefined
          : Number(startingPrice),
      currency,
      approvalStatus: "pending",
      isActive: false,
    });

    return res.status(201).json({
      success: true,
      message: "Vendor profile created successfully. It is pending approval.",
      vendor,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message:
          "A vendor profile with this user or public vendor ID already exists.",
      });
    }

    if (error.name === "ValidationError" || error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    console.error("Create vendor error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create vendor.",
    });
  }
});

// GET ALL APPROVED VENDORS + FILTERS
router.get("/", async (req, res) => {
  try {
    const filter = {
      approvalStatus: "approved",
      isActive: true,
      deletedAt: null,
    };

    if (req.query.categoryId) {
      if (!mongoose.isValidObjectId(req.query.categoryId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid category ID.",
        });
      }

      filter.categoryIds = req.query.categoryId;
    }

    if (req.query.eventTypeId) {
      if (!mongoose.isValidObjectId(req.query.eventTypeId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid event type ID.",
        });
      }

      filter.eventTypeIds = req.query.eventTypeId;
    }

    if (req.query.city) {
      filter["location.city"] = {
        $regex: String(req.query.city).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        $options: "i",
      };
    }

    if (req.query.serviceArea) {
      filter.serviceAreas = {
        $regex: String(req.query.serviceArea).replace(
          /[.*+?^${}()|[\]\\]/g,
          "\\$&",
        ),
        $options: "i",
      };
    }

    const vendors = await Vendor.find(filter)
      .populate("categoryIds", "name slug")
      .populate("eventTypeIds")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: vendors.length,
      vendors,
    });
  } catch (error) {
    console.error("Get vendors error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve vendors.",
    });
  }
});

// GET ONE VENDOR
router.get("/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid vendor ID.",
      });
    }

    const vendor = await Vendor.findOne({
      _id: req.params.id,
      deletedAt: null,
    })
      .populate("categoryIds", "name slug")
      .populate("eventTypeIds");

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor not found.",
      });
    }

    const isOwner = String(vendor.userId) === String(getUserId(req));
    const isPublic = vendor.approvalStatus === "approved" && vendor.isActive;

    if (!isPublic && !isOwner) {
      return res.status(404).json({
        success: false,
        message: "Vendor not found.",
      });
    }

    return res.status(200).json({
      success: true,
      vendor,
    });
  } catch (error) {
    console.error("Get vendor error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve vendor.",
    });
  }
});

// UPDATE VENDOR (owner only)
router.put("/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid vendor ID.",
      });
    }

    const vendor = await Vendor.findOne({
      _id: req.params.id,
      userId: getUserId(req),
      deletedAt: null,
    });

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor not found or you do not own this profile.",
      });
    }

    // Only allow vendor-editable fields. Approval fields and userId
    // must never be changed through this endpoint.
    const allowedFields = [
      "businessName",
      "description",
      "categoryIds",
      "selectedCategories",
      "eventTypeIds",
      "contactPhone",
      "contactEmail",
      "location",
      "serviceAreas",
      "images",
      "startingPrice",
      "currency",
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

    if (
      updates.businessName !== undefined &&
      (typeof updates.businessName !== "string" || !updates.businessName.trim())
    ) {
      return res.status(400).json({
        success: false,
        message: "Business name cannot be empty.",
      });
    }

    if (
      updates.contactPhone !== undefined &&
      (typeof updates.contactPhone !== "string" || !updates.contactPhone.trim())
    ) {
      return res.status(400).json({
        success: false,
        message: "Contact phone cannot be empty.",
      });
    }

    if (
      updates.startingPrice !== undefined &&
      (!Number.isFinite(Number(updates.startingPrice)) ||
        Number(updates.startingPrice) < 0)
    ) {
      return res.status(400).json({
        success: false,
        message: "Starting price must be a valid non-negative number.",
      });
    }

    if (updates.startingPrice !== undefined) {
      updates.startingPrice = Number(updates.startingPrice);
    }

    const nextCategoryIds = updates.categoryIds ?? vendor.categoryIds;
    const nextSelectedCategories =
      updates.selectedCategories ?? vendor.selectedCategories;

    if (
      updates.categoryIds !== undefined ||
      updates.selectedCategories !== undefined
    ) {
      const categoryError = await validateCategorySelections(
        nextCategoryIds,
        nextSelectedCategories,
      );

      if (categoryError) {
        return res.status(400).json({
          success: false,
          message: categoryError,
        });
      }
    }

    if (updates.eventTypeIds !== undefined) {
      const eventTypeError = await validateEventTypes(updates.eventTypeIds);

      if (eventTypeError) {
        return res.status(400).json({
          success: false,
          message: eventTypeError,
        });
      }
    }

    if (
      updates.serviceAreas !== undefined &&
      !Array.isArray(updates.serviceAreas)
    ) {
      return res.status(400).json({
        success: false,
        message: "serviceAreas must be an array.",
      });
    }

    if (updates.images !== undefined && !Array.isArray(updates.images)) {
      return res.status(400).json({
        success: false,
        message: "images must be an array.",
      });
    }

    Object.assign(vendor, updates);

    // Require address and city if location is changed
    if (!vendor.location?.address?.trim() || !vendor.location?.city?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Location address and city are required.",
      });
    }

    // Send the profile back for approval after significant edits
    vendor.approvalStatus = "pending";
    vendor.isActive = false;
    vendor.reviewedBy = null;
    vendor.reviewedAt = null;
    vendor.rejectionReason = null;

    await vendor.save();

    return res.status(200).json({
      success: true,
      message:
        "Vendor updated successfully. The profile is pending approval again.",
      vendor,
    });
  } catch (error) {
    if (error.name === "ValidationError" || error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    console.error("Update vendor error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update vendor.",
    });
  }
});

// DELETE VENDOR (owner only - soft delete)
router.delete("/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid vendor ID.",
      });
    }

    const vendor = await Vendor.findOne({
      _id: req.params.id,
      userId: getUserId(req),
      deletedAt: null,
    });

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor not found or you do not own this profile.",
      });
    }

    vendor.deletedAt = new Date();
    vendor.isActive = false;

    await vendor.save();

    return res.status(200).json({
      success: true,
      message: "Vendor profile deleted successfully.",
    });
  } catch (error) {
    console.error("Delete vendor error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete vendor.",
    });
  }
});

module.exports = router;
