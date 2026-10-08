import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const REMINDER_CHANNEL_ID = 'task-reminders';

export type PermissionResult = 'granted' | 'denied' | 'blocked' | 'unsupported';

let channelReady: Promise<void> = Promise.resolve();

/** Called once at startup (module scope of the root layout). */
export function configureNotifications() {
  if (Platform.OS === 'web') return;

  // Without a handler, notifications that arrive while the app is open are not shown.
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });

  if (Platform.OS === 'android') {
    // Android 13+ only shows the permission prompt once a channel exists.
    channelReady = Notifications.setNotificationChannelAsync(REMINDER_CHANNEL_ID, {
      name: 'Task reminders',
      importance: Notifications.AndroidImportance.HIGH,
    })
      .then(() => undefined)
      .catch((error) => console.warn('Could not create notification channel', error));
  }
}

/**
 * Asks for permission only when a reminder is actually needed.
 * Never throws: any failure is reported as 'denied'.
 */
export async function ensureNotificationPermission(): Promise<PermissionResult> {
  if (Platform.OS === 'web') return 'unsupported';
  try {
    await channelReady;
    const current = await Notifications.getPermissionsAsync();
    if (isGranted(current)) return 'granted';
    if (!current.canAskAgain) return 'blocked';

    const requested = await Notifications.requestPermissionsAsync();
    if (isGranted(requested)) return 'granted';
    return requested.canAskAgain ? 'denied' : 'blocked';
  } catch (error) {
    console.warn('Notification permission check failed', error);
    return 'denied';
  }
}

function isGranted(status: Notifications.NotificationPermissionsStatus) {
  return (
    status.granted ||
    status.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL ||
    status.ios?.status === Notifications.IosAuthorizationStatus.EPHEMERAL
  );
}

export async function scheduleTaskReminder(task: { id: number; title: string; dueDateTime: number }) {
  return Notifications.scheduleNotificationAsync({
    content: {
      title: 'Task reminder',
      body: task.title,
      data: { taskId: task.id },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: task.dueDateTime,
      channelId: REMINDER_CHANNEL_ID,
    },
  });
}

/** Cancelling an id that already fired or no longer exists is harmless; errors are logged only. */
export async function cancelTaskReminder(notificationId: string) {
  if (Platform.OS === 'web') return;
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch (error) {
    console.warn('Could not cancel notification', notificationId, error);
  }
}
