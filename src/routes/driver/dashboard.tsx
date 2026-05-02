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
} from "antd";
import { useAuth } from "@/hooks/useAuth";
import { createTrip, listHostTrips } from "@/data/appwrite-repository";
import { APP_FONT_FAMILY } from "@/lib/fonts";
import { calcPricePerKm } from "@/lib/pricing";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { appwriteConfig } from "@/integrations/appwrite/client";

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
  seatPrice: number;
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
      { title: "Driver dashboard — Coolpool" },
      { name: "description", content: "Manage your rides and bookings as a Coolpool driver." },
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
  const [mapsReady, setMapsReady] = useState(false);
  const autocompleteServiceRef = useRef<PlacesAutocompleteServiceLike | null>(null);
  const geocoderRef = useRef<GeocoderLike | null>(null);
  const seatsWatch = Form.useWatch("totalSeats", form);
  const seatPriceWatch = Form.useWatch("seatPrice", form);

  const initGoogleServices = () => {
    const w = window as Window & {
      google?: {
        maps?: {
          places?: { AutocompleteService: new () => PlacesAutocompleteServiceLike };
          Geocoder?: new () => GeocoderLike;
        };
      };
    };
    const maps = w.google?.maps;
    if (!maps?.places?.AutocompleteService || !maps?.Geocoder) return false;
    autocompleteServiceRef.current = new maps.places.AutocompleteService();
    geocoderRef.current = new maps.Geocoder();
    setMapsReady(true);
    return true;
  };

  const { data: trips = [], isLoading: tripsLoading } = useQuery({
    queryKey: ["host-trips", user?.$id],
    queryFn: () => (user ? listHostTrips(user.$id) : Promise.resolve([])),
    enabled: !!user,
  });

  const { mutate: performCreateTrip, isPending: creating } = useMutation({
    mutationFn: createTrip,
    onSuccess: (trip) => {
      if (import.meta.env.DEV) {
        console.log("[publish trip] Appwrite document saved:", {
          id: trip.id,
          fromLocation: trip.fromLocation,
          toLocation: trip.toLocation,
        });
      }
      message.success("Trip created.");
      form.resetFields();
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

  const onFinish = (values: TripFormValues) => {
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
    const seatPrice = Number(values.seatPrice);
    const totalSeats = Number(values.totalSeats);
    const totalPrice = seatPrice * totalSeats;
    const totalDistanceKm = 1;

    const payload = {
      hostId: user.$id,
      fromLocation: resolvedFrom.label,
      fromLat: resolvedFrom.lat,
      fromLng: resolvedFrom.lng,
      toLocation: resolvedTo.label,
      toLat: resolvedTo.lat,
      toLng: resolvedTo.lng,
      polyline: "",
      totalDistanceKm,
      totalPrice,
      pricePerKm: calcPricePerKm(totalPrice, totalDistanceKm),
      totalSeats,
      departureAt: values.departureAt.toISOString(),
      notes: `Created from driver trip module. Price per seat: ₹${seatPrice}.`,
    };

    if (import.meta.env.DEV) {
      console.log("[publish trip] createTrip payload (strings stored in DB):", {
        from_location: payload.fromLocation,
        to_location: payload.toLocation,
        fromLat: payload.fromLat,
        fromLng: payload.fromLng,
        toLat: payload.toLat,
        toLng: payload.toLng,
      });
    }

    performCreateTrip(payload);
  };

  const searchCities = async (query: string, target: "from" | "to") => {
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
      else setToOptions([]);
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
        else setToOptions([]);
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
      else setToOptions(options);
    });
  };

  const onSelectCity = (value: string, target: "from" | "to") => {
    const sourceOptions = target === "from" ? fromOptions : toOptions;
    const selected = sourceOptions.find((option) => option.value === value);
    if (!selected) return;

    const geocoder = geocoderRef.current;
    if (!geocoder || !selected.placeId) {
      if (target === "from") setSelectedFrom(selected);
      else setSelectedTo(selected);
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
      else setSelectedTo(withCoords);
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
            This workspace is only for driver accounts. Please complete driver onboarding.
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
          <div className="p-6 flex items-center gap-3">
            <div className="h-10 w-10 rounded-none bg-gradient-primary text-primary-foreground flex items-center justify-center shadow-glow">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <p className="font-bold text-lg leading-none">Coolpool</p>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1">
                Driver Operations
              </p>
            </div>
          </div>

          <Menu
            mode="inline"
            selectedKeys={[activeModule]}
            onClick={({ key }) => setActiveModule(key)}
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
                disabled: true,
              },
              {
                key: "settings",
                icon: <Settings size={18} />,
                label: "Vehicle Settings",
                disabled: true,
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
          <Header className="px-6 flex items-center justify-between border-b border-white/20 sticky top-0 z-50 h-20" style={{ backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" }}>
            <div>
              <Title level={4} style={{ margin: 0 }} className="hidden sm:block font-bold">
                {activeModule === "dashboard" ? "Dashboard Overview" : "Publish Trip"}
              </Title>
              <div className="sm:hidden flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-gradient-primary text-white flex items-center justify-center shadow-glow">
                  <Sparkles className="h-4 w-4" />
                </div>
                <Text strong className="text-lg">Coolpool</Text>
              </div>
            </div>
            <div className="flex items-center gap-5">
              <div className="text-right hidden md:flex flex-col justify-center bg-white/40 px-4 py-1.5 rounded-full border border-white/60 shadow-sm backdrop-blur-sm">
                <Text strong className="text-sm leading-tight block text-gray-800">
                  {user?.name || "Driver"}
                </Text>
                <div className="flex items-center gap-1 mt-0.5">
                  <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse"></div>
                  <Text className="text-[10px] text-green-700 font-bold uppercase tracking-wider leading-tight">
                    Verified Driver
                  </Text>
                </div>
              </div>

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
                <Badge dot status="processing" offset={[-4, 32]} color="#6b46c1">
                  <Avatar
                    icon={<User size={20} />}
                    className="bg-gradient-primary cursor-pointer shadow-soft border-2 border-white/50"
                    size={40}
                  />
                </Badge>
              </Dropdown>
            </div>
          </Header>

          <Content className="p-6 md:p-10 max-w-7xl mx-auto w-full">
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
                    onClick={() => setActiveModule("trips")}
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
                          <div key={item.$id} className="bg-white/80 rounded-2xl border border-white shadow-soft p-5 hover:shadow-card transition-all duration-300 group">
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
                        onClick={() => setActiveModule("trips")}
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
                        className="rounded-2xl border border-white/60 shadow-soft text-center p-3 group bg-white/60 opacity-70"
                      >
                        <div className="h-12 w-12 mx-auto rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center mb-3">
                          <History size={22} />
                        </div>
                        <Text strong className="text-sm">
                          History
                        </Text>
                      </Card>
                      <Card
                        hoverable
                        className="rounded-2xl border border-white/60 shadow-soft text-center p-3 group bg-white/60 opacity-70"
                      >
                        <div className="h-12 w-12 mx-auto rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center mb-3">
                          <User size={22} />
                        </div>
                        <Text strong className="text-sm">
                          Profile
                        </Text>
                      </Card>
                      <Card
                        hoverable
                        className="rounded-2xl border border-white/60 shadow-soft text-center p-3 group bg-white/60 opacity-70"
                      >
                        <div className="h-12 w-12 mx-auto rounded-xl bg-gray-100 text-gray-600 flex items-center justify-center mb-3">
                          <Settings size={22} />
                        </div>
                        <Text strong className="text-sm">
                          Settings
                        </Text>
                      </Card>
                    </div>

                    <Card className="rounded-2xl border-none bg-gradient-primary text-white p-6 shadow-glow relative overflow-hidden mt-8 hover:scale-[1.02] transition-transform duration-300 cursor-pointer">
                      <Sparkles
                        size={80}
                        className="absolute -right-6 -bottom-6 opacity-20 rotate-12"
                      />
                      <Title level={4} style={{ color: "white", margin: 0 }}>
                        Pro Driver Tips
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
                    Publish a New Trip
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
                      initialValues={{ totalSeats: 4, seatPrice: 500 }}
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
                                showTime
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
                              label={<span className="font-semibold text-gray-700">Price per seat</span>}
                              name="seatPrice"
                              rules={[{ required: true, message: "Please enter seat price" }]}
                              extra="You set the per-seat amount. The total trip value is calculated for you."
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
                          {creating ? "Publishing..." : "Publish Trip to Search"}
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
                        <div className="text-center pb-5 border-b border-gray-100 mb-5">
                          <Text type="secondary" className="block text-xs uppercase tracking-wider font-semibold mb-1">Total Estimated Earnings</Text>
                          <Title level={2} className="m-0 text-emerald-600 font-bold">
                            ₹{(Number(seatPriceWatch || 0) * Number(seatsWatch || 0)).toLocaleString()}
                          </Title>
                        </div>
                        
                        <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                          <Text type="secondary" className="text-xs block mb-3 font-semibold uppercase tracking-wider text-center">What travelers see</Text>
                          <div className="flex items-center justify-between mb-4">
                            <Tag color="purple" className="rounded-full border-none px-2 py-0.5 font-semibold text-[10px] m-0">
                              {form.getFieldValue("departureAt") ? dayjs(form.getFieldValue("departureAt")).format("MMM D • h:mm A") : "Select date"}
                            </Tag>
                            <Text strong className="text-lg text-emerald-600">₹{seatPriceWatch || 500}</Text>
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
                </div>
              </div>
            )}
          </Content>
        </Layout>
      </Layout>
      </div>
    </ConfigProvider>
  );
}

