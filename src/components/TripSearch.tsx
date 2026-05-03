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
import { ArrowRight, Calendar, MapPin, Navigation } from "lucide-react";
import dayjs, { Dayjs } from "dayjs";
import { Button as UiButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { listTrips } from "@/data/appwrite-repository";
import { routeCitySegmentsMatch } from "@/lib/geo";
import { formatCurrency } from "@/lib/pricing";
import { appwriteConfig } from "@/integrations/appwrite/client";
import { cn } from "@/lib/utils";

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

    service.getPlacePredictions({ input: query, types: ["(cities)"] }, (predictions, status) => {
      if (status !== "OK" || !predictions) {
        if (target === "from") setFromOptions([]);
        else setToOptions([]);
        return;
      }

      const options = predictions.map((p) => ({ value: p.description, label: p.description }));
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

  return (
    <Card
      id={id}
      className={cn(
        "rounded-none border-border/60 shadow-elevated scroll-mt-28",
        variant === "landing"
          ? "border-primary/15 bg-card/92 backdrop-blur-xl p-5 sm:p-7 md:p-8 lg:p-9 ring-1 ring-primary/10"
          : "bg-card p-4 sm:p-6 md:p-8 border-border/60",
      )}
    >
      {variant === "landing" && (
        <div className="mb-6 space-y-2.5">
          <div className="inline-flex items-center gap-2 rounded-none bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary sm:text-[13px]">
            <Navigation className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" aria-hidden />
            Trip finder
          </div>
          <h2 className="text-xl sm:text-2xl md:text-[1.75rem] lg:text-[1.9rem] font-bold tracking-tight text-balance font-heading leading-tight">
            Where are you going?
          </h2>
        </div>
      )}

      <Form
        id={variant === "landing" ? "landing-trip-search" : "page-trip-search"}
        layout="vertical"
        onFinish={onSearch}
        initialValues={{ from: "", to: "" }}
        className={
          variant === "landing"
            ? "[&_.ant-form-item]:mb-5 [&_.ant-form-item:last-child]:mb-0 [&_.ant-form-item-label>label]:text-sm [&_.ant-form-item-label>label]:sm:text-[15px] [&_.ant-form-item-label>label]:h-auto [&_.ant-input-affix-wrapper]:min-h-[44px] [&_.ant-input-affix-wrapper]:text-sm [&_.ant-input-affix-wrapper]:sm:text-[15px] [&_.ant-input]:text-sm [&_.ant-input]:sm:text-[15px]"
            : undefined
        }
      >
        <div className={cn("grid md:grid-cols-2 lg:grid-cols-3", variant === "landing" ? "gap-4 md:gap-5" : "gap-4 md:gap-5")}>
          <Form.Item
            label={
              <span className={cn("inline-flex items-center gap-2 font-medium", variant === "landing" && "text-sm sm:text-[15px]")}>
                <MapPin className="h-4 w-4 text-primary shrink-0" aria-hidden />
                From
              </span>
            }
            name="from"
            rules={[{ required: true, message: "Enter starting city" }]}
          >
            <AutoComplete
              options={fromOptions}
              onSearch={(text) => searchPlaces(text, "from")}
              placeholder="Starting city"
              size="large"
              className="w-full"
            />
          </Form.Item>
          <Form.Item
            label={
              <span className={cn("inline-flex items-center gap-2 font-medium", variant === "landing" && "text-sm sm:text-[15px]")}>
                <MapPin className="h-4 w-4 text-primary shrink-0" aria-hidden />
                To
              </span>
            }
            name="to"
            rules={[{ required: true, message: "Enter destination" }]}
          >
            <AutoComplete
              options={toOptions}
              onSearch={(text) => searchPlaces(text, "to")}
              placeholder="Destination city"
              size="large"
              className="w-full"
            />
          </Form.Item>
          <Form.Item
            label={
              <span className={cn("inline-flex items-center gap-2 font-medium", variant === "landing" && "text-sm sm:text-[15px]")}>
                <Calendar className="h-4 w-4 text-primary shrink-0" aria-hidden />
                Date
              </span>
            }
            name="date"
          >
            <DatePicker 
              className="w-full h-[40px] sm:h-[44px]" 
              placeholder="When are you going?"
              disabledDate={(current) => current && current < dayjs().startOf('day')}
              format="MMM DD, YYYY"
            />
          </Form.Item>
        </div>

        <div
          className={cn(
            "flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 mt-2",
            summary ? "sm:justify-between" : "sm:justify-end",
          )}
        >
          {summary ? (
            <Typography.Text type="secondary" className="text-sm text-center sm:text-start">
              {summary}
            </Typography.Text>
          ) : null}
          <UiButton
            type="submit"
            form={variant === "landing" ? "landing-trip-search" : "page-trip-search"}
            variant="hero"
            size="lg"
            className={cn(
              "rounded-none w-full sm:w-auto shadow-glow justify-center",
              variant === "landing"
                ? "sm:min-w-[176px] min-h-11 text-sm sm:text-base [&_svg]:size-4 sm:[&_svg]:size-[1.125rem]"
                : "sm:min-w-[168px]",
            )}
            disabled={loading}
          >
            {loading ? "Searching…" : "Search rides"}
            {!loading && <ArrowRight className="h-4 w-4" aria-hidden />}
          </UiButton>
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
        <Card className="rounded-none border-border/60 bg-card/80 p-10 sm:p-16 flex justify-center">
          <Spin size="large" />
        </Card>
      )}

      {!loading && searched && results.length === 0 && (
        <Card className="rounded-none border-border/60 bg-card/90 backdrop-blur-sm p-8 md:p-12 border-dashed">
          <Empty description="No trips match this route yet. Try nearby cities or check back soon." />
        </Card>
      )}

      {!loading && results.length > 0 && (
        <div className="space-y-5 sm:space-y-6 w-full min-w-0">
          <div className="flex items-center justify-between gap-4 flex-wrap w-full">
            <h3 className="text-lg font-bold tracking-tight">
              {variant === "landing" ? "Rides for your route" : "Matching rides"}
            </h3>
            <Typography.Text type="secondary" className="text-sm shrink-0">
              {results.length} trip{results.length !== 1 ? "s" : ""} · sorted by departure
            </Typography.Text>
          </div>
          <ul className="grid w-full min-w-0 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 list-none p-0 m-0">
            {results.map((trip) => (
              <li key={trip.id} className="min-w-0 group">
                <Card className="rounded-none border-border/60 bg-card/95 shadow-card hover:shadow-elevated hover:border-primary/40 transition-all duration-300 overflow-hidden h-full flex flex-col relative">
                  <div className="absolute top-0 right-0 p-3">
                    <div className="bg-primary/10 text-primary px-3 py-1 text-xs font-bold rounded-full">
                      {formatCurrency(trip.totalPrice)}
                    </div>
                  </div>
                  <div className="p-6 flex flex-col gap-6 flex-1 min-h-0">
                    <div className="flex gap-4 min-w-0">
                      <div className="flex flex-col items-center gap-1 pt-1">
                        <div className="h-2 w-2 rounded-full bg-primary" />
                        <div className="w-0.5 flex-1 bg-border/60 border-dashed border-l" />
                        <div className="h-2 w-2 rounded-full border-2 border-primary" />
                      </div>
                      <div className="flex-1 space-y-4 min-w-0">
                        <div>
                          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-0.5">Pickup</p>
                          <p className="font-bold text-base truncate">{trip.fromLocation}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-0.5">Drop</p>
                          <p className="font-bold text-base truncate">{trip.toLocation}</p>
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-border/40 space-y-4 mt-auto">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Calendar className="h-4 w-4" />
                          <span className="text-xs font-medium">{dayjs(trip.departureAt).format("MMM DD, hh:mm A")}</span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Users className="h-4 w-4" />
                          <span className="text-xs font-medium">{trip.totalSeats} seats</span>
                        </div>
                      </div>

                      <UiButton
                        asChild
                        variant="hero"
                        className="rounded-none w-full justify-center shadow-glow group-hover:scale-[1.02] transition-transform"
                      >
                        <Link to="/booking/$tripId" params={{ tripId: trip.id }}>
                          View details
                        </Link>
                      </UiButton>
                    </div>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
