import { calculateRemaining, normalizeAmount, totalAmounts } from './utils.js';

const STORAGE_KEY = 'koshelek-v1';
const defaultState = {
  income: '',
  plannedExpenses: []
};

let state = loadState();
let deferredInstallPrompt = null;

const $ = (selector) => document.querySelector(selector);
const money = new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 2 });

function createId() {
  return typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

function loadState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!parsed || typeof parsed !== 'object') return structuredClone(defaultState);

    const plannedExpenses = Array.isArray(parsed.plannedExpenses)
      ? parsed.plannedExpenses.map((item) => ({
          id: item?.id ? String(item.id) : createId(),
          category: typeof item?.category === 'string' ? item.category : '',
          amount: typeof item?.amount === 'string' || typeof item?.amount === 'number' ? item.amount : ''
        }))
      : [];

    return {
      income: typeof parsed.income === 'string' || typeof parsed.income === 'number' ? parsed.income : '',
      plannedExpenses
    };
  } catch {
    return structuredClone(defaultState);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function normalizedPlannedExpenses() {
  return state.plannedExpenses
    .map((item) => ({ category: item.category.trim() || 'Без категории', amount: normalizeAmount(item.amount) || 0 }))
    .filter((item) => item.amount > 0);
}

function incomeAmount() {
  return normalizeAmount(state.income) || 0;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

function renderBudgetSummary() {
  const planned = normalizedPlannedExpenses();
  const plannedTotal = totalAmounts(planned);
  const income = incomeAmount();
  const remaining = calculateRemaining(income, planned);

  $('#plannedTotal').textContent = money.format(plannedTotal);
  $('#remainingAmount').textContent = money.format(remaining);
  $('#balanceHint').textContent = `Доход ${money.format(income)} − расходы ${money.format(plannedTotal)}`;
  $('#balanceCard').classList.toggle('negative', remaining < 0);
}

function renderPlannedExpenses() {
  const container = $('#plannedRows');

  if (!state.plannedExpenses.length) {
    container.innerHTML = '<div class="planned-empty">Нажмите «+ строка», чтобы добавить первую планируемую трату.</div>';
  } else {
    container.replaceChildren(...state.plannedExpenses.map((item) => {
      const row = document.createElement('div');
      row.className = 'planned-row';
      row.dataset.id = item.id;
      row.innerHTML = `
        <input class="planned-category" value="${escapeHtml(item.category)}" maxlength="50" aria-label="Название планируемой траты" placeholder="Например, продукты">
        <div class="planned-money"><input class="planned-amount" value="${escapeHtml(item.amount || '')}" inputmode="decimal" aria-label="Сумма планируемой траты" placeholder="0"><span>₽</span></div>
        <button class="delete-planned" type="button" aria-label="Удалить планируемую трату">×</button>`;
      return row;
    }));
  }

  renderBudgetSummary();
}

function addPlannedRow() {
  const item = { id: createId(), category: '', amount: '' };
  state.plannedExpenses.push(item);
  saveState();
  renderPlannedExpenses();

  requestAnimationFrame(() => {
    const input = document.querySelector(`.planned-row[data-id="${CSS.escape(item.id)}"] .planned-category`);
    input?.focus({ preventScroll: true });
  });
}

function updatePlannedRow(row) {
  const item = state.plannedExpenses.find((entry) => entry.id === row.dataset.id);
  if (!item) return;

  item.category = row.querySelector('.planned-category').value.trimStart();
  item.amount = row.querySelector('.planned-amount').value;
  saveState();
  renderBudgetSummary();
}

const incomeInput = $('#incomeInput');
incomeInput.value = state.income;
incomeInput.addEventListener('input', () => {
  state.income = incomeInput.value;
  saveState();
  renderBudgetSummary();
});

$('#addPlannedRowButton').addEventListener('click', addPlannedRow);

$('#plannedRows').addEventListener('input', (event) => {
  const row = event.target.closest('.planned-row');
  if (row) updatePlannedRow(row);
});

$('#plannedRows').addEventListener('focusout', (event) => {
  const row = event.target.closest('.planned-row');
  if (!row) return;

  const item = state.plannedExpenses.find((entry) => entry.id === row.dataset.id);
  if (item) item.category = item.category.trim();
  saveState();
});

$('#plannedRows').addEventListener('click', (event) => {
  const button = event.target.closest('.delete-planned');
  if (!button) return;

  const row = button.closest('.planned-row');
  state.plannedExpenses = state.plannedExpenses.filter((item) => item.id !== row.dataset.id);
  saveState();
  renderPlannedExpenses();
});

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  $('#installButton').classList.remove('hidden');
});

$('#installButton').addEventListener('click', async () => {
  if (deferredInstallPrompt) await deferredInstallPrompt.prompt();
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js'));
}

document.addEventListener('gesturestart', (event) => event.preventDefault());
document.addEventListener('dblclick', (event) => event.preventDefault(), { passive: false });

// Перезаписываем старую модель хранения: фактические расходы и их категории больше не сохраняются.
saveState();
renderPlannedExpenses();
