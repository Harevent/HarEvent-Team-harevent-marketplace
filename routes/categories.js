const express = require("express");
const mongoose = require("mongoose");
const Category = require("../models/Category");
const authMiddleware = require("../middleware/auth");

const router = express.Router();

// Generate URL-friendly slug
const generateSlug = (name) => {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
};

// POST: Create category or subcategory
router.post("/", async (req, res) => {
  try {
    const { name, slug, parentId, description, isActive, sortOrder } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Category name is required",
      });
    }

    const finalSlug = slug ? generateSlug(slug) : generateSlug(name);

    if (!finalSlug) {
      return res.status(400).json({
        success: false,
        message: "A valid category slug is required",
      });
    }

    // Validate parent category
    if (parentId !== undefined && parentId !== null) {
      if (!mongoose.isValidObjectId(parentId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid parent category ID",
        });
      }

      const parent = await Category.findById(parentId);

      if (!parent) {
        return res.status(404).json({
          success: false,
          message: "Parent category not found",
        });
      }

      // Prevent nesting beyond one subcategory level
      if (parent.parentId) {
        return res.status(400).json({
          success: false,
          message: "Nested subcategories are not supported",
        });
      }
    }

    const category = await Category.create({
      name: name.trim(),
      slug: finalSlug,
      parentId: parentId || null,
      description: description || "",
      isActive: isActive ?? true,
      sortOrder: sortOrder ?? 0,
    });

    return res.status(201).json({
      success: true,
      message: "Category created successfully",
      data: category,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "This slug already exists under this parent category",
      });
    }

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to create category",
    });
  }
});

// GET: Get all categories
router.get("/", async (req, res) => {
  try {
    const categories = await Category.find().sort({
      parentId: 1,
      sortOrder: 1,
      name: 1,
    });

    return res.status(200).json({
      success: true,
      count: categories.length,
      data: categories,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve categories",
    });
  }
});

// GET: Get main categories with their subcategories
router.get("/tree", async (req, res) => {
  try {
    const categories = await Category.find({
      parentId: null,
    })
      .sort({ sortOrder: 1, name: 1 })
      .lean();

    const subcategories = await Category.find({
      parentId: { $ne: null },
    })
      .sort({ sortOrder: 1, name: 1 })
      .lean();

    const result = categories.map((category) => ({
      ...category,
      subcategories: subcategories.filter(
        (sub) => String(sub.parentId) === String(category._id),
      ),
    }));

    return res.status(200).json({
      success: true,
      count: result.length,
      data: result,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve category tree",
    });
  }
});

// GET: Get category by ID
router.get("/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid category ID",
      });
    }

    const category = await Category.findById(req.params.id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: category,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve category",
    });
  }
});

// PUT: Update category
router.put("/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid category ID",
      });
    }

    const { name, slug, parentId, description, isActive, sortOrder } = req.body;

    const updates = {};

    if (name !== undefined) {
      if (!name.trim()) {
        return res.status(400).json({
          success: false,
          message: "Category name cannot be empty",
        });
      }
      updates.name = name.trim();
    }

    if (slug !== undefined) {
      updates.slug = generateSlug(slug);
    } else if (name !== undefined) {
      updates.slug = generateSlug(name);
    }

    if (parentId !== undefined) {
      if (parentId !== null && !mongoose.isValidObjectId(parentId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid parent category ID",
        });
      }

      if (parentId) {
        const parent = await Category.findById(parentId);

        if (!parent) {
          return res.status(404).json({
            success: false,
            message: "Parent category not found",
          });
        }

        if (parent.parentId) {
          return res.status(400).json({
            success: false,
            message: "Nested subcategories are not supported",
          });
        }
      }

      updates.parentId = parentId;
    }

    if (description !== undefined) updates.description = description;
    if (isActive !== undefined) updates.isActive = isActive;
    if (sortOrder !== undefined) updates.sortOrder = sortOrder;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: "Provide fields to update",
      });
    }

    const category = await Category.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Category updated successfully",
      data: category,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "This slug already exists under this parent category",
      });
    }

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// DELETE: Delete category and its direct subcategories
router.delete("/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid category ID",
      });
    }

    const category = await Category.findById(req.params.id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    await Category.deleteMany({ parentId: category._id });
    await Category.findByIdAndDelete(category._id);

    return res.status(200).json({
      success: true,
      message: "Category and its subcategories deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to delete category",
    });
  }
});

module.exports = router;
