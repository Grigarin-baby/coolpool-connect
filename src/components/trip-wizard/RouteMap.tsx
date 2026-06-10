import { useEffect, useRef } from "react";
import type { PlacePoint, RouteAlternative } from "./types";

interface RouteMapProps {
  from: PlacePoint | null;
  to: PlacePoint | null;
  alternatives: RouteAlternative[];
  selectedAltId: number | null;
  onSelectAlternative: (id: number) => void;
  intermediatePoints?: PlacePoint[];
  className?: string;
}

const COLOR_SELECTED = "oklch(0.55 0.25 290)";
const COLOR_DIMMED = "rgba(80, 80, 100, 0.45)";

export function RouteMap({
  from,
  to,
  alternatives,
  selectedAltId,
  onSelectAlternative,
  intermediatePoints = [],
  className,
}: RouteMapProps) {
  const mapDivRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const polylinesRef = useRef<any[]>([]);
  const markersRef = useRef<any[]>([]);

  // Initialize the map once (assumes google.maps is already loaded by parent)
  useEffect(() => {
    const google = (window as any).google;
    if (!google?.maps || !mapDivRef.current || mapRef.current) return;
    mapRef.current = new google.maps.Map(mapDivRef.current, {
      zoom: 7,
      center: { lat: 13.0, lng: 78.0 },
      disableDefaultUI: true,
      gestureHandling: "greedy",
      styles: [{ featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] }],
    });
  }, []);

  // Draw / redraw alternatives + markers
  useEffect(() => {
    const google = (window as any).google;
    const map = mapRef.current;
    if (!google?.maps || !map) return;

    polylinesRef.current.forEach((p) => p.setMap(null));
    polylinesRef.current = [];
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    const bounds = new google.maps.LatLngBounds();

    if (from) {
      const m = new google.maps.Marker({
        position: { lat: from.lat, lng: from.lng },
        map,
        label: { text: "A", color: "white", fontWeight: "700" },
      });
      markersRef.current.push(m);
      bounds.extend({ lat: from.lat, lng: from.lng });
    }

    // Intermediate stop markers — amber circle with number
    intermediatePoints.forEach((pt, i) => {
      if (!pt.lat || !pt.lng) return;
      const m = new google.maps.Marker({
        position: { lat: pt.lat, lng: pt.lng },
        map,
        label: { text: String(i + 1), color: "white", fontWeight: "700", fontSize: "12px" },
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 14,
          fillColor: "#f59e0b",
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 2,
        },
        title: pt.label,
        zIndex: 5,
      });
      markersRef.current.push(m);
      bounds.extend({ lat: pt.lat, lng: pt.lng });
    });

    if (to) {
      const m = new google.maps.Marker({
        position: { lat: to.lat, lng: to.lng },
        map,
        label: { text: "B", color: "white", fontWeight: "700" },
      });
      markersRef.current.push(m);
      bounds.extend({ lat: to.lat, lng: to.lng });
    }

    alternatives.forEach((alt) => {
      const path = google.maps.geometry.encoding.decodePath(alt.polyline);
      const isSelected = alt.id === selectedAltId;
      const polyline = new google.maps.Polyline({
        path,
        geodesic: true,
        strokeColor: isSelected ? COLOR_SELECTED : COLOR_DIMMED,
        strokeOpacity: isSelected ? 0.95 : 0.55,
        strokeWeight: isSelected ? 6 : 4,
        zIndex: isSelected ? 10 : 1,
        clickable: true,
      });
      polyline.setMap(map);
      polyline.addListener("click", () => onSelectAlternative(alt.id));
      polylinesRef.current.push(polyline);
      path.forEach((p: any) => bounds.extend(p));
    });

    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, 48);
    }
  }, [from, to, intermediatePoints, alternatives, selectedAltId, onSelectAlternative]);

  return <div ref={mapDivRef} className={className ?? "h-64 w-full rounded-2xl"} />;
}
