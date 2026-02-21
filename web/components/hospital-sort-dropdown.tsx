"use client";

import { useState, useEffect, useCallback } from "react";
import { Navigation, Loader2, MapPin } from "lucide-react";
import {
  type Hospital,
  type UserLocation,
  geocodeLocation,
  sortHospitalsByProximity,
} from "@/lib/proximity";
import type { RankableItem } from "@/components/rankable-list";
import { COORD_DECIMAL_PLACES, GEOLOCATION_TIMEOUT } from "@/lib/constants";

export type SortMode = "default" | "z-a" | "proximity";

interface HospitalSortDropdownProps {
  items: RankableItem[];
  onSort: (sortedItems: RankableItem[]) => void;
  userLocation: UserLocation | null;
  onLocationChange: (loc: UserLocation | null) => void;
  hospitals: Hospital[];
  sortMode: SortMode;
  onSortModeChange: (mode: SortMode) => void;
}

export function HospitalSortDropdown({
  items,
  onSort,
  userLocation,
  onLocationChange,
  hospitals,
  sortMode,
  onSortModeChange,
}: HospitalSortDropdownProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locationInput, setLocationInput] = useState("");
  const [locationTab, setLocationTab] = useState<"auto" | "manual">("auto");
  const handleModeChange = useCallback(
    (mode: SortMode) => {
      onSortModeChange(mode);

      if (mode === "default") {
        onSort([...items].sort((a, b) => a.label.localeCompare(b.label)));
      } else if (mode === "z-a") {
        onSort([...items].sort((a, b) => b.label.localeCompare(a.label)));
      } else if (mode === "proximity") {
        if (userLocation && hospitals.length > 0) {
          onSort(sortHospitalsByProximity({ items, userLocation, hospitals }));
        }
      }
    },
    [items, onSort, onSortModeChange, userLocation, hospitals]
  );

  const handleAutoDetect = useCallback(() => {
    if (!navigator.geolocation) {
      setError("Geolocation not supported");
      return;
    }
    setLoading(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        onLocationChange({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          displayName: `${position.coords.latitude.toFixed(COORD_DECIMAL_PLACES)}, ${position.coords.longitude.toFixed(COORD_DECIMAL_PLACES)}`,
        });
        setLoading(false);
      },
      (err) => {
        setError(
          err.code === err.PERMISSION_DENIED
            ? "Access denied — enter a postcode instead"
            : "Could not get location"
        );
        setLoading(false);
      },
      { enableHighAccuracy: false, timeout: GEOLOCATION_TIMEOUT }
    );
  }, [onLocationChange]);

  const handleManualGeocode = useCallback(async () => {
    const query = locationInput.trim();
    if (!query) return;
    setLoading(true);
    setError(null);
    try {
      const loc = await geocodeLocation(query);
      if (loc) {
        onLocationChange(loc);
      } else {
        setError("Not found — try another postcode");
      }
    } catch {
      setError("Lookup failed");
    } finally {
      setLoading(false);
    }
  }, [locationInput, onLocationChange]);

  
  useEffect(() => {
    if (sortMode === "proximity" && userLocation && hospitals.length > 0) {
      onSort(sortHospitalsByProximity({ items, userLocation, hospitals }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userLocation, hospitals]);

  return (
    <div className="space-y-2">
      <select
        value={sortMode}
        onChange={(e) => handleModeChange(e.target.value as SortMode)}
        className="h-7 rounded-md border bg-background px-2 text-xs outline-none focus:ring-2 focus:ring-ring/50 cursor-pointer"
      >
        <option value="default">A → Z</option>
        <option value="z-a">Z → A</option>
        <option value="proximity">Nearest to me</option>
      </select>

      {sortMode === "proximity" && (
        <div className="space-y-1.5">
          {userLocation ? (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{userLocation.displayName}</span>
              <button
                onClick={() => onLocationChange(null)}
                className="shrink-0 text-[10px] text-muted-foreground hover:text-foreground underline"
              >
                change
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-1.5">
              <div className="flex items-center rounded-md border bg-background text-xs overflow-hidden">
                <button
                  onClick={() => setLocationTab("auto")}
                  className={`px-2 py-1 transition-colors ${locationTab === "auto" ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:text-foreground"}`}
                >
                  <Navigation className="h-3 w-3 inline mr-0.5" />
                  Detect
                </button>
                <div className="w-px h-4 bg-border" />
                <button
                  onClick={() => setLocationTab("manual")}
                  className={`px-2 py-1 transition-colors ${locationTab === "manual" ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:text-foreground"}`}
                >
                  Postcode
                </button>
              </div>

              {locationTab === "auto" && (
                <button
                  onClick={handleAutoDetect}
                  disabled={loading}
                  className="flex items-center gap-1 rounded-md border bg-background px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Navigation className="h-3 w-3" />
                  )}
                  {loading ? "Locating..." : "Go"}
                </button>
              )}

              {locationTab === "manual" && (
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    placeholder="e.g. EH1 1YZ"
                    value={locationInput}
                    onChange={(e) => setLocationInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleManualGeocode();
                    }}
                    className="w-24 rounded-md border bg-background px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-ring/50 placeholder:text-muted-foreground"
                  />
                  <button
                    onClick={handleManualGeocode}
                    disabled={loading || !locationInput.trim()}
                    className="rounded-md border bg-background px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Go"}
                  </button>
                </div>
              )}
            </div>
          )}

          {error && <p className="text-[11px] text-destructive">{error}</p>}
        </div>
      )}
    </div>
  );
}
