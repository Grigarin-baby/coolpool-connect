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
  const { isDriver, user, signOut } = useAuth();
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
          borderRadius: 12,
          fontFamily: APP_FONT_FAMILY,
        },
        components: {
          Layout: {
            headerBg: "rgba(255, 255, 255, 0.7)",
            siderBg: "transparent",
            bodyBg: "transparent",
          },
          Menu: {
            itemBg: "transparent",
            itemSelectedBg: "rgba(107, 70, 193, 0.1)",
            itemSelectedColor: "#6b46c1",
          },
        },
      }}
    >
      <Layout className="min-h-screen bg-gradient-hero">
        <Sider
          breakpoint="lg"
          collapsedWidth="0"
          width={280}
          className="border-r border-border/60 backdrop-blur-xl hidden lg:block"
          style={{ position: "sticky", top: 0, height: "100vh", left: 0, zIndex: 100 }}
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

          <div className="absolute bottom-0 left-0 right-0 p-4">
            <Card className="rounded-none bg-secondary/40 border-none backdrop-blur-md">
              <div className="flex items-center gap-3">
                <Badge count={trips.length} overflowCount={99} offset={[0, 0]} color="#6b46c1">
                  <Avatar icon={<RouteIcon size={16} />} className="bg-primary/20 text-primary" />
                </Badge>
                <div>
                  <p className="text-xs text-muted-foreground">Active Trips</p>
                  <p className="text-lg font-bold">{tripsLoading ? "..." : trips.length}</p>
                </div>
              </div>
            </Card>
          </div>
        </Sider>

        <Layout>
          <Header className="px-6 flex items-center justify-between border-b border-border/60 backdrop-blur-md sticky top-0 z-10 h-16 bg-background/60">
            <div>
              <Title level={4} style={{ margin: 0 }} className="hidden sm:block">
                {activeModule === "dashboard" ? "Dashboard Overview" : "Publish Trip"}
              </Title>
              <div className="sm:hidden flex items-center gap-2">
                <div className="h-8 w-8 rounded-none bg-gradient-primary text-primary-foreground flex items-center justify-center">
                  <Sparkles className="h-4 w-4" />
                </div>
                <Text strong>Coolpool</Text>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right hidden md:flex flex-col justify-center">
                <Text strong className="text-sm leading-tight block">
                  {user?.name || "Driver"}
                </Text>
                <Text className="text-[10px] text-primary font-bold uppercase tracking-wider leading-tight">
                  Verified Driver
                </Text>
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
                  <Card className="rounded-none border-none shadow-soft hover:shadow-card transition-base bg-white/80 backdrop-blur-sm group">
                    <Text type="secondary" className="group-hover:text-primary transition-colors">
                      Total Rides
                    </Text>
                    <Title level={2} style={{ margin: "8px 0" }}>
                      {tripsLoading ? <Spin size="small" /> : trips.length}
                    </Title>
                    <Tag color="purple" className="rounded-none px-3 border-none">
                      +12% growth
                    </Tag>
                  </Card>
                  <Card className="rounded-none border-none shadow-soft hover:shadow-card transition-base bg-white/80 backdrop-blur-sm group">
                    <Text type="secondary" className="group-hover:text-primary transition-colors">
                      Earnings
                    </Text>
                    <Title level={2} style={{ margin: "8px 0" }}>
                      ₹0
                    </Title>
                    <Text type="secondary">Settlement pending</Text>
                  </Card>
                  <Card className="rounded-none border-none shadow-soft hover:shadow-card transition-base bg-white/80 backdrop-blur-sm group">
                    <Text type="secondary" className="group-hover:text-primary transition-colors">
                      Performance
                    </Text>
                    <Title level={2} style={{ margin: "8px 0" }}>
                      5.0
                    </Title>
                    <div className="flex gap-1 text-yellow-500">
                      <Sparkles size={14} className="fill-yellow-500" />
                      <Sparkles size={14} className="fill-yellow-500" />
                      <Sparkles size={14} className="fill-yellow-500" />
                      <Sparkles size={14} className="fill-yellow-500" />
                      <Sparkles size={14} className="fill-yellow-500" />
                    </div>
                  </Card>
                </div>

                <div className="grid gap-8 lg:grid-cols-3">
                  <div className="lg:col-span-2 space-y-6">
                    <div className="flex items-center justify-between">
                      <Title level={4} style={{ margin: 0 }}>
                        Recent Trips
                      </Title>
                      <Button type="link">View all</Button>
                    </div>
                    <Card className="rounded-none border-none shadow-soft bg-white/80 backdrop-blur-sm p-0 overflow-hidden">
                      <List
                        className="px-4"
                        itemLayout="horizontal"
                        dataSource={trips.slice(0, 5)}
                        loading={tripsLoading}
                        locale={{ emptyText: "No trips published yet." }}
                        renderItem={(item) => (
                          <List.Item
                            actions={[
                              <Dropdown
                                menu={{
                                  items: [
                                    { key: "edit", label: "Edit" },
                                    { key: "cancel", label: "Cancel", danger: true },
                                  ],
                                }}
                                trigger={["click"]}
                              >
                                <Button type="text" icon={<MoreVertical size={16} />} />
                              </Dropdown>,
                            ]}
                          >
                            <List.Item.Meta
                              avatar={
                                <div className="h-12 w-12 rounded-none bg-secondary flex items-center justify-center">
                                  <RouteIcon size={20} className="text-primary" />
                                </div>
                              }
                              title={
                                <Text strong>
                                  {item.fromLocation} → {item.toLocation}
                                </Text>
                              }
                              description={
                                <Space split={<Text type="secondary">·</Text>}>
                                  <Text type="secondary">{dayjs(item.departureAt).fromNow()}</Text>
                                  <Text type="secondary">{item.totalSeats} seats</Text>
                                  <Text strong className="text-primary">
                                    ₹{item.totalPrice}
                                  </Text>
                                </Space>
                              }
                            />
                          </List.Item>
                        )}
                      />
                    </Card>
                  </div>

                  <div className="space-y-6">
                    <Title level={4} style={{ margin: 0 }}>
                      Quick Access
                    </Title>
                    <div className="grid grid-cols-2 gap-4">
                      <Card
                        hoverable
                        className="rounded-none border-none shadow-soft text-center p-2 group bg-white/60"
                        onClick={() => setActiveModule("trips")}
                      >
                        <div className="h-10 w-10 mx-auto rounded-none bg-purple-100 text-purple-600 flex items-center justify-center mb-2 group-hover:bg-purple-600 group-hover:text-white transition-all">
                          <PlusCircle size={20} />
                        </div>
                        <Text strong className="text-xs">
                          New Trip
                        </Text>
                      </Card>
                      <Card
                        hoverable
                        className="rounded-none border-none shadow-soft text-center p-2 group bg-white/60 opacity-60"
                      >
                        <div className="h-10 w-10 mx-auto rounded-none bg-blue-100 text-blue-600 flex items-center justify-center mb-2">
                          <History size={20} />
                        </div>
                        <Text strong className="text-xs">
                          History
                        </Text>
                      </Card>
                      <Card
                        hoverable
                        className="rounded-none border-none shadow-soft text-center p-2 group bg-white/60 opacity-60"
                      >
                        <div className="h-10 w-10 mx-auto rounded-none bg-orange-100 text-orange-600 flex items-center justify-center mb-2">
                          <User size={20} />
                        </div>
                        <Text strong className="text-xs">
                          Profile
                        </Text>
                      </Card>
                      <Card
                        hoverable
                        className="rounded-none border-none shadow-soft text-center p-2 group bg-white/60 opacity-60"
                      >
                        <div className="h-10 w-10 mx-auto rounded-none bg-gray-100 text-gray-600 flex items-center justify-center mb-2">
                          <Settings size={20} />
                        </div>
                        <Text strong className="text-xs">
                          Settings
                        </Text>
                      </Card>
                    </div>

                    <Card className="rounded-none border-none bg-gradient-primary text-white p-6 shadow-glow relative overflow-hidden mt-8">
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

                <Card className="rounded-none border-none shadow-soft bg-white/80 backdrop-blur-sm p-6 md:p-8">
                  <Form
                    form={form}
                    layout="vertical"
                    onFinish={onFinish}
                    initialValues={{ totalSeats: 4, seatPrice: 500 }}
                    requiredMark={false}
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-2">
                      <div className="space-y-6">
                        <Title level={5} className="mb-4">
                          Route Information
                        </Title>
                        <Form.Item
                          label="From Location"
                          name="fromLocation"
                          rules={[{ required: true, message: "Please enter origin" }]}
                        >
                          <AutoComplete
                            options={fromOptions}
                            disabled={!mapsReady}
                            onSearch={(text) => {
                              console.log("[fromLocation] onSearch fired", {
                                text,
                                mapsReady,
                                disabled: !mapsReady,
                              });
                              setSelectedFrom(null);
                              void searchCities(text, "from");
                            }}
                            onSelect={(value) => onSelectCity(value, "from")}
                          >
                            <Input
                              placeholder="Search city and select"
                              size="large"
                              className="h-12"
                            />
                          </AutoComplete>
                        </Form.Item>
                        <Form.Item
                          label="To Location"
                          name="toLocation"
                          rules={[{ required: true, message: "Please enter destination" }]}
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
                              className="h-12"
                            />
                          </AutoComplete>
                        </Form.Item>
                      </div>

                      <div className="space-y-6">
                        <Title level={5} className="mb-4">
                          Schedule & Capacity
                        </Title>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <Form.Item
                            label="Departure Time"
                            name="departureAt"
                            rules={[{ required: true, message: "Please select time" }]}
                          >
                            <DatePicker
                              showTime
                              size="large"
                              className="w-full h-12"
                              format="YYYY-MM-DD HH:mm"
                              disabledDate={(current) =>
                                current && current < dayjs().startOf("day")
                              }
                            />
                          </Form.Item>
                          <Form.Item
                            label="Total Seats"
                            name="totalSeats"
                            rules={[{ required: true, message: "Required" }]}
                          >
                            <InputNumber min={1} max={10} size="large" className="w-full h-12" />
                          </Form.Item>
                        </div>

                        <Form.Item
                          label="Price per seat"
                          name="seatPrice"
                          rules={[{ required: true, message: "Please enter seat price" }]}
                          extra="Driver enters per-seat amount. Total trip value is calculated automatically."
                        >
                          <InputNumber
                            min={1}
                            size="large"
                            className="w-full h-12"
                            prefix="₹"
                            formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                          />
                        </Form.Item>
                        <Card className="rounded-none border border-border/60 bg-secondary/40">
                          <Text type="secondary">Estimated total value</Text>
                          <Title level={4} style={{ margin: "6px 0 0 0" }}>
                            ₹
                            {(
                              Number(seatPriceWatch || 0) * Number(seatsWatch || 0)
                            ).toLocaleString()}
                          </Title>
                        </Card>
                      </div>
                    </div>

                    <div className="mt-12 flex items-center gap-4">
                      <Button
                        type="primary"
                        htmlType="submit"
                        size="large"
                        loading={creating}
                        className="bg-gradient-primary border-none font-semibold px-8"
                      >
                        {creating ? "Publishing..." : "Publish Trip"}
                      </Button>
                      <Button
                        type="text"
                        size="large"
                        className="h-12 rounded-none px-6"
                        onClick={() => setActiveModule("dashboard")}
                      >
                        Cancel
                      </Button>
                    </div>
                  </Form>
                </Card>
              </div>
            )}
          </Content>
        </Layout>
      </Layout>
    </ConfigProvider>
  );
}

