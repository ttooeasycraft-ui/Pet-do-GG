import type { CardDefinition } from './cards.js';

interface EconomyPlayer {
  coins: number;
  cards: Array<string | { id: string }>;
  upgrades?: Record<string, { damage: number; hp: number }>;
  [key: string]: unknown;
}

declare const economy: {
  DAILY_COINS_BY_RARITY: Readonly<Record<'comum' | 'rara' | 'ultra', number>>;
  DRAW_RARITY_CHANCES: ReadonlyArray<{ rarity: 'comum' | 'rara' | 'ultra'; upperBound: number }>;
  drawRandomCard(random?: () => number): CardDefinition;
  calculateDailyCoins(collection?: Array<string | { id: string }>): number;
  upgradeCard(
    player: EconomyPlayer,
    cardId: string,
    stat: 'damage' | 'hp',
  ):
    | { ok: true; cost: number; player: EconomyPlayer }
    | { ok: false; reason: string; cost?: number; coins?: number };
};

export default economy;
