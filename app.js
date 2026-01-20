/* Hockey Tracker - app.js */

const KEY_CURRENT = "ht_current_v2";
const KEY_HISTORY = "ht_history_v2";

// Safe storage (iOS private mode can throw)
const storage = (() => {
  try {
    const t = "__ht_test__";
    localStorage.setItem(t, "1");
    localStorage.removeItem(t);
    return localStorage;
  } catch {
    const mem = new Map();
    return {
      getItem: (k) => (mem.has(k) ? mem.get(k) : null),
      setItem: (k, v) => { mem.set(k, String(v)); },
      removeItem: (k) => { mem.delete(k); }
    };
  }
})();

function todayISO() {
  const d = new Date();
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60 * 1000);
  return local.toISOString().slice(0, 10);
}

function defaultState() {
  return {
    gameDate: todayISO(),
    homeTeam: "",
    awayTeam: "",
    homeColor: "#ff0000",
    awayColor: "#0066ff",
    themeMode: "auto", // auto | light | dark
    layoutMode: "auto", // auto | portrait | landscape

    settingsCollapsed: true,
    savedCollapsed: true,

    homeGoals: 0,
    homeShots: 0,
    awayGoals: 0,
    awayShots: 0,

    editingId: null
  };
}

function loadCurrent() {
  const raw = storage.getItem(KEY_CURRENT);
  if (!raw) return defaultState();
  try {
    const s = JSON.parse(raw);
    return { ...defaultState(), ...s };
  } catch {
    return defaultState();
  }
}

function saveCurrent() {
  storage.setItem(KEY_CURRENT, JSON.stringify(state));
  const n = document.getElementById("autosaveNote");
  if (n) n.textContent = "Auto-saved on this device.";
}

function loadHistory() {
  const raw = storage.getItem(KEY_HISTORY);
  if (!raw) return [];
  try {
    const items = JSON.parse(raw);
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}

function saveHistory(items) {
  storage.setItem(KEY_HISTORY, JSON.stringify(items));
}

let state = loadCurrent();

// Surface unexpected JS errors in the UI (helps debug on iPhone where console is hard)
window.addEventListener("error", (ev) => {
  const banner = document.getElementById("errorBanner");
  if (!banner) return;
  const msg = ev?.error?.message || ev?.message || "Unknown error";
  banner.style.display = "block";
  banner.textContent = `Something went wrong: ${msg}`;
});

// --------- Helpers ---------
function clampShotsAtLeastGoals() {
  state.homeShots = Math.max(state.homeShots, state.homeGoals);
  state.awayShots = Math.max(state.awayShots, state.awayGoals);
}

function pctLabel(saves, shots) {
  if (!shots || shots <= 0) return { pct: 0, text: "0% (0/0)" };
  const p = Math.max(0, Math.min(100, Math.round((saves / shots) * 100)));
  return { pct: p, text: `${p}% (${saves}/${shots})` };
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[c]));
}

// --------- Render ---------
function applyTheme() {
  document.body.classList.remove("theme-light", "theme-dark");
  if (state.themeMode === "light") document.body.classList.add("theme-light");
  if (state.themeMode === "dark") document.body.classList.add("theme-dark");
}

function applyLayoutClass() {
  document.body.classList.remove("layout-portrait", "layout-landscape");

  let mode = state.layoutMode;
  if (mode === "auto") {
    const isLandscape = window.matchMedia && window.matchMedia("(orientation: landscape)").matches;
    mode = isLandscape ? "landscape" : "portrait";
  }
  document.body.classList.add(mode === "landscape" ? "layout-landscape" : "layout-portrait");
}

function renderTeamLabelsAndColors() {
  const home = (state.homeTeam || "Home").trim() || "Home";
  const away = (state.awayTeam || "Away").trim() || "Away";

  const setText = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };

  setText("homeGoalsLabel", `${home} Goals`);
  setText("homeShotsLabel", `${home} Shots`);
  setText("awayGoalsLabel", `${away} Goals`);
  setText("awayShotsLabel", `${away} Shots`);

  setText("homeGoalieLabel", `${home} Goalie Save%`);
  setText("awayGoalieLabel", `${away} Goalie Save%`);

  const setColorBox = (id, color) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (!color) {
      el.style.display = "none";
      return;
    }
    el.style.display = "inline-block";
    el.style.background = color;
  };

  setColorBox("homeGoalsColor", state.homeColor);
  setColorBox("homeShotsColor", state.homeColor);
  setColorBox("awayGoalsColor", state.awayColor);
  setColorBox("awayShotsColor", state.awayColor);
}

function renderGoalieStats() {
  // Home goalie faces away shots/goals
  const homeShotsAgainst = state.awayShots;
  const homeGoalsAgainst = state.awayGoals;
  const homeSaves = Math.max(0, homeShotsAgainst - homeGoalsAgainst);

  // Away goalie faces home shots/goals
  const awayShotsAgainst = state.homeShots;
  const awayGoalsAgainst = state.homeGoals;
  const awaySaves = Math.max(0, awayShotsAgainst - awayGoalsAgainst);

  const h = pctLabel(homeSaves, homeShotsAgainst);
  const a = pctLabel(awaySaves, awayShotsAgainst);

  const elH = document.getElementById("homeGoalieSV");
  const elA = document.getElementById("awayGoalieSV");
  if (elH) elH.textContent = h.text;
  if (elA) elA.textContent = a.text;

  return { homePct: h.pct, awayPct: a.pct };
}

function renderSettingsCollapse() {
  const body = document.getElementById("settingsBody");
  const hint = document.getElementById("settingsHint");
  const summary = document.getElementById("settingsSummary");

  // Hide the "Game Settings" title when collapsed
  const titleEl = document.querySelector("#settingsCard .settingsHeader .title");

  if (state.settingsCollapsed) {
    body?.classList.add("hidden");
    hint?.classList.add("hidden");
    if (titleEl) titleEl.classList.add("hidden");
    if (summary) {
      summary.textContent = ""; // user requested: remove "Showing:" and beyond
      summary.classList.add("hidden");
    }
  } else {
    body?.classList.remove("hidden");
    hint?.classList.remove("hidden");
    if (titleEl) titleEl.classList.remove("hidden");
    if (summary) {
      summary.textContent = "";
      summary.classList.add("hidden");
    }
  }
}

function renderSavedCollapse() {
  const body = document.getElementById("savedBody");
  const chev = document.getElementById("savedChev");
  if (state.savedCollapsed) {
    body?.classList.add("hidden");
    if (chev) chev.textContent = "▸";
  } else {
    body?.classList.remove("hidden");
    if (chev) chev.textContent = "▾";
  }
}

function renderEditingNote() {
  const n = document.getElementById("editingNote");
  const btn = document.getElementById("saveBtn");
  if (!n || !btn) return;
  if (state.editingId) {
    n.textContent = "Editing a saved game — saving will update it.";
    btn.textContent = "Save Changes";
  } else {
    n.textContent = "";
    btn.textContent = "Save Game";
  }
}

function renderHistory() {
  const list = document.getElementById("history");
  if (!list) return;

  const history = loadHistory();
  list.innerHTML = "";

  if (history.length === 0) {
    list.innerHTML = `<div class="muted" style="margin-top:10px;">No saved games yet.</div>`;
    return;
  }

  for (const g of history) {
    const home = (g.homeTeam || "Home").trim() || "Home";
    const away = (g.awayTeam || "Away").trim() || "Away";

    // Goalie pcts for display (Home goalie pct - Away goalie pct)
    const homePct = (() => {
      const shots = g.awayShots || 0;
      const goals = g.awayGoals || 0;
      if (shots <= 0) return 0;
      return Math.round(((Math.max(0, shots - goals)) / shots) * 100);
    })();
    const awayPct = (() => {
      const shots = g.homeShots || 0;
      const goals = g.homeGoals || 0;
      if (shots <= 0) return 0;
      return Math.round(((Math.max(0, shots - goals)) / shots) * 100);
    })();

    const item = document.createElement("div");
    item.className = "listitem";
    item.setAttribute("role", "button");

    item.innerHTML = `
      <div class="listtop">
        <div>
          <div class="title">${escapeHtml(g.gameDate || "")} — ${escapeHtml(home)} vs ${escapeHtml(away)}</div>
          <div class="meta">Score <b>${g.homeGoals || 0}-${g.awayGoals || 0}</b> • Shots <b>${g.homeShots || 0}-${g.awayShots || 0}</b> • SV% <b>${homePct}%-${awayPct}%</b></div>
        </div>
        <div class="right">
          <button class="smallbtn danger" type="button" data-del="${escapeHtml(g.id)}">Delete</button>
        </div>
      </div>
    `;

    // Click to resume (but not when deleting)
    item.addEventListener("click", (e) => {
      const t = e.target;
      if (t && t.getAttribute && t.getAttribute("data-del")) return;
      resumeGame(g.id);
    });

    // Delete handler
    const delBtn = item.querySelector("button[data-del]");
    if (delBtn) {
      delBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        deleteGame(g.id);
      });
    }

    list.appendChild(item);
  }
}

function render() {
  // Inputs
  const setVal = (id, v) => {
    const el = document.getElementById(id);
    if (el) el.value = v;
  };

  setVal("gameDate", state.gameDate || todayISO());
  setVal("homeTeam", state.homeTeam || "");
  setVal("awayTeam", state.awayTeam || "");
  setVal("homeColor", state.homeColor || "#ff0000");
  setVal("awayColor", state.awayColor || "#0066ff");
  setVal("layoutMode", state.layoutMode || "auto");
  setVal("themeMode", state.themeMode || "auto");

  // Tip text (requested)
  const tip = document.getElementById("tipText");
  if (tip) {
    tip.textContent = "Tips: Adding or removing a goal will also add or remove a shot.  Any puck that goes into the net (a goal) or would have gone in if not for the goalie is counted as a shot on goal.";
  }

  // Stats numbers
  for (const k of ["homeGoals", "homeShots", "awayGoals", "awayShots"]) {
    const el = document.getElementById(k);
    if (el) el.textContent = String(state[k] ?? 0);
  }

  applyTheme();
  applyLayoutClass();
  renderTeamLabelsAndColors();
  renderGoalieStats();
  renderSettingsCollapse();
  renderSavedCollapse();
  renderEditingNote();
  renderHistory();
}

// --------- Wire inputs ---------
function wireInputs() {
  const on = (id, fn) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("input", fn);
  };

  on("gameDate", (e) => { state.gameDate = e.target.value; saveCurrent(); render(); });
  on("homeTeam", (e) => { state.homeTeam = e.target.value; saveCurrent(); render(); });
  on("awayTeam", (e) => { state.awayTeam = e.target.value; saveCurrent(); render(); });
  on("homeColor", (e) => { state.homeColor = e.target.value; saveCurrent(); render(); });
  on("awayColor", (e) => { state.awayColor = e.target.value; saveCurrent(); render(); });
  on("layoutMode", (e) => { state.layoutMode = e.target.value; saveCurrent(); render(); });
  on("themeMode", (e) => { state.themeMode = e.target.value; saveCurrent(); render(); });

  const toggleSettingsBtn = document.getElementById("toggleSettingsBtn");
  toggleSettingsBtn?.addEventListener("click", () => {
    state.settingsCollapsed = !state.settingsCollapsed;
    saveCurrent();
    render();
  });

  const savedHeader = document.getElementById("savedHeader");
  savedHeader?.addEventListener("click", () => {
    state.savedCollapsed = !state.savedCollapsed;
    saveCurrent();
    renderSavedCollapse();
  });

  // React to phone rotation when layoutMode is auto
  window.addEventListener("orientationchange", () => {
    if (state.layoutMode === "auto") {
      applyLayoutClass();
    }
  });
}

// --------- Public button actions (inline onclick in HTML) ---------
window.inc = (key) => {
  if (key === "homeGoals") {
    state.homeGoals += 1;
    state.homeShots += 1;
  } else if (key === "awayGoals") {
    state.awayGoals += 1;
    state.awayShots += 1;
  } else {
    state[key] = (state[key] ?? 0) + 1;
  }

  clampShotsAtLeastGoals();
  saveCurrent();
  render();
};

window.dec = (key) => {
  if (key === "homeGoals") {
    if (state.homeGoals > 0) {
      state.homeGoals -= 1;
      if (state.homeShots > 0) state.homeShots -= 1;
    }
  } else if (key === "awayGoals") {
    if (state.awayGoals > 0) {
      state.awayGoals -= 1;
      if (state.awayShots > 0) state.awayShots -= 1;
    }
  } else {
    state[key] = Math.max(0, (state[key] ?? 0) - 1);
  }

  clampShotsAtLeastGoals();
  saveCurrent();
  render();
};

function makeId() {
  // Some iOS versions can throw if we reference an undefined global `crypto`.
  // Always access through `window` to avoid crashing the whole script.
  if (window.crypto && typeof window.crypto.randomUUID === "function") return window.crypto.randomUUID();
  return String(Date.now()) + "_" + Math.random().toString(16).slice(2);
}

window.saveGame = () => {
  // Confirm ending/saving the current game
  const msg = state.editingId
    ? "Save changes to this saved game?"
    : "Are you sure you want to end the current game and save it?";
  if (!confirm(msg)) return;

  const history = loadHistory();

  const payload = {
    id: state.editingId || makeId(),
    savedAt: new Date().toISOString(),

    gameDate: state.gameDate || todayISO(),
    homeTeam: state.homeTeam || "",
    awayTeam: state.awayTeam || "",
    homeColor: state.homeColor || "#ff0000",
    awayColor: state.awayColor || "#0066ff",

    homeGoals: state.homeGoals ?? 0,
    awayGoals: state.awayGoals ?? 0,
    homeShots: state.homeShots ?? 0,
    awayShots: state.awayShots ?? 0
  };

  const idx = history.findIndex((g) => g.id === payload.id);
  if (idx >= 0) history[idx] = payload;
  else history.unshift(payload);

  saveHistory(history);

  // After saving, start fresh scoring but keep settings
  state.homeGoals = 0;
  state.homeShots = 0;
  state.awayGoals = 0;
  state.awayShots = 0;
  state.editingId = null;

  saveCurrent();
  render();
};

// Reset current game (scores + shots) but keep settings
window.resetGame = () => {
  const ok = confirm("Are you sure you want to reset the current game? This will set goals and shots back to 0.");
  if (!ok) return;

  state.homeGoals = 0;
  state.homeShots = 0;
  state.awayGoals = 0;
  state.awayShots = 0;
  state.editingId = null;

  saveCurrent();
  render();
};

function resumeGame(id) {
  const history = loadHistory();
  const g = history.find((x) => x.id === id);
  if (!g) return;

  state.gameDate = g.gameDate || todayISO();
  state.homeTeam = g.homeTeam || "";
  state.awayTeam = g.awayTeam || "";
  state.homeColor = g.homeColor || state.homeColor;
  state.awayColor = g.awayColor || state.awayColor;

  state.homeGoals = g.homeGoals || 0;
  state.homeShots = g.homeShots || 0;
  state.awayGoals = g.awayGoals || 0;
  state.awayShots = g.awayShots || 0;

  state.editingId = g.id;

  // Keep settings collapsed state as-is
  saveCurrent();
  render();
}

function deleteGame(id) {
  const ok = confirm("Are you sure you want to delete this saved game?");
  if (!ok) return;
  const history = loadHistory().filter((g) => g.id !== id);
  saveHistory(history);

  if (state.editingId === id) {
    state.editingId = null;
    saveCurrent();
  }

  renderHistory();
}

window.clearAll = () => {
  const ok = confirm("Are you sure you want to clear ALL saved games? This can't be undone.");
  if (!ok) return;
  storage.removeItem(KEY_HISTORY);
  if (state.editingId) {
    state.editingId = null;
    saveCurrent();
    renderEditingNote();
  }
  renderHistory();
};

// --------- Service worker ---------
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}

// --------- Init ---------
wireInputs();
saveCurrent();
render();
