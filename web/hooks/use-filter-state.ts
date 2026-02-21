import { useState, useMemo, useCallback } from "react";
import type { ScoredJob } from "@/lib/scoring";
import type {
  FilterState,
  FilterActions,
} from "@/components/results-view/types";

export interface FilterStateReturn {
  filters: FilterState;
  filterActions: FilterActions;
  hasActiveFilters: boolean;
  filteredJobs: ScoredJob[];
  allRegions: string[];
  allHospitals: string[];
  allSpecialties: string[];
}

function collectRegions(jobs: ScoredJob[]): string[] {
  const set = new Set<string>();
  jobs.forEach((s) => set.add(s.job.region));
  return Array.from(set).sort();
}

function collectHospitals(jobs: ScoredJob[]): string[] {
  const set = new Set<string>();
  for (const s of jobs) {
    for (const p of s.job.placements) {
      if (p.site && p.site !== "None" && p.site.trim() !== "")
        set.add(p.site);
    }
  }
  return Array.from(set).sort();
}

function collectSpecialties(jobs: ScoredJob[]): string[] {
  const set = new Set<string>();
  for (const s of jobs) {
    for (const p of s.job.placements) {
      if (
        p.specialty &&
        p.specialty !== "None" &&
        p.specialty.trim() !== ""
      )
        set.add(p.specialty);
    }
  }
  return Array.from(set).sort();
}

function matchesSearch(s: ScoredJob, query: string): boolean {
  const q = query.toLowerCase();
  const title = s.job.programmeTitle.toLowerCase();
  const region = s.job.region.toLowerCase();
  let haystack = "";
  for (const p of s.job.placements) {
    haystack += " " + p.site.toLowerCase();
    haystack += " " + p.specialty.toLowerCase();
  }
  return title.includes(q) || region.includes(q) || haystack.includes(q);
}

function filterJobs(opts: {
  rankedJobs: ScoredJob[];
  filters: FilterState;
}): ScoredJob[] {
  const { rankedJobs, filters } = opts;
  return rankedJobs.filter((s) => {
    if (filters.regionFilter !== "all" && s.job.region !== filters.regionFilter)
      return false;
    if (filters.hospitalFilter !== "all") {
      if (!s.job.placements.some((p) => p.site === filters.hospitalFilter))
        return false;
    }
    if (filters.specialtyFilter !== "all") {
      if (!s.job.placements.some((p) => p.specialty === filters.specialtyFilter))
        return false;
    }
    if (filters.searchQuery && !matchesSearch(s, filters.searchQuery))
      return false;
    return true;
  });
}

function useFilterValues(rankedJobs: ScoredJob[]) {
  const [searchQuery, setSearchQuery] = useState("");
  const [regionFilter, setRegionFilter] = useState("all");
  const [hospitalFilter, setHospitalFilter] = useState("all");
  const [specialtyFilter, setSpecialtyFilter] = useState("all");
  const clearFilters = useCallback(() => {
    setSearchQuery("");
    setRegionFilter("all");
    setHospitalFilter("all");
    setSpecialtyFilter("all");
  }, []);
  const filters: FilterState = { searchQuery, regionFilter, hospitalFilter, specialtyFilter };
  const filterActions: FilterActions = { setSearchQuery, setRegionFilter, setHospitalFilter, setSpecialtyFilter, clearFilters };
  const hasActiveFilters = searchQuery !== "" || regionFilter !== "all" || hospitalFilter !== "all" || specialtyFilter !== "all";
  const allRegions = useMemo(() => collectRegions(rankedJobs), [rankedJobs]);
  const allHospitals = useMemo(() => collectHospitals(rankedJobs), [rankedJobs]);
  const allSpecialties = useMemo(() => collectSpecialties(rankedJobs), [rankedJobs]);
  return { filters, filterActions, hasActiveFilters, allRegions, allHospitals, allSpecialties };
}

export function useFilterState(
  rankedJobs: ScoredJob[]
): FilterStateReturn {
  const vals = useFilterValues(rankedJobs);
  const filteredJobs = useMemo(
    () => filterJobs({ rankedJobs, filters: vals.filters }),
    [rankedJobs, vals.filters]
  );
  return { ...vals, filteredJobs };
}
