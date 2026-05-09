import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Link } from "@tanstack/react-router";
import {
  AutoComplete,
  DatePicker,
  Empty,
  Form,
  Spin,
  Tag,
  Typography,
  message,
} from "antd";
import { 
  ArrowRight, 
  Calendar, 
  MapPin, 
  Navigation, 
  Users, 
  Clock, 
  Star, 
  ShieldCheck,
  ChevronRight,
  Filter,
  Map as MapIcon
} from "lucide-react";
import dayjs, { Dayjs } from "dayjs";
import { Button as UiButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { listTrips } from "@/data/appwrite-repository";
import { routeCitySegmentsMatch } from "@/lib/geo";
import { formatCurrency } from "@/lib/pricing";
import { appwriteConfig } from "@/integrations/appwrite/client";
import { cn } from "@/lib/utils";
import { SERVICE_CITY, BENGALURU_AIRPORTS } from "@/lib/config";

interface PlacePrediction {
  description: string;
}

interface PlacesAutocompleteServiceLike {
  getPlacePredictions: (
    request: { input: string; types?: string[] },
    callback: (predictions: PlacePrediction[] | null, status: string) => void,
  ) => void;
}

interface GoogleMapsWindow {
  google?: {
    maps?: {
      places?: {
        AutocompleteService?: new () => PlacesAutocompleteServiceLike;
      };
    };
  };
}

type TripRow = Awaited<ReturnType<typeof listTrips>>[number];

interface TripSearchContextValue {
  loading: boolean;
  searched: boolean;
  results: TripRow[];
  fromOptions: { value: string; label: string }[];
  toOptions: { value: string; label: string }[];
  searchPlaces: (query: string, target: "from" | "to") => void;
  onSearch: (values: { from: string; to: string; date?: Dayjs }) => Promise<void>;
  summary: string;
}

const TripSearchContext = createContext<TripSearchContextValue | null>(null);

function useTripSearchContext() {
  const ctx = useContext(TripSearchContext);
  if (!ctx) throw new Error("TripSearch components must be inside TripSearchProvider");
  return ctx;
}

function squashLower(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function primarySegment(value: string) {
  return squashLower(value).split(",")[0]?.trim() ?? "";
}

function matchesLocation(tripLocation: string, searchLocation: string) {
  const tripFull = squashLower(tripLocation);
  const searchFull = squashLower(searchLocation);
  if (!searchFull) return true;
  if (tripFull.includes(searchFull) || searchFull.includes(tripFull)) return true;
  return routeCitySegmentsMatch(primarySegment(tripLocation), primarySegment(searchLocation));
}


const SOUTH_INDIA_STATES = ["karnataka", "kerala", "tamil nadu", "andhra pradesh", "telangana", "goa", "puducherry"];

export function TripSearchProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<TripRow[]>([]);
  const [searched, setSearched] = useState(false);
  const [fromOptions, setFromOptions] = useState<{ value: string; label: string }[]>([]);
  const [toOptions, setToOptions] = useState<{ value: string; label: string }[]>([]);
  const autocompleteServiceRef = useRef<PlacesAutocompleteServiceLike | null>(null);

  useEffect(() => {
    const getService = () => {
      const maps = (window as Window & GoogleMapsWindow).google?.maps;
      if (!maps?.places?.AutocompleteService) return null;
      return new maps.places.AutocompleteService() as PlacesAutocompleteServiceLike;
    };

    const existingService = getService();
    if (existingService) {
      autocompleteServiceRef.current = existingService;
      return;
    }

    if (!appwriteConfig.googleMapsApiKey) return;

    const existingScript = document.querySelector(
      'script[data-google-maps="places"]',
    ) as HTMLScriptElement | null;
    const onLoaded = () => {
      const service = getService();
      if (service) autocompleteServiceRef.current = service;
    };

    if (existingScript) {
      if (existingScript.dataset.loaded === "true") {
        onLoaded();
      } else {
        existingScript.addEventListener("load", onLoaded, { once: true });
      }
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
        onLoaded();
      },
      { once: true },
    );
    document.head.appendChild(script);
  }, []);

  const searchPlaces = useCallback((query: string, target: "from" | "to") => {
    if (!query || query.trim().length < 2) {
      if (target === "from") setFromOptions([]);
      else setToOptions([]);
      return;
    }

    const service = autocompleteServiceRef.current;
    if (!service) return;

    const searchQuery = query;

    service.getPlacePredictions({ input: searchQuery, types: ["geocode"], componentRestrictions: { country: "in" } } as any as any, (predictions, status) => {
      const lowerQuery = query.toLowerCase();
      const isAirportQuery = lowerQuery.includes("air") || lowerQuery.includes("flight") || lowerQuery.includes("terminal") || lowerQuery.includes("blr") || lowerQuery.includes("kempegowda") || lowerQuery.includes("hal") || lowerQuery.includes("jakkur");

      if ((status !== "OK" || !predictions) && !isAirportQuery) {
        if (target === "from") setFromOptions([]);
        else setToOptions([]);
        return;
      }

      const safePredictions = predictions || [];
      
      let filteredPredictions = safePredictions.filter(p => {
        const desc = p.description.toLowerCase();
        return SOUTH_INDIA_STATES.some(state => desc.includes(state)) || isAirportQuery;
      });

      if (filteredPredictions.length === 0 && safePredictions.length > 0 && !isAirportQuery) {
        const outOfBoundsOptions = [{ value: "", label: "🚫 Out of Service Area (South India & Goa only)", disabled: true }] as any[];
        if (target === "from") setFromOptions(outOfBoundsOptions);
        else setToOptions(outOfBoundsOptions);
        return;
      }
let options: any[] = filteredPredictions.map((p) => ({ value: p.description, label: p.description }));
      
      if (isAirportQuery) {
        const airportOptions = BENGALURU_AIRPORTS.map(a => ({
          value: `${a.name}, ${SERVICE_CITY}`,
          label: (
            <div className="flex items-center gap-2">
              <span>✈️</span>
              <span className="font-medium text-gray-900">{a.name} <span className="text-gray-400 font-normal">({a.code})</span></span>
            </div>
          )
        }));
        
        // Reverse array before unshifting to maintain order since we unshift one by one
        [...airportOptions].reverse().forEach(ao => {
          if (!options.find(o => o.value === ao.value)) {
            options.unshift(ao);
          }
        });
      }

      if (target === "from") setFromOptions(options);
      else setToOptions(options);
    });
  }, []);

  const onSearch = useCallback(async (values: { from: string; to: string; date?: Dayjs }) => {
    const fromNeedle = values.from.trim();
    const toNeedle = values.to.trim();
    const searchDate = values.date;

    

    setLoading(true);
    try {
      const allTrips = await listTrips(200);

      const filtered = allTrips
        .filter((trip) => {
          const fromOk = matchesLocation(trip.fromLocation, fromNeedle);
          const toOk = matchesLocation(trip.toLocation, toNeedle);
          
          let dateOk = true;
          if (searchDate) {
            const tripDate = dayjs(trip.departureAt);
            dateOk = tripDate.isSame(searchDate, "day");
          }
          
          return fromOk && toOk && dateOk;
        })
        .sort((a, b) => new Date(a.departureAt).getTime() - new Date(b.departureAt).getTime());

      setResults(filtered);
      
      // Validate South India via Geocoder
      if ((window as any).google && (window as any).google.maps) {
        const geocoder = new (window as any).google.maps.Geocoder();
        const validateLocation = async (address: string) => {
          return new Promise<boolean>((resolve) => {
            geocoder.geocode({ address }, (results: any, status: any) => {
              if (status === "OK" && results && results[0]) {
                let state = "";
                for (const component of results[0].address_components) {
                  if (component.types.includes("administrative_area_level_1")) {
                    state = component.long_name.toLowerCase();
                  }
                }
                resolve(SOUTH_INDIA_STATES.some(s => state.includes(s)));
              } else {
                resolve(true); // Default pass if geocoding fails
              }
            });
          });
        };

        const isFromValid = await validateLocation(values.from);
        const isToValid = await validateLocation(values.to);

        if (!isFromValid || !isToValid) {
          import("sonner").then(m => m.toast.error("We currently only operate in South India and Goa."));
          setLoading(false);
          return;
        }
      }

      setSearched(true);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Unable to search trips.");
    } finally {
      setLoading(false);
    }
  }, []);

  const summary = useMemo(() => {
    if (!searched) return "";
    return results.length > 0 ? `${results.length} trip(s) found` : "No matching trips found";
  }, [searched, results.length]);

  const value = useMemo(
    () => ({
      loading,
      searched,
      results,
      fromOptions,
      toOptions,
      searchPlaces,
      onSearch,
      summary,
    }),
    [loading, searched, results, fromOptions, toOptions, searchPlaces, onSearch, summary],
  );

  return <TripSearchContext.Provider value={value}>{children}</TripSearchContext.Provider>;
}

export function TripSearchForm({
  variant,
  id,
}: {
  variant: "landing" | "page";
  id?: string;
}) {
  const { loading, fromOptions, toOptions, searchPlaces, onSearch, summary } = useTripSearchContext();
  const [form] = Form.useForm();
  const selectedDate = Form.useWatch("date", form);
  const [locating, setLocating] = useState(false);

  const locateUser = useCallback((highAccuracy = true) => {
    if (!navigator.geolocation) {
      import("sonner").then(m => m.toast.error("Geolocation is not supported by your browser."));
      return;
    }

    setLocating(true);

    const handleIPFallback = async () => {
      try {
        const response = await fetch("https://ipapi.co/json/");
        const data = await response.json();
        if (data && data.city) {
          form.setFieldsValue({ from: data.city });
          import("sonner").then(m => m.toast.success(`Detected via IP: ${data.city}`));
        }
      } catch (e) {
        console.error("IP Fallback failed:", e);
      } finally {
        setLocating(false);
      }
    };

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        if ((window as any).google && (window as any).google.maps) {
          const geocoder = new (window as any).google.maps.Geocoder();
          geocoder.geocode({ location: { lat: latitude, lng: longitude } }, (results: any, status: any) => {
            if (status === "OK" && results && results.length > 0) {
              let city = "";
              let state = "";
              
              for (const component of results[0].address_components) {
                const types = component.types;
                if (types.includes("administrative_area_level_1")) state = component.long_name.toLowerCase();
                if (types.includes("locality") || types.includes("administrative_area_level_2") || types.includes("sublocality") || types.includes("neighborhood")) {
                  if (!city) city = component.long_name;
                }
              }

              const southIndiaStates = ["karnataka", "kerala", "tamil nadu", "andhra pradesh", "telangana", "goa"];
              const isSouthIndia = state ? southIndiaStates.some(s => state.includes(s)) : true;
              
              if (!isSouthIndia && state) {
                import("sonner").then(m => m.toast.error(`Service currently unavailable in ${state}. We are live in South India & Goa!`));
              } else if (city) {
                form.setFieldsValue({ from: city });
                import("sonner").then(m => m.toast.success(`Location detected: ${city}`));
              }
            }
            setLocating(false);
          });
        } else {
          setLocating(false);
        }
      },
      (error) => {
        // If high accuracy failed, try standard accuracy
        if (highAccuracy && (error.code === 2 || error.code === 3)) {
          locateUser(false);
          return;
        }

        // If all GPS attempts failed, use IP fallback
        console.log("GPS failed, trying IP fallback...");
        handleIPFallback();
      },
      { timeout: highAccuracy ? 5000 : 10000, enableHighAccuracy: highAccuracy }
    );
  }, [form]);

  useEffect(() => {
    // Set default values
    if (!form.getFieldValue("to")) {
      form.setFieldsValue({ to: "Kempegowda International Airport" });
    }
    if (!form.getFieldValue("date")) {
      form.setFieldsValue({ date: dayjs() });
    }

    // Try auto-locate on mount
    locateUser();
  }, [form, locateUser]);

  useEffect(() => {
    const handleCityDetected = (e: Event) => {
      const customEvent = e as CustomEvent<{from: string; to: string} | string>;
      const detail = customEvent.detail;
      
      if (typeof detail === "string") {
        if (!form.getFieldValue("from")) form.setFieldsValue({ from: detail });
      } else {
        if (!form.getFieldValue("from")) form.setFieldsValue({ from: detail.from });
        if (!form.getFieldValue("to")) form.setFieldsValue({ to: detail.to });
      }
    };
    
    window.addEventListener("coolpool:cityDetected", handleCityDetected);
    return () => window.removeEventListener("coolpool:cityDetected", handleCityDetected);
  }, [form]);

  if (variant === "page") {
    return (
      <Card id={id} className="bg-white p-3 border-gray-100 shadow-sm max-w-2xl mx-auto rounded-[2rem]">
        <Form
          form={form}
          id="page-trip-search"
          layout="horizontal"
          onFinish={onSearch}
          className="flex items-center gap-2"
        >
          <Form.Item name="from" className="m-0 flex-1">
            <AutoComplete
              options={fromOptions}
              onSearch={(text) => searchPlaces(text, "from")}
              placeholder="From"
              className="bg-gray-50 rounded-2xl w-full"
              variant="borderless"
            />
          </Form.Item>
          <ArrowRight size={14} className="text-gray-300" />
          <Form.Item name="to" className="m-0 flex-1">
            <AutoComplete
              options={toOptions}
              onSearch={(text) => searchPlaces(text, "to")}
              placeholder="To"
              className="bg-gray-50 rounded-2xl w-full"
              variant="borderless"
            />
          </Form.Item>
          <UiButton type="submit" variant="hero" size="sm" className="h-10 w-10 p-0 rounded-full">
            <ArrowRight size={18} />
          </UiButton>
        </Form>
      </Card>
    );
  }

  return (
    <div
      id={id}
      className="w-full max-w-[1200px] mx-auto px-6 relative z-10 -mt-16 sm:-mt-20 animate-in fade-in slide-in-from-bottom-6 duration-700"
    >
      {/* The outer container: clean white pill, no overflow clipping */}
      <div className="bg-white/97 backdrop-blur-2xl rounded-[2rem] shadow-2xl border border-gray-100 ring-1 ring-black/5">
        <Form
          form={form}
          id="landing-trip-search"
          onFinish={onSearch}
        >
          {/* ───── DESKTOP LAYOUT ───── */}
          <div className="hidden lg:flex items-center h-24 px-2">

            {/* ── PICKUP (27%) ── */}
            <div
              style={{ flex: "0 0 27%" }}
              className="h-full flex items-center px-6 hover:bg-gray-50/60 rounded-2xl transition-colors group cursor-pointer"
              onClick={() => !locating && locateUser()}
            >
              <div className="flex items-center gap-4 w-full min-w-0">
                <div className="shrink-0 p-2.5 rounded-xl bg-gray-100/80 text-gray-400 group-hover:bg-primary/10 group-hover:text-primary transition-all duration-250 relative">
                  {locating ? (
                    <div className="h-5 w-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                  ) : (
                    <Navigation size={20} strokeWidth={2.5} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.12em] text-gray-400 mb-0.5">Pickup</p>
                  <Form.Item name="from" rules={[{ required: true }]} className="m-0">
                    <AutoComplete
                      options={fromOptions}
                      onSearch={(text) => searchPlaces(text, "from")}
                      placeholder="City or area"
                      variant="borderless"
                      className="w-full [&_.ant-select-selector]:px-0 [&_.ant-select-selector]:h-auto [&_.ant-select-selection-item]:text-[17px] [&_.ant-select-selection-item]:font-bold [&_.ant-select-selection-item]:text-gray-900 [&_.ant-select-selection-placeholder]:text-gray-300 [&_.ant-select-selection-placeholder]:text-base [&_.ant-select-selection-placeholder]:font-semibold [&_.ant-select-selection-search-input]:text-[17px] [&_.ant-select-selection-search-input]:font-bold"
                    />
                  </Form.Item>
                </div>
              </div>
            </div>

            {/* divider */}
            <div className="w-px h-12 bg-gray-100 shrink-0" />

            {/* ── DESTINATION (33%) ── */}
            <div
              style={{ flex: "0 0 33%" }}
              className="h-full flex items-center px-6 hover:bg-gray-50/60 rounded-2xl transition-colors group cursor-pointer"
            >
              <div className="flex items-center gap-4 w-full min-w-0">
                <div className="shrink-0 p-2.5 rounded-xl bg-gray-100/80 text-gray-400 group-hover:bg-secondary/10 group-hover:text-secondary transition-all duration-250">
                  <MapPin size={20} strokeWidth={2.5} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.12em] text-gray-400 mb-0.5">Destination</p>
                  <Form.Item name="to" rules={[{ required: true }]} className="m-0">
                    <AutoComplete
                      options={toOptions}
                      onSearch={(text) => searchPlaces(text, "to")}
                      placeholder="Where to?"
                      variant="borderless"
                      className="w-full [&_.ant-select-selector]:px-0 [&_.ant-select-selector]:h-auto [&_.ant-select-selection-item]:text-[17px] [&_.ant-select-selection-item]:font-bold [&_.ant-select-selection-item]:text-gray-900 [&_.ant-select-selection-placeholder]:text-gray-300 [&_.ant-select-selection-placeholder]:text-base [&_.ant-select-selection-placeholder]:font-semibold [&_.ant-select-selection-search-input]:text-[17px] [&_.ant-select-selection-search-input]:font-bold"
                    />
                  </Form.Item>
                </div>
              </div>
            </div>

            {/* divider */}
            <div className="w-px h-12 bg-gray-100 shrink-0" />

            {/* ── DATE SELECTOR (22%) ── */}
            <div
              style={{ flex: "0 0 22%" }}
              className="h-full flex items-center px-8 hover:bg-gray-50/60 rounded-2xl transition-colors group"
            >
              <div className="flex items-center gap-5 w-full min-w-0">
                <div className="shrink-0 p-2.5 rounded-xl bg-gray-100/80 text-gray-400 group-hover:bg-amber-50 group-hover:text-amber-500 transition-all duration-250">
                  <Clock size={20} strokeWidth={2.5} />
                </div>
                <div className="flex-1 min-w-0 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => form.setFieldsValue({ date: dayjs() })}
                    className={cn(
                      "w-full h-[32px] rounded-lg text-[10px] font-black uppercase tracking-wider transition-all border flex items-center justify-center whitespace-nowrap",
                      dayjs().isSame(selectedDate, "day")
                        ? "bg-primary text-white border-transparent shadow-md shadow-primary/25"
                        : "bg-gray-50 text-gray-400 border-gray-100 hover:border-primary/30 hover:text-primary"
                    )}
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    onClick={() => form.setFieldsValue({ date: dayjs().add(1, 'day') })}
                    className={cn(
                      "w-full h-[32px] rounded-lg text-[10px] font-black uppercase tracking-wider transition-all border flex items-center justify-center whitespace-nowrap",
                      dayjs().add(1, 'day').isSame(selectedDate, "day")
                        ? "bg-primary text-white border-transparent shadow-md shadow-primary/25"
                        : "bg-gray-50 text-gray-400 border-gray-100 hover:border-primary/30 hover:text-primary"
                    )}
                  >
                    Tomorrow
                  </button>
                  <Form.Item name="date" className="hidden">
                    <DatePicker />
                  </Form.Item>
                </div>
              </div>
            </div>

            {/* ── SEARCH BUTTON (18%) ── */}
            <div style={{ flex: "0 0 18%" }} className="h-full p-2.5 shrink-0 pl-4">
              <UiButton
                type="submit"
                variant="hero"
                className="w-full h-full rounded-2xl font-black text-lg shadow-glow hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2.5"
                disabled={loading}
              >
                {loading ? (
                  <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Search</span>
                    <ArrowRight size={20} strokeWidth={3} />
                  </>
                )}
              </UiButton>
            </div>
          </div>

          {/* ───── MOBILE LAYOUT (stacked) ───── */}
          <div className="flex flex-col lg:hidden divide-y divide-gray-100 p-3 gap-1">
            {/* Pickup */}
            <div className="flex items-center gap-4 px-4 py-4">
              <div className="shrink-0 p-2.5 rounded-xl bg-gray-100 text-gray-400">
                <Navigation size={20} strokeWidth={2.5} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-gray-400 mb-0.5">Pickup</p>
                <Form.Item name="from" rules={[{ required: true }]} className="m-0">
                  <AutoComplete
                    options={fromOptions}
                    onSearch={(text) => searchPlaces(text, "from")}
                    placeholder="City or area"
                    variant="borderless"
                    className="w-full [&_.ant-select-selector]:px-0 [&_.ant-select-selection-item]:text-base [&_.ant-select-selection-item]:font-bold"
                  />
                </Form.Item>
              </div>
            </div>

            {/* Destination */}
            <div className="flex items-center gap-4 px-4 py-4">
              <div className="shrink-0 p-2.5 rounded-xl bg-gray-100 text-gray-400">
                <MapPin size={20} strokeWidth={2.5} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-gray-400 mb-0.5">Destination</p>
                <Form.Item name="to" rules={[{ required: true }]} className="m-0">
                  <AutoComplete
                    options={toOptions}
                    onSearch={(text) => searchPlaces(text, "to")}
                    placeholder="Where to?"
                    variant="borderless"
                    className="w-full [&_.ant-select-selector]:px-0 [&_.ant-select-selection-item]:text-base [&_.ant-select-selection-item]:font-bold"
                  />
                </Form.Item>
              </div>
            </div>

            {/* When + Search */}
            <div className="flex items-center gap-3 px-4 pt-4 pb-2">
              <div className="shrink-0 p-2.5 rounded-xl bg-gray-100 text-gray-400">
                <Clock size={20} strokeWidth={2.5} />
              </div>
              <div className="flex-1 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => form.setFieldsValue({ date: dayjs() })}
                  className={cn(
                    "flex-1 h-11 rounded-xl text-sm font-bold transition-all border flex items-center justify-center",
                    dayjs().isSame(selectedDate, "day")
                      ? "bg-primary text-white border-transparent"
                      : "bg-gray-50 text-gray-500 border-gray-100"
                  )}
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => form.setFieldsValue({ date: dayjs().add(1, 'day') })}
                  className={cn(
                    "flex-1 h-11 rounded-xl text-sm font-bold transition-all border flex items-center justify-center",
                    dayjs().add(1, 'day').isSame(selectedDate, "day")
                      ? "bg-primary text-white border-transparent"
                      : "bg-gray-50 text-gray-500 border-gray-100"
                  )}
                >
                  Tomorrow
                </button>
              </div>
              <Form.Item name="date" className="hidden">
                <DatePicker />
              </Form.Item>
            </div>

            {/* Mobile Search Button */}
            <div className="px-2 pt-2 pb-2">
              <UiButton
                type="submit"
                variant="hero"
                className="w-full h-14 rounded-2xl font-black text-lg shadow-glow flex items-center justify-center gap-2.5"
                disabled={loading}
              >
                {loading ? (
                  <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Search</span>
                    <ArrowRight size={20} strokeWidth={3} />
                  </>
                )}
              </UiButton>
            </div>
          </div>

        </Form>
      </div>
    </div>
  );
}

export function TripSearchResults({ variant }: { variant: "landing" | "page" }) {
  const { loading, searched, results } = useTripSearchContext();
  const resultsAnchorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!searched || loading) return;
    const el = resultsAnchorRef.current;
    if (!el) return;
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const run = () =>
      el.scrollIntoView({
        behavior: prefersReduced ? "instant" : "smooth",
        block: "start",
      });
    const id = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(run);
    });
    return () => window.cancelAnimationFrame(id);
  }, [searched, loading]);

  if (!searched && !loading) return null;

  return (
    <div
      ref={resultsAnchorRef}
      id="trip-search-results"
      className={cn(
        "scroll-mt-28 space-y-6 w-full min-w-0",
        variant === "landing" && "pt-2 pb-4",
        variant === "page" && "pt-4",
      )}
    >
      {loading && (
        <Card className="rounded-3xl border-border/60 bg-card/80 p-10 sm:p-16 flex justify-center">
          <Spin size="large" />
        </Card>
      )}

      {!loading && searched && results.length === 0 && (
        <Card className="rounded-3xl border-border/60 bg-card/90 backdrop-blur-sm p-8 md:p-12 border-dashed">
          <Empty description="No trips match this route yet. Try nearby cities or check back soon." />
        </Card>
      )}

      {!loading && results.length > 0 && (
        <div className="space-y-6 w-full max-w-2xl mx-auto min-w-0 pb-20">
          <div className="flex items-center justify-between gap-4 px-2">
            <h3 className="text-xl font-bold tracking-tight text-gray-900">
              {dayjs(results[0].departureAt).format("dddd, MMM DD")}
            </h3>
            <UiButton variant="ghost" size="sm" className="rounded-2xl text-primary font-bold">
              <Filter className="h-4 w-4 mr-2" /> Filter
            </UiButton>
          </div>

          <div className="space-y-4">
            {results.map((trip) => (
              <Link 
                key={trip.id} 
                to="/booking/$tripId" 
                params={{ tripId: trip.id }}
                className="block group"
              >
                <Card className="rounded-3xl border border-gray-100 bg-white shadow-soft hover:shadow-elevated hover:border-primary/20 transition-all duration-300 overflow-hidden relative p-6">
                  <div className="flex justify-between items-start mb-6">
                    <div className="flex gap-5 flex-1 min-w-0">
                      {/* Timeline column */}
                      <div className="flex flex-col items-center justify-between py-1 shrink-0">
                        <span className="font-bold text-lg text-gray-900 leading-none">
                          {dayjs(trip.departureAt).format("HH:mm")}
                        </span>
                        <div className="flex flex-col items-center gap-1 my-2 flex-1">
                          <div className="h-2.5 w-2.5 rounded-full border-2 border-gray-900" />
                          <div className="w-0.5 flex-1 bg-gray-900" />
                          <div className="h-2.5 w-2.5 rounded-full border-2 border-gray-400" />
                        </div>
                        <span className="font-bold text-lg text-gray-400 leading-none">
                          --:--
                        </span>
                      </div>

                      {/* Location column */}
                      <div className="flex flex-col justify-between py-1 flex-1 min-w-0 gap-8">
                        <div className="min-w-0">
                          <p className="font-bold text-lg text-gray-900 truncate">{primarySegment(trip.fromLocation)}</p>
                          <p className="text-xs text-gray-400 truncate">{trip.fromLocation}</p>
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-lg text-gray-400 truncate">{primarySegment(trip.toLocation)}</p>
                          <p className="text-xs text-gray-400 truncate">{trip.toLocation}</p>
                        </div>
                      </div>

                      {/* Duration (Absolute centered on timeline) */}
                      <div className="absolute left-[88px] top-[48%] -translate-y-1/2 bg-white px-1">
                         <span className="text-[10px] font-bold text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full border border-gray-100">
                           {Math.round(trip.totalDistanceKm / 60)}h{Math.round(trip.totalDistanceKm % 60)}m
                         </span>
                      </div>
                    </div>

                    {/* Price */}
                    <div className="flex flex-col items-end shrink-0 ml-4">
                      <div className="text-2xl font-black text-gray-900">
                        {formatCurrency(trip.totalPrice / trip.totalSeats)}
                      </div>
                      <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">
                        per seat
                      </span>
                    </div>
                  </div>

                  <div className="h-px bg-gray-50 -mx-6 mb-4" />

                  {/* Driver Footer */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center text-gray-400 font-bold overflow-hidden border border-gray-50">
                          {trip.hostId[0].toUpperCase()}
                        </div>
                        <div className="absolute -bottom-0.5 -right-0.5 bg-white rounded-full p-0.5 shadow-sm">
                          <ShieldCheck size={14} className="text-blue-500 fill-blue-500/10" />
                        </div>
                      </div>
                      <div>
                        <p className="font-bold text-sm text-gray-800">Verified Host</p>
                        <div className="flex items-center gap-1 text-xs text-gray-400 font-medium">
                          <Star size={12} className="fill-amber-400 text-amber-400" />
                          <span>4.8 · {trip.totalSeats} seats left</span>
                        </div>
                      </div>
                    </div>
                    <ChevronRight size={20} className="text-gray-200 group-hover:text-primary transition-colors" />
                  </div>
                </Card>
              </Link>
            ))}
          </div>

          {/* Floating Map Button */}
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40">
            <UiButton className="rounded-full h-12 px-6 bg-primary text-white font-bold shadow-glow border-none flex items-center gap-2 hover:scale-105 active:scale-95 transition-all">
              <MapIcon size={18} />
              Show rides on map
            </UiButton>
          </div>
        </div>
      )}
    </div>
  );
}
