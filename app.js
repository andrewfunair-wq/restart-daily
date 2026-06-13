const PLAN_START = new Date(2026, 5, 15);
const RESET_MARKER = "restart-daily-v2-reset-complete";
const KEYS = {
  records: "restart-daily-v2-records",
  weeklyPlans: "restart-daily-v2-weekly-plans",
  inventory: "restart-daily-v2-inventory",
  declutters: "restart-daily-v2-declutters",
  accounts: "restart-daily-v2-finance-accounts",
  transactions: "restart-daily-v2-finance-transactions",
  snapshots: "restart-daily-v2-finance-snapshots",
  fxRates: "restart-daily-v2-fx-rates",
  knowledge: "restart-daily-v2-knowledge",
  knowledgeProgress: "restart-daily-v2-knowledge-progress",
};

const weekdayNames = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
const shortWeekdays = ["日", "一", "二", "三", "四", "五", "六"];
const exerciseNames = {
  run: "跑步", strengthA: "力量 A", strengthB: "力量 B",
  basketball: "篮球", walk: "快走", stretch: "拉伸", rest: "休息",
};
const inventoryCategories = ["数码产品", "衣物", "家居", "书籍", "运动", "其他"];
const inventoryStatuses = ["待确认", "持有", "闲置", "已出售", "已捐赠", "已丢弃"];
const currencies = ["CNY", "USD", "HKD", "EUR", "GBP", "JPY", "AUD", "CAD", "CHF", "SGD"];
const knowledgeCategories = ["科学", "历史", "文化", "经济", "技术", "心理", "健康", "地理"];
const actionLabels = { keep: "保留", sell: "出售", donate: "捐赠", discard: "丢弃" };
const actionStatuses = { keep: "持有", sell: "已出售", donate: "已捐赠", discard: "已丢弃" };

const firstWeekPlan = {
  "2026-06-15": { focus: "启动，不求完美", tasks: "不买酒、不喝酒 · 5公里轻松跑 · 建项目风险清单" },
  "2026-06-16": { focus: "第一次把力量训练捡起来", tasks: "力量训练 A · 明确一个任务交付标准" },
  "2026-06-17": { focus: "主动把问题列出来", tasks: "5公里稍快跑 · 更新风险清单 · 与关键经理沟通新要求" },
  "2026-06-18": { focus: "力量训练不能因忙取消", tasks: "力量训练 B · 建立交付质量五维标准" },
  "2026-06-19": { focus: "用复盘替代焦虑", tasks: "休息或快走 · 30分钟周复盘 · 对一个交付物做五维反馈" },
  "2026-06-20": { focus: "不用酒和手机填满空闲", tasks: "篮球或轻松跑 · 工作只处理一个必要事项" },
  "2026-06-21": { focus: "让下一周自动开始", tasks: "记录周最低与平均体重 · 准备食材 · 安排两次力量训练" },
};
const weeklyRhythm = [
  "下周计划、体重复盘、准备食物", "定目标、排风险、轻松跑", "力量训练、布置关键任务",
  "客户事项检查、跑步", "力量训练、团队质量复核", "工作复盘、下属反馈", "运动、家庭、断舍离",
];

runOneTimeReset();

const state = {
  selectedDate: clampDate(new Date()),
  weekOffset: 0,
  records: load(KEYS.records, {}),
  weeklyPlans: load(KEYS.weeklyPlans, {}),
  inventory: load(KEYS.inventory, []),
  declutters: load(KEYS.declutters, []),
  accounts: load(KEYS.accounts, []),
  transactions: load(KEYS.transactions, []),
  snapshots: load(KEYS.snapshots, []),
  fxRates: load(KEYS.fxRates, {}),
  knowledge: load(KEYS.knowledge, {}),
  knowledgeProgress: load(KEYS.knowledgeProgress, {}),
  currentKnowledge: null,
  saveTimer: null,
};

let deferredInstallPrompt = null;
const form = document.querySelector("#dailyForm");
const dateInput = document.querySelector("#dateInput");
const toast = document.querySelector("#toast");

dateInput.min = toKey(PLAN_START);
dateInput.max = toKey(maxSelectableDate());
populateStaticOptions();
document.querySelector("#transactionMonth").value = toKey(new Date()).slice(0, 7);

function runOneTimeReset() {
  if (localStorage.getItem(RESET_MARKER)) return;
  localStorage.removeItem("andrew-daily-execution-v1");
  localStorage.removeItem("andrew-weekly-plans-v1");
  localStorage.setItem(RESET_MARKER, new Date().toISOString());
}

function load(key, fallback) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key));
    return parsed !== null && typeof parsed === "object" ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function persist(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function maxSelectableDate() {
  const today = startOfDay(new Date());
  return today < PLAN_START ? new Date(PLAN_START) : today;
}

function clampDate(date) {
  const value = startOfDay(date);
  if (value < PLAN_START) return new Date(PLAN_START);
  const maximum = maxSelectableDate();
  if (value > maximum) return maximum;
  return value;
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function toKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function fromKey(key) {
  const [year, month, day] = String(key).split("-").map(Number);
  return new Date(year, month - 1, day);
}

function addDays(date, days) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function daysBetween(a, b) {
  return Math.round((startOfDay(a) - startOfDay(b)) / 86400000);
}

function getPlanDay(date) {
  return daysBetween(date, PLAN_START) + 1;
}

function getPlanWeek(date) {
  return Math.floor((getPlanDay(date) - 1) / 7) + 1;
}

function formatDate(date, includeYear = false) {
  return `${includeYear ? `${date.getFullYear()}年` : ""}${date.getMonth() + 1}月${date.getDate()}日`;
}

function startOfWeek(date) {
  const copy = startOfDay(date);
  return addDays(copy, -((copy.getDay() + 6) % 7));
}

function uid(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = String(value ?? "");
  return div.innerHTML;
}

function money(value, currency = "CNY") {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency", currency, maximumFractionDigits: currency === "JPY" ? 0 : 2,
  }).format(Number(value) || 0);
}

function getDefaultRecord(key) {
  return {
    date: key, weight: "", priority1: "", priority2: "", priority3: "",
    alcohol: "", alcoholNote: "", fasting: false, exercise: "",
    exerciseMinutes: "", distance: "", importantWork: false, workNote: "",
    reviewAlcohol: false, reviewExercise: false, reviewWork: false,
    dailyNote: "", updatedAt: "",
  };
}

function getRecord(key) {
  return { ...getDefaultRecord(key), ...(state.records[key] || {}) };
}

function collectForm() {
  const data = new FormData(form);
  const record = getDefaultRecord(toKey(state.selectedDate));
  Object.keys(record).forEach((key) => {
    const field = form.elements[key];
    if (!field || key === "date" || key === "updatedAt") return;
    if (field instanceof RadioNodeList) record[key] = data.get(key) || "";
    else if (field.type === "checkbox") record[key] = field.checked;
    else record[key] = field.value.trim();
  });
  record.updatedAt = new Date().toISOString();
  return record;
}

function fillForm(record) {
  form.reset();
  Object.entries(record).forEach(([key, value]) => {
    const field = form.elements[key];
    if (!field) return;
    if (field instanceof RadioNodeList) [...field].forEach((input) => { input.checked = input.value === value; });
    else if (field.type === "checkbox") field.checked = Boolean(value);
    else field.value = value ?? "";
  });
  updateScore(record);
}

function calculateScore(record) {
  const reviewed = record.reviewAlcohol && record.reviewExercise && record.reviewWork;
  return [
    Boolean(record.weight),
    Boolean(record.fasting),
    record.alcohol === "none" || record.alcohol === "social",
    Boolean(record.exercise && record.exercise !== "rest"),
    Boolean(record.importantWork),
    reviewed,
  ].filter(Boolean).length;
}

function updateScore(record = collectForm()) {
  const score = calculateScore(record);
  const labels = [
    ["从一件小事开始", "完成 5 项就是合格的一天。"],
    ["已经启动", "再完成几项，让今天留下证据。"],
    ["节奏正在回来", "不用追求满分，继续向前。"],
    ["今天有进展", "小系统正在替你分担意志力。"],
    ["差一步合格", "挑一件最容易完成的事情。"],
    ["合格的一天", "今天已经守住了基本盘。"],
    ["优秀的一天", "六项全部完成，记录下来。"],
  ];
  const [label, copy] = labels[score];
  document.querySelector("#scoreValue").textContent = score;
  document.querySelector("#scoreLabel").textContent = label;
  document.querySelector("#scoreCopy").textContent = copy;
  document.querySelector("#scoreRing").style.background =
    `conic-gradient(var(--green) ${score * 60}deg, var(--line) 0deg)`;
}

function saveCurrent(showConfirmation = false) {
  const record = collectForm();
  state.records[record.date] = record;
  persist(KEYS.records, state.records);
  updateScore(record);
  const status = document.querySelector("#saveStatus");
  status.textContent = "已自动保存";
  if (showConfirmation) showToast("今日记录已保存");
  window.setTimeout(() => { status.textContent = "修改会自动保存"; }, 1500);
}

function scheduleSave() {
  window.clearTimeout(state.saveTimer);
  document.querySelector("#saveStatus").textContent = "正在保存…";
  state.saveTimer = window.setTimeout(() => saveCurrent(false), 350);
  updateScore();
}

async function renderDate() {
  const date = state.selectedDate;
  const key = toKey(date);
  document.querySelector("#dateTitle").textContent = `${formatDate(date)} ${weekdayNames[date.getDay()]}`;
  document.querySelector("#dateSubtitle").textContent = `计划第 ${getPlanDay(date)} 天`;
  document.querySelector("#periodBadge").textContent = `第 ${getPlanWeek(date)} 周`;
  dateInput.value = key;
  dateInput.max = toKey(maxSelectableDate());
  document.querySelector("#previousDay").disabled = date <= PLAN_START;
  document.querySelector("#nextDay").disabled = date >= maxSelectableDate();
  const plan = firstWeekPlan[key];
  document.querySelector("#focusText").textContent = plan?.focus || weeklyRhythm[date.getDay()];
  document.querySelector("#focusTasks").textContent = plan?.tasks || "";
  fillForm(getRecord(key));
  await renderKnowledge(key);
}

function selectDate(date) {
  saveCurrent(false);
  state.selectedDate = clampDate(date);
  renderDate();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function getRecordedEntries() {
  return Object.values(state.records)
    .filter((record) => record?.updatedAt)
    .sort((a, b) => b.date.localeCompare(a.date));
}

function renderHistory() {
  const entries = getRecordedEntries();
  const scores = entries.map(calculateScore);
  const average = scores.length ? (scores.reduce((sum, value) => sum + value, 0) / scores.length).toFixed(1) : "0";
  const noAlcoholDays = entries.filter((record) => record.alcohol === "none").length;
  document.querySelector("#historyCount").textContent = `${entries.length} 天`;
  document.querySelector("#historySummary").innerHTML = `
    <div class="summary-stat"><strong>${entries.length}</strong><span>记录天数</span></div>
    <div class="summary-stat"><strong>${average}</strong><span>平均完成</span></div>
    <div class="summary-stat"><strong>${noAlcoholDays}</strong><span>无酒精日</span></div>`;
  document.querySelector("#historyList").innerHTML = entries.length ? entries.map((record) => {
    const date = fromKey(record.date);
    const details = [record.weight ? `${record.weight}斤` : "", exerciseNames[record.exercise] || "", record.importantWork ? "重要工作已完成" : ""].filter(Boolean);
    return `<button class="history-item" data-date="${record.date}">
      <span class="history-day"><strong>${date.getDate()}</strong>${date.getMonth() + 1}月</span>
      <span class="history-content"><strong>${weekdayNames[date.getDay()]}</strong><small>${escapeHtml(details.join(" · ") || "已保存当日记录")}</small></span>
      <span class="history-score">${calculateScore(record)} / 6</span>
    </button>`;
  }).join("") : '<div class="empty-state">还没有记录。第一天从6月15日开始。</div>';
}

function getViewedWeekStart() {
  return addDays(startOfWeek(maxSelectableDate()), state.weekOffset * 7);
}

function renderWeekly() {
  const weekStart = getViewedWeekStart();
  const dates = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  const records = dates.map((date) => getRecord(toKey(date)));
  const scores = records.map(calculateScore);
  const weights = records.map((record) => Number(record.weight)).filter((value) => value > 0);
  const runs = records.filter((record) => record.exercise === "run").length;
  const strength = records.filter((record) => ["strengthA", "strengthB"].includes(record.exercise)).length;
  const alcoholFree = records.filter((record) => record.alcohol === "none").length;
  document.querySelector("#weekTitle").textContent = `${formatDate(weekStart)} – ${formatDate(addDays(weekStart, 6))}`;
  document.querySelector("#weeklyStats").innerHTML = `
    <div class="stat-card"><strong>${weights.length ? `${Math.min(...weights).toFixed(1)}斤` : "—"}</strong><span>本周最低体重</span></div>
    <div class="stat-card ${runs >= 3 ? "accent" : ""}"><strong>${runs} / 3</strong><span>跑步次数</span></div>
    <div class="stat-card ${strength >= 2 ? "accent" : ""}"><strong>${strength} / 2</strong><span>力量训练</span></div>
    <div class="stat-card"><strong>${alcoholFree}</strong><span>无酒精日</span></div>`;
  document.querySelector("#weeklyScore").textContent = `${scores.reduce((sum, value) => sum + value, 0)} / 42`;
  document.querySelector("#weekBars").innerHTML = dates.map((date, index) => `
    <div class="day-bar"><div class="bar-track"><div class="bar-fill" style="height:${Math.max(3, scores[index] / 6 * 100)}%"></div></div><span>周${shortWeekdays[date.getDay()]}</span></div>`).join("");
  const weekKey = toKey(weekStart);
  const plan = state.weeklyPlans[weekKey] || { priorities: "", strengthDays: [] };
  document.querySelector("#nextWeekPriorities").value = plan.priorities || "";
  document.querySelector("#strengthDays").innerHTML = ["一", "二", "三", "四", "五", "六", "日"].map((day, index) =>
    `<label><input type="checkbox" value="${index}" ${plan.strengthDays?.includes(index) ? "checked" : ""} /><span>${day}</span></label>`).join("");
  renderDeclutterOptions();
  renderDeclutters(weekKey);
}

function saveWeeklyPlan() {
  const weekKey = toKey(getViewedWeekStart());
  state.weeklyPlans[weekKey] = {
    priorities: document.querySelector("#nextWeekPriorities").value.trim(),
    strengthDays: [...document.querySelectorAll("#strengthDays input:checked")].map((input) => Number(input.value)),
  };
  persist(KEYS.weeklyPlans, state.weeklyPlans);
}

function renderDeclutterOptions() {
  const available = state.inventory.filter((item) => !["已出售", "已捐赠", "已丢弃"].includes(item.status));
  document.querySelector("#declutterItem").innerHTML = available.length
    ? `<option value="">请选择</option>${available.map((item) => `<option value="${item.id}">${escapeHtml(item.name)} · ${escapeHtml(item.status)}</option>`).join("")}`
    : '<option value="">请先在物品清单新增物品</option>';
}

function renderDeclutters(weekKey) {
  const entries = state.declutters.filter((entry) => entry.week === weekKey);
  document.querySelector("#declutterList").innerHTML = entries.length ? entries.map((entry) => {
    const item = state.inventory.find((candidate) => candidate.id === entry.itemId);
    return `<div class="compact-item"><strong>${escapeHtml(item?.name || "已删除物品")} · ${actionLabels[entry.action]}</strong><p>${entry.minutes}分钟${entry.note ? ` · ${escapeHtml(entry.note)}` : ""}</p></div>`;
  }).join("") : '<div class="empty-state">本周还没有断舍离记录。</div>';
}

function saveDeclutter(event) {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const item = state.inventory.find((candidate) => candidate.id === data.get("itemId"));
  if (!item) return showToast("请先选择一个物品");
  const action = data.get("action");
  state.declutters.push({
    id: uid("declutter"), week: toKey(getViewedWeekStart()), itemId: item.id,
    action, minutes: Number(data.get("minutes")), note: String(data.get("note") || "").trim(),
    createdAt: new Date().toISOString(),
  });
  item.status = actionStatuses[action];
  item.updatedAt = new Date().toISOString();
  persist(KEYS.declutters, state.declutters);
  persist(KEYS.inventory, state.inventory);
  event.currentTarget.reset();
  event.currentTarget.elements.minutes.value = 15;
  renderWeekly();
  showToast("本周断舍离已记录");
}

function populateStaticOptions() {
  const categoryOptions = inventoryCategories.map((value) => `<option value="${value}">${value}</option>`).join("");
  const statusOptions = inventoryStatuses.map((value) => `<option value="${value}">${value}</option>`).join("");
  document.querySelector("#inventoryCategory").insertAdjacentHTML("beforeend", categoryOptions);
  document.querySelector("#inventoryStatus").insertAdjacentHTML("beforeend", statusOptions);
  document.querySelector("#itemForm [name=category]").innerHTML = categoryOptions;
  document.querySelector("#itemForm [name=status]").innerHTML = statusOptions;
  document.querySelectorAll(".currency-select").forEach((select) => {
    select.innerHTML = currencies.map((value) => `<option value="${value}">${value}</option>`).join("");
  });
  document.querySelector("#knowledgeCategoryFilter").insertAdjacentHTML("beforeend",
    knowledgeCategories.map((value) => `<option value="${value}">${value}</option>`).join(""));
}

function renderInventory() {
  const query = document.querySelector("#inventorySearch").value.trim().toLowerCase();
  const category = document.querySelector("#inventoryCategory").value;
  const status = document.querySelector("#inventoryStatus").value;
  const visible = state.inventory.filter((item) =>
    (!query || `${item.name} ${item.location} ${item.notes}`.toLowerCase().includes(query)) &&
    (!category || item.category === category) && (!status || item.status === status));
  const activeCount = state.inventory.filter((item) => ["待确认", "持有", "闲置"].includes(item.status)).length;
  const idleCount = state.inventory.filter((item) => item.status === "闲置").length;
  const pendingCount = state.inventory.filter((item) => item.status === "待确认").length;
  document.querySelector("#inventorySummary").innerHTML =
    `<span>当前拥有 ${activeCount}</span><span>闲置 ${idleCount}</span><span>待确认 ${pendingCount}</span>`;
  document.querySelector("#inventoryList").innerHTML = visible.length ? visible
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map((item) => `<article class="list-card">
      <div class="list-card-header"><h3>${escapeHtml(item.name)}</h3><span class="status-pill">${escapeHtml(item.status)}</span></div>
      <div class="list-meta"><span>${escapeHtml(item.category)}</span><span>数量 ${item.quantity}</span>${item.price ? `<span>${money(item.price, item.currency)}</span>` : ""}${item.location ? `<span>${escapeHtml(item.location)}</span>` : ""}</div>
      ${item.notes ? `<p>${escapeHtml(item.notes)}</p>` : ""}
      <div class="list-actions"><button class="text-button" data-edit-item="${item.id}">编辑</button><button class="text-button danger" data-delete-item="${item.id}">删除</button></div>
    </article>`).join("") : '<div class="empty-state">没有符合条件的物品。</div>';
}

function openItemDialog(item = null) {
  const formElement = document.querySelector("#itemForm");
  formElement.reset();
  formElement.elements.id.value = item?.id || "";
  formElement.elements.name.value = item?.name || "";
  formElement.elements.category.value = item?.category || "其他";
  formElement.elements.status.value = item?.status || "持有";
  formElement.elements.quantity.value = item?.quantity || 1;
  formElement.elements.price.value = item?.price || "";
  formElement.elements.currency.value = item?.currency || "CNY";
  formElement.elements.acquiredAt.value = item?.acquiredAt || "";
  formElement.elements.source.value = item?.source || "";
  formElement.elements.location.value = item?.location || "";
  formElement.elements.notes.value = item?.notes || "";
  document.querySelector("#itemDialog").showModal();
}

function saveItem(event) {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const id = String(data.get("id") || "") || uid("item");
  const existing = state.inventory.find((item) => item.id === id);
  const item = {
    id, name: String(data.get("name")).trim(), category: data.get("category"),
    quantity: Number(data.get("quantity")) || 1, acquiredAt: data.get("acquiredAt"),
    price: Number(data.get("price")) || 0, currency: data.get("currency"),
    source: String(data.get("source") || "").trim(), location: String(data.get("location") || "").trim(),
    status: data.get("status"), notes: String(data.get("notes") || "").trim(),
    createdAt: existing?.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
  if (existing) Object.assign(existing, item);
  else state.inventory.push(item);
  persist(KEYS.inventory, state.inventory);
  document.querySelector("#itemDialog").close();
  renderInventory();
  showToast("物品已保存");
}

function deleteItem(id) {
  if (!window.confirm("删除这个物品及其关联的断舍离记录？")) return;
  state.inventory = state.inventory.filter((item) => item.id !== id);
  state.declutters = state.declutters.filter((entry) => entry.itemId !== id);
  persist(KEYS.inventory, state.inventory);
  persist(KEYS.declutters, state.declutters);
  renderInventory();
}

function importTaobao(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const payload = JSON.parse(reader.result);
      const items = Array.isArray(payload) ? payload : payload.items;
      if (!Array.isArray(items)) throw new Error("invalid");
      const imported = items.filter((item) => item?.name).map((item) => ({
        id: uid("taobao"), name: String(item.name).trim(),
        category: inventoryCategories.includes(item.category) ? item.category : "其他",
        quantity: Math.max(1, Number(item.quantity) || 1), acquiredAt: item.acquiredAt || item.date || "",
        price: Math.max(0, Number(item.price) || 0), currency: currencies.includes(item.currency) ? item.currency : "CNY",
        source: "淘宝", location: "", status: "待确认", notes: String(item.notes || "").trim(),
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      }));
      state.inventory.push(...imported);
      persist(KEYS.inventory, state.inventory);
      renderInventory();
      showToast(`已导入 ${imported.length} 件待确认物品`);
    } catch {
      showToast("无法识别这个淘宝物品文件");
    }
  };
  reader.readAsText(file);
}

function renderAccounts() {
  document.querySelector("#accountList").innerHTML = state.accounts.length ? state.accounts
    .sort((a, b) => a.side.localeCompare(b.side))
    .map((account) => `<article class="list-card">
      <div class="list-card-header"><h3>${escapeHtml(account.name)}</h3><span class="status-pill">${account.side === "asset" ? "资产" : "负债"}</span></div>
      <strong>${money(account.balance, account.currency)}</strong>
      <div class="list-meta"><span>${escapeHtml(account.category)}</span><span>截至 ${account.asOfDate}</span>${account.manualRate ? `<span>手工汇率 ${account.manualRate}</span>` : ""}</div>
      <div class="list-actions"><button class="text-button" data-edit-account="${account.id}">编辑</button><button class="text-button danger" data-delete-account="${account.id}">删除</button></div>
    </article>`).join("") : '<div class="empty-state">还没有财务账户。</div>';
  populateAccountOptions();
}

function openAccountDialog(account = null) {
  const accountForm = document.querySelector("#accountForm");
  accountForm.reset();
  accountForm.elements.id.value = account?.id || "";
  accountForm.elements.name.value = account?.name || "";
  accountForm.elements.side.value = account?.side || "asset";
  accountForm.elements.category.value = account?.category || "";
  accountForm.elements.balance.value = account?.balance ?? "";
  accountForm.elements.currency.value = account?.currency || "CNY";
  accountForm.elements.asOfDate.value = account?.asOfDate || toKey(new Date());
  accountForm.elements.manualRate.value = account?.manualRate || "";
  document.querySelector("#accountDialog").showModal();
}

function saveAccount(event) {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const id = String(data.get("id") || "") || uid("account");
  const existing = state.accounts.find((account) => account.id === id);
  const account = {
    id, name: String(data.get("name")).trim(), side: data.get("side"),
    category: String(data.get("category")).trim(), balance: Number(data.get("balance")) || 0,
    currency: data.get("currency"), asOfDate: data.get("asOfDate"),
    manualRate: Number(data.get("manualRate")) || 0,
    createdAt: existing?.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
  if (existing) Object.assign(existing, account);
  else state.accounts.push(account);
  persist(KEYS.accounts, state.accounts);
  document.querySelector("#accountDialog").close();
  renderAccounts();
  renderFinanceOverview();
  showToast("账户已保存");
}

function deleteAccount(id) {
  if (!window.confirm("删除这个账户？已有收支不会删除。")) return;
  state.accounts = state.accounts.filter((account) => account.id !== id);
  persist(KEYS.accounts, state.accounts);
  renderAccounts();
  renderFinanceOverview();
}

function populateAccountOptions() {
  document.querySelector("#transactionAccount").innerHTML =
    `<option value="">不关联账户</option>${state.accounts.map((account) => `<option value="${account.id}">${escapeHtml(account.name)}</option>`).join("")}`;
}

function renderTransactions() {
  const month = document.querySelector("#transactionMonth").value;
  const type = document.querySelector("#transactionType").value;
  const visible = state.transactions.filter((item) => (!month || item.date.startsWith(month)) && (!type || item.type === type));
  document.querySelector("#transactionList").innerHTML = visible.length ? visible
    .sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt))
    .map((item) => {
      const account = state.accounts.find((candidate) => candidate.id === item.accountId);
      return `<article class="list-card">
        <div class="list-card-header"><h3>${escapeHtml(item.category)}</h3><strong>${item.type === "income" ? "+" : "-"}${money(item.amount, item.currency)}</strong></div>
        <div class="list-meta"><span>${item.date}</span><span>${item.type === "income" ? "收入" : "支出"}</span>${account ? `<span>${escapeHtml(account.name)}</span>` : ""}</div>
        ${item.note ? `<p>${escapeHtml(item.note)}</p>` : ""}
        <div class="list-actions"><button class="text-button" data-edit-transaction="${item.id}">编辑</button><button class="text-button danger" data-delete-transaction="${item.id}">删除</button></div>
      </article>`;
    }).join("") : '<div class="empty-state">这个月份还没有收支记录。</div>';
}

function openTransactionDialog(transaction = null) {
  populateAccountOptions();
  const transactionForm = document.querySelector("#transactionForm");
  transactionForm.reset();
  transactionForm.elements.id.value = transaction?.id || "";
  transactionForm.elements.type.value = transaction?.type || "expense";
  transactionForm.elements.date.value = transaction?.date || toKey(new Date());
  transactionForm.elements.category.value = transaction?.category || "";
  transactionForm.elements.amount.value = transaction?.amount ?? "";
  transactionForm.elements.currency.value = transaction?.currency || "CNY";
  transactionForm.elements.accountId.value = transaction?.accountId || "";
  transactionForm.elements.note.value = transaction?.note || "";
  document.querySelector("#transactionDialog").showModal();
}

function saveTransaction(event) {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const id = String(data.get("id") || "") || uid("transaction");
  const existing = state.transactions.find((item) => item.id === id);
  const transaction = {
    id, type: data.get("type"), date: data.get("date"),
    category: String(data.get("category")).trim(), amount: Number(data.get("amount")),
    currency: data.get("currency"), accountId: data.get("accountId"),
    note: String(data.get("note") || "").trim(),
    createdAt: existing?.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
  if (existing) Object.assign(existing, transaction);
  else state.transactions.push(transaction);
  persist(KEYS.transactions, state.transactions);
  document.querySelector("#transactionDialog").close();
  renderTransactions();
  renderFinanceOverview();
  showToast("收支已保存");
}

function deleteTransaction(id) {
  if (!window.confirm("删除这笔收支？")) return;
  state.transactions = state.transactions.filter((item) => item.id !== id);
  persist(KEYS.transactions, state.transactions);
  renderTransactions();
  renderFinanceOverview();
}

function findManualRate(currency) {
  return state.accounts.find((account) => account.currency === currency && account.manualRate)?.manualRate || 0;
}

function findCachedRate(currency, date) {
  const exact = state.fxRates[`${date}:${currency}:CNY`];
  if (exact) return exact.rate;
  return Object.entries(state.fxRates)
    .filter(([key]) => key.includes(`:${currency}:CNY`))
    .sort(([a], [b]) => b.localeCompare(a))[0]?.[1]?.rate || 0;
}

async function getRate(currency, date, allowNetwork = true) {
  if (currency === "CNY") return 1;
  const cached = findCachedRate(currency, date);
  if (state.fxRates[`${date}:${currency}:CNY`]) return cached;
  if (allowNetwork && navigator.onLine) {
    for (let offset = 0; offset < 7; offset += 1) {
      const queryDate = toKey(addDays(fromKey(date), -offset));
      try {
        const response = await fetch(`https://api.frankfurter.dev/v2/rate/${currency}/CNY?date=${queryDate}`);
        if (!response.ok) continue;
        const payload = await response.json();
        if (Number(payload.rate) > 0) {
          state.fxRates[`${date}:${currency}:CNY`] = {
            rate: Number(payload.rate), sourceDate: payload.date || queryDate, fetchedAt: new Date().toISOString(),
          };
          persist(KEYS.fxRates, state.fxRates);
          return Number(payload.rate);
        }
      } catch {
        break;
      }
    }
  }
  return cached || findManualRate(currency) || 0;
}

async function convertToCny(amount, currency, date, ratesUsed = null) {
  const rate = await getRate(currency, date);
  if (ratesUsed) ratesUsed[currency] = rate;
  return rate ? Number(amount) * rate : null;
}

async function calculateFinance(date = toKey(new Date())) {
  let assets = 0;
  let liabilities = 0;
  let missingRates = false;
  const ratesUsed = { CNY: 1 };
  for (const account of state.accounts) {
    const converted = await convertToCny(account.balance, account.currency, account.asOfDate || date, ratesUsed);
    if (converted === null) missingRates = true;
    else if (account.side === "asset") assets += converted;
    else liabilities += converted;
  }
  const month = date.slice(0, 7);
  let income = 0;
  let expense = 0;
  for (const item of state.transactions.filter((transaction) => transaction.date.startsWith(month))) {
    const converted = await convertToCny(item.amount, item.currency, item.date, ratesUsed);
    if (converted === null) missingRates = true;
    else if (item.type === "income") income += converted;
    else expense += converted;
  }
  return { assets, liabilities, netWorth: assets - liabilities, income, expense, savingsRate: income ? (income - expense) / income : 0, ratesUsed, missingRates };
}

async function renderFinanceOverview() {
  const metrics = document.querySelector("#financeMetrics");
  metrics.innerHTML = '<div class="empty-state">正在计算财务数据…</div>';
  const result = await calculateFinance();
  metrics.innerHTML = `
    <div class="metric-card"><strong>${money(result.netWorth)}</strong><span>净资产</span></div>
    <div class="metric-card"><strong>${money(result.assets)}</strong><span>总资产</span></div>
    <div class="metric-card"><strong>${money(result.liabilities)}</strong><span>总负债</span></div>
    <div class="metric-card"><strong>${(result.savingsRate * 100).toFixed(0)}%</strong><span>本月储蓄率${result.missingRates ? " · 部分汇率缺失" : ""}</span></div>
    <div class="metric-card"><strong>${money(result.income)}</strong><span>本月收入</span></div>
    <div class="metric-card"><strong>${money(result.expense)}</strong><span>本月支出</span></div>`;
  renderSnapshots();
  await renderExpenseBreakdown();
}

function renderSnapshots() {
  const sorted = [...state.snapshots].sort((a, b) => b.month.localeCompare(a.month));
  document.querySelector("#snapshotList").innerHTML = sorted.length ? sorted.map((snapshot) =>
    `<div class="trend-item"><div class="list-card-header"><strong>${snapshot.month}</strong><strong>${money(snapshot.netWorth)}</strong></div><div class="list-meta"><span>资产 ${money(snapshot.assets)}</span><span>负债 ${money(snapshot.liabilities)}</span><span>储蓄率 ${(snapshot.savingsRate * 100).toFixed(0)}%</span></div></div>`
  ).join("") : '<div class="empty-state">生成月度快照后，这里会保留历史趋势。</div>';
}

async function renderExpenseBreakdown() {
  const month = toKey(new Date()).slice(0, 7);
  const totals = {};
  for (const item of state.transactions.filter((transaction) => transaction.type === "expense" && transaction.date.startsWith(month))) {
    const value = await convertToCny(item.amount, item.currency, item.date);
    if (value !== null) totals[item.category] = (totals[item.category] || 0) + value;
  }
  const entries = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  const maximum = entries[0]?.[1] || 1;
  document.querySelector("#expenseBreakdown").innerHTML = entries.length ? entries.map(([category, value]) =>
    `<div class="breakdown-row"><span>${escapeHtml(category)}</span><div class="breakdown-track"><div class="breakdown-fill" style="width:${value / maximum * 100}%"></div></div><strong>${money(value)}</strong></div>`
  ).join("") : '<div class="empty-state">本月还没有支出记录。</div>';
}

async function createSnapshot() {
  const month = toKey(new Date()).slice(0, 7);
  const result = await calculateFinance();
  const snapshot = {
    id: uid("snapshot"), month, createdAt: new Date().toISOString(),
    assets: result.assets, liabilities: result.liabilities, netWorth: result.netWorth,
    income: result.income, expense: result.expense, savingsRate: result.savingsRate,
    rates: result.ratesUsed,
  };
  state.snapshots = state.snapshots.filter((item) => item.month !== month);
  state.snapshots.push(snapshot);
  persist(KEYS.snapshots, state.snapshots);
  renderSnapshots();
  showToast("本月财务快照已生成");
}

function stableIndex(key, length) {
  let hash = 0;
  for (const character of key) hash = ((hash << 5) - hash + character.charCodeAt(0)) | 0;
  return Math.abs(hash) % length;
}

async function loadKnowledge(key) {
  const fallback = window.FALLBACK_KNOWLEDGE || [];
  const knowledge = fallback[stableIndex(key, fallback.length)] || {
    category: "科学", title: "知识正在路上", summary: "今天的知识文件暂时不可用。",
    why: "内置知识库将在下次版本更新时补充。", prompt: "你今天最想弄明白什么？",
    sources: [],
  };
  const value = { ...knowledge, date: key, origin: "built-in" };
  state.knowledge[key] = value;
  persist(KEYS.knowledge, state.knowledge);
  return value;
}

async function renderKnowledge(key) {
  const knowledge = await loadKnowledge(key);
  if (key !== toKey(state.selectedDate)) return;
  state.currentKnowledge = knowledge;
  const progress = state.knowledgeProgress[key] || {};
  document.querySelector("#knowledgeCategory").textContent = knowledge.category;
  document.querySelector("#knowledgeDate").textContent = "内置知识库";
  document.querySelector("#knowledgeTitle").textContent = knowledge.title;
  document.querySelector("#knowledgeSummary").textContent = knowledge.summary;
  document.querySelector("#knowledgeWhy").textContent = knowledge.why;
  document.querySelector("#knowledgePrompt").textContent = `想一想：${knowledge.prompt}`;
  document.querySelector("#knowledgeSources").innerHTML = knowledge.sources.slice(0, 2).filter((source) => /^https?:\/\//.test(source.url)).map((source, index) =>
    `<a href="${escapeHtml(source.url)}" target="_blank" rel="noopener">来源 ${index + 1}：${escapeHtml(source.name)}</a>`).join("");
  document.querySelector("#markLearned").classList.toggle("active", Boolean(progress.learned));
  document.querySelector("#markLearned").textContent = progress.learned ? "已学习 ✓" : "标记已学习";
  document.querySelector("#toggleFavorite").classList.toggle("active", Boolean(progress.favorite));
  document.querySelector("#toggleFavorite").textContent = progress.favorite ? "已收藏 ★" : "收藏";
}

function toggleKnowledgeProgress(field) {
  const key = toKey(state.selectedDate);
  const progress = state.knowledgeProgress[key] || { learned: false, favorite: false };
  progress[field] = !progress[field];
  progress.updatedAt = new Date().toISOString();
  state.knowledgeProgress[key] = progress;
  persist(KEYS.knowledgeProgress, state.knowledgeProgress);
  renderKnowledge(key);
}

function renderKnowledgeArchive() {
  const category = document.querySelector("#knowledgeCategoryFilter").value;
  const filter = document.querySelector("#knowledgeProgressFilter").value;
  const entries = Object.entries(state.knowledge)
    .filter(([, knowledge]) => !category || knowledge.category === category)
    .filter(([date]) => !filter || Boolean(state.knowledgeProgress[date]?.[filter]))
    .sort(([a], [b]) => b.localeCompare(a));
  document.querySelector("#knowledgeArchive").innerHTML = entries.length ? entries.map(([date, knowledge]) => {
    const progress = state.knowledgeProgress[date] || {};
    return `<article class="archive-item ${progress.favorite ? "favorite" : ""}">
      <button class="text-button" data-knowledge-date="${date}"><strong>${escapeHtml(knowledge.title)}</strong></button>
      <div class="list-meta"><span>${date}</span><span>${escapeHtml(knowledge.category)}</span>${progress.learned ? "<span>已学习</span>" : ""}${progress.favorite ? "<span>已收藏</span>" : ""}</div>
    </article>`;
  }).join("") : '<div class="empty-state">还没有符合条件的新知。</div>';
}

function switchView(target) {
  document.querySelectorAll(".view").forEach((view) => view.classList.toggle("active", view.dataset.view === target));
  document.querySelectorAll(".bottom-nav button").forEach((button) => button.classList.toggle("active", button.dataset.target === target));
  if (target === "weekly") renderWeekly();
  if (target === "inventory") renderInventory();
  if (target === "finance") {
    renderAccounts();
    renderTransactions();
    renderFinanceOverview();
  }
  if (target === "more") {
    renderHistory();
    renderKnowledgeArchive();
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function switchFinanceTab(target) {
  document.querySelectorAll("[data-finance-tab]").forEach((button) => button.classList.toggle("active", button.dataset.financeTab === target));
  document.querySelectorAll("[data-finance-pane]").forEach((pane) => pane.classList.toggle("active", pane.dataset.financePane === target));
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function exportJson() {
  const payload = {
    version: 2, exportedAt: new Date().toISOString(),
    records: state.records, weeklyPlans: state.weeklyPlans, inventory: state.inventory,
    declutters: state.declutters, accounts: state.accounts, transactions: state.transactions,
    snapshots: state.snapshots, fxRates: state.fxRates, knowledge: state.knowledge,
    knowledgeProgress: state.knowledgeProgress,
  };
  downloadFile(`重新掌舵-完整备份-${toKey(new Date())}.json`, JSON.stringify(payload, null, 2), "application/json");
  showToast("完整备份已导出");
}

function csvCell(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function exportCsv(type) {
  const definitions = {
    daily: {
      filename: "每日记录", headers: ["日期", "体重(斤)", "酒精", "16+8", "运动", "时长(分钟)", "距离(公里)", "重要工作", "工作记录", "得分", "备注"],
      rows: getRecordedEntries().reverse().map((record) => [record.date, record.weight, record.alcohol, record.fasting ? "是" : "否", exerciseNames[record.exercise] || "", record.exerciseMinutes, record.distance, record.importantWork ? "是" : "否", record.workNote, calculateScore(record), record.dailyNote]),
    },
    inventory: {
      filename: "物品清单", headers: ["名称", "分类", "数量", "购入日期", "价格", "币种", "来源", "位置", "状态", "备注"],
      rows: state.inventory.map((item) => [item.name, item.category, item.quantity, item.acquiredAt, item.price, item.currency, item.source, item.location, item.status, item.notes]),
    },
    transactions: {
      filename: "收支记录", headers: ["日期", "类型", "类别", "金额", "币种", "账户", "备注"],
      rows: state.transactions.map((item) => [item.date, item.type === "income" ? "收入" : "支出", item.category, item.amount, item.currency, state.accounts.find((account) => account.id === item.accountId)?.name || "", item.note]),
    },
    snapshots: {
      filename: "财务快照", headers: ["月份", "总资产(CNY)", "总负债(CNY)", "净资产(CNY)", "收入(CNY)", "支出(CNY)", "储蓄率"],
      rows: state.snapshots.map((item) => [item.month, item.assets, item.liabilities, item.netWorth, item.income, item.expense, item.savingsRate]),
    },
  };
  const definition = definitions[type];
  const csv = "\uFEFF" + [definition.headers, ...definition.rows].map((row) => row.map(csvCell).join(",")).join("\n");
  downloadFile(`${definition.filename}-${toKey(new Date())}.csv`, csv, "text/csv;charset=utf-8");
  showToast(`${definition.filename}已导出`);
}

function importJson(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const payload = JSON.parse(reader.result);
      if (payload.version !== 2 || !payload.records) throw new Error("invalid");
      Object.keys(KEYS).forEach((name) => {
        if (name === "fxRates" || name === "knowledge" || name === "knowledgeProgress" || name === "records" || name === "weeklyPlans") {
          state[name] = payload[name] || {};
        } else {
          state[name] = Array.isArray(payload[name]) ? payload[name] : [];
        }
        persist(KEYS[name], state[name]);
      });
      renderDate();
      showToast("V2完整备份已恢复");
    } catch {
      showToast("无法识别这个V2备份文件");
    }
  };
  reader.readAsText(file);
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("show"), 1800);
}

function updateInstallUi() {
  const standalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  const status = document.querySelector("#installStatus");
  if (standalone) {
    status.textContent = "已从主屏幕运行，可以离线打开。";
    document.querySelector("#installSteps").hidden = true;
    document.querySelector("#installApp").hidden = true;
  } else if (deferredInstallPrompt) {
    status.textContent = "安装后可从主屏幕快速打开。";
    document.querySelector("#installSteps").hidden = true;
    document.querySelector("#installApp").hidden = false;
  }
}

form.addEventListener("input", scheduleSave);
form.addEventListener("change", scheduleSave);
form.addEventListener("submit", (event) => { event.preventDefault(); saveCurrent(true); });
document.querySelector("#previousDay").addEventListener("click", () => selectDate(addDays(state.selectedDate, -1)));
document.querySelector("#nextDay").addEventListener("click", () => selectDate(addDays(state.selectedDate, 1)));
document.querySelector("#datePickerButton").addEventListener("click", () => typeof dateInput.showPicker === "function" ? dateInput.showPicker() : dateInput.click());
dateInput.addEventListener("change", () => selectDate(fromKey(dateInput.value)));
document.querySelector("#markLearned").addEventListener("click", () => toggleKnowledgeProgress("learned"));
document.querySelector("#toggleFavorite").addEventListener("click", () => toggleKnowledgeProgress("favorite"));

document.querySelector(".bottom-nav").addEventListener("click", (event) => {
  const button = event.target.closest("[data-target]");
  if (button) switchView(button.dataset.target);
});
document.querySelector("#financeTabs").addEventListener("click", (event) => {
  const button = event.target.closest("[data-finance-tab]");
  if (button) switchFinanceTab(button.dataset.financeTab);
});

document.querySelector("#previousWeek").addEventListener("click", () => { saveWeeklyPlan(); state.weekOffset -= 1; renderWeekly(); });
document.querySelector("#nextWeek").addEventListener("click", () => { saveWeeklyPlan(); state.weekOffset += 1; renderWeekly(); });
document.querySelector("#nextWeekPriorities").addEventListener("input", saveWeeklyPlan);
document.querySelector("#strengthDays").addEventListener("change", saveWeeklyPlan);
document.querySelector("#declutterForm").addEventListener("submit", saveDeclutter);

["inventorySearch", "inventoryCategory", "inventoryStatus"].forEach((id) => document.querySelector(`#${id}`).addEventListener("input", renderInventory));
document.querySelector("#newItem").addEventListener("click", () => openItemDialog());
document.querySelector("#itemForm").addEventListener("submit", saveItem);
document.querySelector("#inventoryList").addEventListener("click", (event) => {
  const edit = event.target.closest("[data-edit-item]");
  const remove = event.target.closest("[data-delete-item]");
  if (edit) openItemDialog(state.inventory.find((item) => item.id === edit.dataset.editItem));
  if (remove) deleteItem(remove.dataset.deleteItem);
});
document.querySelector("#taobaoImport").addEventListener("change", (event) => {
  const [file] = event.target.files;
  if (file) importTaobao(file);
  event.target.value = "";
});

document.querySelector("#newAccount").addEventListener("click", () => openAccountDialog());
document.querySelector("#accountForm").addEventListener("submit", saveAccount);
document.querySelector("#accountList").addEventListener("click", (event) => {
  const edit = event.target.closest("[data-edit-account]");
  const remove = event.target.closest("[data-delete-account]");
  if (edit) openAccountDialog(state.accounts.find((account) => account.id === edit.dataset.editAccount));
  if (remove) deleteAccount(remove.dataset.deleteAccount);
});
document.querySelector("#newTransaction").addEventListener("click", () => openTransactionDialog());
document.querySelector("#transactionForm").addEventListener("submit", saveTransaction);
document.querySelector("#transactionMonth").addEventListener("change", renderTransactions);
document.querySelector("#transactionType").addEventListener("change", renderTransactions);
document.querySelector("#transactionList").addEventListener("click", (event) => {
  const edit = event.target.closest("[data-edit-transaction]");
  const remove = event.target.closest("[data-delete-transaction]");
  if (edit) openTransactionDialog(state.transactions.find((item) => item.id === edit.dataset.editTransaction));
  if (remove) deleteTransaction(remove.dataset.deleteTransaction);
});
document.querySelector("#createSnapshot").addEventListener("click", createSnapshot);

document.querySelector("#historyList").addEventListener("click", (event) => {
  const item = event.target.closest("[data-date]");
  if (!item) return;
  state.selectedDate = fromKey(item.dataset.date);
  renderDate();
  switchView("today");
});
["knowledgeCategoryFilter", "knowledgeProgressFilter"].forEach((id) => document.querySelector(`#${id}`).addEventListener("change", renderKnowledgeArchive));
document.querySelector("#knowledgeArchive").addEventListener("click", (event) => {
  const item = event.target.closest("[data-knowledge-date]");
  if (!item) return;
  state.selectedDate = clampDate(fromKey(item.dataset.knowledgeDate));
  renderDate();
  switchView("today");
});

document.querySelector("#exportJson").addEventListener("click", exportJson);
document.querySelectorAll("[data-export-csv]").forEach((button) => button.addEventListener("click", () => exportCsv(button.dataset.exportCsv)));
document.querySelector("#importJson").addEventListener("change", (event) => {
  const [file] = event.target.files;
  if (file) importJson(file);
  event.target.value = "";
});

document.querySelectorAll(".close-dialog").forEach((button) => button.addEventListener("click", (event) => {
  event.preventDefault();
  event.target.closest("dialog").close();
}));
window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  updateInstallUi();
});
document.querySelector("#installApp").addEventListener("click", async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  updateInstallUi();
});
window.addEventListener("appinstalled", () => { deferredInstallPrompt = null; updateInstallUi(); showToast("应用已安装"); });

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./service-worker.js").catch(() => {}));
}

window.__restartDaily = {
  calculateScore, getPlanDay, getPlanWeek, stableIndex, clampDate, getRate,
  state, PLAN_START, KEYS,
};

updateInstallUi();
renderDate();
