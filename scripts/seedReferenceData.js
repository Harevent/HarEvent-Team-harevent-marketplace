const mongoose = require("mongoose");
const Category = require("../models/Category");
const EventType = require("../models/EventType");
const {
  parseArguments,
  runSeed,
} = require("./referenceDataSeed");

function list(value) {
  return value
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);
}

const CATEGORY_DATA = [
  {
    name: "Venues",
    services: list(
      "Wedding Hall|Birthday Hall|Kalyan Mandaps|Destination Wedding|Function & Party Halls|Restaurant & Cafe|Hotels|Resorts|Banquet Halls|Farmhouses & Villas|Rooftop Venues|Palace & Heritage Venues|Conference & Meeting Halls|Community Halls|Corporate Venues",
    ),
  },
  {
    name: "Decorators",
    services: list(
      "Griha Pravesh|Wedding Decorators|Floral Decorators|Balloon Decorators|Stage Decorators|Theme Decorators|Luxury Decorators|Traditional Decorators|Modern & Minimalist Decorators|Mandap Decorators|Entrance & Welcome Gate Decorators|Lighting Decorators|Ceiling Decorators|Home Decorators|Corporate Decorators|Outdoor Event Decorators|Tent & Canopy Decorators|Photo Booth & Backdrop Decorators|Car Decorators|Event Concept & Design|Funny Signages",
    ),
  },
  {
    name: "Caterers",
    services: list(
      "Wedding Caterers|Vegetarian Caterers|Non-Vegetarian Caterers|Outdoor Catering|Indoor Catering|Corporate Caterers|Birthday Party Caterers|Maharashtrian Caterers|Punjabi Caterers|Rajasthani Caterers|Gujarati Caterers|Bengali Caterers|Italian Food Caterers|South Indian|North Indian/Mughlai|Chaat & Food Stalls|Jain Food Caterers|Continental (Thai / Italian / Chinese)",
    ),
  },
  {
    name: "Makeup Artists",
    services: list(
      "Bridal Makeup Artists|Family Makeup|Party Makeup|Wedz Makeup|HD Makeup Artists|Engagement Makeup|Celebrity Makeup Artists|Hairstylists|Pre-Wedding Makeup|Maternity Makeup|Fashion & Editorial Makeup|Photoshoot Makeup|Groom Makeup Artists|Haldi Makeup Artists|Traditional Makeup Artists|Fashion & Editorial Makeup Artists|Baby Shower Makeup Artists",
    ),
  },
  {
    name: "Photography & Videography",
    legacySlugs: ["photographers"],
    services: list(
      "Wedding Photography|Pre-Wedding Shoot|Post-Wedding Shoot|Cinematic Video|Traditional Video|Traditional Photography|Drone Photography|Albums|Maternity Photoshoot|Newborn Photography|Birthday Photography|Couple Photoshoot|Fashion Photography|Corporate Event Photography|Baby Shower Photography|Candid Photography|Housewarming Photography|Photographers|Videographers",
    ),
  },
  {
    name: "Mehndi Artists",
    services: list(
      "Bridal Mehndi|Groom Mehndi|Maternity Mehndi|Side Mehndi|Traditional Mehndi|Back Hands Mehndi|Full Hands Mehndi|Arabic Mehndi|Engagement Mehndi|Rajasthani Mehndi|Marwari Mehndi|Portrait Mehndi|Dulha-Dulhan Mehndi|Festival Mehndi|Baby Shower Mehndi",
    ),
  },
  {
    name: "DJs",
    services: list(
      "Mini DJs|Banjo|Dhol Tasha Pathak|Lezim Pathak|Dhol Pathak|Live Percussionists|Nashik Dhol|Brass Orchestra|Punjabi Dhol|Ghodi & Band Services|Traditional Dhol|Traditional Music Groups|Club DJ|Live Instrumental Groups|Karaoke DJs",
    ),
  },
  {
    name: "Jewellery on Rent",
    services: list(
      "Couple Jewellery Sets|Groom Jewellery|Engagement Jewellery|Reception Jewellery|Bridal Jewellery|Punjabi Jewellery|Wedding Jewellery|Rajasthani Jewellery|Maharashtrian Jewellery|Floral Jewellery|Haldi Jewellery Sets|Maternity Jewellery|Traditional Jewellery|Festival Jewellery",
    ),
  },
  {
    name: "Invitation Cards / Designers",
    services: list(
      "Digital Wedding Invitations|Wedding Invitation Cards|E-Invitations|Animated Video Invitations|Luxury Wedding Invitations|Premium Invitation Cards|Traditional Invitation Cards|Modern Invitation Cards|Video Invitations|Personalized Invitation Cards|Engagement Invitation Cards|Haldi Invitation Cards|Mehndi Invitation Cards|Sangeet Invitation Cards|Reception Invitation Cards|Birthday Invitation Cards|Baby Shower Invitations|Naming Ceremony Invitations|Anniversary Invitation Cards|Corporate Event Invitations|Party Invitations|Photo Invitation Cards",
    ),
  },
  {
    name: "Choreographers",
    services: list(
      "Wedding Choreographers|Sangeet Choreographers|Couple Dance Choreographers|Bride Solo Dance|Groom Solo Dance|Bride & Groom Couple Dance|Family Dance Choreographers|Friends Group Dance|Haldi Dance Choreographers|Mehndi Dance Choreographers|Engagement Dance Choreographers|Reception Dance Choreographers|Bollywood Dance Choreographers|Classical Dance Choreographers|Hip-Hop Dance Choreographers|Birthday Party Choreographers|Kids Dance Choreographers|Professional Dance Groups|Garba Groups|Home Dance Training|Celebrity Dance Trainers|Wedding Entry Dance",
    ),
  },
  {
    name: "Groom Wear",
    services: list(
      "Wedding Sherwani|Indo-Western Outfits|Wedding Suits & Tuxedos|Groom Wear on Rent|Haldi & Mehndi Outfits|Designer Turbans & Safas|Custom-Tailored Groom Wear|Groom Accessories",
    ),
  },
  {
    name: "Bridal Wear",
    services: list(
      "Bridal Lehenga|Traditional Bridal Wear|Designer Lehenga|Royal Bridal Wear|Wedding Sarees|Maharashtrian Bridal Wear|Designer Sarees|Rajasthani Bridal Wear|Bridal Gowns|South Indian Bridal Wear|Wedding Dresses|Muslim Bridal Wear|Reception Gowns|Jain Bridal Wear|Engagement Outfits|Bridal Dupatta|Haldi Outfits|Mehndi Outfits|Sangeet Outfits|Cocktail Party Dresses|Pre-Wedding Outfit",
    ),
  },
  {
    name: "Honeymoon",
    services: list(
      "Domestic Honeymoon Packages|Anniversary Travel Packages|International Honeymoon Packages|Luxury Honeymoon Packages|Budget Honeymoon Packages|Weekend Getaway Packages|Romantic Honeymoon Packages|Cultural Honeymoon Tours|Adventure Honeymoon Packages|Wildlife & Nature Honeymoon|Beach Honeymoon Packages|Cruise Honeymoon Packages|Hill Station Honeymoon Packages|Destination Wedding & Honeymoon|Island Honeymoon Packages|Road Trip Honeymoon|Private Villa Honeymoon|Couple Tour Packages|Resort Honeymoon Packages|Customized Honeymoon Packages|All-Inclusive Honeymoon Packages",
    ),
  },
  {
    name: "Gifts",
    services: list(
      "Reception Gifts|Wedding Gifts|Anniversary Gifts|Bridal Gifts|Birthday Gifts|Groom Gifts|Flower & Bouquet Gifts|Couple Gifts|Return Gift Suppliers|Personalized Gifts|Wellness & Spa Hampers|Customized Gifts|Luxury Gifts|Engagement Gifts|Premium Gift Hampers|Corporate Gifts|Wedding Return Gifts|Family Gifts|Guest Welcome Hampers|Chocolates & Sweet Boxes|Bridesmaid Gifts|Groomsmen Gifts|Newborn Baby Gifts|Festival Gifts|Handmade Gifts|Photo Frames & Albums|Luxury Gift Hampers",
    ),
  },
  {
    name: "Entertainment",
    services: list(
      "Anchor|Singers & Dancers|Artist|Garba & Dandiya Groups|Special Shows & Attractions|Bhajan & Kirtan Groups|Live Bands & Singers|Anchors & Emcees|Entertainment Artists",
    ),
  },
  {
    name: "Pandits",
    services: list(
      "Ganesh Puja Pandits|Griha Pravesh Pandits|Lakshmi Puja Pandits|Wedding Pandits|Navgraha Puja Pandits|Vastu Shanti Pandits|Havan & Yagya Specialists|Office Opening Puja Pandits|Pitra Dosh Puja Specialists",
    ),
  },
  {
    name: "Rangoli Artists",
    services: list(
      "Traditional Rangoli|Floral Rangoli|Wedding Rangoli|Festival Rangoli|Corporate Rangoli",
    ),
  },
  {
    name: "Event Planners",
    services: list(
      "Corporate Event Planners|Conference Event Planners|Wedding Planners|Party Planners|Festival & Cultural Event Planners|Concert & Show Planners|Sports Event Planners",
    ),
  },
  {
    name: "Production & Technical Setup",
    services: list("Stage Setup|Sound & Lighting|LED Wall & Screen Rentals"),
  },
];

function eventType(name, categoryNames, { isActive = true } = {}) {
  return {
    name,
    categoryNames: list(categoryNames),
    isActive,
  };
}

const EVENT_TYPE_DATA = [
  eventType(
    "Wedding",
    "Venues|Decorators|Caterers|Makeup Artists|Photography & Videography|Mehndi Artists|DJs|Jewellery on Rent|Invitation Cards / Designers|Choreographers|Groom Wear|Bridal Wear|Honeymoon|Gifts|Pandits|Rangoli Artists|Entertainment|Event Planners|Production & Technical Setup",
  ),
  eventType(
    "Reception",
    "Venues|Decorators|Caterers|Makeup Artists|Photography & Videography|Mehndi Artists|DJs|Jewellery on Rent|Invitation Cards / Designers|Choreographers|Groom Wear|Bridal Wear|Gifts|Rangoli Artists|Entertainment|Event Planners|Production & Technical Setup",
  ),
  eventType(
    "Engagement",
    "Venues|Decorators|Caterers|Makeup Artists|Photography & Videography|Mehndi Artists|DJs|Jewellery on Rent|Invitation Cards / Designers|Choreographers|Gifts|Pandits|Entertainment|Rangoli Artists|Event Planners|Production & Technical Setup",
  ),
  eventType(
    "Anniversary",
    "Venues|Decorators|Caterers|Makeup Artists|Photography & Videography|Mehndi Artists|DJs|Gifts|Invitation Cards / Designers|Choreographers|Rangoli Artists|Entertainment|Event Planners|Production & Technical Setup",
  ),
  eventType(
    "Sangeet Ceremony",
    "Venues|Decorators|Caterers|Makeup Artists|Photography & Videography|Mehndi Artists|DJs|Jewellery on Rent|Invitation Cards / Designers|Choreographers|Groom Wear|Bridal Wear|Entertainment|Event Planners|Production & Technical Setup",
  ),
  eventType(
    "Naming Ceremony / Baby Shower",
    "Venues|Decorators|Caterers|Makeup Artists|Photography & Videography|Mehndi Artists|Rangoli Artists|Jewellery on Rent|Invitation Cards / Designers|Entertainment|Gifts|Pandits|Event Planners",
  ),
  eventType(
    "Birthday",
    "Venues|Decorators|Caterers|DJs|Photography & Videography|Invitation Cards / Designers|Choreographers|Gifts|Entertainment|Makeup Artists|Event Planners|Production & Technical Setup",
  ),
  eventType(
    "Housewarming / Griha Pravesh",
    "Decorators|Caterers|Makeup Artists|Photography & Videography|Mehndi Artists|Invitation Cards / Designers|Gifts|Pandits|Rangoli Artists|Entertainment|Event Planners",
  ),
  eventType(
    "Corporate Events",
    "Event Planners|Venues|Decorators|Caterers|Photography & Videography|DJs|Entertainment|Production & Technical Setup|Invitation Cards / Designers|Gifts",
  ),
  eventType(
    "Conferences & Seminars",
    "Event Planners|Venues|Decorators|Caterers|Photography & Videography|DJs|Entertainment|Production & Technical Setup|Invitation Cards / Designers|Gifts",
  ),
  // Proposed mappings remain inactive until reviewed. Populating mappings does
  // not by itself approve an event for customer discovery.
  eventType(
    "Award Ceremonies",
    "Event Planners|Venues|Decorators|Caterers|Makeup Artists|Photography & Videography|DJs|Entertainment|Choreographers|Production & Technical Setup|Invitation Cards / Designers|Gifts",
    { isActive: false },
  ),
  eventType(
    "College Festivals",
    "Event Planners|Venues|Decorators|Caterers|Makeup Artists|Photography & Videography|DJs|Entertainment|Choreographers|Production & Technical Setup|Invitation Cards / Designers|Gifts",
    { isActive: false },
  ),
  eventType(
    "School Events",
    "Event Planners|Venues|Decorators|Caterers|Photography & Videography|Entertainment|Choreographers|Production & Technical Setup|Invitation Cards / Designers|Gifts",
    { isActive: false },
  ),
  eventType(
    "Farewell Party",
    "Event Planners|Venues|Decorators|Caterers|Makeup Artists|Photography & Videography|DJs|Entertainment|Choreographers|Production & Technical Setup|Invitation Cards / Designers|Gifts",
    { isActive: false },
  ),
  eventType(
    "Graduation Ceremony",
    "Event Planners|Venues|Decorators|Caterers|Photography & Videography|Entertainment|Production & Technical Setup|Invitation Cards / Designers|Gifts",
    { isActive: false },
  ),
  eventType(
    "Bachelor Party",
    "Event Planners|Venues|Decorators|Caterers|Photography & Videography|DJs|Entertainment|Production & Technical Setup|Invitation Cards / Designers",
    { isActive: false },
  ),
  eventType(
    "Reunion Party",
    "Event Planners|Venues|Decorators|Caterers|Photography & Videography|DJs|Entertainment|Production & Technical Setup|Invitation Cards / Designers|Gifts",
    { isActive: false },
  ),
  eventType(
    "Cocktail Party",
    "Event Planners|Venues|Decorators|Caterers|Makeup Artists|Photography & Videography|DJs|Entertainment|Production & Technical Setup|Invitation Cards / Designers",
    { isActive: false },
  ),
  eventType(
    "Private Parties",
    "Event Planners|Venues|Decorators|Caterers|Makeup Artists|Photography & Videography|DJs|Entertainment|Production & Technical Setup|Invitation Cards / Designers|Gifts",
    { isActive: false },
  ),
  eventType(
    "Family Get-Together",
    "Event Planners|Venues|Decorators|Caterers|Photography & Videography|DJs|Entertainment|Rangoli Artists|Invitation Cards / Designers|Gifts",
    { isActive: false },
  ),
  eventType(
    "Festival Celebrations",
    "Event Planners|Venues|Decorators|Caterers|Makeup Artists|Photography & Videography|Mehndi Artists|DJs|Jewellery on Rent|Entertainment|Choreographers|Pandits|Rangoli Artists|Production & Technical Setup|Invitation Cards / Designers|Gifts",
    { isActive: false },
  ),
  eventType(
    "Religious Events",
    "Event Planners|Venues|Decorators|Caterers|Photography & Videography|Entertainment|Pandits|Rangoli Artists|Production & Technical Setup|Invitation Cards / Designers|Gifts",
    { isActive: false },
  ),
  eventType(
    "Cultural Events",
    "Event Planners|Venues|Decorators|Caterers|Makeup Artists|Photography & Videography|DJs|Entertainment|Choreographers|Rangoli Artists|Production & Technical Setup|Invitation Cards / Designers|Gifts",
    { isActive: false },
  ),
  eventType(
    "Concerts & Live Shows",
    "Event Planners|Venues|Decorators|Caterers|Makeup Artists|Photography & Videography|DJs|Entertainment|Choreographers|Production & Technical Setup|Invitation Cards / Designers",
    { isActive: false },
  ),
  eventType(
    "Fashion Shows",
    "Event Planners|Venues|Decorators|Caterers|Makeup Artists|Photography & Videography|DJs|Entertainment|Choreographers|Production & Technical Setup|Invitation Cards / Designers",
    { isActive: false },
  ),
  eventType(
    "Charity & Fundraising Events",
    "Event Planners|Venues|Decorators|Caterers|Photography & Videography|DJs|Entertainment|Production & Technical Setup|Invitation Cards / Designers|Gifts",
    { isActive: false },
  ),
  eventType(
    "Sports Events",
    "Event Planners|Venues|Decorators|Caterers|Photography & Videography|Entertainment|Production & Technical Setup|Invitation Cards / Designers|Gifts",
    { isActive: false },
  ),
  eventType(
    "Political Events",
    "Event Planners|Venues|Decorators|Caterers|Photography & Videography|Entertainment|Production & Technical Setup|Invitation Cards / Designers",
    { isActive: false },
  ),
  eventType(
    "Community Events",
    "Event Planners|Venues|Decorators|Caterers|Photography & Videography|DJs|Entertainment|Rangoli Artists|Production & Technical Setup|Invitation Cards / Designers|Gifts",
    { isActive: false },
  ),
];

const SOURCE_REVIEW_NOTES = [
  "Merged duplicate Wedding and Award Ceremonies Event Type rows.",
  "Removed the duplicate Photographers mapping under Conferences & Seminars.",
  "Removed the redundant DJs child record beneath the DJs main category.",
  "Moved the misplaced Luxury Gift Hampers cell into the Gifts service list.",
  "Corrected obvious spelling and spacing issues without using the legacy JSON files.",
  "Rolled event-specific vendor labels up to their main categories for Corporate Events and Conferences & Seminars.",
  "Added services beneath Rangoli Artists and Event Planners; Corporate Event Planners and Conference Event Planners are planner services.",
  "Corporate Event Vendors is a generic label: categorize each vendor by its actual services, with no default Event Planners assignment.",
  "Renamed Photographers to Photography & Videography, preserving legacy category/service IDs, and added separate Photographers and Videographers child records.",
  "Stage Setup, Sound & Lighting, and LED Wall & Screen Rentals belong to Production & Technical Setup; decorative services remain under Decorators.",
  "Added relevant mappings for all 29 Event Types. The 19 pending events remain inactive until their proposed mappings are reviewed and verified.",
  "Normal re-seeding preserves saved category, service, and event activation settings; activation after review is a separate explicit update.",
  "The seed retains existing mapping IDs and never writes vendor documents or moves services between parents.",
];

function slugify(value) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['\u2019]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function validateReferenceData() {
  const categoryBySlug = new Map();
  let serviceCount = 0;

  for (const category of CATEGORY_DATA) {
    const categorySlug = slugify(category.name);

    if (!categorySlug) {
      throw new Error("Category has an invalid name: " + category.name);
    }

    if (categoryBySlug.has(categorySlug)) {
      throw new Error("Duplicate main category slug: " + categorySlug);
    }

    categoryBySlug.set(categorySlug, category);

    if (!category.services.length) {
      throw new Error("Category " + category.name + " must define at least one service");
    }

    const serviceSlugs = new Set();
    for (const serviceName of category.services) {
      const serviceSlug = slugify(serviceName);

      if (!serviceSlug) {
        throw new Error(
          "Category " + category.name + " contains an invalid service name",
        );
      }

      if (serviceSlug === categorySlug) {
        throw new Error(
          "Category " +
            category.name +
            " contains a redundant same-name service",
        );
      }

      if (serviceSlugs.has(serviceSlug)) {
        throw new Error(
          "Category " +
            category.name +
            " contains duplicate service " +
            serviceName,
        );
      }

      serviceSlugs.add(serviceSlug);
      serviceCount += 1;
    }
  }

  const legacySlugs = new Set();
  for (const category of CATEGORY_DATA) {
    for (const legacySlug of category.legacySlugs || []) {
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(legacySlug) || categoryBySlug.has(legacySlug) || legacySlugs.has(legacySlug)) {
        throw new Error("Invalid or conflicting legacy category slug: " + legacySlug);
      }
      legacySlugs.add(legacySlug);
    }
  }

  const eventTypeSlugs = new Set();
  let activeEventTypeCount = 0;

  for (const event of EVENT_TYPE_DATA) {
    const eventSlug = slugify(event.name);

    if (!eventSlug) {
      throw new Error("Event Type has an invalid name: " + event.name);
    }

    if (eventTypeSlugs.has(eventSlug)) {
      throw new Error("Duplicate Event Type slug: " + eventSlug);
    }

    eventTypeSlugs.add(eventSlug);

    const mappedCategorySlugs = new Set();
    for (const categoryName of event.categoryNames) {
      const categorySlug = slugify(categoryName);

      if (!categoryBySlug.has(categorySlug)) {
        throw new Error(
          "Event Type " +
            event.name +
            " references unknown main category " +
            categoryName,
        );
      }

      if (mappedCategorySlugs.has(categorySlug)) {
        throw new Error(
          "Event Type " +
            event.name +
            " contains duplicate category mapping " +
            categoryName,
        );
      }

      mappedCategorySlugs.add(categorySlug);
    }

    if (mappedCategorySlugs.size === 0) {
      throw new Error(
        "Event Type " +
          event.name +
          " must map to at least one category",
      );
    }

    if (event.isActive) activeEventTypeCount += 1;
  }

  return {
    categoryCount: CATEGORY_DATA.length,
    serviceCount,
    eventTypeCount: EVENT_TYPE_DATA.length,
    activeEventTypeCount,
    inactiveEventTypeCount: EVENT_TYPE_DATA.length - activeEventTypeCount,
  };
}

async function main(argv = process.argv.slice(2)) {
  const options = parseArguments(argv);
  let summary;
  try {
    summary = validateReferenceData();
  } catch (error) {
    error.seedMessage = error.message;
    throw error;
  }

  console.log("Reference-data validation passed.");
  console.log(
    "Prepared " +
      summary.categoryCount +
      " main categories, " +
      summary.serviceCount +
      " services, and " +
      summary.eventTypeCount +
      " Event Types.",
  );
  console.log(
    summary.activeEventTypeCount +
      " Event Types are active; " +
      summary.inactiveEventTypeCount +
      " have proposed mappings and default to inactive pending review (saved activation settings are preserved).",
  );

  if (options.mode === "dry-run") {
    console.log("Spreadsheet review notes:");
    for (const note of SOURCE_REVIEW_NOTES) {
      console.log("- " + note);
    }

    console.log(
      "Dry run complete. No database connection or writes were made.",
    );
    return;
  }

  require("dotenv").config({ quiet: true });
  return runSeed({
    options,
    mongoose,
    Category,
    EventType,
    categoryData: CATEGORY_DATA,
    eventData: EVENT_TYPE_DATA,
    slugify,
    env: process.env,
  });
}

if (require.main === module) {
  main().catch((error) => {
    // Connection errors can include credentials or hosts. Do not echo them.
    console.error(
      "Reference-data seed failed:",
      error.seedMessage || "Database operation failed; review the local execution journal if one was created.",
    );
    process.exitCode = 1;
  });
}

module.exports = {
  CATEGORY_DATA,
  EVENT_TYPE_DATA,
  SOURCE_REVIEW_NOTES,
  main,
  slugify,
  validateReferenceData,
};
