import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';

import type { TaskFilter, TaskWithCategory } from '@/db/models';
import { listTasks } from '@/db/tasks';

/**
 * Runs the filtered SQL query. Reloads when the filter changes and whenever
 * the screen regains focus (e.g. after returning from the editor).
 */
export function useTasks(filter: TaskFilter) {
  const db = useSQLiteContext();
  const [tasks, setTasks] = useState<TaskWithCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { status, category } = filter;

  const reload = useCallback(async () => {
    try {
      setTasks(await listTasks(db, { status, category }));
      setError(null);
    } catch (e) {
      console.error(e);
      setError(e as Error);
    } finally {
      setLoading(false);
    }
  }, [db, status, category]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  return { tasks, loading, error, reload };
}
