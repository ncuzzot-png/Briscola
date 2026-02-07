import { createDeck, shuffle, draw, seededRng } from "./deck.js";
import { pointsForCard, trickWinner } from "./rules.js";

function baseState() {
  return {
    phase: "menu",
    mode: "hotseat",
    botDifficulty: "medium",
    awaitingTrickResolve: false,
    trickPauseMs: 900,
    hotseatViewPlayer: null,
    hands: [[], []],
    deck: [],
    briscolaCard: null,
    trumpSuit: null,
    trick: [null, null],
    leader: 0,
    turn: 0,
    captured: [[], []],
    scores: [0, 0],
    log: [],
    overlay: null,
    lastTurnPlayer: null,
    seed: null,
  };
}

export function newGame(seed) {
  return newGameWithMode(seed, "hotseat");
}

export function newGameWithMode(seed, mode, botDifficulty = "medium", trickPauseMs = 900) {
  const rng = Number.isFinite(seed) ? seededRng(seed) : Math.random;
  let deck = shuffle(createDeck(), rng);
  const hands = [[], []];

  for (let i = 0; i < 3; i += 1) {
    hands[0].push(draw(deck));
    hands[1].push(draw(deck));
  }

  const briscolaCard = draw(deck);
  const trumpSuit = briscolaCard?.suit || null;

  return {
    phase: "playing",
    mode,
    botDifficulty: botDifficulty || "medium",
    awaitingTrickResolve: false,
    trickPauseMs: Number.isFinite(trickPauseMs) ? trickPauseMs : 900,
    hotseatViewPlayer: mode === "hotseat" ? 0 : null,
    hands,
    deck,
    briscolaCard,
    trumpSuit,
    trick: [null, null],
    leader: 0,
    turn: 0,
    captured: [[], []],
    scores: [0, 0],
    log: ["Game start."],
    overlay: null,
    lastTurnPlayer: null,
    seed: Number.isFinite(seed) ? seed : null,
  };
}

function appendLog(state, message) {
  const log = state.log.slice(-4);
  log.push(message);
  return log;
}

function shouldShowOverlay(nextTurn, lastTurnPlayer) {
  if (nextTurn === 1) return true;
  if (nextTurn === 0 && lastTurnPlayer === 1) return true;
  return false;
}

function nextOverlay(nextTurn, lastTurnPlayer) {
  if (!shouldShowOverlay(nextTurn, lastTurnPlayer)) return null;
  const message = nextTurn === 1 ? "Pass device to Player 2" : "Pass back to Player 1";
  return { active: true, player: nextTurn, message };
}

function drawAfterTrick(state, winner) {
  const loser = winner === 0 ? 1 : 0;
  const deck = state.deck.slice();
  const hands = [state.hands[0].slice(), state.hands[1].slice()];
  let briscolaCard = state.briscolaCard;

  const winnerDraw = draw(deck);
  if (winnerDraw) hands[winner].push(winnerDraw);

  const loserDraw = draw(deck);
  if (loserDraw) {
    hands[loser].push(loserDraw);
  } else if (briscolaCard) {
    hands[loser].push(briscolaCard);
    briscolaCard = null;
  }

  return { deck, hands, briscolaCard };
}

function isGameOver(state) {
  return (
    state.hands[0].length === 0 &&
    state.hands[1].length === 0 &&
    state.deck.length === 0 &&
    !state.briscolaCard
  );
}

export function applyAction(state, action) {
  switch (action.type) {
    case "START_GAME": {
      const mode = action.mode || "hotseat";
      const botDifficulty = action.botDifficulty || "medium";
      const trickPauseMs = Number.isFinite(action.trickPauseMs) ? action.trickPauseMs : 900;
      return newGameWithMode(action.seed, mode, botDifficulty, trickPauseMs);
    }
    case "READY_FOR_TURN": {
      if (!state.overlay || action.player !== state.overlay.player) return state;
      return {
        ...state,
        overlay: null,
        hotseatViewPlayer: state.mode === "hotseat" ? state.turn : state.hotseatViewPlayer,
      };
    }
    case "PLAY_CARD": {
      if (state.phase !== "playing") return state;
      if (state.overlay?.active) return state;
      const { player, handIndex } = action;
      if (player !== state.turn) return state;

      const hand = state.hands[player];
      if (!hand[handIndex]) return state;

      const hands = [state.hands[0].slice(), state.hands[1].slice()];
      const [card] = hands[player].splice(handIndex, 1);
      const trick = state.trick.slice();
      trick[player] = card;

      let nextState = {
        ...state,
        hands,
        trick,
        lastTurnPlayer: player,
      };

      if (trick[0] && trick[1]) {
        return {
          ...nextState,
          awaitingTrickResolve: true,
          overlay: null,
        };
      }

      const nextTurn = player === 0 ? 1 : 0;
      const nextOverlayValue =
        state.mode === "hotseat"
          ? nextOverlay(nextTurn, nextState.lastTurnPlayer)
          : null;
      return {
        ...nextState,
        turn: nextTurn,
        log: appendLog(state, `Player ${player + 1} played.`),
        overlay: nextOverlayValue,
        hotseatViewPlayer:
          state.mode === "hotseat"
            ? (nextOverlayValue ? null : nextTurn)
            : nextState.hotseatViewPlayer,
      };
    }
    case "NEXT_TRICK": {
      return state;
    }
    case "RESOLVE_TRICK": {
      if (!state.awaitingTrickResolve) return state;
      if (!state.trick[0] || !state.trick[1]) return { ...state, awaitingTrickResolve: false };

      const winner = trickWinner({ leader: state.leader, cards: state.trick, trumpSuit: state.trumpSuit });
      const captured = [state.captured[0].slice(), state.captured[1].slice()];
      captured[winner].push(state.trick[0], state.trick[1]);

      const points = pointsForCard(state.trick[0]) + pointsForCard(state.trick[1]);
      const scores = state.scores.slice();
      scores[winner] += points;

      const drawResult = drawAfterTrick(state, winner);

      let nextState = {
        ...state,
        awaitingTrickResolve: false,
        captured,
        scores,
        hands: drawResult.hands,
        deck: drawResult.deck,
        briscolaCard: drawResult.briscolaCard,
        trick: [null, null],
        leader: winner,
        turn: winner,
        log: appendLog(state, `Player ${winner + 1} wins the trick (+${points}).`),
      };

      if (isGameOver(nextState)) {
        const winnerText = nextState.scores[0] === nextState.scores[1]
          ? "Tie game."
          : nextState.scores[0] > nextState.scores[1]
          ? "Player 1 wins!"
          : "Player 2 wins!";
        return {
          ...nextState,
          phase: "gameover",
          overlay: null,
          log: appendLog(nextState, winnerText),
        };
      }

      const resolveOverlay =
        state.mode === "hotseat"
          ? nextOverlay(nextState.turn, nextState.lastTurnPlayer)
          : null;
      return {
        ...nextState,
        overlay: resolveOverlay,
        hotseatViewPlayer:
          state.mode === "hotseat"
            ? (resolveOverlay ? null : nextState.turn)
            : nextState.hotseatViewPlayer,
      };
    }
    case "RESTART": {
      return baseState();
    }
    default:
      return state;
  }
}

export function initialState() {
  return baseState();
}

export function testTrickWinner() {
  const tests = [
    {
      leader: 0,
      cards: [{ suit: "cups", rank: "A" }, { suit: "swords", rank: "2" }],
      trumpSuit: "swords",
      winner: 1,
    },
    {
      leader: 0,
      cards: [{ suit: "coins", rank: "3" }, { suit: "coins", rank: "A" }],
      trumpSuit: "cups",
      winner: 1,
    },
    {
      leader: 1,
      cards: [{ suit: "clubs", rank: "2" }, { suit: "coins", rank: "K" }],
      trumpSuit: "cups",
      winner: 1,
    },
  ];

  tests.forEach((test, index) => {
    const result = trickWinner(test);
    console.assert(result === test.winner, `testTrickWinner ${index} failed`);
  });
  return "testTrickWinner done";
}

export function testScoring() {
  const cards = [
    { suit: "cups", rank: "A" },
    { suit: "coins", rank: "3" },
    { suit: "swords", rank: "K" },
    { suit: "clubs", rank: "Q" },
    { suit: "cups", rank: "J" },
    { suit: "coins", rank: "2" },
  ];
  const total = cards.reduce((sum, card) => sum + pointsForCard(card), 0);
  console.assert(total === 30, "testScoring failed");
  return "testScoring done";
}

export function testDeckCounts() {
  const deck = createDeck();
  console.assert(deck.length === 40, "testDeckCounts failed");
  return "testDeckCounts done";
}
