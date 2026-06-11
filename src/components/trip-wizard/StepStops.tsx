import { useCallback, useMemo, useState } from "react";
import { AutoComplete } from "antd";
import { MapPin, Plus, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { closestPolylineIndex, decodePolyline, distanceAlongPolylineKm, stripCountrySuffix } from "@/lib/geo";
import { StopsMap } from "./StopsMap";
import { fetchPlaceSuggestions, resolvePlace } from "./placesAutocomplete";
import type { PlacePoint, RouteAlternative, WizardStop } from "./types";
import { STOP_TYPE_LABELS } from "./types";

interface StepStopsProps {
  from: PlacePoint;
  to: PlacePoint;
  alternative: RouteAlternative;
  stops: WizardStop[];
  onStopsChange: (stops: WizardStop[]) => void;
}

function reorderByDistance(stops: WizardStop[]): WizardStop[] {
  return [...stops].sort((a, b) => a.distanceFromOriginKm - b.distanceFromOriginKm);
}

export function StepStops({ from, to, alternative, stops, onStopsChange }: StepStopsProps) {
  const [addMode, setAddMode] = useState(false);
  const [query, setQuery] = useState("");
  const [predictions, setPredictions] = useState<
    { value: string; label: string; place_id: string }[]
  >([]);

  const decodedPath = useMemo(() => decodePolyline(alternative.polyline), [alternative.polyline]);

  const projectOntoRoute = useCallback(
    (lat: number, lng: number) => {
      const idx = closestPolylineIndex({ lat, lng }, decodedPath);
      const km = distanceAlongPolylineKm(decodedPath, idx);
      return km;
    },
    [decodedPath],
  );

  const addStop = useCallback(
    (label: string, lat: number, lng: number) => {
      const km = projectOntoRoute(lat, lng);
      const next = reorderByDistance([
        ...stops,
        { label, lat, lng, distanceFromOriginKm: km, stopType: "both" as const },
      ]);
      onStopsChange(next);
    },
    [onStopsChange, projectOntoRoute, stops],
  );

  const setStopType = (index: number, stopType: WizardStop["stopType"]) => {
    const next = stops.map((s, i) => (i === index ? { ...s, stopType } : s));
    onStopsChange(next);
  };

  const removeStop = (index: number) => {
    const next = stops.filter((_, i) => i !== index);
    onStopsChange(next);
  };

  const renameStop = (index: number, label: string) => {
    const next = stops.map((s, i) => (i === index ? { ...s, label } : s));
    onStopsChange(next);
  };

  const handleMapClick = useCallback(
    (lat: number, lng: number) => {
      addStop(`Stop ${stops.length + 1}`, lat, lng);
      setAddMode(false);
    },
    [addStop, stops.length],
  );

  const searchPlaces = async (q: string) => {
    setQuery(q);
    if (!q.trim()) {
      setPredictions([]);
      return;
    }
    const suggestions = await fetchPlaceSuggestions(q);
    setPredictions(
      suggestions.slice(0, 6).map((s) => ({
        value: stripCountrySuffix(s.description),
        label: stripCountrySuffix(s.description),
        place_id: s.id,
      })),
    );
  };

  const handleSelectPlace = async (value: string) => {
    const hit = predictions.find((p) => p.value === value);
    if (!hit) return;
    const resolved = await resolvePlace(hit.place_id);
    if (!resolved) return;
    addStop(value || resolved.label, resolved.lat, resolved.lng);
    setQuery("");
    setPredictions([]);
  };

  return (
    <div className="flex flex-col gap-4 px-4 pb-6">
      <div className="rounded-3xl border border-gray-100 bg-white p-3 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
            <MapPin size={18} />
          </span>
          <AutoComplete
            value={query}
            options={predictions}
            onSearch={(v) => void searchPlaces(v)}
            onSelect={(v) => void handleSelectPlace(v)}
            onChange={(v) => setQuery(typeof v === "string" ? v : "")}
            placeholder="Add a boarding point — city, area, landmark"
            className="w-full"
            variant="borderless"
            classNames={{ popup: { root: "trip-search-ac-dropdown" } }}
          />
        </div>
      </div>

      <div className="relative overflow-hidden rounded-3xl border border-gray-100 shadow-sm">
        <StopsMap
          from={from}
          to={to}
          polyline={alternative.polyline}
          stops={stops}
          addMode={addMode}
          onMapClick={handleMapClick}
          className="h-72 w-full"
        />
        <button
          type="button"
          onClick={() => setAddMode((m) => !m)}
          className={cn(
            "absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-bold shadow-md transition-colors",
            addMode
              ? "bg-rose-500 text-white"
              : "bg-white text-gray-700 hover:bg-gray-50",
          )}
        >
          {addMode ? (
            <>
              <X size={14} /> Cancel
            </>
          ) : (
            <>
              <Plus size={14} /> Tap map to add
            </>
          )}
        </button>
      </div>

      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-widest text-gray-500">
          Stops along the route
        </p>
        {stops.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
            No boarding points yet. Direct trip is fine — or search above / tap the map to add stops.
          </div>
        ) : (
          <ul className="space-y-2">
            {stops.map((s, i) => (
              <li
                key={`${s.lat}-${s.lng}-${i}`}
                className="rounded-2xl border border-gray-100 bg-white p-3 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary text-sm font-bold text-white">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <input
                      value={s.label}
                      onChange={(e) => renameStop(i, e.target.value)}
                      className="w-full truncate bg-transparent text-sm font-semibold text-gray-900 outline-none focus:underline"
                    />
                    <p className="text-xs text-gray-500">
                      {s.distanceFromOriginKm.toFixed(1)} km from start
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeStop(i)}
                    aria-label={`Remove stop ${i + 1}`}
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-rose-500 hover:bg-rose-50"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                {/* Stop type selector */}
                <div className="mt-2 ml-11 flex gap-1 flex-wrap">
                  {(["pickup", "both", "drop"] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setStopType(i, type)}
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-[10px] font-semibold border transition-colors",
                        (s.stopType ?? "both") === type
                          ? "bg-primary text-white border-primary"
                          : "bg-white text-gray-500 border-gray-200 hover:border-primary/40",
                      )}
                    >
                      {STOP_TYPE_LABELS[type]}
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
