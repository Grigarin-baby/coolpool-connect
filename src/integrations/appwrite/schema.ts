export interface AppwriteCollectionIds {
  trips: string;
  tripStops: string;
  tripSeatReservations: string;
  bookings: string;
  userRoles: string;
  pricingRules: string;
  profiles: string;
  drivers: string;
  vehicles: string;
  heroBanners: string;
}

export interface AppwriteBucketIds {
  driverDocs: string;
  banners: string;
}

function requireCollectionId(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`Missing ${name}. Add it in environment variables.`);
  }
  return value;
}

export function getCollectionIds(): AppwriteCollectionIds {
  return {
    trips: requireCollectionId(
      import.meta.env.VITE_APPWRITE_COLLECTION_TRIPS || process.env.APPWRITE_COLLECTION_TRIPS,
      "VITE_APPWRITE_COLLECTION_TRIPS / APPWRITE_COLLECTION_TRIPS",
    ),
    tripStops: requireCollectionId(
      import.meta.env.VITE_APPWRITE_COLLECTION_TRIP_STOPS ||
        process.env.APPWRITE_COLLECTION_TRIP_STOPS,
      "VITE_APPWRITE_COLLECTION_TRIP_STOPS / APPWRITE_COLLECTION_TRIP_STOPS",
    ),
    tripSeatReservations: requireCollectionId(
      import.meta.env.VITE_APPWRITE_COLLECTION_TRIP_SEAT_RESERVATIONS ||
        process.env.APPWRITE_COLLECTION_TRIP_SEAT_RESERVATIONS,
      "VITE_APPWRITE_COLLECTION_TRIP_SEAT_RESERVATIONS / APPWRITE_COLLECTION_TRIP_SEAT_RESERVATIONS",
    ),
    bookings: requireCollectionId(
      import.meta.env.VITE_APPWRITE_COLLECTION_BOOKINGS || process.env.APPWRITE_COLLECTION_BOOKINGS,
      "VITE_APPWRITE_COLLECTION_BOOKINGS / APPWRITE_COLLECTION_BOOKINGS",
    ),
    userRoles: requireCollectionId(
      import.meta.env.VITE_APPWRITE_COLLECTION_USER_ROLES ||
        process.env.APPWRITE_COLLECTION_USER_ROLES,
      "VITE_APPWRITE_COLLECTION_USER_ROLES / APPWRITE_COLLECTION_USER_ROLES",
    ),
    pricingRules: requireCollectionId(
      import.meta.env.VITE_APPWRITE_COLLECTION_PRICING_RULES ||
        process.env.APPWRITE_COLLECTION_PRICING_RULES,
      "VITE_APPWRITE_COLLECTION_PRICING_RULES / APPWRITE_COLLECTION_PRICING_RULES",
    ),
    profiles: requireCollectionId(
      import.meta.env.VITE_APPWRITE_COLLECTION_PROFILES || process.env.APPWRITE_COLLECTION_PROFILES,
      "VITE_APPWRITE_COLLECTION_PROFILES / APPWRITE_COLLECTION_PROFILES",
    ),
    drivers: requireCollectionId(
      import.meta.env.VITE_APPWRITE_COLLECTION_DRIVERS || process.env.APPWRITE_COLLECTION_DRIVERS,
      "VITE_APPWRITE_COLLECTION_DRIVERS / APPWRITE_COLLECTION_DRIVERS",
    ),
    vehicles: requireCollectionId(
      import.meta.env.VITE_APPWRITE_COLLECTION_VEHICLES || process.env.APPWRITE_COLLECTION_VEHICLES,
      "VITE_APPWRITE_COLLECTION_VEHICLES / APPWRITE_COLLECTION_VEHICLES",
    ),
    heroBanners: requireCollectionId(
      import.meta.env.VITE_APPWRITE_COLLECTION_HERO_BANNERS ||
        process.env.APPWRITE_COLLECTION_HERO_BANNERS,
      "VITE_APPWRITE_COLLECTION_HERO_BANNERS / APPWRITE_COLLECTION_HERO_BANNERS",
    ),
  };
}

export function getBucketIds(): AppwriteBucketIds {
  return {
    driverDocs: requireCollectionId(
      import.meta.env.VITE_APPWRITE_DRIVER_DOCS_BUCKET_ID ||
        process.env.APPWRITE_DRIVER_DOCS_BUCKET_ID,
      "VITE_APPWRITE_DRIVER_DOCS_BUCKET_ID / APPWRITE_DRIVER_DOCS_BUCKET_ID",
    ),
    banners: requireCollectionId(
      import.meta.env.VITE_APPWRITE_BANNERS_BUCKET_ID || process.env.APPWRITE_BANNERS_BUCKET_ID,
      "VITE_APPWRITE_BANNERS_BUCKET_ID / APPWRITE_BANNERS_BUCKET_ID",
    ),
  };
}
