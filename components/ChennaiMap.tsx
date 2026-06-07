import React from 'react';
import { View, StyleSheet, Linking, Platform } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { Pharmacy } from '../constants/pharmacies';
import { Colors } from '../constants/theme';

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
  // Center on user location if available, otherwise use the first pharmacy or Chennai
  const center = userLocation ??
    (pharmacies.length > 0 ? pharmacies[0].coordinates : { latitude: 13.0827, longitude: 80.2707 });

  const openMapsWithDirections = (latitude: number, longitude: number) => {
    let url = '';

    if (Platform.OS === 'ios') {
      url = `maps:?ll=${latitude},${longitude}`;
    } else {
      url = `google.navigation:q=${latitude},${longitude}`;
    }

    Linking.canOpenURL(url)
      .then((supported) => {
        if (supported) {
          return Linking.openURL(url);
        }
        const webUrl = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
        return Linking.openURL(webUrl);
      })
      .catch((error) => console.error('Error opening maps:', error));
  };

  return (
    <View style={styles.container}>
      <MapView
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        region={{
          latitude: center.latitude,
          longitude: center.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
        showsUserLocation
        showsMyLocationButton={false}
      >
        {pharmacies.map((pharmacy) => (
          <Marker
            key={pharmacy.id}
            coordinate={pharmacy.coordinates}
            title={pharmacy.name}
            description={pharmacy.address}
            pinColor={selectedPharmacy === pharmacy.id ? Colors.accent : Colors.primary}
            onPress={() =>
              openMapsWithDirections(
                pharmacy.coordinates.latitude,
                pharmacy.coordinates.longitude
              )
            }
          />
        ))}
      </MapView>
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
  map: {
    width: '100%',
    height: '100%',
  },
});

export default PharmacyMap;