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
}

export function RideRouteMap({ fromLat, fromLng, toLat, toLng, polyline, isAirportDrop }: RideRouteMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<any>(null);
  const [mapsReady, setMapsReady] = useState(false);

  useEffect(() => {
    // If google maps is already loaded
    if ((window as any).google && (window as any).google.maps) {
      setMapsReady(true);
      return;
    }

    const scriptId = "google-maps-script";
    const existingScript = document.getElementById(scriptId) as HTMLScriptElement;

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
    script.src = `https://maps.googleapis.com/maps/api/js?key=${appwriteConfig.googleMapsApiKey}&libraries=geometry`;
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
            stylers: [{ visibility: "off" }]
          }
        ]
      });
    }

    const map = googleMapRef.current;

    // Decode polyline
    const path = google.maps.geometry.encoding.decodePath(polyline);

    // Draw route
    const routePolyline = new google.maps.Polyline({
      path: path,
      geodesic: true,
      strokeColor: "#6C5CE7", // Primary brand color
      strokeOpacity: 0.8,
      strokeWeight: 5,
    });
    routePolyline.setMap(map);

    // Custom Icons
    const dotIcon = {
      path: google.maps.SymbolPath.CIRCLE,
      scale: 6,
      fillColor: "#6C5CE7",
      fillOpacity: 1,
      strokeWeight: 2,
      strokeColor: "#FFFFFF",
    };

    const airportIcon = "https://maps.google.com/mapfiles/ms/icons/blue-dot.png"; // Or a custom SVG

    // Pickup Marker
    new google.maps.Marker({
      position: { lat: fromLat, lng: fromLng },
      map: map,
      icon: dotIcon,
      title: "Pickup",
    });

    // Drop Marker
    new google.maps.Marker({
      position: { lat: toLat, lng: toLng },
      map: map,
      icon: isAirportDrop ? airportIcon : dotIcon,
      title: "Drop-off",
    });

    // Fit bounds to polyline
    const bounds = new google.maps.LatLngBounds();
    path.forEach((latLng: any) => bounds.extend(latLng));
    map.fitBounds(bounds);

    return () => {
      routePolyline.setMap(null);
    };
  }, [mapsReady, fromLat, fromLng, toLat, toLng, polyline, isAirportDrop]);

  return (
    <div className="w-full h-48 rounded-2xl overflow-hidden border border-gray-100 shadow-sm relative">
      <div ref={mapRef} className="w-full h-full" />
    </div>
  );
}
