export interface Placement {
  site: string;
  speciality: string;
  description?: string;
}

export interface Job {
  id: string;
  programme_title: string;
  region: "West" | "East" | "North" | "South and SE";
  placement_1: Placement;
  placement_2: Placement;
  placement_3: Placement;
  placement_4: Placement;
  placement_5: Placement;
  placement_6: Placement;
}
