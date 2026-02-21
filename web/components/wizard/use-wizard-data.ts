"use client";

import { useEffect, useState } from "react";

import type { SortableItem } from "@/components/sortable-list";
import { extractUniqueValues } from "@/lib/extract";
import { loadJobs } from "@/lib/parse-csv";
import type { Job } from "@/lib/parse-xlsx";
import type { Hospital } from "@/lib/proximity";

import { toItems } from "./wizard-constants";

export interface WizardData {
  jobs: Job[] | null;
  loading: boolean;
  rankedRegions: SortableItem[];
  setRankedRegions: React.Dispatch<React.SetStateAction<SortableItem[]>>;
  hospitalsByRegion: Record<string, SortableItem[]>;
  setHospitalsByRegion: React.Dispatch<React.SetStateAction<Record<string, SortableItem[]>>>;
  rankedSpecialties: SortableItem[];
  setRankedSpecialties: React.Dispatch<React.SetStateAction<SortableItem[]>>;
  hospitals: Hospital[];
}

export function useWizardData(): WizardData {
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [rankedRegions, setRankedRegions] = useState<SortableItem[]>([]);
  const [hospitalsByRegion, setHospitalsByRegion] = useState<
    Record<string, SortableItem[]>
  >({});
  const [rankedSpecialties, setRankedSpecialties] = useState<SortableItem[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);

  useEffect(() => {
    Promise.all([
      loadJobs(),
      fetch("/hospitals.json").then((r) => r.json() as Promise<Hospital[]>),
    ]).then(([parsed, hospitalData]) => {
      setJobs(parsed);
      setHospitals(hospitalData);
      const data = extractUniqueValues(parsed);
      setRankedRegions(toItems(data.regions));
      const byRegion: Record<string, SortableItem[]> = {};
      for (const [region, hosps] of Object.entries(data.hospitalsByRegion)) {
        byRegion[region] = toItems(hosps);
      }
      setHospitalsByRegion(byRegion);
      setRankedSpecialties(toItems(data.specialties));
      setLoading(false);
    });
  }, []);

  return {
    jobs,
    loading,
    rankedRegions,
    setRankedRegions,
    hospitalsByRegion,
    setHospitalsByRegion,
    rankedSpecialties,
    setRankedSpecialties,
    hospitals,
  };
}
