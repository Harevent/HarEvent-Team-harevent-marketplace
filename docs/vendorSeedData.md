# Vendor Test Data Seed

The vendor seed generates 10 synthetic vendors and 10 linked Users by default. No input spreadsheet or JSON file is required. Each new vendor uses the current Vendor schema with `approvalStatus: "approved"`, `isActive: true`, and `deletedAt: null`; its User has `role: "vendor"` and `accountStatus: "active"`.

The first record is an event-management test business named `Test Events (Seed 42-001)`, priced from INR 5,000, with Event Planners / Wedding Planners and the Wedding event type. Other records vary their category, services, active mapped events, city, service areas, business name, and price. The first 19 records cover all 19 main categories. Contacts use generated E.164 phone numbers and example.com emails; images start empty.

The pending/inactive example vendor `6afd80818bfcaf9d73fe8621`, its User `6afd80818bfcaf9d73fe8620`, and public ID `df7255f1-8139-4940-b9cd-28ee4036c37a` are not reused. The seed inserts separate records and preserves all existing documents.

## Implementation

- [seedVendorData.js](../scripts/seedVendorData.js) generates repeatable random fixtures, builds the offline preview, and exposes the CLI.
- [vendorDataSeed.js](../scripts/vendorDataSeed.js) resolves database references, validates the plan, compares existing records, and applies inserts.
- [referenceDataSeed.js](../scripts/referenceDataSeed.js) supplies the shared development-target checks, transaction check, and durable verified backup/journal writer. Its reference-data behavior stays the same.
- [vendorDataSeed.test.js](../test/vendorDataSeed.test.js) exercises the actual models, reference planner, active approval defaults, CLI, and transaction/recovery orchestration with a driver double.

## Commands

Run the following from the project root, using the same count and seed in each step:

```bash
npm run seed:vendors -- --dry-run --count 10 --seed 42
npm run seed:vendors -- --compare --count 10 --seed 42
npm run seed:vendors -- --apply --confirm-dev --count 10 --seed 42
```

Use `--count 1` in all three commands to create one separate Test Events record. The direct equivalents use `node scripts/seedVendorData.js` followed by the same flags. On Windows PowerShell, use `npm.cmd` if execution policy blocks `npm.ps1`.

| Flag | Meaning |
| --- | --- |
| `--dry-run` | Generate and validate complete User/Vendor documents locally, then print a JSON preview. No .env loading or database connection. |
| `--compare` | Read the database and print insert counts, resolved references, existing seed differences, and apply prerequisites. No database or recovery-file writes. |
| `--apply --confirm-dev` | Insert missing test Users and Vendors in one verified development-only transaction. Both flags are required. |
| `--count <number>` | Number of vendor/User pairs, from 1 to 1000; default 10. |
| `--seed <number>` | Repeatable random seed, from 0 to 4294967295; default 42. |

Exactly one mode is required. Unknown, repeated, conflicting, unconfirmed, or malformed arguments fail before connecting.

Dry-run reference ObjectIds are explicitly marked as placeholders. Compare/apply resolve category and event slugs to their existing database IDs. User IDs, vendor IDs, public UUIDs, contacts, and random details are stable for the same seed/index. Increasing count adds more records without changing the earlier ones; changing seed creates a separate batch.

## Reference Data and Development Setup

Apply the reference data first using its documented review and confirmation process:

```bash
npm run seed:reference -- --dry-run
npm run seed:reference -- --compare
npm run seed:reference -- --apply --confirm-dev
```

Configure the intended development database in .env:

```dotenv
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/harevent_dev?replicaSet=rs0
SEED_DEV_DATABASE=harevent_dev
```

Apply checks the exact URI and connected database names. The name must contain a dev/development segment; names containing prod and other environments are blocked, as in the reference seed. A replica set or sharded deployment supporting transactions is required.

The following ready, full, non-sparse unique indexes must already exist:

| Collection | Required unique indexes |
| --- | --- |
| categories | `{ parentId: 1, slug: 1 }` |
| eventtypes | `{ slug: 1 }` |
| users | `{ firebaseUid: 1 }`, `{ phoneNumber: 1 }` |
| vendors | `{ userId: 1 }`, `{ publicVendorId: 1 }` |

Compare reports unmet requirements in `indexProblems` and `prerequisiteProblems`, with `readyToApply: false`. Provision collections/indexes separately after resolving duplicates. The seed disables automatic collection/index creation. Missing or inactive selected references, services under the wrong parent, and events without a matching category mapping stop the proposal.

## Existing Records and Recovery

The process is insert-only. Matching existing seed records retain saved names, prices, references, approval/activity status, deletion state, timestamps, and historical fields. Compare lists differences from the generated defaults under `existing[].differences`; it does not apply those differences. `activeVendorCount` reflects the actual saved state. A rerun with all requested records present performs no inserts and creates no backup. Reducing count retains earlier records outside the requested count.

An occupied ID, Firebase UID, phone number, public vendor ID, or User-to-Vendor link belonging to a different identity stops the plan. The seed never adopts an existing account to work around a collision.

Before the first insert, apply saves and reads back a SHA-256-verified backup of complete pre-change User and Vendor collections under the ignored `.seed-recovery/vendors/<run>/` directory. It also saves `plan.ejson` and a durable `journal.jsonl`. Both collections are inserted in one snapshot transaction, with majority write concern, then checked before and after commit. Inserts receive current creation/update timestamps and `__v: 0`.

A successful run saves `report.json`; a failure after backup preparation saves `failure.json` when possible. Inspect the journal status before recovery: `aborted` confirms rollback, `abort-unconfirmed` needs inspection, `commit-outcome-unknown` means the commit result is uncertain, and `committed-followup-failed` means commit succeeded but a later check/report failed. Transactions are not automatically retried or restored. Parse backups as canonical Extended JSON and reconcile only the listed insert IDs with current records and references before any removal.

## Test and API Scope

```bash
npm test
node --test test/vendorDataSeed.test.js
```

Automated tests cover reproducible data, separate identities, real model validation, actual reference-seed relationships, active approval defaults, read-only comparison, repeat runs, environment/index guards, complete backups, rollback, uncertain commit outcomes, and error diagnostics that keep credentials private. Tests use a driver double; server transaction and index behavior still requires an isolated development MongoDB deployment.

## Troubleshooting

If apply reports a missing seed helper, keep the reference and vendor seed scripts in sync. The vendor runner requires `equivalent`, `durableWrite`, and the collection-aware `createRecovery` from `referenceDataSeed.js`. It checks missing helper exports before connecting.

Failures report the operation that failed and a safe diagnosis for DNS, connectivity, authentication, permissions, duplicate keys, and local file errors. Raw MongoDB messages and connection strings are not printed. Run `--compare` with the same count/seed to check the current database state before retrying an apply; an earlier run may already have committed the requested records.

Users are MongoDB test fixtures. Synthetic Firebase UIDs do not create Firebase Authentication accounts; authenticated API testing needs a matching test Firebase identity.

The existing vendor routes still use legacy fields such as `category`, string `location`, `price`, and `createdBy`. This seeder follows `Vendor.js` (`categoryIds`, structured `location`, `startingPrice`, and `userId`). Aligning those route handlers with the current model is a separate API change.
