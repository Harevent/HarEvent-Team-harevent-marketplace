const { firebaseAuth } = require("../config/firebase");
const AUTHENTICATION_ERROR_CODES = new Set([
  "auth/invalid-id-token",
  "auth/id-token-expired",
  "auth/id-token-revoked",
  "auth/user-disabled",
]);

async function verifyFirebaseToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Access denied. Please provide a Firebase ID token.",
      });
    }

    const token = authHeader.slice(7).trim();

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Firebase ID token is missing.",
      });
    }

    const decodedToken = await firebaseAuth.verifyIdToken(token, true);

    if (!decodedToken.uid || !decodedToken.phone_number) {
      return res.status(401).json({
        success: false,
        message: "Firebase token does not contain a verified phone identity.",
      });
    }

    req.firebaseUser = {
      firebaseUid: decodedToken.uid,
      phoneNumber: decodedToken.phone_number,
    };

    return next();
  } catch (error) {
    if (AUTHENTICATION_ERROR_CODES.has(error?.code)) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired Firebase ID token.",
      });
    }

    return next(error);
  }
}

module.exports = { verifyFirebaseToken };
