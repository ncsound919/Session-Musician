import { Chord, SessionParameters } from '../types';

export interface DrumMidiEvent {
  time: number;
  note: number;
  velocity: number;
  duration: number;
}

/* GM Drum Map */
const DRUM_MAP = {
  kick: 36,
  snare: 38,
  closedHH: 42,
  openHH: 46,
  lowTom: 45,
  midTom: 48,
  highTom: 50,
  crash: 49,
  ride: 51,
} as const;

/* ──── Deterministic PRNG (optional, for reproducibility) ──── */
function createRng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

/** Clamp a number between min and max */
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

// FIXED: reads perDrumPocket/perDrumSwing keys case-insensitively, since
// these objects are constructed elsewhere with capitalized keys
// (Kick/Snare/HiHat) but were being looked up here with lowercase keys
// (kick/snare/hihat) — a mismatch that silently defaulted every lookup to
// 50, making the entire per-drum micro-timing feature a no-op.
function getPerDrumValue(
  map: Record<string, number> | undefined,
  drum: 'kick' | 'snare' | 'hihat',
  fallback: number
): number {
  if (!map) return fallback;
  const aliases: Record<'kick' | 'snare' | 'hihat', string[]> = {
    kick: ['kick', 'Kick'],
    snare: ['snare', 'Snare'],
    hihat: ['hihat', 'Hihat', 'HiHat'],
  };
  for (const key of aliases[drum]) {
    if (typeof map[key] === 'number') return map[key];
  }
  return fallback;
}

/**
 * Generate a complete drum track from chord progression and session parameters.
 *
 * The logic:
 * - Quantise to 16th‑note grid (with swing applied on off‑beats).
 * - Base pattern: kick on 1 & 3, snare on 2 & 4, closed hi‑hat on 8ths.
 * - `groove` / `perDrumSwing` → shifts the timing of specific drums (swing feel).
 * - `pocket` / `perDrumPocket` → macro timing offset (early/late).
 * - `humanize` → random timing jitter per hit.
 * - `sparseness` → drops random notes (higher → fewer notes).
 * - `grit` → adds ghost snare notes and velocity variance.
 * - Chord changes → fill probability increases near section boundaries.
 */
export function generateImprovedDrums(
  chords: Chord[],
  params: SessionParameters
): DrumMidiEvent[] {
  // Seeded RNG for consistency within a session (use a deterministic seed if available)
  const rng = createRng((params as any).seed ?? Date.now());

  const bpm = (params as any).bpm ?? 120;
  const beatDuration = 60 / bpm; // seconds per beat
  const totalBeats = chords.reduce((sum, c) => sum + c.duration, 0);
  const subdivisions = 4; // 16th note per beat

  const events: DrumMidiEvent[] = [];

  // Global timing modifiers
  const globalPocket = params.pocket ?? 50; // 0=early, 100=laid back
  const pocketShift = (globalPocket - 50) / 50 * 0.03; // shift in seconds (±0.03)

  const globalGroove = params.groove ?? 50;
  const humanize = clamp(params.humanize ?? 40, 0, 100) / 100; // 0-1
  const sparseness = clamp(params.sparseness ?? 50, 0, 100) / 100; // 0-1 (0=full, 1=empty)
  const grit = clamp((params as any).grit ?? 0.5, 0, 1);

  // Per‑drum micro‑timing overrides (from PocketLab)
  const drumPocket = params.perDrumPocket;
  const drumSwing = params.perDrumSwing;

  // Helper to apply timing modifiers
  const getDrumTiming = (baseTime: number, drum: 'kick' | 'snare' | 'hihat', isOffbeat: boolean) => {
    // 1. Pocket shift (early/late) based on per-drum pocket
    const pocket = getPerDrumValue(drumPocket, drum, 50);
    const pocketOffset = ((pocket - 50) / 50) * 0.03;

    // 2. Swing on offbeat 16ths: delay by a fraction based on drum swing
    const swing = getPerDrumValue(drumSwing, drum, 50);
    const swingAmount = (swing - 50) / 100 * 0.15; // max 0.15s shift (hard swing)
    const swingOffset = isOffbeat ? swingAmount : 0;

    // 3. Random humanization
    // FIXED: uses the seeded rng() instead of Math.random() so identical
    // params.seed values reproduce identical timing, as the RNG's own
    // "deterministic, for reproducibility" comment promises.
    const humanOffset = (rng() - 0.5) * humanize * 0.03;

    return baseTime + pocketOffset + swingOffset + humanOffset + pocketShift;
  };

  // Build per‑beat chord grid for fill detection
  let cumulativeBeats = 0;
  const chordBoundaries: number[] = [];
  chords.forEach((chord) => {
    chordBoundaries.push(cumulativeBeats);
    cumulativeBeats += chord.duration;
  });
  // The last boundary is the total length; we'll mark the last two beats as "fill zone"

  // FIXED: step via an integer counter and derive `beat` by division rather
  // than accumulating via repeated floating-point addition. The old
  // `beat += 1 / subdivisions` pattern compounds rounding error over many
  // iterations, which on longer tracks eventually pushes true downbeats
  // outside the `< 0.001` detection tolerance and silently drops hits.
  const totalSteps = Math.ceil(totalBeats * subdivisions);

  for (let step = 0; step < totalSteps; step++) {
    const beat = step / subdivisions;
    const subPos = step % subdivisions; // 0-3
    const beatFraction = beat - Math.floor(beat);
    const isDownbeat = subPos === 0;
    const isOffbeat = subPos % 2 === 1; // 16th note offbeat

    // Probability of dropping a hit based on sparseness
    if (rng() < sparseness * 0.8) continue;

    const baseTime = beat * beatDuration;

    // ─── Kick pattern ───
    if (isDownbeat && (Math.floor(beat) % 4 === 0 || Math.floor(beat) % 4 === 2)) {
      // Kick on 1 and 3 (4/4)
      events.push(createNoteOn(DRUM_MAP.kick, getDrumTiming(baseTime, 'kick', false), 90 + Math.round(grit * 20), beatDuration * 0.15));
    }

    // ─── Snare pattern ───
    if (isDownbeat && (Math.floor(beat) % 4 === 1 || Math.floor(beat) % 4 === 3)) {
      // Main snare on 2 and 4
      const vel = 80 + Math.round(grit * 30);
      events.push(createNoteOn(DRUM_MAP.snare, getDrumTiming(baseTime, 'snare', false), vel, beatDuration * 0.12));
    } else if (isOffbeat && rng() < grit * 0.5 && beatFraction > 0.4) {
      // Ghost note: soft snare on offbeat 16ths
      events.push(createNoteOn(DRUM_MAP.snare, getDrumTiming(baseTime, 'snare', true), 25 + Math.round(grit * 25), beatDuration * 0.08));
    }

    // ─── Hi‑Hat pattern ───
    if (subPos % 2 === 0) {
      // 8th note hi-hat: open/closed variation
      const useOpen = rng() < (params.groove ?? 50) / 200; // higher groove → more open hi‑hat
      const note = useOpen ? DRUM_MAP.openHH : DRUM_MAP.closedHH;
      events.push(createNoteOn(note, getDrumTiming(baseTime, 'hihat', false), 60 + Math.round(grit * 20), beatDuration * 0.08));
    } else if (subPos % 2 === 1 && rng() < 0.3) {
      // Occasional 16th note hi-hat (complex pattern)
      events.push(createNoteOn(DRUM_MAP.closedHH, getDrumTiming(baseTime, 'hihat', true), 40 + Math.round(grit * 15), beatDuration * 0.05));
    }

    // ─── Toms (fill near section endings) ───
    const fillZone = isNearSectionEnd(beat, totalBeats, chordBoundaries, 4);
    if (fillZone && rng() < 0.4) {
      const tom = subPos < 2 ? DRUM_MAP.lowTom : (subPos === 2 ? DRUM_MAP.midTom : DRUM_MAP.highTom);
      events.push(createNoteOn(tom, getDrumTiming(baseTime, 'snare', false), 70 + Math.round(grit * 20), beatDuration * 0.1));
    }

    // ─── Crash / Ride accents ───
    if (isDownbeat && (Math.floor(beat) === 0 || rng() < 0.1)) {
      events.push(createNoteOn(DRUM_MAP.crash, getDrumTiming(baseTime, 'kick', false), 80, beatDuration * 0.3));
    }
  }

  return events;
}

/* ─── Utility ─── */

function createNoteOn(note: number, time: number, velocity: number, duration: number): DrumMidiEvent {
  return {
    time,        // seconds
    note,        // MIDI note number
    velocity,    // 0-127
    duration,    // seconds
  };
}

/**
 * Determine if the current beat is in a fill‑friendly zone
 * (last bar of a section or within 2 beats of a chord change).
 */
function isNearSectionEnd(
  currentBeat: number,
  totalBeats: number,
  boundaries: number[],
  beatsPerBar: number = 4
): boolean {
  const beatInBar = currentBeat % beatsPerBar;
  if (beatInBar >= beatsPerBar - 2) return true; // last two beats of bar

  // Check if next chord change is within 2 beats
  const nextBoundary = boundaries.find(b => b > currentBeat + 0.001);
  if (nextBoundary && nextBoundary - currentBeat < 2) return true;

  // Near end of whole progression
  if (totalBeats - currentBeat < 4) return true;

  return false;
}