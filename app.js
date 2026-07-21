import { calculateRemaining, hasLegacyData, migrateState, normalizeAmount, totalAmounts } from './utils.js';

const STORAGE_KEY = 'koshelek-v1';
const LEGACY_BACKUP_KEY = 'koshelek-v1-legacy-backup';
const defaultState = {
  version: 3,
  income: '',
  plannedExpenses: [],
  subscriptions: [],
  legacyArchive: {
    categories: [],
    expenses: []
  }
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
    const rawState = localStorage.getItem(STORAGE_KEY);
    if (!rawState) return structuredClone(defaultState);

    const parsed = JSON.parse(rawState);

    if (hasLegacyData(parsed) && !localStorage.getItem(LEGACY_BACKUP_KEY)) {
      try {
        localStorage.setItem(LEGACY_BACKUP_KEY, rawState);
      } catch {
        // Основная миграция продолжает работать, даже если для дополнительной копии не хватило места.
      }
    }

    const migrated = migrateState(parsed);
    migrated.plannedExpenses = migrated.plannedExpenses.map((item) => ({
      ...item,
      id: item.id || createId()
    }));
    migrated.subscriptions = migrated.subscriptions.map((item) => ({
      ...item,
      id: item.id || createId()
    }));
    return migrated;
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

function normalizedSubscriptions() {
  return state.subscriptions
    .map((item) => ({ name: item.name.trim() || 'Без названия', amount: normalizeAmount(item.amount) || 0 }))
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

function renderSubscriptions() {
  const container = $('#subscriptionRows');

  if (!state.subscriptions.length) {
    container.innerHTML = '<div class="subscription-empty">Нажмите «+ подписка», чтобы добавить первую строку.</div>';
  } else {
    container.replaceChildren(...state.subscriptions.map((item) => {
      const row = document.createElement('div');
      row.className = 'subscription-row';
      row.dataset.id = item.id;
      row.innerHTML = `
        <input class="subscription-name" value="${escapeHtml(item.name)}" maxlength="50" aria-label="Название подписки" placeholder="Например, Яндекс Плюс">
        <div class="subscription-money"><input class="subscription-amount" value="${escapeHtml(item.amount || '')}" inputmode="decimal" aria-label="Стоимость подписки" placeholder="0"><span>₽</span></div>
        <button class="delete-subscription" type="button" aria-label="Удалить подписку">×</button>`;
      return row;
    }));
  }

  $('#subscriptionTotal').textContent = money.format(totalAmounts(normalizedSubscriptions()));
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

function addSubscriptionRow() {
  const item = { id: createId(), name: '', amount: '' };
  state.subscriptions.push(item);
  saveState();
  renderSubscriptions();

  requestAnimationFrame(() => {
    const input = document.querySelector(`.subscription-row[data-id="${CSS.escape(item.id)}"] .subscription-name`);
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

function updateSubscriptionRow(row) {
  const item = state.subscriptions.find((entry) => entry.id === row.dataset.id);
  if (!item) return;

  item.name = row.querySelector('.subscription-name').value.trimStart();
  item.amount = row.querySelector('.subscription-amount').value;
  saveState();
  $('#subscriptionTotal').textContent = money.format(totalAmounts(normalizedSubscriptions()));
}

function switchPage(page, updateHash = true) {
  const nextPage = page === 'subscriptions' ? 'subscriptions' : 'budget';

  document.querySelectorAll('[data-page]').forEach((panel) => {
    panel.classList.toggle('hidden', panel.dataset.page !== nextPage);
  });
  document.querySelectorAll('[data-page-target]').forEach((button) => {
    const active = button.dataset.pageTarget === nextPage;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', String(active));
  });

  if (updateHash) history.replaceState(null, '', nextPage === 'subscriptions' ? '#subscriptions' : '#budget');
}

const incomeInput = $('#incomeInput');
incomeInput.value = state.income;
incomeInput.addEventListener('input', () => {
  state.income = incomeInput.value;
  saveState();
  renderBudgetSummary();
});

$('#appTabs').addEventListener('click', (event) => {
  const button = event.target.closest('[data-page-target]');
  if (button) switchPage(button.dataset.pageTarget);
});

$('#addPlannedRowButton').addEventListener('click', addPlannedRow);
$('#addSubscriptionRowButton').addEventListener('click', addSubscriptionRow);

$('#plannedRows').addEventListener('input', (event) => {
  const row = event.target.closest('.planned-row');
  if (row) updatePlannedRow(row);
});

$('#subscriptionRows').addEventListener('input', (event) => {
  const row = event.target.closest('.subscription-row');
  if (row) updateSubscriptionRow(row);
});

$('#plannedRows').addEventListener('focusout', (event) => {
  const row = event.target.closest('.planned-row');
  if (!row) return;

  const item = state.plannedExpenses.find((entry) => entry.id === row.dataset.id);
  if (item) item.category = item.category.trim();
  saveState();
});

$('#subscriptionRows').addEventListener('focusout', (event) => {
  const row = event.target.closest('.subscription-row');
  if (!row) return;

  const item = state.subscriptions.find((entry) => entry.id === row.dataset.id);
  if (item) item.name = item.name.trim();
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

$('#subscriptionRows').addEventListener('click', (event) => {
  const button = event.target.closest('.delete-subscription');
  if (!button) return;

  const row = button.closest('.subscription-row');
  state.subscriptions = state.subscriptions.filter((item) => item.id !== row.dataset.id);
  saveState();
  renderSubscriptions();
});

window.addEventListener('hashchange', () => switchPage(location.hash.slice(1), false));

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

// После первого запуска старые плановые данные остаются рабочими, а категории и фактические операции сохраняются в архиве.
saveState();
renderPlannedExpenses();
renderSubscriptions();
switchPage(location.hash.slice(1), false);
