
const test = require("node:test");
const assert = require("node:assert/strict");

const mongoose = require("mongoose");
const User = require("../models/User");
const Customer = require("../models/Customer");

const {
  registerCustomer,
} = require("../controllers/customerController");

// Create a mock Express response.
function createMockResponse() {
  return {
    statusCode: null,
    responseBody: null,

    status(code) {
      this.statusCode = code;
      return this;
    },

    json(body) {
      this.responseBody = body;
      return this;
    },
  };
}

// Create a mock request with Firebase-verified identity.
function createMockRequest(body = {}) {
  return {
    body,
    firebaseUser: {
      firebaseUid: "verified-firebase-uid",
      phoneNumber: "+919876543210",
    },
  };
}

// Common valid registration details.
function validCustomerData() {
  return {
    name: "Test Customer",
    city: "Mumbai",
    state: "Maharashtra",
    email: "customer@example.com",
  };
}

// Run the controller with mocked database operations.
async function runController(
  req,
  t,
  existingUsers = [],
  transactionOptions = {},
) {
  const res = createMockResponse();
  let nextError = null;

  const session = {
    withTransaction: async (callback) => {
      // Simulate a transaction failure after the callback,
      // such as a commit failure.
      await callback();

      if (transactionOptions.transactionError) {
        throw transactionOptions.transactionError;
      }
    },

    endSession: async () => {
      if (transactionOptions.onEndSession) {
        transactionOptions.onEndSession();
      }
    },
  };

  // Match existing users using the controller's $or query.
  t.mock.method(User, "find", (query) => ({
    select: async () =>
      existingUsers.filter((user) => {
        // Support the original generic role-conflict tests.
        if (!user.firebaseUid && !user.phoneNumber) {
          return true;
        }

        return query.$or.some((condition) =>
          Object.entries(condition).some(
            ([field, value]) => user[field] === value,
          ),
        );
      }),
  }));

  t.mock.method(mongoose, "startSession", async () => session);

  await registerCustomer(req, res, (error) => {
    nextError = error;
  });

  return { res, nextError };
}

// 1. Invalid registration details.
test("invalid customer data returns 400", async (t) => {
  const startSession = t.mock.method(mongoose, "startSession");

  const { res } = await runController(
    createMockRequest({ name: "", city: "Mumbai" }),
    t,
  );

  assert.equal(res.statusCode, 400);
  assert.equal(res.responseBody.success, false);
  assert.equal(startSession.mock.calls.length, 0);
});

// 2. Successful customer registration.
test("customer registration creates User and Customer records", async (t) => {
  const userId = new mongoose.Types.ObjectId();
  const customerId = new mongoose.Types.ObjectId();

  let createdUserData;
  let createdCustomerData;
  let sessionEnded = false;

  t.mock.method(User, "create", async (documents) => {
    createdUserData = documents[0];

    return [{ ...documents[0], _id: userId }];
  });

  t.mock.method(Customer, "create", async (documents) => {
    createdCustomerData = documents[0];

    return [{ ...documents[0], _id: customerId }];
  });

  const { res, nextError } = await runController(
    createMockRequest(validCustomerData()),
    t,
    [],
    {
      onEndSession: () => {
        sessionEnded = true;
      },
    },
  );

  assert.equal(nextError, null);
  assert.equal(res.statusCode, 201);
  assert.equal(res.responseBody.success, true);

  assert.equal(createdUserData.firebaseUid, "verified-firebase-uid");
  assert.equal(createdUserData.phoneNumber, "+919876543210");
  assert.equal(createdUserData.fullName, "Test Customer");
  assert.equal(createdUserData.role, "customer");

  assert.equal(createdCustomerData.userId.toString(), userId.toString());
  assert.equal(createdCustomerData.city, "Mumbai");

  assert.equal(res.responseBody.data.userId.toString(), userId.toString());
  assert.equal(
    res.responseBody.data.customerId.toString(),
    customerId.toString(),
  );
  assert.equal(res.responseBody.data.role, "customer");
  assert.equal(sessionEnded, true);
});

// 3. Existing customer account.
test("existing customer account returns 409", async (t) => {
  const { res } = await runController(
    createMockRequest(validCustomerData()),
    t,
    [{ role: "customer" }],
  );

  assert.equal(res.statusCode, 409);
  assert.equal(res.responseBody.success, false);
});

// 4. Existing vendor account.
test("existing vendor account returns 403", async (t) => {
  const { res } = await runController(
    createMockRequest(validCustomerData()),
    t,
    [{ role: "vendor" }],
  );

  assert.equal(res.statusCode, 403);
  assert.equal(res.responseBody.success, false);
});

// 5. Existing admin account.
test("existing admin account returns 403", async (t) => {
  const { res } = await runController(
    createMockRequest(validCustomerData()),
    t,
    [{ role: "admin" }],
  );

  assert.equal(res.statusCode, 403);
  assert.equal(res.responseBody.success, false);
});


// 6. Duplicate Firebase UID during User creation.
test("duplicate Firebase UID from User creation returns 409", async (t) => {
  const duplicateError = Object.assign(new Error("Duplicate Firebase UID"), {
    code: 11000,
    keyPattern: { firebaseUid: 1 },
    keyValue: { firebaseUid: "verified-firebase-uid" },
  });

  let sessionEnded = false;

  t.mock.method(User, "create", async () => {
    throw duplicateError;
  });

  const { res, nextError } = await runController(
    createMockRequest(validCustomerData()),
    t,
    [],
    {
      onEndSession: () => {
        sessionEnded = true;
      },
    },
  );

  assert.equal(nextError, null);
  assert.equal(res.statusCode, 409);
  assert.equal(res.responseBody.success, false);
  assert.equal(sessionEnded, true);
});

// 7. Duplicate phone number during User creation.
test("duplicate phone number from User creation returns 409", async (t) => {
  const duplicateError = Object.assign(new Error("Duplicate phone number"), {
    code: 11000,
    keyPattern: { phoneNumber: 1 },
    keyValue: { phoneNumber: "+919876543210" },
  });

  let sessionEnded = false;

  t.mock.method(User, "create", async () => {
    throw duplicateError;
  });

  const { res, nextError } = await runController(
    createMockRequest(validCustomerData()),
    t,
    [],
    {
      onEndSession: () => {
        sessionEnded = true;
      },
    },
  );

  assert.equal(nextError, null);
  assert.equal(res.statusCode, 409);
  assert.equal(res.responseBody.success, false);
  assert.equal(sessionEnded, true);
});

// 7. Unexpected User database error.
test("unexpected database errors are passed to next", async (t) => {
  const databaseError = new Error("Database unavailable");
  let sessionEnded = false;

  t.mock.method(User, "create", async () => {
    throw databaseError;
  });

  const { res, nextError } = await runController(
    createMockRequest(validCustomerData()),
    t,
    [],
    {
      onEndSession: () => {
        sessionEnded = true;
      },
    },
  );

  assert.equal(res.statusCode, null);
  assert.equal(nextError, databaseError);
  assert.equal(sessionEnded, true);
});

// 8. Firebase UID collision with an existing vendor.
test("Firebase UID belonging to vendor returns 403", async (t) => {
  const { res } = await runController(
    createMockRequest(validCustomerData()),
    t,
    [
      {
        firebaseUid: "verified-firebase-uid",
        phoneNumber: "+911111111111",
        role: "vendor",
      },
    ],
  );

  assert.equal(res.statusCode, 403);
});

// 9. Phone number collision with an existing vendor.
test("phone number belonging to vendor returns 403", async (t) => {
  const { res } = await runController(
    createMockRequest(validCustomerData()),
    t,
    [
      {
        firebaseUid: "another-firebase-uid",
        phoneNumber: "+919876543210",
        role: "vendor",
      },
    ],
  );

  assert.equal(res.statusCode, 403);
});

// 10. UID and phone belong to different accounts.
test("UID and phone belonging to different accounts returns 403", async (t) => {
  const { res } = await runController(
    createMockRequest(validCustomerData()),
    t,
    [
      {
        firebaseUid: "verified-firebase-uid",
        phoneNumber: "+911111111111",
        role: "customer",
      },
      {
        firebaseUid: "another-firebase-uid",
        phoneNumber: "+919876543210",
        role: "vendor",
      },
    ],
  );

  assert.equal(res.statusCode, 403);
});

// 11. Both identifiers belong to an existing customer.
test("both identifiers belonging to existing customer returns 409", async (t) => {
  const { res } = await runController(
    createMockRequest(validCustomerData()),
    t,
    [
      {
        firebaseUid: "verified-firebase-uid",
        phoneNumber: "+919876543210",
        role: "customer",
      },
    ],
  );

  assert.equal(res.statusCode, 409);
});

// 12. Customer creation failure after User creation.
test("Customer creation failure is passed to next and ends session", async (t) => {
  const databaseError = new Error("Customer creation failed");
  let userCreated = false;
  let sessionEnded = false;

  t.mock.method(User, "create", async (documents) => {
    userCreated = true;

    return [
      {
        ...documents[0],
        _id: new mongoose.Types.ObjectId(),
      },
    ];
  });

  t.mock.method(Customer, "create", async () => {
    throw databaseError;
  });

  const { res, nextError } = await runController(
    createMockRequest(validCustomerData()),
    t,
    [],
    {
      onEndSession: () => {
        sessionEnded = true;
      },
    },
  );

  assert.equal(userCreated, true);
  assert.equal(res.statusCode, null);
  assert.equal(nextError, databaseError);
  assert.equal(sessionEnded, true);
});

// 13. Duplicate key during Customer creation.
test("duplicate key from Customer creation returns 409", async (t) => {
  const duplicateError = Object.assign(new Error("Duplicate customer"), {
    code: 11000,
  });

  let sessionEnded = false;

  t.mock.method(User, "create", async (documents) => [
    {
      ...documents[0],
      _id: new mongoose.Types.ObjectId(),
    },
  ]);

  t.mock.method(Customer, "create", async () => {
    throw duplicateError;
  });

  const { res, nextError } = await runController(
    createMockRequest(validCustomerData()),
    t,
    [],
    {
      onEndSession: () => {
        sessionEnded = true;
      },
    },
  );

  assert.equal(nextError, null);
  assert.equal(res.statusCode, 409);
  assert.equal(sessionEnded, true);
});


 // 14. Transaction commit failure.
test("transaction commit failure is passed to next and ends session", async (t) => {
  const transactionError = new Error("Transaction commit failed");
  let sessionEnded = false;

  // Mock successful User creation inside the transaction.
  t.mock.method(User, "create", async (documents) => [
    {
      ...documents[0],
      _id: new mongoose.Types.ObjectId(),
    },
  ]);

  // Mock successful Customer creation inside the transaction.
  t.mock.method(Customer, "create", async (documents) => [
    {
      ...documents[0],
      _id: new mongoose.Types.ObjectId(),
    },
  ]);

  const { res, nextError } = await runController(
    createMockRequest(validCustomerData()),
    t,
    [],
    {
      transactionError,
      onEndSession: () => {
        sessionEnded = true;
      },
    },
  );

  assert.equal(res.statusCode, null);
  assert.equal(nextError, transactionError);
  assert.equal(sessionEnded, true);
});
