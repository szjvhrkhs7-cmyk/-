export function normalizeAmount(value) {
  const normalized = String(value ?? '').replace(/\s/g, '').replace(',', '.');
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount > 0 ? Math.round(amount * 100) / 100 : null;
}

export function totalAmounts(items) {
  return Math.round(items.reduce((sum, item) => sum + Number(item.amount || 0), 0) * 100) / 100;
}

export function calculateRemaining(income, plannedExpenses) {
  const numericIncome = Number(income || 0);
  const safeIncome = Number.isFinite(numericIncome) ? numericIncome : 0;
  return Math.round((safeIncome - totalAmounts(plannedExpenses)) * 100) / 100;
}
