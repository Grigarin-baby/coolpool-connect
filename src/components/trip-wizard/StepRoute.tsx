import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AutoComplete, Spin } from "antd";
import { ArrowDown, MapPin, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWizardMaps } from "./useWizardMaps";
import { RouteMap } from "./RouteMap";
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

interface PlacePrediction {
  description: string;
  place_id: string;
}

function usePlacesAutocomplete() {
  const serviceRef = useRef<any>(null);
  const placesServiceRef = useRef<any>(null);
  const [predictions, setPredictions] = useState<
    Record<"from" | "to", { value: string; label: string; place_id: string }[]>
  >({ from: [], to: [] });

  useEffect(() => {
    const google = (window as any).google;
    if (!google?.maps?.places) return;
    serviceRef.current = new google.maps.places.AutocompleteService();
    // PlacesService needs an HTMLElement or a Map; using a throwaway div keeps it self-contained.
    const div = document.createElement("div");
    placesServiceRef.current = new google.maps.places.PlacesService(div);
  }, []);

  const search = useCallback((query: string, side: "from" | "to") => {
    const svc = serviceRef.current;
    if (!query.trim() || !svc) {
      setPredictions((prev) => ({ ...prev, [side]: [] }));
      return;
    }
    svc.getPlacePredictions(
      { input: query, types: ["geocode"] },
      (results: PlacePrediction[] | null) => {
        setPredictions((prev) => ({
          ...prev,
          [side]: (results || []).slice(0, 6).map((r) => ({
            value: r.description,
            label: r.description,
            place_id: r.place_id,
          })),
        }));
      },
    );
  }, []);

  const resolveByPlaceId = useCallback((placeId: string): Promise<PlacePoint | null> => {
    return new Promise((resolve) => {
      const svc = placesServiceRef.current;
      if (!svc) return resolve(null);
      svc.getDetails(
        { placeId, fields: ["formatted_address", "geometry", "name"] },
        (place: any, status: string) => {
          if (status !== "OK" || !place?.geometry?.location) return resolve(null);
          resolve({
            label: place.formatted_address || place.name,
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng(),
          });
        },
      );
    });
  }, []);

  return { predictions, search, resolveByPlaceId };
}

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
  const { predictions, search, resolveByPlaceId } = usePlacesAutocomplete();
  const [fetchingRoutes, setFetchingRoutes] = useState(false);
  const [fromText, setFromText] = useState(from?.label ?? "");
  const [toText, setToText] = useState(to?.label ?? "");

  const directionsServiceRef = useRef<any>(null);
  useEffect(() => {
    if (!ready) return;
    const google = (window as any).google;
    if (!directionsServiceRef.current) {
      directionsServiceRef.current = new google.maps.DirectionsService();
    }
  }, [ready]);

  // Fetch alternatives whenever both endpoints are set
  useEffect(() => {
    if (!ready || !from || !to) return;
    const svc = directionsServiceRef.current;
    if (!svc) return;
    setFetchingRoutes(true);
    svc.route(
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

  const handleSelectPlace = async (side: "from" | "to", value: string) => {
    const list = predictions[side];
    const hit = list.find((p) => p.value === value);
    if (!hit) {
      // Manual text with no autocomplete pick — leave the endpoint alone.
      return;
    }
    const point = await resolveByPlaceId(hit.place_id);
    if (!point) return;
    if (side === "from") {
      onFromChange(point);
      setFromText(point.label);
    } else {
      onToChange(point);
      setToText(point.label);
    }
  };

  const sortedAlternatives = useMemo(
    () => [...alternatives].sort((a, b) => a.id - b.id),
    [alternatives],
  );

  return (
    <div className="flex flex-col gap-4 px-4 pb-6">
      {/* From / To inputs */}
      <div className="relative space-y-2 rounded-3xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
            <MapPin size={18} />
          </span>
          <AutoComplete
            value={fromText}
            options={predictions.from}
            onSearch={(v) => {
              setFromText(v);
              search(v, "from");
            }}
            onSelect={(v) => void handleSelectPlace("from", v)}
            onChange={(v) => setFromText(typeof v === "string" ? v : "")}
            placeholder="Pickup city or area"
            className="w-full"
            variant="borderless"
            popupClassName="trip-search-ac-dropdown"
          />
        </div>
        <div className="ml-[1.125rem] my-1 flex items-center text-gray-300">
          <ArrowDown size={16} />
        </div>
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-pink-500/10 text-pink-600">
            <MapPin size={18} />
          </span>
          <AutoComplete
            value={toText}
            options={predictions.to}
            onSearch={(v) => {
              setToText(v);
              search(v, "to");
            }}
            onSelect={(v) => void handleSelectPlace("to", v)}
            onChange={(v) => setToText(typeof v === "string" ? v : "")}
            placeholder="Drop-off city or area"
            className="w-full"
            variant="borderless"
            popupClassName="trip-search-ac-dropdown"
          />
        </div>
      </div>

      {/* Map */}
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

      {/* Alternatives cards */}
      {alternatives.length > 1 && (
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-gray-500">
            Choose a route
          </p>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {sortedAlternatives.map((alt) => {
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
                      <Search size={10} /> Selected
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
