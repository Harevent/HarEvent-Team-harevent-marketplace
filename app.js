const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const env = require("./config/env");

const authRoutes = require("./routes/auth");
const vendorRoutes = require("./routes/vendors");
const categoryRoutes = require("./routes/categories");

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

app.use("/api/auth", authRoutes);
app.use("/api/vendors", vendorRoutes);
app.use("/api/categories", categoryRoutes);

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

  // Preserve Express behavior if response headers were already sent.
  if (res.headersSent) {
    return next(err);
  }

  let status = 500;
  let message = "Internal server error";

  // Malformed JSON request body.
  if (err.type === "entity.parse.failed") {
    status = 400;
    message = "Invalid JSON request body.";
  }

  // JSON request body exceeds the configured size limit.
  else if (err.type === "entity.too.large") {
    status = 413;
    message = "Request body too large.";
  }

  // Mongoose document validation failure.
  else if (err.name === "ValidationError") {
    status = 400;
    message = "Validation failed.";
  }

  // MongoDB duplicate-key error.
  else if (err.code === 11000) {
    status = 409;
    message = "Resource already exists.";
  }

  // Other errors with valid HTTP error statuses.
  else {
    const errorStatus = err.status ?? err.statusCode;

    if (
      Number.isInteger(errorStatus) &&
      errorStatus >= 400 &&
      errorStatus <= 599
    ) {
      status = errorStatus;

      // Never expose internal messages for server errors.
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

// Register the centralized error handler.
app.use(errorHandler);

// Export the Express app and the same handler for testing.
module.exports = app;
module.exports.errorHandler = errorHandler;
