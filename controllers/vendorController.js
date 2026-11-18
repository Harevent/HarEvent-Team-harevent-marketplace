const mongoose = require("mongoose");
const { randomUUID } = require("crypto");

const User = require("../models/User");
const Vendor = require("../models/Vendor");
const Category = require("../models/Category");
const EventType = require("../models/EventType");

const {
  vendorRegistrationSchema,
} = require("../validators/vendorValidator");

async function registerVendor(req, res, next) {
  // 1. Validate the registration request.
  const validation = vendorRegistrationSchema.safeParse(req.body);

  if (!validation.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid vendor registration details.",
      errors: validation.error.issues,
    });
  }

  const {
    fullName,
    email,
    businessName,
    description,
    categoryIds,
    selectedCategories = [],
    eventTypeIds,
    contactPhone,
    contactEmail,
    location,
    serviceAreas = [],
    startingPrice,
  } = validation.data;

  // 2. Use identity verified by Firebase middleware.
  const { firebaseUid, phoneNumber } = req.firebaseUser;

  let session;

  try {
    // 3. Check whether the Firebase UID or phone already exists.
    const existingUsers = await User.find({
      $or: [{ firebaseUid }, { phoneNumber }],
    }).select("role");

    // 4. Prevent registration with an identity belonging to another role.
    const hasDifferentRole = existingUsers.some(
      (user) => user.role === "customer" || user.role === "admin",
    );

    if (hasDifferentRole) {
      return res.status(403).json({
        success: false,
        message:
          "This identity is already registered with a different role.",
      });
    }

    // 5. Prevent duplicate vendor registration.
    const vendorAlreadyExists = existingUsers.some(
      (user) => user.role === "vendor",
    );

    if (vendorAlreadyExists) {
      return res.status(409).json({
        success: false,
        message: "Vendor account is already registered.",
      });
    }

    // 6. Validate that all selected categories are active main categories.
    const categories = await Category.find({
      _id: { $in: categoryIds },
      parentId: null,
      isActive: true,
    }).select("_id");

    if (categories.length !== categoryIds.length) {
      return res.status(400).json({
        success: false,
        message:
          "One or more selected vendor categories are invalid or inactive.",
      });
    }

    // 7. Validate that all selected event types are active.
    const eventTypes = await EventType.find({
      _id: { $in: eventTypeIds },
      isActive: true,
    }).select("_id vendorCategoryIds");

    if (eventTypes.length !== eventTypeIds.length) {
      return res.status(400).json({
        success: false,
        message:
          "One or more selected event types are invalid or inactive.",
      });
    }

    // 8. Check category compatibility across the selected event types.
    const allowedCategoryIds = new Set(
      eventTypes.flatMap((eventType) =>
        eventType.vendorCategoryIds.map((id) => id.toString()),
      ),
    );

    const incompatibleCategoryIds = categoryIds.filter(
      (id) => !allowedCategoryIds.has(id),
    );

    if (incompatibleCategoryIds.length > 0) {
      return res.status(400).json({
        success: false,
        message:
          "One or more selected vendor categories are not available for the selected event types.",
        incompatibleCategoryIds,
      });
    }

    // 9. Validate selected service/category relationships.
    const selectedCategoryIds = new Set();

    for (const selection of selectedCategories) {
      if (!categoryIds.includes(selection.categoryId)) {
        return res.status(400).json({
          success: false,
          message:
            "Each selected service category must also be included in categoryIds.",
        });
      }

      if (selectedCategoryIds.has(selection.categoryId)) {
        return res.status(400).json({
          success: false,
          message: "Duplicate selected service categories are not allowed.",
        });
      }

      selectedCategoryIds.add(selection.categoryId);
    }

    const serviceChecks = selectedCategories.flatMap((selection) =>
      selection.serviceIds.map((serviceId) => ({
        serviceId,
        categoryId: selection.categoryId,
      })),
    );

    if (serviceChecks.length > 0) {
      const serviceIds = serviceChecks.map(
        (service) => service.serviceId,
      );

      const services = await Category.find({
        _id: { $in: serviceIds },
        isActive: true,
      }).select("_id parentId");

      const validServices = new Map(
        services.map((service) => [
          service._id.toString(),
          service.parentId?.toString(),
        ]),
      );

      const hasInvalidService = serviceChecks.some(
        ({ serviceId, categoryId }) =>
          validServices.get(serviceId) !== categoryId,
      );

      if (hasInvalidService) {
        return res.status(400).json({
          success: false,
          message:
            "One or more selected services are invalid, inactive, or do not belong to their selected category.",
        });
      }
    }

    // 10. Create User and Vendor records in one transaction.
    session = await mongoose.startSession();

    let registeredUser;
    let registeredVendor;

    await session.withTransaction(async () => {
      const [user] = await User.create(
        [
          {
            firebaseUid,
            phoneNumber,
            fullName,
            ...(email ? { email } : {}),
            role: "vendor",
            accountStatus: "active",
          },
        ],
        { session },
      );

      const [vendor] = await Vendor.create(
        [
          {
            userId: user._id,
            publicVendorId: randomUUID(),
            businessName,
            description: description || "",
            categoryIds,
            selectedCategories,
            eventTypeIds,
            contactPhone,
            ...(contactEmail ? { contactEmail } : {}),
            location,
            serviceAreas,
            ...(startingPrice !== undefined ? { startingPrice } : {}),
            approvalStatus: "pending",
            isActive: false,
          },
        ],
        { session },
      );

      registeredUser = user;
      registeredVendor = vendor;
    });

    // 11. Return the registration result.
    return res.status(201).json({
      success: true,
      message:
        "Vendor registration submitted successfully. Your account is pending approval.",
      data: {
        userId: registeredUser._id,
        vendorId: registeredVendor._id,
        publicVendorId: registeredVendor.publicVendorId,
        fullName: registeredUser.fullName,
        phoneNumber: registeredUser.phoneNumber,
        email: registeredUser.email,
        role: registeredUser.role,
        businessName: registeredVendor.businessName,
        approvalStatus: registeredVendor.approvalStatus,
        isActive: registeredVendor.isActive,
      },
    });
  } catch (error) {
    // 12. Handle duplicate records.
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message:
          "An account or vendor profile with this identity already exists.",
      });
    }

    // 13. Forward unexpected errors to the central error handler.
    return next(error);
  } finally {
    // 14. Close the transaction session.
    if (session) {
      await session.endSession();
    }
  }
}

module.exports = { registerVendor };
