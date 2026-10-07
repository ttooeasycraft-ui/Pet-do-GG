interface BattleCard {
  damage: number;
  hp: number;
}

interface BattleTotals {
  damage: number;
  hp: number;
}

declare const battleTools: {
  getTeamTotals(deck: BattleCard[]): BattleTotals;
  simulateBattle(
    deckA: BattleCard[],
    deckB: BattleCard[],
    options?: { maxRounds?: number },
  ): {
    winner: 'A' | 'B' | 'empate';
    rounds: number;
    remainingHp: { A: number; B: number };
    totals: { A: BattleTotals; B: BattleTotals };
    reachedRoundLimit: boolean;
  };
};

export default battleTools;
