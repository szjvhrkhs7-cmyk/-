import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateRemaining, hasLegacyData, migrateState, normalizeAmount, totalAmounts } from '../utils.js';

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
