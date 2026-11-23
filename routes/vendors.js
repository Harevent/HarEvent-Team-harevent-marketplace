
const express = require("express");
const mongoose = require("mongoose");

const Vendor = require("../models/Vendor");
const { verifyFirebaseToken } = require("../middleware/firebaseAuth");
const { requireAuth } = require("../middleware/requireAuth");
const { requireRole } = require("../middleware/requireRole");
const { registerVendor,getMyVendorProfile,updateMyVendorProfile,} = require("../controllers/vendorController");
const router = express.Router();

// VENDOR REGISTRATION
// Firebase authentication is required.
router.post("/register", verifyFirebaseToken, registerVendor);
// VENDOR: Get own profile.
router.get(
  "/me",
  verifyFirebaseToken,
  requireAuth,
  requireRole("vendor"),
  getMyVendorProfile,
);

// VENDOR: Update own profile.
router.put(
  "/me",
  verifyFirebaseToken,
  requireAuth,
  requireRole("vendor"),
  updateMyVendorProfile,
);

// PUBLIC: Get approved and active vendors for the homepage.
// Supports category, event type, city, search and pagination.
router.get("/", async (req, res, next) => {
  try {
    const {
      categoryId,
      eventTypeId,
      city,
      location,
      search,
      page = 1,
      limit = 12,
    } = req.query;

    // Validate pagination.
    const pageNumber = Number(page);
    const limitNumber = Number(limit);

    if (
      !Number.isInteger(pageNumber) ||
      pageNumber < 1 ||
      !Number.isInteger(limitNumber) ||
      limitNumber < 1 ||
      limitNumber > 50
    ) {
      return res.status(400).json({
        success: false,
        message: "Page must be positive and limit must be between 1 and 50.",
      });
    }

    // Validate category ID.
    if (categoryId && !mongoose.isValidObjectId(categoryId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid category ID.",
      });
    }

    // Validate event type ID.
    if (eventTypeId && !mongoose.isValidObjectId(eventTypeId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid event type ID.",
      });
    }

    // Only approved, active and non-deleted vendors are public.
    const filter = {
      approvalStatus: "approved",
      isActive: true,
      deletedAt: null,
    };

    if (categoryId) {
      filter.categoryIds = categoryId;
    }

    if (eventTypeId) {
      filter.eventTypeIds = eventTypeId;
    }

    // Accept either city or location as the city search parameter.
    const citySearch = city || location;

    if (citySearch) {
      const safeCity = citySearch
        .trim()
        .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

      filter["location.city"] = {
        $regex: safeCity,
        $options: "i",
      };
    }

    // Search business name and description.
    if (search && search.trim()) {
      const safeSearch = search
        .trim()
        .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

      filter.$or = [
        { businessName: { $regex: safeSearch, $options: "i" } },
        { description: { $regex: safeSearch, $options: "i" } },
      ];
    }

    const skip = (pageNumber - 1) * limitNumber;

    const [vendors, total] = await Promise.all([
      Vendor.find(filter)
        .select(
          "publicVendorId businessName description categoryIds eventTypeIds contactPhone location serviceAreas images startingPrice currency createdAt",
        )
        .populate("categoryIds", "name slug")
        .populate("eventTypeIds", "name slug")
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
});

// CUSTOMER: Get details of one publicly available vendor.
router.get(
  "/:id",
  verifyFirebaseToken,
  requireAuth,
  requireRole("customer"),
  async (req, res, next) => {
    try {
      const { id } = req.params;

      // Validate vendor ID.
      if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid vendor ID.",
        });
      }

      // Find only approved, active and non-deleted vendors.
      const vendor = await Vendor.findOne({
        _id: id,
        approvalStatus: "approved",
        isActive: true,
        deletedAt: null,
      })
        .select(
          "publicVendorId businessName description categoryIds selectedCategories eventTypeIds contactPhone contactEmail location serviceAreas images startingPrice currency createdAt",
        )
        .populate("categoryIds", "name slug description")
        .populate("selectedCategories.categoryId", "name slug")
        .populate("selectedCategories.serviceIds", "name slug")
        .populate("eventTypeIds", "name slug")
        .lean();

      if (!vendor) {
        return res.status(404).json({
          success: false,
          message: "Vendor not found.",
        });
      }

      return res.status(200).json({
        success: true,
        data: vendor,
      });
    } catch (error) {
      return next(error);
    }
  },
);

module.exports = router;
