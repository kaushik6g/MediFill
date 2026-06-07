/**
 * PharmacyMap.web.tsx
 * Inline Leaflet.js map for the web version of the pharmacy screen.
 * Uses free OpenStreetMap tiles — no API key, no cost.
 */
import React, { useMemo } from 'react';

interface MapPharmacy {
  id: string;
  name: string;
  address: string;
  coordinates: { latitude: number; longitude: number };
}

interface Props {
  userLat: number;
  userLon: number;
  pharmacies: MapPharmacy[];
}

export default function PharmacyMap({ userLat, userLon, pharmacies }: Props) {
  const pharmaciesJSON = useMemo(
    () =>
      JSON.stringify(
        pharmacies.map((p) => ({
          lat:     p.coordinates.latitude,
          lon:     p.coordinates.longitude,
          name:    p.name,
          address: p.address,
        }))
      ),
    [pharmacies]
  );

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { background:#f1f5f9; }
    #map { width:100vw; height:100vh; }
    .user-dot {
      width:16px; height:16px; border-radius:50%;
      background:#0D9488; border:3px solid #fff;
      box-shadow:0 0 0 3px rgba(13,148,136,0.3);
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%   { box-shadow:0 0 0 3px rgba(13,148,136,0.3); }
      70%  { box-shadow:0 0 0 10px rgba(13,148,136,0); }
      100% { box-shadow:0 0 0 3px rgba(13,148,136,0); }
    }
    .pharm-dot {
      width:12px; height:12px; border-radius:50%;
      background:#DC2626; border:2px solid #fff;
      box-shadow:0 2px 6px rgba(0,0,0,0.4);
      cursor:pointer;
    }
    .leaflet-popup-content { font-family:system-ui,sans-serif; min-width:160px; }
    .popup-name  { font-weight:700; color:#0F172A; font-size:13px; margin-bottom:4px; }
    .popup-addr  { color:#64748B; font-size:11px; margin-bottom:8px; line-height:1.4; }
    .popup-dir   {
      display:inline-block; background:#0D9488; color:#fff;
      padding:5px 12px; border-radius:8px; font-size:12px;
      font-weight:600; text-decoration:none;
    }
    .popup-dir:hover { background:#0F766E; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    const PHARMACIES = ${pharmaciesJSON};
    const USER_LAT   = ${userLat};
    const USER_LON   = ${userLon};

    const map = L.map('map', { zoomControl: true }).setView([USER_LAT, USER_LON], 14);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a> contributors',
      maxZoom: 19
    }).addTo(map);

    // ── User location marker ──────────────────────────────────────────────────
    const userIcon = L.divIcon({ html: '<div class="user-dot"></div>', iconSize:[16,16], iconAnchor:[8,8], className:'' });
    L.marker([USER_LAT, USER_LON], { icon: userIcon }).addTo(map)
      .bindPopup('<div class="popup-name">📍 You are here</div>');

    // ── Pharmacy markers ──────────────────────────────────────────────────────
    const pharmIcon = L.divIcon({ html: '<div class="pharm-dot"></div>', iconSize:[12,12], iconAnchor:[6,6], className:'' });
    const allPoints = [[USER_LAT, USER_LON]];

    PHARMACIES.forEach(function(p) {
      const mapsUrl = 'https://www.google.com/maps/dir/?api=1&destination=' + p.lat + ',' + p.lon;
      const popup =
        '<div class="leaflet-popup-content">' +
        '<div class="popup-name">🏥 ' + p.name + '</div>' +
        (p.address ? '<div class="popup-addr">' + p.address + '</div>' : '') +
        '<a class="popup-dir" href="' + mapsUrl + '" target="_top">📍 Get Directions</a>' +
        '</div>';

      L.marker([p.lat, p.lon], { icon: pharmIcon })
        .addTo(map)
        .bindPopup(popup, { maxWidth: 220 });

      allPoints.push([p.lat, p.lon]);
    });

    // Fit bounds to show user + all pharmacies
    if (PHARMACIES.length > 0) {
      map.fitBounds(allPoints, { padding: [40, 40], maxZoom: 15 });
    }
  </script>
</body>
</html>`;

  return (
    <div
      style={{
        height:       340,
        width:        '100%',
        borderRadius: 16,
        overflow:     'hidden',
        boxShadow:    '0 4px 16px rgba(0,0,0,0.08)',
        marginTop:    12,
      }}
    >
      <iframe
        srcDoc={html}
        style={{ width: '100%', height: '100%', border: 'none' }}
        title="Nearby Pharmacies Map"
        sandbox="allow-scripts allow-same-origin allow-top-navigation"
      />
    </div>
  );
}
