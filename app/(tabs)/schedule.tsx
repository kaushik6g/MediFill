import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Clock,
  Pill,
  Check,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
} from 'lucide-react-native';
import Animated, { FadeInDown, FadeInRight, Layout } from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMedicineContext } from '../../context/MedicineContext';
import { Colors, Spacing, FontSize, BorderRadius, Shadow } from '../../constants/theme';

interface ScheduleItem {
  id: string;
  time: string;
  medicines: { id: string; name: string; dosage: string; taken: boolean }[];
}

const getTakenStorageKey = (date: Date) =>
  `schedule_taken_${date.toISOString().split('T')[0]}`;

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// Build an array of 7 dates centred on today
function buildWeekDays(anchor: Date): Date[] {
  const days: Date[] = [];
  for (let i = -3; i <= 3; i++) {
    const d = new Date(anchor);
    d.setDate(d.getDate() + i);
    days.push(d);
  }
  return days;
}

function isSameDay(a: Date, b: Date) {
  return a.toISOString().split('T')[0] === b.toISOString().split('T')[0];
}

export default function ScheduleScreen() {
  const { medicines, updateMedicine, activeUser } = useMedicineContext();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [weekAnchor, setWeekAnchor] = useState(new Date());
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [takenMap, setTakenMap] = useState<Record<string, boolean>>({});

  const dateStr = selectedDate.toISOString().split('T')[0];
  const today = new Date();
  const weekDays = buildWeekDays(weekAnchor);

  // ── Taken status ──────────────────────────────────────────────────────────
  const loadTakenStatus = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(getTakenStorageKey(selectedDate));
      setTakenMap(stored ? JSON.parse(stored) : {});
    } catch (_) { setTakenMap({}); }
  }, [dateStr]);

  const saveTakenStatus = async (map: Record<string, boolean>) => {
    try {
      await AsyncStorage.setItem(getTakenStorageKey(selectedDate), JSON.stringify(map));
    } catch (_) {}
  };

  useEffect(() => { loadTakenStatus(); }, [loadTakenStatus]);

  // ── Build schedule ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!medicines.length) { setSchedule([]); return; }

    // Only include medicines that are NOT expired and have stock remaining
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const activeMeds = medicines.filter(med => {
      const expiry = new Date(med.expiryDate);
      expiry.setHours(0, 0, 0, 0);
      return expiry >= today && med.currentQuantity > 0;
    });

    if (!activeMeds.length) { setSchedule([]); return; }

    const timeMap = new Map<string, ScheduleItem>();
    activeMeds.forEach(med => {
      med.timeToTake?.forEach(time => {
        if (!timeMap.has(time)) timeMap.set(time, { id: `time-${time}`, time, medicines: [] });
        const takenKey = `${med.id}-${time}-${dateStr}`;
        timeMap.get(time)!.medicines.push({
          id: med.id, name: med.name, dosage: med.dosage,
          taken: takenMap[takenKey] || false,
        });
      });
    });
    const sorted = Array.from(timeMap.values()).sort((a, b) => {
      const [ah, am] = a.time.split(':').map(Number);
      const [bh, bm] = b.time.split(':').map(Number);
      return ah !== bh ? ah - bh : am - bm;
    });
    setSchedule(sorted);
  }, [medicines, takenMap, dateStr]);

  // ── Toggle taken ──────────────────────────────────────────────────────────
  const toggleMedicineTaken = async (medicineId: string, time: string) => {
    const key = `${medicineId}-${time}-${dateStr}`;
    const newMap = { ...takenMap, [key]: !takenMap[key] };
    setTakenMap(newMap);
    await saveTakenStatus(newMap);
    if (!takenMap[key]) {
      const med = medicines.find(m => m.id === medicineId);
      if (med && med.currentQuantity > 0) {
        await updateMedicine({ ...med, currentQuantity: med.currentQuantity - 1 });
      }
    }
  };

  // ── Navigation ────────────────────────────────────────────────────────────
  const shiftWeek = (dir: -1 | 1) => {
    const d = new Date(weekAnchor);
    d.setDate(d.getDate() + dir * 7);
    setWeekAnchor(d);
  };

  const selectDay = (date: Date) => setSelectedDate(new Date(date));

  const formatTime = (time: string) => {
    if (!time || !time.includes(':')) return '--:--';
    const [h, m] = time.split(':').map(Number);
    if (isNaN(h) || isNaN(m)) return '--:--';
    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
  };

  // ── Stats ─────────────────────────────────────────────────────────────────
  const totalDoses = schedule.reduce((a, s) => a + s.medicines.length, 0);
  const takenDoses = schedule.reduce((a, s) => a + s.medicines.filter(m => m.taken).length, 0);
  const pct = totalDoses > 0 ? Math.round((takenDoses / totalDoses) * 100) : 0;
  const adherenceColor =
    pct === 100 ? Colors.success : pct >= 50 ? Colors.warning : Colors.danger;

  const isToday = isSameDay(selectedDate, today);

  return (
    <SafeAreaView style={styles.container}>

      {/* ── Header ── */}
      <Animated.View entering={FadeInDown.duration(300)} style={styles.header}>
        <View>
          <Text style={styles.title}>Schedule</Text>
          {activeUser && (
            <Text style={styles.subtitle}>for {activeUser.name}</Text>
          )}
        </View>
        {totalDoses > 0 && (
          <View style={styles.pctBadge}>
            <Text style={[styles.pctBadgeNum, { color: adherenceColor }]}>{pct}%</Text>
            <Text style={styles.pctBadgeLabel}>done</Text>
          </View>
        )}
      </Animated.View>

      {/* ── 7-day strip ── */}
      <Animated.View entering={FadeInDown.delay(80).duration(300)} style={styles.weekStrip}>
        <TouchableOpacity style={styles.weekArrow} onPress={() => shiftWeek(-1)}>
          <ChevronLeft size={18} color={Colors.primary} />
        </TouchableOpacity>

        <View style={styles.weekDays}>
          {weekDays.map((d, i) => {
            const sel = isSameDay(d, selectedDate);
            const tod = isSameDay(d, today);
            return (
              <TouchableOpacity
                key={i}
                style={[styles.dayCell, sel && styles.dayCellActive]}
                onPress={() => selectDay(d)}
              >
                <Text style={[styles.dayLabel, sel && styles.dayLabelActive]}>
                  {DAY_LABELS[d.getDay()]}
                </Text>
                <Text style={[styles.dayNum, sel && styles.dayNumActive]}>
                  {d.getDate()}
                </Text>
                {tod && <View style={[styles.todayDot, sel && styles.todayDotActive]} />}
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity style={styles.weekArrow} onPress={() => shiftWeek(1)}>
          <ChevronRight size={18} color={Colors.primary} />
        </TouchableOpacity>
      </Animated.View>

      {/* ── Date label + adherence bar ── */}
      {totalDoses > 0 && (
        <Animated.View entering={FadeInDown.delay(140).duration(300)} style={styles.adherenceCard}>
          <View style={styles.adherenceRow}>
            <Text style={styles.adherenceTitle}>
              {isToday ? "Today's" : selectedDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) + "'s"} adherence
            </Text>
            <Text style={[styles.adherenceValue, { color: adherenceColor }]}>
              {takenDoses}/{totalDoses} doses
            </Text>
          </View>
          <View style={styles.adherenceTrack}>
            <View style={[styles.adherenceFill, { width: `${pct}%` as any, backgroundColor: adherenceColor }]} />
          </View>
        </Animated.View>
      )}

      {/* ── Timeline ── */}
      <ScrollView
        style={styles.timeline}
        contentContainerStyle={styles.timelineContent}
        showsVerticalScrollIndicator={false}
      >
        {schedule.length === 0 ? (
          <Animated.View entering={FadeInDown.delay(200).duration(400)} style={styles.emptyState}>
            <View style={styles.emptyIconWrap}>
              <CalendarDays size={44} color={Colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>Nothing scheduled</Text>
            <Text style={styles.emptyDesc}>
              Add medicines with reminder times and they'll appear here.
            </Text>
          </Animated.View>
        ) : (
          schedule.map((item, idx) => (
            <Animated.View
              key={item.id}
              entering={FadeInRight.delay(idx * 70).duration(380)}
              layout={Layout.springify()}
              style={styles.timeBlock}
            >
              {/* Time label */}
              <View style={styles.timeLabelRow}>
                <View style={styles.timeDot} />
                <View style={styles.timePill}>
                  <Clock size={12} color={Colors.primary} />
                  <Text style={styles.timeText}>{formatTime(item.time)}</Text>
                </View>
                <View style={styles.timeLine} />
              </View>

              {/* Medicine cards */}
              <View style={styles.medCards}>
                {item.medicines.map(med => (
                  <Animated.View
                    key={`${med.id}-${item.time}`}
                    layout={Layout.springify()}
                    style={[styles.medCard, med.taken && styles.medCardTaken]}
                  >
                    <View style={[styles.medIcon, med.taken && styles.medIconTaken]}>
                      <Pill size={18} color={med.taken ? Colors.success : Colors.primary} />
                    </View>
                    <View style={styles.medInfo}>
                      <Text style={[styles.medName, med.taken && styles.medNameTaken]} numberOfLines={1}>
                        {med.name}
                      </Text>
                      <Text style={styles.medDosage}>{med.dosage}</Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.takeBtn, med.taken && styles.takeBtnDone]}
                      onPress={() => toggleMedicineTaken(med.id, item.time)}
                      activeOpacity={0.75}
                    >
                      {med.taken ? (
                        <>
                          <Check size={14} color={Colors.white} />
                          <Text style={styles.takeBtnText}>Taken</Text>
                        </>
                      ) : (
                        <Text style={[styles.takeBtnText, { color: Colors.primary }]}>Take</Text>
                      )}
                    </TouchableOpacity>
                  </Animated.View>
                ))}
              </View>
            </Animated.View>
          ))
        )}
        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F7F6' },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: Spacing.xxl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.sm,
  },
  title: { fontSize: 28, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.5 },
  subtitle: { fontSize: FontSize.sm, color: Colors.textTertiary, marginTop: 2 },
  pctBadge: {
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 14,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    ...Shadow.sm,
  },
  pctBadgeNum: { fontSize: FontSize.xl, fontWeight: '800' },
  pctBadgeLabel: { fontSize: FontSize.xs, color: Colors.textTertiary, fontWeight: '500' },

  // 7-day strip
  weekStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.lg,
    marginVertical: Spacing.md,
    backgroundColor: Colors.white,
    borderRadius: 18,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    ...Shadow.sm,
  },
  weekArrow: {
    width: 32, height: 32, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: Colors.primaryLight,
  },
  weekDays: { flex: 1, flexDirection: 'row', justifyContent: 'space-around' },
  dayCell: {
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderRadius: 12,
    gap: 3,
    minWidth: 34,
  },
  dayCellActive: { backgroundColor: Colors.primary },
  dayLabel: { fontSize: 10, fontWeight: '600', color: Colors.textTertiary },
  dayLabelActive: { color: 'rgba(255,255,255,0.8)' },
  dayNum: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary },
  dayNumActive: { color: Colors.white },
  todayDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: Colors.primary },
  todayDotActive: { backgroundColor: 'rgba(255,255,255,0.7)' },

  // Adherence card
  adherenceCard: {
    marginHorizontal: Spacing.xxl,
    marginBottom: Spacing.md,
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: Spacing.lg,
    ...Shadow.sm,
  },
  adherenceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  adherenceTitle: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textSecondary },
  adherenceValue: { fontSize: FontSize.sm, fontWeight: '800' },
  adherenceTrack: { height: 8, backgroundColor: Colors.borderLight, borderRadius: 4, overflow: 'hidden' },
  adherenceFill: { height: 8, borderRadius: 4 },

  // Timeline
  timeline: { flex: 1 },
  timelineContent: { paddingHorizontal: Spacing.xxl, paddingTop: Spacing.sm },

  timeBlock: { marginBottom: Spacing.xl },
  timeLabelRow: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.sm },
  timeDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primary, marginRight: Spacing.sm },
  timePill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.primaryLight,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 5,
  },
  timeText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.primary },
  timeLine: { flex: 1, height: 1, backgroundColor: Colors.borderLight, marginLeft: Spacing.sm },

  medCards: {
    marginLeft: 5,
    borderLeftWidth: 2,
    borderLeftColor: Colors.borderLight,
    paddingLeft: Spacing.lg,
    gap: Spacing.sm,
  },
  medCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: Spacing.md,
    ...Shadow.sm,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  medCardTaken: {
    backgroundColor: Colors.successLight,
    borderColor: Colors.success,
  },
  medIcon: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center', alignItems: 'center',
    marginRight: Spacing.md,
  },
  medIconTaken: { backgroundColor: Colors.successLight },
  medInfo: { flex: 1 },
  medName: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary },
  medNameTaken: { textDecorationLine: 'line-through', color: Colors.textTertiary },
  medDosage: { fontSize: FontSize.xs, color: Colors.textTertiary, marginTop: 2 },
  takeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primaryLight,
  },
  takeBtnDone: { backgroundColor: Colors.success },
  takeBtnText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.white },

  // Empty
  emptyState: { alignItems: 'center', paddingTop: 80, paddingHorizontal: Spacing.xl },
  emptyIconWrap: {
    width: 88, height: 88, borderRadius: 28,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  emptyTitle: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.textPrimary, marginBottom: Spacing.sm },
  emptyDesc: { fontSize: FontSize.sm, color: Colors.textTertiary, textAlign: 'center', lineHeight: 22 },
});