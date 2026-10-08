# BUILD_LOG — Mobile To-Do App

Development history of the to-do app described in `expec.md`.
Entries are appended in chronological order and are never rewritten; corrections get new entries.

Environment: Expo SDK 57 (`expo ~57.0.27`), React Native 0.86, Expo Router 57, TypeScript 6, pnpm, Node 24, Windows 11 + WSL2 (NAT networking), physical Android device POCO M8 5G (connected through the Windows `adb.exe`).

---

## Entry 1 — Project kickoff, planning and branch

### Prompt / Request

> "leia esse arquivo e faça o que é pedido. leve em consideração a seguinte instrução também: You may also instruct the coding agent to create Git commits throughout the development process. If you do so, try to keep the commit history meaningful, with commits representing relevant implementation steps, fixes, or decisions. The commit history may later be used together with BUILD_LOG.md to analyze how the project evolved."

(The file is `expec.md`, the implementation specification.)

### Decision Summary

- Start from the existing `create-expo-app` template (SDK 57, Expo Router, TypeScript) instead of re-initialising the project.
- Followed `AGENTS.md`: read the versioned SDK 57 docs before writing code (expo-sqlite, expo-notifications, date-time picker, `llms.txt`).
- Work on a branch `feat/todo-app`, because `master` is the default branch. Commit after every relevant step.
- Planned stack (to be confirmed in later entries when installed):
  - **expo-sqlite**: official Expo SQLite module; it has a `SQLiteProvider`/`useSQLiteContext` React API and async query helpers.
  - **expo-notifications**: official module for local scheduled notifications (no push server needed). The SDK 57 docs say local notifications still work in Expo Go.
  - **@react-native-community/datetimepicker**: the picker recommended by the SDK 57 docs. It is bundled in Expo Go, so no dev build is needed for testing.
- Planned architecture: a small, framework-native structure. Expo Router screens live in `src/app/`. A data layer in `src/db/` (schema/migrations + repository functions with plain SQL). A notification service in `src/services/`. Shared UI in `src/components/`. No ORM or global state library, because the app is small.
- Order changed slightly from the suggested one in `expec.md` §18: models and SQLite are defined before the navigation shell, because every screen depends on the data layer.

### Actions Performed

- Read `expec.md`, the template sources, `package.json` and `app.json`.
- Created branch `feat/todo-app`.
- Created this `BUILD_LOG.md`.
- Added `expec.md` to version control so the spec sits next to the history.

### Result

Plan defined; no app code changed yet.

### Problems / Errors

- On the first attempt `expec.md` was empty on disk (0 bytes; the editor had not saved it). After the user saved it the content was available.

### Fixes Attempted

- Asked the user to save the file, then re-read it.

### Current Status

Completed

---

## Entry 2 — Dependencies

### Prompt / Request

Continuation of the `expec.md` implementation (§17 Dependencies, §5 SQLite, §10 Local notifications).

### Decision Summary

Installed with `npx expo install`, as `AGENTS.md` requires, so the versions match SDK 57:

| Dependency | Version | Purpose | Why this one |
|---|---|---|---|
| `expo-sqlite` | ~57.0.4 | Local SQLite persistence for tasks and categories | Official Expo module. Async API (`runAsync`, `getAllAsync`, `withTransactionAsync`), `SQLiteProvider` with an `onInit` hook for migrations. Works in Expo Go. |
| `expo-notifications` | ~57.0.22 | Scheduled local reminders | Official Expo module. Supports `DATE` triggers and returns an identifier that can be stored and cancelled. No push server needed. The SDK 57 docs say local notifications still work in Expo Go. |
| `@react-native-community/datetimepicker` | 9.1.0 | Native date and time pickers | The picker the SDK 57 docs recommend. Included in Expo Go. `@expo/ui` also has a drop-in picker, but the community picker is the more widely documented option. |

Config changes in `app.json`:
- Added the `expo-notifications` config plugin. `npx expo install` only auto-added the `expo-sqlite` and datetimepicker plugins.
- Added `android.permission.SCHEDULE_EXACT_ALARM`. I read the expo-notifications Android source (`ExpoSchedulingDelegate.kt`): it uses exact alarms only when `canScheduleExactAlarms()` is true and otherwise falls back to `setAndAllowWhileIdle`. Without the permission reminders still fire, but may be a few minutes late. This only matters for development/production builds; Expo Go uses its own manifest. The library already declares `RECEIVE_BOOT_COMPLETED` and `POST_NOTIFICATIONS`, so scheduled reminders survive a device reboot.
- Renamed the display name to "To-Do".

### Actions Performed

- `npx expo install expo-sqlite expo-notifications @react-native-community/datetimepicker`
- Edited `app.json` (plugins, Android permission, name).

### Result

Install succeeded (pnpm, 6 packages added).

### Problems / Errors

None.

### Fixes Attempted

N/A

### Current Status

Completed

---

## Entry 3 — Data models, SQLite schema and repositories

### Prompt / Request

Continuation of the `expec.md` implementation (§3 Task model, §4 Category model, §5 SQLite persistence, §12 Filtering).

### Decision Summary

- **SQLite approach:** `expo-sqlite` with plain SQL in small repository modules (`src/db/tasks.ts`, `src/db/categories.ts`). Each function takes the `SQLiteDatabase` as its first argument. No ORM: there are only two tables, and plain SQL is easy to read in an educational project. Considered Drizzle ORM and rejected it, because it adds a build step, migrations tooling and a new dependency for very little gain here.
- **Schema versioning:** `PRAGMA user_version` with numbered steps in `migrateDbIfNeeded` (the pattern from the SDK 57 expo-sqlite docs). It runs from `SQLiteProvider`'s `onInit` before any screen renders.
- **Dates:** stored as INTEGER epoch milliseconds (`due_date_time`, `created_at`, `updated_at`), so sorting and comparisons happen directly in SQL and there are no timezone parsing problems. The UI formats them in the device locale.
- **Task fields** (spec fields plus extras):
  - `id` INTEGER PRIMARY KEY AUTOINCREMENT
  - `title` TEXT NOT NULL, with a CHECK that it is non-blank
  - `description` TEXT, defaults to `''`
  - `completed` INTEGER 0/1
  - `due_date_time` INTEGER, nullable
  - `created_at` INTEGER
  - `category_id`: nullable foreign key to `categories(id)` with `ON DELETE SET NULL`
  - **Extra fields:** `updated_at` (last modification time) and `notification_id` (the identifier returned by expo-notifications for the task's pending reminder, used to cancel or replace it).
- **Category fields:** `id`, `name` (UNIQUE, case-insensitive, non-blank), plus the extras `color` (hex string shown as a dot or chip in the UI) and `created_at`. Four categories are seeded on first run: Personal, Work, Study, Shopping.
- **Category deletion strategy: tasks become uncategorized.** Implemented two ways: the foreign key uses `ON DELETE SET NULL` (with `PRAGMA foreign_keys = ON`, which SQLite requires on every connection), and `deleteCategory` also runs an explicit `UPDATE ... SET category_id = NULL` in the same transaction, so the behaviour does not depend on the pragma. `deleteCategory` returns the number of affected tasks so the UI can warn the user before deleting. I chose this over blocking the deletion, because the user loses no tasks and it needs the fewest steps.
- **Filtering approach: in SQL.** `listTasks(db, { status, category })` builds a parameterised `WHERE` clause. `category` can be `'all'`, `'none'` (only uncategorized tasks; an extra filter beyond the spec) or a category id. Sort order: pending first, then by due date (tasks without a date last), then newest first.
- **Validation:** `validateTaskInput` trims the title and description, requires a title (max 120 characters) and rejects non-finite due dates. It throws a `ValidationError` whose message is safe to show to the user. Duplicate category names are turned into a `ValidationError` instead of a raw SQLite UNIQUE error.
- **Testing without a device:** wrote `scripts/db-smoke-test.mjs`. It transpiles `src/db/*.ts` with the project's TypeScript and runs the real SQL against Node 24's built-in `node:sqlite`, through a small adapter that mimics the expo-sqlite methods the app uses. For that reason `src/db` uses relative imports only (no `@/` alias).

### Actions Performed

- Created `src/db/models.ts`, `src/db/schema.ts`, `src/db/tasks.ts`, `src/db/categories.ts`.
- Created `scripts/db-smoke-test.mjs` and added `pnpm test:db` to `package.json`.

### Result

`node scripts/db-smoke-test.mjs`: **15 checks passed**. They cover:
- migration and seed data, and that running it twice changes nothing;
- create, edit, delete, complete and reopen;
- title validation;
- status, category and combined filters;
- storing the notification id;
- category create, duplicate name, rename and task counts;
- deleting a category leaves its tasks uncategorized (both the explicit update and the FK cascade);
- data still present after closing and reopening the database file.

### Problems / Errors

None in this step. Note: `node:sqlite` prints an "experimental feature" warning on Node 24. The npm script hides it with `--no-warnings`.

### Fixes Attempted

N/A

### Current Status

Completed (verified by the smoke test; still needs on-device verification with expo-sqlite)
