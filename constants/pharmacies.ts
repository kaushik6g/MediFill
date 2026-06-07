/**
 * Pharmacy data types and pure helper functions.
 * The hardcoded CHENNAI_PHARMACIES are kept ONLY for reference/other uses.
 * The pharmacy screen uses ONLY live OpenStreetMap data.
 */

export interface Pharmacy {
  id: string;
  name: string;
  address: string;
  distance: string;      // human-readable: "350 m" or "2.4 km"
  distanceKm: number;    // raw km — used for accurate sorting
  rating: number;
  hours: string;
  coordinates: { latitude: number; longitude: number };
  phone?: string;
  is24Hours?: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Filter pharmacies by name or address */
export function searchPharmacies(pharmacies: Pharmacy[], query: string): Pharmacy[] {
  if (!query.trim()) return pharmacies;
  const q = query.toLowerCase();
  return pharmacies.filter(
    (p) => p.name.toLowerCase().includes(q) || p.address.toLowerCase().includes(q)
  );
}

/** Sort by real distance (uses distanceKm, not the string) */
export function sortByDistance(pharmacies: Pharmacy[]): Pharmacy[] {
  return [...pharmacies].sort((a, b) => a.distanceKm - b.distanceKm);
}

/** Sort by rating (desc) */
export function sortByRating(pharmacies: Pharmacy[]): Pharmacy[] {
  return [...pharmacies].sort((a, b) => b.rating - a.rating);
}
