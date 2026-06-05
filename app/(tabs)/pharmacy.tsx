import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Linking,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MapPin, Search, ExternalLink, Phone, Clock, Star, Navigation } from 'lucide-react-native';
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated';
import * as Location from 'expo-location';
import ChennaiMap from '../../components/ChennaiMap';
import {
  CHENNAI_PHARMACIES,
  searchPharmacies,
  sortByDistance,
  sortByRating,
  Pharmacy,
} from '../../constants/pharmacies';
import { Colors, Spacing, FontSize, BorderRadius, Shadow } from '../../constants/theme';

type SortMode = 'distance' | 'rating';

export default function PharmacyScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [pharmacies, setPharmacies] = useState(CHENNAI_PHARMACIES);
  const [selectedPharmacy, setSelectedPharmacy] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>('distance');
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);

  // Get user location on mount
  useEffect(() => {
    getUserLocation();
  }, []);

  // Filter and sort pharmacies when search or sort changes
  useEffect(() => {
    let results = searchPharmacies(searchQuery);
    results = sortMode === 'rating' ? sortByRating(results) : sortByDistance(results);
    setPharmacies(results);
  }, [searchQuery, sortMode]);

  const getUserLocation = async () => {
    try {
      setLocationLoading(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.log('Location permission denied');
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setUserLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
    } catch (error) {
      console.log('Error getting location:', error);
    } finally {
      setLocationLoading(false);
    }
  };

  const handlePharmacySelect = (id: string) => {
    setSelectedPharmacy(selectedPharmacy === id ? null : id);
  };

  const openMapsWithDirections = (pharmacy: Pharmacy) => {
    const { coordinates, name, address } = pharmacy;
    const { latitude, longitude } = coordinates;

    let url = '';
    if (Platform.OS === 'ios') {
      url = `maps:?q=${name}&ll=${latitude},${longitude}`;
    } else if (Platform.OS === 'android') {
      url = `geo:${latitude},${longitude}?q=${encodeURIComponent(`${name}, ${address}`)}`;
    } else {
      url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}&query_place_id=${latitude},${longitude}`;
    }

    Linking.canOpenURL(url)
      .then((supported) => {
        if (supported) return Linking.openURL(url);
        const webUrl = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
        return Linking.openURL(webUrl);
      })
      .catch((error) => console.error('Error opening maps:', error));
  };

  const callPharmacy = (phone?: string) => {
    if (!phone) return;
    Linking.openURL(`tel:${phone}`);
  };

  const renderStars = (rating: number) => {
    return (
      <View style={styles.starsContainer}>
        <Star size={14} color={Colors.warning} fill={Colors.warning} />
        <Text style={styles.ratingText}>{rating.toFixed(1)}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View entering={FadeInDown.duration(300)} style={styles.header}>
        <Text style={styles.title}>Nearby Pharmacies</Text>
        {userLocation && (
          <View style={styles.locationBadge}>
            <Navigation size={12} color={Colors.success} />
            <Text style={styles.locationText}>Location active</Text>
          </View>
        )}
        {locationLoading && (
          <View style={styles.locationBadge}>
            <ActivityIndicator size="small" color={Colors.primary} />
            <Text style={styles.locationText}>Getting location...</Text>
          </View>
        )}
      </Animated.View>

      {/* Map View */}
      <Animated.View entering={FadeInDown.delay(100).duration(400)} style={styles.mapContainer}>
        <ChennaiMap selectedPharmacy={selectedPharmacy || undefined} />
      </Animated.View>

      {/* Search Bar */}
      <Animated.View entering={FadeInDown.delay(200).duration(400)} style={styles.searchContainer}>
        <View style={styles.searchInputWrapper}>
          <Search size={18} color={Colors.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search pharmacies..."
            placeholderTextColor={Colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </Animated.View>

      {/* Sort Tabs */}
      <View style={styles.sortTabs}>
        <TouchableOpacity
          style={[styles.sortTab, sortMode === 'distance' && styles.sortTabActive]}
          onPress={() => setSortMode('distance')}
        >
          <MapPin size={14} color={sortMode === 'distance' ? Colors.primary : Colors.textTertiary} />
          <Text style={[styles.sortTabText, sortMode === 'distance' && styles.sortTabTextActive]}>
            Nearest
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.sortTab, sortMode === 'rating' && styles.sortTabActive]}
          onPress={() => setSortMode('rating')}
        >
          <Star size={14} color={sortMode === 'rating' ? Colors.primary : Colors.textTertiary} />
          <Text style={[styles.sortTabText, sortMode === 'rating' && styles.sortTabTextActive]}>
            Top Rated
          </Text>
        </TouchableOpacity>
      </View>

      {/* Results count */}
      <Text style={styles.resultsCount}>
        {pharmacies.length} pharmacies found
      </Text>

      {/* Pharmacy List */}
      <ScrollView style={styles.pharmacyList} showsVerticalScrollIndicator={false}>
        {pharmacies.length === 0 ? (
          <View style={styles.emptyState}>
            <MapPin size={40} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>No pharmacies found</Text>
            <Text style={styles.emptySubtitle}>Try a different search term</Text>
          </View>
        ) : (
          pharmacies.map((pharmacy, idx) => (
            <Animated.View
              key={pharmacy.id}
              entering={FadeInRight.delay(idx * 60).duration(400)}
            >
              <TouchableOpacity
                style={[
                  styles.pharmacyCard,
                  selectedPharmacy === pharmacy.id && styles.selectedPharmacyCard,
                ]}
                onPress={() => handlePharmacySelect(pharmacy.id)}
                activeOpacity={0.8}
              >
                <View style={styles.pharmacyTop}>
                  <View style={styles.pharmacyIconContainer}>
                    <MapPin size={22} color={Colors.primary} />
                  </View>
                  <View style={styles.pharmacyInfo}>
                    <Text style={styles.pharmacyName}>{pharmacy.name}</Text>
                    <Text style={styles.pharmacyAddress}>{pharmacy.address}</Text>
                    <View style={styles.pharmacyMeta}>
                      <Text style={styles.pharmacyDistance}>{pharmacy.distance}</Text>
                      <View style={styles.metaDot} />
                      {renderStars(pharmacy.rating)}
                      <View style={styles.metaDot} />
                      <View style={styles.hoursContainer}>
                        <Clock size={12} color={pharmacy.is24Hours ? Colors.success : Colors.textTertiary} />
                        <Text
                          style={[
                            styles.pharmacyHours,
                            pharmacy.is24Hours && styles.hours24,
                          ]}
                        >
                          {pharmacy.hours}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>

                {/* Action buttons — shown when selected */}
                {selectedPharmacy === pharmacy.id && (
                  <Animated.View
                    entering={FadeInDown.duration(200)}
                    style={styles.actionButtons}
                  >
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => openMapsWithDirections(pharmacy)}
                    >
                      <ExternalLink size={16} color={Colors.primary} />
                      <Text style={styles.actionButtonText}>Directions</Text>
                    </TouchableOpacity>
                    {pharmacy.phone && (
                      <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => callPharmacy(pharmacy.phone)}
                      >
                        <Phone size={16} color={Colors.primary} />
                        <Text style={styles.actionButtonText}>Call</Text>
                      </TouchableOpacity>
                    )}
                  </Animated.View>
                )}
              </TouchableOpacity>
            </Animated.View>
          ))
        )}
        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: Spacing.xxl, paddingTop: Spacing.xl, paddingBottom: Spacing.sm },
  title: { fontSize: 28, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.5 },
  locationBadge: {
    flexDirection: 'row', alignItems: 'center', marginTop: Spacing.xs,
  },
  locationText: { fontSize: FontSize.xs, color: Colors.textTertiary, marginLeft: Spacing.xs },
  mapContainer: {
    height: 200, marginHorizontal: Spacing.xxl, marginTop: Spacing.md,
    borderRadius: BorderRadius.lg, overflow: 'hidden', ...Shadow.sm,
  },
  searchContainer: { paddingHorizontal: Spacing.xxl, marginTop: Spacing.lg },
  searchInputWrapper: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg, paddingHorizontal: Spacing.md, height: 48, ...Shadow.sm,
  },
  searchInput: {
    flex: 1, fontSize: FontSize.md, color: Colors.textPrimary,
    paddingLeft: Spacing.sm, paddingVertical: Spacing.sm,
  },
  sortTabs: {
    flexDirection: 'row', paddingHorizontal: Spacing.xxl, marginTop: Spacing.md, gap: Spacing.sm,
  },
  sortTab: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md, borderRadius: BorderRadius.full,
    backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.border,
  },
  sortTabActive: { backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  sortTabText: { fontSize: FontSize.xs, color: Colors.textTertiary, fontWeight: '600', marginLeft: Spacing.xs },
  sortTabTextActive: { color: Colors.primary },
  resultsCount: {
    fontSize: FontSize.xs, color: Colors.textMuted, paddingHorizontal: Spacing.xxl,
    marginTop: Spacing.sm, marginBottom: Spacing.xs,
  },
  pharmacyList: { flex: 1, paddingHorizontal: Spacing.xxl },
  emptyState: { alignItems: 'center', padding: Spacing.xxxxl, marginTop: Spacing.xl },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textSecondary, marginTop: Spacing.md },
  emptySubtitle: { fontSize: FontSize.sm, color: Colors.textTertiary, marginTop: Spacing.xs },
  pharmacyCard: {
    backgroundColor: Colors.white, borderRadius: BorderRadius.xl, padding: Spacing.lg,
    marginBottom: Spacing.sm, ...Shadow.sm,
  },
  selectedPharmacyCard: { borderWidth: 1.5, borderColor: Colors.primary },
  pharmacyTop: { flexDirection: 'row', alignItems: 'flex-start' },
  pharmacyIconContainer: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primaryLight,
    justifyContent: 'center', alignItems: 'center', marginRight: Spacing.md,
  },
  pharmacyInfo: { flex: 1 },
  pharmacyName: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary },
  pharmacyAddress: { fontSize: FontSize.sm, color: Colors.textTertiary, marginTop: 2 },
  pharmacyMeta: { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.sm, flexWrap: 'wrap' },
  pharmacyDistance: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.primary },
  metaDot: {
    width: 4, height: 4, borderRadius: 2, backgroundColor: Colors.border,
    marginHorizontal: Spacing.sm,
  },
  starsContainer: { flexDirection: 'row', alignItems: 'center' },
  ratingText: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.textSecondary, marginLeft: 3 },
  hoursContainer: { flexDirection: 'row', alignItems: 'center' },
  pharmacyHours: { fontSize: FontSize.xs, color: Colors.textTertiary, marginLeft: 3 },
  hours24: { color: Colors.success, fontWeight: '600' },
  actionButtons: {
    flexDirection: 'row', marginTop: Spacing.md, paddingTop: Spacing.md,
    borderTopWidth: 1, borderTopColor: Colors.borderLight, gap: Spacing.sm,
  },
  actionButton: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md, borderRadius: BorderRadius.md,
    backgroundColor: Colors.primaryLight,
  },
  actionButtonText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.primary, marginLeft: Spacing.xs },
});