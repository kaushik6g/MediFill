import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Calendar as CalendarIcon, Clock, Pill, Check, X, ChevronLeft, ChevronRight } from 'lucide-react-native';
import Animated, { FadeInDown, FadeInRight, Layout } from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMedicineContext } from '../../context/MedicineContext';
import { Colors, Spacing, FontSize, BorderRadius, Shadow } from '../../constants/theme';

interface ScheduleItem {
  id: string;
  time: string;
  medicines: {
    id: string;
    name: string;
    dosage: string;
    taken: boolean;
  }[];
}

// Key for storing taken status
const getTakenStorageKey = (date: Date) => {
  return `schedule_taken_${date.toISOString().split('T')[0]}`;
};

export default function ScheduleScreen() {
  const { medicines, updateMedicine, activeUser } = useMedicineContext();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [takenMap, setTakenMap] = useState<Record<string, boolean>>({});

  const dateStr = selectedDate.toISOString().split('T')[0];

  // Load taken status from storage
  const loadTakenStatus = useCallback(async () => {
    try {
      const key = getTakenStorageKey(selectedDate);
      const stored = await AsyncStorage.getItem(key);
      if (stored) {
        setTakenMap(JSON.parse(stored));
      } else {
        setTakenMap({});
      }
    } catch (error) {
      console.error('Error loading taken status:', error);
    }
  }, [dateStr]);

  // Save taken status to storage
  const saveTakenStatus = async (newMap: Record<string, boolean>) => {
    try {
      const key = getTakenStorageKey(selectedDate);
      await AsyncStorage.setItem(key, JSON.stringify(newMap));
    } catch (error) {
      console.error('Error saving taken status:', error);
    }
  };

  useEffect(() => {
    loadTakenStatus();
  }, [loadTakenStatus]);

  // Generate schedule based on medicines and their times
  useEffect(() => {
    if (medicines.length === 0) {
      setSchedule([]);
      return;
    }

    const timeMap = new Map<string, ScheduleItem>();

    medicines.forEach((medicine) => {
      if (medicine.timeToTake && medicine.timeToTake.length > 0) {
        medicine.timeToTake.forEach((time) => {
          if (!timeMap.has(time)) {
            timeMap.set(time, {
              id: `time-${time}`,
              time,
              medicines: [],
            });
          }
          const takenKey = `${medicine.id}-${time}-${dateStr}`;
          timeMap.get(time)!.medicines.push({
            id: medicine.id,
            name: medicine.name,
            dosage: medicine.dosage,
            taken: takenMap[takenKey] || false,
          });
        });
      }
    });

    const items = Array.from(timeMap.values()).sort((a, b) => {
      const [ah, am] = a.time.split(':').map(Number);
      const [bh, bm] = b.time.split(':').map(Number);
      return ah !== bh ? ah - bh : am - bm;
    });

    setSchedule(items);
  }, [medicines, takenMap, dateStr]);

  // Toggle medicine taken
  const toggleMedicineTaken = async (medicineId: string, time: string) => {
    const takenKey = `${medicineId}-${time}-${dateStr}`;
    const newMap = { ...takenMap, [takenKey]: !takenMap[takenKey] };
    setTakenMap(newMap);
    await saveTakenStatus(newMap);

    // If marking as taken, decrement current quantity
    if (!takenMap[takenKey]) {
      const medicine = medicines.find((m) => m.id === medicineId);
      if (medicine && medicine.currentQuantity > 0) {
        await updateMedicine({
          ...medicine,
          currentQuantity: medicine.currentQuantity - 1,
        });
      }
    }
  };

  const formatDate = (date: Date) =>
    date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });

  const goToPreviousDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    setSelectedDate(d);
  };

  const goToNextDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    setSelectedDate(d);
  };

  const goToToday = () => setSelectedDate(new Date());

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  const isToday =
    selectedDate.toISOString().split('T')[0] ===
    new Date().toISOString().split('T')[0];

  // Calculate adherence for the day
  const totalDoses = schedule.reduce((acc, s) => acc + s.medicines.length, 0);
  const takenDoses = schedule.reduce(
    (acc, s) => acc + s.medicines.filter((m) => m.taken).length,
    0
  );
  const adherencePercent = totalDoses > 0 ? Math.round((takenDoses / totalDoses) * 100) : 0;

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View entering={FadeInDown.duration(300)} style={styles.header}>
        <Text style={styles.title}>Schedule</Text>
        {activeUser && (
          <Text style={styles.subtitle}>for {activeUser.name}</Text>
        )}
      </Animated.View>

      {/* Date Navigation */}
      <View style={styles.dateNavigation}>
        <TouchableOpacity onPress={goToPreviousDay} style={styles.dateNavButton}>
          <ChevronLeft size={20} color={Colors.primary} />
        </TouchableOpacity>

        <TouchableOpacity onPress={goToToday} style={styles.dateContainer}>
          <CalendarIcon size={18} color={Colors.primary} />
          <Text style={styles.dateText}>{formatDate(selectedDate)}</Text>
          {isToday && <View style={styles.todayDot} />}
        </TouchableOpacity>

        <TouchableOpacity onPress={goToNextDay} style={styles.dateNavButton}>
          <ChevronRight size={20} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Adherence Bar */}
      {totalDoses > 0 && (
        <Animated.View entering={FadeInDown.delay(100).duration(300)} style={styles.adherenceContainer}>
          <View style={styles.adherenceHeader}>
            <Text style={styles.adherenceLabel}>Today's Adherence</Text>
            <Text style={styles.adherenceValue}>
              {takenDoses}/{totalDoses} doses ({adherencePercent}%)
            </Text>
          </View>
          <View style={styles.adherenceBarBg}>
            <Animated.View
              style={[
                styles.adherenceBarFill,
                {
                  width: `${adherencePercent}%`,
                  backgroundColor:
                    adherencePercent === 100
                      ? Colors.success
                      : adherencePercent >= 50
                      ? Colors.warning
                      : Colors.danger,
                },
              ]}
            />
          </View>
        </Animated.View>
      )}

      {/* Schedule Timeline */}
      <ScrollView style={styles.scheduleContainer} showsVerticalScrollIndicator={false}>
        {schedule.length === 0 ? (
          <View style={styles.emptyState}>
            <CalendarIcon size={48} color={Colors.textMuted} />
            <Text style={styles.emptyStateTitle}>No medicines scheduled</Text>
            <Text style={styles.emptyStateDescription}>
              Add medicines with scheduled times to see them here
            </Text>
          </View>
        ) : (
          schedule.map((scheduleItem, idx) => (
            <Animated.View
              key={scheduleItem.id}
              entering={FadeInRight.delay(idx * 80).duration(400)}
              layout={Layout.springify()}
              style={styles.timeBlock}
            >
              <View style={styles.timeIndicator}>
                <View style={styles.timeIconContainer}>
                  <Clock size={18} color={Colors.primary} />
                </View>
                <Text style={styles.timeText}>{formatTime(scheduleItem.time)}</Text>
              </View>

              <View style={styles.medicineCards}>
                {scheduleItem.medicines.map((medicine) => (
                  <Animated.View
                    key={`${medicine.id}-${scheduleItem.time}`}
                    layout={Layout.springify()}
                    style={[
                      styles.medicineCard,
                      medicine.taken && styles.medicineCardTaken,
                    ]}
                  >
                    <View style={styles.medicineInfo}>
                      <View
                        style={[
                          styles.medicineIconContainer,
                          medicine.taken && styles.medicineIconTaken,
                        ]}
                      >
                        <Pill
                          size={18}
                          color={medicine.taken ? Colors.success : Colors.primary}
                        />
                      </View>
                      <View>
                        <Text
                          style={[
                            styles.medicineName,
                            medicine.taken && styles.medicineNameTaken,
                          ]}
                        >
                          {medicine.name}
                        </Text>
                        <Text style={styles.medicineDosage}>{medicine.dosage}</Text>
                      </View>
                    </View>

                    <TouchableOpacity
                      style={[
                        styles.statusButton,
                        medicine.taken
                          ? styles.takenButton
                          : styles.notTakenButton,
                      ]}
                      onPress={() =>
                        toggleMedicineTaken(medicine.id, scheduleItem.time)
                      }
                    >
                      {medicine.taken ? (
                        <>
                          <Check size={16} color="white" />
                          <Text style={styles.takenButtonText}>Taken</Text>
                        </>
                      ) : (
                        <>
                          <Text style={styles.notTakenButtonText}>Take</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </Animated.View>
                ))}
              </View>
            </Animated.View>
          ))
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: Spacing.xxl, paddingTop: Spacing.xl, paddingBottom: Spacing.sm },
  title: { fontSize: 28, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.5 },
  subtitle: { fontSize: FontSize.sm, color: Colors.textTertiary, marginTop: Spacing.xs },
  dateNavigation: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.xxl, marginVertical: Spacing.lg,
  },
  dateNavButton: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primaryLight,
    justifyContent: 'center', alignItems: 'center',
  },
  dateContainer: { flexDirection: 'row', alignItems: 'center' },
  dateText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textPrimary, marginLeft: Spacing.sm },
  todayDot: {
    width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.primary, marginLeft: Spacing.sm,
  },
  adherenceContainer: {
    marginHorizontal: Spacing.xxl, marginBottom: Spacing.lg,
    backgroundColor: Colors.white, borderRadius: BorderRadius.xl, padding: Spacing.lg, ...Shadow.sm,
  },
  adherenceHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  adherenceLabel: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textSecondary },
  adherenceValue: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.primary },
  adherenceBarBg: { height: 8, backgroundColor: Colors.borderLight, borderRadius: 4, overflow: 'hidden' },
  adherenceBarFill: { height: '100%', borderRadius: 4 },
  scheduleContainer: { flex: 1, paddingHorizontal: Spacing.xxl },
  emptyState: { alignItems: 'center', justifyContent: 'center', padding: Spacing.xxxxl, marginTop: Spacing.xxxxl },
  emptyStateTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textSecondary, marginTop: Spacing.lg, marginBottom: Spacing.sm },
  emptyStateDescription: { fontSize: FontSize.sm, color: Colors.textTertiary, textAlign: 'center' },
  timeBlock: { marginBottom: Spacing.xl },
  timeIndicator: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.sm },
  timeIconContainer: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.primaryLight,
    justifyContent: 'center', alignItems: 'center', marginRight: Spacing.sm,
  },
  timeText: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary },
  medicineCards: {
    marginLeft: 18, borderLeftWidth: 2, borderLeftColor: Colors.border, paddingLeft: Spacing.xxl,
  },
  medicineCard: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: Colors.white, borderRadius: BorderRadius.xl, padding: Spacing.lg,
    marginBottom: Spacing.sm, ...Shadow.sm,
  },
  medicineCardTaken: { backgroundColor: Colors.successLight, borderWidth: 1, borderColor: Colors.success },
  medicineInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  medicineIconContainer: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.primaryLight,
    justifyContent: 'center', alignItems: 'center', marginRight: Spacing.md,
  },
  medicineIconTaken: { backgroundColor: Colors.successLight },
  medicineName: { fontSize: FontSize.md, fontWeight: '600', color: Colors.textPrimary },
  medicineNameTaken: { textDecorationLine: 'line-through', color: Colors.textTertiary },
  medicineDosage: { fontSize: FontSize.sm, color: Colors.textTertiary },
  statusButton: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md, borderRadius: BorderRadius.md,
  },
  takenButton: { backgroundColor: Colors.success },
  notTakenButton: { backgroundColor: Colors.primaryLight },
  takenButtonText: { color: 'white', fontWeight: '600', marginLeft: Spacing.xs, fontSize: FontSize.sm },
  notTakenButtonText: { color: Colors.primary, fontWeight: '600', fontSize: FontSize.sm },
});