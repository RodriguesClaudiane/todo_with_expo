import type { SQLiteDatabase } from 'expo-sqlite';

export const DATABASE_NAME = 'todo.db';
const DATABASE_VERSION = 1;

export const CATEGORY_COLORS = [
  '#208AEF',
  '#E5484D',
  '#30A46C',
  '#F76B15',
  '#8E4EC6',
  '#D6409F',
  '#12A594',
  '#6E6E6E',
];

const DEFAULT_CATEGORIES: [name: string, color: string][] = [
  ['Personal', '#208AEF'],
  ['Work', '#F76B15'],
  ['Study', '#8E4EC6'],
  ['Shopping', '#30A46C'],
];

/**
 * Runs on every app start (SQLiteProvider `onInit`).
 * Versioned with PRAGMA user_version so later schema changes can be appended
 * as new steps without losing user data.
 */
export async function migrateDbIfNeeded(db: SQLiteDatabase) {
  // Foreign keys are off by default in SQLite and the setting is per connection.
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

  const result = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let currentVersion = result?.user_version ?? 0;
  if (currentVersion >= DATABASE_VERSION) {
    return;
  }

  if (currentVersion === 0) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS categories (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE COLLATE NOCASE CHECK (length(trim(name)) > 0),
          color TEXT NOT NULL,
          created_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS tasks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL CHECK (length(trim(title)) > 0),
          description TEXT NOT NULL DEFAULT '',
          completed INTEGER NOT NULL DEFAULT 0 CHECK (completed IN (0, 1)),
          due_date_time INTEGER,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          category_id INTEGER REFERENCES categories (id) ON DELETE SET NULL,
          notification_id TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_tasks_category ON tasks (category_id);
        CREATE INDEX IF NOT EXISTS idx_tasks_completed ON tasks (completed);
      `);

      const now = Date.now();
      for (const [name, color] of DEFAULT_CATEGORIES) {
        await db.runAsync(
          'INSERT OR IGNORE INTO categories (name, color, created_at) VALUES (?, ?, ?)',
          name,
          color,
          now
        );
      }
    });
    currentVersion = 1;
  }

  // Future migrations go here: if (currentVersion === 1) { ...; currentVersion = 2; }

  await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
}
