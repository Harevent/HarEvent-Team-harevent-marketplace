
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const env = require("./config/env");

const authRoutes = require("./routes/auth");
const vendorRoutes = require("./routes/vendors");
const categoryRoutes = require("./routes/categories");
const customerRoutes = require("./routes/customers");
const eventTypeRoutes = require("./routes/eventTypes");
const serviceRoutes = require("./routes/serviceRoutes");
const enquiryRoutes = require("./routes/enquiries");
const vendorEnquiryRoutes = require("./routes/vendorEnquiries");
const vendorDashboardRoutes = require("./routes/vendorDashboard");
const adminVendorRoutes = require("./routes/adminVendors");

const app = express();

app.use(helmet());

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        return callback(null, true);
      }

      const allowedOrigins = [];

      if (env.NODE_ENV === "development") {
        allowedOrigins.push("http://localhost:5173");

        if (env.CLIENT_URL) {
          allowedOrigins.push(env.CLIENT_URL);
        }
      } else if (env.CLIENT_URL) {
        allowedOrigins.push(env.CLIENT_URL);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(null, false);
    },
  }),
);

app.use(express.json({ limit: "1mb" }));

app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    status: "healthy",
  });
});

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Welcome to Harevent Backend API!",
  });
});

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/vendors", vendorRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/event-types", eventTypeRoutes);
app.use("/api/services", serviceRoutes);
app.use("/api/vendor-categories", categoryRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/enquiries", enquiryRoutes);
app.use("/api/vendor/enquiries", vendorEnquiryRoutes);
app.use("/api/vendor/dashboard", vendorDashboardRoutes);
app.use("/api/admin/vendors", adminVendorRoutes);
// Handle unknown routes.
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

// Centralized error handler.
function errorHandler(err, req, res, next) {
  console.error("Unhandled error:", err.message);

  if (res.headersSent) {
    return next(err);
  }

  let status = 500;
  let message = "Internal server error";

  if (err.type === "entity.parse.failed") {
    status = 400;
    message = "Invalid JSON request body.";
  } else if (err.type === "entity.too.large") {
    status = 413;
    message = "Request body too large.";
  } else if (err.name === "ValidationError") {
    status = 400;
    message = "Validation failed.";
  } else if (err.code === 11000) {
    status = 409;
    message = "Resource already exists.";
  } else {
    const errorStatus = err.status ?? err.statusCode;

    if (
      Number.isInteger(errorStatus) &&
      errorStatus >= 400 &&
      errorStatus <= 599
    ) {
      status = errorStatus;

      if (status < 500) {
        message = err.message || "Request failed.";
      }
    }
  }

  return res.status(status).json({
    success: false,
    message,
  });
}

app.use(errorHandler);

module.exports = app;
module.exports.errorHandler = errorHandler;
