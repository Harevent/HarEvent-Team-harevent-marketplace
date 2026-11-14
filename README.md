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

### MongoDB SRV DNS errors

`querySrv ECONNREFUSED _mongodb._tcp.<cluster>.mongodb.net` means Node's DNS resolver could not look up the Atlas hosts. The connection has not reached MongoDB authentication yet.

If the cluster hostname is correct and your network allows public DNS, add this to `.env`:

```dotenv
MONGODB_DNS_SERVERS=1.1.1.1,8.8.8.8
```

Restart `npm run dev` after changing `.env`. The server and reference-data seed script use these DNS servers for Node's DNS queries; Windows network settings are unchanged. Leave the setting unset to use the default resolver. For a private Atlas endpoint, use DNS servers that can resolve your private hosts.

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

The Category model stores main vendor categories (`parentId: null`) and child services/subcategories (`parentId` references a main category). EventTypes are separate records with `vendorCategoryIds` referencing main categories. See [Reference Data Mappings](docs/referenceDataMappings.md) for the full taxonomy.

## Testing

Run the configured test command:

```bash
npm test
```

Tests cover process health and request handling, taxonomy and event mappings, parent/service relationships, ID-preserving renames, non-destructive seeding, and transaction/backup failure paths. Seed database tests use an in-memory driver double; real MongoDB transaction and index behavior requires an isolated development deployment.

Use the included Postman collection for manual testing of the existing endpoints.

## Security Notes

- Keep local credentials in `.env`.
- Never commit service-account keys, real user data, or production credentials.
- Review authorization and validation before exposing endpoints publicly.

## Reference Data Seed

The reference-data seed script prepares 19 main categories, 288 services/subcategories, and all 29 EventTypes. Every event has explicit category mappings. Ten event types default to active; the 19 pending event types have proposed mappings and default to inactive until their mappings are completed and verified.

The taxonomy includes separate Rangoli Artists and Event Planners main categories. Corporate Event Planners and Conference Event Planners are services under Event Planners. Photography & Videography contains separate Photographers and Videographers subcategories alongside the existing specialty services. Stage Setup, Sound & Lighting, and LED Wall & Screen Rentals belong to Production & Technical Setup. The generic Corporate Event Vendors label has no default category: vendors must be classified by their actual services.

Review the complete taxonomy, all event mappings, and the implementation behavior in [Reference Data Mappings](docs/referenceDataMappings.md).

Normal re-seeding preserves stored IDs, vendor references, descriptions, historical fields, mapping entries, and existing category/service/event activation settings. Seed activation defaults apply to new records. After a pending event is reviewed, update its seed default and make an explicit reviewed activation change to the existing EventType; changing a seed default alone does not activate an existing record. The seed does not write vendor documents or move services between parents.

An explicit mode is required. Missing, unknown, repeated or conflicting flags fail before connecting to MongoDB. Apply requires both `--apply` and `--confirm-dev`.

### 1. Dry Run

Run the static validation without connecting to MongoDB:

```bash
node scripts/seedReferenceData.js --dry-run
```

This checks names, duplicate identities, legacy rename aliases, service lists, mappings for every EventType (including inactive ones), and prepared counts. Service slugs are unique within a parent category, matching the `{ parentId: 1, slug: 1 }` unique index; the same service slug is allowed under different parents.

No database connection or writes are performed.

### 2. Compare Existing Database Data

Use comparison mode to inspect existing categories, services and EventType mappings:

```bash
node scripts/seedReferenceData.js --compare
```

Comparison reads Category, EventType and vendor references and prints a JSON report with field changes, mapping additions, preserved mapping IDs, stale-record decisions and unmet environment, transaction or index requirements. IDs shown for proposed inserts are provisional; apply generates its own plan from the current database. It does not create collections, build indexes or write database records. Proposed documents undergo explicit Mongoose validation, and all category parents, EventType mappings and current vendor references are checked. Invalid references or duplicates fail comparison and apply.

Before apply, both collections must already exist with ready, full unique indexes on `categories: { parentId: 1, slug: 1 }` and `eventtypes: { slug: 1 }`. Missing indexes are reported by comparison and block apply. Provision them separately after resolving existing duplicates; the seed never builds them automatically.

### 3. Apply to Development

Review the comparison report first. Configure these values in `.env` using the actual development database name:

```dotenv
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/harevent_test?replicaSet=rs0
SEED_DEV_DATABASE=harevent_dev
```

`SEED_DEV_DATABASE` must match both the URI database and the database resolved after connecting. The database name must contain a `dev` or `development` segment separated by `_` or `-` (or be exactly `dev`/`development`). Any name containing `prod` is blocked. Staging and production environments cannot apply. Comparison remains available as a read-only operation.

```bash
node scripts/seedReferenceData.js --apply --confirm-dev
```

Apply takes a snapshot transaction, loads existing records, prepares and validates the complete proposal, saves and verifies a local backup, then writes and verifies the database state before committing with majority write concern. It verifies again after commit and saves an execution report. Existing mapping arrays are extended with approved IDs, preserving all existing entries. Existing IDs, descriptions and historical fields are retained.

The declared `photographers` legacy main-category slug is renamed to `photography-and-videography` when the canonical category is absent. The existing main ID is reused, so its services and vendor/event references keep their IDs. If both main categories already exist, the legacy record is reported for explicit reconciliation; the seed does not merge them automatically. Existing inactive records remain inactive, and an active event mapped to an inactive main category fails validation instead of silently reactivating that category.

### 4. Stale Records and Renames

Active records outside the seed block apply until an explicit decision is provided. Inactive stale records are retained. The script never deletes records or removes event mappings. Use a reconciliation JSON file to rename an existing record while keeping its ID, retain a manual record, or deactivate an unreferenced stale record:

```json
{
  "categoryRenames": [
    { "id": "0123456789abcdef01234567", "slug": "venues", "parentSlug": null },
    { "id": "0123456789abcdef01234568", "slug": "wedding-hall", "parentSlug": "venues" }
  ],
  "eventTypeRenames": [
    { "id": "0123456789abcdef01234569", "slug": "wedding" }
  ],
  "retainCategoryIds": [],
  "retainEventTypeIds": [],
  "deactivateCategoryIds": [],
  "deactivateEventTypeIds": []
}
```

Replace the example IDs with IDs from comparison. Rename targets must exist in the seed; a service cannot move to another parent. Retain/deactivate decisions must identify existing records outside the seed. Conflicting decisions or occupied rename targets fail safely. Deactivation is blocked by vendor references (including inactive/deleted vendors), all EventType mappings and active child categories.

```bash
node scripts/seedReferenceData.js --compare --reconcile reconciliation.json
node scripts/seedReferenceData.js --apply --confirm-dev --reconcile reconciliation.json
```

### 5. Transactions and Recovery

Apply requires a transaction-capable replica set or sharded MongoDB deployment. Standalone MongoDB is refused; there is no non-transactional fallback or bypass flag. Connection resources are closed even when setup fails.

Pause application writes to categories, services, events and vendor selections during apply. Snapshot transactions do not prevent another writer from adding a new reference to a record being deactivated. Keep writes paused through final verification. Reference checks cover the current Vendor schema; any additional historical collections should be reviewed before approving deactivation. No reference IDs or historical documents are deleted.

Each apply creates an ignored `.seed-recovery/<run>/` directory containing:

- `backup.ejson`: complete pre-change Category/EventType documents with BSON types preserved, written durably and verified by read-back and SHA-256 before database writes.
- `plan.ejson`: proposed changes and their before/after documents.
- `journal.jsonl`: durable execution phases, backup checksum and inserted/updated IDs.
- `report.json`: successful comparison and verification results, or `failure.json` when an execution fails after recovery files are created.

If execution fails, inspect the printed status and journal. `aborted` means the server acknowledged transaction abort; `commit-outcome-unknown` means commit was attempted but its result could not be confirmed. `committed-followup-failed` means commit succeeded but later verification or file reporting failed. Do not automatically retry or restore based on an error alone.

For recovery, keep application writes paused and compare the live records with `plan.ejson`. Verify `backup.ejson` against the checksum in the journal, and parse it as canonical Extended JSON (for example, MongoDB driver's `BSON.EJSON.parse(text, { relaxed: false })`). If restoration is needed, have an operator restore only the affected before-images and remove only confirmed inserts listed in the plan inside a new transaction, after checking for subsequent references or edits. Preserve IDs and unrelated records. Re-run comparison and validation before another apply. The script does not automatically restore a potentially committed transaction.

Run the safety and failure-path tests with `npm test`. These use an in-memory driver double; real replica-set transaction behavior still needs verification against an isolated development MongoDB deployment.
