import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAmount, totalExpenses, groupByCategory, filterExpenses } from '../utils.js';

test('normalizeAmount accepts comma decimals', () => {
  assert.equal(normalizeAmount('1 234,56'), 1234.56);
  assert.equal(normalizeAmount('0'), null);
  assert.equal(normalizeAmount('abc'), null);
});

test('totalExpenses sums and rounds values', () => {
  assert.equal(totalExpenses([{ amount: 10.1 }, { amount: 20.25 }]), 30.35);
});

test('groupByCategory aggregates categories', () => {
  assert.deepEqual(groupByCategory([
    { category: 'Дом', amount: 10 },
    { category: 'Дом', amount: 15 },
    { category: 'Еда', amount: 7 }
  ]), { 'Дом': 25, 'Еда': 7 });
});

test('filterExpenses limits records to rolling month window', () => {
  const expenses = [
    { date: '2026-07-01' },
    { date: '2026-06-15' },
    { date: '2026-05-31' }
  ];
  assert.deepEqual(filterExpenses(expenses, new Date('2026-07-13T12:00:00'), 2), expenses.slice(0, 2));
});
