const customRanks = new Set(["A", "3", "K", "Q", "J"]);
const suitLetters = {
  clubs: "C",
  coins: "D",
  cups: "H",
  swords: "S",
  diamonds: "D",
  hearts: "H",
  spades: "S",
  c: "C",
  d: "D",
  h: "H",
  s: "S",
};
const rankKeys = {
  a: "A",
  "1": "A",
  "3": "3",
  k: "K",
  q: "Q",
  j: "J",
};

export function assetKey(card) {
  return `${card.suit}_${card.rank}`;
}

export function isSpecial(card) {
  return customRanks.has(String(card.rank).toUpperCase());
}

export function resolveCardFace(card) {
  if (!card) return null;
  const suitLetter = normalizeSuit(card.suit);
  const rankKey = normalizeRank(card.rank);
  if (!suitLetter || !rankKey || !customRanks.has(rankKey)) return null;
  return `assets/cards/${suitLetter}_${rankKey}.png`;
}

export function resolveCustomKey(card) {
  if (!card) return null;
  const suitLetter = normalizeSuit(card.suit);
  const rankKey = normalizeRank(card.rank);
  if (!suitLetter || !rankKey) return null;
  return `${suitLetter}_${rankKey}`;
}

function normalizeSuit(suit) {
  if (suit === undefined || suit === null) return null;
  const key = String(suit).toLowerCase();
  return suitLetters[key] || null;
}

function normalizeRank(rank) {
  if (rank === undefined || rank === null) return null;
  const key = String(rank).toLowerCase();
  return rankKeys[key] || null;
}

export function resolveCardBack() {
  return "assets/cards/back.png";
}

export function resolveCapybaraUrls() {
  return ["assets/backgrounds/capybaras.png"];
}

export function resolveBackground(screen) {
  switch (screen) {
    case "menu":
      return "assets/backgrounds/menu.png";
    case "table":
      return "assets/backgrounds/table.png";
    case "win":
      return "assets/backgrounds/win.png";
    default:
      return null;
  }
}

export function listCustomCardUrls() {
  const suits = ["C", "D", "H", "S"];
  const ranks = ["A", "3", "K", "Q", "J"];
  const urls = [];
  suits.forEach((suit) => {
    ranks.forEach((rank) => {
      urls.push(`assets/cards/${suit}_${rank}.png`);
    });
  });
  return urls;
}

export function preloadImages(urls) {
  const attempts = urls.map((url) => (
    new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ url, ok: true });
      img.onerror = () => resolve({ url, ok: false });
      img.src = url;
    })
  ));

  return Promise.all(attempts).then((results) => {
    const failed = results.filter((r) => !r.ok).map((r) => r.url);
    if (failed.length) {
      console.warn("Asset preload failures:", failed);
    }
    return results;
  });
}

export function getPreloadUrls() {
  const backgrounds = [
    resolveBackground("menu"),
    resolveBackground("table"),
    resolveBackground("win"),
    "assets/backgrounds/mug.png",
    "assets/backgrounds/tunamelt.png",
    "assets/backgrounds/capybaras.png",
  ].filter(Boolean);

  return [
    ...listCustomCardUrls(),
    resolveCardBack(),
    ...backgrounds,
  ];
}
