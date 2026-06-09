export type AppRole = "admin" | "driver" | "user";
export type StopType = "pickup" | "drop" | "both";
export type TripStatus = "scheduled" | "in_progress" | "completed" | "cancelled";
export type BookingStatus = "pending" | "confirmed" | "cancelled" | "completed";

export interface PricingRule {
  id: string;
  minPricePerKm: number;
  maxPricePerKm: number;
  routeMatchToleranceKm: number;
  updatedAt: string;
}

export interface TripStop {
  id: string;
  tripId: string;
  stopIndex: number;
  location: string;
  lat: number;
  lng: number;
  stopType: StopType;
  distanceFromOriginKm: number;
}

export interface Trip {
  id: string;
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
  status: TripStatus;
  notes: string | null;
  vehicleId?: string;
  assignedDriverId?: string;
  seatConfig?: string[]; // e.g. ["front_p", "back_l", "back_c", "back_r"]
}

export interface Booking {
  id: string;
  tripId: string;
  travelerId: string;
  fromStopIndex: number;
  toStopIndex: number;
  seatsBooked: number;
  segmentPrice: number;
  passengerName: string;
  passengerPhone: string;
  status: BookingStatus;
  createdAt: string;
  ratingByHost?: number;
  commentByHost?: string;
  otp?: string;
  verified?: boolean;
}

export interface DriverProfile {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  phone: string;
  licenseNumber: string;
  city: string;
  ownerUserId?: string;
}

/** One claimed seat on a trip — stored without traveler PII for public seat maps */
export interface TripSeatReservation {
  id: string;
  tripId: string;
  seatCode: string;
  bookingId: string;
}

export interface DriverVehicle {
  id: string;
  driverUserId: string;
  modelName: string;
  plateNumber: string;
  seatCapacity: number;
  color: string | null;
  registrationDoc: string | null;
  insuranceDoc: string | null;
  carImages?: string[];
}

export interface HeroBanner {
  id: string;
  title: string | null;
  imageId: string;
  imageUrl: string | null;
  linkUrl: string | null;
  startDate: string | null;
  endDate: string | null;
  isActive: boolean;
  sortOrder: number;
}
