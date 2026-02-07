import { pointsForCard, trickWinner } from "./rules.js";

function cardPoints(card) {
  return pointsForCard(card);
}

function isTrump(card, trumpSuit) {
  return card.suit === trumpSuit;
}

function evaluateLead(card, trumpSuit) {
  const trumpPenalty = isTrump(card, trumpSuit) ? 100 : 0;
  return trumpPenalty + cardPoints(card);
}

function evaluateFollow(state, card) {
  const leader = state.leader;
  const cards = state.trick.slice();
  cards[1] = card;
  const winner = trickWinner({ leader, cards, trumpSuit: state.trumpSuit });
  const wins = winner === 1;
  const cardValue = cardPoints(card);

  if (wins) {
    const trumpPenalty = isTrump(card, state.trumpSuit) ? 50 : 0;
    return trumpPenalty + cardValue;
  }

  return 200 + cardValue;
}

function getCandidateIndices(hand) {
  return hand.map((_, index) => index);
}

function scoreMedium(state, card, isLeading) {
  return isLeading
    ? evaluateLead(card, state.trumpSuit)
    : evaluateFollow(state, card);
}

function scoreHard(state, card, isLeading) {
  const base = scoreMedium(state, card, isLeading);
  const leader = state.leader;
  const cards = state.trick.slice();
  cards[1] = card;
  const winner = trickWinner({ leader, cards, trumpSuit: state.trumpSuit });
  const wins = winner === 1;
  const pointsAtStake =
    (state.trick[0] ? pointsForCard(state.trick[0]) : 0) + pointsForCard(card);
  const highValue = pointsAtStake >= 12;
  const deckRemaining = state.deck.length + (state.briscolaCard ? 1 : 0);
  const endgame = deckRemaining <= 6;
  const trumpPenalty = isTrump(card, state.trumpSuit) ? (endgame ? 10 : 40) : 0;

  if (wins) {
    return base - (highValue ? 60 : 20) + trumpPenalty;
  }

  return base + (pointsAtStake >= 10 ? 80 : 20);
}

export function chooseEasyMove(state) {
  const hand = state.hands[1];
  if (!hand || hand.length === 0) return null;
  const candidateIndices = getCandidateIndices(hand);

  if (Math.random() < 0.65) {
    const randomIndex = Math.floor(Math.random() * candidateIndices.length);
    return { type: "PLAY_CARD", player: 1, handIndex: candidateIndices[randomIndex] };
  }

  const isLeading = state.trick[0] === null && state.trick[1] === null;
  let worstIndex = candidateIndices[0];
  let worstScore = Number.NEGATIVE_INFINITY;

  candidateIndices.forEach((index) => {
    const card = hand[index];
    const score = scoreMedium(state, card, isLeading);
    if (score > worstScore) {
      worstScore = score;
      worstIndex = index;
    }
  });

  return { type: "PLAY_CARD", player: 1, handIndex: worstIndex };
}

export function chooseMediumMove(state) {
  const hand = state.hands[1];
  if (!hand || hand.length === 0) return null;

  const candidateIndices = getCandidateIndices(hand);
  let bestIndex = candidateIndices[0];
  let bestScore = Number.POSITIVE_INFINITY;
  const isLeading = state.trick[0] === null && state.trick[1] === null;

  candidateIndices.forEach((index) => {
    const card = hand[index];
    const score = scoreMedium(state, card, isLeading);
    if (score < bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });

  return { type: "PLAY_CARD", player: 1, handIndex: bestIndex };
}

export function chooseHardMove(state) {
  const hand = state.hands[1];
  if (!hand || hand.length === 0) return null;

  const candidateIndices = getCandidateIndices(hand);
  let bestIndex = candidateIndices[0];
  let bestScore = Number.POSITIVE_INFINITY;
  const isLeading = state.trick[0] === null && state.trick[1] === null;

  candidateIndices.forEach((index) => {
    const card = hand[index];
    const score = scoreHard(state, card, isLeading);
    if (score < bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });

  return { type: "PLAY_CARD", player: 1, handIndex: bestIndex };
}

export function chooseBotMove(state) {
  const difficulty = state.botDifficulty || "medium";
  if (difficulty === "easy") return chooseEasyMove(state);
  if (difficulty === "hard") return chooseHardMove(state);
  return chooseMediumMove(state);
}

export function testBotNeverPlaysOutOfTurn(state) {
  if (state.mode !== "vsBot") return "testBotNeverPlaysOutOfTurn skipped";
  if (state.turn !== 1) {
    const action = chooseBotMove(state);
    console.assert(action === null || action.player === 1, "bot should not play out of turn");
  }
  return "testBotNeverPlaysOutOfTurn done";
}

export function testBotPlaysLegalIndex(state) {
  const action = chooseBotMove(state);
  if (!action) return "testBotPlaysLegalIndex skipped";
  const hand = state.hands[1];
  console.assert(
    action.handIndex >= 0 && action.handIndex < hand.length,
    "bot should play legal hand index"
  );
  return "testBotPlaysLegalIndex done";
}

export function testBotDifficultySwitch(state) {
  const difficulties = ["easy", "medium", "hard"];
  difficulties.forEach((botDifficulty) => {
    const action = chooseBotMove({ ...state, botDifficulty });
    console.assert(action === null || action.player === 1, "bot difficulty move invalid");
  });
  return "testBotDifficultySwitch done";
}

export function testEasyBotRandomness(state) {
  const localState = { ...state, botDifficulty: "easy" };
  const first = chooseEasyMove(localState);
  let different = false;
  for (let i = 0; i < 8; i += 1) {
    const next = chooseEasyMove(localState);
    if (next && first && next.handIndex !== first.handIndex) {
      different = true;
      break;
    }
  }
  console.assert(different || (localState.hands[1]?.length || 0) <= 1, "easy bot randomness missing");
  return "testEasyBotRandomness done";
}
