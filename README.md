# HarEvent Backend API

Backend API for the HarEvent vendor marketplace, built with Node.js, Express, and MongoDB.

## Tech Stack

- Node.js
- Express 5
- MongoDB Atlas and Mongoose
- dotenv for environment configuration
- bcryptjs and JSON Web Tokens (existing authentication)
- Postman for API testing

## Current Features

- User signup and login using email and password
- Password hashing through the User model
- JWT-protected API routes
- Vendor create, read, update, and delete endpoints
- Vendor filtering by category and location
- Event category management endpoints
- Basic health endpoint at `GET /health`

> Note: Firebase phone OTP authentication, vendor approval workflows, role-based authorization, and unique public vendor IDs are planned work and are not yet implemented.

## Requirements

- Node.js and npm
- A MongoDB connection string

## Local Setup

1. Clone the repository and open its directory.
2. Install dependencies:

   ```bash
   npm install
   ```

3. Copy `.env.example` to `.env`.
4. Set `MONGODB_URI` in `.env` to your MongoDB connection string.
5. Set `PORT` if needed; the default is `5000`.
6. Start the development server:

   ```bash
   npm run dev
   ```

For a production-style start, use:

```bash
npm start
```

Do not commit `.env` or any real credentials.

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

Run the configured test command:

```bash
npm test
```

The current test suite contains six automated tests covering the health endpoint, root route, JSON 404 responses, CORS behavior, and oversized JSON request bodies.

Use the included Postman collection for manual testing of the existing endpoints.

## Security Notes

- Keep local credentials in `.env`.
- Never commit service-account keys, real user data, or production credentials.
- Review authorization and validation before exposing endpoints publicly.
