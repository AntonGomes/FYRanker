import type { RankableItem } from "@/components/rankable-list";
import { EARTH_RADIUS_KM, DEG_TO_RAD, MIN_WORD_LENGTH, MIN_WORD_OVERLAP } from "@/lib/constants";

export interface Hospital {
  name: string;
  lat: number;
  lng: number;
  website?: string;
  address?: string;
  phone?: string;
  place_id?: string;
}

export interface LatLng {
  lat: number;
  lng: number;
}

export interface UserLocation extends LatLng {
  displayName?: string;
}

export function haversineDistance(a: LatLng, b: LatLng): number {
  const dLat = (b.lat - a.lat) * DEG_TO_RAD;
  const dLng = (b.lng - a.lng) * DEG_TO_RAD;
  const sinHalf =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(a.lat * DEG_TO_RAD) *
      Math.cos(b.lat * DEG_TO_RAD) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(sinHalf), Math.sqrt(1 - sinHalf));
  return EARTH_RADIUS_KM * c;
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

  for (const h of hospitals) {
    if (normalise(h.name) === norm) return h;
  }

  for (const h of hospitals) {
    const hn = normalise(h.name);
    if (hn.includes(norm) || norm.includes(hn)) return h;
  }

  const jobWords = new Set(
    norm.split(" ").filter((w) => w.length >= MIN_WORD_LENGTH)
  );
  let bestMatch: Hospital | null = null;
  let bestOverlap = 0;
  for (const h of hospitals) {
    const hWords = normalise(h.name)
      .split(" ")
      .filter((w) => w.length >= MIN_WORD_LENGTH);
    const overlap = hWords.filter((w) => jobWords.has(w)).length;
    if (overlap >= MIN_WORD_OVERLAP && overlap > bestOverlap) {
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

export interface SortByProximityOptions {
  items: RankableItem[];
  userLocation: UserLocation;
  hospitals: Hospital[];
}

export function sortHospitalsByProximity(options: SortByProximityOptions): RankableItem[] {
  const { items, userLocation, hospitals } = options;
  const distanceMap = new Map<string, number>();

  for (const item of items) {
    const hospital = matchHospitalName(item.label, hospitals);
    if (hospital) {
      distanceMap.set(
        item.id,
        haversineDistance(userLocation, hospital)
      );
    }
  }

  const matched = items
    .filter((item) => distanceMap.has(item.id))
    .sort((a, b) => distanceMap.get(a.id)! - distanceMap.get(b.id)!);

  const unmatched = items.filter((item) => !distanceMap.has(item.id));

  return [...matched, ...unmatched];
}
