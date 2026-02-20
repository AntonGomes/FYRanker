"use client";

import { useRegionFilter } from "./region-filter-context";
import { REGIONS, REGION_HEX } from "@/lib/region-colors";
import { cn } from "@/lib/utils";

export function RegionFilterBar({ className }: { className?: string }) {
  const { activeRegion, toggleRegion, setActiveRegion } = useRegionFilter();

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-center gap-2",
        className
      )}
    >
      <button
        onClick={() => setActiveRegion(null)}
        className={cn(
          "rounded-full px-4 py-1.5 text-sm font-semibold transition-all",
          activeRegion === null
            ? "bg-foreground text-background"
            : "bg-muted text-foreground hover:bg-muted/80"
        )}
      >
        All Regions
      </button>

      {REGIONS.map((region) => {
        const hex = REGION_HEX[region];
        const isActive = activeRegion === region;

        return (
          <button
            key={region}
            onClick={() => toggleRegion(region)}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-semibold transition-all border-2",
              isActive
                ? "text-white"
                : "bg-transparent hover:opacity-80"
            )}
            style={{
              borderColor: hex,
              backgroundColor: isActive ? hex : "transparent",
              color: isActive ? "white" : hex,
            }}
          >
            {region}
          </button>
        );
      })}
    </div>
  );
}
