import { Link, Stack, router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Chip } from '@/components/chip';
import { SegmentedControl } from '@/components/segmented-control';
import { TaskRow } from '@/components/task-row';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import type { CategoryFilter, StatusFilter, TaskWithCategory } from '@/db/models';
import { useCategories } from '@/hooks/use-categories';
import { useTasks } from '@/hooks/use-tasks';
import { useTheme } from '@/hooks/use-theme';
import { explainReminderOutcome, showError } from '@/lib/errors';
import { setCompleted } from '@/services/task-service';

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'completed', label: 'Completed' },
];

export default function TaskListScreen() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [status, setStatus] = useState<StatusFilter>('all');
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>('all');
  const { categories } = useCategories();

  // If the selected category was deleted on the categories screen, fall back to "All".
  const category =
    typeof selectedCategory === 'number' && !categories.some((c) => c.id === selectedCategory)
      ? 'all'
      : selectedCategory;

  const { tasks, loading, error, reload } = useTasks({ status, category });

  const toggle = async (task: TaskWithCategory) => {
    try {
      const outcome = await setCompleted(db, task.id, !task.completed);
      explainReminderOutcome(outcome);
    } catch (e) {
      showError(e, 'Could not update the task.');
    } finally {
      reload();
    }
  };

  const openTask = (id: number | 'new') =>
    router.push({ pathname: '/task/[id]', params: { id: String(id) } });

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Link href="/categories" asChild>
              <Pressable accessibilityRole="button" hitSlop={8}>
                <Text style={[styles.headerLink, { color: theme.primary }]}>Categories</Text>
              </Pressable>
            </Link>
          ),
        }}
      />

      <View style={styles.filters}>
        <View style={styles.segmented}>
          <SegmentedControl options={STATUS_OPTIONS} value={status} onChange={setStatus} />
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}>
          <Chip label="All categories" selected={category === 'all'} onPress={() => setSelectedCategory('all')} />
          {categories.map((c) => (
            <Chip
              key={c.id}
              label={c.name}
              color={c.color}
              selected={category === c.id}
              onPress={() => setSelectedCategory(c.id)}
            />
          ))}
          <Chip label="Uncategorized" selected={category === 'none'} onPress={() => setSelectedCategory('none')} />
        </ScrollView>
      </View>

      <FlatList
        data={tasks}
        keyExtractor={(task) => String(task.id)}
        renderItem={({ item }) => (
          <TaskRow task={item} onPress={() => openTask(item.id)} onToggle={() => toggle(item)} />
        )}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 96 }]}
        ListEmptyComponent={
          loading ? null : (
            <View style={styles.empty}>
              <Text style={[styles.emptyTitle, { color: theme.text }]}>
                {error ? 'Could not load tasks' : 'No tasks here'}
              </Text>
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                {error
                  ? error.message
                  : status === 'all' && category === 'all'
                    ? 'Tap “New task” to create your first task.'
                    : 'Try another filter.'}
              </Text>
            </View>
          )
        }
      />

      <Pressable
        accessibilityRole="button"
        onPress={() => openTask('new')}
        style={({ pressed }) => [
          styles.fab,
          { backgroundColor: theme.primary, bottom: insets.bottom + Spacing.three, opacity: pressed ? 0.85 : 1 },
        ]}>
        <Text style={[styles.fabLabel, { color: theme.onPrimary }]}>+ New task</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  headerLink: {
    fontSize: 16,
    fontWeight: '600',
  },
  filters: {
    gap: Spacing.two,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  segmented: {
    paddingHorizontal: Spacing.three,
  },
  chips: {
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  list: {
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  empty: {
    alignItems: 'center',
    gap: Spacing.one,
    paddingTop: Spacing.six,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    right: Spacing.three,
    paddingHorizontal: Spacing.four,
    minHeight: 52,
    borderRadius: 26,
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  fabLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
});
