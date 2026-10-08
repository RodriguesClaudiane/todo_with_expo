import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { Spacing } from '@/constants/theme';
import { useNow } from '@/hooks/use-now';
import { useTheme } from '@/hooks/use-theme';
import { remindersSupported } from '@/services/notifications';
import { formatDate, formatTime, nextFullHour, withDate, withTime } from '@/lib/dates';

type Props = {
  value: number | null;
  onChange: (value: number | null) => void;
};

/**
 * Optional due date + time.
 * Android: buttons open the native date and time dialogs (imperative API).
 * iOS: compact inline pickers that open a popover when tapped.
 */
export function DueDateField({ value, onChange }: Props) {
  const theme = useTheme();
  const now = useNow();

  if (value === null) {
    return (
      <View style={styles.container}>
        <Text style={[styles.empty, { color: theme.textSecondary }]}>No due date — no reminder.</Text>
        <Button title="Add due date" variant="secondary" onPress={() => onChange(nextFullHour())} />
      </View>
    );
  }

  const isPast = value <= now;

  const openAndroid = (mode: 'date' | 'time') => {
    DateTimePickerAndroid.open({
      value: new Date(value),
      mode,
      is24Hour: true,
      onValueChange: (_event, date) => onChange(mode === 'date' ? withDate(value, date) : withTime(value, date)),
    });
  };

  return (
    <View style={styles.container}>
      {Platform.OS === 'ios' ? (
        <View style={styles.row}>
          <DateTimePicker
            value={new Date(value)}
            mode="date"
            display="compact"
            onValueChange={(_event, date) => onChange(withDate(value, date))}
          />
          <DateTimePicker
            value={new Date(value)}
            mode="time"
            display="compact"
            onValueChange={(_event, date) => onChange(withTime(value, date))}
          />
        </View>
      ) : Platform.OS === 'android' ? (
        <View style={styles.row}>
          <Button
            title={`📅 ${formatDate(value)}`}
            variant="secondary"
            onPress={() => openAndroid('date')}
            style={styles.flex}
          />
          <Button
            title={`🕒 ${formatTime(value)}`}
            variant="secondary"
            onPress={() => openAndroid('time')}
            style={styles.flex}
          />
        </View>
      ) : (
        <Text style={{ color: theme.text }}>
          {formatDate(value)} {formatTime(value)} (date picker not available on web)
        </Text>
      )}

      {!remindersSupported ? (
        <Text style={[styles.hint, { color: theme.textSecondary }]}>
          Reminders are not available in this environment (Expo Go on Android).
        </Text>
      ) : isPast ? (
        <Text style={[styles.hint, { color: theme.danger }]}>
          This time is in the past, so no reminder will be scheduled.
        </Text>
      ) : (
        <Text style={[styles.hint, { color: theme.textSecondary }]}>
          You will get a reminder at this time (unless the task is completed).
        </Text>
      )}

      <Button title="Remove due date" variant="secondary" onPress={() => onChange(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
  },
  empty: {
    fontSize: 14,
  },
  hint: {
    fontSize: 13,
  },
});
