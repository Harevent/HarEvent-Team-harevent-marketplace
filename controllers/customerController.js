const mongoose = require("mongoose");

const User = require("../models/User");
const Customer = require("../models/Customer");

const {
  customerRegistrationSchema,
} = require("../validators/customerValidator");

async function registerCustomer(req, res, next) {
  // 1. Validate the registration details received from the frontend.
  const validation = customerRegistrationSchema.safeParse(req.body);

  if (!validation.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid customer registration details.",
      errors: validation.error.issues,
    });
  }

  // 2. Extract validated registration details.
  const { name, city, state, email } = validation.data;

  // 3. Get identity details verified by Firebase middleware.
  const { firebaseUid, phoneNumber } = req.firebaseUser;

  let session;

  try {
    // 4. Check whether the Firebase UID OR phone number already exists.
    const existingUsers = await User.find({
      $or: [
        { firebaseUid },
        { phoneNumber },
      ],
    }).select("role");

    // 5. Block registration if either identifier belongs to another role.
    const hasDifferentRole = existingUsers.some(
      (user) => user.role === "vendor" || user.role === "admin"
    );

    if (hasDifferentRole) {
      return res.status(403).json({
        success: false,
        message:
          "This identity is already registered with a different role.",
      });
    }

    // 6. Prevent an existing customer from registering again.
    const customerAlreadyExists = existingUsers.some(
      (user) => user.role === "customer"
    );

    if (customerAlreadyExists) {
      return res.status(409).json({
        success: false,
        message: "Customer account is already registered.",
      });
    }

    // 7. Start a MongoDB transaction.
    session = await mongoose.startSession();

    let registeredUser;
    let registeredCustomer;

    await session.withTransaction(async () => {
      // 8. Create the User record.
      const [user] = await User.create(
        [
          {
            firebaseUid,
            phoneNumber,
            fullName: name,
            ...(email ? { email } : {}),
            role: "customer",
            accountStatus: "active",
          },
        ],
        { session }
      );

      // 9. Create the Customer profile linked to the User.
      const [customer] = await Customer.create(
        [
          {
            userId: user._id,
            city,
            ...(state ? { state } : {}),
          },
        ],
        { session }
      );

      registeredUser = user;
      registeredCustomer = customer;
    });

    // 10. Return a successful registration response.
    return res.status(201).json({
      success: true,
      message: "Customer registered successfully.",
      data: {
        userId: registeredUser._id,
        customerId: registeredCustomer._id,
        name: registeredUser.fullName,
        phoneNumber: registeredUser.phoneNumber,
        email: registeredUser.email,
        role: registeredUser.role,
        city: registeredCustomer.city,
        state: registeredCustomer.state,
      },
    });
  } catch (error) {
    // 11. Handle duplicate records, including simultaneous requests.
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message:
          "An account with this Firebase identity or phone number already exists.",
      });
    }

    // 12. Forward unexpected errors to the central error handler.
    return next(error);
  } finally {
    // 13. Close the MongoDB session.
    if (session) {
      await session.endSession();
    }
  }
}

module.exports = { registerCustomer };
