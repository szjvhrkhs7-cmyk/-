import { PERIOD_MONTHS, filterExpenses, groupByCategory, groupByMonth, normalizeAmount, totalExpenses } from './utils.js';

const STORAGE_KEY = 'koshelek-v1';
const defaultState = {
  categories: ['Продукты', 'Транспорт', 'Дом', 'Здоровье', 'Развлечения'],
  expenses: [],
  plannedExpenses: []
};
let state = loadState();
let analyticsPeriod = 'month';
let deferredInstallPrompt = null;

const $ = (selector) => document.querySelector(selector);
const money = new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 2 });
const monthName = new Intl.DateTimeFormat('ru-RU', { month: 'short', year: '2-digit' });

const monthPicker = $('#monthPicker');
const dateInput = $('#dateInput');
monthPicker.value = currentMonth();
dateInput.value = new Date().toISOString().slice(0, 10);

function loadState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!parsed || !Array.isArray(parsed.categories) || !Array.isArray(parsed.expenses)) return structuredClone(defaultState);
    return {
      ...parsed,
      plannedExpenses: Array.isArray(parsed.plannedExpenses) ? parsed.plannedExpenses : []
    };
  } catch {
    return structuredClone(defaultState);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function createId() {
  return typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

function showToast(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.remove('hidden');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.add('hidden'), 2600);
}

function renderCategories() {
  const select = $('#categorySelect');
  const selected = select.value;
  select.replaceChildren(...state.categories.map((category) => new Option(category, category)));
  if (state.categories.includes(selected)) select.value = selected;
}

function selectedMonthExpenses() {
  return state.expenses
    .filter((expense) => expense.date.startsWith(monthPicker.value))
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
}

function pluralizeEntries(count) {
  const lastTwo = count % 100;
  const last = count % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return `${count} записей`;
  if (last === 1) return `${count} запись`;
  if (last >= 2 && last <= 4) return `${count} записи`;
  return `${count} записей`;
}

function renderExpenses() {
  const expenses = selectedMonthExpenses();
  const total = totalExpenses(expenses);
  const rows = $('#expenseRows');
  rows.replaceChildren(...expenses.map((expense) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${escapeHtml(expense.category)}</td><td>${new Date(`${expense.date}T12:00:00`).toLocaleDateString('ru-RU')}</td><td class="amount">${money.format(expense.amount)}</td><td><button class="delete-row" type="button" aria-label="Удалить расход" data-id="${expense.id}">×</button></td>`;
    return tr;
  }));
  $('#monthTotal').textContent = money.format(total);
  $('#heroTotal').textContent = money.format(total);
  $('#expenseCounter').textContent = pluralizeEntries(expenses.length);
  $('#emptyExpenses').classList.toggle('hidden', expenses.length > 0);
}

function normalizedPlannedExpenses() {
  return state.plannedExpenses
    .map((item) => ({ category: item.category.trim() || 'Без категории', amount: normalizeAmount(item.amount) || 0 }))
    .filter((item) => item.amount > 0);
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
        <input class="planned-category" value="${escapeHtml(item.category)}" maxlength="50" aria-label="Категория планируемой траты" placeholder="Название категории">
        <div class="planned-money"><input class="planned-amount" value="${escapeHtml(item.amount || '')}" inputmode="decimal" aria-label="Сумма планируемой траты" placeholder="0"><span>₽</span></div>
        <button class="delete-planned" type="button" aria-label="Удалить планируемую трату">×</button>`;
      return row;
    }));
  }
  $('#plannedTotal').textContent = money.format(totalExpenses(normalizedPlannedExpenses()));
}

function addPlannedRow() {
  const item = { id: createId(), category: '', amount: '' };
  state.plannedExpenses.push(item);
  saveState();
  renderPlannedExpenses();
  renderAnalytics();
  requestAnimationFrame(() => {
    const input = document.querySelector(`.planned-row[data-id="${item.id}"] .planned-category`);
    input?.focus({ preventScroll: true });
  });
}

function updatePlannedRow(row) {
  const item = state.plannedExpenses.find((entry) => entry.id === row.dataset.id);
  if (!item) return;
  item.category = row.querySelector('.planned-category').value.trimStart();
  item.amount = row.querySelector('.planned-amount').value;
  saveState();
  $('#plannedTotal').textContent = money.format(totalExpenses(normalizedPlannedExpenses()));
  renderAnalytics();
}

function renderAnalytics() {
  const reference = new Date();
  const expenses = filterExpenses(state.expenses, reference, PERIOD_MONTHS[analyticsPeriod]);
  const planned = normalizedPlannedExpenses();
  $('#analyticsTotal').textContent = money.format(totalExpenses(expenses));
  $('#plannedAnalyticsTotal').textContent = money.format(totalExpenses(planned));
  renderBars('#categoryChart', groupByCategory(expenses), (key) => key);
  renderBars('#monthChart', groupByMonth(expenses), (key) => monthName.format(new Date(`${key}-01T12:00:00`)), true);
  renderBars('#plannedCategoryChart', groupByCategory(planned), (key) => key, false, 'Добавьте суммы в планируемые траты, чтобы увидеть их здесь.');
}

function renderBars(selector, grouped, labelFormatter, chronological = false, emptyText = 'Добавьте расходы, чтобы увидеть аналитику.') {
  const container = $(selector);
  if (!container) return;
  let entries = Object.entries(grouped);
  entries.sort(chronological ? ([a], [b]) => a.localeCompare(b) : ([, a], [, b]) => b - a);
  const maximum = Math.max(...entries.map(([, value]) => value), 1);
  if (!entries.length) {
    container.innerHTML = `<div class="empty"><div class="empty-icon">⌁</div><strong>Недостаточно данных</strong><span>${escapeHtml(emptyText)}</span></div>`;
    return;
  }
  container.replaceChildren(...entries.map(([key, value]) => {
    const row = document.createElement('div');
    row.className = 'bar-row';
    row.innerHTML = `<div class="bar-meta"><span>${escapeHtml(labelFormatter(key))}</span><strong>${money.format(value)}</strong></div><div class="bar-track"><span style="width:${Math.max(4, value / maximum * 100)}%"></span></div>`;
    return row;
  }));
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

$('#expenseForm').addEventListener('submit', (event) => {
  event.preventDefault();
  const amount = normalizeAmount($('#amountInput').value);
  if (!amount) return showToast('Введите сумму больше нуля');
  state.expenses.push({ id: createId(), category: $('#categorySelect').value, amount, date: dateInput.value, createdAt: new Date().toISOString() });
  saveState();
  $('#amountInput').value = '';
  monthPicker.value = dateInput.value.slice(0, 7);
  renderExpenses();
  renderAnalytics();
  showToast('Расход добавлен');
});

$('#expenseRows').addEventListener('click', (event) => {
  const button = event.target.closest('[data-id]');
  if (!button || !confirm('Удалить эту запись?')) return;
  state.expenses = state.expenses.filter((expense) => expense.id !== button.dataset.id);
  saveState();
  renderExpenses();
  renderAnalytics();
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
  renderAnalytics();
});
$('#plannedRows').addEventListener('click', (event) => {
  const button = event.target.closest('.delete-planned');
  if (!button) return;
  const row = button.closest('.planned-row');
  state.plannedExpenses = state.plannedExpenses.filter((item) => item.id !== row.dataset.id);
  saveState();
  renderPlannedExpenses();
  renderAnalytics();
});

monthPicker.addEventListener('change', renderExpenses);
$('#addCategoryButton').addEventListener('click', () => { $('#categoryDialog').showModal(); $('#categoryNameInput').focus({ preventScroll: true }); });
$('#categoryForm').addEventListener('submit', (event) => {
  event.preventDefault();
  const name = $('#categoryNameInput').value.trim();
  if (!name) return;
  if (state.categories.some((item) => item.toLocaleLowerCase('ru') === name.toLocaleLowerCase('ru'))) return showToast('Такая категория уже существует');
  state.categories.push(name);
  saveState();
  renderCategories();
  $('#categorySelect').value = name;
  $('#categoryNameInput').value = '';
  $('#categoryDialog').close();
});

document.querySelectorAll('.tab').forEach((button) => button.addEventListener('click', () => {
  document.querySelectorAll('.tab').forEach((item) => item.classList.toggle('active', item === button));
  document.querySelectorAll('.view').forEach((view) => view.classList.remove('active'));
  $(`#${button.dataset.view}View`).classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (button.dataset.view === 'analytics') renderAnalytics();
}));

document.querySelectorAll('.period').forEach((button) => button.addEventListener('click', () => {
  analyticsPeriod = button.dataset.period;
  document.querySelectorAll('.period').forEach((item) => item.classList.toggle('active', item === button));
  renderAnalytics();
}));

$('#exportButton').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `puls-backup-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
});

$('#importInput').addEventListener('change', async (event) => {
  try {
    const file = event.target.files?.[0];
    if (!file) return;
    const parsed = JSON.parse(await file.text());
    if (!Array.isArray(parsed.categories) || !Array.isArray(parsed.expenses)) throw new Error();
    state = { ...parsed, plannedExpenses: Array.isArray(parsed.plannedExpenses) ? parsed.plannedExpenses : [] };
    saveState();
    renderCategories(); renderPlannedExpenses(); renderExpenses(); renderAnalytics();
    showToast('Резервная копия загружена');
  } catch { showToast('Не удалось прочитать файл'); }
  event.target.value = '';
});

$('#clearButton').addEventListener('click', () => {
  if (!confirm('Удалить все категории, расходы и планируемые траты без возможности восстановления?')) return;
  state = structuredClone(defaultState);
  saveState(); renderCategories(); renderPlannedExpenses(); renderExpenses(); renderAnalytics();
});

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault(); deferredInstallPrompt = event; $('#installButton').classList.remove('hidden');
});
$('#installButton').addEventListener('click', async () => { if (deferredInstallPrompt) await deferredInstallPrompt.prompt(); });
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js'));

document.addEventListener('gesturestart', (event) => event.preventDefault());
document.addEventListener('dblclick', (event) => event.preventDefault(), { passive: false });

renderCategories();
renderPlannedExpenses();
renderExpenses();
renderAnalytics();