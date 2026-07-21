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

export function hasLegacyData(rawState) {
  return Boolean(rawState && typeof rawState === 'object' && (
    Array.isArray(rawState.categories) || Array.isArray(rawState.expenses)
  ));
}

export function migrateState(rawState) {
  const source = rawState && typeof rawState === 'object' ? rawState : {};
  const existingArchive = source.legacyArchive && typeof source.legacyArchive === 'object'
    ? source.legacyArchive
    : {};

  const archivedCategories = [
    ...(Array.isArray(existingArchive.categories) ? existingArchive.categories : []),
    ...(Array.isArray(source.categories) ? source.categories : [])
  ].filter((category, index, items) => typeof category === 'string' && items.indexOf(category) === index);

  const archivedExpenses = [
    ...(Array.isArray(existingArchive.expenses) ? existingArchive.expenses : []),
    ...(Array.isArray(source.expenses) ? source.expenses : [])
  ].filter((expense) => expense && typeof expense === 'object');

  const plannedExpenses = Array.isArray(source.plannedExpenses)
    ? source.plannedExpenses.map((item) => ({
        id: item?.id ? String(item.id) : '',
        category: typeof item?.category === 'string' ? item.category : '',
        amount: typeof item?.amount === 'string' || typeof item?.amount === 'number' ? item.amount : ''
      }))
    : [];

  const subscriptions = Array.isArray(source.subscriptions)
    ? source.subscriptions.map((item) => ({
        id: item?.id ? String(item.id) : '',
        name: typeof item?.name === 'string' ? item.name : '',
        amount: typeof item?.amount === 'string' || typeof item?.amount === 'number' ? item.amount : ''
      }))
    : [];

  return {
    version: 3,
    income: typeof source.income === 'string' || typeof source.income === 'number' ? source.income : '',
    plannedExpenses,
    subscriptions,
    legacyArchive: {
      categories: archivedCategories,
      expenses: archivedExpenses
    }
  };
}
