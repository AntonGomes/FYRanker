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

// Build a lowercase name → hospital map for fast lookup
const byName = new Map<string, HospitalInfo>();
for (const h of hospitals) {
  byName.set(h.name.toLowerCase(), h);
}

/**
 * Fuzzy-match a placement site name to hospital data.
 * Tries exact match first, then substring containment in both directions.
 */
export function findHospital(siteName: string): HospitalInfo | null {
  const lower = siteName.toLowerCase().trim();

  // Exact match
  const exact = byName.get(lower);
  if (exact) return exact;

  // Site name contains a hospital name, or vice versa
  for (const [key, h] of byName) {
    if (lower.includes(key) || key.includes(lower)) return h;
  }

  return null;
}
