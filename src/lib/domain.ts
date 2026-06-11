export type AppRole = "admin" | "driver" | "user";
export type StopType = "pickup" | "drop" | "both";
export type TripStatus = "scheduled" | "in_progress" | "completed" | "cancelled";
export type BookingStatus = "pending" | "confirmed" | "cancelled" | "completed" | "no_show";
export type VerificationStatus = "pending" | "approved" | "rejected";
export type PayoutStatus = "pending" | "processing" | "paid" | "rejected";

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
  /** Cumulative price (per seat) from the trip's origin to this stop. 0 for the origin stop. */
  priceFromOrigin: number;
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
  currentLat?: number;
  currentLng?: number;
  locationUpdatedAt?: string;
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

export type MusicType =
  | "any"
  | "bollywood"
  | "regional"
  | "pop"
  | "classical"
  | "electronic"
  | "devotional";

export interface RidePreferences {
  smokingAllowed: boolean;
  alcoholAllowed: boolean;
  musicAllowed: boolean;
  musicType: MusicType | null;
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
  /** Short host bio shown on trip cards */
  bio?: string | null;
  /** Ride comfort preferences set by the host */
  smokingAllowed?: boolean;
  alcoholAllowed?: boolean;
  musicAllowed?: boolean;
  musicType?: string | null;
  verificationStatus?: VerificationStatus;
  verificationNote?: string | null;
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
  verificationStatus?: VerificationStatus;
  verificationNote?: string | null;
}

export interface BankAccount {
  id: string;
  driverUserId: string;
  accountHolderName: string;
  accountNumber: string;
  ifscCode: string;
  upiId?: string | null;
}

export interface PayoutRequest {
  id: string;
  driverUserId: string;
  amount: number;
  status: PayoutStatus;
  requestedAt: string;
  processedAt?: string | null;
  paymentReference?: string | null;
  adminNote?: string | null;
  accountHolderName: string;
  accountNumber: string;
  ifscCode: string;
  upiId?: string | null;
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
