import { ID, Permission, Query, Role, type Models } from "appwrite";
import { databases, appwriteConfig } from "@/integrations/appwrite/client";
import { getCollectionIds } from "@/integrations/appwrite/schema";
import type {
  AppRole,
  Booking,
  BookingStatus,
  DriverProfile,
  DriverVehicle,
  PricingRule,
  StopType,
  Trip,
  TripStatus,
  TripStop,
} from "@/lib/domain";

type Doc = Models.Document;

function toTrip(doc: Doc): Trip {
  return {
    id: doc.$id,
    hostId: String(doc.host_id),
    fromLocation: String(doc.from_location),
    fromLat: Number(doc.from_lat),
    fromLng: Number(doc.from_lng),
    toLocation: String(doc.to_location),
    toLat: Number(doc.to_lat),
    toLng: Number(doc.to_lng),
    polyline: String(doc.polyline),
    totalDistanceKm: Number(doc.total_distance_km),
    totalPrice: Number(doc.total_price),
    pricePerKm: Number(doc.price_per_km),
    totalSeats: Number(doc.total_seats),
    departureAt: String(doc.departure_at),
    status: String(doc.status) as TripStatus,
    notes: doc.notes ? String(doc.notes) : null,
  };
}

function toTripStop(doc: Doc): TripStop {
  return {
    id: doc.$id,
    tripId: String(doc.trip_id),
    stopIndex: Number(doc.stop_index),
    location: String(doc.location),
    lat: Number(doc.lat),
    lng: Number(doc.lng),
    stopType: String(doc.stop_type) as StopType,
    distanceFromOriginKm: Number(doc.distance_from_origin_km),
  };
}

function toBooking(doc: Doc): Booking {
  return {
    id: doc.$id,
    tripId: String(doc.trip_id),
    travelerId: String(doc.traveler_id),
    fromStopIndex: Number(doc.from_stop_index),
    toStopIndex: Number(doc.to_stop_index),
    seatsBooked: Number(doc.seats_booked),
    segmentPrice: Number(doc.segment_price),
    passengerName: String(doc.passenger_name),
    passengerPhone: String(doc.passenger_phone),
    status: String(doc.status) as BookingStatus,
    createdAt: String(doc.created_at ?? doc.$createdAt),
  };
}

function toPricingRule(doc: Doc): PricingRule {
  return {
    id: doc.$id,
    minPricePerKm: Number(doc.min_price_per_km),
    maxPricePerKm: Number(doc.max_price_per_km),
    routeMatchToleranceKm: Number(doc.route_match_tolerance_km),
    updatedAt: String(doc.updated_at ?? doc.$updatedAt),
  };
}

function toDriverProfile(doc: Doc): DriverProfile {
  return {
    id: doc.$id,
    userId: String(doc.user_id),
    fullName: String(doc.full_name),
    email: String(doc.email),
    phone: String(doc.phone),
    licenseNumber: String(doc.license_number),
    city: String(doc.city),
  };
}

function toDriverVehicle(doc: Doc): DriverVehicle {
  return {
    id: doc.$id,
    driverUserId: String(doc.driver_user_id),
    modelName: String(doc.model_name),
    plateNumber: String(doc.plate_number),
    seatCapacity: Number(doc.seat_capacity),
    color: doc.color ? String(doc.color) : null,
    registrationDoc: doc.registration_doc ? String(doc.registration_doc) : null,
    insuranceDoc: doc.insurance_doc ? String(doc.insurance_doc) : null,
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
    },
    [
      Permission.read(Role.users()),
      Permission.update(Role.user(input.hostId)),
      Permission.delete(Role.user(input.hostId)),
    ],
  );
  return toTrip(doc);
}

export async function createTripStop(input: CreateTripStopInput): Promise<TripStop> {
  const c = ids();
  const doc = await databases.createDocument(appwriteConfig.databaseId, c.tripStops, ID.unique(), {
    trip_id: input.tripId,
    stop_index: input.stopIndex,
    location: input.location,
    lat: input.lat,
    lng: input.lng,
    stop_type: input.stopType,
    distance_from_origin_km: input.distanceFromOriginKm,
  });
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

export async function createBooking(input: CreateBookingInput): Promise<Booking> {
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

export async function listTripBookings(tripId: string): Promise<Booking[]> {
  const c = ids();
  const result = await databases.listDocuments(appwriteConfig.databaseId, c.bookings, [
    Query.equal("trip_id", tripId),
    Query.orderDesc("$createdAt"),
    Query.limit(100),
  ]);
  return result.documents.map(toBooking);
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
