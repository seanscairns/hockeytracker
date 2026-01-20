const KEY_CURRENT = "ht_current_v1";
const KEY_HISTORY = "ht_history_v1";

// Prevent iOS Safari double-tap to zoom while scorekeeping
let __lastTouchEnd = 0;
document.addEventListener(
  "touchend",
  (event) => {
    const now = Date.now();
    if (now - __lastTouchEnd <= 300) {
      event.preventDefault();
    }
    __lastTouchEnd = now;
  },
  { passive: false }
);

function todayISO() {
  const d = new Date();
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60 * 1000);
  return local.toISOString().slice(0, 10);
}

function loadCurrent() {
  const saved = localStorage.getItem(KEY_CURRENT);
  if (saved) return JSON.parse(saved);
  return {
    gameDate: todayISO(),
    opponent: "",
    venue: "",
    homeGoals: 0,
    awayGoals: 0,
    homeShots: 0,
    awayShots: 0
  };
}

function saveCurrent(state) {
  localStorage.setItem(KEY_CURRENT, JSON.stringify(state));
  document.getElementById("autosaveNote").textContent = "Auto-saved on this device.";
}

function loadHistory() {
  const saved = localStorage.getItem(KEY_HISTORY);
  if (!saved) return [];
  try { return JSON.parse(saved); } catch { return []; }
}

function saveHistory(items) {
  localStorage.setItem(KEY_HISTORY, JSON.stringify(items));
}

let state = loadCurrent();

function render() {
  // Inputs
  document.getElementById("gameDate").value = state.gameDate || todayISO();
  document.getElementById("opponent").value = state.opponent || "";
  document.getElementById("venue").value = state.venue || "";

  // Stats
  for (const k of ["homeGoals","awayGoals","homeShots","awayShots"]) {
    document.getElementById(k).textContent = String(state[k] ?? 0);
  }

  renderHistory();
}

function wireInputs() {
  document.getElementById("gameDate").addEventListener("input", (e) => {
    state.gameDate = e.target.value;
    saveCurrent(state);
  });
  document.getElementById("opponent").addEventListener("input", (e) => {
    state.opponent = e.target.value;
    saveCurrent(state);
  });
  document.getElementById("venue").addEventListener("input", (e) => {
    state.venue = e.target.value;
    saveCurrent(state);
  });
}

window.inc = (key) => {
  state[key] = (state[key] ?? 0) + 1;
  saveCurrent(state);
  render();
};

window.dec = (key) => {
  state[key] = Math.max(0, (state[key] ?? 0) - 1);
  saveCurrent(state);
  render();
};

window.resetCurrent = () => {
  state.homeGoals = 0;
  state.awayGoals = 0;
  state.homeShots = 0;
  state.awayShots = 0;
  saveCurrent(state);
  render();
};

window.saveGame = () => {
  const history = loadHistory();
  const game = {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    savedAt: new Date().toISOString(),
    gameDate: state.gameDate || todayISO(),
    opponent: state.opponent || "",
    venue: state.venue || "",
    homeGoals: state.homeGoals ?? 0,
    awayGoals: state.awayGoals ?? 0,
    homeShots: state.homeShots ?? 0,
    awayShots: state.awayShots ?? 0
  };
  history.unshift(game);
  saveHistory(history);

  // Start a fresh game (keep date/opponent if you want — change if you prefer)
  state.homeGoals = 0;
  state.awayGoals = 0;
  state.homeShots = 0;
  state.awayShots = 0;
  saveCurrent(state);

  render();
};

window.deleteGame = (id) => {
  const history = loadHistory().filter(g => g.id !== id);
  saveHistory(history);
  renderHistory();
};

window.clearAll = () => {
  localStorage.removeItem(KEY_HISTORY);
  renderHistory();
};

function renderHistory() {
  const history = loadHistory();
  const el = document.getElementById("history");
  el.innerHTML = "";

  if (history.length === 0) {
    el.innerHTML = `<div class="muted" style="margin-top:10px;">No saved games yet.</div>`;
    return;
  }

  for (const g of history) {
    const opp = g.opponent ? `vs ${escapeHtml(g.opponent)}` : "Game";
    const venue = g.venue ? `<span class="pill">${escapeHtml(g.venue)}</span>` : "";
    const score = `${g.homeGoals}-${g.awayGoals}`;
    const shots = `${g.homeShots}-${g.awayShots}`;

    const item = document.createElement("div");
    item.className = "listitem";
    item.innerHTML = `
      <div class="listtop">
        <div>
          <div class="title">${escapeHtml(g.gameDate)} ${opp} ${venue}</div>
          <div class="meta">Score <b>${score}</b> • Shots <b>${shots}</b></div>
        </div>
        <div class="right">
          <button class="smallbtn danger" onclick="deleteGame('${g.id}')">Delete</button>
        </div>
      </div>
    `;
    el.appendChild(item);
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[c]));
}

// Service worker registration (makes it installable/offline-ish)
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}

wireInputs();
saveCurrent(state); // ensure it exists
render();
