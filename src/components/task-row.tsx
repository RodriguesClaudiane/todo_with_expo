import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CategoryBadge } from '@/components/chip';
import { Spacing } from '@/constants/theme';
import type { TaskWithCategory } from '@/db/models';
import { useNow } from '@/hooks/use-now';
import { useTheme } from '@/hooks/use-theme';
import { formatDueDate } from '@/lib/dates';

type Props = {
  task: TaskWithCategory;
  onPress: () => void;
  onToggle: () => void;
};

export function TaskRow({ task, onPress, onToggle }: Props) {
  const theme = useTheme();
  const now = useNow();
  const overdue = !task.completed && task.dueDateTime !== null && task.dueDateTime < now;

  return (
    <View style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: task.completed }}
        accessibilityLabel={task.completed ? 'Mark as pending' : 'Mark as completed'}
        hitSlop={8}
        onPress={onToggle}
        style={[
          styles.checkbox,
          { borderColor: task.completed ? theme.success : theme.textSecondary },
          task.completed && { backgroundColor: theme.success },
        ]}>
        {task.completed ? <Text style={[styles.check, { color: theme.onPrimary }]}>✓</Text> : null}
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityHint="Opens the task"
        onPress={onPress}
        style={({ pressed }) => [styles.body, { opacity: pressed ? 0.6 : 1 }]}>
        <Text
          numberOfLines={2}
          style={[
            styles.title,
            { color: task.completed ? theme.textSecondary : theme.text },
            task.completed && styles.completedTitle,
          ]}>
          {task.title}
        </Text>

        <View style={styles.meta}>
          <Text style={[styles.status, { color: task.completed ? theme.success : theme.textSecondary }]}>
            {task.completed ? 'Completed' : 'Pending'}
          </Text>
          {task.categoryName ? <CategoryBadge name={task.categoryName} color={task.categoryColor} /> : null}
          {task.dueDateTime !== null ? (
            <Text style={[styles.due, { color: overdue ? theme.danger : theme.textSecondary }]}>
              {overdue ? 'Overdue · ' : '⏰ '}
              {formatDueDate(task.dueDateTime)}
            </Text>
          ) : null}
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    borderRadius: 12,
  },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  check: {
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 18,
  },
  body: {
    flex: 1,
    gap: Spacing.one,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
  },
  completedTitle: {
    textDecorationLine: 'line-through',
  },
  meta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.two,
  },
  status: {
    fontSize: 12,
    fontWeight: '600',
  },
  due: {
    fontSize: 12,
    fontWeight: '500',
  },
});
