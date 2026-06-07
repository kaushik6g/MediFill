import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  MapPin,
  Navigation,
  LocateFixed,
  Phone,
  ExternalLink,
  AlertCircle,
  ShieldCheck,
  ChevronRight,
} from 'lucide-react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import * as Location from 'expo-location';
import { Colors, Spacing, FontSize, BorderRadius, Shadow } from '../../constants/theme';

// ─── GPS helper ───────────────────────────────────────────────────────────────
async function getGPS(): Promise<{ latitude: number; longitude: number }> {
  if (Platform.OS === 'web') {
    if (!navigator?.geolocation) throw new Error('NO_GEOLOCATION');
    return new Promise((resolve, reject) =>
      navigator.geolocation.getCurrentPosition(
        (p) => resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude }),
        (e) => {
          if (e.code === 1) reject(new Error('PERMISSION_DENIED'));
          else if (e.code === 3) reject(new Error('TIMEOUT'));
          else reject(new Error(e.message));
        },
        { enableHighAccuracy: false, timeout: 15000, maximumAge: 120000 }
      )
    );
  }
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') throw new Error('PERMISSION_DENIED');
  const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  return { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
}

function openMaps(lat: number, lon: number) {
  const urls: Record<string, string> = {
    ios:     `maps://?q=pharmacy&near=${lat},${lon}`,
    android: `geo:${lat},${lon}?q=pharmacy`,
    web:     `https://www.google.com/maps/search/pharmacy/@${lat},${lon},15z`,
  };
  const url = urls[Platform.OS] ?? urls.web;
  Linking.canOpenURL(url)
    .then((ok) => Linking.openURL(ok ? url : urls.web))
    .catch(console.error);
}

// ─── Data ─────────────────────────────────────────────────────────────────────
const PHARMACY_SERVICES = [
  { id: 'apollo',   name: 'Apollo Pharmacy', tag: '24/7 delivery',     color: '#0066CC', bg: '#EBF3FD', emoji: '💊', url: 'https://www.apollopharmacy.in' },
  { id: 'medplus',  name: 'MedPlus',         tag: 'Home delivery',     color: '#C62828', bg: '#FDECEA', emoji: '🏥', url: 'https://www.medplusmart.com'   },
  { id: 'netmeds',  name: 'Netmeds',         tag: 'Online pharmacy',   color: '#00897B', bg: '#E0F2F1', emoji: '💉', url: 'https://www.netmeds.com'       },
  { id: '1mg',      name: '1mg (Tata)',       tag: 'Meds + Lab tests',  color: '#E64A19', bg: '#FBE9E7', emoji: '🧬', url: 'https://www.1mg.com'           },
  { id: 'pharmeasy',name: 'PharmEasy',        tag: 'Fast delivery',     color: '#6A1B9A', bg: '#F3E5F5', emoji: '🚚', url: 'https://pharmeasy.in'          },
  { id: 'saveon',   name: 'Healthkart',       tag: 'Health & Wellness', color: '#1565C0', bg: '#E3F2FD', emoji: '🛒', url: 'https://www.healthkart.com' },
];

const EMERGENCY = [
  { label: 'Medical Emergency',  sub: 'Ambulance dispatch',        number: '108', color: '#C62828', bg: '#FDECEA' },
  { label: 'National Ambulance', sub: 'Free govt. ambulance',      number: '102', color: '#E64A19', bg: '#FBE9E7' },
  { label: 'Poison Control',     sub: 'AIIMS helpline',            number: '1800-11-6117', color: '#6A1B9A', bg: '#F3E5F5' },
];

// ─────────────────────────────────────────────────────────────────────────────
export default function PharmacyScreen() {
  const [phase, setPhase]               = useState<'idle' | 'locating' | 'done' | 'error'>('idle');
  const [errorMsg, setErrorMsg]         = useState('');
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  const handleDetectLocation = useCallback(async () => {
    try {
      setPhase('locating');
      setErrorMsg('');
      const coords = await getGPS();
      setUserLocation(coords);
      setPhase('done');
      openMaps(coords.latitude, coords.longitude);
    } catch (err: any) {
      const msg = err?.message ?? '';
      setErrorMsg(
        msg === 'PERMISSION_DENIED'
          ? Platform.OS === 'web'
            ? 'Location blocked. Click the 🔒 icon in address bar → Allow → try again.'
            : 'Location permission denied. Allow it in Settings then try again.'
          : msg === 'TIMEOUT'
          ? 'Location timed out. Move to an open area and try again.'
          : 'Could not get location. Please try again.'
      );
      setPhase('error');
    }
  }, []);

  const isLocating = phase === 'locating';
  const hasCoords  = userLocation !== null;
  const isDone     = phase === 'done';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Header ── */}
        <Animated.View entering={FadeInDown.duration(300)} style={styles.header}>
          <Text style={styles.title}>Find a Pharmacy</Text>
          <Text style={styles.subtitle}>Locate nearby or order medicine online</Text>
          {hasCoords && (
            <View style={styles.gpsPill}>
              <Navigation size={10} color={Colors.success} />
              <Text style={styles.gpsText}>
                {`${userLocation!.latitude.toFixed(4)}°, ${userLocation!.longitude.toFixed(4)}°`}
              </Text>
              <View style={styles.gpsDot} />
              <Text style={[styles.gpsText, { color: Colors.success }]}>Location detected</Text>
            </View>
          )}
        </Animated.View>

        {/* ── CTA Hero Card ── */}
        <Animated.View entering={FadeInDown.delay(60).duration(320)} style={styles.heroCard}>
          {/* Background pattern circles */}
          <View style={styles.heroBgCircle1} />
          <View style={styles.heroBgCircle2} />

          <View style={styles.heroIcon}>
            <MapPin size={28} color={Colors.white} />
          </View>
          <Text style={styles.heroTitle}>Pharmacies Near You</Text>
          <Text style={styles.heroBody}>
            Tap below to share your location and instantly see all nearby pharmacies on Google Maps.
          </Text>

          {phase === 'error' && (
            <View style={styles.errorBox}>
              <AlertCircle size={13} color={Colors.danger} />
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.findBtn, isLocating && { opacity: 0.75 }]}
            onPress={handleDetectLocation}
            activeOpacity={0.85}
            disabled={isLocating}
          >
            {isLocating
              ? <ActivityIndicator size="small" color={Colors.primary} />
              : <LocateFixed size={17} color={Colors.primary} />
            }
            <Text style={styles.findBtnTxt}>
              {isLocating ? 'Detecting location…' : isDone ? 'Open Maps Again' : 'Find Pharmacies Near Me'}
            </Text>
          </TouchableOpacity>

          {isDone && (
            <Animated.View entering={FadeInUp.duration(200)} style={styles.successRow}>
              <ShieldCheck size={13} color={Colors.success} />
              <Text style={styles.successTxt}>GPS locked · Opens Google Maps directly</Text>
            </Animated.View>
          )}
        </Animated.View>

        {/* ── Online Pharmacies ── */}
        <Animated.View entering={FadeInDown.delay(120).duration(300)} style={styles.section}>
          <Text style={styles.sectionTitle}>Order Online · Home Delivery</Text>
          <Text style={styles.sectionSub}>Trusted platforms with genuine medicines</Text>

          <View style={styles.grid}>
            {PHARMACY_SERVICES.map((s, i) => (
              <Animated.View key={s.id} entering={FadeInUp.delay(i * 35).duration(220)} style={styles.gridItem}>
                <TouchableOpacity
                  style={styles.serviceCard}
                  onPress={() => Linking.openURL(s.url)}
                  activeOpacity={0.78}
                >
                  <View style={[styles.emojiWrap, { backgroundColor: s.bg }]}>
                    <Text style={styles.emoji}>{s.emoji}</Text>
                  </View>
                  <Text style={styles.serviceName} numberOfLines={1}>{s.name}</Text>
                  <Text style={styles.serviceTag} numberOfLines={1}>{s.tag}</Text>
                  <View style={[styles.visitBtn, { backgroundColor: s.bg }]}>
                    <Text style={[styles.visitTxt, { color: s.color }]}>Visit →</Text>
                  </View>
                </TouchableOpacity>
              </Animated.View>
            ))}
          </View>
        </Animated.View>

        {/* ── Emergency ── */}
        <Animated.View entering={FadeInDown.delay(180).duration(300)} style={styles.section}>
          <Text style={[styles.sectionTitle, { color: Colors.danger }]}>🚨 Emergency Helplines</Text>
          <Text style={styles.sectionSub}>Tap to call instantly — available 24/7</Text>

          {EMERGENCY.map((e, i) => (
            <Animated.View key={e.number} entering={FadeInDown.delay(200 + i * 40).duration(220)}>
              <TouchableOpacity
                style={styles.emergencyCard}
                onPress={() => Linking.openURL(`tel:${e.number}`)}
                activeOpacity={0.82}
              >
                <View style={[styles.numBadge, { backgroundColor: e.bg }]}>
                  <Text style={[styles.numTxt, { color: e.color }]}>{e.number}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.emergencyLabel}>{e.label}</Text>
                  <Text style={styles.emergencySub}>{e.sub}</Text>
                </View>
                <View style={[styles.callChip, { backgroundColor: e.bg }]}>
                  <Phone size={12} color={e.color} />
                  <Text style={[styles.callChipTxt, { color: e.color }]}>Call</Text>
                </View>
              </TouchableOpacity>
            </Animated.View>
          ))}
        </Animated.View>

        {/* ── Safety tip ── */}
        <Animated.View entering={FadeInDown.delay(240).duration(300)} style={styles.tipCard}>
          <ShieldCheck size={16} color={Colors.primary} />
          <Text style={styles.tipText}>
            <Text style={{ fontWeight: '700' }}>Safety tip: </Text>
            Always verify your prescription with a licensed pharmacist before purchasing any medication.
          </Text>
        </Animated.View>

        <View style={{ height: 56 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  scroll:    { flex: 1 },

  // Header
  header:   { paddingHorizontal: Spacing.xxl, paddingTop: Spacing.xl, paddingBottom: Spacing.md },
  title:    { fontSize: 26, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.5 },
  subtitle: { fontSize: 12, color: Colors.textMuted, marginTop: 3 },
  gpsPill:  {
    flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: Spacing.sm,
    backgroundColor: Colors.primaryLight, paddingVertical: 5, paddingHorizontal: 12,
    borderRadius: BorderRadius.full, alignSelf: 'flex-start',
  },
  gpsText:  { fontSize: 11, color: Colors.primary, fontWeight: '600' },
  gpsDot:   { width: 4, height: 4, borderRadius: 2, backgroundColor: Colors.success },

  // Hero card
  heroCard: {
    marginHorizontal: Spacing.xxl, borderRadius: BorderRadius.xl + 4,
    backgroundColor: Colors.primary, padding: Spacing.xl + 4,
    alignItems: 'center', gap: Spacing.sm, overflow: 'hidden',
    ...Shadow.lg,
  },
  heroBgCircle1: {
    position: 'absolute', width: 200, height: 200, borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.05)', top: -60, right: -60,
  },
  heroBgCircle2: {
    position: 'absolute', width: 140, height: 140, borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.06)', bottom: -40, left: -40,
  },
  heroIcon: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center', alignItems: 'center', marginBottom: 4,
  },
  heroTitle:  { fontSize: FontSize.xl, fontWeight: '800', color: Colors.white, textAlign: 'center' },
  heroBody:   { fontSize: 12, color: 'rgba(255,255,255,0.8)', textAlign: 'center', lineHeight: 19 },
  errorBox:   {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: Colors.white, padding: Spacing.md,
    borderRadius: BorderRadius.md, width: '100%',
  },
  errorText:  { flex: 1, fontSize: 12, color: Colors.danger, lineHeight: 17 },
  findBtn:    {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
    backgroundColor: Colors.white, paddingVertical: 14,
    width: '100%', borderRadius: BorderRadius.lg, marginTop: 4, ...Shadow.sm,
  },
  findBtnTxt: { fontSize: FontSize.sm, fontWeight: '800', color: Colors.primary },
  successRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  successTxt: { fontSize: 11, color: 'rgba(255,255,255,0.85)', fontWeight: '500' },

  // Section
  section:      { marginHorizontal: Spacing.xxl, marginTop: Spacing.xl },
  sectionTitle: { fontSize: FontSize.md, fontWeight: '800', color: Colors.textPrimary },
  sectionSub:   { fontSize: 12, color: Colors.textMuted, marginTop: 2, marginBottom: Spacing.md },

  // Grid
  grid:     { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  gridItem: { width: '31%' },
  serviceCard: {
    backgroundColor: Colors.white, borderRadius: BorderRadius.lg,
    padding: Spacing.md, alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: Colors.borderLight, ...Shadow.sm,
  },
  emojiWrap:   { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  emoji:       { fontSize: 22 },
  serviceName: { fontSize: 11, fontWeight: '700', color: Colors.textPrimary, textAlign: 'center' },
  serviceTag:  { fontSize: 10, color: Colors.textMuted, textAlign: 'center' },
  visitBtn:    { paddingVertical: 4, paddingHorizontal: 10, borderRadius: BorderRadius.full, marginTop: 2 },
  visitTxt:    { fontSize: 10, fontWeight: '700' },

  // Emergency
  emergencyCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.white, borderRadius: BorderRadius.lg,
    padding: Spacing.md, marginBottom: Spacing.sm,
    borderWidth: 1, borderColor: Colors.borderLight, ...Shadow.sm,
  },
  numBadge:      { paddingVertical: 8, paddingHorizontal: 12, borderRadius: BorderRadius.md },
  numTxt:        { fontSize: FontSize.md, fontWeight: '800' },
  emergencyLabel:{ fontSize: FontSize.sm, fontWeight: '700', color: Colors.textPrimary },
  emergencySub:  { fontSize: 11, color: Colors.textMuted, marginTop: 1 },
  callChip:      { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: 10, borderRadius: BorderRadius.full },
  callChipTxt:   { fontSize: 11, fontWeight: '700' },

  // Tip
  tipCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm,
    marginHorizontal: Spacing.xxl, marginTop: Spacing.lg,
    backgroundColor: Colors.primaryLight, borderRadius: BorderRadius.lg,
    padding: Spacing.md + 2, borderWidth: 1, borderColor: '#99F6E4',
  },
  tipText: { flex: 1, fontSize: 12, color: Colors.textSecondary, lineHeight: 19 },
});