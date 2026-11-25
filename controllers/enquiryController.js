
const User = require("../models/User");
const Customer = require("../models/Customer");
const Vendor = require("../models/Vendor");
const EventType = require("../models/EventType");
const Category = require("../models/Category");
const Enquiry = require("../models/Enquiry");

const { enquiryCreateSchema } = require("../validators/enquiryValidator");

async function createEnquiry(req, res, next) {
  try {
    // 1. Validate the customer's request.
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

    // 3. Retrieve the customer's verified account details.
    const user = await User.findById(req.user.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Customer account not found",
      });
    }

    // 4. Find an available, approved vendor.
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

    // 5. Check that the selected event type is active
    // and supported by this vendor.
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

    // 6. Check compatibility between the vendor's main categories
    // and the selected event type.
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

    // 7. Validate that requested services are actually offered
    // by this vendor under their selected main categories.
    const serviceIds = requiredServices || [];

    if (serviceIds.length > 0) {
      const vendorServices = vendor.selectedCategories.flatMap(
        (selection) => selection.serviceIds.map((serviceId) => ({
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
          message: "One or more selected services are not offered by this vendor",
          unavailableServices,
        });
      }

      // 8. Confirm requested services are still active child categories
      // and belong to the vendor's selected main categories.
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
          validServices.get(serviceId) !== vendorService.categoryId
        );
      });

      if (hasInvalidService) {
        return res.status(400).json({
          success: false,
          message: "One or more selected services are invalid or inactive",
        });
      }
    }

    // 9. Create the enquiry with customer identity snapshots.
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

    // 10. Return the created enquiry.
    return res.status(201).json({
      success: true,
      message: "Enquiry created successfully",
      data: enquiry,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  createEnquiry,
};
