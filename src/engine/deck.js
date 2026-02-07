import { Suits, Ranks } from "./types.js";

export function createDeck() {
  const deck = [];
  for (const suit of Suits) {
    for (const rank of Ranks) {
      deck.push({ suit, rank });
    }
  }
  return deck;
}

export function shuffle(deck, rng = Math.random) {
  const copy = deck.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function draw(deck) {
  if (deck.length === 0) return null;
  return deck.pop();
}

export function seededRng(seed) {
  let value = seed % 2147483647;
  if (value <= 0) value += 2147483646;
  return function rng() {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}
