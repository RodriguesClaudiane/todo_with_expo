/**
 * Domain models used by the UI. Dates are stored as epoch milliseconds
 * (INTEGER columns) so they can be compared and sorted directly in SQL.
 */

export type Category = {
  id: number;
  name: string;
  color: string;
};

export type CategoryWithCount = Category & {
  taskCount: number;
};

export type Task = {
  id: number;
  title: string;
  description: string;
  completed: boolean;
  /** Epoch ms, or null when the task has no due date. */
  dueDateTime: number | null;
  createdAt: number;
  updatedAt: number;
  categoryId: number | null;
  /** Identifier returned by expo-notifications for the pending reminder, if any. */
  notificationId: string | null;
};

/** Task joined with its category, as shown in the list. */
export type TaskWithCategory = Task & {
  categoryName: string | null;
  categoryColor: string | null;
};

export type TaskInput = {
  title: string;
  description: string;
  completed: boolean;
  dueDateTime: number | null;
  categoryId: number | null;
};

export type StatusFilter = 'all' | 'pending' | 'completed';

/** 'all' = no category filter, 'none' = only uncategorized tasks. */
export type CategoryFilter = 'all' | 'none' | number;

export type TaskFilter = {
  status: StatusFilter;
  category: CategoryFilter;
};

/** Error with a message that is safe to show to the user. */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export const TITLE_MAX_LENGTH = 120;
export const CATEGORY_NAME_MAX_LENGTH = 30;
