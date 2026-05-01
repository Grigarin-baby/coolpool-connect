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
  Empty,
  Form,
  Spin,
  Tag,
  Typography,
  message,
} from "antd";
import { ArrowRight, MapPin, Navigation } from "lucide-react";
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
  onSearch: (values: { from: string; to: string }) => Promise<void>;
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

  const onSearch = useCallback(async (values: { from: string; to: string }) => {
    const fromNeedle = values.from.trim();
    const toNeedle = values.to.trim();

    setLoading(true);
    try {
      const allTrips = await listTrips(200);

      const filtered = allTrips
        .filter((trip) => {
          const fromOk = matchesLocation(trip.fromLocation, fromNeedle);
          const toOk = matchesLocation(trip.toLocation, toNeedle);
          return fromOk && toOk;
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
        <div className={cn("grid md:grid-cols-2", variant === "landing" ? "gap-4 md:gap-5" : "gap-4 md:gap-5")}>
          <Form.Item
            label={
              <span
                className={cn(
                  "inline-flex items-center gap-2 font-medium",
                  variant === "landing" && "text-sm sm:text-[15px]",
                )}
              >
                <MapPin className="h-4 w-4 text-primary shrink-0" aria-hidden />
                From
              </span>
            }
            name="from"
            rules={[{ required: true, message: "Enter a starting city or area" }]}
          >
            <AutoComplete
              options={fromOptions}
              onSearch={(text) => searchPlaces(text, "from")}
              placeholder="e.g. Bengaluru"
              size="large"
            />
          </Form.Item>
          <Form.Item
            label={
              <span
                className={cn(
                  "inline-flex items-center gap-2 font-medium",
                  variant === "landing" && "text-sm sm:text-[15px]",
                )}
              >
                <MapPin className="h-4 w-4 text-primary shrink-0" aria-hidden />
                To
              </span>
            }
            name="to"
            rules={[{ required: true, message: "Enter where you're headed" }]}
          >
            <AutoComplete
              options={toOptions}
              onSearch={(text) => searchPlaces(text, "to")}
              placeholder="e.g. Mysuru"
              size="large"
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
          <ul className="grid w-full min-w-0 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6 lg:gap-8 list-none p-0 m-0">
            {results.map((trip) => (
              <li key={trip.id} className="min-w-0">
                <Card className="rounded-none border-border/60 bg-card/95 shadow-card hover:border-primary/25 transition-base overflow-hidden h-full flex flex-col">
                  <div className="p-4 sm:p-5 flex flex-col gap-4 flex-1 min-h-0">
                    <div className="space-y-2 min-w-0">
                      <Typography.Title
                        level={5}
                        style={{ margin: 0 }}
                        className="!font-bold !text-base sm:!text-lg leading-snug text-balance break-words"
                      >
                        {trip.fromLocation}
                        <span className="text-primary mx-1 sm:mx-2">→</span>
                        {trip.toLocation}
                      </Typography.Title>
                      <Typography.Text type="secondary" className="text-xs sm:text-sm block">
                        Departure {new Date(trip.departureAt).toLocaleString()}
                      </Typography.Text>
                    </div>
                    <div className="flex flex-wrap gap-2 items-center">
                      <Tag color="purple" className="rounded-none m-0">
                        {trip.totalSeats} seats
                      </Tag>
                      <Tag color="blue" className="rounded-none m-0">
                        {formatCurrency(trip.totalPrice)}
                      </Tag>
                    </div>
                    <UiButton
                      asChild
                      size="sm"
                      variant="hero"
                      className="rounded-none text-primary-foreground no-underline hover:no-underline w-full mt-auto justify-center"
                    >
                      <Link to="/booking/$tripId" params={{ tripId: trip.id }}>
                        Book seats
                      </Link>
                    </UiButton>
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
