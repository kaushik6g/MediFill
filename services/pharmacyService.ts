/**
 * pharmacyService.ts
 * OpenStreetMap Overpass API only — 100% free, no API key needed.
 */

import { Pharmacy } from '../constants/pharmacies';

const OSM_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

const RADIUS_M  = 10000; // 10 km
const MAX_ITEMS = 30;

// ─── Distance ─────────────────────────────────────────────────────────────────
export function haversineKm(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function fmtDist(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

interface OSMElement {
  type: 'node' | 'way';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: {
    name?: string;
    'addr:full'?: string;
    'addr:street'?: string;
    'addr:housenumber'?: string;
    'addr:city'?: string;
    'addr:suburb'?: string;
    phone?: string;
    'contact:phone'?: string;
    opening_hours?: string;
  };
}

function buildAddress(tags: OSMElement['tags'] = {}): string {
  if (tags['addr:full']) return tags['addr:full'];
  const parts = [
    tags['addr:housenumber'],
    tags['addr:street'],
    tags['addr:suburb'],
    tags['addr:city'],
  ].filter(Boolean);
  return parts.join(', ') || '';
}

function parseHours(oh?: string): { hours: string; is24Hours: boolean } {
  if (!oh) return { hours: 'Hours unavailable', is24Hours: false };
  if (oh === '24/7') return { hours: '24 hours', is24Hours: true };
  const m = oh.match(/(\d{2}:\d{2})\s*[-–]\s*(\d{2}:\d{2})/);
  if (m) return { hours: `${m[1]} – ${m[2]}`, is24Hours: false };
  return { hours: oh.slice(0, 35), is24Hours: false };
}

function fetchPost(endpoint: string, body: string, ms = 20000): Promise<Response> {
  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return fetch(endpoint, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    signal:  ctrl.signal,
  }).finally(() => clearTimeout(timer));
}

export async function fetchNearbyPharmacies(
  userLat: number,
  userLon: number
): Promise<Pharmacy[]> {
  const area = `(around:${RADIUS_M},${userLat},${userLon})`;

  const tagParts = [
    `["amenity"="pharmacy"]`,
    `["shop"="chemist"]`,
    `["shop"="pharmacy"]`,
    `["shop"="medical"]`,
    `["healthcare"="pharmacy"]`,
  ].flatMap((t) => [`node${t}${area};`, `way${t}${area};`]);

  // Case-insensitive name search — catches Indian medical shops with no proper tag
  const nameRx   = `"medical|pharmacy|chemist|pharma|drug|medicine|medicos|clinic"`;
  const nameParts = [
    `node["name"~${nameRx},i]${area};`,
    `way["name"~${nameRx},i]${area};`,
  ];

  const query =
    `[out:json][timeout:25];\n` +
    `(\n  ${[...tagParts, ...nameParts].join('\n  ')}\n);\n` +
    `out center ${MAX_ITEMS};`;

  let lastErr: unknown = null;

  for (const ep of OSM_ENDPOINTS) {
    try {
      console.log('[OSM] POST →', ep);
      const res = await fetchPost(ep, `data=${encodeURIComponent(query)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data     = await res.json();
      const elements: OSMElement[] = data.elements ?? [];
      console.log('[OSM] ✓', elements.length, 'results');

      return elements
        .map((el): Pharmacy | null => {
          const lat = el.lat ?? el.center?.lat;
          const lon = el.lon ?? el.center?.lon;
          if (lat == null || lon == null) return null;
          const tags              = el.tags ?? {};
          const km                = haversineKm(userLat, userLon, lat, lon);
          const { hours, is24Hours } = parseHours(tags.opening_hours);
          return {
            id:          `osm-${el.type}-${el.id}`,
            name:        tags.name?.trim() || 'Pharmacy',
            address:     buildAddress(tags),
            distance:    fmtDist(km),
            distanceKm:  km,
            rating:      4.0,
            hours,
            is24Hours,
            coordinates: { latitude: lat, longitude: lon },
            phone:       tags.phone ?? tags['contact:phone'],
          };
        })
        .filter((p): p is Pharmacy => p !== null)
        .sort((a, b) => a.distanceKm - b.distanceKm);
    } catch (err: any) {
      console.warn('[OSM] ✗', ep, err?.message);
      lastErr = err;
    }
  }

  throw lastErr ?? new Error('OSM unreachable');
}
