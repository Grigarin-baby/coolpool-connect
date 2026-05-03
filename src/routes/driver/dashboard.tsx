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
  XCircle,
  Banknote,
  Users2,
  Plus,
  Trash2,
  Pencil,
  Star,
  UserCheck,
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
} from "antd";
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
  updateBookingRating,
  updateTrip,
  deleteTripStop,
  listTripStops,
  createTripStop,
  type CreateTeamDriverInput,
} from "@/data/appwrite-repository";
import type { Trip, TripStop, DriverProfile, Booking } from "@/lib/domain";
import { APP_FONT_FAMILY } from "@/lib/fonts";
import { calcPricePerKm } from "@/lib/pricing";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { appwriteConfig } from "@/integrations/appwrite/client";

import logo from "@/assets/logo.png";

dayjs.extend(relativeTime);

const { Header, Content, Sider } = Layout;
const { Title, Text } = Typography;

interface CityOption {
  value: string;
  label: string;
  lat: number;
  lng: number;
  placeId?: string;
}

interface TripFormValues {
  fromLocation: string;
  toLocation: string;
  departureAt: dayjs.Dayjs;
  totalSeats: number;
  totalTripPrice: number;
  vehicleId: string;
  driverId: string;
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

interface IntermediateStopState {
  id: string;
  value: string;
  options: CityOption[];
  selected: CityOption | null;
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
    }[];
  }[];
}

interface DirectionsServiceLike {
  route: (
    request: DirectionsRequest,
    callback: (result: DirectionsResult | null, status: string) => void
  ) => void;
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

export const Route = createFileRoute("/driver/dashboard")({
  head: () => ({
    meta: [
      { title: "Ride Host dashboard — Coolpool" },
      { name: "description", content: "Manage your rides and bookings as a Coolpool ride host." },
    ],
  }),
  component: DriverDashboardPage,
});

function DriverDashboardPage() {
  const { isDriver, user, signOut, loading } = useAuth();
  const [activeModule, setActiveModule] = useState("dashboard");
  const [form] = Form.useForm();
  const queryClient = useQueryClient();
  const [fromOptions, setFromOptions] = useState<CityOption[]>([]);
  const [toOptions, setToOptions] = useState<CityOption[]>([]);
  const [selectedFrom, setSelectedFrom] = useState<CityOption | null>(null);
  const [selectedTo, setSelectedTo] = useState<CityOption | null>(null);
  const [intermediateStops, setIntermediateStops] = useState<IntermediateStopState[]>([]);
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
  const [isEditingTrip, setIsEditingTrip] = useState(false);
  const [ratingModalVisible, setRatingModalVisible] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [ratingValue, setRatingValue] = useState(5);
  const [ratingComment, setRatingComment] = useState("");
  const autocompleteServiceRef = useRef<PlacesAutocompleteServiceLike | null>(null);
  const geocoderRef = useRef<GeocoderLike | null>(null);
  const directionsServiceRef = useRef<DirectionsServiceLike | null>(null);
  const seatsWatch = Form.useWatch("totalSeats", form);
  const totalPriceWatch = Form.useWatch("totalTripPrice", form);

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
    if (!maps?.places?.AutocompleteService || !maps?.Geocoder || !maps?.DirectionsService) return false;
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
    mutationFn: (vals: { make: string; model: string; color: string; plate: string; seats: number }) =>
      user
        ? editingVehicleId
          ? upsertDriverVehicle({ driverUserId: user.$id, modelName: `${vals.make} ${vals.model}`.trim(), plateNumber: vals.plate, seatCapacity: vals.seats, color: vals.color })
          : createDriverVehicle({ driverUserId: user.$id, modelName: `${vals.make} ${vals.model}`.trim(), plateNumber: vals.plate, seatCapacity: vals.seats, color: vals.color })
        : Promise.reject(new Error("Not logged in")),
    onSuccess: () => {
      message.success(editingVehicleId ? "Vehicle updated!" : "Vehicle added!");
      void queryClient.invalidateQueries({ queryKey: ["driver-vehicles"] });
      setVehicleDrawerOpen(false);
      vehicleForm.resetFields();
      setEditingVehicleId(null);
    },
    onError: () => message.error("Failed to save vehicle."),
  });

  const { mutate: removeVehicle } = useMutation({
    mutationFn: (id: string) => deleteDriverVehicle(id),
    onSuccess: () => { message.success("Vehicle removed."); void queryClient.invalidateQueries({ queryKey: ["driver-vehicles"] }); },
    onError: () => message.error("Failed to remove vehicle."),
  });

  // Team drivers
  const { data: teamDrivers = [], isLoading: driversLoading } = useQuery({
    queryKey: ["team-drivers", user?.$id],
    queryFn: () => (user ? listTeamDrivers(user.$id) : Promise.resolve([])),
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
    onSuccess: () => { message.success("Driver removed."); void queryClient.invalidateQueries({ queryKey: ["team-drivers"] }); },
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
      message.success(editingTripId ? "Trip updated." : "Trip created.");
      form.resetFields();
      setEditingTripId(null);
      setIsEditingTrip(false);
      setSelectedFrom(null);
      setSelectedTo(null);
      setIntermediateStops([]);
      void queryClient.invalidateQueries({ queryKey: ["host-trips"] });
      setActiveModule("dashboard");
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
    const validIntermediateStops = intermediateStops.filter(s => s.selected !== null).map(s => s.selected!);

    const dirService = directionsServiceRef.current;
    if (!dirService) {
      message.error("Maps service not ready");
      return;
    }

    console.log("[Publish] Calculating route:", { resolvedFrom, resolvedTo, stops: intermediateStops.length });

    const getCoords = async (loc: { label: string; lat: number; lng: number }) => {
      if (loc.lat !== 0 || loc.lng !== 0) return loc;
      if (!geocoderRef.current) return loc;
      
      console.log("[Publish] Geocoding fallback for:", loc.label);
      return new Promise<{ label: string; lat: number; lng: number }>((resolve) => {
        geocoderRef.current!.geocode({ address: loc.label }, (results, status) => {
          if (status === "OK" && results?.[0]?.geometry?.location) {
            const pos = results[0].geometry.location;
            resolve({ ...loc, lat: pos.lat(), lng: pos.lng() });
          } else {
            console.warn("[Publish] Geocoding failed for:", loc.label, status);
            resolve(loc);
          }
        });
      });
    };

    const finalFrom = await getCoords(resolvedFrom);
    const finalTo = await getCoords(resolvedTo);
    const allStops = [finalFrom, ...validIntermediateStops, finalTo];

    if (finalFrom.lat === 0 || finalTo.lat === 0) {
      message.error("Could not determine coordinates for origin or destination. Please select from the dropdown.");
      return;
    }

    dirService.route({
      origin: { lat: finalFrom.lat, lng: finalFrom.lng },
      destination: { lat: finalTo.lat, lng: finalTo.lng },
      waypoints: validIntermediateStops.map(stop => ({ location: { lat: stop.lat, lng: stop.lng }, stopover: true })),
      travelMode: google.maps.TravelMode.DRIVING,
    }, (result, status) => {
      if (status !== "OK" || !result) {
        console.error("[Publish] Directions API failed:", status, result);
        message.error(`Route calculation failed: ${status}. Please check your stops.`);
        return;
      }
      
      const route = result.routes[0];
      const polyline = route.overview_polyline;
      
      let currentDist = 0;
      const stopsData = allStops.map((stop, i) => {
        if (i > 0) {
          currentDist += (route.legs[i - 1].distance.value / 1000); // converting meters to km
        }
        return {
          stopIndex: i,
          location: stop.label,
          lat: stop.lat,
          lng: stop.lng,
          stopType: i === 0 ? "pickup" as const : (i === allStops.length - 1 ? "drop" as const : "both" as const),
          distanceFromOriginKm: Math.round(currentDist * 10) / 10
        };
      });

      const totalDistanceKm = Math.max(0.1, Math.round(currentDist * 10) / 10);
      const seatPrice = Number(values.totalTripPrice);
      const totalSeats = Number(values.totalSeats);
      const totalPrice = seatPrice * totalSeats;

      const payload = {
        tripData: {
          hostId: user.$id,
          fromLocation: finalFrom.label,
          fromLat: finalFrom.lat,
          fromLng: finalFrom.lng,
          toLocation: finalTo.label,
          toLat: finalTo.lat,
          toLng: finalTo.lng,
          polyline,
          totalDistanceKm,
          totalPrice,
          pricePerKm: calcPricePerKm(totalPrice, totalDistanceKm),
          totalSeats,
          departureAt: values.departureAt.toISOString(),
          notes: `Created from ride host trip module. Total price: ₹${totalPrice}.`,
          vehicleId: values.vehicleId,
          assignedDriverId: values.driverId,
        },
        stopsData
      };

      if (import.meta.env.DEV) {
        console.log("[publish trip] createTrip payload (strings stored in DB):", {
          totalDistanceKm: payload.tripData.totalDistanceKm,
          totalPrice: payload.tripData.totalPrice,
          stopsData: payload.stopsData,
        });
      }

      performCreateTrip(payload);
    });
  };

  const searchCities = async (query: string, target: "from" | "to" | "stop", stopId?: string) => {
    if (target === "from") {
      console.log("[fromLocation] searchCities called", {
        query,
        queryLength: query?.length ?? 0,
        mapsReady,
        hasAutocompleteService: !!autocompleteServiceRef.current,
      });
    }
    if (!query || query.trim().length < 2) {
      if (target === "from") setFromOptions([]);
      else if (target === "to") setToOptions([]);
      else if (target === "stop" && stopId) setIntermediateStops(stops => stops.map(s => s.id === stopId ? { ...s, options: [] } : s));
      return;
    }
    const service = autocompleteServiceRef.current;
    if (!service) return;

    service.getPlacePredictions({ input: query, types: ["(cities)"] }, (predictions, status) => {
      if (target === "from") {
        console.log("[fromLocation] getPlacePredictions callback", {
          status,
          predictionsCount: predictions?.length ?? 0,
          samplePrediction: predictions?.[0]?.description ?? null,
        });
      }
      if (status !== "OK" || !predictions) {
        if (target === "from") setFromOptions([]);
        else if (target === "to") setToOptions([]);
        else if (target === "stop" && stopId) setIntermediateStops(stops => stops.map(s => s.id === stopId ? { ...s, options: [] } : s));
        return;
      }

      const options: CityOption[] = predictions.map((prediction) => ({
        value: prediction.description,
        label: prediction.description,
        placeId: prediction.place_id,
        lat: 0,
        lng: 0,
      }));

      if (target === "from") setFromOptions(options);
      else if (target === "to") setToOptions(options);
      else if (target === "stop" && stopId) setIntermediateStops(stops => stops.map(s => s.id === stopId ? { ...s, options } : s));
    });
  };

  const onSelectCity = (value: string, target: "from" | "to" | "stop", stopId?: string) => {
    let sourceOptions: CityOption[] = [];
    if (target === "from") sourceOptions = fromOptions;
    else if (target === "to") sourceOptions = toOptions;
    else if (target === "stop" && stopId) sourceOptions = intermediateStops.find(s => s.id === stopId)?.options || [];

    const selected = sourceOptions.find((option) => option.value === value);
    if (!selected) return;

    const geocoder = geocoderRef.current;
    if (!geocoder || !selected.placeId) {
      if (target === "from") setSelectedFrom(selected);
      else if (target === "to") setSelectedTo(selected);
      else if (target === "stop" && stopId) setIntermediateStops(stops => stops.map(s => s.id === stopId ? { ...s, selected, value: selected.label } : s));
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
      else if (target === "stop" && stopId) setIntermediateStops(stops => stops.map(s => s.id === stopId ? { ...s, selected: withCoords, value: withCoords.label } : s));
    });
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-hero p-4">
        <Spin size="large" />
      </div>
    );
  }

  if (!isDriver) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-hero p-4">
        <Card className="max-w-md text-center shadow-elevated rounded-none border-none">
          <Text type="danger" strong>
            ACCESS DENIED
          </Text>
          <p className="mt-2 text-muted-foreground">
            This workspace is only for ride host accounts. Please complete ride host onboarding.
          </p>
          <Button type="primary" className="mt-4 rounded-none" onClick={() => void signOut()}>
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
          borderRadius: 16,
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
          },
        },
      }}
    >
      <div className="min-h-screen bg-gradient-hero bg-fixed">
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
              WebkitBackdropFilter: "blur(16px)"
            }}
          >
          <div className="p-4 sm:p-6 pb-2 text-center">
            <img src={logo} alt="Coolpool Logo" className="h-10 w-auto mx-auto object-contain mix-blend-screen" />
          </div>

          <Menu
            mode="inline"
            selectedKeys={[activeModule]}
            onClick={({ key }) => {
              setActiveModule(key);
              if (key === "trips") {
                setEditingTripId(null);
                setIsEditingTrip(false);
                form.resetFields();
                setSelectedFrom(null);
                setSelectedTo(null);
                setIntermediateStops([]);
              }
            }}
            className="border-none px-2 mt-4"
            items={[
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
            ]}
          />

          <div className="absolute bottom-4 left-4 right-4">
            <Card className="rounded-xl bg-gradient-primary border-none shadow-glow text-white overflow-hidden relative">
              <Sparkles className="absolute -right-4 -bottom-4 opacity-20 rotate-12 w-16 h-16" />
              <div className="flex items-center gap-3 relative z-10">
                <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
                  <RouteIcon size={18} className="text-white" />
                </div>
                <div>
                  <p className="text-xs text-white/80 uppercase tracking-wider font-semibold">Active Trips</p>
                  <p className="text-2xl font-bold leading-none mt-1">{tripsLoading ? "..." : trips.length}</p>
                </div>
              </div>
            </Card>
          </div>
        </Sider>

        <Layout className="bg-transparent flex-1">
          <Header className="px-6 flex items-center justify-between border-b border-white/20 sticky top-0 z-50 h-16" style={{ backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" }}>
            <div>
              <Title level={4} style={{ margin: 0 }} className="hidden sm:block font-bold">
                {activeModule === "dashboard" ? "Dashboard Overview" : 
                 activeModule === "trips" ? "Publish Trip" :
                 activeModule === "history" ? "Ride History" :
                 activeModule === "drivers" ? "Drivers" : "Vehicle Fleet"}
              </Title>
              <div className="sm:hidden">
                <img src={logo} alt="Coolpool Logo" className="h-8 w-auto object-contain mix-blend-screen" />
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Dropdown
                menu={{
                  items: [
                    { key: "profile", label: "My Profile", icon: <User size={14} /> },
                    { key: "settings", label: "Settings", icon: <Settings size={14} /> },
                    { type: "divider" },
                    {
                      key: "logout",
                      label: "Logout",
                      icon: <LogOut size={14} />,
                      danger: true,
                      onClick: () => void signOut(),
                    },
                  ],
                }}
                trigger={["click"]}
                placement="bottomRight"
              >
                <div className="group flex items-center h-12 gap-3 bg-white/40 hover:bg-white/60 pl-4 pr-1.5 rounded-full border border-white/20 shadow-sm backdrop-blur-xl transition-all duration-300 cursor-pointer">
                  <div className="hidden md:flex flex-col items-end justify-center h-full gap-0.5">
                    <div className="flex items-center gap-1">
                      <Text strong className="text-[14px] text-gray-800 leading-none">
                        {user?.name || "Ride Host"}
                      </Text>
                      <CheckCircle size={13} className="text-blue-500 fill-blue-500/10" />
                    </div>
                    <Text className="text-[9px] text-gray-500 font-bold uppercase tracking-[0.05em] leading-none">
                      Verified Host
                    </Text>
                  </div>
                  <Badge dot status="processing" offset={[-1, 26]} color="#6b46c1">
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
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                  <div className="flex flex-col gap-1">
                    <Title level={2} style={{ margin: 0 }}>
                      Welcome back, {user?.name?.split(" ")[0]}!
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
                        setIntermediateStops([]);
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
                      <div className="p-2 bg-purple-100 rounded-lg text-purple-600">
                        <RouteIcon size={20} />
                      </div>
                      <Text type="secondary" className="font-medium text-gray-500">Total Rides</Text>
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
                      <div className="p-2 bg-emerald-100 rounded-lg text-emerald-600">
                        <span className="font-bold text-lg">₹</span>
                      </div>
                      <Text type="secondary" className="font-medium text-gray-500">Total Earnings</Text>
                    </div>
                    <Title level={2} style={{ margin: "12px 0 8px 0" }} className="text-gray-800">
                      ₹0
                    </Title>
                    <Text type="secondary" className="text-sm">Settlement pending</Text>
                  </Card>

                  <Card className="rounded-2xl border border-white/60 shadow-soft hover:shadow-card transition-all duration-300 backdrop-blur-md group overflow-hidden relative">
                    <div className="absolute -left-6 -top-6 w-24 h-24 bg-yellow-500/10 rounded-full blur-xl group-hover:bg-yellow-500/20 transition-all"></div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-yellow-100 rounded-lg text-yellow-600">
                          <Sparkles size={20} />
                        </div>
                        <Text type="secondary" className="font-medium text-gray-500">Performance</Text>
                      </div>
                      <Title level={2} style={{ margin: 0 }} className="text-gray-800">
                        5.0
                      </Title>
                    </div>
                    <div className="mt-4 flex gap-1.5 text-yellow-500 bg-yellow-50/50 p-2 rounded-xl inline-flex border border-yellow-100">
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
                        Upcoming & Recent Trips
                      </Title>
                      <Button type="link" className="font-medium">View all history</Button>
                    </div>
                    
                    {tripsLoading ? (
                      <div className="py-12 text-center bg-white/40 rounded-2xl border border-white/60 backdrop-blur-md">
                        <Spin size="large" />
                      </div>
                    ) : trips.length === 0 ? (
                      <div className="py-16 text-center bg-white/40 rounded-2xl border border-white/60 backdrop-blur-md shadow-soft flex flex-col items-center justify-center">
                        <div className="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center mb-4">
                          <RouteIcon size={32} className="text-purple-500" />
                        </div>
                        <Title level={4}>No trips published yet</Title>
                        <Text type="secondary" className="max-w-md mt-2">
                          Your published trips will appear here. Start sharing your empty seats to earn money on your journeys.
                        </Text>
                        <Button 
                          type="primary" 
                          size="large" 
                          className="mt-6 bg-gradient-primary border-none rounded-xl"
                          onClick={() => setActiveModule("trips")}
                        >
                          Publish your first trip
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {trips.slice(0, 5).map(item => (
                          <div key={item.id} className="bg-white/80 rounded-2xl border border-white shadow-soft p-5 hover:shadow-card transition-all duration-300 group">
                            <div className="flex items-center justify-between mb-4">
                              <Tag color="purple" className="rounded-full border-none px-3 py-1 font-semibold text-xs m-0">
                                {dayjs(item.departureAt).format("MMM D, YYYY • h:mm A")}
                              </Tag>
                              <div className="flex items-center gap-2">
                                <Text strong className="text-lg text-emerald-600">₹{item.totalPrice}</Text>
                                <Dropdown
                                  menu={{
                                    items: [
                                      { key: "edit", label: "Edit trip details" },
                                      { key: "cancel", label: "Cancel trip", danger: true },
                                    ],
                                    onClick: async ({ key }) => {
                                      if (key === "edit") {
                                        const hide = message.loading("Fetching trip details...", 0);
                                        try {
                                          setEditingTripId(item.id);
                                          setIsEditingTrip(true);
                                          
                                          // Fetch stops to pre-populate
                                          const stops = await listTripStops(item.id);
                                          const fromStop = stops.find(s => s.stopType === "pickup");
                                          const toStop = stops.find(s => s.stopType === "drop");
                                          const middleStops = stops.filter(s => s.stopType === "both" || (s.stopType !== "pickup" && s.stopType !== "drop"));
                                          
                                          if (fromStop) setSelectedFrom({ label: fromStop.location, value: fromStop.location, lat: fromStop.lat, lng: fromStop.lng });
                                          if (toStop) setSelectedTo({ label: toStop.location, value: toStop.location, lat: toStop.lat, lng: toStop.lng });
                                          
                                          setIntermediateStops(middleStops.map(s => ({
                                            id: s.id,
                                            value: s.location,
                                            options: [],
                                            selected: { label: s.location, value: s.location, lat: s.lat, lng: s.lng }
                                          })));
                                          
                                          form.setFieldsValue({
                                            fromLocation: item.fromLocation,
                                            toLocation: item.toLocation,
                                            departureAt: dayjs(item.departureAt),
                                            totalSeats: item.totalSeats,
                                            totalTripPrice: Math.round(item.totalPrice / (item.totalSeats || 1)),
                                            vehicleId: item.vehicleId,
                                            driverId: item.assignedDriverId,
                                          });
                                          
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
                                    }
                                  }}
                                  trigger={["click"]}
                                >
                                  <Button type="text" icon={<MoreVertical size={18} />} className="text-gray-400 hover:text-gray-700" />
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
                                  <Text className="text-xs text-gray-500 uppercase tracking-wider font-semibold block mb-0.5">Origin</Text>
                                  <Text strong className="text-base text-gray-800 line-clamp-1">{item.fromLocation}</Text>
                                </div>
                                <div>
                                  <Text className="text-xs text-gray-500 uppercase tracking-wider font-semibold block mb-0.5">Destination</Text>
                                  <Text strong className="text-base text-gray-800 line-clamp-1">{item.toLocation}</Text>
                                </div>
                              </div>
                            </div>
                            
                            <div className="mt-5 pt-4 border-t border-gray-100 flex items-center justify-between">
                              <div className="flex items-center gap-2 text-sm text-gray-600">
                                <User size={16} />
                                <span>{item.totalSeats} seats total</span>
                              </div>
                              <Button type="link" className="p-0 text-primary font-medium group-hover:underline">
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
                          setIntermediateStops([]);
                          setActiveModule("trips");
                        }}
                      >
                        <div className="h-12 w-12 mx-auto rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center mb-3 group-hover:bg-purple-600 group-hover:text-white transition-all group-hover:scale-110 duration-300">
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
                        <div className="h-12 w-12 mx-auto rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center mb-3 group-hover:bg-blue-600 group-hover:text-white transition-all group-hover:scale-110 duration-300">
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
                        <div className="h-12 w-12 mx-auto rounded-xl bg-gray-100 text-gray-600 flex items-center justify-center mb-3 group-hover:bg-gray-600 group-hover:text-white transition-all group-hover:scale-110 duration-300">
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
                        className="mt-4 border-white/40 text-white rounded-none hover:bg-white/10"
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
                <div className="flex flex-col gap-1">
                  <Title level={2} style={{ margin: 0 }}>
                    {isEditingTrip ? "Update Trip Details" : "Publish a New Trip"}
                  </Title>
                  <Text type="secondary" className="text-lg">
                    Enter your journey details below to offer seats on your upcoming journey.
                  </Text>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                  <Card className="rounded-2xl border border-white/60 shadow-card bg-white/80 backdrop-blur-md p-6 md:p-8 xl:col-span-2 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-2 bg-gradient-primary"></div>
                    <Form
                      form={form}
                      layout="vertical"
                      onFinish={onFinish}
                      initialValues={{ totalSeats: 4, driverId: user?.$id }}
                      requiredMark={false}
                    >
                      <div className="space-y-8">
                        <div>
                          <Title level={5} className="mb-4 flex items-center gap-2">
                            <RouteIcon size={18} className="text-primary" /> Route Information
                          </Title>
                          <div className="bg-gray-50/50 p-5 rounded-2xl border border-gray-100 space-y-4">
                            <Form.Item
                              label={<span className="font-semibold text-gray-700">From Location</span>}
                              name="fromLocation"
                              rules={[{ required: true, message: "Please enter origin" }]}
                              className="mb-0"
                            >
                              <AutoComplete
                                options={fromOptions}
                                disabled={!mapsReady}
                                onSearch={(text) => {
                                  setSelectedFrom(null);
                                  void searchCities(text, "from");
                                }}
                                onSelect={(value) => onSelectCity(value, "from")}
                              >
                                <Input
                                  placeholder="Search city and select"
                                  size="large"
                                  className="h-14 rounded-xl text-lg"
                                />
                              </AutoComplete>
                            </Form.Item>
                            
                            <div className="relative h-6 flex items-center justify-center">
                              <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gradient-to-b from-gray-300 to-gray-300"></div>
                            </div>

                            {intermediateStops.map((stop, index) => (
                              <div key={stop.id}>
                                <div className="flex items-end gap-2 mb-0">
                                  <div className="flex-1 relative">
                                    <span className="font-semibold text-gray-700 block mb-2">Stop {index + 1}</span>
                                    <AutoComplete
                                      options={stop.options}
                                      value={stop.value}
                                      disabled={!mapsReady}
                                      onSearch={(text) => {
                                        setIntermediateStops(stops => stops.map(s => s.id === stop.id ? { ...s, value: text, selected: null } : s));
                                        void searchCities(text, "stop", stop.id);
                                      }}
                                      onSelect={(value) => onSelectCity(value, "stop", stop.id)}
                                      onChange={(val) => setIntermediateStops(stops => stops.map(s => s.id === stop.id ? { ...s, value: val } : s))}
                                      className="w-full"
                                    >
                                      <Input
                                        placeholder={`Enter intermediate stop`}
                                        size="large"
                                        className="h-14 rounded-xl text-lg"
                                      />
                                    </AutoComplete>
                                  </div>
                                  <Button 
                                    danger 
                                    type="text" 
                                    icon={<Trash2 size={18} />} 
                                    className="mb-2 h-10 w-10 flex items-center justify-center rounded-xl hover:bg-red-50"
                                    onClick={() => setIntermediateStops(stops => stops.filter(s => s.id !== stop.id))} 
                                  />
                                </div>
                                <div className="relative h-6 flex items-center justify-center">
                                  <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gradient-to-b from-gray-300 to-gray-300"></div>
                                </div>
                              </div>
                            ))}

                            <div className="pl-0 sm:pl-4">
                               <Button type="dashed" className="rounded-xl mt-0 mb-2 h-10 border-primary/30 text-primary hover:border-primary/60 hover:text-primary-dark font-medium" onClick={() => setIntermediateStops([...intermediateStops, { id: Math.random().toString(), options: [], selected: null, value: "" }])}>
                                 <Plus size={14} className="mr-1" /> Add Stop
                               </Button>
                            </div>

                            <Form.Item
                              label={<span className="font-semibold text-gray-700">To Location</span>}
                              name="toLocation"
                              rules={[{ required: true, message: "Please enter destination" }]}
                              className="mb-0"
                            >
                              <AutoComplete
                                options={toOptions}
                                disabled={!mapsReady}
                                onSearch={(text) => {
                                  setSelectedTo(null);
                                  void searchCities(text, "to");
                                }}
                                onSelect={(value) => onSelectCity(value, "to")}
                              >
                                <Input
                                  placeholder="Search city and select"
                                  size="large"
                                  className="h-14 rounded-xl text-lg"
                                />
                              </AutoComplete>
                            </Form.Item>
                          </div>
                        </div>

                        <div>
                          <Title level={5} className="mb-4 flex items-center gap-2">
                            <Car size={18} className="text-primary" /> Assignment
                          </Title>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-8">
                            <Form.Item
                              label={<span className="font-semibold text-gray-700">Vehicle</span>}
                              name="vehicleId"
                              rules={[{ required: true, message: "Please select a vehicle" }]}
                              className="mb-0"
                            >
                              <Select
                                size="large"
                                placeholder="Select vehicle"
                                className="h-14 w-full"
                                options={vehicles.map(v => ({ label: `${v.modelName} · ${v.plateNumber} · ${v.seatCapacity} seats`, value: v.id }))}
                                onChange={(val) => {
                                  const selectedVeh = vehicles.find(v => v.id === val);
                                  if (selectedVeh) {
                                    form.setFieldsValue({ totalSeats: selectedVeh.seatCapacity });
                                  }
                                }}
                              />
                            </Form.Item>
                            <Form.Item
                              label={<span className="font-semibold text-gray-700">Driver</span>}
                              name="driverId"
                              rules={[{ required: true, message: "Please select a driver" }]}
                              className="mb-0"
                            >
                              <Select
                                size="large"
                                placeholder="Select driver"
                                className="h-14 w-full"
                                options={[
                                  { label: `You (${user?.name?.split(" ")[0] || "Owner"})`, value: user?.$id || "" },
                                  ...teamDrivers.map(d => ({ label: `${d.fullName} · ${d.city}`, value: d.id }))
                                ]}
                              />
                            </Form.Item>
                          </div>
                        </div>

                        <div>
                          <Title level={5} className="mb-4 flex items-center gap-2">
                            <Sparkles size={18} className="text-primary" /> Schedule & Capacity
                          </Title>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                            <Form.Item
                              label={<span className="font-semibold text-gray-700">Departure Time</span>}
                              name="departureAt"
                              rules={[{ required: true, message: "Please select time" }]}
                              className="mb-0"
                            >
                              <DatePicker
                                showTime={{ format: 'h:mm A', use12Hours: true, minuteStep: 15 }}
                                size="large"
                                className="w-full h-14 rounded-xl text-lg"
                                format="YYYY-MM-DD h:mm A"
                                disabledDate={(current) =>
                                  current && current < dayjs().startOf("day")
                                }
                              />
                            </Form.Item>
                            <Form.Item
                              label={<span className="font-semibold text-gray-700">Total Seats</span>}
                              name="totalSeats"
                              rules={[{ required: true, message: "Required" }]}
                              className="mb-0"
                            >
                              <InputNumber min={1} max={10} size="large" className="w-full h-14 rounded-xl text-lg flex items-center" />
                            </Form.Item>
                          </div>
                        </div>
                        
                        <div>
                          <Title level={5} className="mb-4 flex items-center gap-2">
                            <span className="font-bold text-lg text-primary">₹</span> Pricing
                          </Title>
                          <div className="bg-purple-50/50 p-5 rounded-2xl border border-purple-100">
                            <Form.Item
                              label={<span className="font-semibold text-gray-700">Total per seat price</span>}
                              name="totalTripPrice"
                              rules={[{ required: true, message: "Please enter total per seat price" }]}
                              extra="Set the price for one seat for the entire route. Segment pricing is automatically calculated."
                              className="mb-0"
                            >
                              <InputNumber
                                min={1}
                                size="large"
                                className="w-full h-14 rounded-xl text-lg flex items-center font-bold text-primary"
                                prefix="₹"
                                formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                              />
                            </Form.Item>
                          </div>
                        </div>
                      </div>

                      <div className="mt-10 flex flex-col-reverse sm:flex-row items-center gap-4">
                        <Button
                          type="text"
                          size="large"
                          className="h-14 rounded-xl px-8 w-full sm:w-auto font-medium text-gray-500 hover:bg-gray-100"
                          onClick={() => setActiveModule("dashboard")}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="primary"
                          htmlType="submit"
                          size="large"
                          loading={creating}
                          className="h-14 rounded-xl px-10 w-full sm:w-auto bg-gradient-primary border-none font-bold shadow-glow hover:scale-[1.02] transition-transform"
                        >
                          {isEditingTrip ? "Update Trip Details" : "Publish Journey"}
                        </Button>
                      </div>

                      {/* Mobile Sticky Earnings Bar */}
                      <div className="xl:hidden fixed bottom-20 left-0 right-0 bg-white/90 backdrop-blur-md border-t border-gray-200 p-4 shadow-[0_-10px_20px_rgba(0,0,0,0.05)] z-40 flex items-center justify-end">
                        <Button 
                          type="default" 
                          className="rounded-xl border-primary/30 text-primary font-medium"
                          onClick={() => setMobilePreviewOpen(true)}
                        >
                          Preview Card
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
                        
                        <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                          <Text type="secondary" className="text-xs block mb-3 font-semibold uppercase tracking-wider text-center">What travelers see</Text>
                          <div className="flex items-center justify-between mb-4">
                            <Tag color="purple" className="rounded-full border-none px-2 py-0.5 font-semibold text-[10px] m-0">
                              {form.getFieldValue("departureAt") ? dayjs(form.getFieldValue("departureAt")).format("MMM D • h:mm A") : "Select date"}
                            </Tag>
                            <Text strong className="text-lg text-emerald-600">₹{totalPriceWatch || "—"}</Text>
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
                      <Text type="secondary" className="text-xs block mb-4 font-semibold uppercase tracking-wider text-center">What travelers see</Text>
                      <div className="flex items-center justify-between mb-5">
                        <Tag color="purple" className="rounded-full border-none px-3 py-1 font-semibold text-xs m-0">
                          {form.getFieldValue("departureAt") ? dayjs(form.getFieldValue("departureAt")).format("MMM D • h:mm A") : "Select date"}
                        </Tag>
                        <Text strong className="text-xl text-emerald-600">₹{totalPriceWatch || "—"}</Text>
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
                      className="h-14 rounded-xl bg-gradient-primary border-none font-bold shadow-glow"
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
                      <div className="p-2 bg-emerald-100 rounded-lg text-emerald-600">
                        <Banknote size={20} />
                      </div>
                      <Text type="secondary" className="font-medium text-emerald-800">Lifetime Earnings</Text>
                    </div>
                    <Title level={2} style={{ margin: "12px 0 0 0" }} className="text-emerald-900">
                      ₹{lifetimeEarnings.toLocaleString("en-IN")}
                    </Title>
                  </Card>
                  
                  <Card className="rounded-2xl border border-white/60 shadow-soft backdrop-blur-md group overflow-hidden relative bg-purple-50/50">
                    <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-purple-500/20 rounded-full blur-xl"></div>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-purple-100 rounded-lg text-purple-600">
                        <CheckCircle size={20} />
                      </div>
                      <Text type="secondary" className="font-medium text-purple-800">Total Completed Rides</Text>
                    </div>
                    <Title level={2} style={{ margin: "12px 0 0 0" }} className="text-purple-900">
                      {tripsLoading ? <Spin size="small" /> : completedTrips.length}
                    </Title>
                  </Card>
                </div>

                <Card className="rounded-2xl border border-white/60 shadow-card bg-white/80 backdrop-blur-md overflow-hidden">
                  <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                    <Title level={4} style={{ margin: 0 }}>Transaction Ledger</Title>
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
                            <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${trip.status === 'completed' ? 'bg-emerald-100 text-emerald-600' : trip.status === 'cancelled' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                              {trip.status === 'completed' ? <CheckCircle size={20} /> : trip.status === 'cancelled' ? <XCircle size={20} /> : <RouteIcon size={20} />}
                            </div>
                            <div>
                              <Text strong className="text-base text-gray-800 block mb-1">
                                {trip.fromLocation} → {trip.toLocation}
                              </Text>
                              <Text type="secondary" className="text-xs uppercase tracking-wider font-semibold">
                                {dayjs(trip.departureAt).format("MMM D, YYYY • h:mm A")}
                              </Text>
                            </div>
                          </div>
                          <div className="flex items-center justify-between sm:flex-col sm:items-end gap-1">
                            <Text strong className={`text-lg ${trip.status === 'completed' ? 'text-emerald-600' : 'text-gray-400'}`}>
                              ₹{(trip.totalPrice ?? 0).toLocaleString("en-IN")}
                            </Text>
                            <Tag
                              color={trip.status === 'completed' ? 'success' : trip.status === 'cancelled' ? 'error' : 'processing'}
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

            {/* ── DRIVERS MODULE ── */}
            {activeModule === "drivers" && (
              <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                <div className="flex items-center justify-between">
                  <div>
                    <Title level={2} style={{ margin: 0 }}>Drivers</Title>
                    <Text type="secondary" className="text-lg">Manage your team of drivers.</Text>
                  </div>
                  <Button
                    type="primary"
                    icon={<Plus size={16} />}
                    size="large"
                    className="bg-gradient-primary border-none rounded-xl font-bold shadow-glow flex items-center gap-2"
                    onClick={() => { setEditingDriverId(null); driverForm.resetFields(); setDriverDrawerOpen(true); }}
                  >
                    Add Driver
                  </Button>
                </div>

                {driversLoading ? (
                  <div className="flex justify-center py-16"><Spin size="large" /></div>
                ) : teamDrivers.length === 0 ? (
                  <Card className="rounded-2xl border border-white/60 shadow-soft bg-white/80 backdrop-blur-md text-center py-16">
                    <Users2 size={48} className="mx-auto text-gray-300 mb-4" />
                    <Text type="secondary" className="text-lg block">No team drivers yet.</Text>
                    <Text type="secondary" className="text-sm">Add drivers who operate under your account.</Text>
                    <div className="mt-6">
                      <Button type="primary" icon={<Plus size={16} />} className="bg-gradient-primary border-none rounded-xl"
                        onClick={() => { setEditingDriverId(null); driverForm.resetFields(); setDriverDrawerOpen(true); }}>
                        Add first driver
                      </Button>
                    </div>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    {teamDrivers.map((d) => (
                      <Card key={d.id} className="rounded-2xl border border-white/60 shadow-soft bg-white/80 backdrop-blur-md hover:shadow-card transition-all">
                        <div className="flex items-center gap-4">
                          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-violet-600 to-purple-700 flex items-center justify-center text-white font-bold text-xl shrink-0">
                            {d.fullName[0]?.toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-gray-800 text-base truncate">{d.fullName}</p>
                            <div className="flex flex-wrap gap-2 mt-1">
                              <span className="text-xs text-gray-500">{d.phone}</span>
                              <span className="text-gray-300">·</span>
                              <span className="text-xs text-gray-500">{d.city}</span>
                              <span className="text-gray-300">·</span>
                              <span className="text-xs text-gray-500 font-mono">{d.licenseNumber}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Button
                              size="small"
                              icon={<Pencil size={14} />}
                              className="rounded-lg"
                              onClick={() => {
                                setEditingDriverId(d.id);
                                driverForm.setFieldsValue({ fullName: d.fullName, email: d.email, phone: d.phone, licenseNumber: d.licenseNumber, city: d.city });
                                setDriverDrawerOpen(true);
                              }}
                            />
                            <Popconfirm title="Remove this driver?" onConfirm={() => removeDriver(d.id)} okText="Remove" okButtonProps={{ danger: true }}>
                              <Button size="small" danger icon={<Trash2 size={14} />} className="rounded-lg" />
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
                  onClose={() => { setDriverDrawerOpen(false); driverForm.resetFields(); setEditingDriverId(null); }}
                  footer={
                    <Button type="primary" loading={savingDriver} block size="large"
                      className="bg-gradient-primary border-none rounded-xl font-bold h-12"
                      onClick={() => driverForm.submit()}>
                      {editingDriverId ? "Save Changes" : "Add Driver"}
                    </Button>
                  }
                >
                  <Form form={driverForm} layout="vertical"
                    onFinish={(vals) => saveDriver(vals as Omit<CreateTeamDriverInput, "ownerUserId">)}>
                    {[
                      { name: "fullName", label: "Full Name", rules: [{ required: true, message: "Required" }] },
                      { name: "email", label: "Email", rules: [{ required: true, type: "email" as const, message: "Valid email required" }] },
                      { name: "phone", label: "Phone", rules: [{ required: true, message: "Required" }] },
                      { name: "licenseNumber", label: "License Number", rules: [{ required: true, message: "Required" }] },
                      { name: "city", label: "City", rules: [{ required: true, message: "Required" }] },
                    ].map((f) => (
                      <Form.Item key={f.name} name={f.name} label={<span className="font-semibold text-gray-700">{f.label}</span>} rules={f.rules}>
                        <Input size="large" className="rounded-xl h-12" />
                      </Form.Item>
                    ))}
                  </Form>
                </Drawer>
              </div>
            )}

            {/* ── VEHICLE FLEET MODULE ── */}
            {activeModule === "settings" && (
              <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                <div className="flex items-center justify-between">
                  <div>
                    <Title level={2} style={{ margin: 0 }}>Vehicle Fleet</Title>
                    <Text type="secondary" className="text-lg">Manage all your registered vehicles.</Text>
                  </div>
                  <Button
                    type="primary"
                    icon={<Plus size={16} />}
                    size="large"
                    className="bg-gradient-primary border-none rounded-xl font-bold shadow-glow flex items-center gap-2"
                    onClick={() => { setEditingVehicleId(null); vehicleForm.resetFields(); setVehicleDrawerOpen(true); }}
                  >
                    Add Vehicle
                  </Button>
                </div>

                {vehiclesLoading ? (
                  <div className="flex justify-center py-16"><Spin size="large" /></div>
                ) : vehicles.length === 0 ? (
                  <Card className="rounded-2xl border border-white/60 shadow-soft bg-white/80 backdrop-blur-md text-center py-16">
                    <Car size={48} className="mx-auto text-gray-300 mb-4" />
                    <Text type="secondary" className="text-lg block">No vehicles registered yet.</Text>
                    <Text type="secondary" className="text-sm">Add your first vehicle to start hosting trips.</Text>
                    <div className="mt-6">
                      <Button type="primary" icon={<Plus size={16} />} className="bg-gradient-primary border-none rounded-xl"
                        onClick={() => { setEditingVehicleId(null); vehicleForm.resetFields(); setVehicleDrawerOpen(true); }}>
                        Add vehicle
                      </Button>
                    </div>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {vehicles.map((v) => (
                      <div key={v.id} className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/5 to-white/0 pointer-events-none" />
                        <div className="flex justify-between items-start mb-4 relative z-10">
                          <div>
                            <p className="text-gray-400 text-[10px] uppercase tracking-widest font-bold">Registered Vehicle</p>
                            <div className="flex items-center gap-1.5 mt-1">
                              <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                              <p className="text-emerald-400 text-xs font-bold uppercase tracking-wider">Active</p>
                            </div>
                          </div>
                          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              className="h-8 w-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                              onClick={() => {
                                setEditingVehicleId(v.id);
                                const parts = v.modelName.split(" ");
                                vehicleForm.setFieldsValue({ make: parts[0] ?? "", model: parts.slice(1).join(" ") || v.modelName, color: v.color ?? "", plate: v.plateNumber, seats: v.seatCapacity });
                                setVehicleDrawerOpen(true);
                              }}
                            >
                              <Pencil size={14} />
                            </button>
                            <Popconfirm title="Remove this vehicle?" onConfirm={() => removeVehicle(v.id)} okText="Remove" okButtonProps={{ danger: true }}>
                              <button className="h-8 w-8 rounded-lg bg-red-500/20 hover:bg-red-500/40 flex items-center justify-center transition-colors">
                                <Trash2 size={14} />
                              </button>
                            </Popconfirm>
                          </div>
                        </div>
                        <p className="text-xl font-bold relative z-10">{v.modelName}</p>
                        <p className="text-gray-400 text-sm relative z-10">{v.color || "—"} · {v.seatCapacity} seats</p>
                        <div className="mt-4 bg-white/10 rounded-2xl p-3 border border-white/10 relative z-10">
                          <p className="text-gray-400 text-[10px] uppercase tracking-widest font-bold mb-0.5">Plate</p>
                          <p className="text-white font-mono text-lg tracking-widest">{v.plateNumber}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add/Edit Vehicle Drawer */}
                <Drawer
                  title={editingVehicleId ? "Edit Vehicle" : "Add Vehicle"}
                  placement="right"
                  width={420}
                  open={vehicleDrawerOpen}
                  onClose={() => { setVehicleDrawerOpen(false); vehicleForm.resetFields(); setEditingVehicleId(null); }}
                  footer={
                    <Button type="primary" loading={savingVehicle} block size="large"
                      className="bg-gradient-primary border-none rounded-xl font-bold h-12"
                      onClick={() => vehicleForm.submit()}>
                      {editingVehicleId ? "Save Changes" : "Add Vehicle"}
                    </Button>
                  }
                >
                  <Form form={vehicleForm} layout="vertical"
                    onFinish={(vals) => saveVehicle(vals as { make: string; model: string; color: string; plate: string; seats: number })}>
                    <div className="grid grid-cols-2 gap-4">
                      <Form.Item name="make" label={<span className="font-semibold text-gray-700">Make</span>} rules={[{ required: true, message: "Required" }]}>
                        <Input size="large" placeholder="Honda" className="rounded-xl h-12" />
                      </Form.Item>
                      <Form.Item name="model" label={<span className="font-semibold text-gray-700">Model</span>} rules={[{ required: true, message: "Required" }]}>
                        <Input size="large" placeholder="City" className="rounded-xl h-12" />
                      </Form.Item>
                    </div>
                    <Form.Item name="color" label={<span className="font-semibold text-gray-700">Color</span>}>
                      <Input size="large" placeholder="White, Black…" className="rounded-xl h-12" />
                    </Form.Item>
                    <Form.Item name="plate" label={<span className="font-semibold text-gray-700">License Plate</span>} rules={[{ required: true, message: "Required" }]}>
                      <Input size="large" placeholder="TN 01 AB 1234" className="rounded-xl h-12 font-mono tracking-widest" />
                    </Form.Item>
                    <Form.Item name="seats" label={<span className="font-semibold text-gray-700">Seat Capacity</span>} rules={[{ required: true }]}>
                      <InputNumber min={1} max={12} size="large" className="w-full rounded-xl" />
                    </Form.Item>
                  </Form>
                </Drawer>
              </div>
            )}
            {/* ── CUSTOMER HUB MODULE ── */}
            {activeModule === "customers" && (
              <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                <div className="flex flex-col gap-2">
                  <Title level={2} className="m-0">Customer Hub</Title>
                  <Text type="secondary" className="text-lg">Manage relationships and feedback for your passengers.</Text>
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
                      <Text type="secondary" className="text-lg block mb-8">Your passengers will appear here once they start booking your trips.</Text>
                      <Button type="primary" size="large" onClick={() => setActiveModule("trips")} className="bg-gradient-primary border-none h-12 px-8 rounded-xl font-bold">
                        Publish Your First Trip
                      </Button>
                    </Card>
                  ) : (
                    <div className="space-y-6">
                      {/* Grouping bookings by passenger */}
                      {Object.values(bookings.reduce((acc: any, booking) => {
                        if (!acc[booking.travelerId]) {
                          acc[booking.travelerId] = {
                            travelerId: booking.travelerId,
                            name: booking.passengerName,
                            phone: booking.passengerPhone,
                            totalTrips: 0,
                            avgRating: 0,
                            ratingsCount: 0,
                            latestBookings: []
                          };
                        }
                        acc[booking.travelerId].totalTrips += 1;
                        acc[booking.travelerId].latestBookings.push(booking);
                        if (booking.ratingByHost) {
                          acc[booking.travelerId].ratingsCount += 1;
                          acc[booking.travelerId].avgRating += booking.ratingByHost;
                        }
                        return acc;
                      }, {})).map((customer: any) => (
                        <Card key={customer.travelerId} className="rounded-3xl border border-white/60 shadow-soft hover:shadow-card transition-all bg-white/80 backdrop-blur-md overflow-hidden">
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 p-2">
                            <div className="flex items-center gap-5">
                              <Avatar size={70} className="bg-gradient-primary shadow-soft flex-shrink-0">
                                {customer.name[0]}
                              </Avatar>
                              <div>
                                <div className="flex items-center gap-3 flex-wrap">
                                  <Title level={3} className="m-0">{customer.name}</Title>
                                  {customer.totalTrips >= 3 && (
                                    <Tag color="gold" className="rounded-full px-3 border-none font-bold uppercase text-[10px] m-0">Frequent Traveler</Tag>
                                  )}
                                  <div className="flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                                    <Star size={12} className="text-emerald-600 fill-emerald-600" />
                                    <Text className="text-[12px] text-emerald-700 font-bold">
                                      {customer.ratingsCount > 0 ? (customer.avgRating / customer.ratingsCount).toFixed(1) : "New"}
                                    </Text>
                                  </div>
                                </div>
                                <div className="flex items-center gap-4 mt-2 text-gray-500 font-medium">
                                  <Text type="secondary">{customer.phone}</Text>
                                  <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                                  <Text type="secondary">{customer.totalTrips} Total Trips</Text>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <Button 
                                type="primary" 
                                className="h-12 rounded-2xl bg-purple-600 border-none font-bold shadow-soft"
                                onClick={() => {
                                  setSelectedBooking(customer.latestBookings[0]);
                                  setRatingValue(customer.latestBookings[0].ratingByHost || 5);
                                  setRatingComment(customer.latestBookings[0].commentByHost || "");
                                  setRatingModalVisible(true);
                                }}
                              >
                                Rate Latest Trip
                              </Button>
                            </div>
                          </div>
                          
                          <div className="mt-6 pt-6 border-t border-gray-100">
                            <Text strong className="text-gray-400 uppercase text-[10px] tracking-widest block mb-4">Trip History with you</Text>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                              {customer.latestBookings.slice(0, 3).map((b: Booking) => (
                                <div key={b.id} className="bg-gray-50/50 p-4 rounded-2xl border border-gray-100 flex flex-col justify-between">
                                  <div>
                                    <Text strong className="block mb-1">{b.passengerName}</Text>
                                    <Text type="secondary" className="text-[11px] uppercase tracking-wider block mb-2">{dayjs(b.createdAt).format("MMM D, YYYY")}</Text>
                                    <div className="flex items-center gap-2 mb-1">
                                      <Tag color={b.status === "confirmed" ? "green" : b.status === "completed" ? "blue" : "orange"} className="rounded-full text-[10px] border-none font-bold uppercase px-2">{b.status}</Tag>
                                      <Text className="text-xs font-semibold">{b.seatsBooked} Seats • ₹{b.segmentPrice}</Text>
                                    </div>
                                  </div>
                                  {b.ratingByHost && (
                                    <div className="mt-3 flex items-center gap-2 pt-3 border-t border-gray-100/50">
                                      <div className="flex items-center gap-1">
                                        {[...Array(5)].map((_, i) => (
                                          <Star key={i} size={10} className={i < b.ratingByHost! ? "text-amber-400 fill-amber-400" : "text-gray-200"} />
                                        ))}
                                      </div>
                                      <Text italic className="text-[10px] text-gray-400 line-clamp-1">"{b.commentByHost}"</Text>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>

                <Modal
                  title={
                    <div className="flex items-center gap-3 pb-2 border-b border-gray-100">
                      <div className="p-2 bg-amber-100 rounded-lg text-amber-600">
                        <Star size={20} fill="currentColor" />
                      </div>
                      <div>
                        <Title level={4} className="m-0">Rate Passenger</Title>
                        <Text type="secondary" className="text-xs">Your feedback helps the community stay safe.</Text>
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
                      <Text type="secondary" className="uppercase text-[10px] tracking-[0.2em] font-bold block mb-4">Select Rating</Text>
                      <div className="flex justify-center gap-2">
                        {[1, 2, 3, 4, 5].map((val) => (
                          <button
                            key={val}
                            onClick={() => setRatingValue(val)}
                            className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${
                              ratingValue >= val 
                                ? "bg-amber-400 text-white shadow-glow scale-110" 
                                : "bg-gray-100 text-gray-300 hover:bg-gray-200"
                            }`}
                          >
                            <Star size={28} fill={ratingValue >= val ? "white" : "transparent"} strokeWidth={2.5} />
                          </button>
                        ))}
                      </div>
                      <div className="mt-4">
                        <Title level={5} className="text-amber-600">
                          {ratingValue === 5 ? "Excellent Traveler" : 
                           ratingValue === 4 ? "Very Good" : 
                           ratingValue === 3 ? "Good Experience" : 
                           ratingValue === 2 ? "Below Average" : "Poor Experience"}
                        </Title>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <Text strong className="text-gray-700">Write a quick note (Optional)</Text>
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
                          submitRating({ bookingId: selectedBooking.id, rating: ratingValue, comment: ratingComment });
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
          </Content>
        </Layout>
      </Layout>

      {/* App-like Mobile Bottom Navigation */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-lg border-t border-gray-200 pb-safe z-50 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
        <div className="flex justify-around items-center h-16">
          <button 
            className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${activeModule === 'dashboard' ? 'text-primary' : 'text-gray-400'}`}
            onClick={() => setActiveModule('dashboard')}
          >
            <LayoutDashboard size={20} />
            <span className="text-[10px] font-semibold">Home</span>
          </button>
          
          <button 
            className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${activeModule === 'trips' ? 'text-primary' : 'text-gray-400'}`}
            onClick={() => setActiveModule('trips')}
          >
            <div className={`p-1.5 rounded-full ${activeModule === 'trips' ? 'bg-primary/10' : ''}`}>
              <PlusCircle size={22} />
            </div>
            <span className="text-[10px] font-semibold -mt-1">New Trip</span>
          </button>
          
          <button 
            className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${activeModule === 'history' ? 'text-primary' : 'text-gray-400'}`}
            onClick={() => setActiveModule('history')}
          >
            <History size={20} />
            <span className="text-[10px] font-semibold">History</span>
          </button>

          <button 
            className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${activeModule === 'customers' ? 'text-primary' : 'text-gray-400'}`}
            onClick={() => setActiveModule('customers')}
          >
            <UserCheck size={20} />
            <span className="text-[10px] font-semibold">Users</span>
          </button>

          <button 
            className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${activeModule === 'drivers' ? 'text-primary' : 'text-gray-400'}`}
            onClick={() => setActiveModule('drivers')}
          >
            <Users2 size={20} />
            <span className="text-[10px] font-semibold">Drivers</span>
          </button>
          
          <button 
            className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${activeModule === 'settings' ? 'text-primary' : 'text-gray-400'}`}
            onClick={() => setActiveModule('settings')}
          >
            <Car size={20} />
            <span className="text-[10px] font-semibold">Fleet</span>
          </button>
        </div>
      </div>
      </div>
    </ConfigProvider>
  );
}

