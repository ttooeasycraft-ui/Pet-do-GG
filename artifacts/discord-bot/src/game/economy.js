const { CARDS, findCard } = require('./cards.js');

const DAILY_COINS_BY_RARITY = Object.freeze({
  comum: 1,
  rara: 3,
  ultra: 10,
});

const DRAW_RARITY_CHANCES = Object.freeze([
  { rarity: 'comum', upperBound: 0.6 },
  { rarity: 'rara', upperBound: 0.9 },
  { rarity: 'ultra', upperBound: 1 },
]);

function drawRandomCard(random = Math.random) {
  const roll = random();
  const rarity =
    DRAW_RARITY_CHANCES.find((entry) => roll < entry.upperBound)?.rarity ??
    'ultra';
  const rarityCards = CARDS.filter((card) => card.rarity === rarity);
  const index = Math.min(
    Math.floor(random() * rarityCards.length),
    rarityCards.length - 1,
  );
  return rarityCards[index];
}

function getOwnedCardIds(collection = []) {
  return collection
    .map((entry) => (typeof entry === 'string' ? entry : entry?.id))
    .filter((id) => typeof id === 'string');
}

function calculateDailyCoins(collection = []) {
  return getOwnedCardIds(collection).reduce((total, cardId) => {
    const card = findCard(cardId);
    return total + (card ? DAILY_COINS_BY_RARITY[card.rarity] : 0);
  }, 0);
}

function upgradeCard(player, cardId, stat) {
  if (!player || typeof player !== 'object') {
    return { ok: false, reason: 'invalid_player' };
  }
  if (!['damage', 'hp'].includes(stat)) {
    return { ok: false, reason: 'invalid_stat' };
  }

  const card = findCard(cardId);
  if (!card) return { ok: false, reason: 'unknown_card' };

  const ownedIds = getOwnedCardIds(player.cards ?? player.collection ?? []);
  if (!ownedIds.includes(cardId)) {
    return { ok: false, reason: 'card_not_owned' };
  }

  const currentUpgrades = player.cardLevels?.[cardId] ?? { damage: 0, hp: 0 };
  const level = Number(currentUpgrades[stat]) || 0;
  const cost = 10 * (level + 1);
  const coins = Number(player.coins) || 0;
  if (coins < cost) {
    return { ok: false, reason: 'not_enough_coins', cost, coins };
  }

  const cardLevels = {
    ...(player.cardLevels ?? {}),
    [cardId]: {
      damage: Number(currentUpgrades.damage) || 0,
      hp: Number(currentUpgrades.hp) || 0,
      [stat]: level + 1,
    },
  };

  return {
    ok: true,
    cost,
    player: { ...player, coins: coins - cost, cardLevels },
  };
}

module.exports = {
  DAILY_COINS_BY_RARITY,
  DRAW_RARITY_CHANCES,
  drawRandomCard,
  calculateDailyCoins,
  upgradeCard,
};
