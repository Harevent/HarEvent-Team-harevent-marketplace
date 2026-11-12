# HarEvent Backend API

Backend API for the HarEvent vendor marketplace, built with Node.js, Express, and MongoDB.

## Tech Stack

- Node.js
- Express 5
- MongoDB Atlas and Mongoose
- Firebase Admin SDK for Firebase ID token verification
- dotenv and Zod for environment configuration and validation
- bcryptjs and JSON Web Tokens (legacy authentication implementation)
- Postman for API testing

## Current Features

### Backend Foundation

- Centralized environment configuration and validation using Zod.
- MongoDB connection setup using Mongoose.
- Firebase Admin SDK integration for Firebase ID token verification.
- Authentication middleware for resolving Firebase identities and existing application users.
- Role-based authorization middleware.
- Separate vendor profile and vendor approval access middleware.
- Centralized Express error handling and security configuration.
- Health-check endpoint at `GET /health`.

### Existing API Implementation

- User signup and login using the existing email/password authentication.
- Password hashing through the User model.
- Legacy JWT-protected vendor API routes.
- Vendor create, read, update, and delete endpoints.
- Vendor filtering by category and location.
- Event category management endpoints.

> Note: The Firebase authentication and authorization middleware foundation is implemented and individually tested. Existing business API routes still use the legacy JWT authentication implementation. Migrating those routes to the new Firebase authentication flow, integrating the middleware with business controllers, and adding route-level integration tests are part of Deliverable B.

## Requirements

- Node.js and npm
- A MongoDB connection string
- Firebase Admin SDK configuration
- Frontend application URL for `CLIENT_URL`

## Local Setup

1. Clone the repository and open its directory.
2. Install dependencies:

   ```bash
   npm install
   ```

3. Copy `.env.example` to `.env`.
4. Configure the required environment variables in `.env`, including your MongoDB connection details and Firebase configuration.
5. Set `CLIENT_URL` to the frontend application's URL.
6. Set `PORT` if needed; the default is `5000`.
7. Start the development server:

   ```bash
   npm run dev
   ```

For a production-style start, use:

```bash
npm start
```

Environment variables are validated centrally during application startup. Production configuration also requires `CLIENT_URL`.

Refer to `.env.example` for the supported environment variable names and example values.

Do not commit `.env`, service-account credentials, or any real secrets.

## API Endpoints

### Health

- `GET /health` - basic process health response
- `GET /` - API welcome message

### Authentication (existing implementation)

- `POST /api/auth/signup`
- `POST /api/auth/login`

### Vendors

- `POST /api/vendors`
- `GET /api/vendors`
- `GET /api/vendors/:id`
- `PUT /api/vendors/:id`
- `DELETE /api/vendors/:id`

The current vendor routes require JWT authentication. Listing filters include `category` and `location`.

### Event Categories

- `POST /api/categories`
- `GET /api/categories`
- `GET /api/categories/:id`
- `PUT /api/categories/:id`
- `DELETE /api/categories/:id`

The existing category model supports Weddings, Birthdays, Corporate Events, and Parties.

## Testing

Run the automated test suite:

```bash
npm test
```

The test suite covers the backend foundation, including:

- Express application behavior and health endpoints.
- CORS handling and request parsing.
- Centralized error handling.
- Environment configuration and validation.
- Firebase authentication middleware.
- Application user authentication and profile resolution.
- Role-based authorization.
- Vendor profile access.
- Vendor approval and access restrictions.

Middleware tests use mocked dependencies where appropriate, allowing authentication and authorization behavior to be tested independently.

The Firebase middleware and existing authorization guards have individual automated tests. Full middleware-chain testing and integration with business API routes are planned for Deliverable B.

Use the included Postman collection for manual testing of the existing API endpoints.

## Security Notes

- Keep local credentials and environment-specific configuration in `.env`.
- Never commit service-account keys, real user data, or production credentials.
- Firebase ID tokens are verified using the Firebase Admin SDK.
- Application user identity and authorization details are resolved using server-side database records.
- Never trust client-provided roles, vendor approval status, or account permissions.
- Vendor profile existence and vendor approval are separate authorization checks. Use the appropriate middleware according to each route's requirements.
- Existing business API routes still use legacy JWT authentication until their migration is completed in Deliverable B.
- Review authentication, authorization, and request validation before exposing endpoints publicly.

For the authentication identity contract and middleware responsibilities, see [Authentication and Authorization](docs/AUTHENTICATION.md).

## Development Scope

The backend work is organized into two deliverables:

- **Deliverable A — Backend Foundation:** Project configuration, environment validation, MongoDB connection, Firebase authentication foundation, authorization middleware, security, error handling, automated tests, and documentation.
- **Deliverable B — API Route Integration:** Integration of the new authentication and authorization middleware with business API routes, registration/controller coordination, and route-level integration testing.

Deliverable A establishes the foundation. Deliverable B builds on that foundation after it has been reviewed and merged.
