import { Guild, PermissionFlagsBits, Role } from 'discord.js';

import {
  CARD_POOL,
  CardDefinition,
  CardRole,
  findCard,
  RARITY_LABELS,
} from './cards.js';
import economy from './economy.js';
import deckTools from './deck.js';
import battleTools from './battle.js';
import {
  DuelRecord,
  GamePlayer,
  getDuelCollection,
  getOrCreatePlayer,
  getPlayerCollection,
} from './storage.js';

const DRAW_COOLDOWN_MS = 6 * 60 * 60 * 1_000;
const DAILY_COOLDOWN_MS = 24 * 60 * 60 * 1_000;
const DECK_SIZE = deckTools.MAX_DECK_SIZE;

export class GameDatabaseUnavailableError extends Error {
  constructor() {
    super('O banco do jogo não está conectado no momento.');
    this.name = 'GameDatabaseUnavailableError';
  }
}

function playersCollection() {
  const collection = getPlayerCollection();
  if (!collection) throw new GameDatabaseUnavailableError();
  return collection;
}

function duelsCollection() {
  const collection = getDuelCollection();
  if (!collection) throw new GameDatabaseUnavailableError();
  return collection;
}

function normalizeCardReference(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

const CARD_IDS_BY_REFERENCE = new Map<string, string>();
for (const card of CARD_POOL) {
  CARD_IDS_BY_REFERENCE.set(normalizeCardReference(card.id), card.id);
  CARD_IDS_BY_REFERENCE.set(normalizeCardReference(card.name), card.id);
}

export function resolveCardId(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  const trimmed = value.trim();
  const exact = findCard(trimmed);
  if (exact) return exact.id;

  const normalized = normalizeCardReference(trimmed);
  const withoutRarity = normalized.replace(/(comum|rara|ultra)$/, '');
  return CARD_IDS_BY_REFERENCE.get(normalized) ??
    CARD_IDS_BY_REFERENCE.get(withoutRarity);
}

function resolveCardReference(value: unknown): string | undefined {
  if (typeof value === 'string') return resolveCardId(value);
  if (!value || typeof value !== 'object') return undefined;

  const record = value as Record<string, unknown>;
  return resolveCardId(
    record.id ?? record.cardId ?? record.name ?? record.cardName ?? record.value,
  );
}

function ownedCardIds(player: GamePlayer): string[] {
  const legacyPlayer = player as GamePlayer & { collection?: unknown };
  const storedCards = Array.isArray(legacyPlayer.cards)
    ? legacyPlayer.cards
    : Array.isArray(legacyPlayer.collection)
      ? legacyPlayer.collection
      : [];
  return [...new Set(
    storedCards
      .map(resolveCardReference)
      .filter((cardId): cardId is string => Boolean(cardId)),
  )];
}

function deckCardIds(player: GamePlayer): string[] {
  return Array.isArray(player.deck)
    ? player.deck
      .map(resolveCardReference)
      .filter((cardId): cardId is string => Boolean(cardId))
    : [];
}

export function playerOwnsCard(player: GamePlayer, value: unknown): boolean {
  const cardId = resolveCardReference(value);
  return Boolean(cardId && ownedCardIds(player).includes(cardId));
}

export async function getGamePlayer(userId: string): Promise<GamePlayer> {
  const player = await getOrCreatePlayer(userId);
  if (!player) throw new GameDatabaseUnavailableError();
  return player;
}

export async function summonCard(userId: string): Promise<{
  card: CardDefinition;
  duplicate: boolean;
  coins: number;
  retryAt?: number;
}> {
  const players = playersCollection();
  const player = await getGamePlayer(userId);
  const collection = ownedCardIds(player);
  const now = Date.now();

  if (player.lastDrawAt && now - player.lastDrawAt < DRAW_COOLDOWN_MS) {
    return {
      card: CARD_POOL[0],
      duplicate: false,
      coins: 0,
      retryAt: player.lastDrawAt + DRAW_COOLDOWN_MS,
    };
  }

  const cooldownFilter = player.lastDrawAt
    ? { _id: userId, lastDrawAt: player.lastDrawAt }
    : { _id: userId, lastDrawAt: { $exists: false } };
  const reserved = await players.updateOne(
    cooldownFilter,
    { $set: { lastDrawAt: now, updatedAt: now } },
  );
  if (reserved.modifiedCount !== 1) {
    const latest = await players.findOne({ _id: userId });
    return {
      card: CARD_POOL[0],
      duplicate: false,
      coins: 0,
      retryAt: (latest?.lastDrawAt ?? now) + DRAW_COOLDOWN_MS,
    };
  }

  const card = economy.drawRandomCard();
  const duplicate = collection.includes(card.id);
  if (duplicate) {
    const duplicateCoins = economy.DAILY_COINS_BY_RARITY[card.rarity];
    const saved = await players.updateOne(
      { _id: userId },
      {
        $inc: { coins: duplicateCoins },
        $set: { cards: collection, updatedAt: now },
      },
    );
    if (saved.matchedCount !== 1) throw new Error('Não foi possível salvar a carta repetida.');
    return { card, duplicate: true, coins: duplicateCoins };
  }

  const saved = await players.updateOne(
    { _id: userId },
    {
      $set: {
        cards: [...collection, card.id],
        [`upgrades.${card.id}`]: { damage: 0, hp: 0 },
        updatedAt: now,
      },
    },
  );
  if (saved.matchedCount !== 1) throw new Error('Não foi possível salvar a carta sorteada.');
  return { card, duplicate: false, coins: 0 };
}

export async function claimDailyCoins(userId: string): Promise<{
  coins: number;
  nextAt?: number;
  cardCount: number;
}> {
  const players = playersCollection();
  const player = await getGamePlayer(userId);
  const collection = ownedCardIds(player);
  if (collection.length === 0) return { coins: 0, cardCount: 0 };

  const now = Date.now();
  const reward = economy.calculateDailyCoins(collection);

  if (player.lastDailyAt && now - player.lastDailyAt < DAILY_COOLDOWN_MS) {
    return {
      coins: 0,
      cardCount: collection.length,
      nextAt: player.lastDailyAt + DAILY_COOLDOWN_MS,
    };
  }

  const cooldownFilter = player.lastDailyAt
    ? { _id: userId, lastDailyAt: player.lastDailyAt }
    : { _id: userId, lastDailyAt: { $exists: false } };
  const result = await players.updateOne(
    cooldownFilter,
    {
      $inc: { coins: reward },
      $set: { lastDailyAt: now, updatedAt: now },
    },
  );

  if (result.modifiedCount !== 1) {
    const latest = await players.findOne({ _id: userId });
    return {
      coins: 0,
      cardCount: collection.length,
      nextAt: (latest?.lastDailyAt ?? now) + DAILY_COOLDOWN_MS,
    };
  }

  return { coins: reward, cardCount: collection.length };
}

export async function upgradeCard(
  userId: string,
  cardId: string,
  stat: 'damage' | 'hp',
): Promise<{ cost: number; newLevel: number; coins: number } | null> {
  const players = playersCollection();
  const player = await getGamePlayer(userId);
  const resolvedCardId = resolveCardId(cardId);
  if (!resolvedCardId) return null;
  const collection = ownedCardIds(player);
  const upgrade = economy.upgradeCard(
    { ...player, cards: collection },
    resolvedCardId,
    stat,
  );
  if (!upgrade.ok) return null;

  const newLevel = upgrade.player.upgrades?.[resolvedCardId]?.[stat] ?? 1;
  const cost = upgrade.cost;
  const path = `upgrades.${resolvedCardId}.${stat}`;
  const result = await players.updateOne(
    { _id: userId, coins: { $gte: cost } },
    {
      $inc: { coins: -cost, [path]: 1 },
      $set: { cards: collection, updatedAt: Date.now() },
    },
  );

  if (result.modifiedCount !== 1) return null;
  return { cost, newLevel, coins: player.coins - cost };
}

export async function addCardToDeck(
  userId: string,
  cardId: string,
): Promise<{ ok: boolean; reason?: string; deck?: string[] }> {
  const players = playersCollection();
  const player = await getGamePlayer(userId);
  const resolvedCardId = resolveCardId(cardId);
  if (!resolvedCardId) return { ok: false, reason: 'unknown_card' };
  const collection = ownedCardIds(player);
  const currentDeck = deckCardIds(player);
  const normalizedPlayer = { ...player, cards: collection, deck: currentDeck };
  const change = deckTools.addCardToDeck(normalizedPlayer, resolvedCardId);
  if (!change.ok) return { ok: false, reason: change.reason };
  const nextDeck = change.deck;
  if (nextDeck.length === DECK_SIZE) {
    const roles = new Set(nextDeck.map((id) => findCard(id)?.role).filter(Boolean));
    if (roles.size < 2) return { ok: false, reason: 'needs_variety' };
  }

  const saved = await players.updateOne(
    { _id: userId },
    { $set: { cards: collection, deck: nextDeck, updatedAt: Date.now() } },
  );
  if (saved.matchedCount !== 1) return { ok: false, reason: 'save_failed' };
  return { ok: true, deck: nextDeck };
}

export async function removeCardFromDeck(
  userId: string,
  cardId: string,
): Promise<{ ok: boolean; deck: string[] }> {
  const players = playersCollection();
  const player = await getGamePlayer(userId);
  const resolvedCardId = resolveCardId(cardId);
  const currentDeck = deckCardIds(player);
  if (!resolvedCardId || !currentDeck.includes(resolvedCardId)) {
    return { ok: false, deck: currentDeck };
  }
  const deck = currentDeck.filter((id) => id !== resolvedCardId);
  const change = deckTools.setDeck(
    { ...player, cards: ownedCardIds(player), deck: currentDeck },
    deck,
  );
  if (!change.ok) return { ok: false, deck: currentDeck };
  const saved = await players.updateOne(
    { _id: userId },
    {
      $set: {
        cards: ownedCardIds(player),
        deck: change.deck,
        updatedAt: Date.now(),
      },
    },
  );
  if (saved.matchedCount !== 1) return { ok: false, deck: currentDeck };
  return { ok: true, deck: change.deck ?? deck };
}

export interface DuelChallenge {
  duel: DuelRecord;
  opponentDeck: string[];
}

export async function createDuelChallenge(
  guildId: string,
  channelId: string,
  challengerId: string,
  challengedId: string,
): Promise<DuelChallenge | { error: string }> {
  const duels = duelsCollection();
  if (challengerId === challengedId) return { error: 'self' };

  const challenger = await getGamePlayer(challengerId);
  const opponent = await getGamePlayer(challengedId);
  if (!isDuelDeckValid(challenger.deck)) return { error: 'your_deck' };
  if (!isDuelDeckValid(opponent.deck)) return { error: 'opponent_deck' };

  const now = Date.now();
  const duel: DuelRecord = {
    _id: crypto.randomUUID(),
    guildId,
    channelId,
    challengerId,
    challengedId,
    status: 'pending',
    createdAt: now,
  };
  await duels.insertOne(duel);
  return { duel, opponentDeck: opponent.deck };
}

export function saveDuelMessage(duelId: string, messageId: string): Promise<unknown> {
  return duelsCollection().updateOne(
    { _id: duelId, status: 'pending' },
    { $set: { messageId } },
  );
}

export interface DuelResult {
  status: 'finished' | 'draw';
  winnerId?: string;
  loserId?: string;
  rounds: number;
  summary: string;
}

export function simulateDuel(
  challenger: GamePlayer,
  challenged: GamePlayer,
): DuelResult {
  const left = deckTools.getDeckWithStats(challenger);
  const right = deckTools.getDeckWithStats(challenged);
  const battle = battleTools.simulateBattle(left, right, { maxRounds: 1_000 });
  const summary =
    `Dano do time A: ${battle.totals.A.damage} · HP do time A: ${battle.remainingHp.A}\n` +
    `Dano do time B: ${battle.totals.B.damage} · HP do time B: ${battle.remainingHp.B}`;
  if (battle.winner === 'empate') {
    return { status: 'draw', rounds: battle.rounds, summary };
  }

  const winnerId = battle.winner === 'A' ? challenger._id : challenged._id;
  const loserId = battle.winner === 'A' ? challenged._id : challenger._id;
  return {
    status: 'finished',
    winnerId,
    loserId,
    rounds: battle.rounds,
    summary,
  };
}

function isDuelDeckValid(deck: string[]): boolean {
  if (deck.length !== DECK_SIZE) return false;
  const roles = new Set(deck.map((cardId) => findCard(cardId)?.role).filter(Boolean));
  return roles.size >= 2 && deck.every((cardId) => findCard(cardId));
}

export async function acceptDuel(
  duelId: string,
  userId: string,
): Promise<{ error?: string; duel?: DuelRecord; result?: DuelResult }> {
  const duels = duelsCollection();
  const duel = await duels.findOne({ _id: duelId });
  if (!duel) return { error: 'not_found' };
  if (duel.challengedId !== userId) return { error: 'not_yours' };
  if (duel.status !== 'pending') return { error: 'not_pending' };
  if (Date.now() - duel.createdAt > 10 * 60 * 1_000) {
    await duels.updateOne({ _id: duelId, status: 'pending' }, { $set: { status: 'expired' } });
    return { error: 'expired' };
  }

  const claimed = await duels.updateOne(
    { _id: duelId, status: 'pending', challengedId: userId },
    { $set: { status: 'playing' } },
  );
  if (claimed.modifiedCount !== 1) return { error: 'not_pending' };

  const [challenger, challenged] = await Promise.all([
    getGamePlayer(duel.challengerId),
    getGamePlayer(duel.challengedId),
  ]);
  if (!isDuelDeckValid(challenger.deck) || !isDuelDeckValid(challenged.deck)) {
    await duels.updateOne({ _id: duelId }, { $set: { status: 'expired' } });
    return { error: 'deck_changed' };
  }

  const result = simulateDuel(challenger, challenged);
  if (result.winnerId && result.loserId) {
    await Promise.all([
      playersCollection().updateOne(
        { _id: result.winnerId },
        { $inc: { wins: 1 }, $set: { updatedAt: Date.now() } },
      ),
      playersCollection().updateOne(
        { _id: result.loserId },
        { $inc: { losses: 1 }, $set: { updatedAt: Date.now() } },
      ),
    ]);
  }

  const finalDuel: DuelRecord = {
    ...duel,
    status: 'finished',
    winnerId: result.winnerId,
    loserId: result.loserId,
    resultText: result.summary,
    rounds: result.rounds,
  };
  await duels.updateOne(
    { _id: duelId, status: 'playing' },
    {
      $set: {
        status: 'finished',
        winnerId: result.winnerId,
        loserId: result.loserId,
        resultText: result.summary,
        rounds: result.rounds,
      },
    },
  );

  return { duel: finalDuel, result };
}

export async function declineDuel(
  duelId: string,
  userId: string,
): Promise<'ok' | 'not_found' | 'not_yours' | 'not_pending'> {
  const duels = duelsCollection();
  const result = await duels.updateOne(
    { _id: duelId, challengedId: userId, status: 'pending' },
    { $set: { status: 'declined' } },
  );
  if (result.modifiedCount === 1) return 'ok';
  const duel = await duels.findOne({ _id: duelId });
  if (!duel) return 'not_found';
  if (duel.challengedId !== userId) return 'not_yours';
  return 'not_pending';
}

export async function getWinRanking(limit = 10): Promise<GamePlayer[]> {
  return playersCollection()
    .find({ wins: { $gt: 0 } })
    .sort({ wins: -1, losses: 1, updatedAt: 1 })
    .limit(limit)
    .toArray();
}

export async function updateTopDuelRole(guild: Guild): Promise<void> {
  const ranking = await getWinRanking(3);
  if (!ranking.length) return;

  const me = guild.members.me;
  if (!me?.permissions.has(PermissionFlagsBits.ManageRoles)) {
    console.error(`[CardGame] Sem permissão para gerenciar o cargo de ranking em ${guild.name}.`);
    return;
  }

  await guild.roles.fetch();
  let role: Role | undefined = guild.roles.cache.find((candidate) => candidate.name === 'Destaque X1');
  if (!role) {
    role = await guild.roles.create({
      name: 'Destaque X1',
      color: 0xf1c40f,
      hoist: false,
      mentionable: false,
      reason: 'Destaque automático do ranking de vitórias X1',
    });
  }

  const winnerIds = new Set(ranking.map((player) => player._id));
  const membersWithRole = await guild.members.fetch().catch(() => null);
  if (!membersWithRole) return;

  for (const member of membersWithRole.values()) {
    const shouldHaveRole = winnerIds.has(member.id);
    const hasRole = member.roles.cache.has(role.id);
    if (shouldHaveRole && !hasRole) {
      await member.roles.add(role, 'Top 3 do ranking de vitórias X1').catch((error) => {
        console.error(`[CardGame] Falha ao dar Destaque X1 para ${member.id}:`, error);
      });
    } else if (!shouldHaveRole && hasRole) {
      await member.roles.remove(role, 'Saiu do Top 3 do ranking de vitórias X1').catch((error) => {
        console.error(`[CardGame] Falha ao remover Destaque X1 de ${member.id}:`, error);
      });
    }
  }
}

export function calculateCardStats(
  player: GamePlayer,
  cardId: string,
): { damage: number; hp: number; damageLevel: number; hpLevel: number } | null {
  const card = findCard(cardId);
  if (!card || !player.cards.includes(cardId)) return null;
  const upgrades = player.upgrades[cardId] ?? { damage: 0, hp: 0 };
  const effective = deckTools.getDeckWithStats({ ...player, deck: [cardId] })[0];
  if (!effective) return null;
  return {
    damage: effective.damage,
    hp: effective.hp,
    damageLevel: upgrades.damage,
    hpLevel: upgrades.hp,
  };
}

export function rarityName(card: CardDefinition): string {
  return RARITY_LABELS[card.rarity];
}
