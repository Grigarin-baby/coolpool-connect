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

    const searchQuery = query.toLowerCase().includes(SERVICE_CITY.toLowerCase()) || query.toLowerCase().includes("bangalore") 
      ? query 
      : `${query}, ${SERVICE_CITY}`;

    service.getPlacePredictions({ input: searchQuery, types: ["geocode"], componentRestrictions: { country: "in" } }, (predictions, status) => {
      const lowerQuery = query.toLowerCase();
      const isAirportQuery = lowerQuery.includes("air") || lowerQuery.includes("flight") || lowerQuery.includes("terminal") || lowerQuery.includes("blr") || lowerQuery.includes("kempegowda") || lowerQuery.includes("hal") || lowerQuery.includes("jakkur");

      if ((status !== "OK" || !predictions) && !isAirportQuery) {
        if (target === "from") setFromOptions([]);
        else setToOptions([]);
        return;
      }

      const safePredictions = predictions || [];
      const filteredPredictions = safePredictions.filter(p => 
        p.description.toLowerCase().includes(SERVICE_CITY.toLowerCase()) || 
        p.description.toLowerCase().includes("bangalore")
      );

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

    const fromValid = fromNeedle.toLowerCase().includes(SERVICE_CITY.toLowerCase()) || fromNeedle.toLowerCase().includes("bangalore");
    const toValid = toNeedle.toLowerCase().includes(SERVICE_CITY.toLowerCase()) || toNeedle.toLowerCase().includes("bangalore");

    if (!fromValid || !toValid) {
      message.error(`We are currently operating exclusively in ${SERVICE_CITY}.`);
      return;
    }

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

  return (
    <Card
      id={id}
      className={cn(
        "rounded-[2rem] border-border/60 shadow-soft scroll-mt-28 transition-all",
        variant === "landing"
          ? "border-primary/15 bg-card/92 backdrop-blur-xl p-4 sm:p-7 md:p-8 lg:p-9 ring-1 ring-primary/10 shadow-elevated"
          : "bg-white p-2 sm:p-3 border-gray-100 shadow-sm max-w-2xl mx-auto",
      )}
    >
      {variant === "landing" && (
        <div className="mb-4 sm:mb-6 space-y-2.5 text-center sm:text-left">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-balance font-heading">
            Book your next ride in {SERVICE_CITY}
          </h2>
        </div>
      )}

      <Form
        form={form}
        id={variant === "landing" ? "landing-trip-search" : "page-trip-search"}
        layout="vertical"
        onFinish={onSearch}
        initialValues={{ from: "", to: "" }}
        className={cn(
          variant === "landing"
            ? "[&_.ant-form-item]:mb-4 [&_.ant-form-item:last-child]:mb-0 [&_.ant-form-item-label>label]:text-xs [&_.ant-form-item-label>label]:font-bold [&_.ant-form-item-label>label]:uppercase [&_.ant-form-item-label>label]:tracking-wider [&_.ant-form-item-label>label]:text-muted-foreground [&_.ant-input-affix-wrapper]:min-h-[48px] sm:[&_.ant-input-affix-wrapper]:min-h-[56px] [&_.ant-input-affix-wrapper]:text-base sm:[&_.ant-input-affix-wrapper]:text-lg [&_.ant-input-affix-wrapper]:rounded-3xl [&_.ant-input]:text-base sm:[&_.ant-input]:text-lg"
            : "[&_.ant-form-item]:mb-0 [&_.ant-form-item-label]:hidden"
        )}
      >
        <div className={cn(
          "grid items-center",
          variant === "landing" 
            ? "grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-0 border border-border/60 divide-y md:divide-y-0 md:divide-x divide-border/60 p-1 bg-card/50" 
            : "grid-cols-[1fr_auto_1fr_auto_auto] gap-2"
        )}>
          <Form.Item
            name="from"
            rules={[{ required: true, message: "Enter starting city" }]}
            className={variant === "landing" ? "px-3 pt-2 pb-1 sm:px-4 sm:pt-3 sm:pb-1 m-0 bg-background/50 hover:bg-muted/30 transition-colors" : "m-0"}
          >
            <AutoComplete
              options={fromOptions}
              onSearch={(text) => searchPlaces(text, "from")}
              placeholder="From"
              size={variant === "landing" ? "large" : "middle"}
              variant="borderless"
              className={cn("w-full", variant === "landing" ? "[&_.ant-select-selector]:px-0" : "bg-gray-50 rounded-2xl")}
            />
          </Form.Item>
          
          <div className={cn("flex items-center justify-center", variant === "landing" ? "hidden" : "text-gray-300")}>
            <ArrowRight size={14} />
          </div>

          <Form.Item
            name="to"
            rules={[{ required: true, message: "Enter destination" }]}
            className={variant === "landing" ? "px-3 pt-2 pb-1 sm:px-4 sm:pt-3 sm:pb-1 m-0 bg-background/50 hover:bg-muted/30 transition-colors" : "m-0"}
          >
            <AutoComplete
              options={toOptions}
              onSearch={(text) => searchPlaces(text, "to")}
              placeholder="To"
              size={variant === "landing" ? "large" : "middle"}
              variant="borderless"
              className={cn("w-full", variant === "landing" ? "[&_.ant-select-selector]:px-0" : "bg-gray-50 rounded-2xl")}
            />
          </Form.Item>

          <Form.Item
            name="date"
            className={variant === "landing" ? "px-3 pt-2 pb-1 sm:px-4 sm:pt-3 sm:pb-1 m-0 bg-background/50 hover:bg-muted/30 transition-colors" : "m-0"}
          >
            <DatePicker 
              className={cn("w-full", variant === "landing" ? "h-[48px] sm:h-[56px] px-0" : "h-[40px] bg-gray-50 rounded-2xl px-3")} 
              placeholder="Date"
              disabledDate={(current) => current && current < dayjs().startOf('day')}
              format="MMM DD"
              variant="borderless"
              suffixIcon={variant === "landing" ? undefined : <Calendar size={14} className="text-gray-400" />}
            />
          </Form.Item>

          <div className={cn("flex items-center", variant === "landing" ? "bg-background/50 p-2" : "")}>
             <UiButton
              type="submit"
              form={variant === "landing" ? "landing-trip-search" : "page-trip-search"}
              variant="hero"
              size={variant === "landing" ? "lg" : "sm"}
              className={cn(
                "rounded-full shadow-glow font-bold",
                variant === "landing" ? "w-full h-full min-h-[48px] sm:min-h-[56px] text-base sm:text-lg" : "h-10 w-10 p-0"
              )}
              disabled={loading}
            >
              {loading ? (
                <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : variant === "landing" ? (
                "Search"
              ) : (
                <ArrowRight size={18} />
              )}
            </UiButton>
          </div>
        </div>
      </Form>
    </Card>
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
