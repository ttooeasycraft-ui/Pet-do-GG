export type CardRarity = 'comum' | 'rara' | 'ultra';
export type CardRole = 'dano' | 'dps' | 'suporte' | 'veneno';

export interface CardDefinition {
  id: string;
  name: string;
  rarity: CardRarity;
  role: CardRole;
  damage: number;
  hp: number;
  description: string;
}

export const CARD_POOL: readonly CardDefinition[] = [
  { id: 'recruta_arcano', name: 'Recruta Arcano', rarity: 'comum', role: 'dano', damage: 12, hp: 90, description: 'Dano direto e equilibrado.' },
  { id: 'curandeira_jade', name: 'Curandeira de Jade', rarity: 'comum', role: 'suporte', damage: 7, hp: 115, description: 'Recupera a carta aliada mais ferida.' },
  { id: 'falcao_veloz', name: 'Falcão Veloz', rarity: 'comum', role: 'dps', damage: 15, hp: 75, description: 'Ataca com velocidade e força.' },
  { id: 'aranha_nevoa', name: 'Aranha da Névoa', rarity: 'comum', role: 'veneno', damage: 10, hp: 100, description: 'Envenena o alvo por vários turnos.' },
  { id: 'cavaleiro_rubro', name: 'Cavaleiro Rubro', rarity: 'rara', role: 'dano', damage: 24, hp: 130, description: 'Golpes fortes com boa resistência.' },
  { id: 'oraculo_azul', name: 'Oráculo Azul', rarity: 'rara', role: 'suporte', damage: 15, hp: 175, description: 'Sustenta a equipe com cura.' },
  { id: 'atiradora_cometa', name: 'Atiradora Cometa', rarity: 'rara', role: 'dps', damage: 29, hp: 105, description: 'Dano contínuo de alta velocidade.' },
  { id: 'serpente_umbra', name: 'Serpente Umbra', rarity: 'rara', role: 'veneno', damage: 21, hp: 145, description: 'Aplica veneno e desgasta o inimigo.' },
  { id: 'dragao_celeste', name: 'Dragão Celeste', rarity: 'ultra', role: 'dano', damage: 43, hp: 220, description: 'Ataques poderosos e muita vida.' },
  { id: 'sacerdotisa_estelar', name: 'Sacerdotisa Estelar', rarity: 'ultra', role: 'suporte', damage: 27, hp: 275, description: 'Grande suporte para toda a equipe.' },
  { id: 'fenda_rasante', name: 'Fenda Rasante', rarity: 'ultra', role: 'dps', damage: 52, hp: 180, description: 'Dano explosivo em sequência.' },
  { id: 'hidra_corrosiva', name: 'Hidra Corrosiva', rarity: 'ultra', role: 'veneno', damage: 38, hp: 245, description: 'Veneno intenso que continua causando dano.' },
];

export const DAILY_COINS_BY_RARITY: Record<CardRarity, number> = {
  comum: 1,
  rara: 3,
  ultra: 10,
};

export const RARITY_LABELS: Record<CardRarity, string> = {
  comum: 'Comum',
  rara: 'Rara',
  ultra: 'Ultra',
};

export const ROLE_LABELS: Record<CardRole, string> = {
  dano: 'Dano',
  dps: 'DPS',
  suporte: 'Suporte',
  veneno: 'Envenenamento',
};

export const RARITY_EMOJI: Record<CardRarity, string> = {
  comum: '⚪',
  rara: '🔵',
  ultra: '🟣',
};

export function drawCard(): CardDefinition {
  const roll = Math.random();
  const rarity: CardRarity = roll < 0.6 ? 'comum' : roll < 0.9 ? 'rara' : 'ultra';
  const pool = CARD_POOL.filter((card) => card.rarity === rarity);
  return pool[Math.floor(Math.random() * pool.length)];
}

export function findCard(cardId: string): CardDefinition | undefined {
  return CARD_POOL.find((card) => card.id === cardId);
}
