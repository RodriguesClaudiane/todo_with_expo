import type { SQLiteDatabase } from 'expo-sqlite';

import {
  CATEGORY_NAME_MAX_LENGTH,
  ValidationError,
  type Category,
  type CategoryWithCount,
} from './models';

type CategoryRow = {
  id: number;
  name: string;
  color: string;
  task_count?: number;
};

function validateName(name: string) {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new ValidationError('Category name is required.');
  }
  if (trimmed.length > CATEGORY_NAME_MAX_LENGTH) {
    throw new ValidationError(`Category name must be at most ${CATEGORY_NAME_MAX_LENGTH} characters.`);
  }
  return trimmed;
}

function isUniqueViolation(error: unknown) {
  return error instanceof Error && /UNIQUE constraint failed/i.test(error.message);
}

export async function listCategories(db: SQLiteDatabase): Promise<CategoryWithCount[]> {
  const rows = await db.getAllAsync<CategoryRow>(`
    SELECT c.id, c.name, c.color, COUNT(t.id) AS task_count
    FROM categories c
    LEFT JOIN tasks t ON t.category_id = c.id
    GROUP BY c.id
    ORDER BY c.name COLLATE NOCASE
  `);
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    color: row.color,
    taskCount: row.task_count ?? 0,
  }));
}

export async function createCategory(db: SQLiteDatabase, name: string, color: string): Promise<Category> {
  const trimmed = validateName(name);
  try {
    const result = await db.runAsync(
      'INSERT INTO categories (name, color, created_at) VALUES (?, ?, ?)',
      trimmed,
      color,
      Date.now()
    );
    return { id: result.lastInsertRowId, name: trimmed, color };
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ValidationError(`A category named "${trimmed}" already exists.`);
    }
    throw error;
  }
}

export async function updateCategory(db: SQLiteDatabase, id: number, name: string, color: string) {
  const trimmed = validateName(name);
  try {
    await db.runAsync('UPDATE categories SET name = ?, color = ? WHERE id = ?', trimmed, color, id);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ValidationError(`A category named "${trimmed}" already exists.`);
    }
    throw error;
  }
}

/**
 * Deletes the category. Tasks that used it become uncategorized
 * (FOREIGN KEY ... ON DELETE SET NULL). Returns how many tasks were affected.
 */
export async function deleteCategory(db: SQLiteDatabase, id: number): Promise<number> {
  let affected = 0;
  await db.withTransactionAsync(async () => {
    const row = await db.getFirstAsync<{ n: number }>(
      'SELECT COUNT(*) AS n FROM tasks WHERE category_id = ?',
      id
    );
    affected = row?.n ?? 0;
    // Explicit update as well, so the behaviour does not depend on the
    // foreign_keys pragma being enabled on this connection.
    await db.runAsync('UPDATE tasks SET category_id = NULL WHERE category_id = ?', id);
    await db.runAsync('DELETE FROM categories WHERE id = ?', id);
  });
  return affected;
}
