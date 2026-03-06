import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  Alert as RNAlert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeIn, Layout } from 'react-native-reanimated';
import {
  Search,
  Bell,
  CircleAlert as AlertCircle,
  Pill,
  Calendar,
  Package,
  Clock,
  X,
  Plus,
  ChevronRight,
} from 'lucide-react-native';
import { useMedicineContext } from '../../context/MedicineContext';
import MedicineCard from '../../components/MedicineCard';
import { router } from 'expo-router';
import {
  Colors,
  Spacing,
  FontSize,
  BorderRadius,
  Shadow,
} from '../../constants/theme';

export default function HomeScreen() {
  const { medicines, alerts, loadMedicines, markAlertAsRead, activeUser } =
    useMedicineContext();
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredMedicines, setFilteredMedicines] = useState(medicines);
  const [showAlerts, setShowAlerts] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      await loadMedicines();
      setIsLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredMedicines(medicines);
    } else {
      setFilteredMedicines(
        medicines.filter((m) =>
          m.name.toLowerCase().includes(searchQuery.toLowerCase())
        )
      );
    }
  }, [searchQuery, medicines]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadMedicines();
    setRefreshing(false);
  };

  const unreadAlerts = alerts.filter((a) => !a.read);
  const alertsToDisplay = showAlerts ? alerts : unreadAlerts;

  const handleAlertPress = (alertId: string) => {
    const alert = alerts.find((a) => a.id === alertId);
    if (!alert) return;
    RNAlert.alert(alert.title, alert.description, [
      { text: 'Dismiss', onPress: () => markAlertAsRead(alertId), style: 'cancel' },
    ]);
  };

  const getAlertIcon = (type: string) => {
    const iconMap: Record<string, JSX.Element> = {
      expiry: <Calendar size={18} color={Colors.danger} />,
      stock: <Package size={18} color={Colors.warning} />,
      interaction: <AlertCircle size={18} color={Colors.danger} />,
      reminder: <Clock size={18} color={Colors.primary} />,
    };
    return iconMap[type] || <AlertCircle size={18} color={Colors.danger} />;
  };

  const getAlertColor = (type: string) => {
    if (type === 'stock') return Colors.warning;
    if (type === 'reminder') return Colors.primary;
    return Colors.danger;
  };

  // Quick stats
  const totalMeds = medicines.length;
  const expiringCount = medicines.filter((m) => {
    const d = Math.ceil(
      (new Date(m.expiryDate).getTime() - Date.now()) / 86400000
    );
    return d > 0 && d <= 30;
  }).length;
  const lowStockCount = medicines.filter(
    (m) => m.currentQuantity / m.totalQuantity <= 0.2
  ).length;

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading medicines…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <Animated.View entering={FadeIn.duration(400)} style={styles.header}>
        <View>
          <Text style={styles.greeting}>Good {getTimeOfDay()},</Text>
          <Text style={styles.title}>
            {activeUser ? activeUser.name : 'MediFill'}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.bellButton}
          onPress={() => setShowAlerts(!showAlerts)}
        >
          <Bell size={22} color={Colors.primary} />
          {unreadAlerts.length > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {unreadAlerts.length > 9 ? '9+' : unreadAlerts.length}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </Animated.View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
          />
        }
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* Search Bar */}
        <Animated.View
          entering={FadeInDown.delay(100).duration(400)}
          style={styles.searchWrapper}
        >
          <View style={styles.searchContainer}>
            <Search size={18} color={Colors.textTertiary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search medicines…"
              placeholderTextColor={Colors.textTertiary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <X size={18} color={Colors.textTertiary} />
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>

        {/* Quick Stats */}
        {totalMeds > 0 && (
          <Animated.View
            entering={FadeInDown.delay(200).duration(400)}
            style={styles.statsRow}
          >
            <View style={[styles.statCard, { backgroundColor: Colors.primaryLight }]}>
              <Pill size={20} color={Colors.primary} />
              <Text style={[styles.statNumber, { color: Colors.primary }]}>
                {totalMeds}
              </Text>
              <Text style={styles.statLabel}>Medicines</Text>
            </View>
            <View
              style={[
                styles.statCard,
                {
                  backgroundColor:
                    expiringCount > 0 ? Colors.warningLight : Colors.accentLight,
                },
              ]}
            >
              <Calendar
                size={20}
                color={expiringCount > 0 ? Colors.warning : Colors.accent}
              />
              <Text
                style={[
                  styles.statNumber,
                  { color: expiringCount > 0 ? Colors.warning : Colors.accent },
                ]}
              >
                {expiringCount}
              </Text>
              <Text style={styles.statLabel}>Expiring</Text>
            </View>
            <View
              style={[
                styles.statCard,
                {
                  backgroundColor:
                    lowStockCount > 0 ? Colors.dangerLight : Colors.successLight,
                },
              ]}
            >
              <Package
                size={20}
                color={lowStockCount > 0 ? Colors.danger : Colors.success}
              />
              <Text
                style={[
                  styles.statNumber,
                  { color: lowStockCount > 0 ? Colors.danger : Colors.success },
                ]}
              >
                {lowStockCount}
              </Text>
              <Text style={styles.statLabel}>Low Stock</Text>
            </View>
          </Animated.View>
        )}

        {/* Alerts */}
        {(showAlerts || unreadAlerts.length > 0) && alertsToDisplay.length > 0 && (
          <Animated.View
            entering={FadeInDown.delay(250).duration(400)}
            style={styles.alertsSection}
          >
            <View style={styles.alertsHeader}>
              <View style={styles.alertsTitleRow}>
                <AlertCircle size={18} color={Colors.danger} />
                <Text style={styles.alertsTitleText}>
                  Alerts{' '}
                  <Text style={styles.alertsBadge}>
                    ({unreadAlerts.length} unread)
                  </Text>
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowAlerts(!showAlerts)}>
                <Text style={styles.toggleText}>
                  {showAlerts ? 'Unread only' : 'View all'}
                </Text>
              </TouchableOpacity>
            </View>

            {alertsToDisplay.slice(0, 5).map((alert, idx) => (
              <Animated.View
                key={alert.id}
                entering={FadeInDown.delay(idx * 60).duration(300)}
              >
                <TouchableOpacity
                  style={[styles.alertCard, alert.read && styles.alertCardRead]}
                  onPress={() => handleAlertPress(alert.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.alertIcon}>
                    {getAlertIcon(alert.type)}
                  </View>
                  <View style={styles.alertContent}>
                    <Text
                      style={[
                        styles.alertCardTitle,
                        { color: getAlertColor(alert.type) },
                      ]}
                      numberOfLines={1}
                    >
                      {alert.title}
                    </Text>
                    <Text style={styles.alertCardDesc} numberOfLines={2}>
                      {alert.description}
                    </Text>
                  </View>
                  <ChevronRight size={16} color={Colors.textTertiary} />
                </TouchableOpacity>
              </Animated.View>
            ))}

            {alertsToDisplay.length > 5 && (
              <Text style={styles.moreAlerts}>
                +{alertsToDisplay.length - 5} more alerts
              </Text>
            )}
          </Animated.View>
        )}

        {/* Medicines List */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>My Medicines</Text>
            {medicines.length > 0 && (
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => router.push('/(tabs)/add')}
              >
                <Plus size={16} color={Colors.white} />
              </TouchableOpacity>
            )}
          </View>

          {medicines.length === 0 ? (
            <Animated.View
              entering={FadeIn.duration(500)}
              style={styles.emptyState}
            >
              <View style={styles.emptyIconWrap}>
                <Pill size={48} color={Colors.primary} />
              </View>
              <Text style={styles.emptyTitle}>No medicines yet</Text>
              <Text style={styles.emptyDesc}>
                Tap the + button below to add your first medicine, or scan a
                prescription label with your camera.
              </Text>
              <TouchableOpacity
                style={styles.emptyButton}
                onPress={() => router.push('/(tabs)/add')}
              >
                <Plus size={18} color={Colors.white} />
                <Text style={styles.emptyButtonText}>Add Medicine</Text>
              </TouchableOpacity>
            </Animated.View>
          ) : filteredMedicines.length === 0 ? (
            <View style={styles.noResults}>
              <Search size={32} color={Colors.textTertiary} />
              <Text style={styles.noResultsText}>
                No medicines match "{searchQuery}"
              </Text>
            </View>
          ) : (
            <Animated.View layout={Layout.springify()} style={styles.medicineList}>
              {filteredMedicines.map((medicine, idx) => (
                <Animated.View
                  key={medicine.id}
                  entering={FadeInDown.delay(idx * 80).duration(400)}
                >
                  <MedicineCard medicine={medicine} />
                </Animated.View>
              ))}
            </Animated.View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function getTimeOfDay() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { justifyContent: 'center', alignItems: 'center' },
  loadingText: {
    marginTop: Spacing.md,
    fontSize: FontSize.md,
    color: Colors.textTertiary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xxl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.md,
  },
  greeting: { fontSize: FontSize.sm, color: Colors.textTertiary, letterSpacing: 0.3 },
  title: { fontSize: 28, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.5 },
  bellButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadow.sm,
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: Colors.danger,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { color: Colors.white, fontSize: 10, fontWeight: '700' },
  // Search
  searchWrapper: { paddingHorizontal: Spacing.xxl, marginTop: Spacing.sm },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
    height: 48,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  searchInput: {
    flex: 1,
    marginLeft: Spacing.sm,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
  },
  // Stats
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.xxl,
    marginTop: Spacing.lg,
    gap: Spacing.sm,
  },
  statCard: {
    flex: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'center',
    gap: 6,
  },
  statNumber: { fontSize: 24, fontWeight: '800' },
  statLabel: { fontSize: FontSize.xs, color: Colors.textTertiary, fontWeight: '500' },
  // Alerts
  alertsSection: {
    marginHorizontal: Spacing.xxl,
    marginTop: Spacing.lg,
    backgroundColor: Colors.dangerLight,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.alertBorder,
  },
  alertsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  alertsTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  alertsTitleText: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.dangerDark,
  },
  alertsBadge: { fontSize: FontSize.sm, fontWeight: '500' },
  toggleText: {
    fontSize: FontSize.sm,
    color: Colors.dangerDark,
    fontWeight: '600',
  },
  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  alertCardRead: { opacity: 0.6 },
  alertIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.dangerLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.sm,
  },
  alertContent: { flex: 1 },
  alertCardTitle: { fontSize: FontSize.sm, fontWeight: '700' },
  alertCardDesc: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  moreAlerts: {
    textAlign: 'center',
    fontSize: FontSize.sm,
    color: Colors.dangerDark,
    marginTop: Spacing.xs,
    fontWeight: '600',
  },
  // Section
  sectionContainer: { paddingHorizontal: Spacing.xxl, marginTop: Spacing.xl },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  addButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  medicineList: { gap: Spacing.md },
  // Empty
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xxxxl,
    paddingHorizontal: Spacing.xl,
  },
  emptyIconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  emptyTitle: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  emptyDesc: {
    fontSize: FontSize.md,
    color: Colors.textTertiary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.xl,
  },
  emptyButton: {
    flexDirection: 'row',
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xxl,
    borderRadius: BorderRadius.xl,
    alignItems: 'center',
    gap: Spacing.sm,
    ...Shadow.md,
  },
  emptyButtonText: {
    color: Colors.white,
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  noResults: {
    alignItems: 'center',
    paddingVertical: Spacing.xxxxl,
    gap: Spacing.md,
  },
  noResultsText: {
    fontSize: FontSize.md,
    color: Colors.textTertiary,
    textAlign: 'center',
  },
});