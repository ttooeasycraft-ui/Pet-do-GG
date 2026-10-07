const CARDS = Object.freeze([
  Object.freeze({
    id: 'recruta_arcano',
    name: 'Recruta Arcano',
    role: 'dano',
    rarity: 'comum',
    damageBase: 12,
    hpBase: 90,
  }),
  Object.freeze({
    id: 'curandeira_jade',
    name: 'Curandeira de Jade',
    role: 'suporte',
    rarity: 'comum',
    damageBase: 7,
    hpBase: 115,
  }),
  Object.freeze({
    id: 'falcao_veloz',
    name: 'Falcão Veloz',
    role: 'dps',
    rarity: 'comum',
    damageBase: 15,
    hpBase: 75,
  }),
  Object.freeze({
    id: 'aranha_nevoa',
    name: 'Aranha da Névoa',
    role: 'veneno',
    rarity: 'comum',
    damageBase: 10,
    hpBase: 100,
  }),
  Object.freeze({
    id: 'cavaleiro_rubro',
    name: 'Cavaleiro Rubro',
    role: 'dano',
    rarity: 'rara',
    damageBase: 24,
    hpBase: 130,
  }),
  Object.freeze({
    id: 'oraculo_azul',
    name: 'Oráculo Azul',
    role: 'suporte',
    rarity: 'rara',
    damageBase: 15,
    hpBase: 175,
  }),
  Object.freeze({
    id: 'atiradora_cometa',
    name: 'Atiradora Cometa',
    role: 'dps',
    rarity: 'rara',
    damageBase: 29,
    hpBase: 105,
  }),
  Object.freeze({
    id: 'serpente_umbra',
    name: 'Serpente Umbra',
    role: 'veneno',
    rarity: 'rara',
    damageBase: 21,
    hpBase: 145,
  }),
  Object.freeze({
    id: 'dragao_celeste',
    name: 'Dragão Celeste',
    role: 'dano',
    rarity: 'ultra',
    damageBase: 43,
    hpBase: 220,
  }),
  Object.freeze({
    id: 'sacerdotisa_estelar',
    name: 'Sacerdotisa Estelar',
    role: 'suporte',
    rarity: 'ultra',
    damageBase: 27,
    hpBase: 275,
  }),
  Object.freeze({
    id: 'fenda_rasante',
    name: 'Fenda Rasante',
    role: 'dps',
    rarity: 'ultra',
    damageBase: 52,
    hpBase: 180,
  }),
  Object.freeze({
    id: 'hidra_corrosiva',
    name: 'Hidra Corrosiva',
    role: 'veneno',
    rarity: 'ultra',
    damageBase: 38,
    hpBase: 245,
  }),
]);

const CARDS_BY_ID = new Map(CARDS.map((card) => [card.id, card]));

function findCard(cardId) {
  return CARDS_BY_ID.get(cardId);
}

module.exports = { CARDS, CARDS_BY_ID, findCard };
