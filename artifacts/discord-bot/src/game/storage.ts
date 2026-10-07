import type { Collection, Document } from 'mongodb';

import { getGameDatabase } from './database.js';

export interface CardUpgrade {
  damage: number;
  hp: number;
}

export interface GamePlayer extends Document {
  _id: string;
  coins: number;
  cards: string[];
  upgrades: Record<string, CardUpgrade>;
  deck: string[];
  wins: number;
  losses: number;
  lastDrawAt?: number;
  lastDailyAt?: number;
  createdAt: number;
  updatedAt: number;
}

export interface DuelRecord extends Document {
  _id: string;
  guildId: string;
  channelId: string;
  challengerId: string;
  challengedId: string;
  status: 'pending' | 'playing' | 'finished' | 'declined' | 'expired';
  createdAt: number;
  messageId?: string;
  winnerId?: string;
  loserId?: string;
  resultText?: string;
  rounds?: number;
}

export function getPlayerCollection(): Collection<GamePlayer> | null {
  return getGameDatabase()?.collection<GamePlayer>('players') ?? null;
}

export function getDuelCollection(): Collection<DuelRecord> | null {
  return getGameDatabase()?.collection<DuelRecord>('matches') ?? null;
}

export function newPlayer(userId: string, now = Date.now()): GamePlayer {
  return {
    _id: userId,
    coins: 0,
    cards: [],
    upgrades: {},
    deck: [],
    wins: 0,
    losses: 0,
    createdAt: now,
    updatedAt: now,
  };
}

export async function getOrCreatePlayer(
  userId: string,
): Promise<GamePlayer | null> {
  const players = getPlayerCollection();
  if (!players) return null;

  let player = await players.findOne({ _id: userId });
  if (player) return player;

  try {
    await players.insertOne(newPlayer(userId));
  } catch (error) {
    if (!(error && typeof error === 'object' && 'code' in error && error.code === 11000)) {
      throw error;
    }
  }

  player = await players.findOne({ _id: userId });
  return player;
}
