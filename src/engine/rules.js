import { RankOrder } from "./types.js";

export function rankOrder(rank) {
  return RankOrder.indexOf(rank);
}

export function pointsForCard(card) {
  switch (card.rank) {
    case "A":
      return 11;
    case "3":
      return 10;
    case "K":
      return 4;
    case "Q":
      return 3;
    case "J":
      return 2;
    default:
      return 0;
  }
}

export function legalMoves(hand) {
  return hand.map((_, index) => index);
}

export function trickWinner({ leader, cards, trumpSuit }) {
  const leaderCard = cards[leader];
  const otherPlayer = leader === 0 ? 1 : 0;
  const otherCard = cards[otherPlayer];

  if (!leaderCard || !otherCard) {
    return leader;
  }

  const leaderIsTrump = leaderCard.suit === trumpSuit;
  const otherIsTrump = otherCard.suit === trumpSuit;

  if (leaderIsTrump && !otherIsTrump) return leader;
  if (!leaderIsTrump && otherIsTrump) return otherPlayer;

  if (leaderCard.suit === otherCard.suit) {
    return rankOrder(leaderCard.rank) < rankOrder(otherCard.rank) ? leader : otherPlayer;
  }

  return leader;
}
