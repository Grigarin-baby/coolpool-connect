import { Client, Databases, Storage, ID } from "node-appwrite";

const endpoint = process.env.APPWRITE_ENDPOINT || process.env.VITE_APPWRITE_ENDPOINT || "";
const projectId = process.env.APPWRITE_PROJECT_ID || process.env.VITE_APPWRITE_PROJECT_ID || "";
const databaseId = process.env.APPWRITE_DATABASE_ID || process.env.VITE_APPWRITE_DATABASE_ID || "";
const apiKey = process.env.APPWRITE_API_KEY || "";

if (!endpoint || !projectId || !databaseId || !apiKey) {
  throw new Error(
    "Missing env: APPWRITE_API_KEY plus endpoint/project/database (APPWRITE_* or VITE_APPWRITE_*).",
  );
}

const COLLECTIONS = {
  trips: "coolpool_trips",
  tripStops: "coolpool_trip_stops",
  tripSeatReservations: "coolpool_trip_seat_reservations",
  bookings: "coolpool_bookings",
  userRoles: "coolpool_user_roles",
  pricingRules: "coolpool_pricing_rules",
  profiles: "coolpool_profiles",
  drivers: "coolpool_drivers",
  vehicles: "coolpool_vehicles",
  heroBanners: "coolpool_hero_banners",
};

const BUCKETS = {
  driverDocs: "69f312e500186db2d785", // Use existing ID from .env
  banners: "coolpool_banners_bucket",
};

const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
const databases = new Databases(client);
const storage = new Storage(client);

async function ensureBucket(bucketId, name) {
  try {
    await storage.getBucket(bucketId);
    console.log(`Bucket exists: ${bucketId}`);
  } catch {
    try {
      await storage.createBucket(
        bucketId,
        name,
        [], // Permissions will default to project settings or we can make it public read
        false, // fileSecurity
        true, // enabled
        5000000, // 5MB limit
        ["jpg", "jpeg", "png", "gif", "webp", "svg"], // extensions
        "none", // compression
        false, // encryption
        false, // antimalware
      );
      console.log(`Created bucket: ${bucketId}`);
    } catch (error) {
      if (error?.code === 409 || error?.type === "bucket_already_exists") {
        console.log(`Bucket already exists: ${bucketId}`);
        return;
      }
      throw error;
    }
  }
}

async function ensureCollection(collectionId, name) {
  try {
    await databases.getCollection(databaseId, collectionId);
    console.log(`Collection exists: ${collectionId}`);
  } catch {
    try {
      await databases.createCollection(databaseId, collectionId, name, [], true, true);
      console.log(`Created collection: ${collectionId}`);
    } catch (error) {
      if (error?.code === 409 || error?.type === "collection_already_exists") {
        console.log(`Collection already exists: ${collectionId}`);
        return;
      }
      throw error;
    }
  }
}

async function ensureStringAttribute(
  collectionId,
  key,
  size,
  required = false,
  def = undefined,
  array = false,
) {
  try {
    await databases.getAttribute(databaseId, collectionId, key);
    console.log(`Attribute exists: ${collectionId}.${key}`);
  } catch {
    await databases.createStringAttribute(
      databaseId,
      collectionId,
      key,
      size,
      required,
      def,
      array,
    );
    console.log(`Created attribute: ${collectionId}.${key}`);
  }
}

async function ensureEnumAttribute(
  collectionId,
  key,
  elements,
  required = false,
  def = undefined,
  array = false,
) {
  try {
    const existing = await databases.getAttribute(databaseId, collectionId, key);
    console.log(`Attribute exists: ${collectionId}.${key}`);
    if (existing.type !== "enum") {
      console.warn(
        `Attribute ${collectionId}.${key} exists as type "${existing.type}", not enum. ` +
          `Please replace it manually in Appwrite Console with enum values: ${elements.join(", ")}`,
      );
    }
  } catch {
    await databases.createEnumAttribute(
      databaseId,
      collectionId,
      key,
      elements,
      required,
      def,
      array,
    );
    console.log(`Created enum attribute: ${collectionId}.${key} = [${elements.join(", ")}]`);
  }
}

async function ensureFloatAttribute(
  collectionId,
  key,
  required = false,
  min = undefined,
  max = undefined,
  def = undefined,
  array = false,
) {
  try {
    await databases.getAttribute(databaseId, collectionId, key);
    console.log(`Attribute exists: ${collectionId}.${key}`);
  } catch {
    await databases.createFloatAttribute(
      databaseId,
      collectionId,
      key,
      required,
      min,
      max,
      def,
      array,
    );
    console.log(`Created attribute: ${collectionId}.${key}`);
  }
}

async function ensureIntegerAttribute(
  collectionId,
  key,
  required = false,
  min = undefined,
  max = undefined,
  def = undefined,
  array = false,
) {
  try {
    await databases.getAttribute(databaseId, collectionId, key);
    console.log(`Attribute exists: ${collectionId}.${key}`);
  } catch {
    await databases.createIntegerAttribute(
      databaseId,
      collectionId,
      key,
      required,
      min,
      max,
      def,
      array,
    );
    console.log(`Created attribute: ${collectionId}.${key}`);
  }
}

async function ensureDatetimeAttribute(
  collectionId,
  key,
  required = false,
  def = undefined,
  array = false,
) {
  try {
    await databases.getAttribute(databaseId, collectionId, key);
    console.log(`Attribute exists: ${collectionId}.${key}`);
  } catch {
    await databases.createDatetimeAttribute(databaseId, collectionId, key, required, def, array);
    console.log(`Created attribute: ${collectionId}.${key}`);
  }
}

async function ensureBooleanAttribute(
  collectionId,
  key,
  required = false,
  def = undefined,
  array = false,
) {
  try {
    await databases.getAttribute(databaseId, collectionId, key);
    console.log(`Attribute exists: ${collectionId}.${key}`);
  } catch {
    await databases.createBooleanAttribute(databaseId, collectionId, key, required, def, array);
    console.log(`Created attribute: ${collectionId}.${key}`);
  }
}

async function ensureIndex(collectionId, key, type, attributes) {
  try {
    await databases.getIndex(databaseId, collectionId, key);
    console.log(`Index exists: ${collectionId}.${key}`);
  } catch {
    try {
      await databases.createIndex(databaseId, collectionId, key, type, attributes);
      console.log(`Created index: ${collectionId}.${key}`);
    } catch (error) {
      console.warn(
        `Skipped index (will retry later if needed): ${collectionId}.${key}`,
        error?.message || error,
      );
    }
  }
}

async function run() {
  await ensureCollection(COLLECTIONS.trips, "Trips");
  await ensureCollection(COLLECTIONS.tripStops, "Trip Stops");
  await ensureCollection(COLLECTIONS.tripSeatReservations, "Trip seat reservations");
  await ensureCollection(COLLECTIONS.bookings, "Bookings");
  await ensureCollection(COLLECTIONS.userRoles, "User Roles");
  await ensureCollection(COLLECTIONS.pricingRules, "Pricing Rules");
  await ensureCollection(COLLECTIONS.profiles, "Profiles");
  await ensureCollection(COLLECTIONS.drivers, "Drivers");
  await ensureCollection(COLLECTIONS.vehicles, "Vehicles");
  await ensureCollection(COLLECTIONS.heroBanners, "Hero Banners");

  await ensureBucket(BUCKETS.banners, "Banner Images");

  // trips
  await ensureStringAttribute(COLLECTIONS.trips, "host_id", 64, true);
  await ensureStringAttribute(COLLECTIONS.trips, "from_location", 256, true);
  await ensureFloatAttribute(COLLECTIONS.trips, "from_lat", true);
  await ensureFloatAttribute(COLLECTIONS.trips, "from_lng", true);
  await ensureStringAttribute(COLLECTIONS.trips, "to_location", 256, true);
  await ensureFloatAttribute(COLLECTIONS.trips, "to_lat", true);
  await ensureFloatAttribute(COLLECTIONS.trips, "to_lng", true);
  await ensureStringAttribute(COLLECTIONS.trips, "polyline", 100000, true);
  await ensureFloatAttribute(COLLECTIONS.trips, "total_distance_km", true);
  await ensureFloatAttribute(COLLECTIONS.trips, "total_price", true);
  await ensureFloatAttribute(COLLECTIONS.trips, "price_per_km", true);
  await ensureIntegerAttribute(COLLECTIONS.trips, "total_seats", true, 1);
  await ensureDatetimeAttribute(COLLECTIONS.trips, "departure_at", true);
  await ensureDatetimeAttribute(COLLECTIONS.trips, "arrival_at", false);
  await ensureIntegerAttribute(COLLECTIONS.trips, "duration_minutes", false, 0);
  await ensureStringAttribute(COLLECTIONS.trips, "host_display_name", 120, false);
  await ensureFloatAttribute(COLLECTIONS.trips, "host_rating", false, 0, 5);
  await ensureIntegerAttribute(COLLECTIONS.trips, "host_rating_count", false, 0);
  await ensureStringAttribute(COLLECTIONS.trips, "vehicle_model", 120, false);
  await ensureStringAttribute(COLLECTIONS.trips, "vehicle_color", 40, false);
  await ensureStringAttribute(COLLECTIONS.trips, "status", 32, true);
  await ensureStringAttribute(COLLECTIONS.trips, "notes", 2000, false);
  await ensureStringAttribute(COLLECTIONS.trips, "vehicle_id", 64, false);
  await ensureStringAttribute(COLLECTIONS.trips, "assigned_driver_id", 64, false);
  await ensureStringAttribute(COLLECTIONS.trips, "seat_config", 64, false, undefined, true);

  // trip stops
  await ensureStringAttribute(COLLECTIONS.tripStops, "trip_id", 64, true);
  await ensureIntegerAttribute(COLLECTIONS.tripStops, "stop_index", true, 0);
  await ensureStringAttribute(COLLECTIONS.tripStops, "location", 256, true);
  await ensureFloatAttribute(COLLECTIONS.tripStops, "lat", true);
  await ensureFloatAttribute(COLLECTIONS.tripStops, "lng", true);
  await ensureStringAttribute(COLLECTIONS.tripStops, "stop_type", 16, true);
  await ensureFloatAttribute(COLLECTIONS.tripStops, "distance_from_origin_km", true, 0);

  // trip seat reservations (public seat map — no PII)
  await ensureStringAttribute(COLLECTIONS.tripSeatReservations, "trip_id", 64, true);
  await ensureStringAttribute(COLLECTIONS.tripSeatReservations, "seat_code", 32, true);
  await ensureStringAttribute(COLLECTIONS.tripSeatReservations, "booking_id", 64, true);

  // bookings
  await ensureStringAttribute(COLLECTIONS.bookings, "trip_id", 64, true);
  await ensureStringAttribute(COLLECTIONS.bookings, "traveler_id", 64, true);
  await ensureIntegerAttribute(COLLECTIONS.bookings, "from_stop_index", true, 0);
  await ensureIntegerAttribute(COLLECTIONS.bookings, "to_stop_index", true, 0);
  await ensureIntegerAttribute(COLLECTIONS.bookings, "seats_booked", true, 1);
  await ensureFloatAttribute(COLLECTIONS.bookings, "segment_price", true, 0);
  await ensureStringAttribute(COLLECTIONS.bookings, "passenger_name", 120, true);
  await ensureStringAttribute(COLLECTIONS.bookings, "passenger_phone", 40, true);
  await ensureStringAttribute(COLLECTIONS.bookings, "status", 32, true);
  await ensureIntegerAttribute(COLLECTIONS.bookings, "rating_by_host", false, 1, 5);
  await ensureStringAttribute(COLLECTIONS.bookings, "comment_by_host", 500, false);
  await ensureDatetimeAttribute(COLLECTIONS.bookings, "created_at", false);
  await ensureStringAttribute(COLLECTIONS.bookings, "otp", 10, false);
  await ensureBooleanAttribute(COLLECTIONS.bookings, "verified", false, false);

  // user roles
  await ensureStringAttribute(COLLECTIONS.userRoles, "user_id", 64, true);
  await ensureEnumAttribute(COLLECTIONS.userRoles, "role", ["admin", "driver", "user"], true);

  // pricing rules
  await ensureFloatAttribute(COLLECTIONS.pricingRules, "min_price_per_km", true, 0);
  await ensureFloatAttribute(COLLECTIONS.pricingRules, "max_price_per_km", true, 0);
  await ensureFloatAttribute(COLLECTIONS.pricingRules, "route_match_tolerance_km", true, 0);
  await ensureDatetimeAttribute(COLLECTIONS.pricingRules, "updated_at", false);

  // profiles
  await ensureStringAttribute(COLLECTIONS.profiles, "user_id", 64, true);
  await ensureStringAttribute(COLLECTIONS.profiles, "full_name", 120, false);
  await ensureStringAttribute(COLLECTIONS.profiles, "phone", 40, false);
  await ensureStringAttribute(COLLECTIONS.profiles, "avatar_url", 2000, false);
  await ensureFloatAttribute(COLLECTIONS.profiles, "host_rating", false, 0, 5);
  await ensureIntegerAttribute(COLLECTIONS.profiles, "host_rating_count", false, 0);
  await ensureIntegerAttribute(COLLECTIONS.profiles, "total_trips_hosted", false, 0);
  await ensureIntegerAttribute(COLLECTIONS.profiles, "total_trips_taken", false, 0);

  // drivers
  await ensureStringAttribute(COLLECTIONS.drivers, "user_id", 64, true);
  await ensureStringAttribute(COLLECTIONS.drivers, "full_name", 120, true);
  await ensureStringAttribute(COLLECTIONS.drivers, "email", 200, true);
  await ensureStringAttribute(COLLECTIONS.drivers, "phone", 40, true);
  await ensureStringAttribute(COLLECTIONS.drivers, "license_number", 80, true);
  await ensureStringAttribute(COLLECTIONS.drivers, "city", 120, true);

  // vehicles
  await ensureStringAttribute(COLLECTIONS.vehicles, "driver_user_id", 64, true);
  await ensureStringAttribute(COLLECTIONS.vehicles, "model_name", 120, true);
  await ensureStringAttribute(COLLECTIONS.vehicles, "plate_number", 40, true);
  await ensureIntegerAttribute(COLLECTIONS.vehicles, "seat_capacity", true, 1);
  await ensureStringAttribute(COLLECTIONS.vehicles, "color", 40, false);
  await ensureStringAttribute(COLLECTIONS.vehicles, "registration_doc", 2000, false);
  await ensureStringAttribute(COLLECTIONS.vehicles, "insurance_doc", 2000, false);
  await ensureStringAttribute(COLLECTIONS.vehicles, "car_images", 255, false, undefined, true);

  // hero banners
  await ensureStringAttribute(COLLECTIONS.heroBanners, "title", 120, false);
  await ensureStringAttribute(COLLECTIONS.heroBanners, "imageId", 64, true);
  await ensureStringAttribute(COLLECTIONS.heroBanners, "imageUrl", 2000, false);
  await ensureStringAttribute(COLLECTIONS.heroBanners, "linkUrl", 2000, false);
  await ensureDatetimeAttribute(COLLECTIONS.heroBanners, "startDate", false);
  await ensureDatetimeAttribute(COLLECTIONS.heroBanners, "endDate", false);
  await ensureBooleanAttribute(COLLECTIONS.heroBanners, "isActive", false, true);
  await ensureIntegerAttribute(COLLECTIONS.heroBanners, "sortOrder", false, 0, undefined, 0);

  // indexes for app queries
  await ensureIndex(COLLECTIONS.trips, "idx_trips_host_id", "key", ["host_id"]);
  await ensureIndex(COLLECTIONS.trips, "idx_trips_departure_at", "key", ["departure_at"]);
  await ensureIndex(COLLECTIONS.tripStops, "idx_trip_stops_trip_id", "key", ["trip_id"]);
  await ensureIndex(COLLECTIONS.tripStops, "idx_trip_stops_trip_stop", "key", [
    "trip_id",
    "stop_index",
  ]);
  await ensureIndex(COLLECTIONS.tripSeatReservations, "idx_trip_seats_trip_id", "key", ["trip_id"]);
  await ensureIndex(COLLECTIONS.bookings, "idx_bookings_trip_id", "key", ["trip_id"]);
  await ensureIndex(COLLECTIONS.bookings, "idx_bookings_traveler_id", "key", ["traveler_id"]);
  await ensureIndex(COLLECTIONS.userRoles, "idx_user_roles_user_id", "key", ["user_id"]);
  await ensureIndex(COLLECTIONS.pricingRules, "idx_pricing_rules_updated", "key", ["updated_at"]);
  await ensureIndex(COLLECTIONS.profiles, "idx_profiles_user_id", "key", ["user_id"]);
  await ensureIndex(COLLECTIONS.drivers, "idx_drivers_user_id", "key", ["user_id"]);
  await ensureIndex(COLLECTIONS.drivers, "idx_drivers_license_number", "key", ["license_number"]);
  await ensureIndex(COLLECTIONS.vehicles, "idx_vehicles_driver_user_id", "key", ["driver_user_id"]);
  await ensureIndex(COLLECTIONS.vehicles, "idx_vehicles_plate_number", "key", ["plate_number"]);
  await ensureIndex(COLLECTIONS.heroBanners, "idx_hero_banners_is_active", "key", ["isActive"]);
  await ensureIndex(COLLECTIONS.heroBanners, "idx_hero_banners_sort_order", "key", ["sortOrder"]);

  // seed default pricing rule if absent
  const pricingRules = await databases.listDocuments(databaseId, COLLECTIONS.pricingRules);
  if (pricingRules.total === 0) {
    await databases.createDocument(databaseId, COLLECTIONS.pricingRules, ID.unique(), {
      min_price_per_km: 1,
      max_price_per_km: 100,
      route_match_tolerance_km: 5,
      updated_at: new Date().toISOString(),
    });
    console.log("Seeded default pricing rule");
  }

  console.log("Appwrite migration complete.");
  console.log("Collection IDs:");
  console.log(JSON.stringify(COLLECTIONS, null, 2));
}

run().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
