import { supabase } from '../config/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

export type DoseStatus = 'taken' | 'missed';

export interface ScheduleLog {
  medicine_id: string;
  log_date: string;   // YYYY-MM-DD
  dose_time: string;  // HH:MM
  status: DoseStatus;
}

// ─── Write helpers ────────────────────────────────────────────────────────────

/**
 * Upsert a single dose log (taken or missed) to Supabase.
 * The unique constraint (user_id, medicine_id, log_date, dose_time) means
 * this is safe to call multiple times — it will just update the status.
 */
export async function upsertScheduleLog(
  uid: string,
  log: ScheduleLog
): Promise<void> {
  const { error } = await supabase
    .from('schedule_logs')
    .upsert(
      { ...log, user_id: uid, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,medicine_id,log_date,dose_time' }
    );
  if (error) console.warn('[scheduleLog] upsert error:', error.message);
}

/**
 * Delete a dose log (when user un-marks a taken/missed dose back to neutral).
 */
export async function deleteScheduleLog(
  uid: string,
  medicineId: string,
  logDate: string,
  doseTime: string
): Promise<void> {
  const { error } = await supabase
    .from('schedule_logs')
    .delete()
    .eq('user_id', uid)
    .eq('medicine_id', medicineId)
    .eq('log_date', logDate)
    .eq('dose_time', doseTime);
  if (error) console.warn('[scheduleLog] delete error:', error.message);
}

// ─── Read helpers ─────────────────────────────────────────────────────────────

/**
 * Fetch all logs for a user on a specific date.
 * Returns a map: `${medicineId}-${doseTime}` → DoseStatus
 */
export async function fetchScheduleLogsForDate(
  uid: string,
  logDate: string
): Promise<Record<string, DoseStatus>> {
  const { data, error } = await supabase
    .from('schedule_logs')
    .select('medicine_id, dose_time, status')
    .eq('user_id', uid)
    .eq('log_date', logDate);

  if (error) {
    console.warn('[scheduleLog] fetch error:', error.message);
    return {};
  }

  const map: Record<string, DoseStatus> = {};
  for (const row of data ?? []) {
    map[`${row.medicine_id}-${row.dose_time}`] = row.status as DoseStatus;
  }
  return map;
}
