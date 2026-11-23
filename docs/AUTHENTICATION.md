# Authentication and Authorization

This document describes the authentication and authorization foundation implemented for the HarEvent backend.

It explains how Firebase identity is verified, how an existing application user is resolved from MongoDB, how authorization middleware is used, and which responsibilities belong to the Backend Foundation versus the later API Route Integration work.

## 1. Authentication Architecture

The backend uses Firebase Authentication as the identity-verification layer for the new authentication foundation.

After a Firebase ID token is verified, the backend can resolve the corresponding application user from MongoDB. Authentication and authorization are handled separately:

- **Firebase authentication** verifies the user's Firebase identity.
- **Application authentication** resolves the corresponding registered MongoDB user.
- **Role authorization** checks whether the application user has permission to access a route.
- **Vendor authorization** applies vendor-profile and vendor-approval requirements where needed.

The new Firebase middleware foundation is implemented and individually tested. However, existing business API routes have not yet been migrated from the legacy JWT authentication implementation.

## 2. Firebase Authentication — `verifyFirebaseToken`

The `verifyFirebaseToken` middleware verifies the Firebase ID token supplied with the request.

Its responsibilities are:

1. Read the Firebase ID token from the request's authorization credentials.
2. Verify the token using the Firebase Admin SDK.
3. Reject requests with missing or invalid authentication credentials.
4. Attach the verified Firebase identity to `req.firebaseUser`.
5. Pass control to the next middleware when verification succeeds.

### `req.firebaseUser`

After successful verification, downstream middleware and registration controllers can access the Firebase identity through `req.firebaseUser`.

The agreed identity contract includes:

- `firebaseUid` — the Firebase user's unique identifier.
- `phoneNumber` — the phone number obtained from the verified Firebase ID token.

Example:

```js
req.firebaseUser = {
  firebaseUid: "firebase-user-uid",
  phoneNumber: "+91XXXXXXXXXX",
};
```

**Important:** The Firebase identifier is accessed using `req.firebaseUser.firebaseUid`, not `req.firebaseUser.uid`.

`req.firebaseUser` represents the verified Firebase identity. It does not, by itself, establish that the user has a registered application account in MongoDB.

## 3. Application User Resolution — `requireAuth`

Firebase authentication and application-user authentication are separate responsibilities.

A user can have a valid Firebase identity without yet having a registered application-user record in MongoDB.

The `requireAuth` middleware handles this distinction.

Its responsibilities are:

1. Read the verified Firebase identity from `req.firebaseUser`.
2. Use `req.firebaseUser.firebaseUid` to look up the corresponding application user in MongoDB.
3. Reject the request if an existing application user cannot be resolved.
4. Attach the resolved application-user information to `req.user`.
5. Pass control to the next middleware when the application user is successfully resolved.

### `req.user` — Application Identity Contract

After successful application-user resolution, `req.user` represents the registered application user.

The agreed contract includes all of the following fields:

| Field           | Description                                                  |
| --------------- | ------------------------------------------------------------ |
| `userId`        | MongoDB application user's ID.                               |
| `firebaseUid`   | Firebase user's unique identifier.                           |
| `phoneNumber`   | Verified phone number associated with the Firebase identity. |
| `role`          | Application user's role.                                     |
| `adminType`     | Admin subtype; `null` when not applicable.                   |
| `vendorId`      | Associated vendor profile ID; `null` when not applicable.    |
| `vendorStatus`  | Vendor profile status; `null` when not applicable.           |
| `accountStatus` | Application account status.                                  |

Example:

```js
req.user = {
  userId: "mongodb-user-id",
  firebaseUid: "firebase-user-uid",
  phoneNumber: "+91XXXXXXXXXX",
  role: "vendor",
  adminType: null,
  vendorId: "mongodb-vendor-id",
  vendorStatus: "pending",
  accountStatus: "active",
};
```

Role-specific fields remain part of the `req.user` object. When a field does not apply to the user's role, its value is `null`, rather than the field being omitted.

**Important identity distinction:**

- `req.firebaseUser.firebaseUid` identifies the Firebase account.
- `req.user.userId` identifies the MongoDB application-user record.
- `req.user.vendorId` identifies the associated vendor profile when applicable.

Controllers and authorization middleware should use the appropriate identifier rather than treating these IDs as interchangeable.

## 4. Role-Based Authorization — `requireRole`

The `requireRole` middleware handles role-based access control.

It is intended to be used after Firebase authentication and application-user resolution, because authorization depends on the registered application user's information in `req.user`.

Its responsibilities are:

1. Read the authenticated application user's role from `req.user`.
2. Check whether the user's role is permitted for the requested route.
3. Reject requests that do not satisfy the route's role requirements.
4. Pass control to the next middleware when authorization succeeds.

Example usage:

```js
router.get(
  "/protected-resource",
  verifyFirebaseToken,
  requireAuth,
  requireRole("admin"),
  controller,
);
```

The example demonstrates the middleware's placement. The actual permitted roles must match the requirements of the route and the application's role definitions.

Role authorization must rely on server-resolved application-user information, not a role supplied by the client.

## 5. Vendor Profile Authorization — `requireVendorProfile`

The `requireVendorProfile` middleware handles vendor-profile requirements.

It requires the authenticated application user to have an existing, non-deleted vendor profile.

It does **not** require the vendor profile to be approved or active.

Use this middleware on routes where the existence of a vendor profile is sufficient, including routes that may be accessible to vendors whose profiles are pending approval or are not yet active.

A vendor profile existing does not automatically mean that the vendor is approved or active.

## 6. Vendor Approval Authorization — `requireApprovedVendor`

The `requireApprovedVendor` middleware handles vendor approval and access restrictions.

It requires the vendor to have a profile that is:

- Approved.
- Active.
- Not soft-deleted.

Use this middleware on routes where the vendor must be approved and active to perform the requested operation.

A vendor profile can exist while the vendor is still pending approval or inactive. Such a profile does not satisfy the requirements of this guard.

**Important:** `requireVendorProfile` and `requireApprovedVendor` are independent guards. They are not a mandatory consecutive middleware chain. Select the appropriate guard according to the requirements of each route. A route may require one or both, depending on its intended access rules.

## 7. Middleware Responsibilities and Usage

Each middleware has a distinct responsibility:

| Middleware              | Responsibility                                                                                     |
| ----------------------- | -------------------------------------------------------------------------------------------------- |
| `verifyFirebaseToken`   | Verifies the Firebase ID token and attaches the verified Firebase identity to `req.firebaseUser`.  |
| `requireAuth`           | Resolves an existing MongoDB application user and attaches the application identity to `req.user`. |
| `requireRole`           | Checks whether the authenticated application user has an allowed role.                             |
| `requireVendorProfile`  | Requires an existing, non-deleted vendor profile without requiring approval or active status.      |
| `requireApprovedVendor` | Requires an approved, active, non-deleted vendor profile.                                          |

### Recommended Usage Patterns

**Firebase-authenticated registration routes**

```js
router.post("/registration", verifyFirebaseToken, registrationController);
```

Registration requires a verified Firebase identity but must allow a user who does not yet have a MongoDB application-user record.

**Protected existing-user routes**

```js
router.get("/protected-resource", verifyFirebaseToken, requireAuth, controller);
```

These routes require both a verified Firebase identity and an existing application-user record.

**Role-restricted routes**

```js
router.get(
  "/admin-resource",
  verifyFirebaseToken,
  requireAuth,
  requireRole("admin"),
  controller,
);
```

These routes additionally require an authorized application-user role.

**Vendor-profile routes**

```js
router.get(
  "/vendor-resource",
  verifyFirebaseToken,
  requireAuth,
  requireVendorProfile,
  controller,
);
```

Use this pattern when a route requires an existing, non-deleted vendor profile but does not require vendor approval or active status.

**Approved-vendor routes**

```js
router.post(
  "/approved-vendor-resource",
  verifyFirebaseToken,
  requireAuth,
  requireApprovedVendor,
  controller,
);
```

Use this pattern when a route requires an approved, active, non-deleted vendor.

These examples illustrate recommended middleware composition. They are documentation examples, not claims that these business routes have already been implemented or migrated.

## 8. Registration Flow vs. Existing-User Authentication

Registration and protected existing-user access must be treated differently.

### New User Registration

A new user may have a valid Firebase account but no application-user record in MongoDB.

The intended flow is:

1. The user completes Firebase authentication.
2. The client sends the Firebase ID token with the registration request.
3. `verifyFirebaseToken` verifies the token.
4. The verified Firebase identity becomes available through `req.firebaseUser`.
5. The registration controller uses the verified Firebase identity to register the application user.
6. The application-user record and the relevant profile are created through the registration/business logic.

Flow:

```text
Firebase Authentication
        |
        v
    verifyFirebaseToken
        |
        v
  req.firebaseUser
        |
        v
Registration Controller
        |
        v
Create Application User
and Relevant Profile
```

**Why `requireAuth` is not used here:**

`requireAuth` expects an existing application-user record. Applying it before registration would prevent a genuinely new Firebase-authenticated user from reaching the registration controller.

### Existing Registered User

A registered user accessing a protected route follows a different flow:

1. The user authenticates through Firebase.
2. The client sends the Firebase ID token.
3. `verifyFirebaseToken` verifies the token.
4. `requireAuth` resolves the existing MongoDB application user.
5. `req.user` becomes available to downstream authorization middleware and controllers.
6. Any additional route-specific authorization checks are performed.

Flow:

```text
Firebase Authentication
        |
        v
    verifyFirebaseToken
        |
        v
    req.firebaseUser
        |
        v
    requireAuth
        |
        v
      req.user
        |
        v
Route-Specific Authorization
        |
        v
    Controller
```

Additional authorization middleware is selected according to the route's requirements.

## 9. Legacy JWT Authentication

The backend currently contains an existing email/password authentication implementation that uses JSON Web Tokens.

The legacy authentication implementation is separate from the new Firebase middleware foundation.

The existing business routes that still use legacy JWT authentication have not yet been migrated to the Firebase authentication flow.

Therefore:

- The presence of Firebase middleware does not mean every business route is already protected by it.
- Existing JWT authentication behavior remains separate until route integration is completed.
- The new identity contract must be applied consistently when business routes are migrated.
- Controllers and route middleware must be coordinated before changing existing authentication behavior.

Do not assume that `req.user` has the same structure in the legacy JWT flow and the new Firebase application-user flow. The legacy vendor controllers currently use their existing JWT identity structure, while the new Firebase middleware contract uses `req.user.userId`.

## 10. Current Limitations

The Backend Foundation establishes reusable authentication and authorization middleware, but it does not mean the complete business API migration is finished.

Current boundaries:

- Firebase token verification is implemented as middleware.
- Existing MongoDB application-user resolution is implemented in `requireAuth`.
- Role-based authorization is implemented in `requireRole`.
- Vendor profile and approved-vendor checks are implemented as separate middleware.
- The middleware has individual automated tests.
- Existing business routes still use the legacy JWT authentication implementation.
- Full Firebase middleware composition with the business API routes remains pending.
- Route-level integration tests for the migrated business APIs remain pending.

The middleware foundation should not be treated as proof that all existing endpoints already enforce the new authentication and authorization rules.

## 11. Deliverable A and Deliverable B

Backend development is divided into two separate deliverables.

### Deliverable A — Backend Foundation

This deliverable establishes the backend foundation.

Its scope includes:

- Project setup and configuration.
- Environment validation and secret handling.
- MongoDB connection setup.
- Firebase Admin SDK integration.
- Firebase ID token verification middleware.
- Application-user authentication middleware.
- Role-based authorization middleware.
- Vendor profile and approval authorization middleware.
- Security configuration and centralized error handling.
- Automated middleware and application tests.
- Backend documentation, including this authentication contract.

**Status:** Foundation implementation and individual middleware testing have been completed. Documentation is part of the final foundation review.

### Deliverable B — API Route Integration

This deliverable builds on the foundation after Deliverable A has been reviewed and merged.

Its scope includes:

- Integrating Firebase authentication middleware with the actual business API routes.
- Applying `requireAuth` to routes that require existing registered users.
- Applying role and vendor authorization guards according to each route's requirements.
- Coordinating registration-controller integration with the agreed identity contract.
- Migrating existing business routes away from legacy JWT authentication where agreed.
- Updating controllers to use the standardized Firebase application-user identity where required.
- Adding route-level integration tests for the actual middleware and business-route combinations.
- Coordinating integration with the API and model implementation work.

Deliverable B is separate from the Backend Foundation. Existing business routes should not be considered migrated until that integration work is completed and tested.

---

## 12. Key Identity and Authorization Rules

1. Use `req.firebaseUser.firebaseUid` for the Firebase user's unique identifier.
2. Use `req.user.userId` for the MongoDB application-user ID.
3. Use `req.user` only after successful application-user resolution through `requireAuth`.
4. Registration routes should use Firebase authentication without requiring an existing application-user record.
5. Protected existing-user routes should resolve the application user before applying role or other application-level authorization.
6. Never trust client-provided roles, account status, or vendor approval status.
7. Keep vendor profile existence and vendor approval as separate authorization checks.
8. `requireVendorProfile` requires an existing, non-deleted vendor profile but does not require approval or active status.
9. `requireApprovedVendor` requires an approved, active, non-deleted vendor profile.
10. Apply the vendor guards according to individual route requirements; neither is automatically required on every vendor route.
11. Do not assume existing legacy JWT routes already use the new Firebase identity contract.
12. Complete and test business-route integration as part of Deliverable B.

This document defines the intended identity and authorization contract for the HarEvent backend and provides a shared reference for backend foundation and API integration work.
