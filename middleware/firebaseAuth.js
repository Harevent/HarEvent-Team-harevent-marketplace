
const { firebaseAuth } = require("../config/firebase");

const AUTHENTICATION_ERROR_CODES = new Set([
  "auth/argument-error",
  "auth/invalid-id-token",
  "auth/id-token-expired",
  "auth/id-token-revoked",
  "auth/user-disabled",
]);

async function verifyFirebaseToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    // Check whether the Authorization header exists.
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Access denied. Please provide a Firebase ID token.",
      });
    }

    // Extract the Firebase ID token.
    const token = authHeader.slice(7).trim();

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Firebase ID token is missing.",
      });
    }

    // Verify token and check whether it has been revoked.
    const decodedToken = await firebaseAuth.verifyIdToken(token, true);

    // Ensure the token contains a verified phone identity.
    if (!decodedToken.uid || !decodedToken.phone_number) {
      return res.status(401).json({
        success: false,
        message: "Firebase token does not contain a verified phone identity.",
      });
    }

    // Make verified Firebase details available to the next handler.
    req.firebaseUser = {
      firebaseUid: decodedToken.uid,
      phoneNumber: decodedToken.phone_number,
    };

    return next();
  } catch (error) {
    // Invalid, expired, revoked, or malformed tokens return 401.
    if (AUTHENTICATION_ERROR_CODES.has(error?.code)) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired Firebase ID token.",
      });
    }

    // Forward unexpected errors to the centralized error handler.
    return next(error);
  }
}

module.exports = { verifyFirebaseToken };
