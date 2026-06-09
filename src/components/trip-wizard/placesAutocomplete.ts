/**
 * Two-tier Google Places autocomplete.
 *
 * Tier 1 — new API (2024+):
 *   google.maps.places.AutocompleteSuggestion.fetchAutocompleteSuggestions
 * Tier 2 fallback — legacy API (always works, same as home-page TripSearch):
 *   google.maps.places.AutocompleteService.getPlacePredictions
 *
 * Both return the same PlaceSuggestion shape so callers don't care which tier ran.
 * resolvePlace() also tries the new Place class first, falls back to PlacesService.
 */

export interface PlaceSuggestion {
  /** Stable id we can re-key against later. */
  id: string;
  /** Display string shown in the dropdown ("Kochi, Kerala, India"). */
  description: string;
}

export interface ResolvedPlace {
  label: string;
  lat: number;
  lng: number;
}

// ─── internal types ──────────────────────────────────────────────────────────

interface RawSuggestion {
  placePrediction: {
    placeId: string;
    text: { text: string } | string;
    toPlace: () => RawPlace;
  };
}

interface RawPlace {
  fetchFields: (req: { fields: string[] }) => Promise<unknown>;
  displayName?: string;
  formattedAddress?: string;
  location?: { lat: () => number; lng: () => number };
}

// Singleton legacy service — created once, reused across calls.
let _legacyService: any = null;

function getLegacyService(): any {
  const placesNs = (window as any).google?.maps?.places;
  if (!placesNs?.AutocompleteService) return null;
  if (!_legacyService) _legacyService = new placesNs.AutocompleteService();
  return _legacyService;
}

// ─── public API ──────────────────────────────────────────────────────────────

/** Returns up to 8 place predictions, scoped to India. Uses new API with
 *  automatic fallback to legacy AutocompleteService. */
export async function fetchPlaceSuggestions(input: string): Promise<PlaceSuggestion[]> {
  const trimmed = input.trim();
  if (trimmed.length < 2) return [];

  // ── Tier 1: new AutocompleteSuggestion API ───────────────────────────────
  const placesNs = (window as any).google?.maps?.places;
  if (placesNs?.AutocompleteSuggestion?.fetchAutocompleteSuggestions) {
    try {
      const { suggestions } = (await placesNs.AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input: trimmed,
        includedRegionCodes: ["in"],
      })) as { suggestions: RawSuggestion[] };

      if (suggestions?.length) {
        return suggestions.slice(0, 8).map((s) => {
          const t = s.placePrediction.text;
          const description = typeof t === "string" ? t : t.text;
          return { id: s.placePrediction.placeId, description };
        });
      }
      // Fall through to tier 2 if new API returned nothing
    } catch (e) {
      if (import.meta.env.DEV) console.warn("[places] new API failed, trying legacy", e);
    }
  }

  // ── Tier 2: legacy AutocompleteService (same as home-page TripSearch) ────
  const legacySvc = getLegacyService();
  if (!legacySvc) return [];

  return new Promise<PlaceSuggestion[]>((resolve) => {
    legacySvc.getPlacePredictions(
      {
        input: trimmed,
        types: ["geocode"],
        componentRestrictions: { country: "in" },
      },
      (predictions: any[] | null, status: string) => {
        if (status !== "OK" || !predictions?.length) {
          resolve([]);
          return;
        }
        resolve(
          predictions.slice(0, 8).map((p) => ({
            id: p.place_id,
            description: p.description,
          })),
        );
      },
    );
  });
}

/** Resolve a place id → label + lat/lng. Tries new Place class first, then
 *  falls back to legacy PlacesService.getDetails. */
export async function resolvePlace(placeId: string): Promise<ResolvedPlace | null> {
  const placesNs = (window as any).google?.maps?.places;

  // ── Tier 1: new Place class ───────────────────────────────────────────────
  if (placesNs?.Place) {
    try {
      const place = new placesNs.Place({ id: placeId, requestedLanguage: "en" }) as RawPlace;
      await place.fetchFields({ fields: ["displayName", "formattedAddress", "location"] });
      if (place.location) {
        return {
          label: place.formattedAddress || place.displayName || "",
          lat: place.location.lat(),
          lng: place.location.lng(),
        };
      }
    } catch (e) {
      if (import.meta.env.DEV) console.warn("[places] new Place resolve failed, trying legacy", e);
    }
  }

  // ── Tier 2: legacy PlacesService.getDetails ───────────────────────────────
  const maps = (window as any).google?.maps;
  if (!maps?.places?.PlacesService) return null;

  // PlacesService needs a DOM node to attach to
  let container = document.getElementById("__places_svc_container__");
  if (!container) {
    container = document.createElement("div");
    container.id = "__places_svc_container__";
    container.style.display = "none";
    document.body.appendChild(container);
  }

  return new Promise<ResolvedPlace | null>((resolve) => {
    const svc = new maps.places.PlacesService(container);
    svc.getDetails(
      { placeId, fields: ["name", "formatted_address", "geometry"] },
      (place: any, status: string) => {
        if (status !== "OK" || !place?.geometry?.location) {
          resolve(null);
          return;
        }
        resolve({
          label: place.formatted_address || place.name || "",
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
        });
      },
    );
  });
}
