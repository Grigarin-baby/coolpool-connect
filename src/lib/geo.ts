/**
 * Geo utilities — Haversine distance + polyline decoding + route matching.
 * Pure functions, no map SDK required.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

const R_KM = 6371;

export function haversineKm(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R_KM * Math.asin(Math.sqrt(h));
}

/** Google encoded polyline → array of LatLng */
export function decodePolyline(encoded: string): LatLng[] {
  const points: LatLng[] = [];
  let index = 0;
  const len = encoded.length;
  let lat = 0;
  let lng = 0;

  while (index < len) {
    let b: number;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return points;
}

/** Closest distance from a point to a sampled polyline (km). */
export function distanceToPolylineKm(point: LatLng, polyline: LatLng[]): number {
  if (polyline.length === 0) return Infinity;
  let min = Infinity;
  for (const p of polyline) {
    const d = haversineKm(point, p);
    if (d < min) min = d;
  }
  return min;
}

/** Index of polyline vertex closest to a point — proxy for trip ordering. */
export function closestPolylineIndex(point: LatLng, polyline: LatLng[]): number {
  let minIdx = 0;
  let min = Infinity;
  for (let i = 0; i < polyline.length; i++) {
    const d = haversineKm(point, polyline[i]);
    if (d < min) {
      min = d;
      minIdx = i;
    }
  }
  return minIdx;
}

/** Cumulative distance along polyline up to a vertex index (km). */
export function distanceAlongPolylineKm(polyline: LatLng[], uptoIdx: number): number {
  let total = 0;
  for (let i = 1; i <= uptoIdx && i < polyline.length; i++) {
    total += haversineKm(polyline[i - 1], polyline[i]);
  }
  return total;
}

/** Strip a trailing ", India" country suffix from a place description. */
export function stripCountrySuffix(description: string): string {
  return description.replace(/,\s*India\s*$/i, "");
}

/** Alternate names for the same place (keys and values lowercase). Extend as needed for route search. */
const CITY_NAME_ALIASES: Record<string, readonly string[]> = {
  calicut: ["kozhikode"],
  kozhikode: ["calicut"],
  kochi: ["ernakulam"],
  ernakulam: ["kochi"],
  bangalore: ["bengaluru"],
  bengaluru: ["bangalore"],
};

function expandCityAliases(segment: string): string[] {
  const s = segment.toLowerCase().trim();
  const extra = CITY_NAME_ALIASES[s] ?? [];
  return [s, ...extra];
}

/** Compare primary city labels from addresses (handles Kozhikode vs Calicut, substring overlap). */
export function routeCitySegmentsMatch(tripSegment: string, searchSegment: string): boolean {
  const variantsA = expandCityAliases(tripSegment);
  const variantsB = expandCityAliases(searchSegment);
  for (const a of variantsA) {
    for (const b of variantsB) {
      if (!a || !b) continue;
      if (a === b || a.includes(b) || b.includes(a)) return true;
    }
  }
  return false;
}
