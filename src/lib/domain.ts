export type AppRole = "admin" | "driver" | "user";

export type ReviewDirection = "guest_to_host" | "host_to_guest";

export interface Review {
  id: string;
  tripId: string;
  bookingId: string;
  fromUserId: string;
  toUserId: string;
  direction: ReviewDirection;
  stars: number;
  tags: string[];
  createdAt: string;
}
export type StopType = "pickup" | "drop" | "both";
export type TripStatus = "scheduled" | "in_progress" | "completed" | "cancelled";
export type BookingStatus = "pending" | "confirmed" | "cancelled" | "completed" | "no_show";
export type PassengerGender = "male" | "female";
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
  /** Human-readable trip ID, e.g. "2606-CPTR-0001". Null on trips created before this existed. */
  tripCode?: string | null;
  status: TripStatus;
  notes: string | null;
  vehicleId?: string;
  assignedDriverId?: string;
  seatConfig?: string[]; // e.g. ["front_p", "back_l", "back_c", "back_r"]
  currentLat?: number;
  currentLng?: number;
  locationUpdatedAt?: string;
  /** Host can pause a trip (hidden from search) without cancelling it. */
  active?: boolean;
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
  passengers?: BookingPassenger[];
  status: BookingStatus;
  createdAt: string;
  ratingByHost?: number;
  commentByHost?: string;
  otp?: string;
  verified?: boolean;
}

export interface DeletedAccount {
  id: string;
  userId: string;
  fullName: string;
  phone: string;
  email: string;
  roles: string;
  deletedAt: string;
}

export interface TripShare {
  id: string;
  token: string;
  tripId: string;
  role: "host" | "guest";
  bookingId?: string;
  expiresAt?: string;
  revoked: boolean;
}

export interface BookingPassenger {
  seatCode: string;
  name: string;
  phone: string;
  gender?: PassengerGender;
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
  musicOnly: boolean;
  petsAllowed: boolean;
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
  /** Human-readable account ID, e.g. "2606cphm0001". Null on accounts created before this existed. */
  memberCode?: string | null;
  gender?: string | null;
  /** Short host bio shown on trip cards */
  bio?: string | null;
  /** Profile photo URL shown on trip cards and the booking page */
  photoUrl?: string | null;
  /** Ride comfort preferences set by the host */
  smokingAllowed?: boolean;
  alcoholAllowed?: boolean;
  musicAllowed?: boolean;
  musicType?: string | null;
  musicOnly?: boolean;
  petsAllowed?: boolean;
  verificationStatus?: VerificationStatus;
  verificationNote?: string | null;
  ratingAvg?: number;
  ratingCount?: number;
  /** Host can toggle a driver out of service without deleting them. */
  active?: boolean;
  /** Which ID document the host uploaded for identity verification. */
  idDocType?: "aadhar" | "license" | null;
  idFrontDoc?: string | null;
  idBackDoc?: string | null;
  selfieDoc?: string | null;
}

/** One claimed seat on a trip — stored without traveler PII for public seat maps */
export interface TripSeatReservation {
  id: string;
  tripId: string;
  seatCode: string;
  bookingId: string;
  gender?: PassengerGender;
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
  /** Host can toggle a vehicle out of service without deleting it. */
  active: boolean;
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
  /** Net amount the host receives — what they actually requested to withdraw. */
  amount: number;
  /** Gross amount this withdrawal is drawn from. Null on requests created before this was tracked. */
  grossAmount?: number | null;
  /** Platform's 5% commission on grossAmount (grossAmount - amount). Null on legacy requests. */
  platformFee?: number | null;
  status: PayoutStatus;
  requestedAt: string;
  processedAt?: string | null;
  paymentReference?: string | null;
  adminNote?: string | null;
  accountHolderName: string;
  accountNumber: string;
  ifscCode: string;
  upiId?: string | null;
  /** Set for per-trip payout requests. Null on legacy bulk requests. */
  tripId?: string | null;
  /** Snapshot of the trip route label, e.g. "Kochi → Bengaluru". */
  tripRoute?: string | null;
  /** Snapshot of the trip departure date (ISO string). */
  tripDate?: string | null;
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
