function requireRole(...allowedRoles) {
  // Validate middleware configuration.
  if (
    allowedRoles.length === 0 ||
    allowedRoles.some((role) => typeof role !== "string" || !role.trim())
  ) {
    throw new TypeError("requireRole requires one or more valid role names.");
  }

  // Trim configured roles and remove duplicates.
  const roles = new Set(allowedRoles.map((role) => role.trim()));

  return function roleAuthorization(req, res, next) {
    // Authentication must run before role authorization.
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    // Read the role exclusively from the authenticated user.
    const userRole = req.user.role;

    if (!roles.has(userRole)) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to access this resource.",
      });
    }

    return next();
  };
}

module.exports = { requireRole };
