/**
 * Notification Service — Local push notifications via expo-notifications.
 *
 * Schedules daily reminders for each medicine at its configured times.
 * Works in Expo Go on both iOS and Android.
 */

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

// ── Configure how notifications appear when the app is in the foreground ──
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// ── Permission ───────────────────────────────────────────────────────────────

export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') return false;

  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

// ── Schedule / Cancel ────────────────────────────────────────────────────────

export interface MedicineReminder {
  medicineId: string;
  medicineName: string;
  dosage: string;
  times: string[]; // ['08:00', '20:00']
}

/**
 * Schedule daily repeating notifications for a medicine.
 * Each time slot gets its own notification identifier so they can
 * be individually cancelled later.
 */
export async function scheduleMedicineReminders(reminder: MedicineReminder) {
  if (Platform.OS === 'web') return;

  const hasPermission = await requestNotificationPermissions();
  if (!hasPermission) return;

  for (const time of reminder.times) {
    const [hours, minutes] = time.split(':').map(Number);
    const identifier = `med-${reminder.medicineId}-${time}`;

    // Cancel any existing notification with this id first
    await Notifications.cancelScheduledNotificationAsync(identifier).catch(() => {});

    await Notifications.scheduleNotificationAsync({
      identifier,
      content: {
        title: '💊 Time for your medicine',
        body: `Take ${reminder.medicineName} (${reminder.dosage})`,
        data: { medicineId: reminder.medicineId },
        sound: 'default',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: hours,
        minute: minutes,
      },
    });
  }
}

/**
 * Cancel all reminders for a specific medicine.
 */
export async function cancelMedicineReminders(medicineId: string, times: string[]) {
  if (Platform.OS === 'web') return;

  for (const time of times) {
    const identifier = `med-${medicineId}-${time}`;
    await Notifications.cancelScheduledNotificationAsync(identifier).catch(() => {});
  }
}

/**
 * Cancel every scheduled notification (e.g. on sign-out).
 */
export async function cancelAllReminders() {
  if (Platform.OS === 'web') return;
  await Notifications.cancelAllScheduledNotificationsAsync();
}

/**
 * Fire an immediate local notification (e.g. for low-stock or expiry warnings).
 */
export async function sendInstantNotification(title: string, body: string) {
  if (Platform.OS === 'web') return;

  const hasPermission = await requestNotificationPermissions();
  if (!hasPermission) return;

  await Notifications.scheduleNotificationAsync({
    content: { title, body, sound: 'default' },
    trigger: null, // fires immediately
  });
}
