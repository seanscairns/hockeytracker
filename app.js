// Hockey Tracker (PWA)
// Local-only: everything is stored on the device (localStorage).

const KEY_CURRENT = "ht_current_v3";
const KEY_HISTORY = "ht_history_v3";

function todayISO() {
  const d = new Date();
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60 * 1000);
  return local.toISOString().slice(0, 10);
}

function $(id) {
  return document.getElementById(id);
}

function clamp0(n) {
  return Math.max(0, n | 0);
}

function loadJSON(key, fallback) {
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function saveJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function defaultState() {
  return {
    gameDate: todayISO(),
    homeTeam: "",
    awayTeam: "",
    homeColor: "#000000",
    awayColor: "#000000",
    themeMode: "auto", // auto | light | dark
    layoutMode: "auto", // auto | portrait | landscape
    settingsCollapsed: true,
    savedCollapsed: true,
    editingGameId: null,
    homeGoals: 0,
    awayGoals: 0,
    homeShots: 0,
    awayShots: 0
  };
}

function loadCurrent() {
  const s = loadJSON(KEY_CURRENT, null);
  if (!s) return defaultState();
  // Merge (handles upgrades)
  return { ...defaultState(), ...s };
}

function saveCurrent() {
  saveJSON(KEY_CURRENT, state);
  const note = $("autosaveNote");
  if (note) note.textContent = "Auto-saved on this device.";
}

function loadHistory() {
  const items = loadJSON(KEY_HISTORY, []);
  return Array.isArray(items) ? items : [];
}

function saveHistory(items) {
  saveJSON(KEY_HISTORY, items);
}

let state = loadCurrent();

// ---------- Theme / Layout ----------
function applyTheme() {
  document.body.classList.remove("theme-light", "theme-dark");
  const mode = state.themeMode || "auto";
  if (mode === "light") document.body.classList.add("theme-light");
  if (mode === "dark") document.body.classList.add("theme-dark");
}

function isLandscapeByDevice() {
  return window.matchMedia && window.matchMedia("(orientation: landscape)").matches;
}

function applyLayout() {
  document.body.classList.remove("layout-landscape");
  const mode = state.layoutMode || "auto";
  const landscape = mode === "landscape" || (mode === "auto" && isLandscapeByDevice());
  if (landscape) document.body.classList.add("layout-landscape");
}

// ---------- Rendering ----------
function setColorBox(id, color) {
  const box = $(id);
  if (!box) return;
  if (color) {
    box.style.background = color;
    box.style.display = "inline-block";
  } else {
    box.style.display = "none";
  }
}

function teamNameOrDefault(name, fallback) {
  const t = (name || "").trim();
  return t || fallback;
}

function computeSavePct(shotsAgainst, goalsAgainst) {
  const sa = clamp0(shotsAgainst);
  const ga = clamp0(goalsAgainst);
  if (sa <= 0) return { pct: 0, saves: 0, sa: 0 };
  const saves = clamp0(sa - ga);
  const pct = Math.max(0, Math.min(100, Math.round((saves / sa) * 100)));
  return { pct, saves, sa };
}

function updateGoalieStats() {
  const homeTeam = teamNameOrDefault(state.homeTeam, "Home");
  const awayTeam = teamNameOrDefault(state.awayTeam, "Away");

  // Home goalie faces away shots/goals
  const homeGoalie = computeSavePct(state.awayShots, state.awayGoals);
  const awayGoalie = computeSavePct(state.homeShots, state.homeGoals);

  const homeLabel = $("homeGoalieLabel");
  const awayLabel = $("awayGoalieLabel");
  if (homeLabel) homeLabel.textContent = `${homeTeam} Goalie Save%`;
  if (awayLabel) awayLabel.textContent = `${awayTeam} Goalie Save%`;

  const homeSV = $("homeGoalieSV");
  const awaySV = $("awayGoalieSV");
  if (homeSV) homeSV.textContent = `${homeGoalie.pct}% (${homeGoalie.saves}/${homeGoalie.sa})`;
  if (awaySV) awaySV.textContent = `${awayGoalie.pct}% (${awayGoalie.saves}/${awayGoalie.sa})`;

  return { homePct: homeGoalie.pct, awayPct: awayGoalie.pct };
}

function render() {
  // Inputs
  if ($("gameDate")) $("gameDate").value = state.gameDate || todayISO();
  if ($("homeTeam")) $("homeTeam").value = state.homeTeam || "";
  if ($("awayTeam")) $("awayTeam").value = state.awayTeam || "";
  if ($("homeColor")) $("homeColor").value = state.homeColor || "#000000";
  if ($("awayColor")) $("awayColor").value = state.awayColor || "#000000";
  if ($("themeMode")) $("themeMode").value = state.themeMode || "auto";
  if ($("layoutMode")) $("layoutMode").value = state.layoutMode || "auto";

  applyTheme();
  applyLayout();

  // Labels
  const homeTeam = teamNameOrDefault(state.homeTeam, "Home");
  const awayTeam = teamNameOrDefault(state.awayTeam, "Away");
  if ($("homeGoalsLabel")) $("homeGoalsLabel").textContent = `${homeTeam} Goals`;
  if ($("homeShotsLabel")) $("homeShotsLabel").textContent = `${homeTeam} Shots`;
  if ($("awayGoalsLabel")) $("awayGoalsLabel").textContent = `${awayTeam} Goals`;
  if ($("awayShotsLabel")) $("awayShotsLabel").textContent = `${awayTeam} Shots`;

  // Color boxes
  setColorBox("homeColorBoxGoals", state.homeColor);
  setColorBox("homeColorBoxShots", state.homeColor);
  setColorBox("awayColorBoxGoals", state.awayColor);
  setColorBox("awayColorBoxShots", state.awayColor);

  // Stats numbers
  for (const k of ["homeGoals", "homeShots", "awayGoals", "awayShots"]) {
    const el = $(k);
    if (el) el.textContent = String(clamp0(state[k] ?? 0));
  }

  // Goalie
  updateGoalieStats();

  // Settings collapse
  const settingsBody = $("settingsBody");
  if (settingsBody) settingsBody.classList.toggle("hidden", !!state.settingsCollapsed);

  // Saved collapse
  const savedBody = $("savedBody");
  const chev = $("savedChevron");
  if (savedBody) savedBody.classList.toggle("hidden", !!state.savedCollapsed);
  if (chev) chev.textContent = state.savedCollapsed ? "▸" : "▾";

  // Save button label
  const saveBtn = $("saveBtn");
  if (saveBtn) saveBtn.textContent = state.editingGameId ? "Save Changes" : "Save Game";

  renderHistory();
}

// ---------- Inputs / Events ----------
function wireInputs() {
  const gameDate = $("gameDate");
  if (gameDate) {
    gameDate.addEventListener("input", (e) => {
      state.gameDate = e.target.value || todayISO();
      saveCurrent();
      render();
    });
  }

  const homeTeam = $("homeTeam");
  if (homeTeam) {
    homeTeam.addEventListener("input", (e) => {
      state.homeTeam = e.target.value || "";
      saveCurrent();
      render();
    });
  }

  const awayTeam = $("awayTeam");
  if (awayTeam) {
    awayTeam.addEventListener("input", (e) => {
      state.awayTeam = e.target.value || "";
      saveCurrent();
      render();
    });
  }

  const homeColor = $("homeColor");
  if (homeColor) {
    homeColor.addEventListener("input", (e) => {
      state.homeColor = e.target.value || "#000000";
      saveCurrent();
      render();
    });
  }

  const awayColor = $("awayColor");
  if (awayColor) {
    awayColor.addEventListener("input", (e) => {
      state.awayColor = e.target.value || "#000000";
      saveCurrent();
      render();
    });
  }

  const themeMode = $("themeMode");
  if (themeMode) {
    themeMode.addEventListener("input", (e) => {
      state.themeMode = e.target.value || "auto";
      saveCurrent();
      render();
    });
  }

  const layoutMode = $("layoutMode");
  if (layoutMode) {
    layoutMode.addEventListener("input", (e) => {
      state.layoutMode = e.target.value || "auto";
      saveCurrent();
      render();
    });
  }

  // Settings toggle (collapsed by default; no title text when collapsed)
  const settingsToggle = $("settingsToggle");
  if (settingsToggle) {
    settingsToggle.addEventListener("click", () => {
      state.settingsCollapsed = !state.settingsCollapsed;
      saveCurrent();
      render();
    });
  }

  // Saved games toggle
  const savedToggle = $("savedToggle");
  if (savedToggle) {
    savedToggle.addEventListener("click", () => {
      state.savedCollapsed = !state.savedCollapsed;
      saveCurrent();
      render();
    });
  }

  // Update layout on device rotation (only in auto)
  window.addEventListener("orientationchange", () => {
    if ((state.layoutMode || "auto") === "auto") render();
  });
  window.addEventListener("resize", () => {
    if ((state.layoutMode || "auto") === "auto") render();
  });
}

// ---------- Scorekeeping (called by inline onclick) ----------
window.inc = (key) => {
  const k = String(key);
  // Goal changes also change shots
  if (k === "homeGoals") {
    state.homeGoals = clamp0((state.homeGoals ?? 0) + 1);
    state.homeShots = clamp0((state.homeShots ?? 0) + 1);
  } else if (k === "awayGoals") {
    state.awayGoals = clamp0((state.awayGoals ?? 0) + 1);
    state.awayShots = clamp0((state.awayShots ?? 0) + 1);
  } else {
    state[k] = clamp0((state[k] ?? 0) + 1);
  }
  saveCurrent();
  render();
};

window.dec = (key) => {
  const k = String(key);
  if (k === "homeGoals") {
    if ((state.homeGoals ?? 0) > 0) {
      state.homeGoals = clamp0((state.homeGoals ?? 0) - 1);
      state.homeShots = clamp0((state.homeShots ?? 0) - 1);
    }
  } else if (k === "awayGoals") {
    if ((state.awayGoals ?? 0) > 0) {
      state.awayGoals = clamp0((state.awayGoals ?? 0) - 1);
      state.awayShots = clamp0((state.awayShots ?? 0) - 1);
    }
  } else {
    state[k] = clamp0((state[k] ?? 0) - 1);
  }
  saveCurrent();
  render();
};

window.resetCurrent = () => {
  state.homeGoals = 0;
  state.awayGoals = 0;
  state.homeShots = 0;
  state.awayShots = 0;
  state.editingGameId = null;
  saveCurrent();
  render();
};

// ---------- Saved games ----------
function snapshotFromState() {
  return {
    id: state.editingGameId || (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())),
    savedAt: new Date().toISOString(),
    gameDate: state.gameDate || todayISO(),
    homeTeam: state.homeTeam || "",
    awayTeam: state.awayTeam || "",
    homeColor: state.homeColor || "#000000",
    awayColor: state.awayColor || "#000000",
    themeMode: state.themeMode || "auto",
    layoutMode: state.layoutMode || "auto",
    homeGoals: clamp0(state.homeGoals),
    awayGoals: clamp0(state.awayGoals),
    homeShots: clamp0(state.homeShots),
    awayShots: clamp0(state.awayShots)
  };
}

window.saveGame = () => {
  const history = loadHistory();
  const game = snapshotFromState();

  const idx = history.findIndex(g => g.id === game.id);
  if (idx >= 0) {
    history[idx] = game;
  } else {
    history.unshift(game);
  }

  saveHistory(history);

  // Start fresh (keep settings)
  state.homeGoals = 0;
  state.awayGoals = 0;
  state.homeShots = 0;
  state.awayShots = 0;
  state.editingGameId = null;
  saveCurrent();
  render();
};

window.deleteGame = (id) => {
  const history = loadHistory().filter(g => g.id !== id);
  saveHistory(history);
  if (state.editingGameId === id) {
    state.editingGameId = null;
    saveCurrent();
  }
  render();
};

window.clearAll = () => {
  localStorage.removeItem(KEY_HISTORY);
  state.editingGameId = null;
  saveCurrent();
  render();
};

function loadGameIntoCurrent(g) {
  state = {
    ...state, // keep collapse/theme prefs
    gameDate: g.gameDate || todayISO(),
    homeTeam: g.homeTeam || "",
    awayTeam: g.awayTeam || "",
    homeColor: g.homeColor || state.homeColor || "#000000",
    awayColor: g.awayColor || state.awayColor || "#000000",
    themeMode: g.themeMode || state.themeMode || "auto",
    layoutMode: g.layoutMode || state.layoutMode || "auto",
    homeGoals: clamp0(g.homeGoals),
    awayGoals: clamp0(g.awayGoals),
    homeShots: clamp0(g.homeShots),
    awayShots: clamp0(g.awayShots),
    editingGameId: g.id || null
  };
  saveCurrent();
  render();
}

function renderHistory() {
  const history = loadHistory();
  const el = $("history");
  if (!el) return;
  el.innerHTML = "";

  if (history.length === 0) {
    el.innerHTML = `<div class="muted" style="margin-top:10px;">No saved games yet.</div>`;
    return;
  }

  for (const g of history) {
    const home = teamNameOrDefault(g.homeTeam, "Home");
    const away = teamNameOrDefault(g.awayTeam, "Away");
    const score = `${clamp0(g.homeGoals)}-${clamp0(g.awayGoals)}`;
    const shots = `${clamp0(g.homeShots)}-${clamp0(g.awayShots)}`;

    const homeGoalie = computeSavePct(g.awayShots, g.awayGoals).pct; // home goalie faces away
    const awayGoalie = computeSavePct(g.homeShots, g.homeGoals).pct; // away goalie faces home

    const item = document.createElement("div");
    item.className = "listitem";
    item.setAttribute("role", "button");
    item.setAttribute("tabindex", "0");
    item.addEventListener("click", () => loadGameIntoCurrent(g));
    item.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") loadGameIntoCurrent(g);
    });

    item.innerHTML = `
      <div class="listtop">
        <div>
          <div class="title">${escapeHtml(g.gameDate || "")} ${escapeHtml(home)} vs ${escapeHtml(away)}</div>
          <div class="meta">Score <b>${score}</b> • Shots <b>${shots}</b> • SV% <b>${homeGoalie}%-${awayGoalie}%</b></div>
        </div>
        <div class="right">
          <button class="smallbtn danger" type="button">Delete</button>
        </div>
      </div>
    `;

    // Delete button should not trigger load
    const delBtn = item.querySelector("button");
    if (delBtn) {
      delBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        window.deleteGame(g.id);
      });
    }

    el.appendChild(item);
  }
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[c]));
}

// ---------- Service worker registration ----------
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}

// Boot
wireInputs();
saveCurrent();
render();
