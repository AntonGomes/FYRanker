export interface Placement {
  site: string;
  specialty: string;
  description?: string;
}

export interface Job {
  programmeTitle: string;
  deanery: string;
  region: "West" | "East" | "North" | "South and SE";
  placements: Placement[];
}
