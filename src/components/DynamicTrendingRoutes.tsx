import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { TrendingUp, Navigation, CarFront } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { appwriteConfig } from "@/integrations/appwrite/client";
import { listTrips } from "@/data/appwrite-repository";
import { formatCurrency } from "@/lib/pricing";
import { routeCitySegmentsMatch } from "@/lib/geo";
import { SERVICE_CITY, BENGALURU_AIRPORTS } from "@/lib/config";

// Need Google Maps window typing
interface GoogleMapsWindow {
  google?: {
    maps?: {
      Geocoder?: any;
    };
  };
}

export function DynamicTrendingRoutes() {
  const [status, setStatus] = useState<"idle" | "locating" | "fetching" | "success" | "error" | "denied">("idle");
  const [city, setCity] = useState<string | null>(null);
  const [trips, setTrips] = useState<Awaited<ReturnType<typeof listTrips>>>([]);

  useEffect(() => {
    let mounted = true;

    const fetchCityAndTrips = async (lat: number, lng: number) => {
      setStatus("fetching");
      try {
        await loadGoogleMaps();
        const maps = (window as Window & GoogleMapsWindow).google?.maps;
        if (!maps?.Geocoder) throw new Error("Geocoder not available");

        const geocoder = new maps.Geocoder();
        const response = await new Promise<any>((resolve, reject) => {
          geocoder.geocode({ location: { lat, lng } }, (results: any, status: string) => {
            if (status === "OK" && results && results.length > 0) {
              resolve(results);
            } else {
              reject(new Error("Geocoding failed"));
            }
          });
        });

        // 1. Check if user is in SERVICE_CITY
        let isInServiceCity = false;
        let neighborhood = "";

        for (const result of response) {
          for (const component of result.address_components) {
            if (component.types.includes("locality") || component.types.includes("administrative_area_level_2")) {
              if (component.long_name.toLowerCase() === SERVICE_CITY.toLowerCase() || component.long_name.toLowerCase() === "bangalore") {
                isInServiceCity = true;
              }
            }
          }
        }

        let finalDetectedLocation = "";
        let nearestAirport = BENGALURU_AIRPORTS[0].name;

        // 2. Extract Neighborhood if they are in the city
        if (isInServiceCity) {
          let minDistance = Infinity;
          for (const airport of BENGALURU_AIRPORTS) {
            const dx = lat - airport.lat;
            const dy = lng - airport.lng;
            const dist = dx * dx + dy * dy; // Approximation is fine for intra-city
            if (dist < minDistance) {
              minDistance = dist;
              nearestAirport = airport.name;
            }
          }

          for (const result of response) {
            for (const component of result.address_components) {
              // Usually sublocality_level_1, neighborhood, or route
              if (component.types.includes("sublocality") || component.types.includes("sublocality_level_1") || component.types.includes("neighborhood")) {
                neighborhood = component.long_name;
                break;
              }
            }
            if (neighborhood) break;
          }
          if (neighborhood) {
            finalDetectedLocation = `${neighborhood}, ${SERVICE_CITY}`;
          }
        }

        if (mounted) {
          setCity(finalDetectedLocation);
          window.dispatchEvent(new CustomEvent("coolpool:cityDetected", { 
            detail: { from: finalDetectedLocation, to: "Kempegowda International Airport" } 
          }));
        }

        // Fetch trips
        const allTrips = await listTrips(100);
        const filtered = allTrips
          .filter((t) => routeCitySegmentsMatch(t.fromLocation, SERVICE_CITY))
          .sort((a, b) => new Date(a.departureAt).getTime() - new Date(b.departureAt).getTime())
          .slice(0, 4);

        if (mounted) {
          setTrips(filtered);
          setStatus("success");
        }
      } catch (e) {
        if (mounted) setStatus("error");
      }
    };

    
    const fetchFallbackCityAndTrips = async () => {
      setStatus("fetching");
      try {
        if (mounted) {
          setCity("");
          window.dispatchEvent(new CustomEvent("coolpool:cityDetected", { 
            detail: { from: "", to: `${BENGALURU_AIRPORTS[0].name}` } 
          }));
        }

        const allTrips = await listTrips(100);
        const filtered = allTrips
          .sort((a, b) => new Date(a.departureAt).getTime() - new Date(b.departureAt).getTime())
          .slice(0, 4);

        if (mounted) {
          setTrips(filtered);
          setStatus("success");
        }
      } catch (e) {
        if (mounted) setStatus("error");
      }
    };

    const requestLocation = () => {
      if (!navigator.geolocation) {
        fetchFallbackCityAndTrips();
        return;
      }
      setStatus("locating");
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          fetchCityAndTrips(pos.coords.latitude, pos.coords.longitude);
        },
        (err) => {
          fetchFallbackCityAndTrips();
        },
        { timeout: 10000 }
      );
    };

    const timer = setTimeout(requestLocation, 1000);
    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, []);

  const loadGoogleMaps = (): Promise<void> => {
    return new Promise((resolve) => {
      if ((window as Window & GoogleMapsWindow).google?.maps?.Geocoder) {
        return resolve();
      }
      const existingScript = document.querySelector('script[data-google-maps="places"]') as HTMLScriptElement | null;
      if (existingScript) {
        if (existingScript.dataset.loaded === "true") return resolve();
        existingScript.addEventListener("load", () => resolve(), { once: true });
        return;
      }
      if (!appwriteConfig.googleMapsApiKey) return resolve(); // Will fail later gracefully
      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${appwriteConfig.googleMapsApiKey}&libraries=places`;
      script.async = true;
      script.defer = true;
      script.dataset.googleMaps = "places";
      script.addEventListener("load", () => {
        script.dataset.loaded = "true";
        resolve();
      });
      document.head.appendChild(script);
    });
  };

  if (status === "idle" || status === "locating" || status === "fetching") {
    return (
      <section className="container mx-auto px-4 sm:px-5 py-16 sm:py-24 max-w-7xl">
        <div className="flex items-center justify-between mb-10">
          <div className="space-y-2">
            <div className="h-8 w-48 bg-muted animate-pulse rounded" />
            <div className="h-4 w-64 bg-muted animate-pulse rounded" />
          </div>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="h-48 rounded-3xl border-0 bg-muted animate-pulse shadow-sm" />
          ))}
        </div>
      </section>
    );
  }

  if (status === "success") {
    return (
      <section className="container mx-auto px-4 sm:px-5 py-16 sm:py-24 max-w-7xl">
        <div className="flex items-center justify-between mb-10">
          <div>
            {city && (
              <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-primary mb-2">
                <Navigation className="h-3.5 w-3.5" /> Near you
              </div>
            )}
            <h2 className="text-3xl font-bold tracking-tight font-heading">
              {city ? (
                <>Trips from <span className="text-primary">{city}</span></>
              ) : (
                <>Trending <span className="text-primary">Routes</span></>
              )}
            </h2>
            <p className="text-muted-foreground mt-2">
              {city ? "Catch a ride leaving from your city." : "Popular intercity connections you might love."}
            </p>
          </div>
          <TrendingUp className="h-8 w-8 text-primary/30 hidden sm:block" />
        </div>
        
        {trips.length > 0 ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            {trips.map((trip) => {
              // Pick a random scenic fallback image
              const imgId = trip.id.charCodeAt(0) % 5;
              const images = [
                "https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?auto=format&fit=crop&q=80&w=600",
                "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&q=80&w=600",
                "https://images.unsplash.com/photo-1465447142348-e9952c393450?auto=format&fit=crop&q=80&w=600",
                "https://images.unsplash.com/photo-1506012787146-f92b2d7d6d96?auto=format&fit=crop&q=80&w=600",
                "https://images.unsplash.com/photo-1471624632486-5386221c97a5?auto=format&fit=crop&q=80&w=600"
              ];

              return (
                <Link to="/booking/$tripId" params={{ tripId: trip.id }} key={trip.id} className="block group">
                  <Card className="relative overflow-hidden rounded-3xl border-0 shadow-card cursor-pointer hover:shadow-glow transition-all duration-300">
                    <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors z-10" />
                    <img src={images[imgId]} alt={trip.toLocation} className="w-full h-48 object-cover group-hover:scale-110 transition-transform duration-700 ease-out" />
                    <div className="absolute inset-0 z-20 p-5 flex flex-col justify-end">
                      <p className="text-white/80 text-xs font-bold uppercase tracking-widest truncate">{trip.fromLocation} to</p>
                      <h3 className="text-white text-2xl font-bold truncate" title={trip.toLocation}>{trip.toLocation.split(',')[0]}</h3>
                      <div className="mt-3 inline-flex self-start px-3 py-1 bg-white/20 backdrop-blur-md border border-white/30 text-white font-bold text-sm">
                        {formatCurrency(trip.totalPrice)}
                      </div>
                    </div>
                  </Card>
                </Link>
              )
            })}
          </div>
        ) : (
          <Card className="w-full rounded-3xl border-border/60 bg-gradient-soft shadow-soft p-8 md:p-12 text-center relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
              <CarFront className="h-64 w-64 text-primary" />
            </div>
            <div className="relative z-10 max-w-xl mx-auto flex flex-col items-center">
              <div className="h-16 w-16 mb-6 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                <Navigation className="h-8 w-8" />
              </div>
              <h3 className="text-2xl md:text-3xl font-bold font-heading mb-4 text-balance">
                {city ? `No rides from ${city} yet` : "No rides available yet"}
              </h3>
              <p className="text-muted-foreground text-lg mb-8 leading-relaxed">
                {city ? `Be the first to host a ride from ${city} to your favorite destination and start earning money on your next trip!` : "Be the first to host a ride and start earning money on your next trip!"}
              </p>
              <Button asChild size="lg" variant="hero" className="rounded-3xl shadow-glow px-8 h-12 text-base">
                <Link to="/host">Host a Ride Now</Link>
              </Button>
            </div>
          </Card>
        )}
      </section>
    );
  }

  if (status === "error") {
    return (
      <section className="container mx-auto px-4 sm:px-5 py-16 sm:py-24 max-w-7xl">
        <Card className="w-full rounded-3xl border-border/60 bg-gradient-soft shadow-soft p-8 md:p-12 text-center relative overflow-hidden">
          <div className="relative z-10 max-w-xl mx-auto flex flex-col items-center">
            <h3 className="text-2xl md:text-3xl font-bold font-heading mb-4 text-balance">
              Unable to load trips
            </h3>
            <p className="text-muted-foreground text-lg mb-8 leading-relaxed">
              We couldn't fetch the latest trips right now. Please try again later.
            </p>
          </div>
        </Card>
      </section>
    );
  }

  return null;
}
