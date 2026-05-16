import { ID, Permission, Query, Role, type Models } from "appwrite";
import { databases, storage, appwriteConfig } from "@/integrations/appwrite/client";
import { getCollectionIds } from "@/integrations/appwrite/schema";
import type {
  AppRole,
  Booking,
  BookingStatus,
  DriverProfile,
  DriverVehicle,
  HeroBanner,
  PricingRule,
  StopType,
  Trip,
  TripSeatReservation,
  TripStatus,
  TripStop,
} from "@/lib/domain";

type Doc = Models.Document;

function toTrip(doc: any): Trip {
  return {
    id: doc.$id,
    hostId: String(doc.host_id || ""),
    fromLocation: String(doc.from_location || ""),
    fromLat: Number(doc.from_lat || 0),
    fromLng: Number(doc.from_lng || 0),
    toLocation: String(doc.to_location || ""),
    toLat: Number(doc.to_lat || 0),
    toLng: Number(doc.to_lng || 0),
    polyline: String(doc.polyline || ""),
    totalDistanceKm: Number(doc.total_distance_km || 0),
    totalPrice: Number(doc.total_price || 0),
    pricePerKm: Number(doc.price_per_km || 0),
    totalSeats: Number(doc.total_seats || 1),
    departureAt: String(doc.departure_at || new Date().toISOString()),
    status: String(doc.status || "scheduled") as TripStatus,
    notes: doc.notes ? String(doc.notes) : null,
    vehicleId: doc.vehicle_id ? String(doc.vehicle_id) : undefined,
    assignedDriverId: doc.assigned_driver_id ? String(doc.assigned_driver_id) : undefined,
    seatConfig:
      doc.seat_config && Array.isArray(doc.seat_config) ? doc.seat_config.map(String) : undefined,
  };
}

function toTripStop(doc: any): TripStop {
  return {
    id: doc.$id,
    tripId: String(doc.trip_id || ""),
    stopIndex: Number(doc.stop_index || 0),
    location: String(doc.location || ""),
    lat: Number(doc.lat || 0),
    lng: Number(doc.lng || 0),
    stopType: String(doc.stop_type || "pickup") as StopType,
    distanceFromOriginKm: Number(doc.distance_from_origin_km || 0),
  };
}

function toBooking(doc: any): Booking {
  return {
    id: doc.$id,
    tripId: String(doc.trip_id || ""),
    travelerId: String(doc.traveler_id || ""),
    fromStopIndex: Number(doc.from_stop_index || 0),
    toStopIndex: Number(doc.to_stop_index || 0),
    seatsBooked: Number(doc.seats_booked || 0),
    segmentPrice: Number(doc.segment_price || 0),
    passengerName: String(doc.passenger_name || ""),
    passengerPhone: String(doc.passenger_phone || ""),
    status: String(doc.status || "pending") as BookingStatus,
    createdAt: String(doc.created_at ?? doc.$createdAt),
    ratingByHost: doc.rating_by_host ? Number(doc.rating_by_host) : undefined,
    commentByHost: doc.comment_by_host ? String(doc.comment_by_host) : undefined,
  };
}

function toPricingRule(doc: any): PricingRule {
  return {
    id: doc.$id,
    minPricePerKm: Number(doc.min_price_per_km || 0),
    maxPricePerKm: Number(doc.max_price_per_km || 0),
    routeMatchToleranceKm: Number(doc.route_match_tolerance_km || 0),
    updatedAt: String(doc.updated_at ?? doc.$updatedAt),
  };
}

function toDriverProfile(doc: any): DriverProfile {
  return {
    id: doc.$id,
    userId: String(doc.user_id || ""),
    fullName: String(doc.full_name || ""),
    email: String(doc.email || ""),
    phone: String(doc.phone || ""),
    licenseNumber: String(doc.license_number || ""),
    city: String(doc.city || ""),
  };
}

function toTripSeatReservation(doc: any): TripSeatReservation {
  return {
    id: doc.$id,
    tripId: String(doc.trip_id || ""),
    seatCode: String(doc.seat_code || ""),
    bookingId: String(doc.booking_id || ""),
  };
}

function toDriverVehicle(doc: any): DriverVehicle {
  return {
    id: doc.$id,
    driverUserId: String(doc.driver_user_id || ""),
    modelName: String(doc.model_name || ""),
    plateNumber: String(doc.plate_number || ""),
    seatCapacity: Number(doc.seat_capacity || 1),
    color: doc.color ? String(doc.color) : null,
    registrationDoc: doc.registration_doc ? String(doc.registration_doc) : null,
    insuranceDoc: doc.insurance_doc ? String(doc.insurance_doc) : null,
    carImages: doc.car_images && Array.isArray(doc.car_images) ? doc.car_images.map(String) : [],
  };
}

export interface CreateTripInput {
  hostId: string;
  fromLocation: string;
  fromLat: number;
  fromLng: number;
  toLocation: string;
  toLat: number;
  toLng: number;
  polyline: string;
  totalDistanceKm: number;
  totalPrice: number;
  pricePerKm: number;
  totalSeats: number;
  departureAt: string;
  notes?: string | null;
  status?: TripStatus;
  vehicleId?: string;
  assignedDriverId?: string;
  seatConfig?: string[];
}

export interface CreateTripStopInput {
  tripId: string;
  stopIndex: number;
  location: string;
  lat: number;
  lng: number;
  stopType: StopType;
  distanceFromOriginKm: number;
}

export interface CreateBookingInput {
  tripId: string;
  travelerId: string;
  fromStopIndex: number;
  toStopIndex: number;
  seatsBooked: number;
  segmentPrice: number;
  passengerName: string;
  passengerPhone: string;
  status?: BookingStatus;
}

export interface CreateDriverProfileInput {
  userId: string;
  fullName: string;
  email: string;
  phone: string;
  licenseNumber: string;
  city: string;
}

export interface CreateDriverVehicleInput {
  driverUserId: string;
  modelName: string;
  plateNumber: string;
  seatCapacity: number;
  color?: string;
  registrationDoc?: string;
  insuranceDoc?: string;
  carImages?: string[];
}

function ids() {
  return getCollectionIds();
}

export async function listTrips(limit = 20): Promise<Trip[]> {
  const c = ids();
  const result = await databases.listDocuments(appwriteConfig.databaseId, c.trips, [
    Query.orderAsc("departure_at"),
    Query.limit(limit),
  ]);
  return result.documents.map(toTrip);
}

export async function getTripById(tripId: string): Promise<Trip> {
  const c = ids();
  const doc = await databases.getDocument(appwriteConfig.databaseId, c.trips, tripId);
  return toTrip(doc);
}

export async function listTripStops(tripId: string): Promise<TripStop[]> {
  const c = ids();
  const result = await databases.listDocuments(appwriteConfig.databaseId, c.tripStops, [
    Query.equal("trip_id", tripId),
    Query.orderAsc("stop_index"),
    Query.limit(100),
  ]);
  return result.documents.map(toTripStop);
}

export async function listHostTrips(hostId: string): Promise<Trip[]> {
  const c = ids();
  const result = await databases.listDocuments(appwriteConfig.databaseId, c.trips, [
    Query.equal("host_id", hostId),
    Query.orderAsc("departure_at"),
    Query.limit(100),
  ]);
  return result.documents.map(toTrip);
}

export async function createTrip(input: CreateTripInput): Promise<Trip> {
  const c = ids();

  const doc = await databases.createDocument(
    appwriteConfig.databaseId,
    c.trips,
    ID.unique(),
    {
      host_id: input.hostId,
      from_location: input.fromLocation,
      from_lat: input.fromLat,
      from_lng: input.fromLng,
      to_location: input.toLocation,
      to_lat: input.toLat,
      to_lng: input.toLng,
      polyline: input.polyline,
      total_distance_km: input.totalDistanceKm,
      total_price: input.totalPrice,
      price_per_km: input.pricePerKm,
      total_seats: input.totalSeats,
      departure_at: input.departureAt,
      status: input.status ?? "scheduled",
      notes: input.notes ?? null,
      vehicle_id: input.vehicleId ?? null,
      assigned_driver_id: input.assignedDriverId ?? null,
      seat_config: input.seatConfig ?? [],
    },
    [
      // Public read so travelers can search trips without an Appwrite session (e.g. homepage modal).
      Permission.read(Role.any()),
      Permission.update(Role.user(input.hostId)),
      Permission.delete(Role.user(input.hostId)),
    ],
  );
  return toTrip(doc);
}

export async function updateTrip(tripId: string, input: Partial<CreateTripInput>): Promise<Trip> {
  const c = ids();

  if (input.fromLocation || input.toLocation) {
  }

  const doc = await databases.updateDocument(appwriteConfig.databaseId, c.trips, tripId, {
    host_id: input.hostId,
    from_location: input.fromLocation,
    from_lat: input.fromLat,
    from_lng: input.fromLng,
    to_location: input.toLocation,
    to_lat: input.toLat,
    to_lng: input.toLng,
    polyline: input.polyline,
    total_distance_km: input.totalDistanceKm,
    total_price: input.totalPrice,
    price_per_km: input.pricePerKm,
    total_seats: input.totalSeats,
    departure_at: input.departureAt,
    status: input.status,
    notes: input.notes,
    vehicle_id: input.vehicleId,
    assigned_driver_id: input.assignedDriverId,
    seat_config: input.seatConfig,
  });
  return toTrip(doc);
}

export async function deleteTrip(tripId: string): Promise<void> {
  const c = ids();
  await databases.deleteDocument(appwriteConfig.databaseId, c.trips, tripId);
}

export async function deleteTripStop(stopId: string): Promise<void> {
  const c = ids();
  await databases.deleteDocument(appwriteConfig.databaseId, c.tripStops, stopId);
}

export async function createTripStop(input: CreateTripStopInput): Promise<TripStop> {
  const c = ids();
  const doc = await databases.createDocument(
    appwriteConfig.databaseId,
    c.tripStops,
    ID.unique(),
    {
      trip_id: input.tripId,
      stop_index: input.stopIndex,
      location: input.location,
      lat: input.lat,
      lng: input.lng,
      stop_type: input.stopType,
      distance_from_origin_km: input.distanceFromOriginKm,
    },
    [
      Permission.read(Role.any()),
      Permission.update(Role.any()), // Adjust if you want only the host to update
      Permission.delete(Role.any()), // Adjust if you want only the host to delete
    ],
  );
  return toTripStop(doc);
}

export async function listTravelerBookings(travelerId: string): Promise<Booking[]> {
  const c = ids();
  const result = await databases.listDocuments(appwriteConfig.databaseId, c.bookings, [
    Query.equal("traveler_id", travelerId),
    Query.orderDesc("$createdAt"),
    Query.limit(100),
  ]);
  return result.documents.map(toBooking);
}

export async function createBooking(
  input: CreateBookingInput & { hostIdForPermissions?: string },
): Promise<Booking> {
  const c = ids();

  const doc = await databases.createDocument(appwriteConfig.databaseId, c.bookings, ID.unique(), {
    trip_id: input.tripId,
    traveler_id: input.travelerId,
    from_stop_index: input.fromStopIndex,
    to_stop_index: input.toStopIndex,
    seats_booked: input.seatsBooked,
    segment_price: input.segmentPrice,
    passenger_name: input.passengerName,
    passenger_phone: input.passengerPhone,
    status: input.status ?? "pending",
  });
  return toBooking(doc);
}

export async function deleteBooking(bookingId: string): Promise<void> {
  const c = ids();
  await databases.deleteDocument(appwriteConfig.databaseId, c.bookings, bookingId);
}

/** Stable doc id for optimistic locking (one reservation per trip + seat code). */
export function tripSeatReservationDocumentId(tripId: string, seatCode: string): string {
  const slug = seatCode.replace(/[^a-zA-Z0-9]/g, "_");
  const joined = `${tripId}_${slug}`;
  if (joined.length <= 36) return joined;
  return `${tripId.slice(-14)}_${slug}`.slice(0, 36);
}

export async function getVehicleByDriverUserId(
  driverUserId: string,
): Promise<DriverVehicle | null> {
  const c = ids();
  const result = await databases.listDocuments(appwriteConfig.databaseId, c.vehicles, [
    Query.equal("driver_user_id", driverUserId),
    Query.limit(1),
  ]);
  const doc = result.documents[0];
  return doc ? toDriverVehicle(doc) : null;
}

export async function listVehiclesByDriverUserId(driverUserId: string): Promise<DriverVehicle[]> {
  const c = ids();
  const result = await databases.listDocuments(appwriteConfig.databaseId, c.vehicles, [
    Query.equal("driver_user_id", driverUserId),
    Query.orderDesc("$createdAt"),
    Query.limit(50),
  ]);
  return result.documents.map(toDriverVehicle);
}

export async function deleteDriverVehicle(vehicleId: string): Promise<void> {
  const c = ids();
  await databases.deleteDocument(appwriteConfig.databaseId, c.vehicles, vehicleId);
}

export async function createDriverVehicle(input: CreateDriverVehicleInput): Promise<DriverVehicle> {
  const c = ids();
  const doc = await databases.createDocument(appwriteConfig.databaseId, c.vehicles, ID.unique(), {
    driver_user_id: input.driverUserId,
    model_name: input.modelName,
    plate_number: input.plateNumber,
    seat_capacity: input.seatCapacity,
    color: input.color ?? null,
    registration_doc: input.registrationDoc ?? null,
    insurance_doc: input.insuranceDoc ?? null,
    car_images: input.carImages ?? [],
  });
  return toDriverVehicle(doc);
}

// ── Team Drivers (sub-drivers added by the ride host) ──
// Stored in the same drivers collection.
// NOTE: Requires an `owner_user_id` attribute (string, optional) in the Appwrite `drivers` collection.

function toDriverProfileWithOwner(doc: Models.Document): DriverProfile {
  return {
    id: doc.$id,
    userId: String(doc.user_id),
    fullName: String(doc.full_name),
    email: String(doc.email),
    phone: String(doc.phone),
    licenseNumber: String(doc.license_number),
    city: String(doc.city),
    ownerUserId: doc.owner_user_id ? String(doc.owner_user_id) : undefined,
  };
}

export async function listTeamDrivers(ownerUserId: string): Promise<DriverProfile[]> {
  const c = ids();
  const result = await databases.listDocuments(appwriteConfig.databaseId, c.drivers, [
    Query.equal("owner_user_id", ownerUserId),
    Query.orderDesc("$createdAt"),
    Query.limit(100),
  ]);
  return result.documents.map(toDriverProfileWithOwner);
}

export interface CreateTeamDriverInput {
  ownerUserId: string;
  fullName: string;
  email: string;
  phone: string;
  licenseNumber: string;
  city: string;
}

export async function createTeamDriver(input: CreateTeamDriverInput): Promise<DriverProfile> {
  const c = ids();
  const doc = await databases.createDocument(appwriteConfig.databaseId, c.drivers, ID.unique(), {
    user_id: `team_${ID.unique()}`,
    owner_user_id: input.ownerUserId,
    full_name: input.fullName,
    email: input.email,
    phone: input.phone,
    license_number: input.licenseNumber,
    city: input.city,
  });
  return toDriverProfileWithOwner(doc);
}

export async function updateTeamDriver(
  driverProfileId: string,
  input: Omit<CreateTeamDriverInput, "ownerUserId">,
): Promise<DriverProfile> {
  const c = ids();
  const doc = await databases.updateDocument(
    appwriteConfig.databaseId,
    c.drivers,
    driverProfileId,
    {
      full_name: input.fullName,
      email: input.email,
      phone: input.phone,
      license_number: input.licenseNumber,
      city: input.city,
    },
  );
  return toDriverProfileWithOwner(doc);
}

export async function deleteTeamDriver(driverProfileId: string): Promise<void> {
  const c = ids();
  await databases.deleteDocument(appwriteConfig.databaseId, c.drivers, driverProfileId);
}

export async function listTripSeatReservations(tripId: string): Promise<TripSeatReservation[]> {
  const c = ids();
  const result = await databases.listDocuments(appwriteConfig.databaseId, c.tripSeatReservations, [
    Query.equal("trip_id", tripId),
    Query.limit(100),
  ]);
  return result.documents.map(toTripSeatReservation);
}

async function createTripSeatReservation(input: {
  tripId: string;
  bookingId: string;
  seatCode: string;
  travelerId: string;
  hostId: string;
}): Promise<TripSeatReservation> {
  const c = ids();
  const docId = tripSeatReservationDocumentId(input.tripId, input.seatCode);
  const doc = await databases.createDocument(
    appwriteConfig.databaseId,
    c.tripSeatReservations,
    docId,
    {
      trip_id: input.tripId,
      seat_code: input.seatCode,
      booking_id: input.bookingId,
    },
  );
  return toTripSeatReservation(doc);
}

async function deleteTripSeatReservation(documentId: string): Promise<void> {
  const c = ids();
  await databases.deleteDocument(appwriteConfig.databaseId, c.tripSeatReservations, documentId);
}

export async function createBookingWithSeatReservations(
  input: CreateBookingInput & { seatCodes: string[]; hostId: string },
): Promise<Booking> {
  const occupied = new Set((await listTripSeatReservations(input.tripId)).map((r) => r.seatCode));
  for (const code of input.seatCodes) {
    if (occupied.has(code)) {
      throw new Error(`Seat ${code} is no longer available. Refresh and try again.`);
    }
  }

  const booking = await createBooking({ ...input, hostIdForPermissions: input.hostId });
  const createdIds: string[] = [];

  try {
    for (const seatCode of input.seatCodes) {
      await createTripSeatReservation({
        tripId: input.tripId,
        bookingId: booking.id,
        seatCode,
        travelerId: input.travelerId,
        hostId: input.hostId,
      });
      createdIds.push(tripSeatReservationDocumentId(input.tripId, seatCode));
    }
    return booking;
  } catch (error) {
    for (const id of createdIds) {
      try {
        await deleteTripSeatReservation(id);
      } catch {
        /* ignore */
      }
    }
    try {
      await deleteBooking(booking.id);
    } catch {
      /* ignore */
    }
    throw error;
  }
}

export async function listTripBookings(tripId: string): Promise<Booking[]> {
  const c = ids();
  const result = await databases.listDocuments(appwriteConfig.databaseId, c.bookings, [
    Query.equal("trip_id", tripId),
    Query.orderDesc("$createdAt"),
    Query.limit(100),
  ]);
  return result.documents.map(toBooking);
}

export async function listHostBookings(hostId: string): Promise<Booking[]> {
  const c = ids();
  // First get all trip IDs for this host
  const trips = await databases.listDocuments(appwriteConfig.databaseId, c.trips, [
    Query.equal("host_id", hostId),
    Query.limit(100),
  ]);
  const tripIds = trips.documents.map((t) => t.$id);

  if (tripIds.length === 0) return [];

  const result = await databases.listDocuments(appwriteConfig.databaseId, c.bookings, [
    Query.equal("trip_id", tripIds),
    Query.orderDesc("$createdAt"),
    Query.limit(100),
  ]);
  return result.documents.map(toBooking);
}

export async function updateBookingRating(
  bookingId: string,
  rating: number,
  comment?: string,
): Promise<void> {
  const c = ids();
  await databases.updateDocument(appwriteConfig.databaseId, c.bookings, bookingId, {
    rating_by_host: rating,
    comment_by_host: comment ?? null,
  });
}

export async function getPricingRule(): Promise<PricingRule | null> {
  const c = ids();
  const result = await databases.listDocuments(appwriteConfig.databaseId, c.pricingRules, [
    Query.limit(1),
  ]);
  return result.documents[0] ? toPricingRule(result.documents[0]) : null;
}

export async function listUserRoles(userId: string): Promise<AppRole[]> {
  const c = ids();
  const result = await databases.listDocuments(appwriteConfig.databaseId, c.userRoles, [
    Query.equal("user_id", userId),
    Query.limit(10),
  ]);
  return result.documents
    .map((doc) => String(doc.role))
    .filter((role): role is AppRole => ["admin", "driver", "user"].includes(role));
}

export async function assignRole(userId: string, role: AppRole): Promise<void> {
  const c = ids();
  const existing = await databases.listDocuments(appwriteConfig.databaseId, c.userRoles, [
    Query.equal("user_id", userId),
    Query.equal("role", role),
    Query.limit(1),
  ]);
  if (existing.total > 0) return;
  await databases.createDocument(appwriteConfig.databaseId, c.userRoles, ID.unique(), {
    user_id: userId,
    role,
  });
}

export async function upsertDriverProfile(input: CreateDriverProfileInput): Promise<DriverProfile> {
  const c = ids();
  const existing = await databases.listDocuments(appwriteConfig.databaseId, c.drivers, [
    Query.equal("user_id", input.userId),
    Query.limit(1),
  ]);

  if (existing.total > 0) {
    const updated = await databases.updateDocument(
      appwriteConfig.databaseId,
      c.drivers,
      existing.documents[0].$id,
      {
        full_name: input.fullName,
        email: input.email,
        phone: input.phone,
        license_number: input.licenseNumber,
        city: input.city,
      },
    );
    return toDriverProfile(updated);
  }

  const created = await databases.createDocument(
    appwriteConfig.databaseId,
    c.drivers,
    ID.unique(),
    {
      user_id: input.userId,
      full_name: input.fullName,
      email: input.email,
      phone: input.phone,
      license_number: input.licenseNumber,
      city: input.city,
    },
  );
  return toDriverProfile(created);
}

export async function upsertDriverVehicle(input: CreateDriverVehicleInput): Promise<DriverVehicle> {
  const c = ids();
  const existing = await databases.listDocuments(appwriteConfig.databaseId, c.vehicles, [
    Query.equal("driver_user_id", input.driverUserId),
    Query.limit(1),
  ]);

  const payload = {
    driver_user_id: input.driverUserId,
    model_name: input.modelName,
    plate_number: input.plateNumber,
    seat_capacity: input.seatCapacity,
    color: input.color ?? null,
    registration_doc: input.registrationDoc ?? null,
    insurance_doc: input.insuranceDoc ?? null,
    car_images: input.carImages ?? [],
  };

  if (existing.total > 0) {
    const updated = await databases.updateDocument(
      appwriteConfig.databaseId,
      c.vehicles,
      existing.documents[0].$id,
      payload,
    );
    return toDriverVehicle(updated);
  }

  const created = await databases.createDocument(
    appwriteConfig.databaseId,
    c.vehicles,
    ID.unique(),
    payload,
  );
  return toDriverVehicle(created);
}

export async function listDriverProfiles(): Promise<DriverProfile[]> {
  const c = ids();
  const result = await databases.listDocuments(appwriteConfig.databaseId, c.drivers, [
    Query.orderDesc("$createdAt"),
    Query.limit(200),
  ]);
  return result.documents.map(toDriverProfile);
}

export async function listActiveTrips(limit = 200): Promise<Trip[]> {
  const c = ids();
  const result = await databases.listDocuments(appwriteConfig.databaseId, c.trips, [
    Query.equal("status", ["scheduled", "in_progress"]),
    Query.orderAsc("departure_at"),
    Query.limit(limit),
  ]);
  return result.documents.map(toTrip);
}

function toHeroBanner(doc: any): HeroBanner {
  const imageId = String(doc.imageId || "");
  let imageUrl = doc.imageUrl ? String(doc.imageUrl) : null;

  if (!imageUrl && imageId) {
    imageUrl = getBannerImageUrl(imageId);
  }

  return {
    id: doc.$id,
    title: doc.title ? String(doc.title) : null,
    imageId,
    imageUrl,
    linkUrl: doc.linkUrl ? String(doc.linkUrl) : null,
    startDate: doc.startDate ? String(doc.startDate) : null,
    endDate: doc.endDate ? String(doc.endDate) : null,
    isActive: Boolean(doc.isActive),
    sortOrder: Number(doc.sortOrder || 0),
  };
}

export async function listHeroBanners(includeInactive = false): Promise<HeroBanner[]> {
  const c = ids();
  const queries = [Query.orderAsc("sortOrder")];
  if (!includeInactive) {
    queries.push(Query.equal("isActive", true));
  }
  const result = await databases.listDocuments(appwriteConfig.databaseId, c.heroBanners, queries);
  return result.documents.map(toHeroBanner);
}

export async function createHeroBanner(input: Omit<HeroBanner, "id">): Promise<HeroBanner> {
  const c = ids();
  const doc = await databases.createDocument(
    appwriteConfig.databaseId,
    c.heroBanners,
    ID.unique(),
    {
      title: input.title ?? null,
      imageId: input.imageId,
      imageUrl: input.imageUrl ?? null,
      linkUrl: input.linkUrl ?? null,
      startDate: input.startDate ?? null,
      endDate: input.endDate ?? null,
      isActive: input.isActive,
      sortOrder: input.sortOrder,
    },
    [Permission.read(Role.any()), Permission.update(Role.any()), Permission.delete(Role.any())],
  );
  return toHeroBanner(doc);
}

export async function updateHeroBanner(
  id: string,
  input: Partial<Omit<HeroBanner, "id">>,
): Promise<HeroBanner> {
  const c = ids();
  const doc = await databases.updateDocument(appwriteConfig.databaseId, c.heroBanners, id, {
    title: input.title,
    imageId: input.imageId,
    imageUrl: input.imageUrl,
    linkUrl: input.linkUrl,
    startDate: input.startDate,
    endDate: input.endDate,
    isActive: input.isActive,
    sortOrder: input.sortOrder,
  });
  return toHeroBanner(doc);
}

export async function deleteHeroBanner(id: string): Promise<void> {
  const c = ids();
  await databases.deleteDocument(appwriteConfig.databaseId, c.heroBanners, id);
}

export async function uploadBannerImage(file: File): Promise<string> {
  const result = await storage.createFile(appwriteConfig.bannersBucketId, ID.unique(), file, [
    Permission.read(Role.any()),
    Permission.update(Role.users()),
    Permission.delete(Role.users()),
  ]);
  return result.$id;
}

export function getBannerImageUrl(imageId: string): string {
  const { endpoint, projectId, bannersBucketId } = appwriteConfig;
  return `${endpoint}/storage/buckets/${bannersBucketId}/files/${imageId}/view?project=${projectId}`;
}
