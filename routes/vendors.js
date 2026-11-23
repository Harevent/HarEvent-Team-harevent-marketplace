
const express = require("express");
const mongoose = require("mongoose");
const Vendor = require("../models/Vendor");
const authMiddleware = require("../middleware/auth");

const router = express.Router();

// Protect every vendor endpoint
router.use(authMiddleware);

// CREATE VENDOR
router.post("/", async (req, res) => {
  try {
    const {
      businessName,
      category,
      description,
      location,
      contactEmail,
      contactPhone,
      price
    } = req.body;

    if (
      !businessName ||
      !category ||
      !description ||
      !location ||
      !contactEmail ||
      !contactPhone ||
      price === undefined ||
      price === null ||
      price === ""
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide all required vendor fields."
      });
    }

    const numericPrice = Number(price);

    if (!Number.isFinite(numericPrice) || numericPrice < 0) {
      return res.status(400).json({
        success: false,
        message: "Price must be a valid non-negative number."
      });
    }

    const vendor = await Vendor.create({
      businessName,
      category,
      description,
      location,
      contactEmail,
      contactPhone,
      price: numericPrice,
      createdBy: req.user.id
    });

    res.status(201).json({
      success: true,
      message: "Vendor created successfully",
      vendor
    });
  } catch (error) {
    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    console.error("Create vendor error:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to create vendor"
    });
  }
});

// GET ALL VENDORS + SEARCH/FILTER
router.get("/", async (req, res) => {
  try {
    const filter = {};

    if (req.query.category) {
      filter.category = req.query.category;
    }

    if (req.query.location) {
      filter.location = {
        $regex: req.query.location,
        $options: "i"
      };
    }

    const vendors = await Vendor.find(filter)
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: vendors.length,
      vendors
    });
  } catch (error) {
    console.error("Get vendors error:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve vendors"
    });
  }
});

// GET ONE VENDOR
router.get("/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid vendor ID"
      });
    }

    const vendor = await Vendor.findById(req.params.id);

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor not found"
      });
    }

    res.status(200).json({
      success: true,
      vendor
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to retrieve vendor"
    });
  }
});

// UPDATE VENDOR (creator only)
router.put("/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid vendor ID"
      });
    }

    const allowedFields = [
      "businessName",
      "category",
      "description",
      "location",
      "contactEmail",
      "contactPhone",
      "price"
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
        message: "Provide at least one field to update."
      });
    }

    if (
      updates.businessName !== undefined &&
      (typeof updates.businessName !== "string" ||
        !updates.businessName.trim())
    ) {
      return res.status(400).json({
        success: false,
        message: "Business name cannot be empty."
      });
    }

    if (
      updates.price !== undefined &&
      (!Number.isFinite(Number(updates.price)) ||
        Number(updates.price) < 0)
    ) {
      return res.status(400).json({
        success: false,
        message: "Price must be a valid non-negative number."
      });
    }

    if (updates.price !== undefined) {
      updates.price = Number(updates.price);
    }

    const vendor = await Vendor.findOneAndUpdate(
      {
        _id: req.params.id,
        createdBy: req.user.id
      },
      updates,
      { new: true, runValidators: true }
    );

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor not found or you are not its creator."
      });
    }

    res.status(200).json({
      success: true,
      message: "Vendor updated successfully",
      vendor
    });
  } catch (error) {
    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    console.error("Update vendor error:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to update vendor"
    });
  }
});

// DELETE VENDOR (creator only)
router.delete("/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid vendor ID"
      });
    }

    const vendor = await Vendor.findOneAndDelete({
      _id: req.params.id,
      createdBy: req.user.id
    });

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor not found or you are not its creator."
      });
    }

    res.status(200).json({
      success: true,
      message: "Vendor deleted successfully"
    });
  } catch (error) {
    console.error("Delete vendor error:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to delete vendor"
    });
  }
});

module.exports = router;
