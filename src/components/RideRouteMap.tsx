import React, { useEffect, useRef, useState } from "react";
import { appwriteConfig } from "@/integrations/appwrite/client";
import { message } from "antd";

interface RideRouteMapProps {
  fromLat: number;
  fromLng: number;
  toLat: number;
  toLng: number;
  polyline: string;
  isAirportDrop?: boolean;
  liveLocation?: { lat: number; lng: number } | null;
}

export function RideRouteMap({
  fromLat,
  fromLng,
  toLat,
  toLng,
  polyline,
  isAirportDrop,
  liveLocation,
}: RideRouteMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<any>(null);
  const carMarkerRef = useRef<any>(null);
  const [mapsReady, setMapsReady] = useState(false);

  useEffect(() => {
    // If google maps is already loaded
    if ((window as any).google && (window as any).google.maps) {
      setMapsReady(true);
      return;
    }

    const scriptId = "google-maps-script";
    const existingScript =
      (document.getElementById(scriptId) as HTMLScriptElement) ||
      (document.querySelector('script[data-google-maps]') as HTMLScriptElement);

    if (existingScript) {
      if (existingScript.dataset.loaded === "true") {
        setMapsReady(true);
      } else {
        existingScript.addEventListener("load", () => setMapsReady(true));
      }
      return;
    }

    const script = document.createElement("script");
    script.id = scriptId;
    script.dataset.googleMaps = "places";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${appwriteConfig.googleMapsApiKey}&libraries=places,geometry`;
    script.async = true;
    script.defer = true;
    script.addEventListener("load", () => {
      script.dataset.loaded = "true";
      setMapsReady(true);
    });
    script.addEventListener("error", () => {
      message.error("Failed to load Google Maps");
    });
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    if (!mapsReady || !mapRef.current) return;

    const google = (window as any).google;

    // Initialize Map
    if (!googleMapRef.current) {
      googleMapRef.current = new google.maps.Map(mapRef.current, {
        zoom: 12,
        center: { lat: fromLat, lng: fromLng },
        disableDefaultUI: true,
        styles: [
          {
            featureType: "poi",
            elementType: "labels",
            stylers: [{ visibility: "off" }],
          },
        ],
      });
    }

    const map = googleMapRef.current;

    let routePolyline: any = null;
    let directionsRenderer: any = null;

    let path: any[] = [];
    if (polyline) {
      try {
        path = google.maps.geometry.encoding.decodePath(polyline);
      } catch (e) {
        console.error("Failed to decode polyline", e);
      }
    }

    if (path.length > 2) {
      // Draw accurate route from saved polyline
      routePolyline = new google.maps.Polyline({
        path: path,
        geodesic: true,
        strokeColor: "#6C5CE7",
        strokeOpacity: 0.8,
        strokeWeight: 5,
      });
      routePolyline.setMap(map);

      const bounds = new google.maps.LatLngBounds();
      path.forEach((latLng: any) => bounds.extend(latLng));
      map.fitBounds(bounds, 40); // 40px padding for better view
    } else {
      // Fallback: Use Directions API if polyline is just a straight line or missing
      const directionsService = new google.maps.DirectionsService();
      directionsRenderer = new google.maps.DirectionsRenderer({
        map: map,
        suppressMarkers: true,
        polylineOptions: {
          strokeColor: "#6C5CE7",
          strokeOpacity: 0.8,
          strokeWeight: 5,
        },
      });

      directionsService.route(
        {
          origin: { lat: fromLat, lng: fromLng },
          destination: { lat: toLat, lng: toLng },
          travelMode: google.maps.TravelMode.DRIVING,
        },
        (result: any, status: any) => {
          if (status === google.maps.DirectionsStatus.OK) {
            directionsRenderer.setDirections(result);
          } else {
            // Ultimate fallback to straight line
            routePolyline = new google.maps.Polyline({
              path: [
                { lat: fromLat, lng: fromLng },
                { lat: toLat, lng: toLng },
              ],
              geodesic: true,
              strokeColor: "#6C5CE7",
              strokeOpacity: 0.8,
              strokeWeight: 5,
            });
            routePolyline.setMap(map);
            const bounds = new google.maps.LatLngBounds();
            bounds.extend({ lat: fromLat, lng: fromLng });
            bounds.extend({ lat: toLat, lng: toLng });
            map.fitBounds(bounds, 40);
          }
        },
      );
    }

    // Custom Icons
    const dotIcon = {
      path: google.maps.SymbolPath.CIRCLE,
      scale: 6,
      fillColor: "#6C5CE7",
      fillOpacity: 1,
      strokeWeight: 2,
      strokeColor: "#FFFFFF",
    };

    const airportIcon = "https://maps.google.com/mapfiles/ms/icons/blue-dot.png";

    // Pickup Marker
    const pickupMarker = new google.maps.Marker({
      position: { lat: fromLat, lng: fromLng },
      map: map,
      icon: dotIcon,
      title: "Pickup",
    });

    // Drop Marker
    const dropMarker = new google.maps.Marker({
      position: { lat: toLat, lng: toLng },
      map: map,
      icon: isAirportDrop ? airportIcon : dotIcon,
      title: "Drop-off",
    });

    return () => {
      if (routePolyline) routePolyline.setMap(null);
      if (directionsRenderer) directionsRenderer.setMap(null);
      if (pickupMarker) pickupMarker.setMap(null);
      if (dropMarker) dropMarker.setMap(null);
    };
  }, [mapsReady, fromLat, fromLng, toLat, toLng, polyline, isAirportDrop]);

  // Live car marker — kept in a separate effect so it updates without
  // re-drawing the route/markers on every location ping.
  useEffect(() => {
    if (!mapsReady || !googleMapRef.current) return;
    const google = (window as any).google;
    const map = googleMapRef.current;

    if (!liveLocation) {
      if (carMarkerRef.current) {
        carMarkerRef.current.setMap(null);
        carMarkerRef.current = null;
      }
      return;
    }

    const position = { lat: liveLocation.lat, lng: liveLocation.lng };

    if (!carMarkerRef.current) {
      carMarkerRef.current = new google.maps.Marker({
        position,
        map,
        icon: {
          path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
          scale: 6,
          fillColor: "#16A34A",
          fillOpacity: 1,
          strokeWeight: 2,
          strokeColor: "#FFFFFF",
        },
        title: "Your ride",
        zIndex: 999,
      });
    } else {
      carMarkerRef.current.setPosition(position);
    }
  }, [mapsReady, liveLocation]);

  useEffect(() => {
    return () => {
      if (carMarkerRef.current) carMarkerRef.current.setMap(null);
    };
  }, []);

  return (
    <div className="w-full h-48 rounded-2xl overflow-hidden border border-gray-100 shadow-sm relative">
      <div ref={mapRef} className="w-full h-full" />
    </div>
  );
}
