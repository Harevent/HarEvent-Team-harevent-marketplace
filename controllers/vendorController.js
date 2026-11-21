
const mongoose = require("mongoose");
const { randomUUID } = require("crypto");

const User = require("../models/User");
const Vendor = require("../models/Vendor");
const Category = require("../models/Category");
const EventType = require("../models/EventType");

const {
  vendorRegistrationSchema,
  vendorUpdateSchema,
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

// GET: Retrieve the authenticated vendor's own profile.
async function getMyVendorProfile(req, res, next) {
  try {
    const vendor = await Vendor.findOne({
      userId: req.user.userId,
      deletedAt: null,
    })
      .select(
        "publicVendorId businessName description categoryIds selectedCategories eventTypeIds contactPhone contactEmail location serviceAreas images startingPrice currency approvalStatus rejectionReason isActive createdAt updatedAt",
      )
      .populate("categoryIds", "name slug")
      .populate("selectedCategories.categoryId", "name slug")
      .populate("selectedCategories.serviceIds", "name slug")
      .populate("eventTypeIds", "name slug")
      .lean();

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor profile not found.",
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

// PUT: Update the authenticated vendor's existing profile.
async function updateMyVendorProfile(req, res, next) {
  try {
    // 1. Validate the update request.
    const validation = vendorUpdateSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid vendor profile update details.",
        errors: validation.error.issues,
      });
    }

    const updates = validation.data;

    // 2. Find the profile belonging to the authenticated vendor.
    const vendor = await Vendor.findOne({
      userId: req.user.userId,
      deletedAt: null,
    });

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor profile not found.",
      });
    }

    // 3. Build the final profile values.
    // Unchanged fields retain their existing values.
    const finalCategoryIds = (
      updates.categoryIds ?? vendor.categoryIds
    ).map((id) => id.toString());

    const finalEventTypeIds = (
      updates.eventTypeIds ?? vendor.eventTypeIds
    ).map((id) => id.toString());

    const finalSelectedCategories = (
      updates.selectedCategories ?? vendor.selectedCategories
    ).map((selection) => ({
      categoryId: selection.categoryId.toString(),
      serviceIds: selection.serviceIds.map((id) => id.toString()),
    }));

    const categorySelectionChanged =
      updates.categoryIds !== undefined ||
      updates.selectedCategories !== undefined;

    const serviceSelectionChanged =
      updates.selectedCategories !== undefined;

    const eventTypeSelectionChanged =
      updates.eventTypeIds !== undefined;

    // 4. Validate active main vendor categories only when
    // the vendor submits new or changed category selections.
    if (categorySelectionChanged) {
      const categories = await Category.find({
        _id: { $in: finalCategoryIds },
        parentId: null,
        isActive: true,
      }).select("_id");

      if (categories.length !== finalCategoryIds.length) {
        return res.status(400).json({
          success: false,
          message:
            "One or more selected vendor categories are invalid or inactive.",
        });
      }
    }

    // 5. Validate event types.
    // Existing inactive event types are preserved during unrelated updates.
    // Explicit event type changes require active event types.
    const eventTypeFilter = {
      _id: { $in: finalEventTypeIds },
      ...(eventTypeSelectionChanged ? { isActive: true } : {}),
    };

    const eventTypes = await EventType.find(eventTypeFilter).select(
      "_id vendorCategoryIds",
    );

    if (eventTypes.length !== finalEventTypeIds.length) {
      return res.status(400).json({
        success: false,
        message: eventTypeSelectionChanged
          ? "One or more selected event types are invalid or inactive."
          : "One or more selected event types no longer exist.",
      });
    }

    // 6. Check compatibility between categories and event types.
    const allowedCategoryIds = new Set(
      eventTypes.flatMap((eventType) =>
        eventType.vendorCategoryIds.map((id) => id.toString()),
      ),
    );

    const incompatibleCategoryIds = finalCategoryIds.filter(
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

    // 7. Validate selected service/category relationships.
    const selectedCategoryIds = new Set();

    for (const selection of finalSelectedCategories) {
      if (!finalCategoryIds.includes(selection.categoryId)) {
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

    const serviceChecks = finalSelectedCategories.flatMap((selection) =>
      selection.serviceIds.map((serviceId) => ({
        serviceId,
        categoryId: selection.categoryId,
      })),
    );

    if (serviceChecks.length > 0 && serviceSelectionChanged) {
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

    // 8. Update only permitted business profile fields.
    const permittedFields = [
      "businessName",
      "description",
      "categoryIds",
      "selectedCategories",
      "eventTypeIds",
      "contactPhone",
      "contactEmail",
      "serviceAreas",
      "startingPrice",
    ];

    for (const field of permittedFields) {
      if (Object.prototype.hasOwnProperty.call(updates, field)) {
        vendor.set(field, updates[field]);
      }
    }

    // Merge partial location updates with the existing location.
    if (updates.location) {
      vendor.location = {
        ...vendor.location.toObject(),
        ...updates.location,
      };
    }

    // 9. Preserve the vendor's existing approval and active status.
    await vendor.save();

    // 10. Return the updated profile.
    await vendor.populate([
      { path: "categoryIds", select: "name slug" },
      { path: "selectedCategories.categoryId", select: "name slug" },
      { path: "selectedCategories.serviceIds", select: "name slug" },
      { path: "eventTypeIds", select: "name slug" },
    ]);

    return res.status(200).json({
      success: true,
      message: "Vendor profile updated successfully.",
      data: vendor,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  registerVendor,
  getMyVendorProfile,
  updateMyVendorProfile,
};
