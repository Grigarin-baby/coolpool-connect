import { useEffect, useRef } from "react";
import type { PlacePoint, WizardStop } from "./types";

interface StopsMapProps {
  from: PlacePoint;
  to: PlacePoint;
  polyline: string;
  stops: WizardStop[];
  /** When true, the next click on the map drops a pin and the cursor changes. */
  addMode: boolean;
  onMapClick: (lat: number, lng: number) => void;
  className?: string;
}

const COLOR_ROUTE = "oklch(0.55 0.25 290)";

export function StopsMap({
  from,
  to,
  polyline,
  stops,
  addMode,
  onMapClick,
  className,
}: StopsMapProps) {
  const mapDivRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const polylineRef = useRef<any>(null);
  const endpointMarkersRef = useRef<any[]>([]);
  const stopMarkersRef = useRef<any[]>([]);
  const clickListenerRef = useRef<any>(null);

  // Init map + draw route once we have one.
  useEffect(() => {
    const google = (window as any).google;
    if (!google?.maps || !mapDivRef.current) return;
    if (!mapRef.current) {
      mapRef.current = new google.maps.Map(mapDivRef.current, {
        zoom: 7,
        center: { lat: from.lat, lng: from.lng },
        disableDefaultUI: true,
        gestureHandling: "greedy",
        styles: [{ featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] }],
      });
    }
    const map = mapRef.current;

    polylineRef.current?.setMap(null);
    endpointMarkersRef.current.forEach((m) => m.setMap(null));
    endpointMarkersRef.current = [];

    if (polyline) {
      const path = google.maps.geometry.encoding.decodePath(polyline);
      polylineRef.current = new google.maps.Polyline({
        path,
        geodesic: true,
        strokeColor: COLOR_ROUTE,
        strokeOpacity: 0.85,
        strokeWeight: 6,
      });
      polylineRef.current.setMap(map);

      const bounds = new google.maps.LatLngBounds();
      path.forEach((p: any) => bounds.extend(p));
      map.fitBounds(bounds, 48);
    }

    endpointMarkersRef.current.push(
      new google.maps.Marker({
        position: { lat: from.lat, lng: from.lng },
        map,
        label: { text: "A", color: "white", fontWeight: "700" },
      }),
      new google.maps.Marker({
        position: { lat: to.lat, lng: to.lng },
        map,
        label: { text: "B", color: "white", fontWeight: "700" },
      }),
    );
  }, [from, to, polyline]);

  // Re-bind click listener whenever addMode changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    clickListenerRef.current?.remove();
    if (!addMode) {
      map.setOptions({ draggableCursor: undefined });
      return;
    }
    map.setOptions({ draggableCursor: "crosshair" });
    clickListenerRef.current = map.addListener("click", (event: any) => {
      const lat = event.latLng.lat();
      const lng = event.latLng.lng();
      onMapClick(lat, lng);
    });
    return () => clickListenerRef.current?.remove();
  }, [addMode, onMapClick]);

  // Redraw stop markers
  useEffect(() => {
    const google = (window as any).google;
    const map = mapRef.current;
    if (!google?.maps || !map) return;
    stopMarkersRef.current.forEach((m) => m.setMap(null));
    stopMarkersRef.current = stops.map(
      (s, idx) =>
        new google.maps.Marker({
          position: { lat: s.lat, lng: s.lng },
          map,
          label: { text: String(idx + 1), color: "white", fontWeight: "700" },
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 12,
            fillColor: COLOR_ROUTE,
            fillOpacity: 1,
            strokeColor: "#fff",
            strokeWeight: 2,
          },
        }),
    );
  }, [stops]);

  return <div ref={mapDivRef} className={className ?? "h-72 w-full"} />;
}
