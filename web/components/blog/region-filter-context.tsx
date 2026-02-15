"use client";

import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";
import type { Region } from "@/lib/region-colors";

interface RegionFilterContextType {
  /** Currently active region filter, or null for "all regions" */
  activeRegion: Region | null;
  /** Set a specific region or null to clear */
  setActiveRegion: (region: Region | null) => void;
  /** Toggle a region on/off (clicking the same region again clears it) */
  toggleRegion: (region: Region) => void;
}

const RegionFilterContext = createContext<RegionFilterContextType>({
  activeRegion: null,
  setActiveRegion: () => {},
  toggleRegion: () => {},
});

export function RegionFilterProvider({ children }: { children: ReactNode }) {
  const [activeRegion, setActiveRegion] = useState<Region | null>(null);

  const toggleRegion = (region: Region) => {
    setActiveRegion((prev) => (prev === region ? null : region));
  };

  return (
    <RegionFilterContext.Provider
      value={{ activeRegion, setActiveRegion, toggleRegion }}
    >
      {children}
    </RegionFilterContext.Provider>
  );
}

export function useRegionFilter() {
  return useContext(RegionFilterContext);
}
