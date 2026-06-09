import { ID, Permission, Query, Role, type Models } from "appwrite";
import { databases, storage, appwriteConfig } from "@/integrations/appwrite/client";
import { getCollectionIds } from "@/integrations/appwrite/schema";
import { routeCitySegmentsMatch } from "@/lib/geo";
import type {
  AppRole,
  Booking,
  BookingStatus,
  DriverProfile,
  DriverVehicle,
  HeroBanner,
  MusicType,
  PricingRule,
  RidePreferences,
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
    arrivalAt: doc.arrival_at ? String(doc.arrival_at) : undefined,
    durationMinutes: Number(doc.duration_minutes || 0) || undefined,
    hostDisplayName: doc.host_display_name ? String(doc.host_display_name) : undefined,
    hostRating: Number(doc.host_rating || 0),
    hostRatingCount: Number(doc.host_rating_count || 0),
    vehicleModel: doc.vehicle_model ? String(doc.vehicle_model) : undefined,
    vehicleColor: doc.vehicle_color ? String(doc.vehicle_color) : undefined,
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
    otp: doc.otp ? String(doc.otp) : undefined,
    verified: doc.verified === true || doc.verified === "true",
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
    smokingAllowed: Boolean(doc.smoking_allowed ?? false),
    alcoholAllowed: Boolean(doc.alcohol_allowed ?? false),
    musicAllowed: Boolean(doc.music_allowed ?? false),
    musicType: doc.music_type ? String(doc.music_type) : null,
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
  arrivalAt?: string;
  durationMinutes?: number;
  hostDisplayName?: string;
  hostRating?: number;
  hostRatingCount?: number;
  vehicleModel?: string;
  vehicleColor?: string;
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
      arrival_at: input.arrivalAt ?? null,
      duration_minutes: input.durationMinutes ?? 0,
      host_display_name: input.hostDisplayName ?? null,
      host_rating: input.hostRating ?? 0,
      host_rating_count: input.hostRatingCount ?? 0,
      vehicle_model: input.vehicleModel ?? null,
      vehicle_color: input.vehicleColor ?? null,
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
    arrival_at: input.arrivalAt,
    duration_minutes: input.durationMinutes,
    host_display_name: input.hostDisplayName,
    host_rating: input.hostRating,
    host_rating_count: input.hostRatingCount,
    vehicle_model: input.vehicleModel,
    vehicle_color: input.vehicleColor,
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

function generateBookingOtp(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

export async function createBooking(
  input: CreateBookingInput & { hostIdForPermissions?: string },
): Promise<Booking> {
  const c = ids();

  const payload: Record<string, unknown> = {
    trip_id: input.tripId,
    traveler_id: input.travelerId,
    from_stop_index: input.fromStopIndex,
    to_stop_index: input.toStopIndex,
    seats_booked: input.seatsBooked,
    segment_price: input.segmentPrice,
    passenger_name: input.passengerName,
    passenger_phone: input.passengerPhone,
    status: input.status ?? "pending",
    otp: generateBookingOtp(),
    verified: false,
  };

  let doc;
  try {
    doc = await databases.createDocument(
      appwriteConfig.databaseId,
      c.bookings,
      ID.unique(),
      payload,
    );
  } catch (err) {
    console.warn(
      "[createBooking] retry without otp/verified — add these attributes to the bookings collection to enable OTP verification.",
      err,
    );
    delete payload.otp;
    delete payload.verified;
    doc = await databases.createDocument(
      appwriteConfig.databaseId,
      c.bookings,
      ID.unique(),
      payload,
    );
  }
  return toBooking(doc);
}

export async function verifyBookingOtp(bookingId: string, otp: string): Promise<Booking> {
  const c = ids();
  const existing = await databases.getDocument(
    appwriteConfig.databaseId,
    c.bookings,
    bookingId,
  );
  const storedOtp = existing.otp ? String(existing.otp) : "";
  if (!storedOtp) {
    throw new Error("No OTP on file for this booking.");
  }
  if (storedOtp !== otp.trim()) {
    throw new Error("Incorrect OTP.");
  }
  const updated = await databases.updateDocument(
    appwriteConfig.databaseId,
    c.bookings,
    bookingId,
    { verified: true },
  );
  return toBooking(updated);
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

export async function listTripSeatReservationsByTripIds(
  tripIds: string[],
): Promise<TripSeatReservation[]> {
  const unique = [...new Set(tripIds.filter(Boolean))];
  if (unique.length === 0) return [];
  const c = ids();
  const result = await databases.listDocuments(appwriteConfig.databaseId, c.tripSeatReservations, [
    Query.equal("trip_id", unique),
    Query.limit(500),
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

/** Wipes all driver-specific data for a user:
 *  - removes the "driver" role row from user_roles
 *  - deletes their driver profile from drivers (matched by user_id or owner_user_id)
 *  - deletes any vehicles they own from vehicles
 *  Leaves trips/bookings intact (passengers may have active reservations) and
 *  does NOT delete the Appwrite account itself — the client SDK cannot delete
 *  arbitrary users, so the caller should still signOut after this. */
export async function deleteDriverAccount(userId: string): Promise<void> {
  const c = ids();
  // 1. driver role row(s)
  const roleDocs = await databases.listDocuments(appwriteConfig.databaseId, c.userRoles, [
    Query.equal("user_id", userId),
    Query.equal("role", "driver"),
    Query.limit(10),
  ]);
  await Promise.all(
    roleDocs.documents.map((d) =>
      databases.deleteDocument(appwriteConfig.databaseId, c.userRoles, d.$id),
    ),
  );

  // 2. vehicles owned by this driver
  const vehicleDocs = await databases.listDocuments(appwriteConfig.databaseId, c.vehicles, [
    Query.equal("driver_user_id", userId),
    Query.limit(100),
  ]);
  await Promise.all(
    vehicleDocs.documents.map((d) =>
      databases.deleteDocument(appwriteConfig.databaseId, c.vehicles, d.$id),
    ),
  );

  // 3. driver profile (collection uses user_id for primary host accounts and
  //    owner_user_id for team-member driver rows the host has added).
  const profileDocs = await databases.listDocuments(appwriteConfig.databaseId, c.drivers, [
    Query.or([Query.equal("user_id", userId), Query.equal("owner_user_id", userId)]),
    Query.limit(50),
  ]);
  await Promise.all(
    profileDocs.documents.map((d) =>
      databases.deleteDocument(appwriteConfig.databaseId, c.drivers, d.$id),
    ),
  );
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

/** Resolve host display info for a set of host user ids (used by trip cards). */
export async function listDriverProfilesByUserIds(
  userIds: string[],
): Promise<DriverProfile[]> {
  const unique = [...new Set(userIds.filter(Boolean))];
  if (unique.length === 0) return [];
  const c = ids();
  const result = await databases.listDocuments(appwriteConfig.databaseId, c.drivers, [
    Query.equal("user_id", unique),
    Query.limit(100),
  ]);
  return result.documents.map(toDriverProfile);
}

/** Get ride preferences for a single host by their user ID. */
export async function getHostPreferences(hostUserId: string): Promise<RidePreferences | null> {
  const c = ids();
  const result = await databases.listDocuments(appwriteConfig.databaseId, c.drivers, [
    Query.equal("user_id", hostUserId),
    Query.limit(1),
  ]);
  if (result.total === 0) return null;
  const doc = result.documents[0];
  return {
    smokingAllowed: Boolean(doc.smoking_allowed ?? false),
    alcoholAllowed: Boolean(doc.alcohol_allowed ?? false),
    musicAllowed: Boolean(doc.music_allowed ?? false),
    musicType: (doc.music_type as MusicType | null) ?? null,
  };
}

/** Save ride preferences for a host (looked up by user ID). */
export async function updateHostPreferences(
  hostUserId: string,
  prefs: RidePreferences,
): Promise<void> {
  const c = ids();
  const result = await databases.listDocuments(appwriteConfig.databaseId, c.drivers, [
    Query.equal("user_id", hostUserId),
    Query.limit(1),
  ]);
  if (result.total === 0) throw new Error("Driver profile not found");
  await databases.updateDocument(appwriteConfig.databaseId, c.drivers, result.documents[0].$id, {
    smoking_allowed: prefs.smokingAllowed,
    alcohol_allowed: prefs.alcoholAllowed,
    music_allowed: prefs.musicAllowed,
    music_type: prefs.musicAllowed ? (prefs.musicType ?? null) : null,
  });
}

/** Batch-fetch ride preferences for multiple host user IDs (for trip result cards). */
export async function getMultipleHostPreferences(
  hostUserIds: string[],
): Promise<Map<string, RidePreferences>> {
  const unique = [...new Set(hostUserIds.filter(Boolean))];
  if (unique.length === 0) return new Map();
  const c = ids();
  const result = await databases.listDocuments(appwriteConfig.databaseId, c.drivers, [
    Query.equal("user_id", unique),
    Query.limit(100),
  ]);
  const map = new Map<string, RidePreferences>();
  for (const doc of result.documents) {
    map.set(String(doc.user_id), {
      smokingAllowed: Boolean(doc.smoking_allowed ?? false),
      alcoholAllowed: Boolean(doc.alcohol_allowed ?? false),
      musicAllowed: Boolean(doc.music_allowed ?? false),
      musicType: (doc.music_type as MusicType | null) ?? null,
    });
  }
  return map;
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

export interface TrendingRoutesOptions {
  /** When set, only routes touching this city are considered. */
  city?: string | null;
  /** Max route cards to return (default 4). */
  limit?: number;
}

function tripRouteSegment(value: string): string {
  return value
    .toLowerCase()
    .split(",")[0]
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Trending routes for the home page. Valid trips only (status scheduled/in_progress,
 * departure not before today's calendar date — server-side filtered in Appwrite).
 * Groups remaining trips by `from -> to` city segment and returns the representative
 * (earliest upcoming) trip of each route that occurs more than once, ranked by
 * occurrence count. If no route repeats, falls back to the 3 earliest-created trips.
 */
export async function listTrendingRoutes(options?: TrendingRoutesOptions): Promise<Trip[]> {
  const c = ids();
  const maxCards = options?.limit ?? 4;

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const result = await databases.listDocuments(appwriteConfig.databaseId, c.trips, [
    Query.equal("status", ["scheduled", "in_progress"]),
    Query.greaterThanEqual("departure_at", startOfToday.toISOString()),
    Query.orderAsc("departure_at"),
    Query.limit(200),
  ]);

  let rows = result.documents.map((d) => ({
    trip: toTrip(d),
    createdAt: String(d.$createdAt ?? ""),
  }));

  const city = options?.city?.trim();
  if (city) {
    const cityKey = tripRouteSegment(city);
    rows = rows.filter(
      ({ trip }) =>
        routeCitySegmentsMatch(tripRouteSegment(trip.fromLocation), cityKey) ||
        routeCitySegmentsMatch(tripRouteSegment(trip.toLocation), cityKey),
    );
  }

  // rows are already ordered by departure_at asc, so the first trip seen for a
  // route key is its earliest upcoming representative.
  const groups = new Map<string, { representative: Trip; count: number }>();
  for (const { trip } of rows) {
    const key = `${tripRouteSegment(trip.fromLocation)}|${tripRouteSegment(trip.toLocation)}`;
    const existing = groups.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      groups.set(key, { representative: trip, count: 1 });
    }
  }

  const trending = [...groups.values()]
    .filter((g) => g.count > 1)
    .sort(
      (a, b) =>
        b.count - a.count ||
        new Date(a.representative.departureAt).getTime() -
          new Date(b.representative.departureAt).getTime(),
    )
    .slice(0, maxCards)
    .map((g) => g.representative);

  if (trending.length > 0) return trending;

  // Fallback: no route repeats — show the 3 earliest-created valid trips.
  return [...rows]
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .slice(0, 3)
    .map((r) => r.trip);
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
