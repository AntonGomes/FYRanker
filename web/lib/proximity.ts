import type { RankableItem } from "@/components/rankable-list";

export interface Hospital {
  name: string;
  lat: number;
  lng: number;
  website?: string;
  address?: string;
  phone?: string;
  place_id?: string;
}

export interface UserLocation {
  lat: number;
  lng: number;
  displayName?: string;
}

export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function normalise(name: string): string {
  return name
    .toLowerCase()
    .replace(/['']/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function matchHospitalName(
  jobName: string,
  hospitals: Hospital[]
): Hospital | null {
  const norm = normalise(jobName);

  // Tier 1: exact match
  for (const h of hospitals) {
    if (normalise(h.name) === norm) return h;
  }

  // Tier 2: one contains the other
  for (const h of hospitals) {
    const hn = normalise(h.name);
    if (hn.includes(norm) || norm.includes(hn)) return h;
  }

  // Tier 3: significant word overlap (at least 2 shared words of length ≥3)
  const jobWords = new Set(
    norm.split(" ").filter((w) => w.length >= 3)
  );
  let bestMatch: Hospital | null = null;
  let bestOverlap = 0;
  for (const h of hospitals) {
    const hWords = normalise(h.name)
      .split(" ")
      .filter((w) => w.length >= 3);
    const overlap = hWords.filter((w) => jobWords.has(w)).length;
    if (overlap >= 2 && overlap > bestOverlap) {
      bestOverlap = overlap;
      bestMatch = h;
    }
  }
  return bestMatch;
}

export async function geocodeLocation(
  query: string
): Promise<UserLocation | null> {
  const params = new URLSearchParams({
    q: query,
    format: "json",
    countrycodes: "gb",
    limit: "1",
  });

  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?${params}`,
    { headers: { "User-Agent": "FYRanker/1.0" } }
  );
  if (!res.ok) return null;

  const data = await res.json();
  if (!data.length) return null;

  return {
    lat: parseFloat(data[0].lat),
    lng: parseFloat(data[0].lon),
    displayName: data[0].display_name,
  };
}

export function sortHospitalsByProximity(
  items: RankableItem[],
  userLocation: UserLocation,
  hospitals: Hospital[]
): RankableItem[] {
  const distanceMap = new Map<string, number>();

  for (const item of items) {
    const hospital = matchHospitalName(item.label, hospitals);
    if (hospital) {
      distanceMap.set(
        item.id,
        haversineDistance(
          userLocation.lat,
          userLocation.lng,
          hospital.lat,
          hospital.lng
        )
      );
    }
  }

  const matched = items
    .filter((item) => distanceMap.has(item.id))
    .sort((a, b) => distanceMap.get(a.id)! - distanceMap.get(b.id)!);

  const unmatched = items.filter((item) => !distanceMap.has(item.id));

  return [...matched, ...unmatched];
}
