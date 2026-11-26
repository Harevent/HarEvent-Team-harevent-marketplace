
const User = require("../models/User");
const Customer = require("../models/Customer");
const Vendor = require("../models/Vendor");
const EventType = require("../models/EventType");
const Category = require("../models/Category");
const Enquiry = require("../models/Enquiry");

const { enquiryCreateSchema } = require("../validators/enquiryValidator");

// CREATE ENQUIRY
// POST /api/enquiries

async function createEnquiry(req, res, next) {
  try {
    const validation = enquiryCreateSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validation.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      });
    }

    const {
      vendorId,
      eventTypeId,
      eventDate,
      eventLocation,
      guestCount,
      requiredServices,
      budget,
      message,
    } = validation.data;

    const customer = await Customer.findOne({
      userId: req.user.userId,
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer profile not found",
      });
    }

    const user = await User.findById(req.user.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Customer account not found",
      });
    }

    const vendor = await Vendor.findOne({
      _id: vendorId,
      approvalStatus: "approved",
      isActive: true,
      deletedAt: null,
    });

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor not found or unavailable",
      });
    }

    const eventType = await EventType.findOne({
      _id: eventTypeId,
      isActive: true,
    }).select("_id vendorCategoryIds");

    if (!eventType) {
      return res.status(400).json({
        success: false,
        message: "Selected event type is unavailable",
      });
    }

    const vendorEventTypeIds = vendor.eventTypeIds.map((id) =>
      id.toString()
    );

    if (!vendorEventTypeIds.includes(eventTypeId)) {
      return res.status(400).json({
        success: false,
        message: "This vendor does not provide the selected event type",
      });
    }

    const vendorCategoryIds = vendor.categoryIds.map((id) =>
      id.toString()
    );

    const allowedCategoryIds = eventType.vendorCategoryIds.map((id) =>
      id.toString()
    );

    const hasCompatibleCategory = vendorCategoryIds.some((id) =>
      allowedCategoryIds.includes(id)
    );

    if (!hasCompatibleCategory) {
      return res.status(400).json({
        success: false,
        message: "This vendor does not support the selected event type",
      });
    }

    const serviceIds = requiredServices || [];

    if (serviceIds.length > 0) {
      const vendorServices = vendor.selectedCategories.flatMap(
        (selection) =>
          selection.serviceIds.map((serviceId) => ({
            serviceId: serviceId.toString(),
            categoryId: selection.categoryId.toString(),
          }))
      );

      const offeredServiceIds = new Set(
        vendorServices.map((service) => service.serviceId)
      );

      const unavailableServices = serviceIds.filter(
        (serviceId) => !offeredServiceIds.has(serviceId)
      );

      if (unavailableServices.length > 0) {
        return res.status(400).json({
          success: false,
          message:
            "One or more selected services are not offered by this vendor",
          unavailableServices,
        });
      }

      const services = await Category.find({
        _id: { $in: serviceIds },
        isActive: true,
      }).select("_id parentId");

      const validServices = new Map(
        services.map((service) => [
          service._id.toString(),
          service.parentId?.toString(),
        ])
      );

      const hasInvalidService = serviceIds.some((serviceId) => {
        const vendorService = vendorServices.find(
          (service) => service.serviceId === serviceId
        );

        return (
          !validServices.has(serviceId) ||
          !vendorService ||
          validServices.get(serviceId) !== vendorService.categoryId ||
          !allowedCategoryIds.includes(vendorService.categoryId)
        );
      });

      if (hasInvalidService) {
        return res.status(400).json({
          success: false,
          message: "One or more selected services are invalid or inactive",
        });
      }
    }

    const enquiry = await Enquiry.create({
      customerId: customer._id,
      vendorId: vendor._id,
      customerNameSnapshot: user.fullName,
      customerPhoneSnapshot: user.phoneNumber,
      ...(user.email ? { email: user.email } : {}),
      eventTypeId: eventType._id,
      eventDate,
      eventLocation,
      guestCount,
      requiredServices: serviceIds,
      budget,
      message,
      status: "pending",
    });

    return res.status(201).json({
      success: true,
      message: "Enquiry created successfully",
      data: enquiry,
    });
  } catch (error) {
    return next(error);
  }
}

// GET CUSTOMER ENQUIRIES
// GET /api/enquiries/my

async function getCustomerEnquiries(req, res, next) {
  try {
    const customer = await Customer.findOne({
      userId: req.user.userId,
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer profile not found",
      });
    }

    const enquiries = await Enquiry.find({
      customerId: customer._id,
    }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      message: "Customer enquiries retrieved successfully",
      data: enquiries,
    });
  } catch (error) {
    return next(error);
  }
}

// GET ENQUIRY BY ID
// GET /api/enquiries/:id

async function getEnquiryById(req, res, next) {
  try {
    const { id } = req.params;

    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid enquiry ID",
      });
    }

    const enquiry = await Enquiry.findById(id);

    if (!enquiry) {
      return res.status(404).json({
        success: false,
        message: "Enquiry not found",
      });
    }

    if (req.user.role === "customer") {
      const customer = await Customer.findOne({
        userId: req.user.userId,
      });

      if (!customer) {
        return res.status(404).json({
          success: false,
          message: "Customer profile not found",
        });
      }

      if (enquiry.customerId.toString() !== customer._id.toString()) {
        return res.status(403).json({
          success: false,
          message: "You are not authorized to view this enquiry",
        });
      }
    } else if (req.user.role === "vendor") {
      if (
        !req.user.vendorId ||
        enquiry.vendorId.toString() !== req.user.vendorId
      ) {
        return res.status(403).json({
          success: false,
          message: "You are not authorized to view this enquiry",
        });
      }
    } else {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to view this enquiry",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Enquiry retrieved successfully",
      data: enquiry,
    });
  } catch (error) {
    return next(error);
  }
}

// CANCEL CUSTOMER ENQUIRY
// PATCH /api/enquiries/:id/cancel

async function cancelEnquiry(req, res, next) {
  try {
    const { id } = req.params;

    // 1. Validate the enquiry ID.
    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid enquiry ID",
      });
    }

    // 2. Find the authenticated customer's profile.
    const customer = await Customer.findOne({
      userId: req.user.userId,
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer profile not found",
      });
    }

    // 3. Find the enquiry.
    const enquiry = await Enquiry.findById(id);

    if (!enquiry) {
      return res.status(404).json({
        success: false,
        message: "Enquiry not found",
      });
    }

    // 4. Verify that this enquiry belongs to the customer.
    if (enquiry.customerId.toString() !== customer._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to cancel this enquiry",
      });
    }

    // 5. Only pending enquiries can be cancelled.
    if (enquiry.status !== "pending") {
      return res.status(409).json({
        success: false,
        message: "Only pending enquiries can be cancelled",
      });
    }

    // 6. Update only if the enquiry is still pending.
    // This prevents cancellation if its status changes
    // between the initial read and the database update.
    const cancelledEnquiry = await Enquiry.findOneAndUpdate(
      {
        _id: id,
        customerId: customer._id,
        status: "pending",
      },
      {
        $set: {
          status: "cancelled",
          statusUpdatedAt: new Date(),
        },
      },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!cancelledEnquiry) {
      return res.status(409).json({
        success: false,
        message: "This enquiry can no longer be cancelled",
      });
    }

    // 7. Return the updated enquiry.
    return res.status(200).json({
      success: true,
      message: "Enquiry cancelled successfully",
      data: cancelledEnquiry,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  createEnquiry,
  getCustomerEnquiries,
  getEnquiryById,
  cancelEnquiry,
};
