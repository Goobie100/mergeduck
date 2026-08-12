// Pond idle layer. Loaded after game.js and shares its globals (EMOJIS, render).
const Pond = (() => {
  const KEY = "emoji-merge-pond";

  // desc() receives the level the player would have AFTER buying
  const UPGRADES = {
    feed:  { name: "Feeding Area", emoji: "🌽", base: 50,  max: 20, desc: l => `+${l * 25}% feather rate` },
    pond:  { name: "Bigger Pond",  emoji: "💧", base: 75,  max: 19, desc: l => `Room for ${5 + l * 5} of each creature` },
    house: { name: "Duck House",   emoji: "🛖", base: 100, max: 11, desc: l => `Earn offline up to ${2 + l * 2}h` },
    nest:  { name: "Lucky Nest",   emoji: "🪺", base: 200, max: 4,  desc: l => `${10 + l * 5}% of new tiles are 🐣` },
  };

  function defaults() {
    return {
      feathers: 0,
      creatures: Array(EMOJIS.length).fill(0),
      upgrades: { feed: 0, pond: 0, house: 0, nest: 0 },
      lastSeen: Date.now(),
    };
  }

  let state = defaults();
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || "null");
    if (saved) {
      state = Object.assign(defaults(), saved);
      state.upgrades = Object.assign(defaults().upgrades, saved.upgrades);
      while (state.creatures.length < EMOJIS.length) state.creatures.push(0);
    }
  } catch (e) {
    state = defaults(); // corrupted save -> fresh pond
  }

  const save = () => localStorage.setItem(KEY, JSON.stringify(state));
  const cost = k => UPGRADES[k].base * Math.pow(3, state.upgrades[k]);
  const creatureCap = () => 5 + state.upgrades.pond * 5;
  const offlineCapMs = () => (2 + state.upgrades.house * 2) * 3600000;

  function ratePerMin() {
    let r = 0;
    for (let t = 1; t < state.creatures.length; t++) {
      r += state.creatures[t] * Math.pow(2, t - 1);
    }
    return r * (1 + state.upgrades.feed * 0.25);
  }

  // --- dom ---
  const feathersEl = document.getElementById("feathers");
  const rateEl = document.getElementById("rate");
  const sceneEl = document.getElementById("pond-scene");
  const msgEl = document.getElementById("pond-msg");
  const upgradesEl = document.getElementById("upgrades");
  const tabGame = document.getElementById("tab-game");
  const tabPond = document.getElementById("tab-pond");
  const screenGame = document.getElementById("screen-game");
  const screenPond = document.getElementById("screen-pond");

  let open = false;
  let msgTimer = null;

  function showMsg(text, sticky) {
    msgEl.textContent = text;
    clearTimeout(msgTimer);
    if (!sticky) msgTimer = setTimeout(() => { msgEl.textContent = ""; }, 6000);
  }

  function show(which) {
    open = which === "pond";
    tabGame.classList.toggle("active", !open);
    tabPond.classList.toggle("active", open);
    screenGame.classList.toggle("hidden", open);
    screenPond.classList.toggle("hidden", !open);
    if (open) {
      renderScene();
      updateStats();
      updateUpgrades();
    } else {
      render(); // board was display:none; re-size tiles
    }
  }
  tabGame.addEventListener("click", () => show("game"));
  tabPond.addEventListener("click", () => show("pond"));

  function updateStats() {
    feathersEl.textContent = Math.floor(state.feathers).toLocaleString();
    rateEl.textContent = (Math.round(ratePerMin() * 10) / 10).toLocaleString();
  }

  function renderScene() {
    sceneEl.innerHTML = "";
    const decor = [["🌾", 2, 74], ["🌾", 90, 70], ["🪷", 12, 86], ["🪷", 68, 88], ["🪨", 84, 88]];
    for (const [e, x, y] of decor) {
      const d = document.createElement("span");
      d.className = "decor";
      d.textContent = e;
      d.style.left = x + "%";
      d.style.top = y + "%";
      sceneEl.appendChild(d);
    }
    let any = false;
    for (let t = 1; t < state.creatures.length; t++) {
      const n = state.creatures[t];
      if (!n) continue;
      any = true;
      const el = document.createElement("div");
      el.className = "creature";
      el.style.left = (8 + (t * 29) % 68) + "%";
      el.style.top = (10 + (t * 43) % 58) + "%";
      el.style.animationDelay = (t * 0.7) + "s";
      el.innerHTML = `<span class="c-emoji">${EMOJIS[t]}</span><span class="c-count">×${n}</span>`;
      sceneEl.appendChild(el);
    }
    if (!any) {
      const p = document.createElement("div");
      p.className = "pond-empty";
      p.textContent = "Your pond is empty. Merge creatures on the board and they'll move in!";
      sceneEl.appendChild(p);
    }
  }

  // --- upgrades panel (rows built once, values updated in place) ---
  const rows = {};
  for (const k in UPGRADES) {
    const u = UPGRADES[k];
    const row = document.createElement("div");
    row.className = "upg";
    row.innerHTML =
      `<span class="u-emoji">${u.emoji}</span>` +
      `<div class="u-info"><div class="u-name">${u.name} <span class="u-lvl"></span></div>` +
      `<div class="u-desc"></div></div>`;
    const btn = document.createElement("button");
    btn.addEventListener("click", () => buy(k));
    row.appendChild(btn);
    upgradesEl.appendChild(row);
    rows[k] = { btn, lvl: row.querySelector(".u-lvl"), desc: row.querySelector(".u-desc") };
  }

  function updateUpgrades() {
    for (const k in UPGRADES) {
      const u = UPGRADES[k];
      const r = rows[k];
      const lvl = state.upgrades[k];
      r.lvl.textContent = lvl > 0 ? "Lv " + lvl : "";
      if (lvl >= u.max) {
        r.desc.textContent = u.desc(lvl);
        r.btn.textContent = "MAX";
        r.btn.disabled = true;
      } else {
        r.desc.textContent = "Next: " + u.desc(lvl + 1);
        r.btn.textContent = cost(k).toLocaleString() + " 🪶";
        r.btn.disabled = state.feathers < cost(k);
      }
    }
  }

  function buy(k) {
    const c = cost(k);
    if (state.upgrades[k] >= UPGRADES[k].max || state.feathers < c) return;
    state.feathers -= c;
    state.upgrades[k]++;
    save();
    updateStats();
    updateUpgrades();
    renderScene();
  }

  // --- production (same path handles live ticks and offline catch-up) ---
  function accrue() {
    const now = Date.now();
    const elapsed = now - state.lastSeen;
    state.lastSeen = now;
    if (elapsed <= 0) return;
    const earned = ratePerMin() * (Math.min(elapsed, offlineCapMs()) / 60000);
    state.feathers += earned;
    if (elapsed > 60000 && earned >= 1) {
      showMsg("Welcome back! +" + Math.floor(earned) + " 🪶 while you were away", true);
    }
    save();
    if (open) {
      updateStats();
      updateUpgrades();
    }
  }

  setInterval(accrue, 1000);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) save();
    else accrue();
  });

  // --- public api (called from game.js) ---
  function addCreature(t) {
    if (t < 1 || t >= EMOJIS.length) return;
    if (state.creatures[t] >= creatureCap()) return;
    const isNew = state.creatures[t] === 0;
    state.creatures[t]++;
    save();
    if (isNew) showMsg(EMOJIS[t] + " moved into your pond!", true);
    if (open) {
      renderScene();
      updateStats();
    }
  }

  const tier1Chance = () => 0.1 + state.upgrades.nest * 0.05;

  // init
  accrue();
  updateStats();
  updateUpgrades();
  renderScene();

  return { addCreature, tier1Chance, isOpen: () => open };
})();
