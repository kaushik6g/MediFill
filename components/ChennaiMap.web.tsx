import React from 'react';
import { View, StyleSheet } from 'react-native';
import GoogleMapReact from 'google-map-react';
import { Pharmacy } from '../constants/pharmacies';
import { Colors } from '../constants/theme';

// Marker component for web
const MapMarker = ({
  text,
  lat,
  lng,
  selected,
}: {
  text: string;
  lat: number;
  lng: number;
  selected?: boolean;
}) => {
  const handleClick = () => {
    const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    window.open(url, '_blank');
  };

  return (
    <div
      style={{
        position: 'absolute',
        transform: 'translate(-50%, -100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        cursor: 'pointer',
        zIndex: selected ? 10 : 1,
      }}
      onClick={handleClick}
    >
      <div
        style={{
          color: selected ? Colors.accent : Colors.primary,
          backgroundColor: 'white',
          padding: '4px 8px',
          borderRadius: '4px',
          fontSize: '12px',
          fontWeight: 'bold',
          marginBottom: '4px',
          boxShadow: selected
            ? '0 2px 8px rgba(2,132,199,0.35)'
            : '0 2px 4px rgba(0,0,0,0.2)',
          border: selected ? `1.5px solid ${Colors.accent}` : 'none',
        }}
      >
        {text}
      </div>
      <div style={{ color: selected ? Colors.accent : Colors.primary, fontSize: '24px' }}>📍</div>
    </div>
  );
};

// User location dot marker
const UserDot = ({ lat, lng }: { lat: number; lng: number }) => (
  <div
    style={{
      width: 16,
      height: 16,
      borderRadius: '50%',
      backgroundColor: Colors.primary,
      border: '3px solid white',
      boxShadow: '0 0 0 3px rgba(13,148,136,0.3)',
      transform: 'translate(-50%, -50%)',
    }}
  />
);

interface PharmacyMapProps {
  pharmacies: Pharmacy[];
  userLocation?: { latitude: number; longitude: number } | null;
  selectedPharmacy?: string;
}

const PharmacyMap: React.FC<PharmacyMapProps> = ({
  pharmacies,
  userLocation,
  selectedPharmacy,
}) => {
  const center = userLocation ??
    (pharmacies.length > 0
      ? { latitude: pharmacies[0].coordinates.latitude, longitude: pharmacies[0].coordinates.longitude }
      : { latitude: 13.0827, longitude: 80.2707 });

  return (
    <View style={styles.container}>
      <GoogleMapReact
        bootstrapURLKeys={{
          key: process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY ||
               process.env.EXPO_PUBLIC_FIREBASE_API_KEY ||
               '',
        }}
        center={{ lat: center.latitude, lng: center.longitude }}
        defaultZoom={13}
        options={{
          fullscreenControl: false,
          zoomControl: false,
        }}
      >
        {/* User location marker */}
        {userLocation && (
          <UserDot
            lat={userLocation.latitude}
            lng={userLocation.longitude}
          />
        )}

        {/* Pharmacy markers */}
        {pharmacies.map((pharmacy) => (
          <MapMarker
            key={pharmacy.id}
            lat={pharmacy.coordinates.latitude}
            lng={pharmacy.coordinates.longitude}
            text={pharmacy.name}
            selected={selectedPharmacy === pharmacy.id}
          />
        ))}
      </GoogleMapReact>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
    overflow: 'hidden',
  },
});

export default PharmacyMap;
