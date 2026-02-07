import { applyAction, initialState, testTrickWinner, testScoring, testDeckCounts } from "./engine/game.js";
import {
  chooseBotMove,
  testBotNeverPlaysOutOfTurn,
  testBotPlaysLegalIndex,
  testBotDifficultySwitch,
  testEasyBotRandomness,
} from "./engine/bot.js";
import { render } from "./ui/render.js";
import { captureBeforeRender } from "./ui/animations.js";
import { bindEvents } from "./ui/events.js";
import { getPreloadUrls, preloadImages } from "./ui/assets.js";
import { playSfx } from "./ui/sfx.js";
import { hostRoom, joinRoom, sendAction, setOnlineHandlers, disconnectOnline } from "./net/online.js";

const root = document.getElementById("app");
let state = initialState();
let onlineMeta = { status: "idle", roomCode: null, myPlayerIndex: null, isHost: false, error: null };
const seed = getSeed();
let botTimerId = null;
let trickTimerId = null;
let preloadPromise = null;
let loadingActive = false;
let uiState = { showHomeConfirm: false };
const MIN_LOADING_MS = 700;
const MAX_LOADING_MS = 2000;

// Controllers (architecture prep):
// - HumanController: UI click events dispatch actions.
// - BotController: schedules auto actions.
// - RemoteController: TODO for online play (exchange actions only).
// Determinism requirement: given seed + action list, engine state must match across peers.

function dispatch(action) {
  if (action.type === "SHOW_HOME_CONFIRM") {
    uiState = { ...uiState, showHomeConfirm: true };
    renderWithOnline();
    bindEvents(root, dispatch);
    return;
  }
  if (action.type === "HIDE_HOME_CONFIRM") {
    uiState = { ...uiState, showHomeConfirm: false };
    renderWithOnline();
    bindEvents(root, dispatch);
    return;
  }
  if (action.type === "ONLINE_HOST") {
    runWithPreload(() => {
      hostRoom().catch((err) => {
        onlineMeta = { ...onlineMeta, status: "error", error: err?.message || "Failed to host" };
        renderWithOnline();
      });
    });
    return;
  }
  if (action.type === "ONLINE_JOIN") {
    const code = action.code || "";
    runWithPreload(() => {
      joinRoom(code).catch((err) => {
        onlineMeta = { ...onlineMeta, status: "error", error: err?.message || "Failed to join" };
        renderWithOnline();
      });
    });
    return;
  }
  if (action.type === "ONLINE_CANCEL") {
    disconnectOnline();
    onlineMeta = { status: "idle", roomCode: null, myPlayerIndex: null, isHost: false, error: null };
    state = initialState();
    renderWithOnline();
    bindEvents(root, dispatch);
    return;
  }
  if (action.type === "START_GAME" && !action._skipPreload) {
    startWithPreload(action);
    return;
  }
  if (action.type === "START_GAME" || action.type === "RESTART") {
    if (botTimerId) {
      clearTimeout(botTimerId);
      botTimerId = null;
    }
    if (trickTimerId) {
      clearTimeout(trickTimerId);
      trickTimerId = null;
    }
    uiState = { ...uiState, showHomeConfirm: false };
  }
  if (state.mode === "online") {
    if (action.type === "PLAY_CARD") {
      sendAction({ type: "PLAY_CARD", handIndex: action.handIndex });
    }
    return;
  }

  const prevState = state;
  captureBeforeRender(root, state);
  const nextAction =
    action.type === "START_GAME" && action.seed === undefined
      ? { ...action, seed }
      : action;
  state = applyAction(state, nextAction);
  renderWithOnline();
  bindEvents(root, dispatch);
  handleSfxTransition(prevState, state);
  scheduleTrickResolveIfNeeded();
  scheduleBotIfNeeded();
}

function getSeed() {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get("seed");
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

renderWithOnline();
bindEvents(root, dispatch);
ensurePreload();

window.BriscolaTests = {
  testTrickWinner,
  testScoring,
  testDeckCounts,
  testBotNeverPlaysOutOfTurn: () => testBotNeverPlaysOutOfTurn(state),
  testBotPlaysLegalIndex: () => testBotPlaysLegalIndex(state),
  testBotDifficultySwitch: () => testBotDifficultySwitch(state),
  testEasyBotRandomness: () => testEasyBotRandomness(state),
};

function scheduleBotIfNeeded() {
  if (botTimerId) {
    clearTimeout(botTimerId);
    botTimerId = null;
  }

  if (
    state.mode !== "vsBot" ||
    state.phase !== "playing" ||
    state.turn !== 1 ||
    state.awaitingTrickResolve
  ) {
    return;
  }

  botTimerId = setTimeout(() => {
    const action = chooseBotMove(state);
    if (action) {
      dispatch(action);
    }
  }, 600);
}

function scheduleTrickResolveIfNeeded() {
  if (trickTimerId) {
    clearTimeout(trickTimerId);
    trickTimerId = null;
  }

  if (state.mode === "online") return;
  if (!state.awaitingTrickResolve) return;

  const delay = Number.isFinite(state.trickPauseMs) ? state.trickPauseMs : 900;
  trickTimerId = setTimeout(() => {
    dispatch({ type: "RESOLVE_TRICK" });
  }, delay);
}

function renderWithOnline() {
  render(root, { ...state, online: onlineMeta, ui: uiState });
}

setOnlineHandlers({
  onState: (serverState) => {
    const prevState = state;
    captureBeforeRender(root, state);
    if (botTimerId) {
      clearTimeout(botTimerId);
      botTimerId = null;
    }
    if (trickTimerId) {
      clearTimeout(trickTimerId);
      trickTimerId = null;
    }
    state = serverState;
    onlineMeta = { ...onlineMeta, status: "connected" };
    renderWithOnline();
    bindEvents(root, dispatch);
    handleSfxTransition(prevState, state);
  },
  onStatus: (patch) => {
    onlineMeta = { ...onlineMeta, ...patch };
    if (patch.status === "error" || patch.status === "closed") {
      state = initialState();
    }
    renderWithOnline();
    bindEvents(root, dispatch);
  },
});

function ensurePreload() {
  if (!preloadPromise) {
    preloadPromise = preloadImages(getPreloadUrls());
  }
  return preloadPromise;
}

function setLoadingOverlay(active) {
  const overlay = document.getElementById("loading-overlay");
  if (!overlay) return;
  overlay.classList.toggle("active", active);
}

function delay(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function startWithPreload(action) {
  runWithPreload(() => {
    dispatch({ ...action, _skipPreload: true });
  });
}

function runWithPreload(onDone) {
  if (loadingActive) return;
  loadingActive = true;
  setLoadingOverlay(true);
  const preload = ensurePreload().catch(() => null);
  Promise.race([
    Promise.all([preload, delay(MIN_LOADING_MS)]),
    delay(MAX_LOADING_MS),
  ]).then(() => {
    loadingActive = false;
    setLoadingOverlay(false);
    if (onDone) onDone();
  });
}

function handleSfxTransition(prevState, nextState) {
  if (!prevState || !nextState) return;
  const wasAwaiting = prevState.awaitingTrickResolve && prevState.trick[0] && prevState.trick[1];
  const nowCleared = !nextState.awaitingTrickResolve && !nextState.trick[0] && !nextState.trick[1];
  if (wasAwaiting && nowCleared) {
    const prevScores = prevState.scores || [0, 0];
    const nextScores = nextState.scores || [0, 0];
    const isOnline = nextState.mode === "online";
    const myIndex = Number.isFinite(nextState.online?.myPlayerIndex) ? nextState.online.myPlayerIndex : 0;
    const i = isOnline ? myIndex : 0;
    if (nextScores[i] > prevScores[i]) {
      playSfx("win");
    } else {
      playSfx("lose");
    }
  }
}
