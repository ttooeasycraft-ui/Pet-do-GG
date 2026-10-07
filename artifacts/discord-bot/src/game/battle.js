function getTeamTotals(deck) {
  return deck.reduce((totals, card) => ({
    damage: totals.damage + Math.max(0, Number(card.damage) || 0),
    hp: totals.hp + Math.max(0, Number(card.hp) || 0),
  }), { damage: 0, hp: 0 });
}

function simulateBattle(deckA, deckB, options = {}) {
  if (!Array.isArray(deckA) || !Array.isArray(deckB) || !deckA.length || !deckB.length) {
    throw new TypeError('Cada lado precisa ter pelo menos uma carta no deck.');
  }

  const maxRounds = Math.max(1, Math.floor(options.maxRounds ?? 1000));
  const teamA = getTeamTotals(deckA);
  const teamB = getTeamTotals(deckB);
  let hpA = teamA.hp;
  let hpB = teamB.hp;
  let rounds = 0;

  while (hpA > 0 && hpB > 0 && rounds < maxRounds) {
    rounds++;
    const damageToA = teamB.damage;
    const damageToB = teamA.damage;

    // Os dois lados atacam na mesma rodada, antes de aplicar os danos.
    hpA -= damageToA;
    hpB -= damageToB;
  }

  const winner = hpA === hpB ? 'empate' : hpA > hpB ? 'A' : 'B';
  return {
    winner,
    rounds,
    remainingHp: { A: Math.max(0, hpA), B: Math.max(0, hpB) },
    totals: { A: teamA, B: teamB },
    reachedRoundLimit: rounds === maxRounds && hpA > 0 && hpB > 0,
  };
}

module.exports = { simulateBattle, getTeamTotals };
