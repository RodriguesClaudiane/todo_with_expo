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

---

## Entry 4 — Notification service and task service (reminder sync)

### Prompt / Request

Continuation of the `expec.md` implementation (§8 Task operations, §9 Due dates, §10 Local notifications, §11 Notification permissions).

### Decision Summary

- **`src/services/notifications.ts`** is a thin wrapper over expo-notifications:
  - `configureNotifications()`: sets the foreground handler (`shouldShowBanner`/`shouldShowList`/`shouldPlaySound`, the SDK 57 field names; `shouldShowAlert` is deprecated). On Android it also creates a `task-reminders` channel with HIGH importance. It is called once, at module scope, from the root layout.
  - `scheduleTaskReminder()`: uses a `SchedulableTriggerInputTypes.DATE` trigger with the channel id. Title is "Task reminder", body is the task title, and `data.taskId` is included.
  - `cancelTaskReminder()`: wraps `cancelScheduledNotificationAsync`. Errors are only logged, because cancelling an id that has already fired is harmless.
- **Notification strategy:** each task stores the identifier of its pending reminder in `tasks.notification_id`. One function, `syncReminder(db, task)` in `src/services/task-service.ts`, handles every case:
  1. It always cancels the stored reminder first.
  2. It schedules a new reminder only if the task is **pending** and `dueDateTime` is **in the future**.
  3. It stores the new id, or `NULL`.

  This covers every case in spec §10 with one code path:

  | Case | What happens |
  |---|---|
  | Created with a future date | Scheduled |
  | Due date changed | Old reminder cancelled, new one scheduled |
  | Due date removed | Cancelled |
  | Completed | Cancelled |
  | Reopened with a date still in the future | Scheduled again |
  | Deleted | `removeTask` cancels the reminder before deleting the row |

  Editing other fields (for example the title) also reschedules, so the notification text always matches the current title.
- **Screens call the services, not the repositories:** `saveTask`, `setCompleted` and `removeTask` combine the database change with the reminder sync, so screens cannot forget to update notifications.
- **Permission strategy:**
  - Permission is asked **in context**: only the first time a task actually needs a reminder, not when the app starts. The user then understands why the prompt appears.
  - `ensureNotificationPermission()` checks the current status first and asks only if `canAskAgain`. It never throws. It returns `granted`, `denied`, `blocked` (the OS will not show the prompt again) or `unsupported` (web).
  - On iOS, `PROVISIONAL`/`EPHEMERAL` authorization is treated as granted.
  - On Android the code waits for the channel to be created before asking, because Android 13+ only shows the prompt once a channel exists.
  - **If permission is denied, the task is still saved.** The service returns a `ReminderOutcome`, so the UI can explain that no reminder was scheduled.
- **Due date in the past:** this is allowed (a task can be overdue). The outcome is `past` and no reminder is scheduled.

### Actions Performed

- Created `src/services/notifications.ts` and `src/services/task-service.ts`.

### Result

`npx tsc --noEmit` passes. Runtime behaviour must still be tested on a device.

### Problems / Errors

None so far.

### Fixes Attempted

N/A

### Current Status

Needs testing

---

## Entry 5 — Navigation and the three screens (UI connected to SQLite)

### Prompt / Request

Continuation of the `expec.md` implementation (§6 Required screens, §7 Navigation, §12 Filtering, §13 Error handling, §16 State management).

### Decision Summary

- **Navigation: Expo Router `Stack`** in `src/app/_layout.tsx`, replacing the template's native tabs. The three screens are hierarchical (list → editor, list → categories), so a stack fits better than tabs. Routes:
  - `src/app/index.tsx`: Task List (main screen).
  - `src/app/task/[id].tsx`: Task Editor/Detail. `id = "new"` creates a task; a numeric id edits one.
  - `src/app/categories.tsx`: Category Management, opened from the "Categories" button in the list header (a `Link`).
- **Data transfer between screens: only the task id** goes through the route param. The editor loads the task from SQLite with `getTask`, so the form always shows the persisted values, deep links like `/task/3` work, and no stale object is passed around.
- **State management:** plain React state plus SQLite as the single source of truth. There is no global store (Redux, Zustand, etc.), because the screens share no in-memory state; they all read from the database.
  - The `useTasks(filter)` and `useCategories()` hooks query SQLite inside `useFocusEffect`. Lists reload when a screen regains focus (for example after saving in the editor or editing categories) and when the filter changes, because the callback depends on it.
  - After an action on the same screen (toggling a task, adding a category) the screen calls `reload()`.
  - Considered expo-sqlite's change listener (`addDatabaseChangeListener`). Not chosen: focus-based reload is simpler and covers every flow in this app.
- **Root setup:**
  - `SQLiteProvider databaseName="todo.db" onInit={migrateDbIfNeeded}` wraps the stack, so the database is opened and migrated before any screen renders.
  - `configureNotifications()` runs at module scope.
  - The root layout exports an `ErrorBoundary` (Expo Router convention). If the database cannot be opened, `SQLiteProvider` throws during render (I checked its source); the boundary then shows a message and a "Try again" button instead of a crash.
- **Task List UI:**
  - A segmented control for the status filter (All/Pending/Completed).
  - A horizontal row of chips for the category filter (All categories / each category / Uncategorized).
  - Each row shows: a checkbox that toggles completed/pending, the title (struck through when completed), a "Pending"/"Completed" label, a category badge with colour, and the due date (red "Overdue" if pending and in the past).
  - A floating "+ New task" button.
  - If the selected category filter is deleted, the filter falls back to "All".
- **Editor UI:**
  - Fields: title (required, inline error), description (multiline), category chips (None + categories), due date and time (optional), completed switch.
  - Actions: Save, Cancel (asks before discarding unsaved changes) and Delete (with confirmation; only shown when editing).
- **Due date field:**
  - Android: buttons call `DateTimePickerAndroid.open` for the date and time dialogs. This is the imperative API; the picker uses `onValueChange` because `onChange` is deprecated in v9.
  - iOS: two `display="compact"` pickers.
  - Adding a due date defaults to the next full hour.
  - A hint tells the user whether a reminder will be scheduled or not (time in the past).
- **Category Management UI:**
  - An add form (name + colour swatches).
  - A list with colour, name and task count.
  - Rename (inline edit of name and colour) and Delete. The delete confirmation says how many tasks will become uncategorized.
- **Error feedback:**
  - `showError()` shows the `ValidationError` message, or a generic message for unexpected errors (which are also logged).
  - `explainReminderOutcome()` explains when a reminder could not be scheduled. The permission warning is shown once per session; when permission is blocked it offers "Open settings".
- Removed the unused template files: explore screen, tabs, animated icon, hint row, web badge, collapsible, `reset-project` script and unused images.

### Actions Performed

- Modified `src/app/_layout.tsx` and `src/app/index.tsx`; created `src/app/task/[id].tsx` and `src/app/categories.tsx`.
- Created the components `button`, `chip` (+ `CategoryBadge`), `segmented-control`, `task-row`, `due-date-field`.
- Created the hooks `use-tasks`, `use-categories`, `use-now`, and the helpers `src/lib/dates.ts` and `src/lib/errors.ts`.
- Added colour tokens to `src/constants/theme.ts` (`border`, `primary`, `onPrimary`, `danger`, `success`).
- The first `npx expo lint` run added `eslint`, `eslint-config-expo` and `eslint.config.js`.

### Result

- `npx tsc --noEmit`: passes (after regenerating the typed routes, see below).
- `npx expo lint`: passes (after the fixes below).
- Metro Android bundle: `Android Bundled 36058ms ... (1383 modules)`, HTTP 200.

### Problems / Errors

1. `tsc`: `Type '"/task/[id]"' is not assignable to type '... "/explore" | "/" | "/_sitemap"'`. The typed-routes file `.expo/types/router.d.ts` was still generated from the template routes.
2. `npx expo lint` (first run) set up ESLint but then failed with `Error: Cannot find module 'eslint'` in the same process (pnpm installs it after the CLI has already resolved its modules).
3. ESLint (React Compiler rules from `eslint-plugin-react-hooks` v7) reported 4 errors:
   - `react-hooks/purity`: "Cannot call impure function during render" for `Date.now()` in `task-row.tsx` and `due-date-field.tsx`.
   - `react-hooks/set-state-in-effect` in `task/[id].tsx`: the effect called `setNotFound`/`setLoading` synchronously for an invalid id.
   - The same rule in the template's `use-color-scheme.web.ts` (`setHasHydrated(true)` in an effect).

### Fixes Attempted

1. Started the dev server (`npx expo start`), which regenerates the route types. `tsc` then passed.
2. Re-ran `npx expo lint`; it worked the second time.
3. Fixes for the lint errors:
   - Added a `useNow()` hook: the time is kept in state and refreshed by an interval. Render stays pure, and "Overdue" or "in the past" labels update while the screen is open.
   - Derived `notFound` from the id (`invalidId || missing`) instead of setting state in the effect.
   - Rewrote the web hydration check with `useSyncExternalStore` (server snapshot `false`, client `true`).

### Current Status

Needs testing (builds, typechecks and lints; runtime still to be verified on a device)
