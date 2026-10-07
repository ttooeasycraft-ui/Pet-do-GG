const { findCard } = require('./cards.js');

const MAX_DECK_SIZE = 4;

function ownedCardIds(player) {
  return (player?.cards ?? player?.collection ?? [])
    .map((entry) => (typeof entry === 'string' ? entry : entry?.id))
    .filter((id) => typeof id === 'string');
}

function setDeck(player, cardIds) {
  if (!Array.isArray(cardIds)) return { ok: false, reason: 'invalid_deck' };
  if (cardIds.length > MAX_DECK_SIZE) {
    return { ok: false, reason: 'deck_full', maxSize: MAX_DECK_SIZE };
  }
  if (new Set(cardIds).size !== cardIds.length) {
    return { ok: false, reason: 'duplicate_cards' };
  }

  const owned = new Set(ownedCardIds(player));
  for (const cardId of cardIds) {
    if (!findCard(cardId)) return { ok: false, reason: 'unknown_card', cardId };
    if (!owned.has(cardId)) return { ok: false, reason: 'card_not_owned', cardId };
  }

  return { ok: true, deck: [...cardIds] };
}

function addCardToDeck(player, cardId) {
  const currentDeck = Array.isArray(player?.deck) ? player.deck : [];
  const result = setDeck(player, [...currentDeck, cardId]);
  return result.ok ? { ...result, player: { ...player, deck: result.deck } } : result;
}

function getDeckWithStats(player) {
  const cardLevels = player?.cardLevels ?? {};
  const upgrades = player?.upgrades ?? {};

  return (Array.isArray(player?.deck) ? player.deck : []).flatMap((cardId) => {
    const card = findCard(cardId);
    if (!card) return [];
    const levels = cardLevels[cardId] ?? upgrades[cardId] ?? {};
    const damageLevel = Math.max(0, Number(levels.damage) || 0);
    const hpLevel = Math.max(0, Number(levels.hp) || 0);

    return [{
      ...card,
      damage: card.damageBase + damageLevel * 2,
      hp: card.hpBase + hpLevel * 10,
      damageLevel,
      hpLevel,
    }];
  });
}

module.exports = {
  MAX_DECK_SIZE,
  setDeck,
  addCardToDeck,
  getDeckWithStats,
};
