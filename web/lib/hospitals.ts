import hospitalsData from "./hospitals-data.json";

export interface HospitalInfo {
  name: string;
  lat: number;
  lng: number;
  website: string;
  address: string;
  phone: string;
  place_id: string;
}

const hospitals = hospitalsData as HospitalInfo[];


const byName = new Map<string, HospitalInfo>();
for (const h of hospitals) {
  byName.set(h.name.toLowerCase(), h);
}


export function findHospital(siteName: string): HospitalInfo | null {
  const lower = siteName.toLowerCase().trim();

  
  const exact = byName.get(lower);
  if (exact) return exact;

  
  for (const [key, h] of byName) {
    if (lower.includes(key) || key.includes(lower)) return h;
  }

  return null;
}
