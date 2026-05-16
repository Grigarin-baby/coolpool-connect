import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { TrendingUp, Navigation, CarFront, Star, ShieldCheck, ChevronRight, Clock, MapPin } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import dayjs from "dayjs";
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
        const now = Date.now();
        const allTrips = await listTrips(100);
        const filtered = allTrips
          .filter((t) => new Date(t.departureAt).getTime() > now)
          .filter((t) => routeCitySegmentsMatch(t.fromLocation, SERVICE_CITY) || routeCitySegmentsMatch(t.toLocation, SERVICE_CITY))
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

        const now = Date.now();
        const allTrips = await listTrips(100);
        const filtered = allTrips
          .filter((t) => new Date(t.departureAt).getTime() > now)
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
              <div className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold uppercase tracking-widest text-primary mb-2">
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
              const fromShort = trip.fromLocation.split(',')[0].trim();
              const toShort = trip.toLocation.split(',')[0].trim();
              const hostInitials = trip.hostId ? trip.hostId.substring(0, 2).toUpperCase() : "VH";
              const pricePerSeat = trip.totalSeats > 0 ? trip.totalPrice / trip.totalSeats : trip.totalPrice;

              return (
                <Link to="/booking/$tripId" params={{ tripId: trip.id }} key={trip.id} className="block group">
                  <Card className="bg-white rounded-3xl border border-gray-100 shadow-soft hover:shadow-elevated hover:border-primary/20 hover:-translate-y-1 transition-all duration-300 overflow-hidden flex flex-col h-full">
                    {/* Top: Driver Info */}
                    <div className="p-5 pb-4 flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center text-primary font-bold shadow-sm border border-primary/10 shrink-0">
                          {hostInitials}
                        </div>
                        <div>
                          <p className="font-bold text-base text-gray-900 leading-none mb-1.5">Verified Host</p>
                          <div className="flex items-center gap-1 text-sm text-gray-500 font-medium">
                            <Star size={10} className="fill-amber-400 text-amber-400" />
                            <span>4.8 · 120 trips</span>
                          </div>
                        </div>
                      </div>
                      <div className="bg-green-50 text-green-600 border border-green-100 px-2 py-1 rounded-full flex items-center gap-1">
                        <ShieldCheck size={12} className="shrink-0" />
                        <span className="text-[9px] font-bold uppercase tracking-wider">Verified</span>
                      </div>
                    </div>

                    {/* Middle: Route & Time */}
                    <div className="px-5 py-2 flex-1">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-1.5 text-primary">
                          <Clock size={14} />
                          <span className="font-bold text-lg">{dayjs(trip.departureAt).format("hh:mm A")}</span>
                        </div>
                        <span className="text-sm font-bold text-gray-500 uppercase tracking-wider">{dayjs(trip.departureAt).format("MMM DD")}</span>
                      </div>
                      
                      <div className="flex items-center gap-3 relative">
                        <div className="flex flex-col items-center gap-1 shrink-0">
                          <div className="h-2.5 w-2.5 rounded-full border-2 border-primary" />
                          <div className="w-0.5 h-6 bg-gray-200" />
                          <div className="h-2.5 w-2.5 rounded-full border-2 border-gray-400" />
                        </div>
                        <div className="flex flex-col gap-3 min-w-0 flex-1">
                          <div className="min-w-0">
                            <p className="font-bold text-base sm:text-lg text-gray-900 truncate" title={trip.fromLocation}>{fromShort}</p>
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-base sm:text-lg text-gray-600 truncate" title={trip.toLocation}>{toShort}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Bottom: Booking Details */}
                    <div className="mt-auto border-t border-gray-100 p-5 bg-gray-50/50">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500 bg-white px-2 py-1 rounded-full border border-gray-100 shadow-sm">
                          <CarFront size={12} className="text-gray-400" />
                          <span>Standard Sedan</span>
                        </div>
                        <div className="bg-primary/10 text-primary px-2 py-1 rounded-full">
                          <span className="text-xs sm:text-sm font-bold uppercase tracking-wider">{trip.totalSeats} seats left</span>
                        </div>
                      </div>

                      <div className="flex items-end justify-between">
                        <div>
                          <p className="text-xs sm:text-sm text-gray-500 font-bold uppercase tracking-widest mb-0.5">Price</p>
                          <div className="flex items-baseline gap-1">
                            <span className="text-2xl sm:text-3xl font-black text-gray-900 leading-none">{formatCurrency(pricePerSeat)}</span>
                            <span className="text-sm text-gray-500 font-medium">/seat</span>
                          </div>
                        </div>
                        <div className="h-11 px-5 bg-gray-900 group-hover:bg-primary text-white rounded-full flex items-center justify-center font-bold text-base transition-colors shadow-sm gap-1.5">
                          Book
                          <ChevronRight size={16} />
                        </div>
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
