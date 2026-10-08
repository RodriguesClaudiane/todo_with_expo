/**
 * Smoke test for the SQLite data layer (src/db) without a device.
 *
 * Transpiles src/db/*.ts with the project's TypeScript and runs it against
 * Node's built-in `node:sqlite`, wrapped in a minimal adapter that mimics the
 * expo-sqlite async API used by the app (execAsync, runAsync, getFirstAsync,
 * getAllAsync, withTransactionAsync). The SQL itself is exactly what the app runs.
 *
 * Usage: node scripts/db-smoke-test.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import ts from 'typescript';

const root = path.resolve(import.meta.dirname, '..');
const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'todo-db-'));

for (const file of fs.readdirSync(path.join(root, 'src/db'))) {
  if (!file.endsWith('.ts')) continue;
  const source = fs.readFileSync(path.join(root, 'src/db', file), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  fs.writeFileSync(path.join(outDir, file.replace(/\.ts$/, '.js')), outputText);
}

const require = createRequire(import.meta.url);
const { migrateDbIfNeeded } = require(path.join(outDir, 'schema.js'));
const categories = require(path.join(outDir, 'categories.js'));
const tasks = require(path.join(outDir, 'tasks.js'));

function open(file) {
  const db = new DatabaseSync(file);
  const params = (args) => (args.length === 1 && Array.isArray(args[0]) ? args[0] : args);
  return {
    raw: db,
    async execAsync(sql) {
      db.exec(sql);
    },
    async runAsync(sql, ...args) {
      const r = db.prepare(sql).run(...params(args));
      return { changes: Number(r.changes), lastInsertRowId: Number(r.lastInsertRowid) };
    },
    async getFirstAsync(sql, ...args) {
      return db.prepare(sql).get(...params(args)) ?? null;
    },
    async getAllAsync(sql, ...args) {
      return db.prepare(sql).all(...params(args));
    },
    async withTransactionAsync(task) {
      db.exec('BEGIN');
      try {
        await task();
        db.exec('COMMIT');
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    },
    close() {
      db.close();
    },
  };
}

const dbFile = path.join(outDir, 'todo.db');
let passed = 0;
async function test(name, fn) {
  await fn();
  passed++;
  console.log(`  ✓ ${name}`);
}

let db = open(dbFile);
await migrateDbIfNeeded(db);

await test('migration creates schema, seeds 4 categories, sets user_version', async () => {
  const cats = await categories.listCategories(db);
  assert.deepEqual(cats.map((c) => c.name), ['Personal', 'Shopping', 'Study', 'Work']);
  assert.equal((await db.getFirstAsync('PRAGMA user_version')).user_version, 1);
  assert.equal((await db.getFirstAsync('PRAGMA foreign_keys')).foreign_keys, 1);
});

await test('migration is idempotent (second run does not duplicate seed data)', async () => {
  await migrateDbIfNeeded(db);
  assert.equal((await categories.listCategories(db)).length, 4);
});

const cats = await categories.listCategories(db);
const work = cats.find((c) => c.name === 'Work');
const study = cats.find((c) => c.name === 'Study');
const future = Date.now() + 3_600_000;

let t1, t2, t3;
await test('create tasks (with and without category / due date)', async () => {
  t1 = await tasks.createTask(db, { title: '  Write report  ', description: ' draft ', completed: false, dueDateTime: future, categoryId: work.id });
  t2 = await tasks.createTask(db, { title: 'Read chapter 3', description: '', completed: false, dueDateTime: null, categoryId: study.id });
  t3 = await tasks.createTask(db, { title: 'Buy milk', description: '', completed: true, dueDateTime: null, categoryId: null });
  assert.equal(t1.title, 'Write report');
  assert.equal(t1.description, 'draft');
  const got = await tasks.getTask(db, t1.id);
  assert.equal(got.categoryName, 'Work');
  assert.equal(got.dueDateTime, future);
  assert.equal(got.completed, false);
  assert.ok(got.createdAt > 0);
});

await test('title is required / validated', async () => {
  await assert.rejects(
    tasks.createTask(db, { title: '   ', description: '', completed: false, dueDateTime: null, categoryId: null }),
    { name: 'ValidationError', message: 'Title is required.' }
  );
  await assert.rejects(
    tasks.createTask(db, { title: 'x', description: '', completed: false, dueDateTime: NaN, categoryId: null }),
    { name: 'ValidationError' }
  );
});

await test('status filter: all / pending / completed', async () => {
  const all = await tasks.listTasks(db, { status: 'all', category: 'all' });
  const pending = await tasks.listTasks(db, { status: 'pending', category: 'all' });
  const done = await tasks.listTasks(db, { status: 'completed', category: 'all' });
  assert.equal(all.length, 3);
  assert.deepEqual(pending.map((t) => t.id).sort(), [t1.id, t2.id].sort());
  assert.deepEqual(done.map((t) => t.id), [t3.id]);
  // Pending tasks with a due date first
  assert.equal(all[0].id, t1.id);
});

await test('category filter: specific / uncategorized / combined with status', async () => {
  assert.deepEqual((await tasks.listTasks(db, { status: 'all', category: work.id })).map((t) => t.id), [t1.id]);
  assert.deepEqual((await tasks.listTasks(db, { status: 'all', category: 'none' })).map((t) => t.id), [t3.id]);
  assert.equal((await tasks.listTasks(db, { status: 'completed', category: work.id })).length, 0);
});

await test('edit task persists changes', async () => {
  await tasks.updateTask(db, t2.id, { title: 'Read chapter 4', description: 'p. 80', completed: false, dueDateTime: future, categoryId: work.id });
  const got = await tasks.getTask(db, t2.id);
  assert.equal(got.title, 'Read chapter 4');
  assert.equal(got.categoryId, work.id);
  assert.equal(got.dueDateTime, future);
  await assert.rejects(tasks.updateTask(db, 9999, { title: 'x', description: '', completed: false, dueDateTime: null, categoryId: null }), {
    name: 'ValidationError',
  });
});

await test('complete and reopen task', async () => {
  await tasks.setTaskCompleted(db, t1.id, true);
  assert.equal((await tasks.getTask(db, t1.id)).completed, true);
  await tasks.setTaskCompleted(db, t1.id, false);
  assert.equal((await tasks.getTask(db, t1.id)).completed, false);
});

await test('notification id stored and cleared', async () => {
  await tasks.setTaskNotificationId(db, t1.id, 'abc-123');
  assert.equal((await tasks.getTask(db, t1.id)).notificationId, 'abc-123');
  await tasks.setTaskNotificationId(db, t1.id, null);
  assert.equal((await tasks.getTask(db, t1.id)).notificationId, null);
});

let errands;
await test('category create / duplicate / rename', async () => {
  errands = await categories.createCategory(db, ' Errands ', '#E5484D');
  assert.equal(errands.name, 'Errands');
  await assert.rejects(categories.createCategory(db, 'errands', '#000'), { name: 'ValidationError' });
  await assert.rejects(categories.createCategory(db, '  ', '#000'), { name: 'ValidationError' });
  await categories.updateCategory(db, errands.id, 'Chores', '#30A46C');
  await assert.rejects(categories.updateCategory(db, errands.id, 'work', '#000'), { name: 'ValidationError' });
  const list = await categories.listCategories(db);
  assert.ok(list.some((c) => c.name === 'Chores' && c.color === '#30A46C'));
});

await test('task counts per category', async () => {
  const list = await categories.listCategories(db);
  assert.equal(list.find((c) => c.id === work.id).taskCount, 2);
  assert.equal(list.find((c) => c.id === errands.id).taskCount, 0);
});

await test('delete category leaves its tasks uncategorized', async () => {
  const affected = await categories.deleteCategory(db, work.id);
  assert.equal(affected, 2);
  assert.equal((await tasks.getTask(db, t1.id)).categoryId, null);
  assert.equal((await tasks.getTask(db, t1.id)).categoryName, null);
  assert.equal((await tasks.listTasks(db, { status: 'all', category: 'none' })).length, 3);
});

await test('FK ON DELETE SET NULL also works for a raw DELETE', async () => {
  await tasks.updateTask(db, t3.id, { title: 'Buy milk', description: '', completed: true, dueDateTime: null, categoryId: study.id });
  db.raw.exec(`DELETE FROM categories WHERE id = ${study.id}`);
  assert.equal((await tasks.getTask(db, t3.id)).categoryId, null);
});

await test('delete task', async () => {
  await tasks.deleteTask(db, t2.id);
  assert.equal(await tasks.getTask(db, t2.id), null);
});

await test('data persists after closing and reopening the database file', async () => {
  db.close();
  db = open(dbFile);
  await migrateDbIfNeeded(db);
  const all = await tasks.listTasks(db, { status: 'all', category: 'all' });
  assert.deepEqual(all.map((t) => t.title).sort(), ['Buy milk', 'Write report']);
  assert.ok((await categories.listCategories(db)).some((c) => c.name === 'Chores'));
});

db.close();
fs.rmSync(outDir, { recursive: true, force: true });
console.log(`\n${passed} checks passed`);
