export interface Card {
  /** 2–10 number cards, 11 = J, 12 = Q, 13 = K, 14 = A */
  rank: number;
  /** 0 = Hearts, 1 = Diamonds, 2 = Clubs, 3 = Spades */
  suit: number;
}

export function numberToCard(num: number): Card {
  // Given an index num - between [0, 51], converts that to a determinist card representation
  // Returns (rank, suit) where:
  // rank: 2 - 10 , 11 = J, 12= Q, 13 = K, 14 = A
  // suit: 0=Hearts, 1=Diamonds, 2=Clubs, 3=Spades
  if (!Number.isInteger(num) || num < 0 || num > 51) {
    throw new RangeError(`numberToCard: expected an integer in [0, 51], got ${num}`);
  }

  const suit = Math.floor(num / 13);
  const rank = (num % 13) + 2;

  return { rank, suit };
}
