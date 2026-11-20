const { createHash } = require("node:crypto");
const mongoose = require("mongoose");
const User = require("../models/User");
const Vendor = require("../models/Vendor");
const {
  CATEGORY_DATA,
  EVENT_TYPE_DATA,
  slugify,
  validateReferenceData,
} = require("./seedReferenceData");
const {
  DEFAULT_COUNT,
  DEFAULT_SEED,
  parseArguments,
  formatSeedError,
  buildPlan,
  runSeed,
} = require("./vendorDataSeed");

const NAMESPACE = "harevent-test-vendors-v1";
const LOCATIONS = [
  { city: "Mumbai", state: "Maharashtra", nearby: "Navi Mumbai" },
  { city: "Pune", state: "Maharashtra", nearby: "Pimpri-Chinchwad" },
  { city: "Bengaluru", state: "Karnataka", nearby: "Mysuru" },
  { city: "Hyderabad", state: "Telangana", nearby: "Secunderabad" },
  { city: "Chennai", state: "Tamil Nadu", nearby: "Tambaram" },
  { city: "Jaipur", state: "Rajasthan", nearby: "Ajmer" },
  { city: "Ahmedabad", state: "Gujarat", nearby: "Gandhinagar" },
  { city: "Kolkata", state: "West Bengal", nearby: "Howrah" },
  { city: "New Delhi", state: "Delhi", nearby: "Noida" },
  { city: "Lucknow", state: "Uttar Pradesh", nearby: "Kanpur" },
];
const BUSINESS_NAMES = [
  "Saffron",
  "Lotus",
  "Marigold",
  "Celebration",
  "Amber",
  "Royal",
  "Harmony",
  "Orchid",
  "Silver",
  "Sunrise",
  "Jasmine",
  "Festive",
];
const FIRST_NAMES = ["Aarav", "Ananya", "Kabir", "Isha", "Rohan", "Meera"];
const LAST_NAMES = ["Sharma", "Patel", "Rao", "Singh", "Das", "Joshi"];

function hash(value) {
  return createHash("sha256")
    .update(NAMESPACE + "/" + value)
    .digest("hex");
}

function objectId(value) {
  return new mongoose.Types.ObjectId(hash(value).slice(0, 24));
}

function publicId(value) {
  const bytes = Buffer.from(hash(value).slice(0, 32), "hex");
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-");
}

// Per-record randomness keeps earlier records stable when --count increases.
function randomFor(value) {
  let state = parseInt(hash(value).slice(0, 8), 16);
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let result = Math.imul(state ^ (state >>> 15), 1 | state);
    result ^= result + Math.imul(result ^ (result >>> 7), 61 | result);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled(values, random) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

function generateVendorData({
  count = DEFAULT_COUNT,
  seed = DEFAULT_SEED,
} = {}) {
  if (
    !Number.isInteger(count) ||
    count < 1 ||
    count > 1000 ||
    !Number.isInteger(seed) ||
    seed < 0 ||
    seed > 4294967295
  ) {
    const error = new Error(
      "Vendor seed requires count 1-1000 and seed 0-4294967295.",
    );
    error.seedMessage = error.message;
    throw error;
  }
  const planner = CATEGORY_DATA.find(
    (category) => category.name === "Event Planners",
  );
  const categories = [
    planner,
    ...shuffled(
      CATEGORY_DATA.filter((category) => category !== planner),
      randomFor("categories/" + seed),
    ),
  ];
  const phones = new Set();
  return Array.from({ length: count }, (_, index) => {
    const number = String(index + 1).padStart(3, "0");
    const key = "harevent-test-vendor-" + seed + "-" + number;
    const random = randomFor(key);
    const pick = (values) => values[Math.floor(random() * values.length)];
    const category = categories[index % categories.length];
    const services =
      index === 0
        ? ["Wedding Planners"]
        : shuffled(category.services, random).slice(
            0,
            1 + Math.floor(random() * 2),
          );
    const eligibleEvents = EVENT_TYPE_DATA.filter(
      (event) => event.isActive && event.categoryNames.includes(category.name),
    );
    const events =
      index === 0
        ? ["Wedding"]
        : shuffled(eligibleEvents, random)
            .slice(0, 1 + Math.floor(random() * 2))
            .map((event) => event.name);
    const location = pick(LOCATIONS);
    let phoneNumber;
    let attempt = 0;
    do {
      const digits =
        parseInt(hash("phone/" + key + "/" + attempt).slice(0, 8), 16) %
        1000000000;
      phoneNumber = "+919" + String(digits).padStart(9, "0");
      attempt += 1;
    } while (phones.has(phoneNumber));
    phones.add(phoneNumber);
    const userId = objectId("user/" + key);
    const email = key + "@example.com";
    return {
      key,
      user: {
        _id: userId,
        firebaseUid: key,
        phoneNumber,
        fullName: "Test " + pick(FIRST_NAMES) + " " + pick(LAST_NAMES),
        email,
        role: "vendor",
        accountStatus: "active",
        lastLoginAt: null,
        __v: 0,
      },
      vendor: {
        _id: objectId("vendor/" + key),
        userId,
        publicVendorId: publicId("public/" + key),
        businessName:
          index === 0
            ? "Test Events (Seed " + seed + "-" + number + ")"
            : "Test " +
              pick(BUSINESS_NAMES) +
              " " +
              category.name +
              " (Seed " +
              seed +
              "-" +
              number +
              ")",
        description:
          "Synthetic test vendor providing " +
          services.join(", ") +
          " in " +
          location.city +
          ".",
        contactPhone: phoneNumber,
        contactEmail: email,
        location: {
          address: 10 + Math.floor(random() * 190) + " Sample Event Road",
          city: location.city,
          state: location.state,
          country: "India",
        },
        serviceAreas: [location.city, location.nearby],
        images: [],
        startingPrice:
          index === 0 ? 5000 : 500 * (10 + Math.floor(random() * 191)),
        currency: "INR",
        approvalStatus: "approved",
        rejectionReason: null,
        reviewedBy: null,
        reviewedAt: null,
        isActive: true,
        deletedAt: null,
        __v: 0,
      },
      categorySelections: [
        {
          categorySlug: slugify(category.name),
          serviceSlugs: services.map(slugify),
        },
      ],
      eventTypeSlugs: events.map(slugify),
    };
  });
}

// These IDs are only for offline schema validation and the dry-run preview.
// Compare/apply resolve the same slugs to the actual database ObjectIds.
function previewSnapshot() {
  const categories = [];
  const mainIds = new Map();
  for (const category of CATEGORY_DATA) {
    const slug = slugify(category.name);
    const mainId = objectId("preview-category/" + slug);
    mainIds.set(slug, mainId);
    categories.push({
      _id: mainId,
      name: category.name,
      slug,
      parentId: null,
      isActive: true,
    });
    for (const name of category.services) {
      const serviceSlug = slugify(name);
      categories.push({
        _id: objectId("preview-service/" + slug + "/" + serviceSlug),
        name,
        slug: serviceSlug,
        parentId: mainId,
        isActive: true,
      });
    }
  }
  const events = EVENT_TYPE_DATA.map((event) => ({
    _id: objectId("preview-event/" + slugify(event.name)),
    name: event.name,
    slug: slugify(event.name),
    isActive: event.isActive,
    vendorCategoryIds: event.categoryNames.map((name) =>
      mainIds.get(slugify(name)),
    ),
  }));
  return { categories, events, users: [], vendors: [] };
}

async function main(argv = process.argv.slice(2)) {
  const options = parseArguments(argv);
  try {
    validateReferenceData();
  } catch (error) {
    error.seedMessage = error.message;
    throw error;
  }
  const vendorData = generateVendorData(options);
  if (options.mode === "dry-run") {
    const plan = await buildPlan({
      snapshot: previewSnapshot(),
      vendorData,
      User,
      Vendor,
    });
    const report = {
      mode: "dry-run",
      seed: options.seed,
      vendorCount: vendorData.length,
      userCount: vendorData.length,
      referenceIdsArePlaceholders: true,
      records: vendorData.map((entry, index) => ({
        key: entry.key,
        user: plan.targets.users[index],
        vendor: plan.targets.vendors[index],
        categorySelections: entry.categorySelections,
        eventTypeSlugs: entry.eventTypeSlugs,
      })),
    };
    console.log(JSON.stringify(report, null, 2));
    console.log(
      "Dry run complete. Reference IDs are placeholders; compare/apply resolve database IDs. No database connection or writes were made.",
    );
    return report;
  }
  require("dotenv").config({ quiet: true });
  return runSeed({
    options,
    mongoose,
    User,
    Vendor,
    vendorData,
    env: process.env,
  });
}

if (require.main === module) {
  main().catch((error) => {
    console.error(
      "Vendor test-data seed failed:",
      formatSeedError(error),
    );
    process.exitCode = 1;
  });
}

module.exports = { generateVendorData, previewSnapshot, main };
