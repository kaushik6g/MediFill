import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

interface ScheduleMedicineRemindersInput {
  medicineId: string;
  medicineName: string;
  dosage: string;
  times: string[];
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function parseTime(time: string): { hour: number; minute: number } | null {
  const [hourStr, minuteStr] = time.split(':');
  const hour = Number(hourStr);
  const minute = Number(minuteStr);

  if (!Number.isInteger(hour) || !Number.isInteger(minute)) {
    return null;
  }

  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }

  return { hour, minute };
}

export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') {
    return false;
  }

  const current = await Notifications.getPermissionsAsync();
  if (current.granted || current.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) {
    return true;
  }

  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted || requested.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
}

export async function scheduleMedicineReminders(input: ScheduleMedicineRemindersInput): Promise<void> {
  const hasPermission = await requestNotificationPermissions();
  if (!hasPermission || Platform.OS === 'web') {
    return;
  }

  for (const time of input.times) {
    const parsed = parseTime(time);
    if (!parsed) {
      continue;
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Medicine Reminder',
        body: `Time to take ${input.medicineName} (${input.dosage})`,
        data: {
          medicineId: input.medicineId,
          reminderTime: time,
        },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: parsed.hour,
        minute: parsed.minute,
      },
    });
  }
}

export async function cancelMedicineReminders(medicineId: string, times: string[]): Promise<void> {
  if (Platform.OS === 'web') {
    return;
  }

  const scheduled = await Notifications.getAllScheduledNotificationsAsync();

  for (const notification of scheduled) {
    const data = notification.content.data as Record<string, unknown>;
    const isSameMedicine = data?.medicineId === medicineId;
    const reminderTime = typeof data?.reminderTime === 'string' ? data.reminderTime : null;

    if (isSameMedicine && reminderTime && times.includes(reminderTime)) {
      await Notifications.cancelScheduledNotificationAsync(notification.identifier);
    }
  }
}

export async function sendInstantNotification(title: string, body: string): Promise<void> {
  const hasPermission = await requestNotificationPermissions();
  if (!hasPermission || Platform.OS === 'web') {
    return;
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
    },
    trigger: null,
  });
}
