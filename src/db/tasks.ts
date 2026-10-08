import type { SQLiteDatabase } from 'expo-sqlite';

import {
  TITLE_MAX_LENGTH,
  ValidationError,
  type Task,
  type TaskFilter,
  type TaskInput,
  type TaskWithCategory,
} from './models';

type TaskRow = {
  id: number;
  title: string;
  description: string;
  completed: number;
  due_date_time: number | null;
  created_at: number;
  updated_at: number;
  category_id: number | null;
  notification_id: string | null;
  category_name?: string | null;
  category_color?: string | null;
};

function toTask(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    completed: row.completed === 1,
    dueDateTime: row.due_date_time,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    categoryId: row.category_id,
    notificationId: row.notification_id,
  };
}

function toTaskWithCategory(row: TaskRow): TaskWithCategory {
  return {
    ...toTask(row),
    categoryName: row.category_name ?? null,
    categoryColor: row.category_color ?? null,
  };
}

/** Normalises and validates user input. Throws ValidationError with a user-facing message. */
export function validateTaskInput(input: TaskInput): TaskInput {
  const title = input.title.trim();
  if (!title) {
    throw new ValidationError('Title is required.');
  }
  if (title.length > TITLE_MAX_LENGTH) {
    throw new ValidationError(`Title must be at most ${TITLE_MAX_LENGTH} characters.`);
  }
  if (input.dueDateTime !== null && !Number.isFinite(input.dueDateTime)) {
    throw new ValidationError('The due date is not valid.');
  }
  return {
    ...input,
    title,
    description: input.description.trim(),
  };
}

const SELECT_WITH_CATEGORY = `
  SELECT t.*, c.name AS category_name, c.color AS category_color
  FROM tasks t
  LEFT JOIN categories c ON c.id = t.category_id
`;

/** Filtering is done in SQL so the list only loads the rows it shows. */
export async function listTasks(db: SQLiteDatabase, filter: TaskFilter): Promise<TaskWithCategory[]> {
  const where: string[] = [];
  const params: (string | number)[] = [];

  if (filter.status === 'pending') where.push('t.completed = 0');
  if (filter.status === 'completed') where.push('t.completed = 1');

  if (filter.category === 'none') {
    where.push('t.category_id IS NULL');
  } else if (filter.category !== 'all') {
    where.push('t.category_id = ?');
    params.push(filter.category);
  }

  const sql = `
    ${SELECT_WITH_CATEGORY}
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY t.completed ASC,
             t.due_date_time IS NULL ASC,
             t.due_date_time ASC,
             t.created_at DESC
  `;
  const rows = await db.getAllAsync<TaskRow>(sql, params);
  return rows.map(toTaskWithCategory);
}

export async function getTask(db: SQLiteDatabase, id: number): Promise<TaskWithCategory | null> {
  const row = await db.getFirstAsync<TaskRow>(`${SELECT_WITH_CATEGORY} WHERE t.id = ?`, id);
  return row ? toTaskWithCategory(row) : null;
}

export async function createTask(db: SQLiteDatabase, input: TaskInput): Promise<Task> {
  const data = validateTaskInput(input);
  const now = Date.now();
  const result = await db.runAsync(
    `INSERT INTO tasks (title, description, completed, due_date_time, created_at, updated_at, category_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    data.title,
    data.description,
    data.completed ? 1 : 0,
    data.dueDateTime,
    now,
    now,
    data.categoryId
  );
  return {
    ...data,
    id: result.lastInsertRowId,
    createdAt: now,
    updatedAt: now,
    notificationId: null,
  };
}

export async function updateTask(db: SQLiteDatabase, id: number, input: TaskInput) {
  const data = validateTaskInput(input);
  const result = await db.runAsync(
    `UPDATE tasks
     SET title = ?, description = ?, completed = ?, due_date_time = ?, category_id = ?, updated_at = ?
     WHERE id = ?`,
    data.title,
    data.description,
    data.completed ? 1 : 0,
    data.dueDateTime,
    data.categoryId,
    Date.now(),
    id
  );
  if (result.changes === 0) {
    throw new ValidationError('This task no longer exists.');
  }
}

export async function setTaskCompleted(db: SQLiteDatabase, id: number, completed: boolean) {
  await db.runAsync(
    'UPDATE tasks SET completed = ?, updated_at = ? WHERE id = ?',
    completed ? 1 : 0,
    Date.now(),
    id
  );
}

export async function setTaskNotificationId(db: SQLiteDatabase, id: number, notificationId: string | null) {
  await db.runAsync('UPDATE tasks SET notification_id = ? WHERE id = ?', notificationId, id);
}

export async function deleteTask(db: SQLiteDatabase, id: number) {
  await db.runAsync('DELETE FROM tasks WHERE id = ?', id);
}
