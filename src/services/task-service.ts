import type { SQLiteDatabase } from 'expo-sqlite';

import type { Task, TaskInput } from '@/db/models';
import {
  createTask,
  deleteTask,
  getTask,
  setTaskCompleted,
  setTaskNotificationId,
  updateTask,
} from '@/db/tasks';
import {
  cancelTaskReminder,
  ensureNotificationPermission,
  scheduleTaskReminder,
} from '@/services/notifications';

/**
 * What happened to the task's reminder after a change:
 * - scheduled: a notification is pending for the due date
 * - none: the task needs no reminder (no due date, or completed)
 * - past: the due date is not in the future, so nothing was scheduled
 * - denied / blocked / unsupported: permission missing, the task is saved without a reminder
 * - error: scheduling failed, the task is saved without a reminder
 */
export type ReminderOutcome = 'scheduled' | 'none' | 'past' | 'denied' | 'blocked' | 'unsupported' | 'error';

/**
 * Single place that keeps a task's notification in sync with its state.
 * Always cancels the previous reminder, then schedules a new one when the task
 * is pending and due in the future. The new id (or null) is stored on the task.
 */
async function syncReminder(db: SQLiteDatabase, task: Task): Promise<ReminderOutcome> {
  if (task.notificationId) {
    await cancelTaskReminder(task.notificationId);
  }

  let notificationId: string | null = null;
  let outcome: ReminderOutcome;

  if (task.completed || task.dueDateTime === null) {
    outcome = 'none';
  } else if (task.dueDateTime <= Date.now()) {
    outcome = 'past';
  } else {
    const permission = await ensureNotificationPermission();
    if (permission !== 'granted') {
      outcome = permission;
    } else {
      try {
        notificationId = await scheduleTaskReminder({
          id: task.id,
          title: task.title,
          dueDateTime: task.dueDateTime,
        });
        outcome = 'scheduled';
      } catch (error) {
        console.warn('Could not schedule reminder', error);
        outcome = 'error';
      }
    }
  }

  if (notificationId !== task.notificationId) {
    await setTaskNotificationId(db, task.id, notificationId);
  }
  return outcome;
}

/** Creates (id === null) or updates a task, then syncs its reminder. */
export async function saveTask(db: SQLiteDatabase, id: number | null, input: TaskInput) {
  let task: Task | null;
  if (id === null) {
    task = await createTask(db, input);
  } else {
    await updateTask(db, id, input);
    task = await getTask(db, id);
  }
  if (!task) throw new Error('Task not found after saving');

  const reminder = await syncReminder(db, task);
  return { id: task.id, reminder };
}

export async function setCompleted(db: SQLiteDatabase, id: number, completed: boolean) {
  await setTaskCompleted(db, id, completed);
  const task = await getTask(db, id);
  if (!task) return 'none' as const;
  return syncReminder(db, task);
}

export async function removeTask(db: SQLiteDatabase, id: number) {
  const task = await getTask(db, id);
  if (task?.notificationId) {
    await cancelTaskReminder(task.notificationId);
  }
  await deleteTask(db, id);
}
