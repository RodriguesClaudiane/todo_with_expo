# To-Do (Expo)

A mobile to-do app built with Expo SDK 57 and Expo Router. It stores tasks and categories in SQLite and reminds you of due tasks with scheduled local notifications.

- Specification: [`expec.md`](expec.md)
- Development history (decisions, errors, fixes, test results): [`BUILD_LOG.md`](BUILD_LOG.md)

## Features

- **Task list** with filters by status (All / Pending / Completed) and by category (including "Uncategorized"). You can mark a task as done or pending again with one tap.
- **Task editor**:
  - Fields: title (required), description, category, optional due date and time, completed.
  - Actions: save, cancel (asks before discarding changes), delete (with confirmation).
- **Category management**: create, rename (name and colour) and delete categories. When a category is deleted, its tasks are kept and become uncategorized.
- **Local reminders** at the due date and time:
  - cancelled when the task is completed, deleted, or its due date is removed;
  - rescheduled when the due date changes or the task is reopened.
- Everything is stored in SQLite (`todo.db`), so data is kept when the app is closed and reopened.

## Running

```bash
pnpm install
npx expo start
```

**Reminders on Android need a development build.** In Expo Go on Android, `expo-notifications` cannot be used: the app still works, but it tells you reminders are unavailable. To build and run a development build:

```bash
npx expo run:android            # local build (Android SDK + JDK 17 required)
# or
npx eas-cli@latest build --profile development --platform android
```

On Android 14 and newer, reminders can arrive up to about a minute late. To get exact timing, allow **Alarms & reminders** for the app in the system settings.

## Checks

```bash
npx tsc --noEmit     # typecheck
npx expo lint        # lint
pnpm test:db         # SQLite data-layer smoke test (runs the app's SQL on Node's node:sqlite)
npx expo-doctor      # dependency/config diagnostics
```

## Project structure

```
src/
  app/                 Expo Router screens
    _layout.tsx        Stack navigator, SQLiteProvider (+ migrations), error boundary
    index.tsx          Task list (filters)
    task/[id].tsx      Task editor ("new" or a numeric id)
    categories.tsx     Category management
  db/                  SQLite schema/migrations and repositories (plain SQL)
  services/            Notifications wrapper and task service (keeps reminders in sync)
  components/          Shared UI (buttons, chips, task row, due date field, …)
  hooks/               Data hooks (reload on screen focus), theme, clock
  lib/                 Date formatting and error/alert helpers
scripts/db-smoke-test.mjs
```
