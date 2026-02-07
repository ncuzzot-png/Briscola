import { trickWinner } from "../engine/rules.js";

let prevState = null;
let prevCardRects = new Map();
let prevSlotRects = new Map();
let fullTrickSnapshot = null;
let playGhostTimeoutId = null;
let resolveGhostTimeoutId = null;
const hiddenTrickCards = new Set();

function cardKey(card) {
  return `${card.suit}_${card.rank}`;
}

function getLayer() {
  let layer = document.getElementById("anim-layer");
  if (!layer) {
    layer = document.createElement("div");
    layer.id = "anim-layer";
    layer.style.position = "fixed";
    layer.style.inset = "0";
    layer.style.pointerEvents = "none";
    layer.style.zIndex = "9999";
    document.body.appendChild(layer);
  }
  return layer;
}

function clearLayer() {
  const layer = document.getElementById("anim-layer");
  if (layer) layer.innerHTML = "";
}

function hardClearAllGhosts() {
  if (playGhostTimeoutId) {
    clearTimeout(playGhostTimeoutId);
    playGhostTimeoutId = null;
  }
  if (resolveGhostTimeoutId) {
    clearTimeout(resolveGhostTimeoutId);
    resolveGhostTimeoutId = null;
  }
  hiddenTrickCards.forEach((el) => {
    if (el) el.style.visibility = "";
  });
  hiddenTrickCards.clear();

  const layer = document.getElementById("anim-layer");
  if (layer) {
    layer.remove();
  }
  document.querySelectorAll(".anim-ghost").forEach((el) => el.remove());
}

function collectRects(root) {
  const cardRects = new Map();
  const slotRects = new Map();
  if (!root) return { cardRects, slotRects };
  root.querySelectorAll("[data-card-id]").forEach((el) => {
    const id = el.dataset.cardId;
    if (!id) return;
    cardRects.set(id, el.getBoundingClientRect());
  });
  root.querySelectorAll("[data-slot-id]").forEach((el) => {
    const id = el.dataset.slotId;
    if (!id) return;
    slotRects.set(id, el.getBoundingClientRect());
  });
  return { cardRects, slotRects };
}

function snapshotTrick(root, state, rects) {
  if (!state?.trick?.[0] || !state?.trick?.[1]) return null;
  const cards = [state.trick[0], state.trick[1]];
  const items = cards.map((card) => {
    const id = cardKey(card);
    const el = root.querySelector(`[data-card-id='${id}']`);
    const rect = rects.cardRects.get(id);
    if (!el || !rect) return null;
    return { id, card, rect, clone: el.cloneNode(true) };
  }).filter(Boolean);
  return items.length === 2 ? items : null;
}

// Called before render: capture card positions and trick card clones.
export function captureBeforeRender(root, state) {
  prevState = state;
  const rects = collectRects(root);
  prevCardRects = rects.cardRects;
  prevSlotRects = rects.slotRects;
}

// Called after render: animate card moves and trick resolution.
export function animateAfterRender(root, state) {
  if (!prevState) return;
  hardClearAllGhosts();

  const nextRects = collectRects(root);

  if (state.awaitingTrickResolve) {
    if (!prevState.awaitingTrickResolve) {
      fullTrickSnapshot = snapshotTrick(root, state, nextRects);
    }
    prevState = state;
    prevCardRects = nextRects.cardRects;
    prevSlotRects = nextRects.slotRects;
    return;
  }

  animateCardPlay(root, state, nextRects);
  animateTrickResolution(state);
  animateDraws(state, nextRects);

  prevState = state;
  prevCardRects = nextRects.cardRects;
  prevSlotRects = nextRects.slotRects;
}

function animateCardPlay(root, state, nextRects) {
  if (state.phase !== "playing") return;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (state.awaitingTrickResolve) return;

  state.trick.forEach((card, player) => {
    if (!card) return;
    const id = cardKey(card);
    const prevHand = prevState.hands?.[player] || [];
    const prevIndex = prevHand.findIndex((c) => cardKey(c) === id);
    if (prevIndex === -1) return;

    const prevRect =
      prevCardRects.get(id) || prevSlotRects.get(`p${player}_${prevIndex}`);
    const real = root.querySelector(`.card[data-trick-slot='trick_${player}']`);
    if (!prevRect || !real) return;

    const toRect = real.getBoundingClientRect();
    const dx = toRect.left - prevRect.left;
    const dy = toRect.top - prevRect.top;

    if (dx === 0 && dy === 0) return;
    if (reduceMotion) return;

    hardClearAllGhosts();
    const layer = getLayer();
    real.style.visibility = "hidden";
    hiddenTrickCards.add(real);
    const ghost = real.cloneNode(true);
    ghost.classList.add("anim-ghost", "anim-play");
    ghost.style.position = "fixed";
    ghost.style.left = `${prevRect.left}px`;
    ghost.style.top = `${prevRect.top}px`;
    ghost.style.width = `${prevRect.width}px`;
    ghost.style.height = `${prevRect.height}px`;
    ghost.style.transform = "translate(0, 0) scale(1)";
    ghost.style.transition = "transform 80ms ease-out";
    layer.appendChild(ghost);

    requestAnimationFrame(() => {
      // Phase 1: lift
      ghost.style.transform = "translate(0, -8px) scale(1.06)";

      // Phase 2: travel
      setTimeout(() => {
        ghost.style.transition = "transform 170ms ease-out";
        ghost.style.transform = `translate(${dx}px, ${dy}px) scale(1.03)`;
      }, 80);

      // Phase 3: land
      setTimeout(() => {
        ghost.style.transition = "transform 60ms ease-out";
        ghost.style.transform = `translate(${dx}px, ${dy}px) scale(1)`;
      }, 250);
    });

    playGhostTimeoutId = setTimeout(() => {
      ghost.remove();
      real.style.visibility = "";
      hiddenTrickCards.delete(real);
    }, 310);
  });
}

function animateTrickResolution(state) {
  if (!fullTrickSnapshot) return;
  if (state.trick[0] || state.trick[1]) return;
  if (state.awaitingTrickResolve) return;

  hardClearAllGhosts();
  const layer = getLayer();
  const winner = trickWinner({
    leader: prevState.leader,
    cards: prevState.trick,
    trumpSuit: prevState.trumpSuit,
  });

  const winnerItem = fullTrickSnapshot[winner];
  const loserItem = fullTrickSnapshot[winner === 0 ? 1 : 0];
  if (!winnerItem || !loserItem) return;

  fullTrickSnapshot.forEach((item, index) => {
    const ghost = item.clone;
    ghost.classList.add("anim-ghost");
    ghost.style.position = "fixed";
    ghost.style.left = `${item.rect.left}px`;
    ghost.style.top = `${item.rect.top}px`;
    ghost.style.width = `${item.rect.width}px`;
    ghost.style.height = `${item.rect.height}px`;

    if (index === winner) {
      ghost.classList.add("anim-win");
    } else {
      ghost.classList.add("anim-lose");
    }

    layer.appendChild(ghost);
  });

  resolveGhostTimeoutId = setTimeout(() => {
    clearLayer();
    fullTrickSnapshot = null;
  }, 320);
}

function animateDraws(state, nextRects) {
  if (state.phase !== "playing") return;
  if (!prevState?.hands) return;

  const prevIds = [new Set(), new Set()];
  prevState.hands.forEach((hand, player) => {
    hand.forEach((card) => prevIds[player].add(cardKey(card)));
  });

  state.hands.forEach((hand, player) => {
    const prevLen = prevState.hands[player]?.length || 0;
    const nextLen = hand.length;

    hand.forEach((card) => {
      const id = cardKey(card);
      const inPrev = prevIds[0].has(id) || prevIds[1].has(id);
      if (inPrev) return;
      const el = document.querySelector(`[data-card-id='${id}']`);
      if (!el) return;
      el.classList.add("anim-draw");
      setTimeout(() => el.classList.remove("anim-draw"), 260);
    });

    if (nextLen > prevLen) {
      for (let i = prevLen; i < nextLen; i += 1) {
        const slot = document.querySelector(`[data-slot-id='p${player}_${i}']`);
        if (!slot) continue;
        slot.classList.add("anim-draw");
        setTimeout(() => slot.classList.remove("anim-draw"), 260);
      }
    }
  });
}
