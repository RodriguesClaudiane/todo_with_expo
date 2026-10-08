import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';

import { listCategories } from '@/db/categories';
import type { CategoryWithCount } from '@/db/models';

/** Loads categories from SQLite and reloads whenever the screen regains focus. */
export function useCategories() {
  const db = useSQLiteContext();
  const [categories, setCategories] = useState<CategoryWithCount[]>([]);
  const [error, setError] = useState<Error | null>(null);

  const reload = useCallback(async () => {
    try {
      setCategories(await listCategories(db));
      setError(null);
    } catch (e) {
      console.error(e);
      setError(e as Error);
    }
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  return { categories, error, reload };
}
