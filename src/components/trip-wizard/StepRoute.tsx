import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AutoComplete, Spin } from "antd";
import { ArrowDown, MapPin, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWizardMaps } from "./useWizardMaps";
import { RouteMap } from "./RouteMap";
import { BENGALURU_AIRPORTS, SERVICE_CITY } from "@/lib/config";
import { fetchPlaceSuggestions, resolvePlace } from "./placesAutocomplete";
import type { PlacePoint, RouteAlternative } from "./types";

interface StepRouteProps {
  from: PlacePoint | null;
  to: PlacePoint | null;
  alternatives: RouteAlternative[];
  selectedAltId: number | null;
  onFromChange: (p: PlacePoint | null) => void;
  onToChange: (p: PlacePoint | null) => void;
  onAlternativesChange: (alts: RouteAlternative[], selectedAltId: number | null) => void;
}

interface CityOption {
  value: string;
  label: React.ReactNode;
  lat?: number;
  lng?: number;
  placeId?: string;
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

const AIRPORT_KEYWORDS = ["air", "flight", "terminal", "blr", "kempegowda", "hal", "jakkur"];

export function StepRoute({
  from,
  to,
  alternatives,
  selectedAltId,
  onFromChange,
  onToChange,
  onAlternativesChange,
}: StepRouteProps) {
  const { ready, error } = useWizardMaps();
  const [fromText, setFromText] = useState(from?.label ?? "");
  const [toText, setToText] = useState(to?.label ?? "");
  const [fromOptions, setFromOptions] = useState<CityOption[]>([]);
  const [toOptions, setToOptions] = useState<CityOption[]>([]);
  const [fetchingRoutes, setFetchingRoutes] = useState(false);
  const [fromSearching, setFromSearching] = useState(false);
  const [toSearching, setToSearching] = useState(false);

  const directionsRef = useRef<any>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up debounce on unmount
  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  // Initialize Directions service once maps is ready
  useEffect(() => {
    if (!ready) return;
    const google = (window as any).google;
    if (!directionsRef.current && google?.maps?.DirectionsService) {
      directionsRef.current = new google.maps.DirectionsService();
    }
  }, [ready]);

  // Debounced city search — 300 ms delay, two-tier API (new → legacy fallback).
  const searchCities = useCallback((query: string, target: "from" | "to") => {
    // Clear immediately on short input
    if (!query || query.trim().length < 2) {
      if (target === "from") { setFromOptions([]); setFromSearching(false); }
      else { setToOptions([]); setToSearching(false); }
      if (debounceRef.current) clearTimeout(debounceRef.current);
      return;
    }

    // Show loading indicator straight away so it feels responsive
    if (target === "from") setFromSearching(true);
    else setToSearching(true);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const lower = query.toLowerCase();
      const isAirport = AIRPORT_KEYWORDS.some((k) => lower.includes(k));

      const suggestions = await fetchPlaceSuggestions(query);

      const filtered = suggestions.filter((s) => {
        const desc = s.description.toLowerCase();
        return SOUTH_INDIA_STATES.some((st) => desc.includes(st)) || isAirport;
      });

      let options: CityOption[] = filtered.map((s) => ({
        value: s.description,
        label: s.description,
        placeId: s.id,
      }));

      // Prepend airport shortcuts when the query looks like an airport search
      if (isAirport) {
        const airportOptions: CityOption[] = BENGALURU_AIRPORTS.map((a) => ({
          value: `${a.name}, ${SERVICE_CITY}`,
          label: (
            <div className="flex items-center gap-2">
              <span>✈️</span>
              <span className="font-medium text-gray-900">
                {a.name} <span className="text-gray-400 font-normal">({a.code})</span>
              </span>
            </div>
          ),
          lat: a.lat,
          lng: a.lng,
        }));
        [...airportOptions].reverse().forEach((ao) => {
          if (!options.find((o) => o.value === ao.value)) options.unshift(ao);
        });
      }

      // When suggestions came back but none are in South India → tell the user
      if (options.length === 0 && suggestions.length > 0 && !isAirport) {
        options = [
          {
            value: "__out_of_area__",
            label: (
              <span className="text-xs text-gray-400">
                🚫 Out of service area — South India &amp; Goa only
              </span>
            ),
            disabled: true,
          } as any,
        ];
      }

      if (target === "from") { setFromOptions(options); setFromSearching(false); }
      else { setToOptions(options); setToSearching(false); }
    }, 300);
  }, []);

  const resolveCoords = useCallback(
    async (option: CityOption): Promise<PlacePoint | null> => {
      // Airports come with coords already.
      if (typeof option.lat === "number" && typeof option.lng === "number") {
        return { label: option.value, lat: option.lat, lng: option.lng };
      }
      if (!option.placeId) return null;
      const resolved = await resolvePlace(option.placeId);
      if (!resolved) return null;
      // Prefer the label the user actually saw in the dropdown over the
      // sometimes-shorter formatted_address Google returns.
      return { ...resolved, label: option.value };
    },
    [],
  );

  const handleSelect = async (side: "from" | "to", value: string) => {
    const list = side === "from" ? fromOptions : toOptions;
    const hit = list.find((o) => o.value === value);
    if (!hit) return;
    const point = await resolveCoords(hit);
    if (!point) return;
    if (side === "from") {
      onFromChange(point);
      setFromText(point.label);
    } else {
      onToChange(point);
      setToText(point.label);
    }
  };

  // Whenever both endpoints are set, fetch route alternatives
  useEffect(() => {
    if (!ready || !from || !to || !directionsRef.current) return;
    setFetchingRoutes(true);
    directionsRef.current.route(
      {
        origin: { lat: from.lat, lng: from.lng },
        destination: { lat: to.lat, lng: to.lng },
        travelMode: (window as any).google.maps.TravelMode.DRIVING,
        provideRouteAlternatives: true,
      },
      (result: any, status: string) => {
        setFetchingRoutes(false);
        if (status !== "OK" || !result?.routes?.length) {
          onAlternativesChange([], null);
          return;
        }
        const alts: RouteAlternative[] = result.routes.map((r: any, idx: number) => {
          const leg = r.legs[0];
          return {
            id: idx,
            polyline: r.overview_polyline,
            distanceKm: (leg?.distance?.value ?? 0) / 1000,
            durationMin: Math.round((leg?.duration?.value ?? 0) / 60),
            summary: r.summary || "",
          };
        });
        onAlternativesChange(alts, alts[0]?.id ?? null);
      },
    );
  }, [ready, from, to, onAlternativesChange]);

  const sortedAlts = useMemo(
    () => [...alternatives].sort((a, b) => a.id - b.id),
    [alternatives],
  );

  return (
    <div className="flex flex-col gap-4 px-4 pb-6">
      <div className="relative space-y-2 rounded-3xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
            <MapPin size={18} />
          </span>
          <div className="relative flex-1">
            <AutoComplete
              value={fromText}
              options={fromOptions}
              onSearch={(v) => {
                setFromText(v);
                searchCities(v, "from");
              }}
              onSelect={(v) => {
                if (v === "__out_of_area__") return;
                void handleSelect("from", v);
              }}
              onChange={(v) => setFromText(typeof v === "string" ? v : "")}
              placeholder="Pickup city or area"
              className="w-full"
              variant="borderless"
              classNames={{ popup: { root: "trip-search-ac-dropdown" } }}
            />
            {fromSearching && (
              <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-400">
                <Loader2 size={14} className="animate-spin" />
              </span>
            )}
          </div>
        </div>
        <div className="ml-[1.125rem] my-1 flex items-center text-gray-300">
          <ArrowDown size={16} />
        </div>
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-pink-500/10 text-pink-600">
            <MapPin size={18} />
          </span>
          <div className="relative flex-1">
            <AutoComplete
              value={toText}
              options={toOptions}
              onSearch={(v) => {
                setToText(v);
                searchCities(v, "to");
              }}
              onSelect={(v) => {
                if (v === "__out_of_area__") return;
                void handleSelect("to", v);
              }}
              onChange={(v) => setToText(typeof v === "string" ? v : "")}
              placeholder="Drop-off city or area"
              className="w-full"
              variant="borderless"
              classNames={{ popup: { root: "trip-search-ac-dropdown" } }}
            />
            {toSearching && (
              <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-400">
                <Loader2 size={14} className="animate-spin" />
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="relative">
        {!ready && !error && (
          <div className="grid h-64 place-items-center rounded-3xl border border-gray-100 bg-white text-gray-400">
            <Spin />
          </div>
        )}
        {error && (
          <div className="grid h-64 place-items-center rounded-3xl border border-rose-200 bg-rose-50 px-6 text-center text-sm text-rose-600">
            Couldn't load Google Maps. Check your network or API key.
          </div>
        )}
        {ready && (
          <div className="overflow-hidden rounded-3xl border border-gray-100 shadow-sm">
            <RouteMap
              from={from}
              to={to}
              alternatives={alternatives}
              selectedAltId={selectedAltId}
              onSelectAlternative={(id) => onAlternativesChange(alternatives, id)}
              className="h-72 w-full"
            />
          </div>
        )}
        {fetchingRoutes && (
          <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-gray-600 shadow">
              <Spin size="small" /> Finding routes…
            </span>
          </div>
        )}
      </div>

      {alternatives.length > 1 && (
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-gray-500">
            Choose a route
          </p>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {sortedAlts.map((alt) => {
              const isSelected = alt.id === selectedAltId;
              return (
                <button
                  type="button"
                  key={alt.id}
                  onClick={() => onAlternativesChange(alternatives, alt.id)}
                  className={cn(
                    "min-w-[180px] shrink-0 rounded-2xl border p-3 text-left transition-all active:scale-[0.97]",
                    isSelected
                      ? "border-primary bg-primary/5 shadow-[0_4px_20px_rgba(108,92,231,0.2)]"
                      : "border-gray-200 bg-white hover:border-primary/40",
                  )}
                >
                  <p className="text-sm font-bold text-gray-900">
                    {alt.distanceKm.toFixed(0)} km · {Math.round(alt.durationMin)} min
                  </p>
                  {alt.summary && (
                    <p className="mt-0.5 truncate text-xs text-gray-500">via {alt.summary}</p>
                  )}
                  {isSelected && (
                    <span className="mt-2 inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-widest text-primary">
                      Selected
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
