export const Suits = ["cups", "swords", "coins", "clubs"];
export const Ranks = ["A", "2", "3", "4", "5", "6", "7", "J", "Q", "K"];

export const RankOrder = ["A", "3", "K", "Q", "J", "7", "6", "5", "4", "2"];

export function cardId(card) {
  return `${card.suit}_${card.rank}`;
}
