export const PERIOD_MONTHS = { month: 1, quarter: 3, halfYear: 6, year: 12 };

export function normalizeAmount(value) {
  const normalized = String(value ?? '').replace(/\s/g, '').replace(',', '.');
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount > 0 ? Math.round(amount * 100) / 100 : null;
}

export function monthKey(dateLike) {
  const date = new Date(dateLike);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function getPeriodStart(referenceDate, months) {
  const date = new Date(referenceDate);
  return new Date(date.getFullYear(), date.getMonth() - months + 1, 1);
}

export function filterExpenses(expenses, referenceDate, months) {
  const start = getPeriodStart(referenceDate, months);
  const end = new Date(referenceDate);
  end.setHours(23, 59, 59, 999);
  return expenses.filter((expense) => {
    const date = new Date(`${expense.date}T12:00:00`);
    return date >= start && date <= end;
  });
}

export function totalExpenses(expenses) {
  return Math.round(expenses.reduce((sum, item) => sum + Number(item.amount || 0), 0) * 100) / 100;
}

export function groupByCategory(expenses) {
  return expenses.reduce((result, expense) => {
    result[expense.category] = (result[expense.category] || 0) + Number(expense.amount || 0);
    return result;
  }, {});
}

export function groupByMonth(expenses) {
  return expenses.reduce((result, expense) => {
    const key = monthKey(`${expense.date}T12:00:00`);
    if (key) result[key] = (result[key] || 0) + Number(expense.amount || 0);
    return result;
  }, {});
}
