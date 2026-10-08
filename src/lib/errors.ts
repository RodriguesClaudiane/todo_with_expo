import { Alert, Linking } from 'react-native';

import { ValidationError } from '@/db/models';
import type { ReminderOutcome } from '@/services/task-service';

/** Shows a user-facing message; unexpected errors are logged and get a generic text. */
export function showError(error: unknown, fallback: string) {
  if (error instanceof ValidationError) {
    Alert.alert('Check the form', error.message);
    return;
  }
  console.error(error);
  Alert.alert('Something went wrong', fallback);
}

let permissionWarningShown = false;

/**
 * Explains why a reminder was not scheduled. Permission warnings are shown only
 * once per app session so toggling tasks does not keep showing the same alert.
 */
export function explainReminderOutcome(outcome: ReminderOutcome) {
  switch (outcome) {
    case 'denied':
    case 'blocked':
      if (permissionWarningShown) return;
      permissionWarningShown = true;
      Alert.alert(
        'Reminders are off',
        'The task was saved, but notifications are not allowed, so no reminder was scheduled.',
        outcome === 'blocked'
          ? [
              { text: 'Not now', style: 'cancel' },
              { text: 'Open settings', onPress: () => Linking.openSettings().catch(() => {}) },
            ]
          : undefined
      );
      return;
    case 'unsupported':
      if (permissionWarningShown) return;
      permissionWarningShown = true;
      Alert.alert(
        'Reminders unavailable',
        'The task was saved. Scheduled reminders are not available in this environment (Expo Go on Android) — use a development build to get notifications.'
      );
      return;
    case 'error':
      Alert.alert('Reminder not scheduled', 'The task was saved, but the reminder could not be scheduled.');
      return;
    default:
      return;
  }
}
