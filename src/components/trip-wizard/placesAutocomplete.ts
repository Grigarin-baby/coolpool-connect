/**
 * Thin wrapper around Google's NEW Places autocomplete APIs.
 *
 * Google disabled the legacy `AutocompleteService` and `PlacesService.getDetails`
 * for new-customer accounts in 2025. They keep working under the same names for
 * a while but return nothing on new accounts. The replacements are:
 *   - `google.maps.places.AutocompleteSuggestion.fetchAutocompleteSuggestions`
 *   - `suggestion.placePrediction.toPlace()` + `place.fetchFields(...)`
 *
 * https://developers.google.com/maps/documentation/javascript/places-migration-overview
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

/** Returns up to ~6 predictions matching the query, scoped to India. */
export async function fetchPlaceSuggestions(input: string): Promise<PlaceSuggestion[]> {
  const trimmed = input.trim();
  if (trimmed.length < 2) return [];
  const placesNs = (window as any).google?.maps?.places;
  if (!placesNs?.AutocompleteSuggestion?.fetchAutocompleteSuggestions) return [];
  try {
    const { suggestions } = (await placesNs.AutocompleteSuggestion.fetchAutocompleteSuggestions({
      input: trimmed,
      includedRegionCodes: ["in"],
    })) as { suggestions: RawSuggestion[] };
    return (suggestions || []).slice(0, 8).map((s) => {
      const t = s.placePrediction.text;
      const description = typeof t === "string" ? t : t.text;
      return { id: s.placePrediction.placeId, description };
    });
  } catch (e) {
    if (import.meta.env.DEV) console.warn("[places] fetchPlaceSuggestions failed", e);
    return [];
  }
}

/** Resolve a place id to its display name + lat/lng. */
export async function resolvePlace(placeId: string): Promise<ResolvedPlace | null> {
  const placesNs = (window as any).google?.maps?.places;
  if (!placesNs?.Place) return null;
  try {
    const place = new placesNs.Place({ id: placeId, requestedLanguage: "en" }) as RawPlace;
    await place.fetchFields({ fields: ["displayName", "formattedAddress", "location"] });
    if (!place.location) return null;
    return {
      label: place.formattedAddress || place.displayName || "",
      lat: place.location.lat(),
      lng: place.location.lng(),
    };
  } catch (e) {
    if (import.meta.env.DEV) console.warn("[places] resolvePlace failed", e);
    return null;
  }
}
