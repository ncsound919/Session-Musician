export interface SeededRng {
  next(): number;
  pick<T>(options: T[]): T;
}

// Simple deterministic LCG (Linear Congruential Generator)
export function createSeededRng(seed: number): SeededRng {
  let state = seed;
  
  return {
    // Returns a float between 0 and 1
    next: () => {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 4294967296;
    },
    // Picks a random element from an array
    pick: <T>(options: T[]): T => {
      if (options.length === 0) throw new Error("Cannot pick from an empty array");
      state = (state * 1664525 + 1013904223) >>> 0;
      const index = Math.floor((state / 4294967296) * options.length);
      return options[index];
    }
  };
}
