"use client";

import { useState, useEffect, useCallback } from "react";
import { MapPin, ChevronDown, Navigation, Keyboard, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  type Hospital,
  type UserLocation,
  geocodeLocation,
  sortHospitalsByProximity,
} from "@/lib/proximity";
import type { RankableItem } from "@/components/rankable-list";

interface ProximitySorterProps {
  items: RankableItem[];
  onSort: (sortedItems: RankableItem[]) => void;
  userLocation: UserLocation | null;
  onLocationChange: (loc: UserLocation | null) => void;
  hospitals: Hospital[];
}

export function ProximitySorter({
  items,
  onSort,
  userLocation,
  onLocationChange,
  hospitals,
}: ProximitySorterProps) {
  const [expanded, setExpanded] = useState(!!userLocation);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locationInput, setLocationInput] = useState("");

  const handleAutoDetect = useCallback(() => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser");
      return;
    }

    setLoading(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        onLocationChange({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          displayName: `${position.coords.latitude.toFixed(3)}, ${position.coords.longitude.toFixed(3)}`,
        });
        setLoading(false);
      },
      (err) => {
        setError(
          err.code === err.PERMISSION_DENIED
            ? "Location access denied — try entering a postcode instead"
            : "Could not get your location"
        );
        setLoading(false);
      },
      { enableHighAccuracy: false, timeout: 10000 }
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
        setError("Location not found — try a different postcode or city name");
      }
    } catch {
      setError("Failed to look up location");
    } finally {
      setLoading(false);
    }
  }, [locationInput, onLocationChange]);

  const handleSort = useCallback(() => {
    if (!userLocation || hospitals.length === 0) return;
    const sorted = sortHospitalsByProximity(items, userLocation, hospitals);
    onSort(sorted);
  }, [items, userLocation, hospitals, onSort]);

  // Auto-sort when location is first obtained
  useEffect(() => {
    if (userLocation && hospitals.length > 0) {
      handleSort();
    }
    // Only trigger when userLocation changes, not on every items change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userLocation, hospitals]);

  return (
    <div className="rounded-lg border bg-card">
      {/* Header toggle */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-accent/50 transition-colors rounded-lg"
      >
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">
            {userLocation ? "Sorted by proximity" : "Sort by proximity"}
          </span>
          {userLocation && (
            <span className="text-xs text-muted-foreground truncate max-w-[200px]">
              — {userLocation.displayName}
            </span>
          )}
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform",
            expanded && "rotate-180"
          )}
        />
      </button>

      {/* Expandable content */}
      {expanded && (
        <div className="border-t px-4 pb-4 pt-3 space-y-3">
          <Tabs defaultValue="auto">
            <TabsList className="w-full">
              <TabsTrigger value="auto" className="flex-1 gap-1.5">
                <Navigation className="h-3.5 w-3.5" />
                Use my location
              </TabsTrigger>
              <TabsTrigger value="manual" className="flex-1 gap-1.5">
                <Keyboard className="h-3.5 w-3.5" />
                Enter postcode
              </TabsTrigger>
            </TabsList>

            <TabsContent value="auto" className="pt-3">
              <Button
                variant="outline"
                onClick={handleAutoDetect}
                disabled={loading}
                className="w-full"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Getting location...
                  </>
                ) : (
                  <>
                    <Navigation className="h-4 w-4" />
                    Detect my location
                  </>
                )}
              </Button>
            </TabsContent>

            <TabsContent value="manual" className="pt-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. EH1 1YZ or Edinburgh"
                  value={locationInput}
                  onChange={(e) => setLocationInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleManualGeocode();
                  }}
                  className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
                <Button
                  variant="outline"
                  onClick={handleManualGeocode}
                  disabled={loading || !locationInput.trim()}
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Search"
                  )}
                </Button>
              </div>
            </TabsContent>
          </Tabs>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          {userLocation && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground truncate max-w-[300px]">
                {userLocation.displayName}
              </p>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleSort}
                className="text-xs shrink-0"
              >
                Re-sort this region
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
