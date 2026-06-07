const STORAGE_KEY = "andrew-daily-execution-v1";
const WEEKLY_KEY = "andrew-weekly-plans-v1";
const PLAN_START = new Date(2026, 5, 1);
const PLAN_END = new Date(2026, 7, 31);

const weekdayNames = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
const shortWeekdays = ["日", "一", "二", "三", "四", "五", "六"];
const exerciseNames = {
  run: "跑步",
  strengthA: "力量 A",
  strengthB: "力量 B",
  basketball: "篮球",
  walk: "快走",
  stretch: "拉伸",
  rest: "休息",
};

const firstWeekPlan = {
  "2026-06-01": {
    focus: "启动，不求完美",
    tasks: "不买酒、不喝酒 · 5公里轻松跑 · 清理运动服 · 建项目风险清单",
  },
  "2026-06-02": {
    focus: "第一次把力量训练捡起来",
    tasks: "力量训练 A · 清理衬衫 · 明确一个任务交付标准",
  },
  "2026-06-03": {
    focus: "主动把问题列出来",
    tasks: "5公里稍快跑 · 更新风险清单 · 与关键经理沟通新要求",
  },
  "2026-06-04": {
    focus: "力量训练不能因忙取消",
    tasks: "力量训练 B · 清理西装外套 · 建立交付质量五维标准",
  },
  "2026-06-05": {
    focus: "用复盘替代焦虑",
    tasks: "休息或快走 · 30分钟周复盘 · 对一个交付物做五维反馈",
  },
  "2026-06-06": {
    focus: "不用酒和手机填满空闲",
    tasks: "篮球或轻松跑 · 清理一个抽屉 · 工作只处理一个必要事项",
  },
  "2026-06-07": {
    focus: "让下一周自动开始",
    tasks: "记录周最低与平均体重 · 准备食材 · 安排两次力量训练",
  },
};

const weeklyRhythm = [
  "下周计划、体重复盘、准备食物",
  "定目标、排风险、轻松跑",
  "力量训练、布置关键任务",
  "客户事项检查、跑步",
  "力量训练、团队质量复核",
  "工作复盘、下属反馈",
  "运动、家庭、断舍离",
];

const state = {
  selectedDate: clampToDateRange(new Date()),
  weekOffset: 0,
  records: loadJson(STORAGE_KEY, {}),
  weeklyPlans: loadJson(WEEKLY_KEY, {}),
  saveTimer: null,
};

let deferredInstallPrompt = null;
const form = document.querySelector("#dailyForm");
const dateInput = document.querySelector("#dateInput");
const toast = document.querySelector("#toast");

function loadJson(key, fallback) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key));
    return parsed && typeof parsed === "object" ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function clampToDateRange(date) {
  const today = startOfDay(date);
  if (today < PLAN_START) return new Date(PLAN_START);
  if (today > PLAN_END) return new Date(PLAN_END);
  return today;
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
  const [year, month, day] = key.split("-").map(Number);
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
  const prefix = includeYear ? `${date.getFullYear()}年` : "";
  return `${prefix}${date.getMonth() + 1}月${date.getDate()}日`;
}

function getDefaultRecord(key) {
  return {
    date: key,
    weight: "",
    priority1: "",
    priority2: "",
    priority3: "",
    alcohol: "",
    alcoholNote: "",
    fasting: false,
    exercise: "",
    exerciseMinutes: "",
    distance: "",
    declutter: false,
    declutterMinutes: "15",
    declutterArea: "",
    importantWork: false,
    workNote: "",
    reviewAlcohol: false,
    reviewExercise: false,
    reviewWork: false,
    reviewDeclutter: false,
    dailyNote: "",
    updatedAt: "",
  };
}

function getRecord(key) {
  return { ...getDefaultRecord(key), ...(state.records[key] || {}) };
}

function collectForm() {
  const data = new FormData(form);
  const record = getDefaultRecord(toKey(state.selectedDate));

  for (const key of Object.keys(record)) {
    const field = form.elements[key];
    if (!field || key === "date" || key === "updatedAt") continue;
    if (field instanceof RadioNodeList) {
      record[key] = data.get(key) || "";
    } else if (field.type === "checkbox") {
      record[key] = field.checked;
    } else {
      record[key] = field.value.trim();
    }
  }

  record.updatedAt = new Date().toISOString();
  return record;
}

function fillForm(record) {
  form.reset();
  for (const [key, value] of Object.entries(record)) {
    const field = form.elements[key];
    if (!field) continue;
    if (field instanceof RadioNodeList) {
      [...field].forEach((input) => {
        input.checked = input.value === value;
      });
    } else if (field.type === "checkbox") {
      field.checked = Boolean(value);
    } else {
      field.value = value ?? "";
    }
  }
  updateScore(record);
}

function calculateScore(record) {
  const reviewed =
    record.reviewAlcohol &&
    record.reviewExercise &&
    record.reviewWork &&
    record.reviewDeclutter;

  return [
    Boolean(record.weight),
    Boolean(record.fasting),
    record.alcohol === "none" || record.alcohol === "social",
    Boolean(record.exercise && record.exercise !== "rest"),
    Boolean(record.declutter),
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
    ["很好的一天", "稳定比偶尔完美更有力量。"],
    ["优秀的一天", "七项全部完成，记录下来。"],
  ];
  const [label, copy] = labels[score];
  document.querySelector("#scoreValue").textContent = score;
  document.querySelector("#scoreLabel").textContent = label;
  document.querySelector("#scoreCopy").textContent = copy;
  document.querySelector("#scoreRing").style.background =
    `conic-gradient(var(--green) ${score * (360 / 7)}deg, var(--line) 0deg)`;
}

function saveCurrent(showConfirmation = false) {
  const record = collectForm();
  state.records[record.date] = record;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.records));
  updateScore(record);
  const status = document.querySelector("#saveStatus");
  status.textContent = "已自动保存";
  if (showConfirmation) showToast("今日记录已保存");
  window.setTimeout(() => {
    status.textContent = "修改会自动保存";
  }, 1800);
}

function scheduleSave() {
  window.clearTimeout(state.saveTimer);
  document.querySelector("#saveStatus").textContent = "正在保存…";
  state.saveTimer = window.setTimeout(() => saveCurrent(false), 350);
  updateScore();
}

function renderDate() {
  const date = state.selectedDate;
  const key = toKey(date);
  const day = getPlanDay(date);
  const inPlan = date >= PLAN_START && date <= PLAN_END;
  document.querySelector("#dateTitle").textContent =
    `${date.getMonth() + 1}月${date.getDate()}日 ${weekdayNames[date.getDay()]}`;
  document.querySelector("#dateSubtitle").textContent = inPlan
    ? `计划第 ${day} 天`
    : "计划期外记录";
  document.querySelector("#periodBadge").textContent = inPlan
    ? `第 ${getPlanWeek(date)} 周`
    : "自由记录";
  dateInput.value = key;
  document.querySelector("#previousDay").disabled = date <= PLAN_START;
  document.querySelector("#nextDay").disabled = date >= PLAN_END;

  const plan = firstWeekPlan[key];
  document.querySelector("#focusText").textContent =
    plan?.focus || weeklyRhythm[date.getDay()];
  document.querySelector("#focusTasks").textContent = plan?.tasks || "";
  fillForm(getRecord(key));
}

function selectDate(date) {
  saveCurrent(false);
  state.selectedDate = clampToDateRange(date);
  renderDate();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function getRecordedEntries() {
  return Object.values(state.records)
    .filter((record) => record && record.updatedAt)
    .sort((a, b) => b.date.localeCompare(a.date));
}

function renderHistory() {
  const entries = getRecordedEntries();
  const scored = entries.map((record) => calculateScore(record));
  const average = scored.length
    ? (scored.reduce((sum, score) => sum + score, 0) / scored.length).toFixed(1)
    : "0";
  const noAlcoholDays = entries.filter((record) => record.alcohol === "none").length;

  document.querySelector("#historySummary").innerHTML = `
    <div class="summary-stat"><strong>${entries.length}</strong><span>记录天数</span></div>
    <div class="summary-stat"><strong>${average}</strong><span>平均完成</span></div>
    <div class="summary-stat"><strong>${noAlcoholDays}</strong><span>无酒精日</span></div>
  `;

  const list = document.querySelector("#historyList");
  if (!entries.length) {
    list.innerHTML = '<div class="empty-state">还没有记录。今天就是第一条。</div>';
    return;
  }

  list.innerHTML = entries
    .map((record) => {
      const date = fromKey(record.date);
      const score = calculateScore(record);
      const details = [
        record.weight ? `${record.weight}斤` : "",
        exerciseNames[record.exercise] || "",
        record.importantWork ? "重要工作已完成" : "",
      ].filter(Boolean);
      return `
        <button class="history-item" data-date="${record.date}">
          <span class="history-day"><strong>${date.getDate()}</strong>${date.getMonth() + 1}月</span>
          <span class="history-content">
            <strong>${weekdayNames[date.getDay()]}</strong>
            <small>${escapeHtml(details.join(" · ") || "已保存当日记录")}</small>
          </span>
          <span class="history-score">${score} / 7</span>
        </button>
      `;
    })
    .join("");
}

function startOfWeek(date) {
  const copy = startOfDay(date);
  const offset = (copy.getDay() + 6) % 7;
  return addDays(copy, -offset);
}

function getViewedWeekStart() {
  return addDays(startOfWeek(new Date()), state.weekOffset * 7);
}

function renderWeekly() {
  const weekStart = getViewedWeekStart();
  const weekEnd = addDays(weekStart, 6);
  const dates = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  const records = dates.map((date) => getRecord(toKey(date)));
  const existing = records.filter((record) => record.updatedAt);
  const scores = records.map(calculateScore);
  const runs = records.filter((record) => record.exercise === "run").length;
  const strength = records.filter((record) =>
    ["strengthA", "strengthB"].includes(record.exercise)
  ).length;
  const alcoholFree = records.filter((record) => record.alcohol === "none").length;
  const weights = records
    .map((record) => Number(record.weight))
    .filter((weight) => Number.isFinite(weight) && weight > 0);
  const weightText = weights.length
    ? `${Math.min(...weights).toFixed(1)}斤`
    : "—";

  document.querySelector("#weekTitle").textContent =
    `${formatDate(weekStart)} – ${formatDate(weekEnd)}`;
  document.querySelector("#weeklyStats").innerHTML = `
    <div class="stat-card"><strong>${weightText}</strong><span>本周最低体重</span></div>
    <div class="stat-card ${runs >= 3 ? "accent" : ""}"><strong>${runs} / 3</strong><span>跑步次数</span></div>
    <div class="stat-card ${strength >= 2 ? "accent" : ""}"><strong>${strength} / 2</strong><span>力量训练</span></div>
    <div class="stat-card"><strong>${alcoholFree}</strong><span>无酒精日</span></div>
  `;

  const totalScore = scores.reduce((sum, score) => sum + score, 0);
  document.querySelector("#weeklyScore").textContent = existing.length
    ? `${totalScore} / 49`
    : "尚无记录";
  document.querySelector("#weekBars").innerHTML = dates
    .map((date, index) => `
      <div class="day-bar">
        <div class="bar-track">
          <div class="bar-fill" style="height:${Math.max(3, (scores[index] / 7) * 100)}%"></div>
        </div>
        <span>周${shortWeekdays[date.getDay()]}</span>
      </div>
    `)
    .join("");

  const weekKey = toKey(weekStart);
  const plan = state.weeklyPlans[weekKey] || { priorities: "", strengthDays: [] };
  document.querySelector("#nextWeekPriorities").value = plan.priorities || "";
  document.querySelector("#strengthDays").innerHTML = ["一", "二", "三", "四", "五", "六", "日"]
    .map((day, index) => `
      <label>
        <input type="checkbox" value="${index}" ${plan.strengthDays?.includes(index) ? "checked" : ""} />
        <span>${day}</span>
      </label>
    `)
    .join("");
}

function saveWeeklyPlan() {
  const weekKey = toKey(getViewedWeekStart());
  const checked = [...document.querySelectorAll("#strengthDays input:checked")].map(
    (input) => Number(input.value)
  );
  state.weeklyPlans[weekKey] = {
    priorities: document.querySelector("#nextWeekPriorities").value.trim(),
    strengthDays: checked,
  };
  localStorage.setItem(WEEKLY_KEY, JSON.stringify(state.weeklyPlans));
}

function switchView(target) {
  document.querySelectorAll(".view").forEach((view) => {
    view.classList.toggle("active", view.dataset.view === target);
  });
  document.querySelectorAll(".bottom-nav button").forEach((button) => {
    button.classList.toggle("active", button.dataset.target === target);
  });
  if (target === "history") renderHistory();
  if (target === "weekly") renderWeekly();
  window.scrollTo({ top: 0, behavior: "smooth" });
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
    version: 1,
    exportedAt: new Date().toISOString(),
    records: state.records,
    weeklyPlans: state.weeklyPlans,
  };
  downloadFile(
    `每日执行记录-${toKey(new Date())}.json`,
    JSON.stringify(payload, null, 2),
    "application/json"
  );
  showToast("JSON 备份已导出");
}

function csvCell(value) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function exportCsv() {
  const headers = [
    "日期", "体重(斤)", "酒精", "16+8", "运动", "时长(分钟)", "距离(公里)",
    "断舍离", "清理时长", "清理区域", "重要工作", "工作记录", "每日得分", "每日备注",
  ];
  const rows = getRecordedEntries()
    .reverse()
    .map((record) => [
      record.date,
      record.weight,
      record.alcohol === "none" ? "不喝酒" : record.alcohol === "social" ? "应酬限量" : record.alcohol === "drank" ? "已饮酒" : "",
      record.fasting ? "是" : "否",
      exerciseNames[record.exercise] || "",
      record.exerciseMinutes,
      record.distance,
      record.declutter ? "是" : "否",
      record.declutterMinutes,
      record.declutterArea,
      record.importantWork ? "是" : "否",
      record.workNote,
      calculateScore(record),
      record.dailyNote,
    ]);
  const csv = "\uFEFF" + [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
  downloadFile(`每日执行记录-${toKey(new Date())}.csv`, csv, "text/csv;charset=utf-8");
  showToast("CSV 已导出");
}

function importJson(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const payload = JSON.parse(reader.result);
      if (!payload.records || typeof payload.records !== "object") {
        throw new Error("invalid");
      }
      state.records = { ...state.records, ...payload.records };
      state.weeklyPlans = { ...state.weeklyPlans, ...(payload.weeklyPlans || {}) };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.records));
      localStorage.setItem(WEEKLY_KEY, JSON.stringify(state.weeklyPlans));
      renderDate();
      showToast("备份导入成功");
    } catch {
      showToast("无法识别这个备份文件");
    }
  };
  reader.readAsText(file);
}

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("show"), 1800);
}

function updateInstallUi() {
  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;
  const status = document.querySelector("#installStatus");
  const steps = document.querySelector("#installSteps");
  const button = document.querySelector("#installApp");

  if (isStandalone) {
    status.textContent = "已从主屏幕运行，可以离线打开。";
    steps.hidden = true;
    button.hidden = true;
    return;
  }

  if (deferredInstallPrompt) {
    status.textContent = "安装后可从主屏幕快速打开。";
    steps.hidden = true;
    button.hidden = false;
  }
}

form.addEventListener("input", scheduleSave);
form.addEventListener("change", scheduleSave);
form.addEventListener("submit", (event) => {
  event.preventDefault();
  saveCurrent(true);
});

document.querySelector("#previousDay").addEventListener("click", () => {
  selectDate(addDays(state.selectedDate, -1));
});
document.querySelector("#nextDay").addEventListener("click", () => {
  selectDate(addDays(state.selectedDate, 1));
});
document.querySelector("#datePickerButton").addEventListener("click", () => {
  if (typeof dateInput.showPicker === "function") dateInput.showPicker();
  else dateInput.click();
});
dateInput.addEventListener("change", () => selectDate(fromKey(dateInput.value)));

document.querySelector(".bottom-nav").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-target]");
  if (button) switchView(button.dataset.target);
});

document.querySelector("#historyList").addEventListener("click", (event) => {
  const item = event.target.closest("[data-date]");
  if (!item) return;
  state.selectedDate = fromKey(item.dataset.date);
  renderDate();
  switchView("today");
});

document.querySelector("#previousWeek").addEventListener("click", () => {
  saveWeeklyPlan();
  state.weekOffset -= 1;
  renderWeekly();
});
document.querySelector("#nextWeek").addEventListener("click", () => {
  saveWeeklyPlan();
  state.weekOffset += 1;
  renderWeekly();
});
document.querySelector("#nextWeekPriorities").addEventListener("input", saveWeeklyPlan);
document.querySelector("#strengthDays").addEventListener("change", saveWeeklyPlan);
document.querySelector("#exportJson").addEventListener("click", exportJson);
document.querySelector("#exportCsv").addEventListener("click", exportCsv);
document.querySelector("#importJson").addEventListener("change", (event) => {
  const [file] = event.target.files;
  if (file) importJson(file);
  event.target.value = "";
});

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

window.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;
  updateInstallUi();
  showToast("应用已安装");
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {
      // The app remains fully usable online if offline caching is unavailable.
    });
  });
}

updateInstallUi();
renderDate();
