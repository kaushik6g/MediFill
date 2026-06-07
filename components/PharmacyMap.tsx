/**
 * PharmacyMap.tsx — native fallback
 * On native (iOS/Android) the map is not embedded inline.
 * Returns null so the screen shows only the list.
 */
import React from 'react';

interface Props {
  userLat: number;
  userLon: number;
  pharmacies: Array<{
    id: string;
    name: string;
    address: string;
    coordinates: { latitude: number; longitude: number };
  }>;
}

export default function PharmacyMap(_props: Props): React.ReactElement | null {
  return null; // Native: map shown via "Open in Maps" button
}
