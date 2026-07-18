import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateRemaining, normalizeAmount, totalAmounts } from '../utils.js';

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
