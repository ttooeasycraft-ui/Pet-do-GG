import type { CardDefinition } from './cards.js';

interface DeckPlayer {
  cards: Array<string | { id: string }>;
  deck: string[];
  upgrades?: Record<string, { damage: number; hp: number }>;
  [key: string]: unknown;
}

declare const deckTools: {
  MAX_DECK_SIZE: number;
  setDeck(
    player: DeckPlayer,
    cardIds: string[],
  ): { ok: boolean; reason?: string; maxSize?: number; cardId?: string; deck?: string[] };
  addCardToDeck(
    player: DeckPlayer,
    cardId: string,
  ): { ok: true; deck: string[]; player: DeckPlayer } | { ok: false; reason: string; maxSize?: number; cardId?: string };
  getDeckWithStats(
    player: DeckPlayer,
  ): Array<CardDefinition & { damageLevel: number; hpLevel: number }>;
};

export default deckTools;
