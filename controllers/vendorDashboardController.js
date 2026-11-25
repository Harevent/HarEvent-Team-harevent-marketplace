const Vendor = require("../models/Vendor");
const Enquiry = require("../models/Enquiry");
const VendorSubscription = require("../models/VendorSubscription");

const ENQUIRY_STATUSES = [
  "pending",
  "viewed",
  "accepted",
  "rejected",
  "cancelled",
];

async function getVendorDashboard(req, res, next) {
  try {
    const { userId, vendorId } = req.user;

    // A vendor account may exist before its vendor profile is created.
    if (!vendorId) {
      return res.status(404).json({
        success: false,
        message: "Vendor profile not found.",
      });
    }

    // Retrieve only the authenticated vendor's profile.
    const vendor = await Vendor.findOne({
      _id: vendorId,
      userId,
      deletedAt: null,
    })
      .select(
        "publicVendorId businessName description categoryIds eventTypeIds contactPhone contactEmail location serviceAreas images startingPrice currency approvalStatus rejectionReason isActive createdAt updatedAt",
      )
      .populate("categoryIds", "name slug")
      .populate("eventTypeIds", "name slug")
      .lean();

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor profile not found.",
      });
    }

    // Retrieve counts belonging exclusively to this vendor.
    const enquiryCounts = await Promise.all(
      ENQUIRY_STATUSES.map((status) =>
        Enquiry.countDocuments({
          vendorId,
          status,
        }),
      ),
    );

    const enquiries = Object.fromEntries(
      ENQUIRY_STATUSES.map((status, index) => [
        status,
        enquiryCounts[index],
      ]),
    );

    enquiries.total = enquiryCounts.reduce(
      (total, count) => total + count,
      0,
    );

    // Retrieve the vendor's active subscription, if one exists.
    const subscription = await VendorSubscription.findOne({
      vendorId,
      status: "active",
    })
      .select(
        "planId selectedCategoryIds finalAmount status startsAt expiresAt createdAt",
      )
      .populate({
        path: "planId",
        select: "name slug priceAmount currency billingPeriod features",
      })
      .lean();

    return res.status(200).json({
      success: true,
      data: {
        vendor,
        enquiries,
        subscription: subscription || null,
      },
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getVendorDashboard,
};