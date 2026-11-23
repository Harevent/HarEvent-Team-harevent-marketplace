
const express = require("express");
const mongoose = require("mongoose");

const Category = require("../models/Category");
const Vendor = require("../models/Vendor");
const EventType = require("../models/EventType");

const { verifyFirebaseToken } = require("../middleware/firebaseAuth");
const { requireAuth } = require("../middleware/requireAuth");
const { requireRole } = require("../middleware/requireRole");

const router = express.Router();

// ---------------------------------------------
// PUBLIC: Get active main vendor categories
// GET /api/categories
// ---------------------------------------------
router.get("/", async (req, res, next) => {
  try {
    const categories = await Category.find({
      isActive: true,
      parentId: null,
    })
      .select("name slug description sortOrder")
      .sort({ sortOrder: 1, name: 1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: categories.length,
      data: categories,
    });
  } catch (error) {
    return next(error);
  }
});

// ---------------------------------------------
// PUBLIC: Get active services under a category
// GET /api/categories/:id/services
// ---------------------------------------------
router.get("/:id/services", async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid category ID.",
      });
    }

    const parentCategory = await Category.findOne({
      _id: id,
      isActive: true,
      parentId: null,
    }).lean();

    if (!parentCategory) {
      return res.status(404).json({
        success: false,
        message: "Category not found.",
      });
    }

    const services = await Category.find({
      parentId: id,
      isActive: true,
    })
      .select("name slug description sortOrder")
      .sort({ sortOrder: 1, name: 1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: services.length,
      data: services,
    });
  } catch (error) {
    return next(error);
  }
});

// ---------------------------------------------
// PUBLIC: Get one active category
// GET /api/categories/:id
// ---------------------------------------------
router.get("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid category ID.",
      });
    }

    const category = await Category.findOne({
      _id: id,
      isActive: true,
    })
      .select("name slug description parentId sortOrder")
      .lean();

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found.",
      });
    }

    return res.status(200).json({
      success: true,
      data: category,
    });
  } catch (error) {
    return next(error);
  }
});

// ---------------------------------------------
// ADMIN-ONLY ROUTES
// ---------------------------------------------
router.use(
  verifyFirebaseToken,
  requireAuth,
  requireRole("admin"),
);

// ---------------------------------------------
// ADMIN: Create a category or service
// POST /api/categories
// ---------------------------------------------
router.post("/", async (req, res, next) => {
  try {
    const { name, slug, description, parentId, sortOrder } = req.body;

    if (!name || !slug) {
      return res.status(400).json({
        success: false,
        message: "Category name and slug are required.",
      });
    }

    if (parentId !== undefined && parentId !== null) {
      if (!mongoose.isValidObjectId(parentId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid parent category ID.",
        });
      }

      const parent = await Category.findOne({
        _id: parentId,
        parentId: null,
        isActive: true,
      });

      if (!parent) {
        return res.status(400).json({
          success: false,
          message: "Parent category does not exist or is inactive.",
        });
      }
    }

    const category = await Category.create({
      name,
      slug,
      description,
      parentId: parentId ?? null,
      sortOrder,
    });

    return res.status(201).json({
      success: true,
      message: "Category created successfully.",
      data: category,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "A category with this slug already exists under this parent.",
      });
    }

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: "Category validation failed.",
      });
    }

    return next(error);
  }
});

// ---------------------------------------------
// ADMIN: Update a category or service
// PUT /api/categories/:id
// ---------------------------------------------
router.put("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid category ID.",
      });
    }

    const categoryExists = await Category.findById(id);

    if (!categoryExists) {
      return res.status(404).json({
        success: false,
        message: "Category not found.",
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

    // Deactivation preserves existing vendor and event type references.
    // Inactive categories and services must not be selected in new registrations
    // or updates. Existing relationships are not deleted or modified.
    const category = await Category.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    });

    return res.status(200).json({
      success: true,
      message: "Category updated successfully.",
      data: category,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "A category with this slug already exists under this parent.",
      });
    }

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: "Category validation failed.",
      });
    }

    return next(error);
  }
});

// ---------------------------------------------
// ADMIN: Delete a category or service
// DELETE /api/categories/:id
// ---------------------------------------------
router.delete("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid category ID.",
      });
    }

    const category = await Category.findById(id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found.",
      });
    }

    // Prevent deleting a category that still has child services.
    const hasChildren = await Category.exists({
      parentId: id,
    });

    if (hasChildren) {
      return res.status(409).json({
        success: false,
        message: "Cannot delete a category that has child services.",
      });
    }

    // Prevent deleting records referenced by vendors or event types.
    const [isUsedByVendor, isUsedByEventType] = await Promise.all([
      Vendor.exists({
        $or: [
          { categoryIds: id },
          { "selectedCategories.categoryId": id },
          { "selectedCategories.serviceIds": id },
        ],
      }),
      EventType.exists({
        vendorCategoryIds: id,
      }),
    ]);

    if (isUsedByVendor || isUsedByEventType) {
      return res.status(409).json({
        success: false,
        message:
          "Cannot delete a category or service that is currently referenced by vendors or event types.",
      });
    }

    await category.deleteOne();

    return res.status(200).json({
      success: true,
      message: "Record deleted successfully.",
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
