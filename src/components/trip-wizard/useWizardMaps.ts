import { useEffect, useState } from "react";
import { appwriteConfig } from "@/integrations/appwrite/client";

declare global {
  interface Window {
    // Minimal escape hatch — the wizard only reads from the public maps API,
    // so we avoid pulling in @types/google.maps and rely on `any` at call sites.
    google?: { maps?: any };
  }
}

let loadingPromise: Promise<void> | null = null;

function loadMaps(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Maps requires window"));
  }
  if (window.google?.maps?.Geocoder && window.google.maps.geometry && window.google.maps.places) {
    return Promise.resolve();
  }
  if (loadingPromise) return loadingPromise;

  loadingPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(
      'script[data-google-maps="places"]',
    ) as HTMLScriptElement | null;

    const settle = () => {
      // The shared loader (used elsewhere in the app) may have loaded only
      // `places`. Wait until geometry is also live, polling briefly.
      const tick = () => {
        if (window.google?.maps?.geometry && window.google.maps.places) {
          resolve();
          return;
        }
        setTimeout(tick, 50);
      };
      tick();
    };

    if (existing) {
      if (existing.dataset.loaded === "true") {
        settle();
      } else {
        existing.addEventListener("load", settle, { once: true });
        existing.addEventListener(
          "error",
          () => reject(new Error("Google Maps script failed to load")),
          { once: true },
        );
      }
      return;
    }
    if (!appwriteConfig.googleMapsApiKey) {
      reject(new Error("Missing Google Maps API key"));
      return;
    }
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${appwriteConfig.googleMapsApiKey}&libraries=places,geometry`;
    script.async = true;
    script.defer = true;
    script.dataset.googleMaps = "places";
    script.addEventListener("load", () => {
      script.dataset.loaded = "true";
      settle();
    });
    script.addEventListener("error", () => reject(new Error("Google Maps script failed to load")));
    document.head.appendChild(script);
  });

  return loadingPromise;
}

export function useWizardMaps() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;
    loadMaps()
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
