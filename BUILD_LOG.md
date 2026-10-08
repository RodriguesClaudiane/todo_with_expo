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
