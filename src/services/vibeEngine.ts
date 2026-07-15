import { InstrumentType, InstrumentState, SessionParameters } from '../types';

export interface VibeVector {
  looseness: number;   // 0–1: timing drift & groove interaction
  swagger: number;     // -1 (behind) .. +1 (ahead) global bias
  density: number;     // 0–1: overall note density (low → sparse)
  grit: number;        // 0–1: velocity variance & accent punch
  space: number;       // 0–1: breathing room (inverse of density, but with noise)
}

/* ──── Deterministic PRNG (LCG) ──── */
function createSeededRng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

/**
 * Derives a fully coherent vibe vector from a single integer seed.
 * The vector is deterministic and consistent across calls.
 */
export function deriveVibeVector(seed: number): VibeVector {
  const rng = createSeededRng(seed);

  const looseness = rng();
  const swagger = rng() * 2 - 1;            // -1..+1
  const densityBase = 0.2 + rng() * 0.6;    // 0.2–0.8

  return {
    looseness,
    swagger,
    density: densityBase,
    // Grit is correlated with looseness but also has independent randomness
    grit: Math.min(1, Math.max(0, looseness * 0.5 + rng() * 0.6)),
    // Space is anti‑correlated with density, but with some noise to avoid mechanical inverse
    space: Math.min(1, Math.max(0, 1 - densityBase + (rng() * 0.2 - 0.1))),
  };
}

/**
 * Applies a VibeVector to a full set of instrument states.
 * Returns a new object (immutable update).
 */
export function applyVibe(
  states: Record<InstrumentType, InstrumentState>,
  vibe: VibeVector
): Record<InstrumentType, InstrumentState> {
  // Deep‑clone to avoid mutation
  const next: Record<InstrumentType, InstrumentState> = JSON.parse(JSON.stringify(states));

  for (const inst of Object.keys(next) as InstrumentType[]) {
    const state = next[inst];
    if (!state?.params) continue;
    const p = state.params;

    // ── 1. Global pocket (push / pull) ──
    // Center at 50, shift by swagger * 25 (range ~25–75)
    p.pocket = clamp(50 + vibe.swagger * 25, 0, 100);

    // ── 2. Groove (swing amount) ──
    // Blend between straight (low) and heavy swing (high) using looseness
    const grooveTarget = Math.round(vibe.looseness * 80 + 10);   // 10–90
    p.groove = clamp(grooveTarget, 0, 100);

    // ── 3. Humanize (micro‑timing variance) ──
    // Looseness drives humanization, but we keep some of the original flavour
    const humanBase = 25 + vibe.looseness * 50;                  // 25–75
    p.humanize = clamp((p.humanize + humanBase) / 2, 0, 100);    // smooth mix

    // ── 4. Density & Space → sparseness ──
    // Higher density → lower sparseness (more notes)
    // Higher space → higher sparseness (more breathing room)
    const densityFactor = 1 - vibe.density;          // 1.0 → 0.2
    const spaceFactor = 0.5 + vibe.space * 0.5;      // 0.5 → 1.0
    const targetSparse = Math.round(100 * densityFactor * spaceFactor);
    p.sparseness = clamp(targetSparse, 10, 95);

    // ── 5. Grit → velocity floor/ceiling & accent aggression ──
    // High grit increases lower velocity floor (harder hits) and narrows dynamic range
    const velFloor = Math.round(20 + vibe.grit * 50);           // 20–70
    const velCeil = Math.round(90 - vibe.grit * 20);            // 90–70
    // These go onto the instrument params if they exist; SessionParameters might not have them,
    // so we attach them as optional extended props (cast to any).
    (p as any).velocityFloor = velFloor;
    (p as any).velocityCeiling = velCeil;
    (p as any).accentAggression = vibe.grit * 0.8;

    // ── 6. Per‑drum micro‑timing (if present) ──
    if (p.perDrumPocket) {
      // Shift each piece's pocket by a fraction of the global swagger
      const drift = vibe.swagger * 15;
      for (const key of Object.keys(p.perDrumPocket)) {
        p.perDrumPocket[key] = clamp((p.perDrumPocket[key] ?? 50) + drift, 0, 100);
      }
    }
    if (p.perDrumSwing) {
      const swingShift = vibe.looseness * 10 - 5; // -5..+5 around center
      for (const key of Object.keys(p.perDrumSwing)) {
        p.perDrumSwing[key] = clamp((p.perDrumSwing[key] ?? 50) + swingShift, 0, 100);
      }
    }
  }

  return next;
}

/** Clamp utility */
function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

/* ──── Pre‑named presets ──── */
export const VIBE_PRESETS: Record<string, number> = {
  'Purdie Pocket': 42,
  'Uptown Push': 108,
  'Sunday Morning': 7,
  'LA Studio Tight': 333,
  'Cosmic Drift': 999,
};
