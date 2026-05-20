import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { TrendingUp, Navigation, CarFront } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import dayjs from "dayjs";
import { appwriteConfig } from "@/integrations/appwrite/client";
import { listTrendingRoutes } from "@/data/appwrite-repository";
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
  const [status, setStatus] = useState<
    "idle" | "locating" | "fetching" | "success" | "error" | "denied"
  >("idle");
  const [city, setCity] = useState<string | null>(null);
  const [trips, setTrips] = useState<Awaited<ReturnType<typeof listTrendingRoutes>>>([]);

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
            if (
              component.types.includes("locality") ||
              component.types.includes("administrative_area_level_2")
            ) {
              if (
                component.long_name.toLowerCase() === SERVICE_CITY.toLowerCase() ||
                component.long_name.toLowerCase() === "bangalore"
              ) {
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
              if (
                component.types.includes("sublocality") ||
                component.types.includes("sublocality_level_1") ||
                component.types.includes("neighborhood")
              ) {
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
          window.dispatchEvent(
            new CustomEvent("coolpool:cityDetected", {
              detail: { from: finalDetectedLocation, to: "Kempegowda International Airport" },
            }),
          );
        }

        // Fetch trending routes (valid + ranked) for the service city
        const trending = await listTrendingRoutes({ city: SERVICE_CITY });

        if (mounted) {
          setTrips(trending);
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
          window.dispatchEvent(
            new CustomEvent("coolpool:cityDetected", {
              detail: { from: "", to: `${BENGALURU_AIRPORTS[0].name}` },
            }),
          );
        }

        const trending = await listTrendingRoutes();

        if (mounted) {
          setTrips(trending);
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
        { timeout: 10000 },
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
      const existingScript = document.querySelector(
        'script[data-google-maps="places"]',
      ) as HTMLScriptElement | null;
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
      <section className="container mx-auto px-4 sm:px-5 py-10 sm:py-16 max-w-7xl">
        <div className="flex items-end justify-between mb-5">
          <div className="space-y-2">
            <div className="h-3 w-20 bg-muted animate-pulse rounded-full" />
            <div className="h-6 w-44 bg-muted animate-pulse rounded" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 rounded-2xl bg-muted animate-pulse" />
          ))}
        </div>
      </section>
    );
  }

  if (status === "success") {
    return (
      <section className="container mx-auto px-4 sm:px-5 py-10 sm:py-16 max-w-7xl">
        <div className="flex items-end justify-between mb-5">
          <div>
            {city && (
              <p className="text-xs font-bold uppercase tracking-widest text-primary mb-1 flex items-center gap-1">
                <Navigation className="h-3 w-3" /> Near you
              </p>
            )}
            <h2 className="text-xl sm:text-2xl font-black tracking-tight">
              {city ? (
                <>
                  Trips from <span className="text-primary">{city.split(",")[0]}</span>
                </>
              ) : (
                <>
                  Trending <span className="text-primary">Routes</span>
                </>
              )}
            </h2>
          </div>
          <TrendingUp className="h-5 w-5 text-primary/40" />
        </div>

        {trips.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {trips.map((trip, i) => {
              const fromShort = trip.fromLocation.split(",")[0].trim();
              const toShort = trip.toLocation.split(",")[0].trim();
              const dateStr = dayjs(trip.departureAt).format("ddd, MMM D");
              const timeStr = dayjs(trip.departureAt).format("h:mm A");

              return (
                <Link
                  to="/booking/$tripId"
                  params={{ tripId: trip.id }}
                  key={trip.id}
                  className="block group"
                >
                  <div
                    className="relative rounded-2xl border border-gray-100 bg-white overflow-hidden shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 p-5"
                    style={{ animationDelay: `${i * 60}ms` }}
                  >
                    {/* Subtle gradient accent strip */}
                    <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-primary opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-t-2xl" />

                    {/* Route — full width */}
                    <div className="flex items-center gap-3">
                      {/* Timeline dots */}
                      <div className="flex flex-col items-center shrink-0 self-stretch py-2">
                        <div className="h-2.5 w-2.5 rounded-full bg-primary" />
                        <div className="w-px flex-1 min-h-[2rem] bg-gray-200 my-1.5" />
                        <div className="h-2.5 w-2.5 rounded-full border-2 border-gray-300" />
                      </div>
                      {/* City names */}
                      <div className="flex-1 min-w-0 flex flex-col justify-center gap-3">
                        <p
                          className="font-black text-[3rem] text-gray-900 leading-none whitespace-nowrap truncate"
                          title={trip.fromLocation}
                        >
                          {fromShort}
                        </p>
                        <p
                          className="font-black text-[3rem] text-gray-500 leading-none whitespace-nowrap truncate"
                          title={trip.toLocation}
                        >
                          {toShort}
                        </p>
                      </div>
                    </div>

                    {/* Date + time — bottom center */}
                    <div className="mt-5 flex items-center justify-center gap-2 text-muted-foreground">
                      <span className="text-sm font-bold uppercase tracking-wide">
                        {dateStr}
                      </span>
                      <span className="h-1 w-1 rounded-full bg-current opacity-50" />
                      <span className="text-base font-black text-gray-900 tabular-nums">
                        {timeStr}
                      </span>
                    </div>
                  </div>
                </Link>
              );
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
                {city
                  ? `Be the first to host a ride from ${city} to your favorite destination and start earning money on your next trip!`
                  : "Be the first to host a ride and start earning money on your next trip!"}
              </p>
              <Button
                asChild
                size="lg"
                variant="hero"
                className="rounded-3xl shadow-glow px-8 h-12 text-base"
              >
                <Link to="/host">Host a Ride </Link>
              </Button>
            </div>
          </Card>
        )}
      </section>
    );
  }

  if (status === "error") {
    return (
      <section className="container mx-auto px-4 sm:px-5 py-10 sm:py-16 max-w-7xl">
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
