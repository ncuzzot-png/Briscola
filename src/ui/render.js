import {
  resolveCardFace,
  resolveCardBack,
  resolveBackground,
  resolveCustomKey,
  getPreloadUrls,
  preloadImages,
} from "./assets.js";
import { animateAfterRender } from "./animations.js";
import { trickWinner } from "../engine/rules.js";
import { isMuted } from "./sfx.js";

const suitSymbols = {
  cups: "\u2665",
  swords: "\u2660",
  coins: "\u25C6",
  clubs: "\u2663",
};

export function render(root, state) {
  root.innerHTML = "";
  root.dataset.awaitingTrick = state.awaitingTrickResolve ? "true" : "false";
  root.dataset.opponentDisconnected = state.online?.opponentDisconnected ? "true" : "false";
  root.dataset.phase = state.phase;
  root.dataset.mode = state.mode;
  root.dataset.onlineActive = state.online?.status && state.online.status !== "idle" ? "true" : "false";

  if (state.phase === "menu") {
    const menu = renderMenu(state);
    root.appendChild(menu);
    root.appendChild(renderSoundToggle());
    root.appendChild(renderHomeButton());
    applyBackground("menu");
    animateAfterRender(root, state);
    return;
  }

  if (state.phase === "gameover") {
    root.appendChild(renderEnd(state));
    root.appendChild(renderSoundToggle());
    root.appendChild(renderHomeButton());
    applyBackground("win");
    animateAfterRender(root, state);
    return;
  }

  root.appendChild(renderGame(state));
  root.appendChild(renderSoundToggle());
  root.appendChild(renderHomeButton());
  if (state.ui?.showHomeConfirm && state.phase !== "menu") {
    root.appendChild(renderHomeConfirm());
  }
  applyBackground("table");
  if (state.mode !== "vsBot" && state.overlay?.active) {
    root.appendChild(renderOverlay(state.overlay));
  }
  animateAfterRender(root, state);
}

function renderSoundToggle() {
  const btn = document.createElement("button");
  const muted = isMuted();
  btn.className = muted ? "sound-toggle muted" : "sound-toggle";
  btn.dataset.action = "toggle-sound";
  btn.setAttribute("aria-label", muted ? "Sound off" : "Sound on");
  btn.innerHTML = `
    <img class="sound-toggle-img" src="assets/backgrounds/capybaras.png" alt="" />
    <div class="sound-toggle-zzz">
      <span>z</span><span>z</span><span>z</span>
    </div>
    <div class="sound-toggle-notes">
      <span>♪</span><span>♫</span><span>♪</span>
    </div>
  `;
  return btn;
}

function renderHomeButton() {
  const btn = document.createElement("button");
  btn.className = "home-button";
  btn.dataset.action = "go-home";
  btn.setAttribute("aria-label", "Home");
  btn.innerHTML = `<img class="home-img" src="assets/backgrounds/Home.png" alt="" />`;
  return btn;
}

function renderHomeConfirm() {
  const wrap = document.createElement("div");
  wrap.className = "home-confirm";
  wrap.innerHTML = `
    <div class="home-confirm-card">
      <div>Are you sure you want to home?</div>
      <div class="home-confirm-actions">
        <button class="button" data-action="home-confirm-yes">Yes</button>
        <button class="button" data-action="home-confirm-no">No</button>
      </div>
    </div>
  `;
  return wrap;
}

function renderMenu(state) {
  const online = state?.online || {};
  const onlineActive = online.status && online.status !== "idle" && online.status !== "error" && online.status !== "closed";
  const screen = document.createElement("div");
  screen.className = "screen menu";
  if (onlineActive) {
    screen.innerHTML = `
      <h1>Briscola</h1>
      <div>🇻🇳🇹🇭🇱🇦🇮🇩</div>
      <div>Buon Compleanno Nogi</div>
      <div>מקווה שתאהבו את המתנה הזו</div>
      <div class="online-code">Room Code: <span data-action="copy-code">${online.roomCode || "-"}</span></div>
      <div class="online-code-toast" data-code-toast>Room code copied</div>
      <div class="small">${online.isHost ? "Waiting for opponent…" : "Waiting for host…"}</div>
      ${online.roomCode ? `
        <button class="button" data-action="copy-code">Copy Code</button>
        <button class="button" data-action="back-menu" data-online="true">Back</button>
      ` : ""}
      <div class="small preload-status" data-preload-status>Loading art…</div>
    `;
    startPreload(screen);
    return screen;
  }

  screen.innerHTML = `
      <h1>Briscola</h1>
      <div>🇻🇳🇹🇭🇱🇦🇮🇩</div>
      <div>Buon Compleanno Nogi</div>
      <div>מקווה שתאהבו את המתנה הזו</div>
      ${online.status === "error" || online.status === "closed" ? `<div class="small">${online.error || "Online session ended."}</div>` : ""}
      <div class="small preload-status" data-preload-status>Loading art…</div>
      <button class="button" data-action="show-bot-modal">Play vs Bot</button>
      <button class="button" data-action="start">Local 2 Players</button>
      <div class="online-panel">
        <button class="button" data-action="online-host">Create Room</button>
        <div class="online-join">
          <input class="input" data-room-code maxlength="6" placeholder="Room code" />
          <button class="button" data-action="online-join">Join Room</button>
        </div>
      </div>
    `;
  startPreload(screen);
  return screen;
}

function renderGame(state) {
  const screen = document.createElement("div");
  screen.className = "screen game";

  const table = document.createElement("div");
  table.className = "table";

  const online = state.online || {};
  const isOnline = state.mode === "online" && Number.isFinite(online.myPlayerIndex);
  const isHotseat = state.mode === "hotseat";
  const myIndex = isOnline ? online.myPlayerIndex : 0;
  const oppIndex = myIndex === 0 ? 1 : 0;
  const viewPlayer = isHotseat ? state.hotseatViewPlayer : null;
  const hotseatBottom = isHotseat && Number.isFinite(viewPlayer) ? viewPlayer : 0;
  const hotseatTop = hotseatBottom === 0 ? 1 : 0;
  const topPlayer = isOnline ? oppIndex : (isHotseat ? hotseatTop : 1);
  const bottomPlayer = isOnline ? myIndex : (isHotseat ? hotseatBottom : 0);

  const p2Hand = renderHand(state, topPlayer, false);
  const trick = renderTrick(state);
  const centerRow = document.createElement("div");
  centerRow.className = "center-row";
  centerRow.appendChild(trick);
  const trumpCard = renderTrumpCard(state);
  if (trumpCard) {
    centerRow.appendChild(trumpCard);
  }
  const p1Hand = renderHand(state, bottomPlayer, true);

  table.appendChild(p2Hand);
  table.appendChild(centerRow);
  table.appendChild(p1Hand);

  screen.appendChild(table);
  if (state.mode === "online" && state.online?.opponentDisconnected) {
    screen.appendChild(renderOnlineWait());
  }
  // Sidebar intentionally hidden for immersion; can be reintroduced later.
  return screen;
}

function renderEnd(state) {
  const screen = document.createElement("div");
  screen.className = "screen end";

  const p1 = state.scores[0];
  const p2 = state.scores[1];
  const isHotseat = state.mode === "hotseat";
  const isOnline = state.mode === "online";
  const myIndex = Number.isFinite(state.online?.myPlayerIndex) ? state.online.myPlayerIndex : 0;
  const myScore = myIndex === 0 ? p1 : p2;
  const oppScore = myIndex === 0 ? p2 : p1;

  let title = "Draw";
  if (isHotseat) {
    if (p1 > p2) title = "Player 1 wins!";
    if (p2 > p1) title = "Player 2 wins!";
  } else {
    if (myScore > oppScore) title = "You win!";
    if (myScore < oppScore) title = "You lose";
  }

  const scoreLine = isHotseat
    ? `Final score: Player 1 ${p1} — Player 2 ${p2}`
    : `Final score: You ${myScore} — Opponent ${oppScore}`;

  screen.innerHTML = `
    <h1>${title}</h1>
    <div class="end-score">${scoreLine}</div>
    ${isOnline ? `<div class="small end-note">Start a new room for a rematch.</div>` : ""}
    <div class="end-actions">
      ${isOnline ? "" : `<button class="button" data-action="play-again" data-mode="${state.mode}" data-bot="${state.botDifficulty || "medium"}">Play again</button>`}
      <button class="button" data-action="back-menu" data-online="${isOnline ? "true" : "false"}">Back to menu</button>
    </div>
  `;

  return screen;
}

function renderHand(state, player, faceUp) {
  const hand = document.createElement("div");
  hand.className = "hand";
  hand.dataset.player = String(player);
  const online = state.online || {};
  const isOnline = state.mode === "online" && Number.isFinite(online.myPlayerIndex);
  const isHotseat = state.mode === "hotseat";
  const isMyHand = !isOnline || player === online.myPlayerIndex;
  const opponentDisconnected = isOnline && online.opponentDisconnected;
  const viewPlayer = isHotseat ? state.hotseatViewPlayer : null;
  const isHotseatVisible = !isHotseat || (Number.isFinite(viewPlayer) && viewPlayer === player);

  state.hands[player].forEach((card, index) => {
    const useFaceUp = isOnline ? isMyHand : (isHotseat ? isHotseatVisible : faceUp);
    const cardEl = useFaceUp ? renderCardFace(card) : renderCardBack();
    if (useFaceUp) {
      cardEl.dataset.cardId = cardKey(card);
    } else {
      cardEl.dataset.slotId = `p${player}_${index}`;
    }
    const isBotHand = state.mode === "vsBot" && player === 1;
    const canAct = isOnline ? (isMyHand && !opponentDisconnected) : (!isBotHand && (!isHotseat || isHotseatVisible));
    if (canAct) {
      cardEl.dataset.action = "play";
      cardEl.dataset.player = String(player);
      cardEl.dataset.index = String(index);
    }

    if (
      state.turn !== player ||
      state.overlay?.active ||
      isBotHand ||
      (isOnline && !isMyHand) ||
      (isHotseat && !isHotseatVisible) ||
      (isOnline && opponentDisconnected)
    ) {
      cardEl.classList.add("disabled");
    }

    hand.appendChild(cardEl);
  });

  return hand;
}

function renderOnlineWait() {
  const wrap = document.createElement("div");
  wrap.className = "online-wait";
  wrap.innerHTML = `
    <div class="online-wait-card">
      <div>Opponent disconnected — waiting…</div>
      <button class="button" data-action="back-menu" data-online="true">Back to menu</button>
    </div>
  `;
  return wrap;
}

function renderTrick(state) {
  const trick = document.createElement("div");
  trick.className = "trick";

  let winnerIndex = null;
  if (state.awaitingTrickResolve && state.trick[0] && state.trick[1]) {
    winnerIndex = trickWinner({
      leader: state.leader,
      cards: state.trick,
      trumpSuit: state.trumpSuit,
    });
  }

  for (let i = 0; i < 2; i += 1) {
    const slot = document.createElement("div");
    slot.className = "trick-slot";
    slot.dataset.trickSlot = `trick_${i}`;
    if (state.trick[i]) {
      const card = renderCardFace(state.trick[i]);
      card.dataset.cardId = cardKey(state.trick[i]);
      card.dataset.trickSlot = `trick_${i}`;
      if (winnerIndex !== null) {
        card.classList.add(winnerIndex === i ? "trick-winner" : "trick-loser");
      }
      card.classList.add("disabled");
      slot.appendChild(card);
    }
    trick.appendChild(slot);
  }

  return trick;
}

function renderTrumpCard(state) {
  if (!state.briscolaCard) return null;
  const wrap = document.createElement("div");
  wrap.className = "trump-card";
  const cardEl = renderCardFace(state.briscolaCard);
  cardEl.classList.add("trump-card-inner");
  wrap.appendChild(cardEl);
  return wrap;
}

function renderSidebar(state) {
  const sidebar = document.createElement("div");
  sidebar.className = "sidebar";

  const remaining = state.deck.length + (state.briscolaCard ? 1 : 0);
  const turnText = `Player ${state.turn + 1} to play`;
  const briscolaCard = state.briscolaCard ? renderCardFace(state.briscolaCard) : null;
  if (briscolaCard) briscolaCard.classList.add("disabled");
  const botLabel = state.mode === "vsBot" ? `Bot: ${capitalize(state.botDifficulty || "medium")}` : "";

  sidebar.innerHTML = `
    <div class="turn">${turnText}</div>
    ${botLabel ? `<div class="badge">${botLabel}</div>` : ""}
    <div class="score"><span>Player 1</span><span>${state.scores[0]}</span></div>
    <div class="score"><span>Player 2</span><span>${state.scores[1]}</span></div>
    <div class="score"><span>Cards remaining</span><span>${remaining}</span></div>
    <div class="score"><span>Briscola</span><span class="badge">${state.trumpSuit || "-"}</span></div>
    <div class="log">${state.log.slice(-3).join("<br/>")}</div>
  `;

  if (briscolaCard) {
    const wrap = document.createElement("div");
    wrap.appendChild(briscolaCard);
    sidebar.appendChild(wrap);
  }

  return sidebar;
}

function renderOverlay(overlay) {
  const wrap = document.createElement("div");
  wrap.className = "overlay";
  wrap.innerHTML = `
    <div class="overlay-card">
      <p>${overlay.message}</p>
      <button class="button" data-action="ready" data-player="${overlay.player}">Ready</button>
    </div>
  `;
  return wrap;
}

function renderCardFace(card) {
  const cardEl = document.createElement("div");
  cardEl.className = "card face";
  const imageUrl = resolveCardFace(card);

  const cornerTop = document.createElement("div");
  cornerTop.className = "corner corner-tl";
  cornerTop.innerHTML = `
    <span class="rank">${card.rank}</span>
    <span class="suit" data-suit="${card.suit}">${suitSymbols[card.suit] || "?"}</span>
  `;

  const cornerBottom = document.createElement("div");
  cornerBottom.className = "corner corner-br";
  cornerBottom.innerHTML = `
    <span class="rank">${card.rank}</span>
    <span class="suit" data-suit="${card.suit}">${suitSymbols[card.suit] || "?"}</span>
  `;

  const center = document.createElement("div");
  center.className = imageUrl ? "card-art" : "card-pips";

  if (imageUrl) {
    const img = document.createElement("img");
    img.className = "art-img";
    const sources = Array.isArray(imageUrl) ? imageUrl : [imageUrl];
    let sourceIndex = 0;
    img.src = sources[sourceIndex];
    img.alt = `${card.rank} of ${card.suit}`;
    img.onerror = () => {
      img.remove();
      center.className = "card-pips";
      center.appendChild(defaultPips(card));
    };
    center.appendChild(img);
  } else {
    center.appendChild(defaultPips(card));
  }

  cardEl.appendChild(cornerTop);
  cardEl.appendChild(cornerBottom);
  cardEl.appendChild(center);

  if (window.DEBUG_ASSETS) {
    const label = document.createElement("div");
    const key = resolveCustomKey(card);
    label.className = "asset-debug";
    label.textContent = key ? `${key} ✓` : "no-map ×";
    cardEl.appendChild(label);
  }
  return cardEl;
}

let preloadPromise = null;

function startPreload(screen) {
  if (!preloadPromise) {
    preloadPromise = preloadImages(getPreloadUrls());
  }

  const status = screen.querySelector("[data-preload-status]");
  if (!status) return;
  preloadPromise.finally(() => {
    status.remove();
  });
}


function defaultPips(card) {
  const wrap = document.createElement("div");
  wrap.className = "pips";
  wrap.innerHTML = `
    <div class="pip-suit" data-suit="${card.suit}">${suitSymbols[card.suit] || "?"}</div>
  `;
  return wrap;
}

function renderCardBack() {
  const cardEl = document.createElement("div");
  cardEl.className = "card back";
  const backUrl = resolveCardBack();
  const img = document.createElement("img");
  img.src = backUrl;
  img.alt = "Card back";
  img.onerror = () => img.remove();
  cardEl.appendChild(img);
  return cardEl;
}

function applyBackground(screen) {
  const url = resolveBackground(screen);
  const body = document.body;
  body.classList.remove("background-menu", "background-table", "background-win");
  if (screen === "menu") body.classList.add("background-menu");
  if (screen === "table") body.classList.add("background-table");
  if (screen === "win") body.classList.add("background-win");
  if (!url) {
    body.style.backgroundImage = "";
    return;
  }

  const img = new Image();
  img.onload = () => {
    body.style.backgroundImage = `url('${url}')`;
    body.style.backgroundSize = "cover";
    body.style.backgroundPosition = "center";
  };
  img.onerror = () => {
    body.style.backgroundImage = "";
  };
  img.src = url;
}

function cardKey(card) {
  return `${card.suit}_${card.rank}`;
}

function capitalize(value) {
  if (!value) return "";
  return value.charAt(0).toUpperCase() + value.slice(1);
}
