import { useEffect, useState } from "react";
import { appwriteConfig } from "@/integrations/appwrite/client";

declare global {
  interface Window {
    google?: { maps?: any };
  }
}

const SHARED_SCRIPT_ID = "google-maps-script";
const SHARED_SCRIPT_DATA_ATTR = "google-maps";

let loadingPromise: Promise<void> | null = null;

function hasFullMaps(): boolean {
  const maps = window.google?.maps;
  return !!(maps?.Geocoder && maps?.geometry && maps?.places && maps?.DirectionsService);
}

/** Loads Google Maps with both `places` and `geometry` libraries. Reuses any
 *  existing canonical `<script data-google-maps>` tag the rest of the app
 *  already added — important because including the Maps API twice on the
 *  same page makes Google show its own "Sorry! Something went wrong" error. */
export function loadGoogleMaps(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Maps requires window"));
  }
  if (hasFullMaps()) return Promise.resolve();
  if (loadingPromise) return loadingPromise;
  if (!appwriteConfig.googleMapsApiKey) {
    return Promise.reject(new Error("Missing Google Maps API key"));
  }

  loadingPromise = new Promise((resolve, reject) => {
    // Reuse any existing script the app has injected. We only ever want ONE
    // script tag for the Maps API per page load.
    let script = (document.getElementById(SHARED_SCRIPT_ID) as HTMLScriptElement | null) ||
      (document.querySelector(`script[data-${SHARED_SCRIPT_DATA_ATTR}]`) as HTMLScriptElement | null);

    if (!script) {
      script = document.createElement("script");
      script.id = SHARED_SCRIPT_ID;
      script.src = `https://maps.googleapis.com/maps/api/js?key=${appwriteConfig.googleMapsApiKey}&libraries=places,geometry`;
      script.async = true;
      script.defer = true;
      script.dataset.googleMaps = "places";
      document.head.appendChild(script);
    }

    const checkOrWait = () => {
      if (hasFullMaps()) return resolve();
      // The existing script may have been added without `geometry`. If the
      // script is already loaded but the geometry lib is missing, fall back
      // to Maps v3's importLibrary API which can add libraries to an already-
      // loaded SDK without injecting another script tag.
      if (script.dataset.loaded === "true" || (window as any).google?.maps) {
        const maps = (window as any).google?.maps;
        if (maps && typeof maps.importLibrary === "function") {
          Promise.all([
            maps.importLibrary("places"),
            maps.importLibrary("geometry"),
            maps.importLibrary("routes"),
          ])
            .then(() => (hasFullMaps() ? resolve() : reject(new Error("Maps libraries missing"))))
            .catch(reject);
          return;
        }
      }
      let tries = 0;
      const tick = () => {
        if (hasFullMaps()) return resolve();
        if (++tries > 80) return reject(new Error("Google Maps libraries never appeared"));
        setTimeout(tick, 50);
      };
      tick();
    };

    if (script.dataset.loaded === "true") {
      checkOrWait();
    } else {
      script.addEventListener(
        "load",
        () => {
          script!.dataset.loaded = "true";
          checkOrWait();
        },
        { once: true },
      );
      script.addEventListener(
        "error",
        () => reject(new Error("Google Maps script failed to load")),
        { once: true },
      );
    }
  });

  return loadingPromise;
}

export function useWizardMaps() {
  const [ready, setReady] = useState<boolean>(hasFullMapsSafe());
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;
    loadGoogleMaps()
      .then(() => {
        if (mounted) setReady(true);
      })
      .catch((e: Error) => {
        if (mounted) setError(e);
      });
    return () => {
      mounted = false;
    };
  }, []);

  return { ready, error };
}

function hasFullMapsSafe(): boolean {
  if (typeof window === "undefined") return false;
  return hasFullMaps();
}
