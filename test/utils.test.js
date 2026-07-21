import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateRemaining,
  createBackupPayload,
  hasLegacyData,
  migrateState,
  normalizeAmount,
  parseBackupPayload,
  totalAmounts
} from '../utils.js';

test('normalizeAmount accepts comma decimals', () => {
  assert.equal(normalizeAmount('1 234,56'), 1234.56);
  assert.equal(normalizeAmount('0'), null);
  assert.equal(normalizeAmount('-10'), null);
  assert.equal(normalizeAmount('abc'), null);
});

test('totalAmounts sums and rounds values', () => {
  assert.equal(totalAmounts([{ amount: 10.1 }, { amount: 20.25 }]), 30.35);
});

test('calculateRemaining subtracts planned expenses from income', () => {
  assert.equal(calculateRemaining(100000, [{ amount: 25000 }, { amount: 15000.55 }]), 59999.45);
});

test('calculateRemaining returns a negative balance when the plan exceeds income', () => {
  assert.equal(calculateRemaining(1000, [{ amount: 1200 }]), -200);
});

test('migrateState preserves every field from the old finance model', () => {
  const oldState = {
    categories: ['Продукты', 'Дом'],
    expenses: [{ id: 'e1', category: 'Дом', amount: 5000, date: '2026-07-01', createdAt: '2026-07-01T10:00:00.000Z' }],
    plannedExpenses: [{ id: 'p1', category: 'Отпуск', amount: '30000' }]
  };

  assert.equal(hasLegacyData(oldState), true);
  assert.deepEqual(migrateState(oldState), {
    version: 3,
    income: '',
    plannedExpenses: [{ id: 'p1', category: 'Отпуск', amount: '30000' }],
    subscriptions: [],
    legacyArchive: {
      categories: ['Продукты', 'Дом'],
      expenses: oldState.expenses
    }
  });
});

test('migrateState adds subscriptions to an existing budget without losing data', () => {
  const previousState = {
    version: 2,
    income: '120000',
    plannedExpenses: [{ id: 'p1', category: 'Дом', amount: '45000' }],
    legacyArchive: {
      categories: ['Продукты'],
      expenses: [{ id: 'e1', amount: 100 }]
    }
  };

  assert.equal(hasLegacyData(previousState), false);
  assert.deepEqual(migrateState(previousState), {
    ...previousState,
    version: 3,
    subscriptions: []
  });
});

test('migrateState preserves subscription rows on repeat launches', () => {
  const currentState = {
    version: 3,
    income: '120000',
    plannedExpenses: [],
    subscriptions: [{ id: 's1', name: 'Музыка', amount: '299' }],
    legacyArchive: { categories: [], expenses: [] }
  };

  assert.deepEqual(migrateState(currentState), currentState);
});

test('backup payload round-trips the current app state', () => {
  const currentState = {
    version: 3,
    income: '150000',
    plannedExpenses: [{ id: 'p1', category: 'Жильё', amount: '50000' }],
    subscriptions: [{ id: 's1', name: 'Музыка', amount: '299' }],
    legacyArchive: { categories: [], expenses: [] }
  };

  const backup = createBackupPayload(currentState, '2026-07-21T12:00:00.000Z');
  assert.equal(backup.format, 'puls-backup');
  assert.equal(backup.backupVersion, 1);
  assert.equal(backup.createdAt, '2026-07-21T12:00:00.000Z');
  assert.deepEqual(parseBackupPayload(JSON.stringify(backup)), currentState);
});

test('backup import accepts a raw legacy state', () => {
  const legacy = {
    income: '90000',
    categories: ['Дом'],
    expenses: [{ id: 'e1', amount: 1000 }],
    plannedExpenses: [{ category: 'Отпуск', amount: 20000 }]
  };

  const restored = parseBackupPayload(legacy);
  assert.equal(restored.version, 3);
  assert.equal(restored.income, '90000');
  assert.equal(restored.plannedExpenses.length, 1);
  assert.deepEqual(restored.legacyArchive.categories, ['Дом']);
});

test('backup import rejects unrelated or malformed JSON', () => {
  assert.throws(() => parseBackupPayload('{bad json'), /JSON-файл/);
  assert.throws(() => parseBackupPayload({ hello: 'world' }), /не является резервной копией/);
  assert.throws(() => parseBackupPayload({ income: '', subscriptions: 'wrong' }), /должно быть массивом/);
  assert.throws(() => parseBackupPayload({ format: 'puls-backup', backupVersion: 2, appState: {} }), /не поддерживается/);
});
