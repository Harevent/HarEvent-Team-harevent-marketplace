const express = require("express");
const mongoose = require("mongoose");

const Category = require("../models/Category");

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
router.use(verifyFirebaseToken, requireAuth, requireRole("admin"));

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
// ADMIN: Update a category
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

    const allowedFields = ["name", "slug", "description", "sortOrder", "isActive"];
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

    const category = await Category.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    });

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found.",
      });
    }

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
// ADMIN: Delete a category
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

    const hasChildren = await Category.exists({
      parentId: id,
    });

    if (hasChildren) {
      return res.status(409).json({
        success: false,
        message: "Cannot delete a category that has child services.",
      });
    }

    await category.deleteOne();

    return res.status(200).json({
      success: true,
      message: "Category deleted successfully.",
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
