export type CardRarity = 'comum' | 'rara' | 'ultra' | 'lendaria';
export type CardRole = 'dano' | 'dps' | 'suporte' | 'veneno' | 'tanque';

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
  { id: 'guarda_cobre', name: 'Guarda de Cobre', rarity: 'comum', role: 'tanque', damage: 8, hp: 115, description: 'Protege a linha de frente.' },
  { id: 'arqueira_vento', name: 'Arqueira do Vento', rarity: 'comum', role: 'dps', damage: 17, hp: 72, description: 'Ataca com precisão.' },
  { id: 'curandeira_lua', name: 'Curandeira da Lua', rarity: 'comum', role: 'suporte', damage: 9, hp: 90, description: 'Recupera aliados durante o duelo.' },
  { id: 'aprendiz_fogo', name: 'Aprendiz de Fogo', rarity: 'comum', role: 'dano', damage: 14, hp: 78, description: 'Dano direto e confiável.' },
  { id: 'alquimista_verde', name: 'Alquimista Verde', rarity: 'comum', role: 'veneno', damage: 11, hp: 84, description: 'Aplica dano contínuo.' },
  { id: 'lobo_neve', name: 'Lobo da Neve', rarity: 'comum', role: 'dps', damage: 15, hp: 82, description: 'Caça o alvo mais vulnerável.' },
  { id: 'monge_pedra', name: 'Monge de Pedra', rarity: 'comum', role: 'tanque', damage: 10, hp: 108, description: 'Resiste a ataques pesados.' },
  { id: 'barda_estelar', name: 'Barda Estelar', rarity: 'comum', role: 'suporte', damage: 8, hp: 96, description: 'Fortalece a equipe.' },
  { id: 'feiticeira_breu', name: 'Feiticeira do Breu', rarity: 'rara', role: 'veneno', damage: 19, hp: 105, description: 'Envenena e desgasta o oponente.' },
  { id: 'cavaleiro_azul', name: 'Cavaleiro Azul', rarity: 'rara', role: 'tanque', damage: 15, hp: 150, description: 'Defesa reforçada.' },
  { id: 'medica_fenix', name: 'Médica Fênix', rarity: 'rara', role: 'suporte', damage: 13, hp: 128, description: 'Mantém a equipe de pé.' },
  { id: 'atirador_cometa', name: 'Atirador Cometa', rarity: 'rara', role: 'dps', damage: 27, hp: 95, description: 'Dano rápido de longa distância.' },
  { id: 'duelista_rubi', name: 'Duelista Rubi', rarity: 'rara', role: 'dano', damage: 24, hp: 112, description: 'Especialista em dano direto.' },
  { id: 'guardia_abismo', name: 'Guardiã do Abismo', rarity: 'rara', role: 'tanque', damage: 18, hp: 142, description: 'Absorve parte do dano recebido.' },
  { id: 'dragao_tempestade', name: 'Dragão da Tempestade', rarity: 'ultra', role: 'dps', damage: 38, hp: 145, description: 'Explode em ataques de alta potência.' },
  { id: 'oraculo_aurora', name: 'Oráculo da Aurora', rarity: 'ultra', role: 'suporte', damage: 23, hp: 175, description: 'Cura o aliado mais ferido.' },
  { id: 'serpente_veneno', name: 'Serpente Venenosa', rarity: 'ultra', role: 'veneno', damage: 31, hp: 155, description: 'Seu veneno continua após o ataque.' },
  { id: 'colosso_obsidiana', name: 'Colosso de Obsidiana', rarity: 'ultra', role: 'tanque', damage: 29, hp: 220, description: 'Uma muralha difícil de derrubar.' },
  { id: 'rainha_eclipse', name: 'Rainha do Eclipse', rarity: 'lendaria', role: 'dano', damage: 48, hp: 220, description: 'Comanda a batalha com dano massivo.' },
  { id: 'falcao_celeste', name: 'Falcão Celeste', rarity: 'lendaria', role: 'dps', damage: 58, hp: 175, description: 'Ataca primeiro e atinge com força.' },
  { id: 'arvore_mundo', name: 'Árvore do Mundo', rarity: 'lendaria', role: 'suporte', damage: 34, hp: 280, description: 'Sustenta toda a equipe.' },
  { id: 'hidra_eterna', name: 'Hidra Eterna', rarity: 'lendaria', role: 'veneno', damage: 45, hp: 235, description: 'Cada turno fortalece o veneno.' },
];

export const DAILY_COINS_BY_RARITY: Record<CardRarity, number> = {
  comum: 1,
  rara: 3,
  ultra: 10,
  lendaria: 20,
};

export const RARITY_LABELS: Record<CardRarity, string> = {
  comum: 'Comum',
  rara: 'Rara',
  ultra: 'Ultra',
  lendaria: 'Lendária',
};

export const ROLE_LABELS: Record<CardRole, string> = {
  dano: 'Dano',
  dps: 'DPS',
  suporte: 'Suporte',
  veneno: 'Envenenamento',
  tanque: 'Tanque',
};

export const RARITY_EMOJI: Record<CardRarity, string> = {
  comum: '⚪',
  rara: '🔵',
  ultra: '🟣',
  lendaria: '🟡',
};

export function drawCard(): CardDefinition {
  const roll = Math.random() * 100;
  const rarity: CardRarity =
    roll < 55 ? 'comum' :
    roll < 85 ? 'rara' :
    roll < 97 ? 'ultra' : 'lendaria';
  const pool = CARD_POOL.filter((card) => card.rarity === rarity);
  return pool[Math.floor(Math.random() * pool.length)];
}

export function findCard(cardId: string): CardDefinition | undefined {
  return CARD_POOL.find((card) => card.id === cardId);
}
