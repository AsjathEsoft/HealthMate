// Helper functions for scheduling local reminder notifications with Expo Notifications

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

const REMINDER_CHANNEL_ID = 'healthmate-reminders';

// Show notification banners even while the app is open
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Set up the Android notification channel (needed on Android 8.0 and above)
async function setupNotificationChannel(): Promise<void> {
  if (Platform.OS === 'android') {
    try {
      await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL_ID, {
        name: 'HealthMate Reminders',
        description: 'Scheduled reminders for hydration and daily activity tracking',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#0284c7',
      });
    } catch {
      // Ignore if notification channel setup is unavailable in current environment
    }
  }
}

// Check whether notification permission is allowed, denied, or not requested yet
export async function getNotificationPermissionStatus(): Promise<'granted' | 'denied' | 'undetermined'> {
  try {
    const settings = await Notifications.getPermissionsAsync();
    if (
      settings.granted ||
      settings.status === 'granted' ||
      (settings.android && settings.android.importance > 0)
    ) {
      return 'granted';
    }
    if (settings.status === Notifications.PermissionStatus.DENIED) {
      return 'denied';
    }
    return 'undetermined';
  } catch {
    return 'undetermined';
  }
}

// Ask the user for permission to show notifications
export async function requestNotificationPermission(): Promise<boolean> {
  try {
    await setupNotificationChannel();
    const result = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
      },
    });

    if (
      result.granted ||
      result.status === 'granted' ||
      (result.android && result.android.importance > 0)
    ) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

// Convert a time string like "09:00" into hour and minute numbers
function parseHourAndMinute(timeText: string): { hour: number; minute: number } {
  const parts = timeText.split(':');
  const rawHour = parseInt(parts[0], 10);
  const rawMinute = parseInt(parts[1], 10);

  const hour = isNaN(rawHour) ? 9 : Math.max(0, Math.min(23, rawHour));
  const minute = isNaN(rawMinute) ? 0 : Math.max(0, Math.min(59, rawMinute));

  return { hour, minute };
}

// Cancel previously scheduled notifications using their saved IDs
export async function cancelScheduledNotifications(ids: string[]): Promise<void> {
  for (const id of ids) {
    if (!id) continue;
    try {
      await Notifications.cancelScheduledNotificationAsync(id);
    } catch {
      // Ignore if notification was already delivered or cancelled
    }
  }
}

// Schedule daily water and health record reminders, and return the new notification IDs
export async function scheduleReminderNotifications(
  waterEnabled: boolean,
  waterTimes: string[],
  dailyEnabled: boolean,
  dailyTime: string,
  previousIds: string[]
): Promise<string[]> {
  await setupNotificationChannel();

  if (previousIds.length > 0) {
    await cancelScheduledNotifications(previousIds);
  }

  const scheduledIds: string[] = [];

  if (waterEnabled) {
    for (let i = 0; i < waterTimes.length; i++) {
      const { hour, minute } = parseHourAndMinute(waterTimes[i]);
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Hydration Reminder',
          body: 'Time for a water break! Drink a glass of water to reach your daily goal.',
          data: { screen: 'AddRecord' },
          sound: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour,
          minute,
          channelId: REMINDER_CHANNEL_ID,
        },
      });
      scheduledIds.push(id);
    }
  }

  if (dailyEnabled) {
    const { hour, minute } = parseHourAndMinute(dailyTime);
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Daily Health Log Reminder',
        body: "Don't forget to record your steps, calories, and water intake for today!",
        data: { screen: 'AddRecord' },
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
        channelId: REMINDER_CHANNEL_ID,
      },
    });
    scheduledIds.push(id);
  }

  return scheduledIds;
}

// Send an immediate test notification so the user can check that alerts work
export async function sendTestNotificationNow(): Promise<void> {
  await setupNotificationChannel();

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'HealthMate Notification Test',
      body: 'Notifications are working! Tap here to open your health log.',
      data: { screen: 'AddRecord' },
      sound: true,
    },
    trigger: null,
  });
}

