const EMOJIS = ["🥚", "🐣", "🐥", "🐔", "🦆", "🦢", "🦉", "🦅", "🦚", "🔥", "🐉"];
const SIZE = 4;

const boardEl = document.getElementById("board");
const scoreEl = document.getElementById("score");
const bestEl = document.getElementById("best");
const overlayEl = document.getElementById("overlay");
const overlayText = document.getElementById("overlay-text");
const chainEl = document.getElementById("chain");

let grid, score, best, won, over, maxTierSeen;

best = Number(localStorage.getItem("emoji-merge-best") || 0);
bestEl.textContent = best;

// background cells (rendered once)
for (let i = 0; i < SIZE * SIZE; i++) {
  const c = document.createElement("div");
  c.className = "cell";
  boardEl.appendChild(c);
}

function newGame() {
  grid = Array.from({ length: SIZE }, () => Array(SIZE).fill(-1));
  score = 0;
  won = false;
  over = false;
  maxTierSeen = 0;
  spawn();
  spawn();
  overlayEl.classList.add("hidden");
  render();
}

function spawn() {
  const empty = [];
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++)
      if (grid[r][c] === -1) empty.push([r, c]);
  if (!empty.length) return;
  const [r, c] = empty[Math.floor(Math.random() * empty.length)];
  const chickChance = typeof Pond !== "undefined" ? Pond.tier1Chance() : 0.1;
  grid[r][c] = Math.random() < chickChance ? 1 : 0;
}

// Slide one row/column line toward index 0. Returns {line, gained, moved, created}.
function slideLine(line) {
  const vals = line.filter(v => v !== -1);
  const out = [];
  let gained = 0;
  const created = [];
  for (let i = 0; i < vals.length; i++) {
    if (i + 1 < vals.length && vals[i] === vals[i + 1] && vals[i] < EMOJIS.length - 1) {
      out.push(vals[i] + 1);
      gained += Math.pow(2, vals[i] + 1);
      created.push(vals[i] + 1);
      i++;
    } else {
      out.push(vals[i]);
    }
  }
  while (out.length < SIZE) out.push(-1);
  const moved = out.some((v, i) => v !== line[i]);
  return { line: out, gained, moved, created };
}

function move(dir) {
  if (over) return;
  // dir: 0=left 1=right 2=up 3=down
  let moved = false;
  let gained = 0;
  const created = [];

  for (let i = 0; i < SIZE; i++) {
    let line = [];
    for (let j = 0; j < SIZE; j++) {
      if (dir === 0) line.push(grid[i][j]);
      else if (dir === 1) line.push(grid[i][SIZE - 1 - j]);
      else if (dir === 2) line.push(grid[j][i]);
      else line.push(grid[SIZE - 1 - j][i]);
    }
    const res = slideLine(line);
    gained += res.gained;
    created.push(...res.created);
    if (res.moved) moved = true;
    for (let j = 0; j < SIZE; j++) {
      if (dir === 0) grid[i][j] = res.line[j];
      else if (dir === 1) grid[i][SIZE - 1 - j] = res.line[j];
      else if (dir === 2) grid[j][i] = res.line[j];
      else grid[SIZE - 1 - j][i] = res.line[j];
    }
  }

  if (!moved) return;

  score += gained;
  if (score > best) {
    best = score;
    localStorage.setItem("emoji-merge-best", best);
  }
  if (typeof Pond !== "undefined") created.forEach(t => Pond.addCreature(t));
  spawn();
  render();
  checkEnd();
}

function checkEnd() {
  const top = Math.max(...grid.flat());
  if (top === EMOJIS.length - 1 && !won) {
    won = true;
    showOverlay("🐉 You hatched the Dragon! 🎉");
    return;
  }
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const v = grid[r][c];
      if (v === -1) return;
      if (c + 1 < SIZE && grid[r][c + 1] === v) return;
      if (r + 1 < SIZE && grid[r + 1][c] === v) return;
    }
  }
  over = true;
  showOverlay("Game Over 💔");
}

function showOverlay(msg) {
  overlayText.textContent = msg + "\nScore: " + score;
  overlayEl.classList.remove("hidden");
}

function render() {
  boardEl.querySelectorAll(".tile").forEach(t => t.remove());
  const pad = 8, gap = 8;
  const inner = boardEl.clientWidth - pad * 2;
  const cell = (inner - gap * (SIZE - 1)) / SIZE;

  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const v = grid[r][c];
      if (v === -1) continue;
      if (v > maxTierSeen) maxTierSeen = v;
      const t = document.createElement("div");
      t.className = "tile pop";
      t.textContent = EMOJIS[v];
      t.style.width = cell + "px";
      t.style.height = cell + "px";
      t.style.left = pad + c * (cell + gap) + "px";
      t.style.top = pad + r * (cell + gap) + "px";
      t.style.fontSize = cell * 0.55 + "px";
      // deeper tiers get warmer backgrounds
      const hue = 265 - v * 22;
      t.style.background = `hsl(${hue}, 45%, ${30 + v * 3}%)`;
      boardEl.appendChild(t);
    }
  }

  scoreEl.textContent = score;
  bestEl.textContent = best;
  renderChain();
}

function renderChain() {
  chainEl.innerHTML = "";
  EMOJIS.forEach((e, i) => {
    const s = document.createElement("span");
    s.textContent = e + (i < EMOJIS.length - 1 ? " → " : "");
    s.className = i <= maxTierSeen ? "done" : "locked";
    chainEl.appendChild(s);
  });
}

// --- input ---
document.addEventListener("keydown", e => {
  if (typeof Pond !== "undefined" && Pond.isOpen()) return;
  const map = { ArrowLeft: 0, ArrowRight: 1, ArrowUp: 2, ArrowDown: 3, a: 0, d: 1, w: 2, s: 3 };
  if (map[e.key] !== undefined) {
    e.preventDefault();
    move(map[e.key]);
  }
});

let touchX = null, touchY = null;
document.addEventListener("touchstart", e => {
  touchX = e.touches[0].clientX;
  touchY = e.touches[0].clientY;
}, { passive: true });

document.addEventListener("touchend", e => {
  if (touchX === null) return;
  if (typeof Pond !== "undefined" && Pond.isOpen()) { touchX = touchY = null; return; }
  const dx = e.changedTouches[0].clientX - touchX;
  const dy = e.changedTouches[0].clientY - touchY;
  touchX = touchY = null;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
  if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? 1 : 0);
  else move(dy > 0 ? 3 : 2);
}, { passive: true });

document.getElementById("new-game").addEventListener("click", newGame);
document.getElementById("overlay-btn").addEventListener("click", newGame);
window.addEventListener("resize", render);

// PWA service worker
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}

newGame();
