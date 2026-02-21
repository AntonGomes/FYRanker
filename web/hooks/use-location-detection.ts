"use client";

import { useState, useCallback } from "react";
import {
  type UserLocation,
  geocodeLocation,
} from "@/lib/proximity";
import { COORD_DECIMAL_PLACES, GEOLOCATION_TIMEOUT } from "@/lib/constants";

interface UseLocationDetectionResult {
  loading: boolean;
  error: string | null;
  locationInput: string;
  setLocationInput: (v: string) => void;
  locationTab: "auto" | "manual";
  setLocationTab: (tab: "auto" | "manual") => void;
  handleAutoDetect: () => void;
  handleManualGeocode: () => void;
}

function buildLocationFromCoords(coords: GeolocationCoordinates): UserLocation {
  return {
    lat: coords.latitude,
    lng: coords.longitude,
    displayName: `${coords.latitude.toFixed(COORD_DECIMAL_PLACES)}, ${coords.longitude.toFixed(COORD_DECIMAL_PLACES)}`,
  };
}

function geoErrorMessage(err: GeolocationPositionError): string {
  if (err.code === err.PERMISSION_DENIED) {
    return "Access denied — enter a postcode instead";
  }
  return "Could not get location";
}

interface DetectionSetters {
  setLoading: (v: boolean) => void;
  setError: (v: string | null) => void;
}

function useAutoDetect(onLocationChange: (loc: UserLocation) => void, setters: DetectionSetters): () => void {
  return useCallback(() => {
    if (!navigator.geolocation) { setters.setError("Geolocation not supported"); return; }
    setters.setLoading(true);
    setters.setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => { onLocationChange(buildLocationFromCoords(pos.coords)); setters.setLoading(false); },
      (err) => { setters.setError(geoErrorMessage(err)); setters.setLoading(false); },
      { enableHighAccuracy: false, timeout: GEOLOCATION_TIMEOUT }
    );
  }, [onLocationChange, setters]);
}

interface ManualGeocodeInput {
  locationInput: string;
  onLocationChange: (loc: UserLocation) => void;
  setters: DetectionSetters;
}

function useManualGeocode({ locationInput, onLocationChange, setters }: ManualGeocodeInput): () => void {
  return useCallback(async () => {
    const query = locationInput.trim();
    if (!query) return;
    setters.setLoading(true);
    setters.setError(null);
    try {
      const loc = await geocodeLocation(query);
      if (loc) { onLocationChange(loc); }
      else { setters.setError("Not found — try another postcode"); }
    } catch {
      setters.setError("Lookup failed");
    } finally {
      setters.setLoading(false);
    }
  }, [locationInput, onLocationChange, setters]);
}

export function useLocationDetection(
  onLocationChange: (loc: UserLocation | null) => void
): UseLocationDetectionResult {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locationInput, setLocationInput] = useState("");
  const [locationTab, setLocationTab] = useState<"auto" | "manual">("auto");
  const setters: DetectionSetters = { setLoading, setError };
  const handleAutoDetect = useAutoDetect(onLocationChange, setters);
  const handleManualGeocode = useManualGeocode({ locationInput, onLocationChange, setters });

  return { loading, error, locationInput, setLocationInput, locationTab, setLocationTab, handleAutoDetect, handleManualGeocode };
}
