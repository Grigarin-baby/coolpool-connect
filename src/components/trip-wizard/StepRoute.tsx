import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AutoComplete, Spin } from "antd";
import { ArrowDown, MapPin, Loader2, Plus, X as XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWizardMaps } from "./useWizardMaps";
import { RouteMap } from "./RouteMap";
import { BENGALURU_AIRPORTS, SERVICE_CITY } from "@/lib/config";
import { fetchPlaceSuggestions, resolvePlace } from "./placesAutocomplete";
import { stripCountrySuffix } from "@/lib/geo";
import type { IntermediatePoint, PlacePoint, RouteAlternative } from "./types";

interface StepRouteProps {
  from: PlacePoint | null;
  to: PlacePoint | null;
  alternatives: RouteAlternative[];
  selectedAltId: number | null;
  intermediatePoints: IntermediatePoint[];
  onFromChange: (p: PlacePoint | null) => void;
  onToChange: (p: PlacePoint | null) => void;
  onAlternativesChange: (alts: RouteAlternative[], selectedAltId: number | null) => void;
  onIntermediatePointsChange: (points: IntermediatePoint[]) => void;
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
  intermediatePoints,
  onFromChange,
  onToChange,
  onAlternativesChange,
  onIntermediatePointsChange,
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
  // Hold latest onAlternativesChange in a ref so useEffect doesn't re-run on every render
  const onAlternativesChangeRef = useRef(onAlternativesChange);
  useEffect(() => { onAlternativesChangeRef.current = onAlternativesChange; });

  // Intermediate stop inputs state
  const [stopTexts, setStopTexts] = useState<string[]>(() => intermediatePoints.map((p) => p.label));
  const [stopOptions, setStopOptions] = useState<CityOption[][]>(() => intermediatePoints.map(() => []));
  const [stopSearching, setStopSearching] = useState<boolean[]>(() => intermediatePoints.map(() => false));

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
        value: stripCountrySuffix(s.description),
        label: stripCountrySuffix(s.description),
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

  // ── Intermediate stop helpers ────────────────────────────────────────────

  const addStop = useCallback(() => {
    setStopTexts((prev) => [...prev, ""]);
    setStopOptions((prev) => [...prev, []]);
    setStopSearching((prev) => [...prev, false]);
    onIntermediatePointsChange([...intermediatePoints, { label: "", lat: 0, lng: 0, stopType: "both" }]);
  }, [intermediatePoints, onIntermediatePointsChange]);

  const removeStop = useCallback((idx: number) => {
    setStopTexts((prev) => prev.filter((_, i) => i !== idx));
    setStopOptions((prev) => prev.filter((_, i) => i !== idx));
    setStopSearching((prev) => prev.filter((_, i) => i !== idx));
    onIntermediatePointsChange(intermediatePoints.filter((_, i) => i !== idx));
  }, [intermediatePoints, onIntermediatePointsChange]);

  const searchStop = useCallback((query: string, idx: number) => {
    setStopTexts((prev) => { const n = [...prev]; n[idx] = query; return n; });
    if (!query || query.trim().length < 2) {
      setStopOptions((prev) => { const n = [...prev]; n[idx] = []; return n; });
      return;
    }
    setStopSearching((prev) => { const n = [...prev]; n[idx] = true; return n; });
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const suggestions = await fetchPlaceSuggestions(query);
      const lower = query.toLowerCase();
      const isAirport = AIRPORT_KEYWORDS.some((k) => lower.includes(k));
      const filtered = suggestions.filter((s) =>
        SOUTH_INDIA_STATES.some((st) => s.description.toLowerCase().includes(st)) || isAirport,
      );
      const opts: CityOption[] = filtered.map((s) => ({
        value: stripCountrySuffix(s.description),
        label: stripCountrySuffix(s.description),
        placeId: s.id,
      }));
      setStopOptions((prev) => { const n = [...prev]; n[idx] = opts; return n; });
      setStopSearching((prev) => { const n = [...prev]; n[idx] = false; return n; });
    }, 300);
  }, []);

  const selectStop = useCallback(async (value: string, idx: number) => {
    const opts = stopOptions[idx] ?? [];
    const hit = opts.find((o) => o.value === value);
    if (!hit) return;
    const point = await resolveCoords(hit);
    if (!point) return;
    setStopTexts((prev) => { const n = [...prev]; n[idx] = point.label; return n; });
    const updated = [...intermediatePoints];
    updated[idx] = { ...point, stopType: intermediatePoints[idx]?.stopType ?? "both" };
    onIntermediatePointsChange(updated);
  }, [stopOptions, intermediatePoints, onIntermediatePointsChange, resolveCoords]);

  // ─────────────────────────────────────────────────────────────────────────

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

  // Stable key that changes only when resolved waypoint coords change
  const waypointKey = useMemo(
    () => intermediatePoints
      .filter((p) => p.lat !== 0 && p.lng !== 0)
      .map((p) => `${p.lat},${p.lng}`)
      .join("|"),
    [intermediatePoints],
  );

  // Whenever endpoints or intermediate points change, fetch route alternatives.
  // Uses onAlternativesChangeRef so this effect never re-runs due to callback identity changes.
  useEffect(() => {
    if (!ready || !from || !to || !directionsRef.current) return;
    setFetchingRoutes(true);
    const waypoints = intermediatePoints
      .filter((p) => p.lat !== 0 && p.lng !== 0)
      .map((p) => ({ location: { lat: p.lat, lng: p.lng }, stopover: true }));
    directionsRef.current.route(
      {
        origin: { lat: from.lat, lng: from.lng },
        destination: { lat: to.lat, lng: to.lng },
        waypoints,
        travelMode: (window as any).google.maps.TravelMode.DRIVING,
        // Google doesn't return alternatives when waypoints are present
        provideRouteAlternatives: waypoints.length === 0,
      },
      (result: any, status: string) => {
        setFetchingRoutes(false);
        if (status !== "OK" || !result?.routes?.length) {
          onAlternativesChangeRef.current([], null);
          return;
        }
        const alts: RouteAlternative[] = result.routes.map((r: any, idx: number) => {
          const totalDistM = r.legs.reduce((s: number, l: any) => s + (l.distance?.value ?? 0), 0);
          const totalDurS = r.legs.reduce((s: number, l: any) => s + (l.duration?.value ?? 0), 0);
          return {
            id: idx,
            polyline: r.overview_polyline,
            distanceKm: totalDistM / 1000,
            durationMin: Math.round(totalDurS / 60),
            summary: r.summary || "",
          };
        });
        onAlternativesChangeRef.current(alts, alts[0]?.id ?? null);
      },
    );
  // waypointKey is the stable dep for intermediate points; ref handles the callback
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, from, to, waypointKey]);

  const sortedAlts = useMemo(
    () => [...alternatives].sort((a, b) => a.id - b.id),
    [alternatives],
  );

  return (
    <div className="flex flex-col gap-4 px-4 pb-6">
      <div className="relative space-y-2 rounded-3xl border border-gray-100 bg-white p-4 shadow-sm">
        {/* Pickup */}
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
            <MapPin size={18} />
          </span>
          <div className="relative flex-1 min-w-0">
            <AutoComplete
              value={fromText}
              options={fromOptions}
              onSearch={(v) => { setFromText(v); searchCities(v, "from"); }}
              onSelect={(v) => { if (v === "__out_of_area__") return; void handleSelect("from", v); }}
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

        {/* Intermediate stops */}
        {stopTexts.map((txt, idx) => {
          return (
            <div key={idx}>
              <div className="ml-[1.125rem] my-1 flex items-center text-gray-300">
                <ArrowDown size={14} />
              </div>
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-amber-50 text-amber-500 border border-amber-200 text-xs font-bold">
                  {idx + 1}
                </span>
                <div className="relative flex-1 min-w-0">
                  <AutoComplete
                    value={txt}
                    options={stopOptions[idx] ?? []}
                    onSearch={(v) => searchStop(v, idx)}
                    onSelect={(v) => void selectStop(v, idx)}
                    onChange={(v) => setStopTexts((prev) => { const n = [...prev]; n[idx] = typeof v === "string" ? v : ""; return n; })}
                    placeholder={`Stop ${idx + 1} city or area`}
                    className="w-full"
                    variant="borderless"
                    classNames={{ popup: { root: "trip-search-ac-dropdown" } }}
                  />
                  {stopSearching[idx] && (
                    <span className="pointer-events-none absolute right-8 top-1/2 -translate-y-1/2 text-gray-400">
                      <Loader2 size={13} className="animate-spin" />
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => removeStop(idx)}
                  className="shrink-0 grid h-7 w-7 place-items-center rounded-full text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                >
                  <XIcon size={14} />
                </button>
              </div>
            </div>
          );
        })}


        {/* Arrow connector */}
        <div className="ml-[1.125rem] my-1 text-gray-300">
          <ArrowDown size={16} />
        </div>

        {/* Add stop button — full width, visible */}
        <button
          type="button"
          onClick={addStop}
          className="w-full flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 py-3 text-sm font-bold text-primary hover:border-primary/60 hover:bg-primary/10 active:scale-[0.98] transition-all duration-150"
        >
          <span className="grid h-6 w-6 place-items-center rounded-full bg-primary text-white">
            <Plus size={14} />
          </span>
          Add intermediate stop
        </button>

        {/* Arrow connector to drop-off */}
        <div className="ml-[1.125rem] my-1 text-gray-300">
          <ArrowDown size={16} />
        </div>

        {/* Drop-off */}
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-pink-500/10 text-pink-600">
            <MapPin size={18} />
          </span>
          <div className="relative flex-1 min-w-0">
            <AutoComplete
              value={toText}
              options={toOptions}
              onSearch={(v) => { setToText(v); searchCities(v, "to"); }}
              onSelect={(v) => { if (v === "__out_of_area__") return; void handleSelect("to", v); }}
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
              intermediatePoints={intermediatePoints.filter((p) => p.lat !== 0 && p.lng !== 0)}
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
          {/* Vertical stack — no overflow-x so all cards are fully clickable */}
          <div className="flex flex-col gap-2">
            {sortedAlts.map((alt) => {
              const isSelected = alt.id === selectedAltId;
              return (
                <button
                  type="button"
                  key={alt.id}
                  onClick={() => onAlternativesChangeRef.current(alternatives, alt.id)}
                  className={cn(
                    "w-full rounded-2xl border p-3 text-left transition-all active:scale-[0.99]",
                    isSelected
                      ? "border-primary bg-primary/5 shadow-[0_4px_20px_rgba(108,92,231,0.15)]"
                      : "border-gray-200 bg-white hover:border-primary/40",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-gray-900">
                      {alt.distanceKm.toFixed(0)} km · {Math.round(alt.durationMin)} min
                    </p>
                    {isSelected && (
                      <span className="text-[10px] font-extrabold uppercase tracking-widest text-primary">
                        ✓ Selected
                      </span>
                    )}
                  </div>
                  {alt.summary && (
                    <p className="mt-0.5 text-xs text-gray-500">via {alt.summary}</p>
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
