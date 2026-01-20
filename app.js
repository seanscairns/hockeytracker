// Hockey Tracker (local-only PWA)

const KEY_CURRENT_V1 = "ht_current_v1";
const KEY_HISTORY_V1 = "ht_history_v1";
const KEY_CURRENT_V2 = "ht_current_v2";
const KEY_HISTORY_V2 = "ht_history_v2";

function todayISO() {
  const d = new Date();
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60 * 1000);
  return local.toISOString().slice(0, 10);
}

function safeParse(json, fallback) {
  try { return JSON.parse(json); } catch { return fallback; }
}

function defaultState() {
  return {
    gameDate: todayISO(),
    homeTeam: "",
    awayTeam: "",
    homeColor: "#ff0000",
    awayColor: "#0066ff",
    layoutMode: "auto", // auto|portrait|landscape
    themeMode: "auto",  // auto|light|dark
    settingsCollapsed: true,
    savedGamesCollapsed: true,
    homeGoals: 0,
    awayGoals: 0,
    homeShots: 0,
    awayShots: 0,
    editingId: null
  };
}

function migrateIfNeeded() {
  // Migrate current
  if (!localStorage.getItem(KEY_CURRENT_V2)) {
    const old = safeParse(localStorage.getItem(KEY_CURRENT_V1), null);
    if (old && typeof old === "object") {
      const next = {
        ...defaultState(),
        gameDate: old.gameDate || todayISO(),
        awayTeam: old.opponent || "",
        homeGoals: Number(old.homeGoals || 0),
        awayGoals: Number(old.awayGoals || 0),
        homeShots: Number(old.homeShots || 0),
        awayShots: Number(old.awayShots || 0)
      };
      localStorage.setItem(KEY_CURRENT_V2, JSON.stringify(next));
    }
  }

  // Migrate history
  if (!localStorage.getItem(KEY_HISTORY_V2)) {
    const oldItems = safeParse(localStorage.getItem(KEY_HISTORY_V1), []);
    if (Array.isArray(oldItems) && oldItems.length) {
      const nextItems = oldItems.map((g) => ({
        id: g.id || (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random())),
        savedAt: g.savedAt || new Date().toISOString(),
        gameDate: g.gameDate || todayISO(),
        homeTeam: "",
        awayTeam: g.opponent || "",
        homeColor: "#ff0000",
        awayColor: "#0066ff",
        homeGoals: Number(g.homeGoals || 0),
        awayGoals: Number(g.awayGoals || 0),
        homeShots: Number(g.homeShots || 0),
        awayShots: Number(g.awayShots || 0),
        layoutMode: "auto",
        themeMode: "auto"
      }));
      localStorage.setItem(KEY_HISTORY_V2, JSON.stringify(nextItems));
    }
  }
}

function loadCurrent() {
  const saved = localStorage.getItem(KEY_CURRENT_V2);
  if (!saved) return defaultState();
  const parsed = safeParse(saved, null);
  if (parsed && typeof parsed === "object") return { ...defaultState(), ...parsed };
  return defaultState();
}

function saveCurrent(next) {
  localStorage.setItem(KEY_CURRENT_V2, JSON.stringify(next));
  const note = document.getElementById("autosaveNote");
  if (note) note.textContent = "Auto-saved on this device.";
}

function loadHistory() {
  const saved = localStorage.getItem(KEY_HISTORY_V2);
  if (!saved) return [];
  const parsed = safeParse(saved, []);
  return Array.isArray(parsed) ? parsed : [];
}

function saveHistory(items) {
  localStorage.setItem(KEY_HISTORY_V2, JSON.stringify(items));
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

function setSwatch(id, color) {
  const el = document.getElementById(id);
  if (!el) return;
  if (color) {
    el.style.background = color;
    el.style.display = "inline-block";
  } else {
    el.style.display = "none";
  }
}

function applyTheme() {
  const mode = state.themeMode || "auto";
  document.body.classList.remove("theme-light", "theme-dark");
  if (mode === "light") document.body.classList.add("theme-light");
  if (mode === "dark") document.body.classList.add("theme-dark");
}

let themeMql = null;
function wireAutoThemeListener() {
  if (!window.matchMedia) return;
  if (!themeMql) themeMql = window.matchMedia("(prefers-color-scheme: dark)");
  const handler = () => {
    if ((state.themeMode || "auto") === "auto") applyTheme();
  };
  try { themeMql.removeEventListener("change", handler); } catch {}
  try { themeMql.addEventListener("change", handler); } catch {}
}

function applyLabelsAndColors() {
  const home = (state.homeTeam || "Home").trim() || "Home";
  const away = (state.awayTeam || "Away").trim() || "Away";

  const setText = (id, txt) => {
    const el = document.getElementById(id);
    if (el) el.textContent = txt;
  };

  setText("homeGoalsLabel", `${home} Goals`);
  setText("homeShotsLabel", `${home} Shots`);
  setText("awayGoalsLabel", `${away} Goals`);
  setText("awayShotsLabel", `${away} Shots`);

  // Goalie labels (no "vs" text)
  setText("homeGoalieLabel", `${home} Goalie Save%`);
  setText("awayGoalieLabel", `${away} Goalie Save%`);

  setSwatch("homeSwatchGoals", state.homeColor);
  setSwatch("homeSwatchShots", state.homeColor);
  setSwatch("awaySwatchGoals", state.awayColor);
  setSwatch("awaySwatchShots", state.awayColor);
}

function formatSavePct(shotsAgainst, goalsAgainst) {
  const sa = Number(shotsAgainst || 0);
  const ga = Number(goalsAgainst || 0);
  if (!Number.isFinite(sa) || sa <= 0) return "—";
  const saves = Math.max(0, sa - Math.max(0, ga));
  const pct = (saves / sa) * 100;
  return `${Math.round(pct)}% (${saves}/${sa})`;
}

function formatSavePctShort(shotsAgainst, goalsAgainst) {
  const sa = Number(shotsAgainst || 0);
  const ga = Number(goalsAgainst || 0);
  if (!Number.isFinite(sa) || sa <= 0) return "0%";
  const saves = Math.max(0, sa - Math.max(0, ga));
  const pct = (saves / sa) * 100;
  return `${Math.round(pct)}%`;
}

function applySettingsCollapse() {
  const body = document.getElementById("settingsBody");
  const hint = document.getElementById("settingsHint");
  const title = document.getElementById("settingsTitle");
  const summary = document.getElementById("settingsSummary");

  const collapsed = !!state.settingsCollapsed;
  if (body) body.classList.toggle("hidden", collapsed);
  if (hint) hint.classList.toggle("hidden", collapsed);
  if (title) title.classList.toggle("hidden", collapsed); // hide "Game Settings" text when collapsed
  if (summary) summary.textContent = ""; // remove "Showing:" summary entirely
}

function applySavedGamesCollapse() {
  const body = document.getElementById("savedGamesBody");
  const chev = document.getElementById("savedGamesChevron");
  if (body) body.classList.toggle("hidden", !!state.savedGamesCollapsed);
  if (chev) chev.textContent = state.savedGamesCollapsed ? "▸" : "▾";
}

function setBodyLayout(cls) {
  document.body.classList.remove("layout-portrait", "layout-landscape");
  if (cls) document.body.classList.add(cls);
}

function applyLayoutMode() {
  if (state.layoutMode === "portrait") return setBodyLayout("layout-portrait");
  if (state.layoutMode === "landscape") return setBodyLayout("layout-landscape");

  const isLandscape = window.matchMedia && window.matchMedia("(orientation: landscape)").matches;
  setBodyLayout(isLandscape ? "layout-landscape" : "layout-portrait");
}

let orientationMql = null;
function wireAutoOrientationListener() {
  if (!window.matchMedia) return;
  if (!orientationMql) orientationMql = window.matchMedia("(orientation: landscape)");

  const handler = () => {
    if (state.layoutMode === "auto") applyLayoutMode();
  };

  try { orientationMql.removeEventListener("change", handler); } catch {}
  try { orientationMql.addEventListener("change", handler); } catch {
    window.addEventListener("resize", handler);
  }
}

function render() {
  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (!el) return;
    const next = String(val ?? "");
    if (el.value !== next) el.value = next;
  };

  setVal("gameDate", state.gameDate || todayISO());
  setVal("homeTeam", state.homeTeam || "");
  setVal("awayTeam", state.awayTeam || "");
  setVal("homeColor", state.homeColor || "#ff0000");
  setVal("awayColor", state.awayColor || "#0066ff");
  setVal("layoutMode", state.layoutMode || "auto");
  setVal("themeMode", state.themeMode || "auto");

  for (const k of ["homeGoals", "awayGoals", "homeShots", "awayShots"]) {
    const el = document.getElementById(k);
    if (el) el.textContent = String(state[k] ?? 0);
  }

  // Goalie save percentages
  const homePctEl = document.getElementById("homeGoaliePct");
  const awayPctEl = document.getElementById("awayGoaliePct");
  if (homePctEl) homePctEl.textContent = formatSavePct(state.awayShots, state.awayGoals);
  if (awayPctEl) awayPctEl.textContent = formatSavePct(state.homeShots, state.homeGoals);

  // Save button / editing note
  const saveBtn = document.getElementById("saveBtn");
  const editingNote = document.getElementById("editingNote");
  if (saveBtn) saveBtn.textContent = state.editingId ? "Save Changes" : "Save Game";
  if (editingNote) editingNote.textContent = state.editingId ? "Editing a saved game (tap another saved game to switch)." : "";

  applyTheme();
  applyLabelsAndColors();
  applySettingsCollapse();
  applySavedGamesCollapse();
  applyLayoutMode();
  renderHistory();
}

function wireInputs() {
  const on = (id, fn) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("input", fn);
    el.addEventListener("change", fn);
  };

  on("gameDate", (e) => {
    state.gameDate = e.target.value;
    saveCurrent(state);
    render();
  });

  on("homeTeam", (e) => {
    state.homeTeam = e.target.value;
    saveCurrent(state);
    render();
  });

  on("awayTeam", (e) => {
    state.awayTeam = e.target.value;
    saveCurrent(state);
    render();
  });

  on("homeColor", (e) => {
    state.homeColor = e.target.value;
    saveCurrent(state);
    render();
  });

  on("awayColor", (e) => {
    state.awayColor = e.target.value;
    saveCurrent(state);
    render();
  });

  on("layoutMode", (e) => {
    state.layoutMode = e.target.value;
    saveCurrent(state);
    applyLayoutMode();
    applySettingsCollapse();
  });

  on("themeMode", (e) => {
    state.themeMode = e.target.value;
    saveCurrent(state);
    applyTheme();
  });

  const toggleBtn = document.getElementById("toggleSettingsBtn");
  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      state.settingsCollapsed = !state.settingsCollapsed;
      saveCurrent(state);
      applySettingsCollapse();
    });
  }

  const savedHeader = document.getElementById("savedGamesHeader");
  if (savedHeader) {
    const toggle = () => {
      state.savedGamesCollapsed = !state.savedGamesCollapsed;
      saveCurrent(state);
      applySavedGamesCollapse();
    };
    savedHeader.addEventListener("click", toggle);
    savedHeader.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggle();
      }
    });
  }
}

window.inc = (key) => {
  // Goals automatically add a shot for that team.
  if (key === "homeGoals") {
    state.homeGoals = (state.homeGoals ?? 0) + 1;
    state.homeShots = (state.homeShots ?? 0) + 1;
  } else if (key === "awayGoals") {
    state.awayGoals = (state.awayGoals ?? 0) + 1;
    state.awayShots = (state.awayShots ?? 0) + 1;
  } else {
    state[key] = (state[key] ?? 0) + 1;
  }
  saveCurrent(state);
  render();
};

window.dec = (key) => {
  // Removing a goal also removes a shot for that team.
  if (key === "homeGoals") {
    if ((state.homeGoals ?? 0) > 0) {
      state.homeGoals = Math.max(0, (state.homeGoals ?? 0) - 1);
      state.homeShots = Math.max(0, (state.homeShots ?? 0) - 1);
    }
  } else if (key === "awayGoals") {
    if ((state.awayGoals ?? 0) > 0) {
      state.awayGoals = Math.max(0, (state.awayGoals ?? 0) - 1);
      state.awayShots = Math.max(0, (state.awayShots ?? 0) - 1);
    }
  } else {
    state[key] = Math.max(0, (state[key] ?? 0) - 1);
  }
  saveCurrent(state);
  render();
};

window.resetCurrent = () => {
  state.homeGoals = 0;
  state.awayGoals = 0;
  state.homeShots = 0;
  state.awayShots = 0;
  state.editingId = null;
  saveCurrent(state);
  render();
};

window.saveGame = () => {
  const history = loadHistory();

  const gamePayload = {
    gameDate: state.gameDate || todayISO(),
    homeTeam: (state.homeTeam || "").trim(),
    awayTeam: (state.awayTeam || "").trim(),
    homeColor: state.homeColor || "",
    awayColor: state.awayColor || "",
    homeGoals: state.homeGoals ?? 0,
    awayGoals: state.awayGoals ?? 0,
    homeShots: state.homeShots ?? 0,
    awayShots: state.awayShots ?? 0,
    layoutMode: state.layoutMode || "auto",
    themeMode: state.themeMode || "auto"
  };

  if (state.editingId) {
    const idx = history.findIndex(g => g.id === state.editingId);
    if (idx >= 0) {
      history[idx] = { ...history[idx], ...gamePayload, savedAt: new Date().toISOString() };
    } else {
      const id = crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
      history.unshift({ id, savedAt: new Date().toISOString(), ...gamePayload });
      state.editingId = id;
    }
  } else {
    const id = crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
    history.unshift({ id, savedAt: new Date().toISOString(), ...gamePayload });
    state.editingId = id;
  }

  saveHistory(history);
  saveCurrent(state);
  renderHistory();
  render();
};

window.loadGame = (id) => {
  const g = loadHistory().find(x => x.id === id);
  if (!g) return;

  state.gameDate = g.gameDate || todayISO();
  state.homeTeam = g.homeTeam || "";
  state.awayTeam = g.awayTeam || "";
  state.homeColor = g.homeColor || state.homeColor;
  state.awayColor = g.awayColor || state.awayColor;
  state.homeGoals = Number(g.homeGoals || 0);
  state.awayGoals = Number(g.awayGoals || 0);
  state.homeShots = Number(g.homeShots || 0);
  state.awayShots = Number(g.awayShots || 0);
  state.layoutMode = g.layoutMode || state.layoutMode;
  state.themeMode = g.themeMode || state.themeMode;
  state.editingId = g.id;

  saveCurrent(state);
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
};

window.deleteGame = (id) => {
  const history = loadHistory().filter(g => g.id !== id);
  saveHistory(history);
  if (state.editingId === id) {
    state.editingId = null;
    saveCurrent(state);
  }
  renderHistory();
  render();
};

window.clearAll = () => {
  localStorage.removeItem(KEY_HISTORY_V2);
  state.editingId = null;
  saveCurrent(state);
  renderHistory();
  render();
};

function renderHistory() {
  const history = loadHistory();
  const el = document.getElementById("history");
  if (!el) return;
  el.innerHTML = "";

  if (history.length === 0) {
    el.innerHTML = `<div class="muted" style="margin-top:10px;">No saved games yet.</div>`;
    return;
  }

  for (const g of history) {
    const home = (g.homeTeam || "Home").trim() || "Home";
    const away = (g.awayTeam || "Away").trim() || "Away";
    const score = `${Number(g.homeGoals || 0)}-${Number(g.awayGoals || 0)}`;
    const shots = `${Number(g.homeShots || 0)}-${Number(g.awayShots || 0)}`;

    // Home goalie faces away shots/goals; Away goalie faces home shots/goals
    const homeSv = formatSavePctShort(g.awayShots, g.awayGoals);
    const awaySv = formatSavePctShort(g.homeShots, g.homeGoals);

    const item = document.createElement("div");
    item.className = "listitem";
    item.setAttribute("role", "button");
    item.setAttribute("tabindex", "0");

    const activePill = state.editingId === g.id ? `<span class="pill">Resuming</span>` : "";

    item.innerHTML = `
      <div class="listtop">
        <div>
          <div class="title">${escapeHtml(g.gameDate || "")}\u00a0 ${escapeHtml(home)} vs ${escapeHtml(away)} ${activePill}</div>
          <div class="meta">Score <b>${escapeHtml(score)}</b> • Shots <b>${escapeHtml(shots)}</b> • SV% <b>${escapeHtml(homeSv)}-${escapeHtml(awaySv)}</b></div>
        </div>
        <div class="right">
          <button class="smallbtn danger" onclick="event.stopPropagation(); deleteGame('${g.id}')">Delete</button>
        </div>
      </div>
    `;

    item.addEventListener("click", () => window.loadGame(g.id));
    item.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        window.loadGame(g.id);
      }
    });

    el.appendChild(item);
  }
}

// Service worker registration (installable/offline-ish)
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}

migrateIfNeeded();
let state = loadCurrent();

wireInputs();
wireAutoOrientationListener();
wireAutoThemeListener();
saveCurrent(state); // ensure it exists
render();
