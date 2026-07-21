const BACKUP_FORMAT = 'puls-backup';
const BACKUP_VERSION = 1;

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

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function assertOptionalArray(source, key) {
  if (key in source && !Array.isArray(source[key])) {
    throw new Error(`Поле «${key}» должно быть массивом.`);
  }
}

function assertEntryArray(source, key, textField) {
  assertOptionalArray(source, key);
  if (!Array.isArray(source[key])) return;

  source[key].forEach((item, index) => {
    if (!isObject(item)) throw new Error(`Некорректная строка ${index + 1} в поле «${key}».`);
    if (textField in item && typeof item[textField] !== 'string') {
      throw new Error(`Некорректное название в строке ${index + 1} поля «${key}».`);
    }
    if ('amount' in item && typeof item.amount !== 'string' && typeof item.amount !== 'number') {
      throw new Error(`Некорректная сумма в строке ${index + 1} поля «${key}».`);
    }
  });
}

function validateBackupState(source) {
  if (!isObject(source)) throw new Error('В резервной копии отсутствуют данные приложения.');

  const recognized = ['income', 'plannedExpenses', 'subscriptions', 'legacyArchive', 'categories', 'expenses'];
  if (!recognized.some((key) => key in source)) {
    throw new Error('Файл не является резервной копией приложения «Пульс».');
  }

  if ('income' in source && typeof source.income !== 'string' && typeof source.income !== 'number') {
    throw new Error('Поле «income» содержит некорректное значение.');
  }

  assertEntryArray(source, 'plannedExpenses', 'category');
  assertEntryArray(source, 'subscriptions', 'name');
  assertOptionalArray(source, 'categories');
  assertOptionalArray(source, 'expenses');

  if ('legacyArchive' in source) {
    if (!isObject(source.legacyArchive)) throw new Error('Поле «legacyArchive» содержит некорректное значение.');
    assertOptionalArray(source.legacyArchive, 'categories');
    assertOptionalArray(source.legacyArchive, 'expenses');
  }
}

export function createBackupPayload(rawState, createdAt = new Date().toISOString()) {
  const normalizedDate = new Date(createdAt);
  if (Number.isNaN(normalizedDate.getTime())) throw new Error('Некорректная дата резервной копии.');

  return {
    format: BACKUP_FORMAT,
    backupVersion: BACKUP_VERSION,
    createdAt: normalizedDate.toISOString(),
    appState: migrateState(rawState)
  };
}

export function parseBackupPayload(input) {
  let payload;
  try {
    payload = typeof input === 'string' ? JSON.parse(input) : input;
  } catch {
    throw new Error('Не удалось прочитать JSON-файл резервной копии.');
  }

  if (!isObject(payload)) throw new Error('Файл резервной копии имеет некорректный формат.');

  let source = payload;
  if ('format' in payload || 'appState' in payload) {
    if (payload.format !== BACKUP_FORMAT || payload.backupVersion !== BACKUP_VERSION || !isObject(payload.appState)) {
      throw new Error('Версия или формат резервной копии не поддерживается.');
    }
    source = payload.appState;
  }

  validateBackupState(source);
  return migrateState(source);
}
