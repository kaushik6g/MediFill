import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  X,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
} from 'lucide-react-native';
import Animated, { FadeInDown, FadeInRight, Layout } from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMedicineContext } from '../../context/MedicineContext';
import { sendInstantNotification } from '../../services/notificationService';
import {
  upsertScheduleLog,
  deleteScheduleLog,
  fetchScheduleLogsForDate,
} from '../../services/scheduleLogService';
import { supabase } from '../../config/supabase';
import { Colors, Spacing, FontSize, BorderRadius, Shadow } from '../../constants/theme';

interface ScheduleItem {
  id: string;
  time: string;
  medicines: { id: string; name: string; dosage: string; taken: boolean }[];
}

const getTakenStorageKey    = (date: Date) => `schedule_taken_${date.toISOString().split('T')[0]}`;
const getRejectedStorageKey = (date: Date) => `schedule_rejected_${date.toISOString().split('T')[0]}`;

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
  const [takenMap, setTakenMap]           = useState<Record<string, boolean>>({});
  const [rejectedAutoKeys, setRejectedAutoKeys] = useState<Set<string>>(new Set());
  const notifiedDaysRef = useRef<Set<string>>(new Set());

  const dateStr = selectedDate.toISOString().split('T')[0];
  const today = new Date();
  const weekDays = buildWeekDays(weekAnchor);

  // ── Taken status ──────────────────────────────────────────────────────────
  // Strategy: AsyncStorage = fast local cache, Supabase = source of truth.
  // On load: fetch Supabase data and merge on top of local cache.
  // On write: update AsyncStorage immediately + fire-and-forget Supabase.
  const loadTakenStatus = useCallback(async () => {
    // 1. Load local cache first for instant UI
    let takenLocal: Record<string, boolean> = {};
    let rejectedLocal: string[] = [];
    try {
      const t = await AsyncStorage.getItem(getTakenStorageKey(selectedDate));
      if (t) takenLocal = JSON.parse(t);
    } catch (_) {}
    try {
      const r = await AsyncStorage.getItem(getRejectedStorageKey(selectedDate));
      if (r) rejectedLocal = JSON.parse(r);
    } catch (_) {}
    setTakenMap(takenLocal);
    setRejectedAutoKeys(new Set(rejectedLocal));

    // 2. Fetch from Supabase and merge (cloud wins for conflicts)
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const cloudLogs = await fetchScheduleLogsForDate(user.id, dateStr);
      if (Object.keys(cloudLogs).length === 0) return;

      const mergedTaken = { ...takenLocal };
      const mergedRejected = new Set(rejectedLocal);

      for (const [key, status] of Object.entries(cloudLogs)) {
        // key format from service: `${medicine_id}-${dose_time}`
        // Full takenMap key: `${medicine_id}-${dose_time}-${dateStr}`
        const fullKey = `${key}-${dateStr}`;
        if (status === 'taken') {
          mergedTaken[fullKey] = true;
          mergedRejected.delete(fullKey);
        } else if (status === 'missed') {
          delete mergedTaken[fullKey];
          mergedRejected.add(fullKey);
        }
      }

      setTakenMap(mergedTaken);
      setRejectedAutoKeys(mergedRejected);
      // Persist merged result locally
      await AsyncStorage.setItem(getTakenStorageKey(selectedDate), JSON.stringify(mergedTaken));
      await AsyncStorage.setItem(getRejectedStorageKey(selectedDate), JSON.stringify([...mergedRejected]));
    } catch (_) {}
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

    // Use local YYYY-MM-DD strings for all comparisons — avoids UTC/timezone bugs
    const toLocalDate = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    const selectedStr   = toLocalDate(selectedDate);          // e.g. "2026-06-07"
    const todayStr      = toLocalDate(new Date());             // today in local time

    // Only include medicines that:
    //  1. Are not expired (expiry date >= today)
    //  2. Have stock remaining
    //  3. Were added on or before the selected date
    const activeMeds = medicines.filter(med => {
      const expiryStr = toLocalDate(new Date(med.expiryDate));
      if (expiryStr < todayStr || med.currentQuantity <= 0) return false;

      // Only show from the date the medicine was added onwards
      if (med.createdAt) {
        const addedStr = toLocalDate(new Date(med.createdAt));
        if (selectedStr < addedStr) return false;
      }
      return true;
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
  }, [medicines, takenMap, dateStr, selectedDate]);

  // ── Toggle taken ──────────────────────────────────────────────────────────
  // Tapping “Taken” marks any dose manually; tapping again on taken un-marks it.
  const toggleMedicineTaken = async (medicineId: string, time: string) => {
    const key           = `${medicineId}-${time}-${dateStr}`;
    const isManualTaken = !!takenMap[key];
    const med           = medicines.find(m => m.id === medicineId);
    const { data: { user } } = await supabase.auth.getUser();

    if (isManualTaken) {
      // Taken → not taken: restore stock, remove from DB
      const newMap = { ...takenMap, [key]: false };
      setTakenMap(newMap);
      await saveTakenStatus(newMap);
      if (user) await deleteScheduleLog(user.id, medicineId, dateStr, time);
      if (med) {
        await updateMedicine({ ...med, currentQuantity: Math.min(med.currentQuantity + 1, med.totalQuantity) });
      }
      return;
    }

    // Any “not taken” state (fresh, auto-recorded, or missed) → manually taken
    if (rejectedAutoKeys.has(key)) {
      const next = new Set(rejectedAutoKeys);
      next.delete(key);
      setRejectedAutoKeys(next);
      await AsyncStorage.setItem(getRejectedStorageKey(selectedDate), JSON.stringify([...next]));
    }
    const newMap = { ...takenMap, [key]: true };
    setTakenMap(newMap);
    await saveTakenStatus(newMap);
    if (user) await upsertScheduleLog(user.id, { medicine_id: medicineId, log_date: dateStr, dose_time: time, status: 'taken' });
    if (med && med.currentQuantity > 0) {
      await updateMedicine({ ...med, currentQuantity: med.currentQuantity - 1 });
    }
  };

  // “Missed” button on auto-recorded dose — user confirms they did NOT take it
  const markMedicineMissed = async (medicineId: string, time: string) => {
    const key = `${medicineId}-${time}-${dateStr}`;
    const next = new Set(rejectedAutoKeys);
    next.add(key);
    setRejectedAutoKeys(next);
    await AsyncStorage.setItem(getRejectedStorageKey(selectedDate), JSON.stringify([...next]));
    const { data: { user } } = await supabase.auth.getUser();
    if (user) await upsertScheduleLog(user.id, { medicine_id: medicineId, log_date: dateStr, dose_time: time, status: 'missed' });
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

  const isToday = isSameDay(selectedDate, today);

  // ── Auto-taken set: only for fully-ended past days ─────────────────────────
  const autoTakenSet = useMemo(() => {
    const keys = new Set<string>();
    if (isToday) return keys;   // never auto-record on the current day

    const toLocalDate = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const todayStr = toLocalDate(new Date());
    const selStr   = toLocalDate(selectedDate);
    if (selStr >= todayStr) return keys;  // future dates ignored

    medicines
      .filter(med => {
        if (med.createdAt) {
          const added = toLocalDate(new Date(med.createdAt));
          if (selStr < added) return false;
        }
        return true;
      })
      .forEach(med => {
        med.timeToTake?.forEach(time => {
          const [h, m] = time.split(':').map(Number);
          if (isNaN(h) || isNaN(m)) return;
          const key = `${med.id}-${time}-${dateStr}`;
          if (!takenMap[key]) keys.add(key);
        });
      });
    return keys;
  }, [medicines, isToday, selectedDate, dateStr, takenMap]);

  const hasAutoTaken = autoTakenSet.size > 0;

  // ── Fire one push notification per past-day when auto-recording kicks in ──
  useEffect(() => {
    if (autoTakenSet.size > 0 && !notifiedDaysRef.current.has(dateStr)) {
      notifiedDaysRef.current.add(dateStr);
      const label = selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      sendInstantNotification(
        'Unlogged Doses Detected',
        `${autoTakenSet.size} dose${autoTakenSet.size !== 1 ? 's' : ''} from ${label} were not updated. Open the Schedule to mark them as Taken or Missed.`
      );
    }
  }, [autoTakenSet.size, dateStr]);

  // ── Stats ─────────────────────────────────────────────────────────────────
  const totalDoses = schedule.reduce((a, s) => a + s.medicines.length, 0);
  // Only count doses the user explicitly marked as taken
  const takenDoses = schedule.reduce((a, s) => a + s.medicines.filter(m => m.taken).length, 0);
  const pct = totalDoses > 0 ? Math.round((takenDoses / totalDoses) * 100) : 0;
  const adherenceColor =
    pct === 100 ? Colors.success : pct >= 50 ? Colors.warning : Colors.danger;

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
                {item.medicines.map(med => {
                  const takenKey  = `${med.id}-${item.time}-${dateStr}`;
                  // isAutoTaken: past day, not logged, not yet rejected
                  const isAutoTaken = !med.taken && autoTakenSet.has(takenKey) && !rejectedAutoKeys.has(takenKey);
                  // isMissed: user explicitly tapped “Missed” (rejected)
                  const isMissed    = !med.taken && rejectedAutoKeys.has(takenKey);
                  return (
                    <Animated.View
                      key={`${med.id}-${item.time}`}
                      layout={Layout.springify()}
                      style={[
                        styles.medCard,
                        med.taken   && styles.medCardTaken,
                        isAutoTaken && styles.medCardAutoTaken,
                        isMissed    && styles.medCardMissed,
                      ]}
                    >
                      <View style={[
                        styles.medIcon,
                        med.taken   && styles.medIconTaken,
                        isAutoTaken && styles.medIconAutoTaken,
                        isMissed    && styles.medIconMissed,
                      ]}>
                        <Pill
                          size={18}
                          color={
                            med.taken   ? Colors.success :
                            isAutoTaken ? Colors.warning :
                            isMissed    ? Colors.danger :
                            Colors.primary
                          }
                        />
                      </View>
                      <View style={styles.medInfo}>
                        <Text
                          style={[styles.medName, (med.taken || isMissed) && styles.medNameTaken]}
                          numberOfLines={1}
                        >
                          {med.name}
                        </Text>
                        <Text style={styles.medDosage}>{med.dosage}</Text>
                        {isAutoTaken && (
                          <Text style={styles.autoTakenBadge}>⚡ Auto-recorded — not updated</Text>
                        )}
                        {isMissed && (
                          <Text style={styles.missedBadge}>✕ Marked as missed</Text>
                        )}
                      </View>

                      {/* Action buttons */}
                      {isAutoTaken ? (
                        // Two-choice row for auto-recorded doses
                        <View style={styles.autoBtnRow}>
                          <TouchableOpacity
                            style={styles.autoTakenBtn}
                            onPress={() => toggleMedicineTaken(med.id, item.time)}
                            activeOpacity={0.8}
                          >
                            <Check size={12} color={Colors.white} />
                            <Text style={styles.autoBtnText}>Taken</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.autoMissedBtn}
                            onPress={() => markMedicineMissed(med.id, item.time)}
                            activeOpacity={0.8}
                          >
                            <X size={12} color={Colors.white} />
                            <Text style={styles.autoBtnText}>Missed</Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <TouchableOpacity
                          style={[
                            styles.takeBtn,
                            med.taken  && styles.takeBtnDone,
                            isMissed   && styles.takeBtnMissed,
                          ]}
                          onPress={() => toggleMedicineTaken(med.id, item.time)}
                          activeOpacity={0.75}
                        >
                          {med.taken ? (
                            <>
                              <Check size={14} color={Colors.white} />
                              <Text style={styles.takeBtnText}>Taken</Text>
                            </>
                          ) : isMissed ? (
                            <>
                              <X size={14} color={Colors.white} />
                              <Text style={styles.takeBtnText}>Missed</Text>
                            </>
                          ) : (
                            <Text style={[styles.takeBtnText, { color: Colors.primary }]}>Take</Text>
                          )}
                        </TouchableOpacity>
                      )}
                    </Animated.View>
                  );
                })}
              </View>
            </Animated.View>
          ))
        )}
        {/* ── Auto-taken disclaimer ── */}
        {hasAutoTaken && (
          <Animated.View
            entering={FadeInDown.delay(300).duration(400)}
            style={styles.autoTakenNote}
          >
            <View style={styles.autoTakenNoteIcon}>
              <Clock size={14} color={Colors.warning} />
            </View>
            <Text style={styles.autoTakenNoteText}>
              <Text style={styles.autoTakenNoteBold}>Heads up — </Text>
              {autoTakenSet.size} dose{autoTakenSet.size !== 1 ? 's' : ''} from this day
              {autoTakenSet.size !== 1 ? ' were' : ' was'} not updated before the day ended.
              Please mark {autoTakenSet.size !== 1 ? 'them' : 'it'} as{' '}
              <Text style={styles.autoTakenNoteBold}>Taken</Text>{' '}or{' '}
              <Text style={styles.autoTakenNoteBold}>Missed</Text>{' '}
              to keep your records accurate.
            </Text>
          </Animated.View>
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
  medCardAutoTaken: {
    backgroundColor: '#FFF8E7',
    borderColor: Colors.warning,
  },
  medIconAutoTaken: { backgroundColor: '#FFF8E7' },
  autoTakenBadge: {
    fontSize: 10,
    color: Colors.warning,
    fontWeight: '700',
    marginTop: 3,
    letterSpacing: 0.2,
  },
  // Missed state card
  medCardMissed: {
    backgroundColor: '#FFF1F0',
    borderColor: Colors.danger,
    opacity: 0.85,
  },
  medIconMissed: { backgroundColor: '#FFF1F0' },
  missedBadge: {
    fontSize: 10,
    color: Colors.danger,
    fontWeight: '700',
    marginTop: 3,
    letterSpacing: 0.2,
  },
  // Two-button row for auto-recorded doses
  autoBtnRow: {
    flexDirection: 'column',
    gap: 5,
    flexShrink: 0,
  },
  autoTakenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 5,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.success,
  },
  autoMissedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 5,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.danger,
  },
  autoBtnText: { fontSize: 10, fontWeight: '700', color: Colors.white },
  takeBtnMissed: { backgroundColor: Colors.danger },
  autoTakenNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFF8E7',
    borderRadius: 14,
    padding: Spacing.md,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.warning,
    gap: Spacing.sm,
  },
  autoTakenNoteIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: Colors.warningLight,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
    marginTop: 1,
  },
  autoTakenNoteText: {
    flex: 1,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  autoTakenNoteBold: {
    fontWeight: '700',
    color: Colors.warning,
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