import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  LayoutDashboard,
  PlusCircle,
  Route as RouteIcon,
  Sparkles,
  LogOut,
  User,
  History,
  Settings,
  MoreVertical,
  Car,
  CheckCircle,
  CheckCircle2,
  XCircle,
  Banknote,
  Users2,
  Plus,
  Trash2,
  Pencil,
  Star,
  UserCheck,
  ArrowRight,
} from "lucide-react";
import {
  Layout,
  Menu,
  Button,
  Card,
  Typography,
  Space,
  Avatar,
  Badge,
  Form,
  Input,
  DatePicker,
  InputNumber,
  ConfigProvider,
  theme,
  List,
  Tag,
  Upload,
  Dropdown,
  Spin,
  AutoComplete,
  message,
  Drawer,
  Switch,
  Divider,
  Modal,
  Popconfirm,
  Select,
  Table,
} from "antd";
import type { UploadFile, UploadProps } from "antd";
import { useAuth } from "@/hooks/useAuth";
import {
  createTrip,
  listHostTrips,
  listVehiclesByDriverUserId,
  createDriverVehicle,
  deleteDriverVehicle,
  upsertDriverVehicle,
  listTeamDrivers,
  createTeamDriver,
  updateTeamDriver,
  deleteTeamDriver,
  deleteDriverAccount,
  updateBookingRating,
  updateTrip,
  deleteTrip,
  deleteTripStop,
  listTripStops,
  createTripStop,
  upsertDriverProfile,
  assignRole,
  listHostBookings,
  verifyBookingOtp,
  type CreateTeamDriverInput,
} from "@/data/appwrite-repository";
import { storage } from "@/integrations/appwrite/client";
import { ID } from "appwrite";
import type { Trip, TripStop, DriverProfile, Booking } from "@/lib/domain";
import { APP_FONT_FAMILY } from "@/lib/fonts";
import { calcPricePerKm } from "@/lib/pricing";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { appwriteConfig } from "@/integrations/appwrite/client";
import { SERVICE_CITY, BENGALURU_AIRPORTS, SOUTH_INDIA_CITY_SUGGESTIONS } from "@/lib/config";
import { SeatPicker, type SeatId } from "@/components/SeatPicker";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { getUserDisplayName } from "@/lib/user-display";

import logo from "@/assets/logo.png";

dayjs.extend(relativeTime);

const { Header, Content, Sider } = Layout;
const { Title, Text } = Typography;

interface CityOption {
  value: string;
  label: any;
  lat: number;
  lng: number;
  placeId?: string;
}

interface TripFormValues {
  fromLocation: string;
  toLocation: string;
  intermediateStops?: string[];
  departureAt: dayjs.Dayjs;
  totalSeats: number;
  totalTripPrice: number;
  vehicleId: string;
  driverId: string;
  seatConfig: SeatId[];
}

interface PlacePrediction {
  description: string;
  place_id: string;
}

interface GeocoderAddressResult {
  geometry?: {
    location?: {
      lat: () => number;
      lng: () => number;
    };
  };
}

interface DirectionsRequest {
  origin: { lat: number; lng: number };
  destination: { lat: number; lng: number };
  waypoints?: { location: { lat: number; lng: number }; stopover: boolean }[];
  travelMode: string;
}

interface DirectionsResult {
  routes: {
    overview_polyline: string;
    legs: {
      distance: { value: number; text: string };
      duration: { value: number; text: string };
    }[];
  }[];
}

interface DirectionsServiceLike {
  route: (
    request: DirectionsRequest,
    callback: (result: DirectionsResult | null, status: string) => void,
  ) => void;
}

interface SegmentPricePreview {
  from: string;
  to: string;
  distanceKm: number;
  pricePerSeat: number;
}

interface PlacesAutocompleteServiceLike {
  getPlacePredictions: (
    request: { input: string; types?: string[] },
    callback: (predictions: PlacePrediction[] | null, status: string) => void,
  ) => void;
}

interface GeocoderLike {
  geocode: (
    request: { placeId: string },
    callback: (results: GeocoderAddressResult[] | null, status: string) => void,
  ) => void;
}

const SOUTH_INDIA_STATES = [
  "karnataka",
  "kerala",
  "tamil nadu",
  "andhra pradesh",
  "telangana",
  "goa",
  "puducherry",
];

const DASHBOARD_MODULES = [
  "dashboard",
  "trips",
  "history",
  "drivers",
  "settings",
  "customers",
  "onboarding",
] as const;
type DashboardModule = (typeof DASHBOARD_MODULES)[number];

function normalizeModule(value: unknown): DashboardModule {
  return (DASHBOARD_MODULES as readonly string[]).includes(String(value))
    ? (value as DashboardModule)
    : "dashboard";
}

// Trips can only be scheduled within 7 days from today.
const TRIP_DATE_WINDOW_DAYS = 7;

function disabledTripDate(current: dayjs.Dayjs): boolean {
  if (!current) return false;
  const today = dayjs().startOf("day");
  const limit = dayjs().add(TRIP_DATE_WINDOW_DAYS, "day").startOf("day");
  return current.isBefore(today) || !current.isBefore(limit);
}

// When the selected day is today, forbid any hour/minute that is already in the
// past so a host can never publish a trip with a departure time before now.
function disabledTripTime(current: dayjs.Dayjs | null) {
  const now = dayjs();
  if (!current || !current.isSame(now, "day")) return {};
  const currentHour = now.hour();
  const currentMinute = now.minute();
  return {
    disabledHours: () => Array.from({ length: currentHour }, (_, i) => i),
    disabledMinutes: (selectedHour: number) => {
      if (selectedHour < currentHour) return Array.from({ length: 60 }, (_, i) => i);
      if (selectedHour === currentHour)
        return Array.from({ length: 60 }, (_, i) => i).filter((m) => m <= currentMinute);
      return [];
    },
  };
}

export const Route = createFileRoute("/driver/dashboard")({
  validateSearch: (search: Record<string, unknown>): { module: DashboardModule } => ({
    module: normalizeModule(search.module),
  }),
  head: () => ({
    meta: [
      { title: "Ride Host dashboard â€” Coolpool" },
      { name: "description", content: "Manage your rides and bookings as a Coolpool ride host." },
    ],
  }),
  component: DriverDashboardPage,
});

function DriverDashboardPage() {
  const { isDriver, user, signOut, loading, refreshRoles, roles } = useAuth();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const [activeModule, setActiveModule] = useState<DashboardModule>(search.module);
  const [form] = Form.useForm();
  const queryClient = useQueryClient();
  const [fromOptions, setFromOptions] = useState<CityOption[]>([]);
  const [toOptions, setToOptions] = useState<CityOption[]>([]);
  const [selectedFrom, setSelectedFrom] = useState<CityOption | null>(null);
  const [selectedTo, setSelectedTo] = useState<CityOption | null>(null);
  const [intermediateOptions, setIntermediateOptions] = useState<Record<number, CityOption[]>>({});
  const [selectedIntermediateStops, setSelectedIntermediateStops] = useState<
    Record<number, CityOption>
  >({});
  const [segmentPricePreview, setSegmentPricePreview] = useState<SegmentPricePreview[]>([]);
  const [pendingTripPayload, setPendingTripPayload] = useState<any | null>(null);
  const [mapsReady, setMapsReady] = useState(false);
  const [mobilePreviewOpen, setMobilePreviewOpen] = useState(false);
  const [vehicleForm] = Form.useForm();
  const [driverForm] = Form.useForm();
  const [historyFilter, setHistoryFilter] = useState<"all" | "completed" | "cancelled">("all");
  const [vehicleDrawerOpen, setVehicleDrawerOpen] = useState(false);
  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null);
  const [driverDrawerOpen, setDriverDrawerOpen] = useState(false);
  const [editingDriverId, setEditingDriverId] = useState<string | null>(null);
  const [editingTripId, setEditingTripId] = useState<string | null>(null);
  const [managingTripId, setManagingTripId] = useState<string | null>(null);
  const [isEditingTrip, setIsEditingTrip] = useState(false);
  const [ratingModalVisible, setRatingModalVisible] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [ratingValue, setRatingValue] = useState(5);
  const [ratingComment, setRatingComment] = useState("");
  const [publishTripsModalOpen, setPublishTripsModalOpen] = useState(false);
  const [publishModalView, setPublishModalView] = useState<"trips" | "form">("trips");
  const [showTripForm, setShowTripForm] = useState(false);
  const [tripPublishedSuccess, setTripPublishedSuccess] = useState(false);
  const [deleteAccountModalOpen, setDeleteAccountModalOpen] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [accountDeletedSuccess, setAccountDeletedSuccess] = useState(false);
  const [otpInputs, setOtpInputs] = useState<Record<string, string>>({});
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  const handleVerifyOtp = async (bookingId: string) => {
    const code = (otpInputs[bookingId] || "").trim();
    if (!/^\d{4}$/.test(code)) {
      message.error("Enter the 4-digit OTP.");
      return;
    }
    setVerifyingId(bookingId);
    try {
      await verifyBookingOtp(bookingId, code);
      message.success("Customer verified.");
      setOtpInputs((prev) => ({ ...prev, [bookingId]: "" }));
      void queryClient.invalidateQueries({ queryKey: ["host-bookings"] });
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Verification failed.");
    } finally {
      setVerifyingId(null);
    }
  };
  const handleDeleteAccount = async () => {
    if (!user?.$id) return;
    setDeletingAccount(true);
    try {
      await deleteDriverAccount(user.$id);
      setDeleteAccountModalOpen(false);
      setAccountDeletedSuccess(true);
      // Show the success animation for ~2.2s, then sign out + bounce home.
      setTimeout(async () => {
        await signOut();
        void navigate({ to: "/", replace: true });
      }, 2200);
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Failed to delete account.");
      setDeletingAccount(false);
    }
  };

  const autocompleteServiceRef = useRef<PlacesAutocompleteServiceLike | null>(null);
  const geocoderRef = useRef<GeocoderLike | null>(null);
  const directionsServiceRef = useRef<DirectionsServiceLike | null>(null);
  const seatsWatch = Form.useWatch("totalSeats", form);
  const totalPriceWatch = Form.useWatch("totalTripPrice", form);
  // Persist the active module in the URL so a page refresh restores it.
  useEffect(() => {
    if (search.module !== activeModule) {
      void navigate({
        search: (prev) => ({ ...prev, module: activeModule }),
        replace: true,
      });
    }
  }, [activeModule, search.module, navigate]);

  // Reflect URL changes (back/forward, direct link) back into state.
  useEffect(() => {
    if (search.module !== activeModule) {
      setActiveModule(search.module);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.module]);

  const [onboardingSubmitting, setOnboardingSubmitting] = useState(false);
  const [regFileList, setRegFileList] = useState<UploadFile[]>([]);
  const [insFileList, setInsFileList] = useState<UploadFile[]>([]);
  const [carImagesList, setCarImagesList] = useState<UploadFile[]>([]);

  const initGoogleServices = () => {
    const w = window as Window & {
      google?: {
        maps?: {
          places?: { AutocompleteService: new () => PlacesAutocompleteServiceLike };
          Geocoder?: new () => GeocoderLike;
          DirectionsService?: new () => DirectionsServiceLike;
        };
      };
    };
    const maps = w.google?.maps;
    if (!maps?.places?.AutocompleteService || !maps?.Geocoder || !maps?.DirectionsService)
      return false;
    autocompleteServiceRef.current = new maps.places.AutocompleteService();
    geocoderRef.current = new maps.Geocoder();
    directionsServiceRef.current = new maps.DirectionsService();
    setMapsReady(true);
    return true;
  };

  const { data: trips = [], isLoading: tripsLoading } = useQuery({
    queryKey: ["host-trips", user?.$id],
    queryFn: () => (user ? listHostTrips(user.$id) : Promise.resolve([])),
    enabled: !!user,
  });

  // Fleet: all vehicles for this user
  const { data: vehicles = [], isLoading: vehiclesLoading } = useQuery({
    queryKey: ["driver-vehicles", user?.$id],
    queryFn: () => (user ? listVehiclesByDriverUserId(user.$id) : Promise.resolve([])),
    enabled: !!user,
  });

  const { mutate: saveVehicle, isPending: savingVehicle } = useMutation({
    mutationFn: async (vals: { make: string; model: string; color: string; plate: string }) => {
      if (!user) throw new Error("Not logged in");

      const carImageIds: string[] = [];
      for (const file of carImagesList) {
        if (file.originFileObj) {
          const uploaded = await storage.createFile(
            appwriteConfig.driverDocsBucketId,
            ID.unique(),
            file.originFileObj as File,
          );
          carImageIds.push(uploaded.$id);
        } else if (file.url) {
          const parts = file.url.split("/");
          const id = parts[parts.indexOf("files") + 1];
          if (id) carImageIds.push(id);
        }
      }

      const payload = {
        driverUserId: user.$id,
        modelName: `${vals.make} ${vals.model}`.trim(),
        plateNumber: vals.plate,
        seatCapacity: 5,
        color: vals.color,
        carImages: carImageIds,
      };

      if (editingVehicleId) {
        return upsertDriverVehicle(payload);
      } else {
        return createDriverVehicle(payload);
      }
    },
    onSuccess: () => {
      message.success(editingVehicleId ? "Vehicle updated!" : "Vehicle added!");
      void queryClient.invalidateQueries({ queryKey: ["driver-vehicles"] });
      setVehicleDrawerOpen(false);
      vehicleForm.resetFields();
      setCarImagesList([]);
      setEditingVehicleId(null);
    },
    onError: (err: any) => message.error(err.message || "Failed to save vehicle."),
  });

  const { mutate: removeVehicle } = useMutation({
    mutationFn: (id: string) => deleteDriverVehicle(id),
    onSuccess: () => {
      message.success("Vehicle removed.");
      void queryClient.invalidateQueries({ queryKey: ["driver-vehicles"] });
    },
    onError: () => message.error("Failed to remove vehicle."),
  });

  // Team drivers
  const { data: teamDrivers = [], isLoading: driversLoading } = useQuery({
    queryKey: ["team-drivers", user?.$id],
    queryFn: () => (user ? listTeamDrivers(user.$id) : Promise.resolve([])),
    enabled: !!user,
  });

  const { data: bookings = [], isLoading: bookingsLoading } = useQuery({
    queryKey: ["host-bookings", user?.$id],
    queryFn: () => (user ? listHostBookings(user.$id) : Promise.resolve([])),
    enabled: !!user,
  });

  const { mutate: saveDriver, isPending: savingDriver } = useMutation({
    mutationFn: (vals: Omit<CreateTeamDriverInput, "ownerUserId">) =>
      user
        ? editingDriverId
          ? updateTeamDriver(editingDriverId, vals)
          : createTeamDriver({ ownerUserId: user.$id, ...vals })
        : Promise.reject(new Error("Not logged in")),
    onSuccess: () => {
      message.success(editingDriverId ? "Driver updated!" : "Driver added!");
      void queryClient.invalidateQueries({ queryKey: ["team-drivers"] });
      setDriverDrawerOpen(false);
      driverForm.resetFields();
      setEditingDriverId(null);
    },
    onError: () => message.error("Failed to save driver."),
  });

  const { mutate: removeDriver } = useMutation({
    mutationFn: (id: string) => deleteTeamDriver(id),
    onSuccess: () => {
      message.success("Driver removed.");
      void queryClient.invalidateQueries({ queryKey: ["team-drivers"] });
    },
    onError: () => message.error("Failed to remove driver."),
  });

  const { mutate: submitRating, isPending: submittingRating } = useMutation({
    mutationFn: (vals: { bookingId: string; rating: number; comment?: string }) =>
      updateBookingRating(vals.bookingId, vals.rating, vals.comment),
    onSuccess: () => {
      message.success("Rating submitted successfully!");
      setRatingModalVisible(false);
      void queryClient.invalidateQueries({ queryKey: ["host-bookings"] });
    },
    onError: () => message.error("Failed to submit rating."),
  });

  // Derived history stats from real trips
  const completedTrips = trips.filter((t) => t.status === "completed");
  const lifetimeEarnings = completedTrips.reduce((sum, t) => sum + (t.totalPrice ?? 0), 0);
  const filteredHistory =
    historyFilter === "all"
      ? trips
      : trips.filter((t) =>
        historyFilter === "completed" ? t.status === "completed" : t.status === "cancelled",
      );

  const upcomingTrips = trips.filter((t) => dayjs(t.departureAt).isAfter(dayjs()));

  const sortedTrips = trips
    .filter((t) => t.status !== "cancelled" && dayjs(t.departureAt).isAfter(dayjs()))
    .sort((a, b) => new Date(a.departureAt).getTime() - new Date(b.departureAt).getTime());

  const isVerifiedHost = vehicles.length > 0;

  const { mutate: performCreateTrip, isPending: creating } = useMutation({
    mutationFn: async (payload: any) => {
      let trip;
      if (editingTripId) {
        trip = await updateTrip(editingTripId, payload.tripData);
        // Remove old stops
        const oldStops = await listTripStops(editingTripId);
        for (const s of oldStops) {
          await deleteTripStop(s.id);
        }
      } else {
        trip = await createTrip(payload.tripData);
      }

      for (const stop of payload.stopsData) {
        await createTripStop({ ...stop, tripId: trip.id });
      }
      return trip;
    },
    onSuccess: (trip) => {
      if (import.meta.env.DEV) {
        console.log("[publish trip] Appwrite document saved:", {
          id: trip.id,
          fromLocation: trip.fromLocation,
          toLocation: trip.toLocation,
        });
      }
      if (editingTripId) {
        message.success("Trip updated.");
      } else {
        setTripPublishedSuccess(true);
        window.setTimeout(() => setTripPublishedSuccess(false), 2400);
      }
      form.resetFields();
      setEditingTripId(null);
      setIsEditingTrip(false);
      setSelectedFrom(null);
      setSelectedTo(null);
      setSelectedIntermediateStops({});
      setIntermediateOptions({});
      setSegmentPricePreview([]);
      setPendingTripPayload(null);
      void queryClient.invalidateQueries({ queryKey: ["host-trips"] });
      // Close the form but stay in the current module (don't redirect to dashboard).
      setShowTripForm(false);
      setPublishModalView("trips");
    },
    onError: (error) => {
      message.error(error instanceof Error ? error.message : "Unable to create trip.");
    },
  });

  useEffect(() => {
    if (initGoogleServices()) return;
    if (!appwriteConfig.googleMapsApiKey) {
      message.error("Google Maps API key is missing.");
      return;
    }

    const onScriptReady = () => {
      if (!initGoogleServices()) {
        message.error("Google Places loaded but services are unavailable. Check API restrictions.");
      }
    };

    const existingScript = document.querySelector(
      'script[data-google-maps="places"]',
    ) as HTMLScriptElement | null;
    if (existingScript) {
      // Script may already be present and loaded before this page mounts.
      if (existingScript.dataset.loaded === "true") {
        onScriptReady();
        return;
      }
      existingScript.addEventListener("load", onScriptReady, { once: true });
      existingScript.addEventListener(
        "error",
        () => message.error("Failed to load Google Maps script."),
        { once: true },
      );
      return;
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${appwriteConfig.googleMapsApiKey}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.dataset.googleMaps = "places";
    script.addEventListener(
      "load",
      () => {
        script.dataset.loaded = "true";
        onScriptReady();
      },
      { once: true },
    );
    script.addEventListener(
      "error",
      () => {
        message.error("Failed to load Google Maps script.");
      },
      { once: true },
    );
    document.head.appendChild(script);
  }, []);

  const onFinish = async (values: TripFormValues) => {
    if (!user) return;
    if (pendingTripPayload) {
      performCreateTrip(pendingTripPayload);
      return;
    }
    const normalizedFrom = values.fromLocation.trim();
    const normalizedTo = values.toLocation.trim();

    const resolvedFrom =
      selectedFrom && selectedFrom.value === normalizedFrom
        ? selectedFrom
        : { label: normalizedFrom, value: normalizedFrom, lat: 0, lng: 0 };
    const resolvedTo =
      selectedTo && selectedTo.value === normalizedTo
        ? selectedTo
        : { label: normalizedTo, value: normalizedTo, lat: 0, lng: 0 };

    const dirService = directionsServiceRef.current;
    if (!dirService) {
      message.error("Maps service not ready");
      return;
    }

    console.log("[Publish] Calculating route:", { resolvedFrom, resolvedTo });

    const getCoords = async (loc: { label: any; value: string; lat: number; lng: number }) => {
      if (loc.lat !== 0 || loc.lng !== 0) return loc;
      if (!geocoderRef.current) return loc;

      console.log("[Publish] Geocoding fallback for:", loc.value);
      return new Promise<{ label: any; value: string; lat: number; lng: number }>((resolve) => {
        geocoderRef.current!.geocode({ address: loc.value } as any, (results, status) => {
          if (status === "OK" && results?.[0]?.geometry?.location) {
            const pos = results[0].geometry.location;
            resolve({ ...loc, lat: pos.lat(), lng: pos.lng() });
          } else {
            console.warn("[Publish] Geocoding failed for:", loc.value, status);
            resolve(loc);
          }
        });
      });
    };

    const finalFrom = await getCoords(resolvedFrom);
    const finalTo = await getCoords(resolvedTo);
    const intermediateValues = (values.intermediateStops ?? [])
      .map((value) => value?.trim())
      .filter((value): value is string => Boolean(value));
    const finalIntermediateStops = await Promise.all(
      intermediateValues.map((value, index) => {
        const selected = selectedIntermediateStops[index];
        return getCoords(
          selected && selected.value === value
            ? selected
            : { label: value, value, lat: 0, lng: 0 },
        );
      }),
    );
    const allStops = [finalFrom, ...finalIntermediateStops, finalTo];

    if (allStops.some((stop) => stop.lat === 0 && stop.lng === 0)) {
      message.error(
        "Could not determine coordinates for one or more stops. Please select every location from the dropdown.",
      );
      return;
    }

    const handleRouteResult = (result: any) => {
        const route = result.routes[0];
        const polyline = route.overview_polyline;

        let currentDist = 0;
        const stopsData = allStops.map((stop, i) => {
          if (i > 0) {
            currentDist += route.legs[i - 1].distance.value / 1000; // converting meters to km
          }
          return {
            stopIndex: i,
            location: stop.value,
            lat: stop.lat,
            lng: stop.lng,
            stopType:
              i === 0
                ? ("pickup" as const)
                : i === allStops.length - 1
                  ? ("drop" as const)
                  : ("both" as const),
            distanceFromOriginKm: Math.round(currentDist * 10) / 10,
          };
        });

        const totalDistanceKm = Math.max(0.1, Math.round(currentDist * 10) / 10);
        const routeDurationSeconds = route.legs.reduce(
          (total: number, leg: { duration?: { value?: number } }) =>
            total + (leg.duration?.value ?? 0),
          0,
        );
        const durationMinutes = Math.max(
          1,
          routeDurationSeconds > 0
            ? Math.round(routeDurationSeconds / 60)
            : Math.round(totalDistanceKm),
        );
        const departureAt = values.departureAt.toISOString();
        const seatPrice = Number(values.totalTripPrice);
        const totalSeats = Number(values.totalSeats);
        const totalPrice = seatPrice * totalSeats;
        const selectedVehicle = vehicles.find((vehicle) => vehicle.id === values.vehicleId);
        setSegmentPricePreview(
          stopsData.flatMap((fromStop, fromIndex) =>
            stopsData.slice(fromIndex + 1).map((toStop) => {
              const distanceKm = Math.max(
                0,
                Math.round((toStop.distanceFromOriginKm - fromStop.distanceFromOriginKm) * 10) / 10,
              );
              return {
                from: fromStop.location,
                to: toStop.location,
                distanceKm,
                pricePerSeat: Math.round((distanceKm / totalDistanceKm) * seatPrice),
              };
            }),
          ),
        );

        const payload = {
          tripData: {
            hostId: user.$id,
            fromLocation: finalFrom.value,
            fromLat: finalFrom.lat,
            fromLng: finalFrom.lng,
            toLocation: finalTo.value,
            toLat: finalTo.lat,
            toLng: finalTo.lng,
            polyline,
            totalDistanceKm,
            totalPrice,
            pricePerKm: calcPricePerKm(totalPrice, totalDistanceKm),
            totalSeats,
            departureAt,
            arrivalAt: values.departureAt.add(durationMinutes, "minute").toISOString(),
            durationMinutes,
            hostDisplayName: user.name || "Verified Host",
            hostRating: 0,
            hostRatingCount: 0,
            vehicleModel: selectedVehicle?.modelName,
            vehicleColor: selectedVehicle?.color || undefined,
            notes: `Created from ride host trip module. Total price: ₹${totalPrice}.`,
            vehicleId: values.vehicleId,
            assignedDriverId: values.driverId,
            seatConfig: values.seatConfig,
          },
          stopsData,
        };

        if (import.meta.env.DEV) {
          console.log("[publish trip] createTrip payload (strings stored in DB):", {
            totalDistanceKm: payload.tripData.totalDistanceKm,
            totalPrice: payload.tripData.totalPrice,
            stopsData: payload.stopsData,
          });
        }

        setPendingTripPayload(payload);
        message.success("Route and segment prices calculated. Review them, then publish.");
    };

    try {
      const routeRequest = {
        origin: { lat: finalFrom.lat, lng: finalFrom.lng },
        destination: { lat: finalTo.lat, lng: finalTo.lng },
        waypoints: finalIntermediateStops.map((stop) => ({
          location: { lat: stop.lat, lng: stop.lng },
          stopover: true,
        })),
        travelMode: "DRIVING" as any,
      };
      const maybePromise: any = (dirService as any).route(routeRequest);
      if (maybePromise && typeof maybePromise.then === "function") {
        const result = await maybePromise;
        handleRouteResult(result);
      } else {
        await new Promise<void>((resolve) => {
          (dirService as any).route(routeRequest, (result: any, status: string) => {
            if (status !== "OK" || !result) {
              console.error("[Publish] Directions API failed:", status, result);
              message.error(`Route calculation failed: ${status}. Please check your stops.`);
              resolve();
              return;
            }
            handleRouteResult(result);
            resolve();
          });
        });
      }
    } catch (err) {
      console.error("[Publish] Directions API threw:", err);
      message.error("Route calculation failed. Please check your stops.");
    }
  };

  const setCityOptions = (target: "from" | "to" | number, options: CityOption[]) => {
    if (target === "from") setFromOptions(options);
    else if (target === "to") setToOptions(options);
    else setIntermediateOptions((current) => ({ ...current, [target]: options }));
  };

  const getLocalCityOptions = (query: string): CityOption[] => {
    const needle = query.trim().toLowerCase();
    if (needle.length < 2) return [];
    return SOUTH_INDIA_CITY_SUGGESTIONS.filter(
      (city) =>
        city.name.toLowerCase().includes(needle) || city.state.toLowerCase().includes(needle),
    )
      .slice(0, 8)
      .map((city) => ({
        value: `${city.name}, ${city.state}`,
        label: (
          <div className="flex items-center justify-between gap-3">
            <span className="font-medium">{city.name}</span>
            <span className="text-xs text-gray-400">{city.state}</span>
          </div>
        ),
        lat: city.lat,
        lng: city.lng,
      }));
  };

  const searchCities = async (query: string, target: "from" | "to" | number) => {
    if (target === "from") {
      console.log("[fromLocation] searchCities called", {
        query,
        queryLength: query?.length ?? 0,
        mapsReady,
        hasAutocompleteService: !!autocompleteServiceRef.current,
      });
    }
    if (!query || query.trim().length < 2) {
      setCityOptions(target, []);
      return;
    }
    const localOptions = getLocalCityOptions(query);
    setCityOptions(target, localOptions);

    const service = autocompleteServiceRef.current;
    if (!service) return;

    const searchQuery = query;

    service.getPlacePredictions(
      {
        input: searchQuery,
        types: ["geocode"],
        componentRestrictions: { country: "in" },
      } as any as any,
      (predictions, status) => {
        const lowerQuery = query.toLowerCase();
        const isAirportQuery =
          lowerQuery.includes("air") ||
          lowerQuery.includes("flight") ||
          lowerQuery.includes("terminal") ||
          lowerQuery.includes("blr") ||
          lowerQuery.includes("kempegowda") ||
          lowerQuery.includes("hal") ||
          lowerQuery.includes("jakkur");

        if (target === "from") {
          console.log("[fromLocation] getPlacePredictions callback", {
            status,
            predictionsCount: predictions?.length ?? 0,
            samplePrediction: predictions?.[0]?.description ?? null,
          });
        }

        if ((status !== "OK" || !predictions) && !isAirportQuery) {
          return;
        }

        const safePredictions = predictions || [];

        let filteredPredictions = safePredictions.filter((p) => {
          const desc = p.description.toLowerCase();
          return SOUTH_INDIA_STATES.some((state) => desc.includes(state)) || isAirportQuery;
        });

        if (filteredPredictions.length === 0 && safePredictions.length > 0 && !isAirportQuery) {
          if (localOptions.length > 0) return;
          const options = [
            { value: "", label: "ðŸš« Out of Service Area (South India & Goa only)", disabled: true },
          ];
          setCityOptions(target, options as any);
          return;
        }
        let options: any[] = filteredPredictions.map((prediction) => ({
          value: prediction.description,
          label: prediction.description,
          placeId: prediction.place_id,
          lat: 0,
          lng: 0,
        }));

        if (isAirportQuery) {
          const airportOptions = BENGALURU_AIRPORTS.map((a) => ({
            value: `${a.name}, ${SERVICE_CITY}`,
            label: (
              <div className="flex items-center gap-2">
                <span>âœˆï¸</span>
                <span className="font-medium text-gray-900">
                  {a.name} <span className="text-gray-400 font-normal">({a.code})</span>
                </span>
              </div>
            ),
            placeId: undefined, // Let geocoder handle it on selection
            lat: a.lat,
            lng: a.lng,
          }));

          [...airportOptions].reverse().forEach((ao) => {
            if (!options.find((o) => o.value === ao.value)) {
              options.unshift(ao);
            }
          });
        }

        const mergedOptions = [...localOptions, ...options].filter(
          (option, index, all) => all.findIndex((candidate) => candidate.value === option.value) === index,
        );
        setCityOptions(target, mergedOptions as any);
      },
    );
  };

  const onSelectCity = (value: string, target: "from" | "to" | number) => {
    let sourceOptions: CityOption[] = [];
    if (target === "from") sourceOptions = fromOptions;
    else if (target === "to") sourceOptions = toOptions;
    else sourceOptions = intermediateOptions[target] ?? [];

    const selected = sourceOptions.find((option) => option.value === value);
    if (!selected) return;

    const geocoder = geocoderRef.current;
    if (!geocoder || !selected.placeId) {
      if (target === "from") setSelectedFrom(selected);
      else if (target === "to") setSelectedTo(selected);
      else setSelectedIntermediateStops((current) => ({ ...current, [target]: selected }));
      return;
    }

    geocoder.geocode({ placeId: selected.placeId }, (results, status) => {
      if (status !== "OK" || !results?.[0]?.geometry?.location) {
        message.error("Could not resolve selected city coordinates.");
        return;
      }
      const withCoords: CityOption = {
        ...selected,
        lat: results[0].geometry.location.lat(),
        lng: results[0].geometry.location.lng(),
      };
      if (target === "from") setSelectedFrom(withCoords);
      else if (target === "to") setSelectedTo(withCoords);
      else setSelectedIntermediateStops((current) => ({ ...current, [target]: withCoords }));
    });
  };

  const removeIntermediateStop = (remove: (index: number) => void, index: number) => {
    remove(index);
    setSelectedIntermediateStops((current) =>
      Object.fromEntries(
        Object.entries(current)
          .filter(([key]) => Number(key) !== index)
          .map(([key, value]) => [Number(key) > index ? Number(key) - 1 : Number(key), value]),
      ),
    );
    setIntermediateOptions((current) =>
      Object.fromEntries(
        Object.entries(current)
          .filter(([key]) => Number(key) !== index)
          .map(([key, value]) => [Number(key) > index ? Number(key) - 1 : Number(key), value]),
      ),
    );
    setSegmentPricePreview([]);
  };

  const renderIntermediateStops = (compact = false) => (
    <Form.List name="intermediateStops">
      {(fields, { add, remove }) => (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <Text strong className="text-sm text-gray-700">
                Intermediate Stops
              </Text>
              <Text type="secondary" className="block text-xs">
                Start typing for city suggestions. Travelers can book any forward segment.
              </Text>
            </div>
            <Button
              type="dashed"
              icon={<Plus size={15} />}
              disabled={fields.length >= 8}
              onClick={() => add()}
            >
              Add stop
            </Button>
          </div>
          {fields.map((field, index) => (
            <div key={field.key} className="flex items-start gap-2">
              <div className="mt-3 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                {index + 1}
              </div>
              <Form.Item
                {...field}
                className="mb-0 flex-1"
                rules={[{ required: true, message: "Select or remove this stop" }]}
              >
                <AutoComplete
                  options={intermediateOptions[index] ?? []}
                  onSearch={(text) => {
                    setSelectedIntermediateStops((current) => {
                      const next = { ...current };
                      delete next[index];
                      return next;
                    });
                    void searchCities(text, index);
                  }}
                  onSelect={(value) => onSelectCity(value, index)}
                >
                  <Input
                    placeholder={`Stop ${index + 1}`}
                    size="large"
                    style={{ borderRadius: "8px", height: compact ? "44px" : "48px" }}
                  />
                </AutoComplete>
              </Form.Item>
              <Button
                danger
                type="text"
                aria-label={`Remove stop ${index + 1}`}
                icon={<Trash2 size={17} />}
                className="mt-1"
                onClick={() => removeIntermediateStop(remove, index)}
              />
            </div>
          ))}
        </div>
      )}
    </Form.List>
  );

  const renderSegmentPricePreview = () =>
    segmentPricePreview.length > 0 ? (
      <div className="rounded-xl border border-primary/15 bg-primary/5 p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <Text strong>Automatic segment prices</Text>
          <Tag color="purple">{segmentPricePreview.length} bookable segments</Tag>
        </div>
        <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
          {segmentPricePreview.map((segment) => (
            <div
              key={`${segment.from}-${segment.to}`}
              className="flex items-center justify-between gap-3 rounded-lg bg-white/80 px-3 py-2 text-sm"
            >
              <span className="min-w-0 truncate">
                {segment.from} <ArrowRight className="mx-1 inline h-3.5 w-3.5" /> {segment.to}
              </span>
              <span className="shrink-0 font-bold text-emerald-700">
                ₹{segment.pricePerSeat} · {segment.distanceKm} km
              </span>
            </div>
          ))}
        </div>
      </div>
    ) : (
      <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-3 text-sm text-gray-500">
        Add route details and click “Calculate Route & Prices” to review every segment.
      </div>
    );

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-emerald-200 via-green-200 to-emerald-300 p-4">
        <Spin size="large" />
      </div>
    );
  }

  if (!isDriver) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-emerald-200 via-green-200 to-emerald-300 p-4">
        <Card className="max-w-md text-center shadow-elevated rounded-3xl border-none">
          <Text type="danger" strong>
            ACCESS DENIED
          </Text>
          <p className="mt-2 text-muted-foreground">
            This workspace is only for ride host accounts. Please complete ride host onboarding.
          </p>
          <Button type="primary" className="mt-4 rounded-3xl" onClick={() => void signOut()}>
            Sign out
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: "#6b46c1",
          borderRadius: 0,
          fontFamily: APP_FONT_FAMILY,
          colorBgContainer: "rgba(255, 255, 255, 0.7)",
          colorBgElevated: "rgba(255, 255, 255, 0.9)",
        },
        components: {
          Layout: {
            headerBg: "rgba(255, 255, 255, 0.6)",
            siderBg: "rgba(255, 255, 255, 0.7)",
            bodyBg: "transparent",
          },
          Menu: {
            itemBg: "transparent",
            itemSelectedBg: "rgba(107, 70, 193, 0.15)",
            itemSelectedColor: "#6b46c1",
            itemBorderRadius: 12,
          },
          Card: {
            colorBgContainer: "rgba(255, 255, 255, 0.8)",
            borderRadius: 16,
            borderRadiusLG: 16,
          },
          Button: {
            borderRadius: 12,
            borderRadiusLG: 14,
            borderRadiusSM: 10,
          },
          Modal: {
            borderRadiusLG: 16,
          },
          Tag: {
            borderRadiusSM: 999,
          },
          Input: {
            borderRadius: 12,
            borderRadiusLG: 14,
          },
          InputNumber: {
            borderRadius: 12,
            borderRadiusLG: 14,
          },
          Select: {
            borderRadius: 12,
            borderRadiusLG: 14,
          },
          DatePicker: {
            borderRadius: 12,
            borderRadiusLG: 14,
          },
        },
      }}
    >
      <div
        className="min-h-screen bg-fixed bg-gradient-to-br from-emerald-200 via-green-200 to-emerald-300"
        style={{ fontFamily: APP_FONT_FAMILY }}
      >
        {tripPublishedSuccess && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-white/95 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="flex flex-col items-center px-6 text-center">
              <div className="relative flex h-28 w-28 items-center justify-center">
                <span className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping" />
                <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-emerald-500 shadow-[0_10px_35px_rgba(16,185,129,0.45)] animate-in zoom-in-50 duration-300">
                  <svg viewBox="0 0 52 52" className="h-12 w-12" aria-hidden>
                    <path
                      fill="none"
                      stroke="white"
                      strokeWidth="5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M14 27 L22 35 L38 18"
                      style={{
                        strokeDasharray: 48,
                        strokeDashoffset: 48,
                        animation: "cp-check-draw 0.4s ease-out 0.2s forwards",
                      }}
                    />
                  </svg>
                </div>
              </div>
              <p className="mt-6 text-2xl font-bold text-gray-900">
                Trip published successfully
              </p>
              <p className="mt-1 text-sm text-gray-500">
                Your ride is now live for travelers.
              </p>
              <style>{`@keyframes cp-check-draw { to { stroke-dashoffset: 0; } }`}</style>
            </div>
          </div>
        )}

        {accountDeletedSuccess && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-white/95 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="flex flex-col items-center px-6 text-center">
              <div className="relative flex h-28 w-28 items-center justify-center">
                <span className="absolute inset-0 rounded-full bg-red-500/20 animate-ping" />
                <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-red-500 shadow-[0_10px_35px_rgba(239,68,68,0.45)] animate-in zoom-in-50 duration-300">
                  <svg viewBox="0 0 52 52" className="h-12 w-12" aria-hidden>
                    <path
                      fill="none"
                      stroke="white"
                      strokeWidth="5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M16 16 L36 36 M36 16 L16 36"
                      style={{
                        strokeDasharray: 60,
                        strokeDashoffset: 60,
                        animation: "cp-cross-draw 0.4s ease-out 0.2s forwards",
                      }}
                    />
                  </svg>
                </div>
              </div>
              <p className="mt-6 text-2xl font-bold text-gray-900">Account deleted</p>
              <p className="mt-1 text-sm text-gray-500">Signing you out…</p>
              <style>{`@keyframes cp-cross-draw { to { stroke-dashoffset: 0; } }`}</style>
            </div>
          </div>
        )}

        <Modal
          open={deleteAccountModalOpen}
          onCancel={() => {
            if (!deletingAccount) setDeleteAccountModalOpen(false);
          }}
          footer={null}
          centered
          closable={!deletingAccount}
          maskClosable={!deletingAccount}
          width={460}
          styles={{ content: { borderRadius: "1.5rem", padding: 0, overflow: "hidden" } }}
        >
          <div className="px-7 pt-7 pb-6">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
              <Trash2 className="text-red-600" size={26} />
            </div>
            <h3 className="mt-5 text-2xl font-bold text-gray-900">Delete your account?</h3>
            <p className="mt-2 text-sm leading-relaxed text-gray-600">
              This will permanently remove your driver profile, vehicles, and host role
              from Coolpool. <strong>This action cannot be undone.</strong>
            </p>
            <div className="mt-6 flex gap-3">
              <Button
                block
                size="large"
                onClick={() => setDeleteAccountModalOpen(false)}
                disabled={deletingAccount}
                className="rounded-2xl"
              >
                No
              </Button>
              <Button
                block
                size="large"
                danger
                type="primary"
                loading={deletingAccount}
                onClick={() => void handleDeleteAccount()}
                className="rounded-2xl"
              >
                Yes, delete
              </Button>
            </div>
          </div>
        </Modal>
        <Layout className="bg-transparent max-w-[1600px] mx-auto relative flex">
          <Sider
            breakpoint="lg"
            collapsedWidth="0"
            width={280}
            className="hidden lg:block m-4 rounded-2xl border border-white/40 shadow-soft overflow-hidden"
            style={{
              position: "sticky",
              top: 16,
              height: "calc(100vh - 32px)",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
            }}
          >
            <div className="p-4 sm:p-6 pb-2 text-center">
              <img src={logo} alt="Coolpool Logo" className="h-16 w-auto mx-auto object-contain" />
            </div>

            <Menu
              mode="inline"
              selectedKeys={[activeModule]}
              onClick={({ key }) => {
                setActiveModule(normalizeModule(key));
                if (key === "trips") {
                  setEditingTripId(null);
                  setIsEditingTrip(false);
                  form.resetFields();
                  setSelectedFrom(null);
                  setSelectedTo(null);
                }
              }}
              className="border-none px-2 mt-4"
              items={
                [
                  {
                    key: "dashboard",
                    icon: <LayoutDashboard size={18} />,
                    label: "Overview",
                  },
                  {
                    key: "trips",
                    icon: <PlusCircle size={18} />,
                    label: "Publish Trip",
                  },
                  {
                    key: "history",
                    icon: <History size={18} />,
                    label: "Ride History",
                  },
                  {
                    key: "customers",
                    icon: <UserCheck size={18} />,
                    label: "Customers",
                  },
                  {
                    key: "drivers",
                    icon: <Users2 size={18} />,
                    label: "Drivers",
                  },
                  {
                    key: "settings",
                    icon: <Settings size={18} />,
                    label: "Vehicle Fleet",
                  },
                  !isVerifiedHost && {
                    key: "onboarding",
                    icon: <Sparkles size={18} />,
                    label: "Complete Onboarding",
                  },
                ].filter(Boolean) as any
              }
            />
          </Sider>

          <Layout className="bg-transparent flex-1">
            <Header
              className="px-6 flex items-center justify-between border-b border-white/20 sticky top-0 z-50 h-16"
              style={{ backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" }}
            >
              <div>
                <Title level={4} style={{ margin: 0 }} className="hidden sm:block font-bold">
                  {activeModule === "dashboard"
                    ? "Dashboard Overview"
                    : activeModule === "trips"
                      ? "Publish Trip"
                      : activeModule === "history"
                        ? "Ride History"
                        : activeModule === "drivers"
                          ? "Drivers"
                          : activeModule === "onboarding"
                            ? "Complete Onboarding"
                            : "Vehicle Fleet"}
                </Title>
                <div className="sm:hidden">
                  <img src={logo} alt="Coolpool Logo" className="h-12 w-auto object-contain" />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <Dropdown
                  menu={{
                    items: [
                      {
                        key: "header",
                        label: (
                          <div className="px-1 py-3">
                            <div className="flex items-center gap-3 mb-3">
                              <Avatar
                                size={48}
                                className="bg-gradient-primary text-primary-foreground font-bold text-lg border border-white/60"
                              >
                                {user?.email?.[0]?.toUpperCase() || "U"}
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <div className="font-semibold text-gray-900 truncate">
                                  {getUserDisplayName(user)}
                                </div>
                                <div className="text-xs text-gray-600 truncate">
                                  {user?.email}
                                </div>
                                <div
                                  className={`text-xs font-semibold mt-1 flex items-center gap-1 ${isVerifiedHost ? "text-blue-600" : "text-amber-600"}`}
                                >
                                  {isVerifiedHost ? (
                                    <>
                                      <CheckCircle size={12} />
                                      Verified Host
                                    </>
                                  ) : (
                                    <>
                                      <Sparkles size={12} />
                                      Incomplete Profile
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="border-t border-gray-100 pt-3" />
                          </div>
                        ),
                        disabled: true,
                      },
                      {
                        key: "logout",
                        label: "Logout",
                        icon: <LogOut size={14} />,
                        danger: true,
                        onClick: () => void signOut(),
                      },
                      {
                        key: "delete-account",
                        label: "Delete Account",
                        icon: <Trash2 size={14} />,
                        danger: true,
                        onClick: () => setDeleteAccountModalOpen(true),
                      },
                    ],
                  }}
                  trigger={["click"]}
                  placement="bottomRight"
                  overlayClassName="profile-dropdown"
                >
                  <div className="group flex items-center h-12 gap-3 bg-white/40 hover:bg-white/60 pl-4 pr-1.5 border border-white/20 shadow-sm backdrop-blur-xl transition-all duration-300 cursor-pointer">
                    <div className="hidden md:flex flex-col items-end justify-center h-full gap-0.5">
                      <div className="flex items-center gap-1">
                        <Text
                          strong
                          className="text-[14px] text-gray-800 leading-none max-w-[140px] truncate"
                        >
                          {getUserDisplayName(user)}
                        </Text>
                        <CheckCircle
                          size={13}
                          className={
                            isVerifiedHost
                              ? "text-blue-500 fill-blue-500/10"
                              : "text-amber-500 fill-amber-500/10"
                          }
                        />
                      </div>
                      <Text
                        className={`text-[9px] font-bold uppercase tracking-[0.05em] leading-none ${isVerifiedHost ? "text-gray-500" : "text-amber-600"}`}
                      >
                        {isVerifiedHost ? "Verified Host" : "Incomplete Profile"}
                      </Text>
                    </div>
                    <Badge
                      dot
                      status={isVerifiedHost ? "processing" : "warning"}
                      offset={[-1, 26]}
                      color={isVerifiedHost ? "#6b46c1" : "#f59e0b"}
                    >
                      <Avatar
                        icon={<User size={18} />}
                        className="bg-gradient-primary shadow-sm border border-white/40 group-hover:border-white/80 transition-all"
                        size={34}
                      />
                    </Badge>
                  </div>
                </Dropdown>
              </div>
            </Header>

            <Content className="p-4 sm:p-6 md:p-10 max-w-7xl mx-auto w-full pb-24 lg:pb-10">
              {activeModule === "dashboard" && (
                <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
                  {!isVerifiedHost && (
                    <Card className="rounded-3xl border-none bg-gradient-to-r from-amber-50 to-orange-50 p-6 shadow-soft relative overflow-hidden">
                      <div className="absolute -right-6 -top-6 text-amber-100 opacity-50 rotate-12">
                        <Sparkles size={120} />
                      </div>
                      <div className="flex flex-col md:flex-row md:items-center gap-6 relative z-10">
                        <div className="h-16 w-16 rounded-3xl bg-amber-500 text-white flex items-center justify-center shadow-glow shrink-0">
                          <Sparkles size={32} />
                        </div>
                        <div className="flex-1">
                          <Title level={3} className="m-0 text-amber-900">
                            Complete your profile
                          </Title>
                          <Text className="text-amber-700/80 text-base">
                            Finish your onboarding to unlock all features and become a verified
                            host.
                          </Text>
                        </div>
                        <Button
                          type="primary"
                          size="large"
                          className="bg-amber-600 hover:bg-amber-700 border-none rounded-2xl h-12 px-8 font-bold shadow-soft"
                          onClick={() => setActiveModule("onboarding")}
                        >
                          Start Onboarding
                        </Button>
                      </div>
                    </Card>
                  )}
                  <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div className="flex flex-col gap-1">
                      <Title level={2} style={{ margin: 0 }}>
                        Welcome back, {getUserDisplayName(user).split(" ")[0]}!
                      </Title>
                      <Text type="secondary" className="text-lg">
                        Here's what's happening with your trips today.
                      </Text>
                    </div>
                    <Button
                      type="primary"
                      size="large"
                      icon={<PlusCircle size={18} />}
                      className="bg-gradient-primary border-none flex items-center gap-2"
                      onClick={() => {
                        setEditingTripId(null);
                        setIsEditingTrip(false);
                        form.resetFields();
                        setSelectedFrom(null);
                        setSelectedTo(null);
                        setShowTripForm(false);
                        setActiveModule("trips");
                      }}
                    >
                      New Trip
                    </Button>
                  </div>

                  <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    <Card className="rounded-2xl border border-white/60 shadow-soft hover:shadow-card transition-all duration-300 backdrop-blur-md group overflow-hidden relative">
                      <div className="absolute -right-6 -top-6 w-24 h-24 bg-purple-500/10 rounded-full blur-xl group-hover:bg-purple-500/20 transition-all"></div>
                      <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-purple-100 rounded-3xl text-purple-600">
                          <RouteIcon size={20} />
                        </div>
                        <Text type="secondary" className="font-medium text-gray-500">
                          Total Rides
                        </Text>
                      </div>
                      <Title level={2} style={{ margin: "12px 0 8px 0" }} className="text-gray-800">
                        {tripsLoading ? <Spin size="small" /> : trips.length}
                      </Title>
                      <div className="flex items-center gap-2">
                        <Tag color="purple" className="rounded-full px-3 border-none font-medium">
                          +12% this month
                        </Tag>
                      </div>
                    </Card>

                    <Card className="rounded-2xl border border-white/60 shadow-soft hover:shadow-card transition-all duration-300 backdrop-blur-md group overflow-hidden relative">
                      <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-emerald-500/10 rounded-full blur-xl group-hover:bg-emerald-500/20 transition-all"></div>
                      <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-emerald-100 rounded-3xl text-emerald-600">
                          <span className="font-bold text-lg">₹</span>
                        </div>
                        <Text type="secondary" className="font-medium text-gray-500">
                          Total Earnings
                        </Text>
                      </div>
                      <Title level={2} style={{ margin: "12px 0 8px 0" }} className="text-gray-800">
                        ₹0
                      </Title>
                      <Text type="secondary" className="text-sm">
                        Settlement pending
                      </Text>
                    </Card>

                    <Card className="rounded-2xl border border-white/60 shadow-soft hover:shadow-card transition-all duration-300 backdrop-blur-md group overflow-hidden relative">
                      <div className="absolute -left-6 -top-6 w-24 h-24 bg-yellow-500/10 rounded-full blur-xl group-hover:bg-yellow-500/20 transition-all"></div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-yellow-100 rounded-3xl text-yellow-600">
                            <Sparkles size={20} />
                          </div>
                          <Text type="secondary" className="font-medium text-gray-500">
                            Performance
                          </Text>
                        </div>
                        <Title level={2} style={{ margin: 0 }} className="text-gray-800">
                          5.0
                        </Title>
                      </div>
                      <div className="mt-4 flex gap-1.5 text-yellow-500 bg-yellow-50/50 p-2 rounded-3xl inline-flex border border-yellow-100">
                        {[...Array(5)].map((_, i) => (
                          <Sparkles key={i} size={16} className="fill-yellow-500" />
                        ))}
                      </div>
                    </Card>
                  </div>

                  <div className="grid gap-8 lg:grid-cols-3">
                    <div className="lg:col-span-2 space-y-6">
                      <div className="flex items-center justify-between">
                        <Title level={4} style={{ margin: 0 }} className="font-bold">
                          Upcoming Trips
                        </Title>
                        <Button
                          type="link"
                          className="font-medium"
                          onClick={() => {
                            setPublishTripsModalOpen(true);
                            setPublishModalView("trips");
                          }}
                        >
                          Manage all
                        </Button>
                      </div>

                      {tripsLoading ? (
                        <div className="py-12 text-center bg-white/40 rounded-2xl border border-white/60 backdrop-blur-md">
                          <Spin size="large" />
                        </div>
                      ) : upcomingTrips.length === 0 ? (
                        <div className="py-16 text-center bg-white/40 rounded-2xl border border-white/60 backdrop-blur-md shadow-soft flex flex-col items-center justify-center">
                          <div className="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center mb-4">
                            <RouteIcon size={32} className="text-purple-500" />
                          </div>
                          <Title level={4}>No trips published yet</Title>
                          <Text type="secondary" className="max-w-md mt-2">
                            Your published trips will appear here. Start sharing your empty seats to
                            earn money on your journeys.
                          </Text>
                          <Button
                            type="primary"
                            size="large"
                            className="mt-6 bg-gradient-primary border-none rounded-3xl"
                            onClick={() => {
                              setPublishTripsModalOpen(true);
                              setPublishModalView("form");
                            }}
                          >
                            Publish your first trip
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {upcomingTrips.slice(0, 5).map((item) => (
                            <div
                              key={item.id}
                              className="bg-white/80 rounded-2xl border border-white shadow-soft p-5 hover:shadow-card transition-all duration-300 group"
                            >
                              <div className="flex items-center justify-between mb-4">
                                <Tag
                                  color="purple"
                                  className="rounded-full border-none px-3 py-1 font-semibold text-xs m-0"
                                >
                                  {dayjs(item.departureAt).format("MMM D, YYYY â€¢ h:mm A")}
                                </Tag>
                                <div className="flex items-center gap-2">
                                  <Text strong className="text-lg text-emerald-600">
                                    ₹{item.totalPrice}
                                  </Text>
                                  <Dropdown
                                    menu={{
                                      items: [
                                        { key: "edit", label: "Edit trip details" },
                                        { key: "cancel", label: "Cancel trip", danger: true },
                                      ],
                                      onClick: async ({ key }) => {
                                        if (key === "edit") {
                                          const hide = message.loading(
                                            "Fetching trip details...",
                                            0,
                                          );
                                          try {
                                            setEditingTripId(item.id);
                                            setIsEditingTrip(true);

                                            // Fetch stops to pre-populate
                                            const stops = await listTripStops(item.id);
                                            const fromStop = stops.find(
                                              (s) => s.stopType === "pickup",
                                            );
                                            const toStop = stops.find((s) => s.stopType === "drop");
                                            const intermediateStops = stops.filter(
                                              (s) => s.stopType === "both",
                                            );

                                            if (fromStop)
                                              setSelectedFrom({
                                                label: fromStop.location,
                                                value: fromStop.location,
                                                lat: fromStop.lat,
                                                lng: fromStop.lng,
                                              });
                                            if (toStop)
                                              setSelectedTo({
                                                label: toStop.location,
                                                value: toStop.location,
                                                lat: toStop.lat,
                                                lng: toStop.lng,
                                              });
                                            setSelectedIntermediateStops(
                                              Object.fromEntries(
                                                intermediateStops.map((stop, index) => [
                                                  index,
                                                  {
                                                    label: stop.location,
                                                    value: stop.location,
                                                    lat: stop.lat,
                                                    lng: stop.lng,
                                                  },
                                                ]),
                                              ),
                                            );

                                            form.setFieldsValue({
                                              fromLocation: item.fromLocation,
                                              toLocation: item.toLocation,
                                              departureAt: dayjs(item.departureAt),
                                              totalSeats: item.totalSeats,
                                              totalTripPrice: Math.round(
                                                item.totalPrice / (item.totalSeats || 1),
                                              ),
                                              vehicleId: item.vehicleId,
                                              driverId: item.assignedDriverId,
                                              intermediateStops: intermediateStops.map(
                                                (stop) => stop.location,
                                              ),
                                            });

                                            setShowTripForm(true);
                                            setActiveModule("trips");
                                            message.success("Trip loaded for editing.");
                                          } catch (err) {
                                            console.error("[EditTrip] Error:", err);
                                            message.error("Failed to load trip details.");
                                          } finally {
                                            hide();
                                          }
                                        } else if (key === "cancel") {
                                          message.info("Cancel functionality coming soon");
                                        }
                                      },
                                    }}
                                    trigger={["click"]}
                                  >
                                    <Button
                                      type="text"
                                      icon={<MoreVertical size={18} />}
                                      className="text-gray-400 hover:text-gray-700"
                                    />
                                  </Dropdown>
                                </div>
                              </div>

                              <div className="flex items-stretch gap-4">
                                <div className="flex flex-col items-center justify-between py-1 w-6">
                                  <div className="w-3 h-3 rounded-full border-2 border-primary bg-white z-10"></div>
                                  <div className="w-0.5 bg-gray-200 flex-1 my-1"></div>
                                  <div className="w-3 h-3 rounded-full bg-primary z-10"></div>
                                </div>
                                <div className="flex-1 flex flex-col justify-between py-0.5 gap-4">
                                  <div>
                                    <Text className="text-xs text-gray-500 uppercase tracking-wider font-semibold block mb-0.5">
                                      Origin
                                    </Text>
                                    <Text strong className="text-base text-gray-800 line-clamp-1">
                                      {item.fromLocation}
                                    </Text>
                                  </div>
                                  <div>
                                    <Text className="text-xs text-gray-500 uppercase tracking-wider font-semibold block mb-0.5">
                                      Destination
                                    </Text>
                                    <Text strong className="text-base text-gray-800 line-clamp-1">
                                      {item.toLocation}
                                    </Text>
                                  </div>
                                </div>
                              </div>

                              <div className="mt-5 pt-4 border-t border-gray-100 flex items-center justify-between">
                                <div className="flex items-center gap-2 text-sm text-gray-600">
                                  <User size={16} />
                                  <span>{item.totalSeats} seats total</span>
                                </div>
                                <Button
                                  type="link"
                                  className="p-0 text-primary font-medium group-hover:underline"
                                  onClick={() => setManagingTripId(item.id)}
                                >
                                  Manage Passengers
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="space-y-6">
                      <Title level={4} style={{ margin: 0 }}>
                        Quick Access
                      </Title>
                      <div className="grid grid-cols-2 gap-4">
                        <Card
                          hoverable
                          className="rounded-2xl border border-white/60 shadow-soft text-center p-3 group bg-white/60 hover:bg-white transition-all"
                          onClick={() => {
                            setEditingTripId(null);
                            setIsEditingTrip(false);
                            form.resetFields();
                            setSelectedFrom(null);
                            setSelectedTo(null);
                            setShowTripForm(false);
                            setActiveModule("trips");
                          }}
                        >
                          <div className="h-12 w-12 mx-auto rounded-3xl bg-purple-100 text-purple-600 flex items-center justify-center mb-3 group-hover:bg-purple-600 group-hover:text-white transition-all group-hover:scale-110 duration-300">
                            <PlusCircle size={22} />
                          </div>
                          <Text strong className="text-sm">
                            New Trip
                          </Text>
                        </Card>
                        <Card
                          hoverable
                          className="rounded-2xl border border-white/60 shadow-soft text-center p-3 group bg-white/60 hover:bg-white transition-all"
                          onClick={() => setActiveModule("history")}
                        >
                          <div className="h-12 w-12 mx-auto rounded-3xl bg-blue-100 text-blue-600 flex items-center justify-center mb-3 group-hover:bg-blue-600 group-hover:text-white transition-all group-hover:scale-110 duration-300">
                            <History size={22} />
                          </div>
                          <Text strong className="text-sm">
                            History
                          </Text>
                        </Card>
                        <Card
                          hoverable
                          className="rounded-2xl border border-white/60 shadow-soft text-center p-3 group bg-white/60 hover:bg-white transition-all"
                          onClick={() => setActiveModule("settings")}
                        >
                          <div className="h-12 w-12 mx-auto rounded-3xl bg-gray-100 text-gray-600 flex items-center justify-center mb-3 group-hover:bg-gray-600 group-hover:text-white transition-all group-hover:scale-110 duration-300">
                            <Settings size={22} />
                          </div>
                          <Text strong className="text-sm">
                            Vehicle Settings
                          </Text>
                        </Card>
                      </div>

                      <Card className="rounded-2xl border-none bg-gradient-primary text-white p-6 shadow-glow relative overflow-hidden mt-8 hover:scale-[1.02] transition-transform duration-300 cursor-pointer">
                        <Sparkles
                          size={80}
                          className="absolute -right-6 -bottom-6 opacity-20 rotate-12"
                        />
                        <Title level={4} style={{ color: "white", margin: 0 }}>
                          Pro Ride Host Tips
                        </Title>
                        <p className="mt-2 text-white/80 text-sm">
                          Consistent high ratings lead to better visibility and more ride requests.
                        </p>
                        <Button
                          ghost
                          className="mt-4 border-white/40 text-white rounded-3xl hover:bg-white/10"
                        >
                          Learn more
                        </Button>
                      </Card>
                    </div>
                  </div>
                </div>
              )}

              {activeModule === "trips" && (
                <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                  {!showTripForm ? (
                    <>
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col gap-1">
                          <Title level={2} style={{ margin: 0 }}>
                            My Trips
                          </Title>
                          <Text type="secondary" className="text-lg">
                            View and manage all your published trips.
                          </Text>
                        </div>
                        <Button
                          type="primary"
                          size="large"
                          icon={<Plus size={18} />}
                          className="bg-gradient-primary border-none rounded-3xl"
                          onClick={() => {
                            setShowTripForm(true);
                            setEditingTripId(null);
                            setIsEditingTrip(false);
                            form.resetFields();
                            setSelectedFrom(null);
                            setSelectedTo(null);
                          }}
                        >
                          Add New Trip
                        </Button>
                      </div>

                      {/* Desktop Table View */}
                      <Card className="rounded-2xl border border-white/60 shadow-card bg-white/80 backdrop-blur-md overflow-x-auto hidden lg:block">
                        <Table
                          columns={[
                            {
                              title: "From",
                              dataIndex: "fromLocation",
                              key: "from",
                              width: "15%",
                              render: (text) => (
                                <Text strong className="line-clamp-1">
                                  {text}
                                </Text>
                              ),
                            },
                            {
                              title: "To",
                              dataIndex: "toLocation",
                              key: "to",
                              width: "15%",
                              render: (text) => (
                                <Text strong className="line-clamp-1">
                                  {text}
                                </Text>
                              ),
                            },
                            {
                              title: "Departure",
                              dataIndex: "departureAt",
                              key: "departure",
                              width: "18%",
                              render: (date) => (
                                <Text className="text-sm">
                                  {dayjs(date).format("MMM D, YYYY")}
                                  <br />
                                  <span className="text-gray-500">
                                    {dayjs(date).format("h:mm A")}
                                  </span>
                                </Text>
                              ),
                            },
                            {
                              title: "Price",
                              dataIndex: "totalPrice",
                              key: "price",
                              width: "12%",
                              align: "right" as const,
                              render: (price) => (
                                <Text strong className="text-emerald-600">
                                  ₹{price?.toLocaleString("en-IN")}
                                </Text>
                              ),
                            },
                            {
                              title: "Status",
                              dataIndex: "status",
                              key: "status",
                              width: "12%",
                              render: (status) => (
                                <Tag
                                  color={
                                    status === "active"
                                      ? "blue"
                                      : status === "completed"
                                        ? "success"
                                        : "error"
                                  }
                                  className="rounded-full"
                                >
                                  {status?.toUpperCase()}
                                </Tag>
                              ),
                            },
                            {
                              title: "Actions",
                              key: "actions",
                              width: "18%",
                              align: "right" as const,
                              render: (_, trip) => (
                                <Space size="small">
                                  <Button
                                    type="link"
                                    size="small"
                                    className="text-primary font-medium p-0"
                                    onClick={() => setManagingTripId(trip.id)}
                                  >
                                    View
                                  </Button>
                                  <Button
                                    type="link"
                                    size="small"
                                    className="text-primary font-medium p-0"
                                    onClick={async () => {
                                      const hide = message.loading(
                                        "Fetching trip details...",
                                        0,
                                      );
                                      try {
                                        setEditingTripId(trip.id);
                                        setIsEditingTrip(true);

                                        const stops = await listTripStops(trip.id);
                                        const fromStop = stops.find(
                                          (s) => s.stopType === "pickup",
                                        );
                                        const toStop = stops.find(
                                          (s) => s.stopType === "drop",
                                        );
                                        const intermediateStops = stops.filter(
                                          (s) => s.stopType === "both",
                                        );

                                        if (fromStop)
                                          setSelectedFrom({
                                            label: fromStop.location,
                                            value: fromStop.location,
                                            lat: fromStop.lat,
                                            lng: fromStop.lng,
                                          });
                                        if (toStop)
                                          setSelectedTo({
                                            label: toStop.location,
                                            value: toStop.location,
                                            lat: toStop.lat,
                                            lng: toStop.lng,
                                          });
                                        setSelectedIntermediateStops(
                                          Object.fromEntries(
                                            intermediateStops.map((stop, index) => [
                                              index,
                                              {
                                                label: stop.location,
                                                value: stop.location,
                                                lat: stop.lat,
                                                lng: stop.lng,
                                              },
                                            ]),
                                          ),
                                        );

                                        form.setFieldsValue({
                                          fromLocation: trip.fromLocation,
                                          toLocation: trip.toLocation,
                                          departureAt: dayjs(trip.departureAt),
                                          totalSeats: trip.totalSeats,
                                          totalTripPrice: Math.round(
                                            trip.totalPrice /
                                            (trip.totalSeats || 1),
                                          ),
                                          vehicleId: trip.vehicleId,
                                          driverId: trip.assignedDriverId,
                                          seatConfig: (trip as any).seatConfig ?? [],
                                          intermediateStops: intermediateStops.map(
                                            (stop) => stop.location,
                                          ),
                                        });

                                        setShowTripForm(true);
                                        message.success("Trip loaded for editing.");
                                      } catch (err) {
                                        console.error("[EditTrip] Error:", err);
                                        message.error(
                                          "Failed to load trip details.",
                                        );
                                      } finally {
                                        hide();
                                      }
                                    }}
                                  >
                                    Edit
                                  </Button>
                                  <Popconfirm
                                    title="Cancel Trip"
                                    description="Are you sure you want to cancel this trip? This action cannot be undone."
                                    onConfirm={async () => {
                                      try {
                                        await updateTrip(trip.id, {
                                          status: "cancelled",
                                        });
                                        message.success(
                                          "Trip cancelled successfully",
                                        );
                                        queryClient.invalidateQueries({
                                          queryKey: ["host-trips"],
                                        });
                                      } catch (err) {
                                        console.error(
                                          "[CancelTrip] Error:",
                                          err,
                                        );
                                        message.error(
                                          "Failed to cancel trip",
                                        );
                                      }
                                    }}
                                    okText="Yes, Cancel"
                                    cancelText="Keep Trip"
                                    okButtonProps={{ danger: true }}
                                  >
                                    <Button
                                      type="link"
                                      size="small"
                                      danger
                                      className="p-0"
                                    >
                                      Cancel
                                    </Button>
                                  </Popconfirm>
                                  <Popconfirm
                                    title="Delete Trip"
                                    description="Are you sure you want to delete this trip? This action cannot be undone."
                                    onConfirm={async () => {
                                      try {
                                        await deleteTrip(trip.id);
                                        message.success(
                                          "Trip deleted successfully",
                                        );
                                        queryClient.invalidateQueries({
                                          queryKey: ["host-trips"],
                                        });
                                      } catch (err) {
                                        console.error(
                                          "[DeleteTrip] Error:",
                                          err,
                                        );
                                        message.error(
                                          "Failed to delete trip",
                                        );
                                      }
                                    }}
                                    okText="Yes, Delete"
                                    cancelText="Keep Trip"
                                    okButtonProps={{ danger: true }}
                                  >
                                    <Button
                                      type="link"
                                      size="small"
                                      danger
                                      className="p-0"
                                    >
                                      Delete
                                    </Button>
                                  </Popconfirm>
                                </Space>
                              ),
                            },
                          ]}
                          dataSource={sortedTrips}
                          loading={tripsLoading}
                          rowKey="id"
                          scroll={{ x: 600 }}
                          pagination={{
                            pageSize: 10,
                            total: sortedTrips.length,
                            showSizeChanger: true,
                            showTotal: (total) =>
                              `Total ${total} trips`,
                            responsive: true,
                          }}
                          locale={{
                            emptyText: (
                              <div className="py-8 text-center">
                                <RouteIcon size={32} className="text-gray-300 mx-auto mb-3" />
                                <Text type="secondary" className="block">
                                  No trips published yet
                                </Text>
                              </div>
                            ),
                          }}
                        />
                      </Card>

                      {/* Mobile Card View */}
                      <div className="lg:hidden space-y-4">
                        {tripsLoading ? (
                          <div className="flex justify-center py-12">
                            <Spin size="large" />
                          </div>
                        ) : sortedTrips.length === 0 ? (
                          <Card className="rounded-2xl border border-white/60 shadow-card bg-white/80 backdrop-blur-md p-8 text-center">
                            <RouteIcon size={32} className="text-gray-300 mx-auto mb-3" />
                            <Text type="secondary" className="block">
                              No trips published yet
                            </Text>
                          </Card>
                        ) : (
                          sortedTrips.map((trip) => (
                            <Card
                              key={trip.id}
                              className="rounded-2xl border border-white/60 shadow-card bg-white/80 backdrop-blur-md p-4"
                            >
                              <div className="space-y-3">
                                {/* Route */}
                                <div>
                                  <Text type="secondary" className="text-xs font-bold uppercase">
                                    Route
                                  </Text>
                                  <div className="flex items-center gap-2 mt-1">
                                    <Text strong className="flex-1 line-clamp-1">
                                      {trip.fromLocation}
                                    </Text>
                                    <ArrowRight size={16} className="text-gray-400" />
                                    <Text strong className="flex-1 line-clamp-1">
                                      {trip.toLocation}
                                    </Text>
                                  </div>
                                </div>

                                {/* Departure & Price */}
                                <div className="grid grid-cols-2 gap-4 py-3 border-y border-gray-100">
                                  <div>
                                    <Text type="secondary" className="text-xs font-bold uppercase">
                                      Departure
                                    </Text>
                                    <Text className="text-sm font-semibold mt-1">
                                      {dayjs(trip.departureAt).format("MMM D, YYYY")}
                                    </Text>
                                    <Text type="secondary" className="text-xs">
                                      {dayjs(trip.departureAt).format("h:mm A")}
                                    </Text>
                                  </div>
                                  <div>
                                    <Text type="secondary" className="text-xs font-bold uppercase">
                                      Price per Seat
                                    </Text>
                                    <Text strong className="text-emerald-600 text-lg mt-1">
                                      ₹{trip.totalPrice?.toLocaleString("en-IN")}
                                    </Text>
                                  </div>
                                </div>

                                {/* Status & Seats */}
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <Tag
                                      color={
                                        trip.status === "active"
                                          ? "blue"
                                          : trip.status === "completed"
                                            ? "success"
                                            : "error"
                                      }
                                      className="rounded-full m-0"
                                    >
                                      {trip.status?.toUpperCase()}
                                    </Tag>
                                    <Text type="secondary" className="text-xs">
                                      {trip.totalSeats} seats
                                    </Text>
                                  </div>
                                </div>

                                {/* Actions */}
                                <div className="flex gap-2 pt-2">
                                  <Button
                                    size="small"
                                    className="flex-1 rounded-xl"
                                    onClick={() => setManagingTripId(trip.id)}
                                  >
                                    View
                                  </Button>
                                  <Button
                                    type="primary"
                                    size="small"
                                    className="flex-1 bg-gradient-primary border-none rounded-xl"
                                    onClick={async () => {
                                      const hide = message.loading(
                                        "Fetching trip details...",
                                        0,
                                      );
                                      try {
                                        setEditingTripId(trip.id);
                                        setIsEditingTrip(true);

                                        const stops = await listTripStops(trip.id);
                                        const fromStop = stops.find(
                                          (s) => s.stopType === "pickup",
                                        );
                                        const toStop = stops.find(
                                          (s) => s.stopType === "drop",
                                        );
                                        const intermediateStops = stops.filter(
                                          (s) => s.stopType === "both",
                                        );

                                        if (fromStop)
                                          setSelectedFrom({
                                            label: fromStop.location,
                                            value: fromStop.location,
                                            lat: fromStop.lat,
                                            lng: fromStop.lng,
                                          });
                                        if (toStop)
                                          setSelectedTo({
                                            label: toStop.location,
                                            value: toStop.location,
                                            lat: toStop.lat,
                                            lng: toStop.lng,
                                          });
                                        setSelectedIntermediateStops(
                                          Object.fromEntries(
                                            intermediateStops.map((stop, index) => [
                                              index,
                                              {
                                                label: stop.location,
                                                value: stop.location,
                                                lat: stop.lat,
                                                lng: stop.lng,
                                              },
                                            ]),
                                          ),
                                        );

                                        form.setFieldsValue({
                                          fromLocation: trip.fromLocation,
                                          toLocation: trip.toLocation,
                                          departureAt: dayjs(trip.departureAt),
                                          totalSeats: trip.totalSeats,
                                          totalTripPrice: Math.round(
                                            trip.totalPrice /
                                            (trip.totalSeats || 1),
                                          ),
                                          vehicleId: trip.vehicleId,
                                          driverId: trip.assignedDriverId,
                                          intermediateStops: intermediateStops.map(
                                            (stop) => stop.location,
                                          ),
                                          seatConfig: (trip as any).seatConfig ?? [],
                                        });

                                        setShowTripForm(true);
                                        message.success("Trip loaded for editing.");
                                      } catch (err) {
                                        console.error("[EditTrip] Error:", err);
                                        message.error(
                                          "Failed to load trip details.",
                                        );
                                      } finally {
                                        hide();
                                      }
                                    }}
                                  >
                                    Edit
                                  </Button>
                                  <Popconfirm
                                    title="Cancel Trip"
                                    description="Are you sure you want to cancel this trip?"
                                    onConfirm={async () => {
                                      try {
                                        await updateTrip(trip.id, {
                                          status: "cancelled",
                                        });
                                        message.success(
                                          "Trip cancelled successfully",
                                        );
                                        queryClient.invalidateQueries({
                                          queryKey: ["host-trips"],
                                        });
                                      } catch (err) {
                                        console.error(
                                          "[CancelTrip] Error:",
                                          err,
                                        );
                                        message.error(
                                          "Failed to cancel trip",
                                        );
                                      }
                                    }}
                                    okText="Yes"
                                    cancelText="No"
                                    okButtonProps={{ danger: true }}
                                  >
                                    <Button
                                      size="small"
                                      danger
                                      className="rounded-xl"
                                    >
                                      Cancel
                                    </Button>
                                  </Popconfirm>
                                  <Popconfirm
                                    title="Delete Trip"
                                    description="Are you sure you want to delete this trip?"
                                    onConfirm={async () => {
                                      try {
                                        await deleteTrip(trip.id);
                                        message.success(
                                          "Trip deleted successfully",
                                        );
                                        queryClient.invalidateQueries({
                                          queryKey: ["host-trips"],
                                        });
                                      } catch (err) {
                                        console.error(
                                          "[DeleteTrip] Error:",
                                          err,
                                        );
                                        message.error(
                                          "Failed to delete trip",
                                        );
                                      }
                                    }}
                                    okText="Yes"
                                    cancelText="No"
                                    okButtonProps={{ danger: true }}
                                  >
                                    <Button
                                      size="small"
                                      danger
                                      className="rounded-xl"
                                    >
                                      Delete
                                    </Button>
                                  </Popconfirm>
                                </div>
                              </div>
                            </Card>
                          ))
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex flex-col gap-1">
                        <Title level={2} style={{ margin: 0 }}>
                          {isEditingTrip ? "Update Trip Details" : "Publish a New Trip"}
                        </Title>
                        <Text type="secondary" className="text-lg">
                          Enter your journey details below to offer seats on your upcoming journey.
                        </Text>
                      </div>

                      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                        <Card className="rounded-2xl border border-white/60 shadow-card bg-white/80 backdrop-blur-md p-5 md:p-6 xl:col-span-2 relative overflow-hidden">
                          <Form
                            form={form}
                            layout="vertical"
                            onFinish={onFinish}
                            onValuesChange={() => {
                              setPendingTripPayload(null);
                              setSegmentPricePreview([]);
                            }}
                            initialValues={{
                              totalSeats: 3,
                              seatConfig: ["R1-C0", "R1-C1", "R1-C2"] as SeatId[],
                              driverId: user?.$id,
                            }}
                            requiredMark={false}
                          >
                            <div className="space-y-5">
                              {/* Row 1 – Route */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Form.Item
                                  label={<span className="font-semibold text-gray-700 text-sm">From City</span>}
                                  name="fromLocation"
                                  rules={[{ required: true, message: "Please enter origin" }]}
                                  className="mb-0"
                                >
                                  <AutoComplete
                                    options={fromOptions}
                                    onSearch={(text) => {
                                      setSelectedFrom(null);
                                      void searchCities(text, "from");
                                    }}
                                    onSelect={(value) => onSelectCity(value, "from")}
                                  >
                                    <Input
                                      placeholder="Departure city"
                                      size="large"
                                      style={{ borderRadius: '8px', height: '44px' }}
                                      className="text-sm border border-gray-300 transition-all"
                                    />
                                  </AutoComplete>
                                </Form.Item>

                                <Form.Item
                                  label={<span className="font-semibold text-gray-700 text-sm">To City</span>}
                                  name="toLocation"
                                  rules={[{ required: true, message: "Please enter destination" }]}
                                  className="mb-0"
                                >
                                  <AutoComplete
                                    options={toOptions}
                                    onSearch={(text) => {
                                      setSelectedTo(null);
                                      void searchCities(text, "to");
                                    }}
                                    onSelect={(value) => onSelectCity(value, "to")}
                                  >
                                    <Input
                                      placeholder="Destination city"
                                      size="large"
                                      style={{ borderRadius: '8px', height: '44px' }}
                                      className="text-sm border border-gray-300 transition-all"
                                    />
                                  </AutoComplete>
                                </Form.Item>
                              </div>

                              {renderIntermediateStops(true)}

                              {/* Row 2 – Departure Time + Price Per Seat */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Form.Item
                                  label={<span className="font-semibold text-gray-700 text-sm">Departure Date & Time</span>}
                                  name="departureAt"
                                  rules={[{ required: true, message: "Please select time" }]}
                                  className="mb-0"
                                >
                                  <DatePicker
                                    showTime={{ format: "h:mm A", use12Hours: true, minuteStep: 15 }}
                                    size="large"
                                    style={{ borderRadius: '8px', height: '44px', width: '100%' }}
                                    className="text-sm border border-gray-300"
                                    format="YYYY-MM-DD h:mm A"
                                    placement="bottomLeft"
                                    popupClassName="trip-publish-datepicker"
                                    getPopupContainer={() => document.body}
                                    disabledDate={disabledTripDate}
                                    disabledTime={disabledTripTime}
                                  />
                                </Form.Item>

                                <Form.Item
                                  label={<span className="font-semibold text-gray-700 text-sm">Price Per Seat (₹)</span>}
                                  name="totalTripPrice"
                                  rules={[{ required: true, message: "Please enter price" }]}
                                  className="mb-0"
                                >
                                  <InputNumber
                                    min={1}
                                    max={9999}
                                    precision={0}
                                    size="large"
                                    style={{ borderRadius: '8px', height: '44px', width: '100%' }}
                                    className="font-bold"
                                    prefix="₹"
                                    placeholder="0"
                                    onChange={(val) => {
                                      if (typeof val === "number" && val > 9999) {
                                        form.setFieldsValue({ totalTripPrice: 9999 });
                                      }
                                    }}
                                  />
                                </Form.Item>
                              </div>

                              {/* Row 3 – Vehicle + Driver */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Form.Item
                                  label={<span className="font-semibold text-gray-700 text-sm">Vehicle</span>}
                                  name="vehicleId"
                                  rules={[{ required: true, message: "Please select a vehicle" }]}
                                  className="mb-0"
                                >
                                  <Select
                                    size="large"
                                    placeholder="Choose vehicle"
                                    className="w-full"
                                    style={{ borderRadius: '8px', height: '44px' }}
                                    options={[
                                      ...vehicles.map((v) => ({
                                        label: `${v.modelName} · ${v.plateNumber} · ${v.seatCapacity} seats`,
                                        value: v.id,
                                      })),
                                      {
                                        label: (
                                          <span className="text-primary font-medium flex items-center gap-2">
                                            <Plus size={14} /> Add new vehicle
                                          </span>
                                        ),
                                        value: "ADD_NEW_VEHICLE",
                                      },
                                    ]}
                                    onChange={(val) => {
                                      if (val === "ADD_NEW_VEHICLE") {
                                        form.setFieldsValue({ vehicleId: undefined });
                                        setEditingVehicleId(null);
                                        vehicleForm.resetFields();
                                        setVehicleDrawerOpen(true);
                                        return;
                                      }
                                      const selectedVeh = vehicles.find((v) => v.id === val);
                                      if (selectedVeh) {
                                        form.setFieldsValue({ totalSeats: selectedVeh.seatCapacity });
                                      }
                                    }}
                                  />
                                </Form.Item>

                                <Form.Item
                                  label={<span className="font-semibold text-gray-700 text-sm">Driver</span>}
                                  name="driverId"
                                  rules={[{ required: true, message: "Please select a driver" }]}
                                  className="mb-0"
                                >
                                  <Select
                                    size="large"
                                    placeholder="Choose driver"
                                    className="w-full"
                                    style={{ borderRadius: '8px', height: '44px' }}
                                    options={[
                                      {
                                        label: `You (${user?.name?.split(" ")[0] || "Owner"})`,
                                        value: user?.$id || "",
                                      },
                                      ...teamDrivers.map((d) => ({
                                        label: `${d.fullName} · ${d.city}`,
                                        value: d.id,
                                      })),
                                    ]}
                                  />
                                </Form.Item>
                              </div>

                              {/* Row 4 – Seat Configuration (full width) */}
                              <div>
                                <span className="font-semibold text-gray-700 text-sm block mb-2">Configure Seating</span>
                                <Form.Item
                                  name="seatConfig"
                                  rules={[{ required: true, message: "Please select at least one seat" }]}
                                  className="mb-0"
                                >
                                  <SeatPicker
                                    onChange={(seats) => {
                                      form.setFieldsValue({ totalSeats: seats.length });
                                    }}
                                  />
                                </Form.Item>
                                <Form.Item name="totalSeats" hidden>
                                  <InputNumber />
                                </Form.Item>
                              </div>

                              {renderSegmentPricePreview()}
                            </div>

                            <div className="mt-6 flex flex-col sm:flex-row items-center gap-3 pt-5 border-t border-gray-200">
                              <Button
                                type="text"
                                size="large"
                                className="h-14 px-8 w-full sm:w-auto font-bold text-gray-600 hover:bg-gray-100 transition-all"
                                style={{ borderRadius: '8px' }}
                                onClick={() => {
                                  setShowTripForm(false);
                                  form.resetFields();
                                  setEditingTripId(null);
                                  setIsEditingTrip(false);
                                  setSelectedFrom(null);
                                  setSelectedTo(null);
                                }}
                              >
                                Cancel
                              </Button>
                              <Button
                                type="primary"
                                htmlType="submit"
                                size="large"
                                loading={creating}
                                className="h-14 px-12 w-full sm:w-auto bg-gradient-primary border-none font-bold shadow-lg hover:shadow-xl transition-all hover:scale-[1.01]"
                                style={{ borderRadius: '8px' }}
                              >
                                {pendingTripPayload
                                  ? isEditingTrip
                                    ? "Confirm Update"
                                    : "Confirm & Publish"
                                  : "Calculate Route & Prices"}
                              </Button>
                            </div>

                          </Form>
                        </Card>

                        {/* Right Column: Live Preview Panel */}
                        <div className="hidden xl:block">
                          <div className="sticky top-24">
                            <Title level={5} className="mb-4 text-gray-600">
                              Live Preview
                            </Title>
                            <Card className="rounded-2xl border-none shadow-soft bg-white p-5">
                              {/* Earnings removed as per request */}

                              <div className="bg-gray-50 rounded-3xl p-4 border border-gray-100">
                                <Text
                                  type="secondary"
                                  className="text-xs block mb-3 font-semibold uppercase tracking-wider text-center"
                                >
                                  What travelers see
                                </Text>
                                <div className="flex items-center justify-between mb-4">
                                  <Tag
                                    color="purple"
                                    className="rounded-full border-none px-2 py-0.5 font-semibold text-[10px] m-0"
                                  >
                                    {form.getFieldValue("departureAt")
                                      ? dayjs(form.getFieldValue("departureAt")).format(
                                        "MMM D • h:mm A",
                                      )
                                      : "Select date"}
                                  </Tag>
                                  <Text strong className="text-lg text-emerald-600">
                                    ₹{totalPriceWatch || "—"}
                                  </Text>
                                </div>

                                <div className="flex items-stretch gap-3">
                                  <div className="flex flex-col items-center justify-between py-1 w-4">
                                    <div className="w-2.5 h-2.5 rounded-full border-2 border-primary bg-white z-10"></div>
                                    <div className="w-0.5 bg-gray-200 flex-1 my-1"></div>
                                    <div className="w-2.5 h-2.5 rounded-full bg-primary z-10"></div>
                                  </div>
                                  <div className="flex-1 flex flex-col justify-between py-0.5 gap-3">
                                    <div>
                                      <Text strong className="text-sm text-gray-800 line-clamp-1">
                                        {form.getFieldValue("fromLocation") || "Origin"}
                                      </Text>
                                    </div>
                                    <div>
                                      <Text strong className="text-sm text-gray-800 line-clamp-1">
                                        {form.getFieldValue("toLocation") || "Destination"}
                                      </Text>
                                    </div>
                                  </div>
                                </div>

                                <div className="mt-4 pt-3 border-t border-gray-200 flex items-center justify-between text-xs text-gray-500">
                                  <div className="flex items-center gap-1.5">
                                    <User size={14} />
                                    <span>{seatsWatch || 4} seats</span>
                                  </div>
                                  <div className="flex gap-0.5">
                                    {[...Array(Math.min(Number(seatsWatch) || 4, 10))].map((_, i) => (
                                      <div key={i} className="w-2 h-2 rounded-full bg-primary/20"></div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </Card>
                          </div>
                        </div>

                        {/* Mobile Preview Drawer */}
                        <Drawer
                          title="Live Preview"
                          placement="bottom"
                          onClose={() => setMobilePreviewOpen(false)}
                          open={mobilePreviewOpen}
                          height="auto"
                          className="rounded-t-3xl"
                          styles={{ body: { padding: "20px" } }}
                        >
                          <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100 shadow-sm mb-4">
                            <Text
                              type="secondary"
                              className="text-xs block mb-4 font-semibold uppercase tracking-wider text-center"
                            >
                              What travelers see
                            </Text>
                            <div className="flex items-center justify-between mb-5">
                              <Tag
                                color="purple"
                                className="rounded-full border-none px-3 py-1 font-semibold text-xs m-0"
                              >
                                {form.getFieldValue("departureAt")
                                  ? dayjs(form.getFieldValue("departureAt")).format("MMM D • h:mm A")
                                  : "Select date"}
                              </Tag>
                              <Text strong className="text-xl text-emerald-600">
                                ₹{totalPriceWatch || "—"}
                              </Text>
                            </div>

                            <div className="flex items-stretch gap-4">
                              <div className="flex flex-col items-center justify-between py-1 w-5">
                                <div className="w-3 h-3 rounded-full border-2 border-primary bg-white z-10"></div>
                                <div className="w-0.5 bg-gray-200 flex-1 my-1"></div>
                                <div className="w-3 h-3 rounded-full bg-primary z-10"></div>
                              </div>
                              <div className="flex-1 flex flex-col justify-between py-0.5 gap-4">
                                <div>
                                  <Text strong className="text-base text-gray-800 line-clamp-1">
                                    {form.getFieldValue("fromLocation") || "Origin"}
                                  </Text>
                                </div>
                                <div>
                                  <Text strong className="text-base text-gray-800 line-clamp-1">
                                    {form.getFieldValue("toLocation") || "Destination"}
                                  </Text>
                                </div>
                              </div>
                            </div>

                            <div className="mt-5 pt-4 border-t border-gray-200 flex items-center justify-between text-sm text-gray-500">
                              <div className="flex items-center gap-1.5">
                                <User size={16} />
                                <span>{seatsWatch || 4} seats</span>
                              </div>
                              <div className="flex gap-1">
                                {[...Array(Math.min(Number(seatsWatch) || 4, 10))].map((_, i) => (
                                  <div key={i} className="w-2.5 h-2.5 rounded-full bg-primary/20"></div>
                                ))}
                              </div>
                            </div>
                          </div>
                          <Button
                            type="primary"
                            block
                            size="large"
                            className="h-14 rounded-3xl bg-gradient-primary border-none font-bold shadow-glow"
                            onClick={() => {
                              setMobilePreviewOpen(false);
                              form.submit();
                            }}
                            loading={creating}
                          >
                            Publish Now
                          </Button>
                        </Drawer>
                      </div>
                    </>
                  )}
                </div>
              )}

              {activeModule === "history" && (
                <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                  <div className="flex flex-col gap-1">
                    <Title level={2} style={{ margin: 0 }}>
                      Ride History
                    </Title>
                    <Text type="secondary" className="text-lg">
                      Review your past trips and earnings ledger.
                    </Text>
                  </div>

                  <div className="grid gap-6 sm:grid-cols-2">
                    <Card className="rounded-2xl border border-white/60 shadow-soft backdrop-blur-md group overflow-hidden relative bg-emerald-50/50">
                      <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-emerald-500/20 rounded-full blur-xl"></div>
                      <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-emerald-100 rounded-3xl text-emerald-600">
                          <Banknote size={20} />
                        </div>
                        <Text type="secondary" className="font-medium text-emerald-800">
                          Lifetime Earnings
                        </Text>
                      </div>
                      <Title
                        level={2}
                        style={{ margin: "12px 0 0 0" }}
                        className="text-emerald-900"
                      >
                        ₹{lifetimeEarnings.toLocaleString("en-IN")}
                      </Title>
                    </Card>

                    <Card className="rounded-2xl border border-white/60 shadow-soft backdrop-blur-md group overflow-hidden relative bg-purple-50/50">
                      <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-purple-500/20 rounded-full blur-xl"></div>
                      <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-purple-100 rounded-3xl text-purple-600">
                          <CheckCircle size={20} />
                        </div>
                        <Text type="secondary" className="font-medium text-purple-800">
                          Total Completed Rides
                        </Text>
                      </div>
                      <Title level={2} style={{ margin: "12px 0 0 0" }} className="text-purple-900">
                        {tripsLoading ? <Spin size="small" /> : completedTrips.length}
                      </Title>
                    </Card>
                  </div>

                  <Card className="rounded-2xl border border-white/60 shadow-card bg-white/80 backdrop-blur-md overflow-hidden">
                    <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                      <Title level={4} style={{ margin: 0 }}>
                        Transaction Ledger
                      </Title>
                      <div className="flex gap-2">
                        {(["all", "completed", "cancelled"] as const).map((f) => (
                          <Tag
                            key={f}
                            color={historyFilter === f ? "purple" : undefined}
                            className={`px-4 py-1 rounded-full cursor-pointer text-sm m-0 capitalize ${historyFilter === f ? "border-primary" : "bg-white border-gray-200 text-gray-500"} ${f === "cancelled" ? "hidden sm:inline-flex" : ""}`}
                            onClick={() => setHistoryFilter(f)}
                          >
                            {f.charAt(0).toUpperCase() + f.slice(1)}
                          </Tag>
                        ))}
                      </div>
                    </div>

                    <List
                      className="p-0"
                      itemLayout="horizontal"
                      loading={tripsLoading}
                      locale={{ emptyText: "No trips found" }}
                      dataSource={filteredHistory}
                      renderItem={(trip) => (
                        <List.Item className="p-6 hover:bg-gray-50 transition-colors cursor-pointer group border-b border-gray-50">
                          <div className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                              <div
                                className={`h-12 w-12 rounded-3xl flex items-center justify-center ${trip.status === "completed" ? "bg-emerald-100 text-emerald-600" : trip.status === "cancelled" ? "bg-red-100 text-red-600" : "bg-blue-100 text-blue-600"}`}
                              >
                                {trip.status === "completed" ? (
                                  <CheckCircle size={20} />
                                ) : trip.status === "cancelled" ? (
                                  <XCircle size={20} />
                                ) : (
                                  <RouteIcon size={20} />
                                )}
                              </div>
                              <div>
                                <Text strong className="text-base text-gray-800 block mb-1">
                                  {trip.fromLocation} → {trip.toLocation}
                                </Text>
                                <Text
                                  type="secondary"
                                  className="text-xs uppercase tracking-wider font-semibold"
                                >
                                  {dayjs(trip.departureAt).format("MMM D, YYYY • h:mm A")}
                                </Text>
                              </div>
                            </div>
                            <div className="flex items-center justify-between sm:flex-col sm:items-end gap-1">
                              <Text
                                strong
                                className={`text-lg ${trip.status === "completed" ? "text-emerald-600" : "text-gray-400"}`}
                              >
                                ₹{(trip.totalPrice ?? 0).toLocaleString("en-IN")}
                              </Text>
                              <Tag
                                color={
                                  trip.status === "completed"
                                    ? "success"
                                    : trip.status === "cancelled"
                                      ? "error"
                                      : "processing"
                                }
                                className="m-0 rounded-full border-none px-2 uppercase text-[10px] tracking-wider font-bold"
                              >
                                {trip.status}
                              </Tag>
                            </div>
                          </div>
                        </List.Item>
                      )}
                    />
                  </Card>
                </div>
              )}

              {/* — DRIVERS MODULE — */}
              {activeModule === "drivers" && (
                <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                  <div className="flex items-center justify-between">
                    <div>
                      <Title level={2} style={{ margin: 0 }}>
                        Drivers
                      </Title>
                      <Text type="secondary" className="text-lg">
                        Manage your team of drivers.
                      </Text>
                    </div>
                    <Button
                      type="primary"
                      icon={<Plus size={16} />}
                      size="large"
                      className="bg-gradient-primary border-none rounded-3xl font-bold shadow-glow flex items-center gap-2"
                      onClick={() => {
                        setEditingDriverId(null);
                        driverForm.resetFields();
                        setDriverDrawerOpen(true);
                      }}
                    >
                      Add Driver
                    </Button>
                  </div>

                  {driversLoading ? (
                    <div className="flex justify-center py-16">
                      <Spin size="large" />
                    </div>
                  ) : teamDrivers.length === 0 ? (
                    <Card className="rounded-2xl border border-white/60 shadow-soft bg-white/80 backdrop-blur-md text-center py-16">
                      <Users2 size={48} className="mx-auto text-gray-300 mb-4" />
                      <Text type="secondary" className="text-lg block">
                        No team drivers yet.
                      </Text>
                      <Text type="secondary" className="text-sm">
                        Add drivers who operate under your account.
                      </Text>
                      <div className="mt-6">
                        <Button
                          type="primary"
                          icon={<Plus size={16} />}
                          className="bg-gradient-primary border-none rounded-3xl"
                          onClick={() => {
                            setEditingDriverId(null);
                            driverForm.resetFields();
                            setDriverDrawerOpen(true);
                          }}
                        >
                          Add first driver
                        </Button>
                      </div>
                    </Card>
                  ) : (
                    <div className="space-y-4">
                      {teamDrivers.map((d) => (
                        <Card
                          key={d.id}
                          className="rounded-2xl border border-white/60 shadow-soft bg-white/80 backdrop-blur-md hover:shadow-card transition-all"
                        >
                          <div className="flex items-center gap-4">
                            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-violet-600 to-purple-700 flex items-center justify-center text-white font-bold text-xl shrink-0">
                              {d.fullName[0]?.toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-gray-800 text-base truncate">
                                {d.fullName}
                              </p>
                              <div className="flex flex-wrap gap-2 mt-1">
                                <span className="text-xs text-gray-500">{d.phone}</span>
                                <span className="text-gray-300">·</span>
                                <span className="text-xs text-gray-500">{d.city}</span>
                                <span className="text-gray-300">·</span>
                                <span className="text-xs text-gray-500 font-mono">
                                  {d.licenseNumber}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <Button
                                size="small"
                                icon={<Pencil size={14} />}
                                className="rounded-3xl"
                                onClick={() => {
                                  setEditingDriverId(d.id);
                                  driverForm.setFieldsValue({
                                    fullName: d.fullName,
                                    email: d.email,
                                    phone: d.phone,
                                    licenseNumber: d.licenseNumber,
                                    city: d.city,
                                  });
                                  setDriverDrawerOpen(true);
                                }}
                              />
                              <Popconfirm
                                title="Remove this driver?"
                                onConfirm={() => removeDriver(d.id)}
                                okText="Remove"
                                okButtonProps={{ danger: true }}
                              >
                                <Button
                                  size="small"
                                  danger
                                  icon={<Trash2 size={14} />}
                                  className="rounded-3xl"
                                />
                              </Popconfirm>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}

                  {/* Add/Edit Driver Drawer */}
                  <Drawer
                    title={editingDriverId ? "Edit Driver" : "Add Driver"}
                    placement="right"
                    width={420}
                    open={driverDrawerOpen}
                    onClose={() => {
                      setDriverDrawerOpen(false);
                      driverForm.resetFields();
                      setEditingDriverId(null);
                    }}
                    footer={
                      <Button
                        type="primary"
                        loading={savingDriver}
                        block
                        size="large"
                        className="bg-gradient-primary border-none rounded-3xl font-bold h-12"
                        onClick={() => driverForm.submit()}
                      >
                        {editingDriverId ? "Save Changes" : "Add Driver"}
                      </Button>
                    }
                  >
                    <Form
                      form={driverForm}
                      layout="vertical"
                      onFinish={(vals) =>
                        saveDriver(vals as Omit<CreateTeamDriverInput, "ownerUserId">)
                      }
                    >
                      {[
                        {
                          name: "fullName",
                          label: "Full Name",
                          rules: [{ required: true, message: "Required" }],
                        },
                        {
                          name: "email",
                          label: "Email",
                          rules: [
                            {
                              required: true,
                              type: "email" as const,
                              message: "Valid email required",
                            },
                          ],
                        },
                        {
                          name: "phone",
                          label: "Phone",
                          rules: [{ required: true, message: "Required" }],
                        },
                        {
                          name: "licenseNumber",
                          label: "License Number",
                          rules: [{ required: true, message: "Required" }],
                        },
                        {
                          name: "city",
                          label: "City",
                          rules: [{ required: true, message: "Required" }],
                        },
                      ].map((f) => (
                        <Form.Item
                          key={f.name}
                          name={f.name}
                          label={<span className="font-semibold text-gray-700">{f.label}</span>}
                          rules={f.rules}
                        >
                          <Input size="large" className="rounded-3xl h-12" />
                        </Form.Item>
                      ))}
                    </Form>
                  </Drawer>
                </div>
              )}

              {/* — VEHICLE FLEET MODULE — */}
              {activeModule === "settings" && (
                <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                  <div className="flex items-center justify-between">
                    <div>
                      <Title level={2} style={{ margin: 0 }}>
                        Vehicle Fleet
                      </Title>
                      <Text type="secondary" className="text-lg">
                        Manage all your registered vehicles.
                      </Text>
                    </div>
                    <Button
                      type="primary"
                      icon={<Plus size={16} />}
                      size="large"
                      className="bg-gradient-primary border-none rounded-3xl font-bold shadow-glow flex items-center gap-2"
                      onClick={() => {
                        setEditingVehicleId(null);
                        vehicleForm.resetFields();
                        setVehicleDrawerOpen(true);
                      }}
                    >
                      Add Vehicle
                    </Button>
                  </div>

                  {vehiclesLoading ? (
                    <div className="flex justify-center py-16">
                      <Spin size="large" />
                    </div>
                  ) : vehicles.length === 0 ? (
                    <Card className="rounded-2xl border border-white/60 shadow-soft bg-white/80 backdrop-blur-md text-center py-16">
                      <Car size={48} className="mx-auto text-gray-300 mb-4" />
                      <Text type="secondary" className="text-lg block">
                        No vehicles registered yet.
                      </Text>
                      <Text type="secondary" className="text-sm">
                        Add your first vehicle to start hosting trips.
                      </Text>
                      <div className="mt-6">
                        <Button
                          type="primary"
                          icon={<Plus size={16} />}
                          className="bg-gradient-primary border-none rounded-3xl"
                          onClick={() => {
                            setEditingVehicleId(null);
                            vehicleForm.resetFields();
                            setVehicleDrawerOpen(true);
                          }}
                        >
                          Add vehicle
                        </Button>
                      </div>
                    </Card>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                      {vehicles.map((v) => (
                        <div
                          key={v.id}
                          className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden group"
                        >
                          <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/5 to-white/0 pointer-events-none" />
                          <div className="flex justify-between items-start mb-4 relative z-10">
                            <div>
                              <p className="text-gray-400 text-[10px] uppercase tracking-widest font-bold">
                                Registered Vehicle
                              </p>
                              <div className="flex items-center gap-1.5 mt-1">
                                <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                <p className="text-emerald-400 text-xs font-bold uppercase tracking-wider">
                                  Active
                                </p>
                              </div>
                            </div>
                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                className="h-8 w-8 rounded-3xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                                onClick={() => {
                                  setEditingVehicleId(v.id);
                                  const parts = v.modelName.split(" ");
                                  vehicleForm.setFieldsValue({
                                    make: parts[0] ?? "",
                                    model: parts.slice(1).join(" ") || v.modelName,
                                    color: v.color ?? "",
                                    plate: v.plateNumber,
                                    seats: v.seatCapacity,
                                  });
                                  setVehicleDrawerOpen(true);
                                }}
                              >
                                <Pencil size={14} />
                              </button>
                              <Popconfirm
                                title="Remove this vehicle?"
                                onConfirm={() => removeVehicle(v.id)}
                                okText="Remove"
                                okButtonProps={{ danger: true }}
                              >
                                <button className="h-8 w-8 rounded-3xl bg-red-500/20 hover:bg-red-500/40 flex items-center justify-center transition-colors">
                                  <Trash2 size={14} />
                                </button>
                              </Popconfirm>
                            </div>
                          </div>
                          <p className="text-xl font-bold relative z-10">{v.modelName}</p>
                          <p className="text-gray-400 text-sm relative z-10">
                            {v.color || "—"} · {v.seatCapacity} seats
                          </p>
                          <div className="mt-4 bg-white/10 rounded-2xl p-3 border border-white/10 relative z-10">
                            <p className="text-gray-400 text-[10px] uppercase tracking-widest font-bold mb-0.5">
                              Plate
                            </p>
                            <p className="text-white font-mono text-lg tracking-widest">
                              {v.plateNumber}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {/* — CUSTOMER HUB MODULE — */}
              {activeModule === "customers" && (
                <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                  <div className="flex flex-col gap-2">
                    <Title level={2} className="m-0">
                      Customer Hub
                    </Title>
                    <Text type="secondary" className="text-lg">
                      Manage relationships and feedback for your passengers.
                    </Text>
                  </div>

                  <div className="grid grid-cols-1 gap-6">
                    {bookingsLoading ? (
                      <div className="flex justify-center p-20 bg-white/40 rounded-3xl backdrop-blur-md">
                        <Spin size="large" tip="Loading customer directory..." />
                      </div>
                    ) : bookings.length === 0 ? (
                      <Card className="rounded-3xl border border-white/60 shadow-soft bg-white/60 backdrop-blur-md p-16 text-center">
                        <div className="mx-auto w-24 h-24 bg-purple-100 rounded-full flex items-center justify-center text-purple-600 mb-6">
                          <Users2 size={40} />
                        </div>
                        <Title level={3}>No customers yet</Title>
                        <Text type="secondary" className="text-lg block mb-8">
                          Your passengers will appear here once they start booking your trips.
                        </Text>
                        <Button
                          type="primary"
                          size="large"
                          onClick={() => {
                            setShowTripForm(false);
                            setActiveModule("trips");
                          }}
                          className="bg-gradient-primary border-none h-12 px-8 rounded-3xl font-bold"
                        >
                          Publish Your First Trip
                        </Button>
                      </Card>
                    ) : (
                      <div className="space-y-6">
                        {/* Grouping bookings by passenger */}
                        {Object.values(
                          bookings.reduce((acc: any, booking) => {
                            if (!acc[booking.travelerId]) {
                              acc[booking.travelerId] = {
                                travelerId: booking.travelerId,
                                name: booking.passengerName,
                                phone: booking.passengerPhone,
                                totalTrips: 0,
                                avgRating: 0,
                                ratingsCount: 0,
                                latestBookings: [],
                              };
                            }
                            acc[booking.travelerId].totalTrips += 1;
                            acc[booking.travelerId].latestBookings.push(booking);
                            if (booking.ratingByHost) {
                              acc[booking.travelerId].ratingsCount += 1;
                              acc[booking.travelerId].avgRating += booking.ratingByHost;
                            }
                            return acc;
                          }, {}),
                        ).map((customer: any) => {
                          const anyVerified = customer.latestBookings.some(
                            (b: Booking) => b.verified,
                          );
                          return (
                          <Card
                            key={customer.travelerId}
                            className="rounded-2xl border border-white/60 shadow-soft hover:shadow-card transition-all bg-white/80 backdrop-blur-md overflow-hidden"
                            bodyStyle={{ padding: 16 }}
                          >
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                              <div className="flex items-center gap-3">
                                <Avatar
                                  size={44}
                                  className="bg-gradient-primary shadow-soft flex-shrink-0"
                                >
                                  {customer.name[0]}
                                </Avatar>
                                <div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <Title level={5} className="m-0">
                                      {customer.name}
                                    </Title>
                                    {anyVerified && (
                                      <Tag
                                        color="green"
                                        className="rounded-full px-2 border-none font-bold uppercase text-[10px] m-0"
                                      >
                                        Verified
                                      </Tag>
                                    )}
                                    {customer.totalTrips >= 3 && (
                                      <Tag
                                        color="gold"
                                        className="rounded-full px-2 border-none font-bold uppercase text-[10px] m-0"
                                      >
                                        Frequent
                                      </Tag>
                                    )}
                                    <div className="flex items-center gap-1 bg-emerald-500/10 px-1.5 py-0.5 rounded-full border border-emerald-500/20">
                                      <Star
                                        size={10}
                                        className="text-emerald-600 fill-emerald-600"
                                      />
                                      <Text className="text-[11px] text-emerald-700 font-bold">
                                        {customer.ratingsCount > 0
                                          ? (customer.avgRating / customer.ratingsCount).toFixed(1)
                                          : "New"}
                                      </Text>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 mt-1 text-gray-500 text-xs">
                                    <Text type="secondary" className="text-xs">{customer.phone}</Text>
                                    <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                                    <Text type="secondary" className="text-xs">{customer.totalTrips} Trips</Text>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  type="primary"
                                  size="middle"
                                  className="h-9 rounded-xl bg-purple-600 border-none font-semibold shadow-soft"
                                  onClick={() => {
                                    setSelectedBooking(customer.latestBookings[0]);
                                    setRatingValue(customer.latestBookings[0].ratingByHost || 5);
                                    setRatingComment(
                                      customer.latestBookings[0].commentByHost || "",
                                    );
                                    setRatingModalVisible(true);
                                  }}
                                >
                                  Rate Latest Trip
                                </Button>
                              </div>
                            </div>

                            <div className="mt-4 pt-4 border-t border-gray-100">
                              <Text
                                strong
                                className="text-gray-400 uppercase text-[10px] tracking-widest block mb-3"
                              >
                                Trip History with you
                              </Text>
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {customer.latestBookings.slice(0, 3).map((b: Booking) => (
                                  <div
                                    key={b.id}
                                    className="bg-gray-50/50 p-3 rounded-xl border border-gray-100 flex flex-col gap-2"
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <Text
                                        type="secondary"
                                        className="text-[10px] uppercase tracking-wider"
                                      >
                                        {dayjs(b.createdAt).format("MMM D, YYYY")}
                                      </Text>
                                      <Tag
                                        color={
                                          b.status === "confirmed"
                                            ? "green"
                                            : b.status === "completed"
                                              ? "blue"
                                              : "orange"
                                        }
                                        className="rounded-full text-[9px] border-none font-bold uppercase px-1.5 m-0"
                                      >
                                        {b.status}
                                      </Tag>
                                    </div>
                                    <Text className="text-xs font-semibold">
                                      {b.seatsBooked} Seat{b.seatsBooked > 1 ? "s" : ""} • ₹{b.segmentPrice}
                                    </Text>

                                    {b.verified && (
                                      <div className="flex items-center gap-1.5 rounded-lg bg-emerald-50 border border-emerald-200 px-2 py-1.5">
                                        <Star size={12} className="text-emerald-600 fill-emerald-600" />
                                        <Text className="text-[11px] font-bold text-emerald-700">
                                          Customer Verified
                                        </Text>
                                      </div>
                                    )}

                                    {b.ratingByHost && (
                                      <div className="flex items-center gap-1.5">
                                        {[...Array(5)].map((_, i) => (
                                          <Star
                                            key={i}
                                            size={10}
                                            className={
                                              i < b.ratingByHost!
                                                ? "text-amber-400 fill-amber-400"
                                                : "text-gray-200"
                                            }
                                          />
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </Card>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <Modal
                    title={
                      <div className="flex items-center gap-3 pb-2 border-b border-gray-100">
                        <div className="p-2 bg-amber-100 rounded-3xl text-amber-600">
                          <Star size={20} fill="currentColor" />
                        </div>
                        <div>
                          <Title level={4} className="m-0">
                            Rate Passenger
                          </Title>
                          <Text type="secondary" className="text-xs">
                            Your feedback helps the community stay safe.
                          </Text>
                        </div>
                      </div>
                    }
                    open={ratingModalVisible}
                    onCancel={() => setRatingModalVisible(false)}
                    footer={null}
                    centered
                    width={500}
                    className="rounded-3xl overflow-hidden"
                  >
                    <div className="py-6 space-y-8">
                      <div className="text-center">
                        <Text
                          type="secondary"
                          className="uppercase text-[10px] tracking-[0.2em] font-bold block mb-4"
                        >
                          Select Rating
                        </Text>
                        <div className="flex justify-center gap-2">
                          {[1, 2, 3, 4, 5].map((val) => (
                            <button
                              key={val}
                              onClick={() => setRatingValue(val)}
                              className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${ratingValue >= val
                                ? "bg-amber-400 text-white shadow-glow scale-110"
                                : "bg-gray-100 text-gray-300 hover:bg-gray-200"
                                }`}
                            >
                              <Star
                                size={28}
                                fill={ratingValue >= val ? "white" : "transparent"}
                                strokeWidth={2.5}
                              />
                            </button>
                          ))}
                        </div>
                        <div className="mt-4">
                          <Title level={5} className="text-amber-600">
                            {ratingValue === 5
                              ? "Excellent Traveler"
                              : ratingValue === 4
                                ? "Very Good"
                                : ratingValue === 3
                                  ? "Good Experience"
                                  : ratingValue === 2
                                    ? "Below Average"
                                    : "Poor Experience"}
                          </Title>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <Text strong className="text-gray-700">
                          Write a quick note (Optional)
                        </Text>
                        <Input.TextArea
                          rows={4}
                          placeholder="e.g. Very punctual and friendly passenger!"
                          value={ratingComment}
                          onChange={(e) => setRatingComment(e.target.value)}
                          className="rounded-2xl border-gray-200 p-4 focus:ring-2 focus:ring-purple-500/20"
                        />
                      </div>

                      <div className="flex gap-4 pt-4">
                        <Button
                          block
                          size="large"
                          onClick={() => setRatingModalVisible(false)}
                          className="h-14 rounded-2xl font-bold text-gray-500"
                        >
                          Cancel
                        </Button>
                        <Button
                          type="primary"
                          block
                          size="large"
                          loading={submittingRating}
                          onClick={() => {
                            if (!selectedBooking) return;
                            submitRating({
                              bookingId: selectedBooking.id,
                              rating: ratingValue,
                              comment: ratingComment,
                            });
                          }}
                          className="h-14 rounded-2xl bg-gradient-primary border-none font-bold shadow-glow"
                        >
                          Submit Feedback
                        </Button>
                      </div>
                    </div>
                  </Modal>
                </div>
              )}

              {/* — ONBOARDING MODULE — */}
              {activeModule === "onboarding" && (
                <div className="max-w-2xl mx-auto space-y-10 animate-in fade-in slide-in-from-right-4 duration-500">
                  <div className="text-center">
                    <div className="mx-auto w-20 h-20 bg-gradient-primary rounded-3xl flex items-center justify-center text-white shadow-glow mb-6">
                      <Sparkles size={40} />
                    </div>
                    <Title level={2}>Host Onboarding</Title>
                    <Text type="secondary" className="text-lg">
                      Register your vehicle and documents to get verified.
                    </Text>
                  </div>

                  <Card className="rounded-3xl border border-white/60 shadow-card bg-white/80 backdrop-blur-md p-8">
                    <Form
                      layout="vertical"
                      initialValues={{
                        seatCapacity: 4,
                        phone:
                          (user?.prefs as Record<string, unknown> | undefined)?.phone ??
                          (user as { phone?: string } | null)?.phone ??
                          "",
                      }}
                      onFinish={async (v) => {
                        if (!user) return;
                        setOnboardingSubmitting(true);
                        try {
                          const phoneDigits = String(v.phone || "").replace(/[^\d]/g, "");
                          // The `drivers` collection requires a non-empty email.
                          // Phone-based accounts may have no real email, so fall
                          // back to a deterministic phone-derived address.
                          const profileEmail =
                            user.email && user.email.trim()
                              ? user.email
                              : `u${phoneDigits}@phone.coolpool.in`;

                          // Documents are optional — a failed upload must never
                          // block verification, so each upload is best-effort.
                          let regDocId: string | undefined;
                          let insDocId: string | undefined;
                          if (regFileList[0]?.originFileObj) {
                            try {
                              const up = await storage.createFile(
                                appwriteConfig.driverDocsBucketId,
                                ID.unique(),
                                regFileList[0].originFileObj as File,
                              );
                              regDocId = up.$id;
                            } catch {
                              message.warning("Registration document upload failed — you can add it later.");
                            }
                          }
                          if (insFileList[0]?.originFileObj) {
                            try {
                              const up = await storage.createFile(
                                appwriteConfig.driverDocsBucketId,
                                ID.unique(),
                                insFileList[0].originFileObj as File,
                              );
                              insDocId = up.$id;
                            } catch {
                              message.warning("Insurance document upload failed — you can add it later.");
                            }
                          }

                          // Profile + vehicle are what grant verification — these
                          // run after uploads so a doc failure can't abort them.
                          await upsertDriverProfile({
                            userId: user.$id,
                            fullName: user.name || String(v.phone || ""),
                            email: profileEmail,
                            phone: String(v.phone),
                            licenseNumber: String(v.licenseNumber),
                            city: String(v.city),
                          });

                          await upsertDriverVehicle({
                            driverUserId: user.$id,
                            modelName: `${v.make} ${v.model}`.trim(),
                            plateNumber: v.plate,
                            seatCapacity: 5,
                            color: v.color,
                            registrationDoc: regDocId,
                            insuranceDoc: insDocId,
                          });

                          await assignRole(user.$id, "driver");
                          message.success("Onboarding complete! You are now a verified host.");
                          await queryClient.invalidateQueries({ queryKey: ["driver-vehicles"] });
                          await refreshRoles();
                          setActiveModule("dashboard");
                        } catch (err) {
                          message.error(err instanceof Error ? err.message : "Onboarding failed");
                        } finally {
                          setOnboardingSubmitting(false);
                        }
                      }}
                    >
                      <Divider>
                        <Text className="text-xs font-bold uppercase tracking-widest text-purple-600">
                          Personal & License
                        </Text>
                      </Divider>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
                        <Form.Item name="phone" label="Phone Number" rules={[{ required: true }]}>
                          <Input
                            size="large"
                            className="rounded-2xl"
                            placeholder="+91 98765 43210"
                          />
                        </Form.Item>
                        <Form.Item name="city" label="City" rules={[{ required: true }]}>
                          <Input size="large" className="rounded-2xl" placeholder="Chennai" />
                        </Form.Item>
                        <Form.Item
                          name="licenseNumber"
                          label="Driving License Number"
                          rules={[{ required: true }]}
                          className="md:col-span-2"
                        >
                          <Input
                            size="large"
                            className="rounded-2xl"
                            placeholder="TN01 20150012345"
                          />
                        </Form.Item>
                      </div>

                      <Divider orientation="left" className="mt-8">
                        <Text className="text-xs font-bold uppercase tracking-widest text-purple-600">
                          Vehicle Information
                        </Text>
                      </Divider>
                      <div className="grid grid-cols-2 gap-x-6">
                        <Form.Item name="make" label="Make" rules={[{ required: true }]}>
                          <Input size="large" className="rounded-2xl" placeholder="Hyundai" />
                        </Form.Item>
                        <Form.Item name="model" label="Model" rules={[{ required: true }]}>
                          <Input size="large" className="rounded-2xl" placeholder="Creta" />
                        </Form.Item>
                        <Form.Item name="plate" label="License Plate" rules={[{ required: true }]}>
                          <Input
                            size="large"
                            className="rounded-2xl font-mono"
                            placeholder="TN 01 AB 1234"
                          />
                        </Form.Item>
                      </div>

                      <Divider orientation="left" className="mt-8">
                        <Text className="text-xs font-bold uppercase tracking-widest text-purple-600">
                          Documents
                        </Text>
                      </Divider>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                        <div>
                          <Text className="text-sm font-medium mb-2 block">
                            Registration Document
                          </Text>
                          <Upload
                            beforeUpload={() => false}
                            maxCount={1}
                            fileList={regFileList}
                            onChange={({ fileList }) => setRegFileList(fileList)}
                          >
                            <Button
                              block
                              size="large"
                              className="rounded-2xl border-dashed h-20 flex flex-col items-center justify-center gap-1"
                            >
                              <Plus size={18} />
                              <span className="text-xs">Upload RC</span>
                            </Button>
                          </Upload>
                        </div>
                        <div>
                          <Text className="text-sm font-medium mb-2 block">Insurance Policy</Text>
                          <Upload
                            beforeUpload={() => false}
                            maxCount={1}
                            fileList={insFileList}
                            onChange={({ fileList }) => setInsFileList(fileList)}
                          >
                            <Button
                              block
                              size="large"
                              className="rounded-2xl border-dashed h-20 flex flex-col items-center justify-center gap-1"
                            >
                              <Plus size={18} />
                              <span className="text-xs">Upload Insurance</span>
                            </Button>
                          </Upload>
                        </div>
                      </div>

                      <Button
                        type="primary"
                        htmlType="submit"
                        block
                        size="large"
                        loading={onboardingSubmitting}
                        className="bg-gradient-primary border-none rounded-2xl h-14 font-bold text-lg shadow-glow"
                      >
                        Complete Verification
                      </Button>
                    </Form>
                  </Card>
                </div>
              )}
            </Content>
          </Layout>
        </Layout>

        {/* App-like Mobile Bottom Navigation */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-lg border-t border-gray-200 pb-safe z-50 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
          <div className="flex justify-around items-center h-16">
            <button
              className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${activeModule === "dashboard" ? "text-primary" : "text-gray-400"}`}
              onClick={() => setActiveModule("dashboard")}
            >
              <LayoutDashboard size={20} />
              <span className="text-[10px] font-semibold">Home</span>
            </button>

            <button
              className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${activeModule === "trips" ? "text-primary" : "text-gray-400"}`}
              onClick={() => {
                setShowTripForm(false);
                setActiveModule("trips");
              }}
            >
              <div
                className={`p-1.5 rounded-full ${activeModule === "trips" ? "bg-primary/10" : ""}`}
              >
                <PlusCircle size={22} />
              </div>
              <span className="text-[10px] font-semibold -mt-1">New Trip</span>
            </button>

            <button
              className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${activeModule === "history" ? "text-primary" : "text-gray-400"}`}
              onClick={() => setActiveModule("history")}
            >
              <History size={20} />
              <span className="text-[10px] font-semibold">History</span>
            </button>

            <button
              className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${activeModule === "customers" ? "text-primary" : "text-gray-400"}`}
              onClick={() => setActiveModule("customers")}
            >
              <UserCheck size={20} />
              <span className="text-[10px] font-semibold">Users</span>
            </button>

            <button
              className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${activeModule === "drivers" ? "text-primary" : "text-gray-400"}`}
              onClick={() => setActiveModule("drivers")}
            >
              <Users2 size={20} />
              <span className="text-[10px] font-semibold">Drivers</span>
            </button>

            <button
              className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${activeModule === "settings" ? "text-primary" : "text-gray-400"}`}
              onClick={() => setActiveModule("settings")}
            >
              <Car size={20} />
              <span className="text-[10px] font-semibold">Fleet</span>
            </button>
          </div>
        </div>
      </div>

      {/* Manage Passengers Drawer */}
      {managingTripId &&
        (() => {
          const managingTrip = trips.find((t) => t.id === managingTripId);
          const tripBookings = bookings.filter((b) => b.tripId === managingTripId);
          const seatsBooked = tripBookings.reduce((sum, b) => sum + (b.seatsBooked || 0), 0);

          return (
            <Drawer
              title={null}
              placement="right"
              width={480}
              onClose={() => setManagingTripId(null)}
              open={!!managingTripId}
              closable={false}
              className="bg-gray-50"
              styles={{ body: { padding: 0 } }}
            >
              {managingTrip && (
                <div className="h-full flex flex-col">
                  <div className="bg-gradient-primary p-6 text-white relative">
                    <Button
                      type="text"
                      icon={<XCircle size={24} className="text-white/80 hover:text-white" />}
                      onClick={() => setManagingTripId(null)}
                      className="absolute top-4 right-4 p-0 hover:bg-transparent"
                    />
                    <div className="mt-4">
                      <Tag
                        color="purple"
                        className="border-none bg-white/20 text-white rounded-full px-3 py-1 mb-4"
                      >
                        {dayjs(managingTrip.departureAt).format("MMM D, YYYY • h:mm A")}
                      </Tag>
                      <div className="space-y-4">
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full bg-white flex-shrink-0"></div>
                          <Text className="text-white font-medium text-lg leading-tight">
                            {managingTrip.fromLocation}
                          </Text>
                        </div>
                        <div className="ml-1 w-0.5 h-6 bg-white/30"></div>
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full bg-white flex-shrink-0"></div>
                          <Text className="text-white font-medium text-lg leading-tight">
                            {managingTrip.toLocation}
                          </Text>
                        </div>
                      </div>

                      <div className="mt-6 bg-white/10 rounded-2xl p-4 backdrop-blur-sm border border-white/20">
                        <div className="flex justify-between items-center mb-2">
                          <Text className="text-white/80 font-medium">Capacity</Text>
                          <Text className="text-white font-bold">
                            {seatsBooked} / {managingTrip.totalSeats} booked
                          </Text>
                        </div>
                        <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-white rounded-full transition-all duration-500"
                            style={{
                              width: `${Math.min(100, (seatsBooked / (managingTrip.totalSeats || 1)) * 100)}%`,
                            }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-6">
                    <Title level={4} className="mb-6 font-bold text-gray-800">
                      Passenger Roster
                    </Title>

                    {tripBookings.length === 0 ? (
                      <div className="text-center py-12 bg-white rounded-3xl border border-gray-100 shadow-sm">
                        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
                          <User size={32} />
                        </div>
                        <Text className="text-gray-500 font-medium text-base">
                          No passengers yet
                        </Text>
                        <p className="text-gray-400 text-sm mt-1">
                          Bookings for this trip will appear here.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {tripBookings.map((b) => (
                          <Card
                            key={b.id}
                            className="rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all overflow-hidden"
                          >
                            <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-50">
                              <div className="flex items-center gap-3">
                                <Avatar
                                  size={48}
                                  className="bg-gradient-primary shadow-sm text-lg font-bold text-white"
                                >
                                  {b.passengerName?.[0] || "P"}
                                </Avatar>
                                <div>
                                  <Text strong className="block text-base text-gray-900">
                                    {b.passengerName}
                                  </Text>
                                  <Text type="secondary" className="text-sm">
                                    {b.passengerPhone}
                                  </Text>
                                </div>
                              </div>
                              <div className="text-right">
                                <Text strong className="block text-lg text-emerald-600">
                                  ₹{b.segmentPrice}
                                </Text>
                                <Tag
                                  color={b.status === "confirmed" ? "success" : "processing"}
                                  className="m-0 rounded-full uppercase text-[10px] font-bold border-none"
                                >
                                  {b.status}
                                </Tag>
                              </div>
                            </div>

                            <div className="flex gap-4 mb-4 bg-gray-50 p-3 rounded-xl border border-gray-100">
                              <div className="flex flex-col items-center justify-between py-1 w-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-gray-400 z-10"></div>
                                <div className="w-px bg-gray-300 flex-1 my-0.5"></div>
                                <div className="w-1.5 h-1.5 rounded-full bg-primary z-10"></div>
                              </div>
                              <div className="flex-1 flex flex-col justify-between py-0.5 gap-2">
                                <div>
                                  <Text strong className="text-sm text-gray-800 line-clamp-1">
                                    {managingTrip.fromLocation}
                                  </Text>
                                </div>
                                <div>
                                  <Text strong className="text-sm text-gray-800 line-clamp-1">
                                    {managingTrip.toLocation}
                                  </Text>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 text-sm text-gray-600 bg-purple-50 px-3 py-2 rounded-lg border border-purple-100">
                              <User size={16} className="text-primary" />
                              <span className="font-medium text-purple-900">
                                {b.seatsBooked} seats booked
                              </span>
                            </div>

                            <div className="mt-4 pt-4 border-t border-gray-100">
                              {b.verified ? (
                                <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2">
                                  <Star size={14} className="text-emerald-600 fill-emerald-600" />
                                  <Text className="text-sm font-bold text-emerald-700">
                                    Customer Verified
                                  </Text>
                                </div>
                              ) : (
                                <div>
                                  <Text className="text-[10px] uppercase tracking-widest text-gray-400 block mb-2 font-bold">
                                    Boarding OTP
                                  </Text>
                                  <div className="flex items-center gap-3">
                                    <InputOTP
                                      maxLength={4}
                                      value={otpInputs[b.id] || ""}
                                      onChange={(v) =>
                                        setOtpInputs((prev) => ({
                                          ...prev,
                                          [b.id]: v.replace(/\D/g, ""),
                                        }))
                                      }
                                      inputMode="numeric"
                                      containerClassName="flex-1"
                                    >
                                      <InputOTPGroup className="grid w-full grid-cols-4 gap-2">
                                        {[0, 1, 2, 3].map((i) => (
                                          <InputOTPSlot
                                            key={i}
                                            index={i}
                                            className="h-12 w-full rounded-xl border border-border/80 bg-background text-xl font-bold first:rounded-xl last:rounded-xl"
                                          />
                                        ))}
                                      </InputOTPGroup>
                                    </InputOTP>
                                    <Button
                                      type="primary"
                                      loading={verifyingId === b.id}
                                      onClick={() => handleVerifyOtp(b.id)}
                                      className="rounded-xl bg-purple-600 border-none font-semibold h-12 px-5"
                                    >
                                      Verify
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </Drawer>
          );
        })()}
      {/* Add/Edit Vehicle Drawer */}
      <Drawer
        title={editingVehicleId ? "Edit Vehicle" : "Add Vehicle"}
        placement="right"
        width={420}
        open={vehicleDrawerOpen}
        onClose={() => {
          setVehicleDrawerOpen(false);
          vehicleForm.resetFields();
          setCarImagesList([]);
          setEditingVehicleId(null);
        }}
        footer={
          <Button
            type="primary"
            loading={savingVehicle}
            block
            size="large"
            className="bg-gradient-primary border-none rounded-3xl font-bold h-12"
            onClick={() => vehicleForm.submit()}
          >
            {editingVehicleId ? "Save Changes" : "Add Vehicle"}
          </Button>
        }
      >
        <Form
          form={vehicleForm}
          layout="vertical"
          onFinish={(vals) =>
            saveVehicle(vals as { make: string; model: string; color: string; plate: string })
          }
        >
          <div className="grid grid-cols-2 gap-4">
            <Form.Item
              name="make"
              label={<span className="font-semibold text-gray-700">Car</span>}
              rules={[{ required: true, message: "Required" }]}
            >
              <Input size="large" placeholder="Hyundai" className="rounded-3xl h-12" />
            </Form.Item>
            <Form.Item
              name="model"
              label={<span className="font-semibold text-gray-700">Model</span>}
              rules={[{ required: true, message: "Required" }]}
            >
              <Input size="large" placeholder="Creta" className="rounded-3xl h-12" />
            </Form.Item>
          </div>
          <Form.Item
            name="color"
            label={<span className="font-semibold text-gray-700">Color</span>}
          >
            <Input size="large" placeholder="White, Black…" className="rounded-3xl h-12" />
          </Form.Item>
          <Form.Item
            name="plate"
            label={<span className="font-semibold text-gray-700">License Plate</span>}
            rules={[{ required: true, message: "Required" }]}
          >
            <Input
              size="large"
              placeholder="TN 01 AB 1234"
              className="rounded-3xl h-12 font-mono tracking-widest"
            />
          </Form.Item>
          <Form.Item
            label={<span className="font-semibold text-gray-700">Car Images (Optional)</span>}
          >
            <Upload
              listType="picture-card"
              fileList={carImagesList}
              onChange={({ fileList }) => setCarImagesList(fileList)}
              beforeUpload={() => false}
              maxCount={10}
              multiple
            >
              {carImagesList.length >= 10 ? null : (
                <div>
                  <Plus className="mx-auto text-gray-400" size={24} />
                  <div style={{ marginTop: 8 }}>Upload</div>
                </div>
              )}
            </Upload>
          </Form.Item>
        </Form>
      </Drawer>

      {/* Publish Trips Modal */}
      <Modal
        title={publishModalView === "trips" ? "Manage Your Published Trips" : "Publish a New Trip"}
        open={publishTripsModalOpen}
        onCancel={() => {
          setPublishTripsModalOpen(false);
          setPublishModalView("trips");
        }}
        footer={null}
        width={800}
        className="publish-trips-modal"
      >
        {publishModalView === "trips" ? (
          <div className="space-y-6">
            {tripsLoading ? (
              <div className="py-12 text-center">
                <Spin size="large" />
              </div>
            ) : upcomingTrips.length === 0 ? (
              <div className="py-8 text-center">
                <RouteIcon size={32} className="text-purple-500 mx-auto mb-4" />
                <Title level={4}>No trips published yet</Title>
                <Text type="secondary" className="block mb-6">
                  Start sharing your empty seats to earn money on your journeys.
                </Text>
                <Button
                  type="primary"
                  size="large"
                  className="bg-gradient-primary border-none rounded-3xl"
                  onClick={() => setPublishModalView("form")}
                >
                  Publish Your First Trip
                </Button>
              </div>
            ) : (
              <>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {upcomingTrips.map((item) => (
                    <div
                      key={item.id}
                      className="bg-gray-50 rounded-lg border border-gray-200 p-4 hover:shadow-sm transition-all"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <Tag
                          color="purple"
                          className="rounded-full border-none px-3 py-1 font-semibold text-xs m-0"
                        >
                          {dayjs(item.departureAt).format("MMM D, YYYY • h:mm A")}
                        </Tag>
                        <Text strong className="text-lg text-emerald-600">
                          ₹{item.totalPrice}
                        </Text>
                      </div>
                      <div className="flex items-center gap-4 mb-3">
                        <div>
                          <Text className="text-xs text-gray-500 uppercase tracking-wider block mb-0.5">
                            From
                          </Text>
                          <Text strong className="text-sm text-gray-800 line-clamp-1">
                            {item.fromLocation}
                          </Text>
                        </div>
                        <ArrowRight size={16} className="text-gray-300 shrink-0" />
                        <div>
                          <Text className="text-xs text-gray-500 uppercase tracking-wider block mb-0.5">
                            To
                          </Text>
                          <Text strong className="text-sm text-gray-800 line-clamp-1">
                            {item.toLocation}
                          </Text>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <Button
                          type="text"
                          size="small"
                          className="text-primary font-medium p-0"
                          onClick={async () => {
                            const hide = message.loading("Fetching trip details...", 0);
                            try {
                              setEditingTripId(item.id);
                              setIsEditingTrip(true);

                              const stops = await listTripStops(item.id);
                              const fromStop = stops.find((s) => s.stopType === "pickup");
                              const toStop = stops.find((s) => s.stopType === "drop");

                              if (fromStop)
                                setSelectedFrom({
                                  label: fromStop.location,
                                  value: fromStop.location,
                                  lat: fromStop.lat,
                                  lng: fromStop.lng,
                                });
                              if (toStop)
                                setSelectedTo({
                                  label: toStop.location,
                                  value: toStop.location,
                                  lat: toStop.lat,
                                  lng: toStop.lng,
                                });

                              form.setFieldsValue({
                                fromLocation: item.fromLocation,
                                toLocation: item.toLocation,
                                departureAt: dayjs(item.departureAt),
                                totalSeats: item.totalSeats,
                                totalTripPrice: Math.round(
                                  item.totalPrice / (item.totalSeats || 1),
                                ),
                                vehicleId: item.vehicleId,
                                driverId: item.assignedDriverId,
                              });

                              setPublishModalView("form");
                              message.success("Trip loaded for editing.");
                            } catch (err) {
                              console.error("[EditTrip] Error:", err);
                              message.error("Failed to load trip details.");
                            } finally {
                              hide();
                            }
                          }}
                        >
                          Edit
                        </Button>
                        <Button
                          type="text"
                          size="small"
                          danger
                          className="font-medium p-0"
                          onClick={() => message.info("Cancel functionality coming soon")}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                <Button
                  type="primary"
                  size="large"
                  block
                  className="bg-gradient-primary border-none rounded-3xl mt-6"
                  onClick={() => {
                    setEditingTripId(null);
                    setIsEditingTrip(false);
                    form.resetFields();
                    setSelectedFrom(null);
                    setSelectedTo(null);
                    setPublishModalView("form");
                  }}
                >
                  Publish New Trip
                </Button>
              </>
            )}
          </div>
        ) : (
          <div className="max-h-[70vh] overflow-y-auto">
            <Form
              form={form}
              layout="vertical"
              onFinish={onFinish}
              onValuesChange={() => {
                setPendingTripPayload(null);
                setSegmentPricePreview([]);
              }}
              initialValues={{
                totalSeats: 3,
                seatConfig: ["R1-C0", "R1-C1", "R1-C2"] as SeatId[],
                driverId: user?.$id,
              }}
              requiredMark={false}
            >
              <div className="space-y-6">
                {/* Route Information */}
                <div>
                  <Title level={5} className="mb-3 flex items-center gap-2">
                    <RouteIcon size={18} className="text-primary" /> Route
                  </Title>
                  <div className="bg-gray-50/50 p-4 rounded-xl border border-gray-100 space-y-3">
                    <Form.Item
                      label={
                        <span className="font-semibold text-sm text-gray-700">From Location</span>
                      }
                      name="fromLocation"
                      rules={[{ required: true, message: "Please enter origin" }]}
                      className="mb-0"
                    >
                      <AutoComplete
                        options={fromOptions}
                        onSearch={(text) => {
                          setSelectedFrom(null);
                          void searchCities(text, "from");
                        }}
                        onSelect={(value) => onSelectCity(value, "from")}
                      >
                        <Input
                          placeholder="Search city"
                          size="large"
                          style={{ borderRadius: '8px', height: '48px' }}
                        />
                      </AutoComplete>
                    </Form.Item>

                    <Form.Item
                      label={
                        <span className="font-semibold text-sm text-gray-700">To Location</span>
                      }
                      name="toLocation"
                      rules={[{ required: true, message: "Please enter destination" }]}
                      className="mb-0"
                    >
                      <AutoComplete
                        options={toOptions}
                        onSearch={(text) => {
                          setSelectedTo(null);
                          void searchCities(text, "to");
                        }}
                        onSelect={(value) => onSelectCity(value, "to")}
                      >
                        <Input
                          placeholder="Search city"
                          size="large"
                          style={{ borderRadius: '8px', height: '48px' }}
                        />
                      </AutoComplete>
                    </Form.Item>

                    {renderIntermediateStops()}
                  </div>
                </div>

                {/* Schedule */}
                <div>
                  <Title level={5} className="mb-3 flex items-center gap-2">
                    <Sparkles size={18} className="text-primary" /> Schedule
                  </Title>
                  <Form.Item
                    label={
                      <span className="font-semibold text-sm text-gray-700">Departure Time</span>
                    }
                    name="departureAt"
                    rules={[{ required: true, message: "Please select time" }]}
                    className="mb-0"
                  >
                    <DatePicker
                      showTime={{ format: "h:mm A", use12Hours: true, minuteStep: 15 }}
                      size="large"
                      style={{ borderRadius: '8px', height: '48px', width: '100%' }}
                      format="YYYY-MM-DD h:mm A"
                      placement="bottomLeft"
                      popupClassName="trip-publish-datepicker"
                      getPopupContainer={() => document.body}
                      disabledDate={disabledTripDate}
                      disabledTime={disabledTripTime}
                    />
                  </Form.Item>
                </div>

                {renderSegmentPricePreview()}

                {/* Vehicle & Driver */}
                <div>
                  <Title level={5} className="mb-3 flex items-center gap-2">
                    <Car size={18} className="text-primary" /> Vehicle & Driver
                  </Title>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Form.Item
                      label={<span className="font-semibold text-sm text-gray-700">Vehicle</span>}
                      name="vehicleId"
                      rules={[{ required: true, message: "Please select a vehicle" }]}
                      className="mb-0"
                    >
                      <Select
                        size="large"
                        placeholder="Select vehicle"
                        className="h-12 w-full"
                        style={{ borderRadius: '8px' }}
                        options={[
                          ...vehicles.map((v) => ({
                            label: `${v.modelName} · ${v.plateNumber}`,
                            value: v.id,
                          })),
                          {
                            label: (
                              <span className="text-primary font-medium flex items-center gap-1">
                                <Plus size={14} /> Add vehicle
                              </span>
                            ),
                            value: "ADD_NEW_VEHICLE",
                          },
                        ]}
                        onChange={(val) => {
                          if (val === "ADD_NEW_VEHICLE") {
                            form.setFieldsValue({ vehicleId: undefined });
                            setEditingVehicleId(null);
                            vehicleForm.resetFields();
                            setVehicleDrawerOpen(true);
                            return;
                          }
                          const selectedVeh = vehicles.find((v) => v.id === val);
                          if (selectedVeh) {
                            form.setFieldsValue({ totalSeats: selectedVeh.seatCapacity });
                          }
                        }}
                      />
                    </Form.Item>
                    <Form.Item
                      label={<span className="font-semibold text-sm text-gray-700">Driver</span>}
                      name="driverId"
                      rules={[{ required: true, message: "Please select a driver" }]}
                      className="mb-0"
                    >
                      <Select
                        size="large"
                        placeholder="Select driver"
                        className="h-12 w-full"
                        style={{ borderRadius: '8px' }}
                        options={[
                          {
                            label: `You (${user?.name?.split(" ")[0] || "Owner"})`,
                            value: user?.$id || "",
                          },
                          ...teamDrivers.map((d) => ({ label: `${d.fullName}`, value: d.id })),
                        ]}
                      />
                    </Form.Item>
                  </div>
                </div>

                {/* Seating */}
                <div>
                  <Title level={5} className="mb-3">
                    Configure Seating
                  </Title>
                  <Form.Item
                    name="seatConfig"
                    rules={[{ required: true, message: "Select seats" }]}
                  >
                    <SeatPicker
                      onChange={(seats) => form.setFieldsValue({ totalSeats: seats.length })}
                    />
                  </Form.Item>
                </div>

                {/* Pricing */}
                <div>
                  <Title level={5} className="mb-3">
                    Pricing
                  </Title>
                  <Form.Item
                    label={
                      <span className="font-semibold text-sm text-gray-700">
                        Full Trip Price Per Seat
                      </span>
                    }
                    name="totalTripPrice"
                    rules={[{ required: true, message: "Enter price" }]}
                  >
                    <InputNumber
                      prefix="₹"
                      min={0}
                      max={9999}
                      precision={0}
                      size="large"
                      className="w-full h-12"
                      style={{ borderRadius: '8px', height: '48px', width: '100%' }}
                      onChange={(val) => {
                        if (typeof val === "number" && val > 9999) {
                          form.setFieldsValue({ totalTripPrice: 9999 });
                        }
                      }}
                    />
                  </Form.Item>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  <Button
                    htmlType="button"
                    size="large"
                    className="flex-1 rounded-lg"
                    onClick={() => {
                      setPublishModalView("trips");
                      form.resetFields();
                      setEditingTripId(null);
                      setIsEditingTrip(false);
                    }}
                  >
                    Back to Trips
                  </Button>
                  <Button
                    htmlType="submit"
                    type="primary"
                    size="large"
                    className="flex-1 bg-gradient-primary border-none rounded-lg font-semibold"
                  >
                    {pendingTripPayload
                      ? isEditingTrip
                        ? "Confirm Update"
                        : "Confirm & Publish"
                      : "Calculate Route & Prices"}
                  </Button>
                </div>
              </div>
            </Form>
          </div>
        )}
      </Modal>
    </ConfigProvider>
  );
}
