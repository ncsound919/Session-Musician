/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Chord, SongSection, InstrumentState, InstrumentType, SessionParameters } from '../types';

// ──── Type Definitions ────

export type TheoryFixType =
  | 'diatonic_snap'
  | 'smooth_voice_leading'
  | 'dominant_resolution_cadence'
  | 'resolve_tonic_start'
  | 'symmetry_pad'
  | 'apply_performance_profile'
  | 'normalize_humanize'
  | 'reduce_groove'
  | 'normalize_pocket'
  | 'bass_diatonic_correct'
  | 'stabilize_bass_pocket'
  | 'open_keyboard_sparseness'
  | 'deconflict_midrange'
  | 'relax_pads'
  | 'relax_lead'
  | 'inject_syncopated_pocket'
  | 'unify_groove_grid'
  | 'harmonic_syncopation_shift'
  | 'sophistication_apply';

export interface CritiqueIssue {
  id: string;
  category: 'harmony' | 'rhythm' | 'melody' | 'dynamics' | 'arrangement';
  severity: 'info' | 'warning' | 'error';
  title: string;
  description: string;
  suggestion: string;
  canFix: boolean;
  fixType: TheoryFixType;
  metadata?: Record<string, any>;
}

// ──── Musical Constants ────

export const NOTE_MAP: Record<string, number> = {
  'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'F': 5,
  'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11
};

export const SEMITONE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export const SCALE_INTERVALS = {
  Major: [0, 2, 4, 5, 7, 9, 11],
  Minor: [0, 2, 3, 5, 7, 8, 10]
};

// ──── Deterministic PRNG helpers ────
// A seeded generator ensures identical inputs always produce identical
// progressions, consistent with this engine's deterministic design goal.

function hashStringToInt(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash >>> 0;
}

function createSeededRandom(seed: number): () => number {
  let t = seed >>> 0;
  return function seededRandom() {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

// ──── Chord Utilities ────

export function getChordNotes(root: string, type: string): number[] {
  const rootPitch = NOTE_MAP[root] ?? 0;
  let semitones = [0, 4, 7]; // default major
  
  if (type === 'min') semitones = [0, 3, 7];
  else if (type === '7') semitones = [0, 4, 7, 10];
  else if (type === 'maj7') semitones = [0, 4, 7, 11];
  else if (type === 'min7') semitones = [0, 3, 7, 10];
  else if (type === 'dim') semitones = [0, 3, 6];
  else if (type === 'dim7') semitones = [0, 3, 6, 9];
  else if (type === 'aug') semitones = [0, 4, 8];
  else if (type === 'sus4') semitones = [0, 5, 7];
  else if (type === '9') semitones = [0, 4, 7, 10, 14];
  else if (type === 'maj9') semitones = [0, 4, 7, 11, 14];
  else if (type === 'min9') semitones = [0, 3, 7, 10, 14];
  else if (type === '13') semitones = [0, 4, 7, 10, 14, 21];
  else if (type === 'min11') semitones = [0, 3, 7, 10, 14, 17];
  else if (type === '7alt') semitones = [0, 4, 8, 10, 15]; // R, 3, #5, b7, #9


  return semitones.map(s => (rootPitch + s) % 12);
}

export function getChordVoicingWithInversion(
  root: string,
  type: string,
  inversion: number,
  voicingStyle: string = 'Open'
): number[] {
  const rootMIDI = (NOTE_MAP[root] ?? 0) + 60;
  let semitones: number[];

  if (voicingStyle === 'Quartal') {
    // Quartal voicing uses a stack of perfect fourths.
    // To keep some relation to the chord type we use the root and the first few chord tones,
    // but the primary characteristic is the interval of a fourth (5 semitones).
    semitones = [0, 5, 10, 15];
    // FIXED: minor third is 3 semitones, not 4 (4 is a major third).
    if (type.includes('min')) semitones[1] = 3; // minor third instead of fourth
    else if (type.includes('dim') || type.includes('aug')) semitones[1] = 6; // diminished fifth
    // Note: This is a rudimentary adaptation. True quartal harmony would ignore traditional chord types.
  } else if (voicingStyle === 'Closed') {
    if (type === 'min7') semitones = [3, 7, 10];
    else if (type === 'maj7') semitones = [4, 7, 11];
    else if (type === 'min') semitones = [3, 7];
    else if (type === '7') semitones = [4, 10];
    // FIXED: these chord types previously fell through to a plain major
    // triad, losing their defining intervals.
    else if (type === '9') semitones = [4, 10, 14];
    else if (type === 'dim') semitones = [3, 6];
    else if (type === 'aug') semitones = [4, 8];
    else if (type === 'sus4') semitones = [5, 7];
    else semitones = [4, 7];
  } else {
    // Standard / Open voicing
    if (type === 'min7') semitones = [3, 7, 10, 14];
    else if (type === 'maj7') semitones = [4, 7, 11, 14];
    else if (type === 'min') semitones = [3, 7, 12];
    else if (type === '7') semitones = [4, 7, 10, 14];
    else if (type === '9') semitones = [4, 10, 14, 16, 21];
    else if (type === 'dim') semitones = [3, 6, 12];
    else if (type === 'aug') semitones = [4, 8, 12];
    else if (type === 'sus4') semitones = [5, 7, 12];
    else semitones = [4, 7, 12]; // maj
  }

  let voicing = semitones.map(s => rootMIDI + s);
  
  if (voicingStyle === 'Open' && voicing.length > 2) {
    voicing[1] += 12; // Drop-2 style spread
  }
  
  // Shift to comfortable keyboard range
  const meanPitch = voicing.reduce((sum, n) => sum + n, 0) / voicing.length;
  const octaveShift = Math.round((64 - meanPitch) / 12) * 12;
  voicing = voicing.map(n => n + octaveShift);

  const k = voicing.length;
  const actualInv = ((inversion % k) + k) % k;
  
  // Inversions: shift lower notes up an octave
  for (let i = 0; i < actualInv; i++) {
    voicing[i] += 12;
  }
  voicing.sort((a, b) => a - b);
  
  return voicing;
}

export function transposeChord(chord: Chord, semitones: number): Chord {
  const currentPitch = NOTE_MAP[chord.root] ?? 0;
  const newPitch = (currentPitch + semitones + 120) % 12;
  return { ...chord, root: SEMITONE_NAMES[newPitch] };
}

export function getVoiceLeadingDistance(voicingA: number[], voicingB: number[]): number {
  let dist = 0;
  const len = Math.min(voicingA.length, voicingB.length);
  for (let i = 0; i < len; i++) {
    dist += Math.abs(voicingA[i] - voicingB[i]);
  }
  dist += Math.abs(voicingA.length - voicingB.length) * 4;
  return dist;
}

export function getVoiceLeadingCost(voicingA: number[], voicingB: number[]): number {
  let cost = 0;
  const len = Math.min(voicingA.length, voicingB.length);
  for (let i = 0; i < len; i++) {
    cost += Math.pow(voicingA[i] - voicingB[i], 2);
  }
  cost += Math.abs(voicingA.length - voicingB.length) * 16; // Higher penalty for voicing length changes
  return cost;
}

// Optimized voice leading now accepts an optional voicing style.
export function optimizeVoiceLeading(
  chords: Chord[],
  allowedInversions?: number[],
  voicingStyle: string = 'Open'
): number[] {
  const N = chords.length;
  if (N <= 1) return chords.map(() => allowedInversions?.[0] ?? 0);

  const getCandidateInversions = (c: Chord) => {
    if (allowedInversions?.length) return allowedInversions;
    if (c.type === '7' || c.type === '9' || c.type === 'min7' || c.type === 'maj7') return [0, 1, 2, 3];
    return [0, 1, 2];
  };

  const candidateInversions = chords.map(c => getCandidateInversions(c));

  const dp: number[][][] = [];
  const backpointer: number[][][] = [];

  for (let i = 0; i < N; i++) {
    dp.push(Array(candidateInversions[i].length).fill(0).map(() => Array(candidateInversions[0].length).fill(Infinity)));
    backpointer.push(Array(candidateInversions[i].length).fill(0).map(() => Array(candidateInversions[0].length).fill(-1)));
  }

  // Base: i = 0
  for (let inv0Idx = 0; inv0Idx < candidateInversions[0].length; inv0Idx++) {
    dp[0][inv0Idx][inv0Idx] = 0;
  }

  for (let i = 1; i < N; i++) {
    for (let invIdx = 0; invIdx < candidateInversions[i].length; invIdx++) {
      const inv = candidateInversions[i][invIdx];
      const vCurr = getChordVoicingWithInversion(chords[i].root, chords[i].type, inv, voicingStyle);
      for (let prevInvIdx = 0; prevInvIdx < candidateInversions[i - 1].length; prevInvIdx++) {
        const prevInv = candidateInversions[i - 1][prevInvIdx];
        const vPrev = getChordVoicingWithInversion(chords[i - 1].root, chords[i - 1].type, prevInv, voicingStyle);
        const cost = getVoiceLeadingCost(vPrev, vCurr);
        
        for (let inv0Idx = 0; inv0Idx < candidateInversions[0].length; inv0Idx++) {
          const totalCost = dp[i - 1][prevInvIdx][inv0Idx] + cost;
          if (totalCost < dp[i][invIdx][inv0Idx]) {
            dp[i][invIdx][inv0Idx] = totalCost;
            backpointer[i][invIdx][inv0Idx] = prevInvIdx;
          }
        }
      }
    }
  }

  // Closing the loop
  let minTotalDist = Infinity;
  let bestInvNMinus1Idx = 0;
  let bestInv0Idx = 0;

  for (let invNIdx = 0; invNIdx < candidateInversions[N - 1].length; invNIdx++) {
    const invN = candidateInversions[N - 1][invNIdx];
    const vLast = getChordVoicingWithInversion(chords[N - 1].root, chords[N - 1].type, invN, voicingStyle);
    for (let inv0Idx = 0; inv0Idx < candidateInversions[0].length; inv0Idx++) {
      const inv0 = candidateInversions[0][inv0Idx];
      const vFirst = getChordVoicingWithInversion(chords[0].root, chords[0].type, inv0, voicingStyle);
      const wrapCost = getVoiceLeadingCost(vLast, vFirst);
      const totalCost = dp[N - 1][invNIdx][inv0Idx] + wrapCost;
      if (totalCost < minTotalDist) {
        minTotalDist = totalCost;
        bestInvNMinus1Idx = invNIdx;
        bestInv0Idx = inv0Idx;
      }
    }
  }

  const bestInversions = new Array(N).fill(0);
  bestInversions[0] = candidateInversions[0][bestInv0Idx];
  let currInvIdx = bestInvNMinus1Idx;
  for (let i = N - 1; i > 0; i--) {
    bestInversions[i] = candidateInversions[i][currInvIdx];
    currInvIdx = backpointer[i][currInvIdx][bestInv0Idx];
  }
  return bestInversions;
}

// ──── Diatonic Checks ────

export function isChordDiatonic(chord: Chord, keyRoot: string, isMinor: boolean): { isDiatonic: boolean; outNotes: string[] } {
  const scaleIntervals = isMinor ? SCALE_INTERVALS.Minor : SCALE_INTERVALS.Major;
  const keyRootPitch = NOTE_MAP[keyRoot] ?? 0;
  const keyScaleSet = new Set(scaleIntervals.map(s => (keyRootPitch + s) % 12));
  const chordPitches = getChordNotes(chord.root, chord.type);
  const outNotes: string[] = [];

  chordPitches.forEach(pitch => {
    if (!keyScaleSet.has(pitch)) outNotes.push(SEMITONE_NAMES[pitch]);
  });

  return { isDiatonic: outNotes.length === 0, outNotes };
}

export function inferKeyMode(chords: Chord[], keyRoot: string): boolean {
  let minorScore = 0;
  let majorScore = 0;

  chords.forEach((c, idx) => {
    const isRootChord = c.root === keyRoot;
    const isMinor = c.type === 'min' || c.type === 'min7';
    const weight = (idx === 0 || idx === chords.length - 1) ? 2.0 : 1.0;
    
    if (isRootChord) {
      if (isMinor) minorScore += 3 * weight;
      else majorScore += 3 * weight;
    } else {
      if (isMinor) minorScore += 1 * weight;
      else majorScore += 1 * weight;
    }
  });

  // Default to major on tie (more common assumption)
  return minorScore > majorScore;
}

// ──── Progression Generators ────

export function generateSectionProgression(sectionName: string, key: string, bars: number = 8): Chord[] {
  const isMinor = sectionName.toLowerCase().includes('verse') || sectionName.toLowerCase().includes('bridge');
  
  const progressions: Record<string, string[]> = {
    'Intro': ['I', 'IV', 'I', 'V'],
    'Verse': ['I', 'vi', 'IV', 'V'],
    'Verse 1': ['I', 'vi', 'IV', 'V'],
    'Verse 2': ['I', 'vi', 'IV', 'V'],
    'Chorus': ['IV', 'I', 'V', 'vi'],
    'Pre-Chorus': ['ii', 'V', 'ii', 'V'],
    'Bridge': ['vi', 'IV', 'I', 'V'],
    'Build': ['IV', 'IV', 'V', 'V'],
    'Drop': ['vi', 'IV', 'I', 'V'],
    'Break': ['vi', 'V', 'IV', 'V'],
    'Outro': ['IV', 'iv', 'I', 'I'],
    'A1 (Head)': ['I', 'vi', 'ii', 'V'],
    'A2': ['I', 'vi', 'ii', 'V'],
    'A3': ['I', 'vi', 'ii', 'V'],
    'A4 (Out Head)': ['I', 'vi', 'ii', 'V'],
    'B (Bridge)': ['IV', 'vii°', 'iii', 'vi', 'ii', 'V', 'I', 'I'],
    'Solos': ['I', 'IV', 'I', 'V']
  };

  const defaultProg = ['I', 'IV', 'V', 'I'];
  const pList = progressions[sectionName] || defaultProg;
  
  const rootNoteIndex = NOTE_MAP[key] ?? 0;
  const scale = isMinor ? SCALE_INTERVALS.Minor : SCALE_INTERVALS.Major;
  
  const getChordFromNumeral = (numeral: string): Chord => {
    let degree = 0;
    let type = 'maj';
    
    const isLower = numeral.toLowerCase() === numeral;
    if (numeral.includes('°')) type = 'dim';
    else if (isLower) type = 'min';
    
    let base = numeral.replace('°', '').toLowerCase();
    switch (base) {
      case 'i': degree = 0; break;
      case 'ii': degree = 1; break;
      case 'iii': degree = 2; break;
      case 'iv': degree = 3; break;
      case 'v': degree = 4; break;
      case 'vi': degree = 5; break;
      case 'vii': degree = 6; break;
    }
    
    const pitch = (rootNoteIndex + scale[degree]) % 12;
    
    // Add extensions
    if (type === 'maj' && (degree === 0 || degree === 3)) type = 'maj7';
    if (type === 'min') type = 'min7';
    if (type === 'maj' && degree === 4) type = '7'; // Dominant V

    return { root: SEMITONE_NAMES[pitch], type, duration: 4 };
  };

  const chords: Chord[] = [];
  let barsFilled = 0;
  let pIdx = 0;
  
  while (barsFilled < bars) {
    const c = getChordFromNumeral(pList[pIdx % pList.length]);
    chords.push({ ...c });
    barsFilled += c.duration / 4;
    pIdx++;
  }
  return chords;
}

export function generateFunctionalProgression(
  key: string,
  bars: number = 8,
  theoryParams: Partial<SessionParameters> = {},
  seed?: number
): Chord[] {
  const { harmony = 'Extended', mood = 'Chill', energy = 50, voicing = 'Open' } = theoryParams;
  const complexity = harmony === 'Diatonic' ? 0.1 : (harmony === 'Extended' ? 0.4 : (harmony === 'Chromatic' ? 0.7 : 1.0));

  const rootNoteIndex = NOTE_MAP[key] ?? 0;

  // FIXED: replaced Math.random() with a seeded generator so that identical
  // (key, bars, theoryParams) inputs always produce the same progression,
  // consistent with this being a deterministic engine. Pass `seed` to force
  // a different but still reproducible variation.
  const defaultSeed = hashStringToInt(`${key}-${bars}-${mood}-${harmony}-${energy}-${voicing}`);
  const rng = createSeededRandom(seed ?? defaultSeed);

  let isMinor = mood === 'Dark' || mood === 'Melancholic' || mood === 'Suspenseful';
  if (mood === 'Chill' && rng() > 0.5) isMinor = true;
  
  const scale = isMinor ? SCALE_INTERVALS.Minor : SCALE_INTERVALS.Major;

  const transitions: Record<string, string[]> = {
    'T': ['T', 'PD', 'D'],
    'PD': ['PD', 'D'],
    'D': ['T']
  };

  const roleToNumerals: Record<string, string[]> = {
    'T': isMinor ? ['i', 'III', 'vi'] : ['I', 'iii', 'vi'],
    'PD': isMinor ? ['ii°', 'iv', 'VI'] : ['ii', 'IV'],
    'D': isMinor ? ['v', 'VII'] : ['V', 'vii°']
  };

  if (harmony === 'Chromatic' || harmony === 'Avant-Garde') {
    roleToNumerals['PD'].push('bVI', 'bII');
    roleToNumerals['D'].push('v/V');
  }

  const voicingToInversion = (): number => {
    if (voicing === 'Closed') return 0;
    if (voicing === 'Open') return Math.floor(rng() * 2);
    if (voicing === 'Drop-2') return 2;
    if (voicing === 'Quartal') return 3;
    if (voicing === 'Cluster') return 0;
    return 0; // default to root position
  };

  const degreeFromRoman = (base: string): number => {
    switch (base) {
      case 'i': return 0;
      case 'ii': return 1;
      case 'iii': return 2;
      case 'iv': return 3;
      case 'v': return 4;
      case 'vi': return 5;
      case 'vii': return 6;
      default: return 0;
    }
  };

  let currentRole = 'T';
  const chords: Chord[] = [];
  let barsFilled = 0;

  while (barsFilled < bars) {
    const nextRoles = transitions[currentRole];
    currentRole = nextRoles[Math.floor(rng() * nextRoles.length)];
    
    const numerals = roleToNumerals[currentRole];
    const numeral = numerals[Math.floor(rng() * numerals.length)];
    
    let degree = 0;
    let type: string = numeral.toLowerCase() === numeral ? 'min' : 'maj';
    let rootShift = 0;
    let pitch: number;
    let isSecondaryDominant = false;

    if (numeral.includes('°')) type = 'dim';

    if (numeral.includes('/')) {
      // FIXED: secondary dominant notation (e.g. "v/V") was previously
      // unparsed and silently collapsed to the tonic (degree stayed at its
      // initialized value of 0). Now resolved to the actual V-of-target root.
      isSecondaryDominant = true;
      const [, targetToken] = numeral.split('/');
      const targetDegree = degreeFromRoman((targetToken ?? '').toLowerCase());
      const targetPitch = (rootNoteIndex + scale[targetDegree]) % 12;
      pitch = (targetPitch + 7) % 12; // dominant sits a perfect 5th above its target
      type = '7';
    } else {
      const base = numeral.replace('°', '').toLowerCase();

      if (base.startsWith('b')) {
        const actualBase = base.substring(1);
        rootShift = -1;
        switch (actualBase) {
          case 'ii': degree = 1; break;
          case 'vi': degree = 5; break;
          default: break;
        }
      } else {
        degree = degreeFromRoman(base);
      }

      pitch = (rootNoteIndex + scale[degree] + rootShift + 12) % 12;
    }
    
    if (harmony !== 'Diatonic' && !isSecondaryDominant) {
      if (type === 'maj' && (degree === 0 || degree === 3)) type = 'maj7';
      if (type === 'min') type = 'min7';
      if (type === 'maj' && degree === 4) type = '7';
      
      if (harmony === 'Chromatic' || harmony === 'Avant-Garde') {
        if (rng() < complexity * 0.5) {
          if (type === '7') type = '9';
          if (type === 'maj7') type = '9';
        }
      }
    }

    const duration = (energy > 80 && rng() > 0.5) ? 2 : 4;
    const chordDuration = Math.min(duration, (bars - barsFilled) * 4);

    chords.push({
      root: SEMITONE_NAMES[pitch],
      type,
      duration: chordDuration,
      inversion: voicingToInversion()
    });

    barsFilled += chordDuration / 4;
  }

  return chords;
}

export function generateSongSections(
  template: import('../types').SongStructureTemplate,
  key: string,
  smart: boolean = false,
  theoryParams?: Partial<SessionParameters>
): import('../types').SongSection[] {
  return template.sections.map((sec, i) => {
    const chords = smart
      ? generateFunctionalProgression(key, sec.bars, theoryParams)
      : generateSectionProgression(sec.name, key, sec.bars);
    return { id: `section-${Date.now()}-${i}`, name: sec.name, chords };
  });
}

// ──── Main Critic Engine ────

export function critiqueSection(
  chords: Chord[],
  bpm: number,
  instrumentStates: Record<InstrumentType, InstrumentState>,
  key: string
): CritiqueIssue[] {
  const issues: CritiqueIssue[] = [];
  if (!chords?.length) return issues;

  const isMinor = inferKeyMode(chords, key);
  const keyTypeLabel = isMinor ? 'Natural Minor' : 'Major';

  // 1. Diatonic checks
  chords.forEach((chord, idx) => {
    const { isDiatonic, outNotes } = isChordDiatonic(chord, key, isMinor);
    if (!isDiatonic) {
      issues.push({
        id: `harmonic-out-of-key-${idx}`,
        category: 'harmony',
        severity: 'warning',
        title: `Out-of-Key Chord: ${chord.root}${chord.type}`,
        description: `The chord ${chord.root}${chord.type} contains notes (${outNotes.join(', ')}) that do not fit inside the song's key of ${key} ${keyTypeLabel}.`,
        suggestion: `Change this chord to a diatonic equivalent, or let the fixer snap it to the closest key-scale degree.`,
        canFix: true,
        fixType: 'diatonic_snap',
        metadata: { chordIndex: idx, chord }
      });
    }
  });

  // 2. Voice leading
  if (chords.length > 1) {
    let voiceLeadingJumps = 0;
    for (let i = 0; i < chords.length; i++) {
      const nextIdx = (i + 1) % chords.length;
      const vA = getChordVoicingWithInversion(chords[i].root, chords[i].type, chords[i].inversion ?? 0);
      const vB = getChordVoicingWithInversion(chords[nextIdx].root, chords[nextIdx].type, chords[nextIdx].inversion ?? 0);
      const distance = getVoiceLeadingDistance(vA, vB);
      const avgJump = distance / Math.min(vA.length, vB.length);
      if (avgJump > 4.5) voiceLeadingJumps++;
    }
    if (voiceLeadingJumps > 0) {
      issues.push({
        id: 'harmony-voice-leading',
        category: 'harmony',
        severity: 'info',
        title: 'Sub-Optimal Voice Leading',
        description: `There are sharp octave leaps (average jumps > 4.5 semitones) between chords in this loop, causing a disconnected accompaniment sound.`,
        suggestion: `Apply optimal mathematical inversions so each voice glides smoothly into the next chord.`,
        canFix: true,
        fixType: 'smooth_voice_leading',
        metadata: { chords }
      });
    }
  }

  // 3. Cadence analysis
  if (chords.length >= 2) {
    const finalChord = chords[chords.length - 1];
    const firstChord = chords[0];
    const vRoot = getScaleDegreeRoot(key, 5, isMinor);
    const isFinalV = finalChord.root === vRoot && (finalChord.type === 'maj' || finalChord.type === '7');
    const isFirstI = firstChord.root === key && (firstChord.type === 'maj' || firstChord.type === 'min' || firstChord.type === 'maj7' || firstChord.type === 'min7');
    const isTenseType = finalChord.type === '7' || finalChord.type === 'dim' || finalChord.type === 'aug';

    if (isFirstI && !isFinalV && !isTenseType) {
      issues.push({
        id: 'harmony-cadence-v7',
        category: 'harmony',
        severity: 'info',
        title: 'Resolution: Missing Leading Cadence',
        description: `The loop returns to the tonic chord ${firstChord.root}${firstChord.type} from ${finalChord.root}${finalChord.type}. A dominant 7th (V7) chord at the end would create a highly satisfying resolve back to the beginning.`,
        suggestion: `Let the fixer change the final chord to the dominant ${vRoot}7.`,
        canFix: true,
        fixType: 'dominant_resolution_cadence',
        metadata: { finalChordIndex: chords.length - 1 }
      });
    } else if (isTenseType && !isFirstI) {
      issues.push({
        id: 'harmony-unresolved-tension',
        category: 'harmony',
        severity: 'warning',
        title: 'Unresolved Loop Tension',
        description: `The progression ends on a high-tension chord (${finalChord.root}${finalChord.type}), but doesn't resolve to a stable tonic root when looping back to ${firstChord.root}${firstChord.type}.`,
        suggestion: `Stabilize the first chord to the tonic (${key} Maj or ${key} Min) or smooth the transition.`,
        canFix: true,
        fixType: 'resolve_tonic_start'
      });
    }
  }

  // 4. Symmetry / meter
  const totalBeats = chords.reduce((sum, c) => sum + c.duration, 0);
  if (totalBeats % 4 !== 0) {
    issues.push({
      id: 'arrangement-symmetry',
      category: 'arrangement',
      severity: 'warning',
      title: `Asymmetric Section Meter (${totalBeats} Beats)`,
      description: `The section contains ${totalBeats} beats. Standard R&B, Soul, House, and Hip-Hop rely on even 4, 8, or 16-beat grids. Asymmetry might disrupt the rhythmic pocket.`,
      suggestion: `Resize or pad the chords to stretch the progression to a perfect symmetrical bar multiple (e.g., 4 or 8 bars).`,
      canFix: true,
      fixType: 'symmetry_pad',
      metadata: { currentBeats: totalBeats }
    });
  }

  // 5. Instrument-specific checks
  Object.entries(instrumentStates).forEach(([instType, instState]) => {
    if (!instState.enabled) return;
    const { params } = instState;

    if (instType === 'Bass' && (params.genre.includes('Motown') || params.genre.includes('Soul')) && params.playStyle !== 'Jamerson Chromatic') {
      issues.push({
        id: `performance-idiom-bass`,
        category: 'arrangement',
        severity: 'info',
        title: `Idiomatic Performance: Jamerson Bass`,
        description: `This bass line is currently playing standard roots. Motown/Soul styles use a specific performance grammar — anticipating chord changes by an 8th note with chromatic approach tones.`,
        suggestion: `Apply the "Jamerson-style anticipation" deterministic performance profile to the Bass.`,
        canFix: true,
        fixType: 'apply_performance_profile',
        metadata: { instrument: instType, targetProfile: 'Jamerson Chromatic' }
      });
    }

    if (params.humanize < 15) {
      issues.push({
        id: `rhythm-sterile-${instType}`,
        category: 'rhythm',
        severity: 'info',
        title: `${instType}: Mechanical Microtiming`,
        description: `The humanize setting for ${instType} is very low (${params.humanize}%), making the pattern sound robotic and mathematically rigid.`,
        suggestion: `Calibrate humanization to standard session-player levels (40%-60%).`,
        canFix: true,
        fixType: 'normalize_humanize',
        metadata: { instrument: instType, targetVal: 50 }
      });
    }

    if (params.humanize > 80) {
      issues.push({
        id: `rhythm-sloppy-${instType}`,
        category: 'rhythm',
        severity: 'warning',
        title: `${instType}: Oversloppy Microtiming`,
        description: `The humanize setting for ${instType} is extremely high (${params.humanize}%), causing note hits to wander off-grid and clashing with other tracks.`,
        suggestion: `Tighten the timing by capping humanization to 55%.`,
        canFix: true,
        fixType: 'normalize_humanize',
        metadata: { instrument: instType, targetVal: 48 }
      });
    }

    if (params.groove > 75 && bpm > 145) {
      issues.push({
        id: `rhythm-groove-clash-${instType}`,
        category: 'rhythm',
        severity: 'warning',
        title: `${instType}: High Swing at High Tempo`,
        description: `A heavy groove swing (${params.groove}%) at a fast tempo (${bpm} BPM) can sound jerky or cluttered as notes crowd together inside the beat subdivisions.`,
        suggestion: `Reduce swing groove to 45% for a smoother high-speed drive, or adjust pocket spacing.`,
        canFix: true,
        fixType: 'reduce_groove',
        metadata: { instrument: instType, targetVal: 40 }
      });
    }

    if (params.pocket < 20) {
      issues.push({
        id: `rhythm-rushed-pocket-${instType}`,
        category: 'rhythm',
        severity: 'info',
        title: `${instType}: Rushing the Beat`,
        description: `Pocket setting is very low (${params.pocket}%), making the ${instType} push ahead of the beat, which can sound anxious or rushed.`,
        suggestion: `Pull the player back into a locked grid pocket (60%-80%).`,
        canFix: true,
        fixType: 'normalize_pocket',
        metadata: { instrument: instType, targetVal: 70 }
      });
    }
  });

  // 6. Bass specific harmonic clashes
  const bass = instrumentStates.Bass;
  if (bass?.enabled) {
    const activeChordsWithDimAug = chords.filter(c => c.type.includes('dim') || c.type.includes('aug'));
    if (activeChordsWithDimAug.length > 0) {
      issues.push({
        id: 'theory-bass-dim-aug-clash',
        category: 'harmony',
        severity: 'error',
        title: 'Critical Theory Alert: Bass 5th Clash',
        description: `The progression uses diminished/augmented chords (${activeChordsWithDimAug.map(c => c.root + c.type).join(', ')}). A standard perfect 5th in the bass will cause a dissonant beating effect against the chord's modified 5th.`,
        suggestion: `The fixer will now enforce a "Safe Interval" constraint on the bass, ensuring it plays only root notes (or altered 5ths) for those chords.`,
        canFix: true,
        fixType: 'bass_diatonic_correct',
        metadata: { chords }
      });
    }
    
    if (bass.params.pocket < 30 && bass.params.groove > 70) {
      issues.push({
        id: 'theory-bass-unstable-groove',
        category: 'rhythm',
        severity: 'warning',
        title: 'Bass: Unstable Low-End Drag',
        description: `The bass is configured with high groove (${bass.params.groove}%) and rushed pocket (${bass.params.pocket}%), causing a sloppy, unstable sub-bass dragging feel that separates from the drum kicks.`,
        suggestion: `Stabilize the low-end grid by pulling pocket closer to 50% or matching the kick-pocket.`,
        canFix: true,
        fixType: 'stabilize_bass_pocket'
      });
    }
  }

  // Keys & Guitar masking
  const keys = instrumentStates.Keys;
  const guitar = instrumentStates.Guitar;
  if (keys?.enabled && guitar?.enabled) {
    if (keys.params.sparseness < 40 && guitar.params.sparseness < 40) {
      issues.push({
        id: 'theory-freq-masking-clash',
        category: 'arrangement',
        severity: 'warning',
        title: 'Keys & Guitar: Midrange Frequency Masking',
        description: `Both Keys and Guitar have high note density (low sparseness below 40%). When both play active rhythm patterns in the 250Hz - 1000Hz region, they mask each other's transients and muddy the arrangement.`,
        suggestion: `Increase the sparseness on one of the instruments (e.g. increase Guitar sparseness to 65%) to carve out musical space.`,
        canFix: true,
        fixType: 'deconflict_midrange',
        metadata: { targetInstrument: 'Guitar' }
      });
    }
  }

  // NOTE: Additional track-specific checks (Pads, Lead, etc.) and the
  // syncopation checks were represented only as placeholder comments in the
  // source provided — that code was not included, so it cannot be audited
  // or reproduced here. Re-paste those sections if you want them reviewed.

  // 7. Syncopation checks (unchanged)
  // ...

  return issues;
}

// ──── Helper Functions ────

export function getScaleDegreeRoot(keyRoot: string, degree: number, isMinor: boolean): string {
  const intervals = isMinor ? SCALE_INTERVALS.Minor : SCALE_INTERVALS.Major;
  const rootIdx = NOTE_MAP[keyRoot] ?? 0;
  const stepInterval = intervals[(degree - 1) % 7] ?? 0;
  const stepPitch = (rootIdx + stepInterval) % 12;
  return SEMITONE_NAMES[stepPitch];
}

export function getClosestDiatonicChord(chord: Chord, keyRoot: string, isMinor: boolean): Chord {
  const intervals = isMinor ? SCALE_INTERVALS.Minor : SCALE_INTERVALS.Major;
  const keyRootPitch = NOTE_MAP[keyRoot] ?? 0;
  const scalePitches = intervals.map(s => (keyRootPitch + s) % 12);
  const chordRootPitch = NOTE_MAP[chord.root] ?? 0;

  let closestPitch = scalePitches[0];
  let minDiff = Infinity;
  let closestDegree = 1;

  scalePitches.forEach((pitch, idx) => {
    const diff = Math.min((pitch - chordRootPitch + 12) % 12, (chordRootPitch - pitch + 12) % 12);
    if (diff < minDiff) {
      minDiff = diff;
      closestPitch = pitch;
      closestDegree = idx + 1;
    }
  });

  const closestRoot = SEMITONE_NAMES[closestPitch];

  let diatonicType = 'maj';
  if (isMinor) {
    if (closestDegree === 1 || closestDegree === 4 || closestDegree === 5) {
      diatonicType = chord.type.includes('7') ? 'min7' : 'min';
    } else if (closestDegree === 2) {
      diatonicType = 'dim';
    } else {
      diatonicType = chord.type.includes('7') ? 'maj7' : 'maj';
    }
  } else {
    if (closestDegree === 2 || closestDegree === 3 || closestDegree === 6) {
      diatonicType = chord.type.includes('7') ? 'min7' : 'min';
    } else if (closestDegree === 7) {
      diatonicType = 'dim';
    } else if (closestDegree === 5) {
      diatonicType = chord.type.includes('7') ? '7' : 'maj';
    } else {
      diatonicType = chord.type.includes('7') ? 'maj7' : 'maj';
    }
  }

  return {
    root: closestRoot,
    type: diatonicType,
    duration: chord.duration,
    inversion: chord.inversion
  };
}

// ──── Fix Application Engine ────

export function applyTheoryFix(
  issue: CritiqueIssue,
  chords: Chord[],
  key: string,
  instrumentStates: Record<InstrumentType, InstrumentState>
): { nextChords?: Chord[]; nextInstrumentStates?: Record<InstrumentType, InstrumentState> } {
  const isMinor = inferKeyMode(chords, key);

  switch (issue.fixType) {
    case 'sophistication_apply': {
      const { index, targetChord } = issue.metadata || {};
      if (index === undefined || !targetChord || index < 0 || index >= chords.length) return {};
      const nextChords = [...chords];
      nextChords[index] = targetChord;
      return { nextChords };
    }

    case 'diatonic_snap': {
      const chordIndex = issue.metadata?.chordIndex;
      if (chordIndex === undefined || !chords[chordIndex]) return {};
      const snapped = getClosestDiatonicChord(chords[chordIndex], key, isMinor);
      const nextChords = [...chords];
      nextChords[chordIndex] = snapped;
      return { nextChords };
    }

    case 'smooth_voice_leading': {
      const bestInversions = optimizeVoiceLeading(chords);
      const nextChords = chords.map((c, i) => ({ ...c, inversion: bestInversions[i] ?? 0 }));
      return { nextChords };
    }

    case 'dominant_resolution_cadence': {
      const finalChordIndex = issue.metadata?.finalChordIndex;
      if (finalChordIndex === undefined || !chords[finalChordIndex]) return {};
      const vRoot = getScaleDegreeRoot(key, 5, isMinor);
      const nextChords = [...chords];
      nextChords[finalChordIndex] = { ...nextChords[finalChordIndex], root: vRoot, type: '7' };
      return { nextChords };
    }

    case 'resolve_tonic_start': {
      const nextChords = [...chords];
      if (nextChords[0]) {
        nextChords[0] = { ...nextChords[0], root: key, type: isMinor ? 'min7' : 'maj7' };
      }
      return { nextChords };
    }

    case 'symmetry_pad': {
      const currentBeats = issue.metadata?.currentBeats ?? 0;
      if (currentBeats <= 0) return {};
      const targetBeats = Math.ceil(currentBeats / 4) * 4;
      const difference = targetBeats - currentBeats;
      const nextChords = [...chords];
      if (nextChords.length > 0 && difference > 0) {
        const lastIdx = nextChords.length - 1;
        nextChords[lastIdx] = { ...nextChords[lastIdx], duration: nextChords[lastIdx].duration + difference };
      }
      return { nextChords };
    }

    case 'apply_performance_profile': {
      const { instrument, targetProfile } = issue.metadata || {};
      if (!instrument || !instrumentStates[instrument as InstrumentType]) return {};
      const nextInstrumentStates = { ...instrumentStates };
      nextInstrumentStates[instrument as InstrumentType] = {
        ...nextInstrumentStates[instrument as InstrumentType],
        params: { ...nextInstrumentStates[instrument as InstrumentType].params, playStyle: targetProfile }
      };
      return { nextInstrumentStates };
    }

    case 'normalize_humanize': {
      const { instrument, targetVal } = issue.metadata || {};
      if (!instrument || !instrumentStates[instrument as InstrumentType]) return {};
      const nextInstrumentStates = { ...instrumentStates };
      nextInstrumentStates[instrument as InstrumentType] = {
        ...nextInstrumentStates[instrument as InstrumentType],
        params: { ...nextInstrumentStates[instrument as InstrumentType].params, humanize: targetVal }
      };
      return { nextInstrumentStates };
    }

    case 'reduce_groove': {
      const { instrument, targetVal } = issue.metadata || {};
      if (!instrument || !instrumentStates[instrument as InstrumentType]) return {};
      const nextInstrumentStates = { ...instrumentStates };
      nextInstrumentStates[instrument as InstrumentType] = {
        ...nextInstrumentStates[instrument as InstrumentType],
        params: { ...nextInstrumentStates[instrument as InstrumentType].params, groove: targetVal }
      };
      return { nextInstrumentStates };
    }

    case 'normalize_pocket': {
      const { instrument, targetVal } = issue.metadata || {};
      if (!instrument || !instrumentStates[instrument as InstrumentType]) return {};
      const nextInstrumentStates = { ...instrumentStates };
      nextInstrumentStates[instrument as InstrumentType] = {
        ...nextInstrumentStates[instrument as InstrumentType],
        params: { ...nextInstrumentStates[instrument as InstrumentType].params, pocket: targetVal }
      };
      return { nextInstrumentStates };
    }

    case 'bass_diatonic_correct': {
      const nextInstrumentStates = { ...instrumentStates };
      if (nextInstrumentStates.Bass) {
        nextInstrumentStates.Bass = {
          ...nextInstrumentStates.Bass,
          params: { ...nextInstrumentStates.Bass.params, playStyle: 'Bass Safe' }
        };
      }
      return { nextInstrumentStates };
    }

    case 'stabilize_bass_pocket': {
      const nextInstrumentStates = { ...instrumentStates };
      if (nextInstrumentStates.Bass) {
        nextInstrumentStates.Bass = {
          ...nextInstrumentStates.Bass,
          params: { ...nextInstrumentStates.Bass.params, pocket: 50, groove: 40 }
        };
      }
      return { nextInstrumentStates };
    }

    case 'open_keyboard_sparseness': {
      const nextInstrumentStates = { ...instrumentStates };
      if (nextInstrumentStates.Keys) {
        nextInstrumentStates.Keys = {
          ...nextInstrumentStates.Keys,
          params: { ...nextInstrumentStates.Keys.params, sparseness: 60 }
        };
      }
      return { nextInstrumentStates };
    }

    case 'deconflict_midrange': {
      const nextInstrumentStates = { ...instrumentStates };
      if (nextInstrumentStates.Guitar) {
        nextInstrumentStates.Guitar = {
          ...nextInstrumentStates.Guitar,
          params: { ...nextInstrumentStates.Guitar.params, sparseness: 70 }
        };
      }
      return { nextInstrumentStates };
    }

    case 'relax_pads': {
      const nextInstrumentStates = { ...instrumentStates };
      if (nextInstrumentStates.Pads) {
        nextInstrumentStates.Pads = {
          ...nextInstrumentStates.Pads,
          params: { ...nextInstrumentStates.Pads.params, sparseness: 75 }
        };
      }
      return { nextInstrumentStates };
    }

    case 'relax_lead': {
      const nextInstrumentStates = { ...instrumentStates };
      if (nextInstrumentStates.Lead) {
        nextInstrumentStates.Lead = {
          ...nextInstrumentStates.Lead,
          params: { ...nextInstrumentStates.Lead.params, sparseness: 60 }
        };
      }
      return { nextInstrumentStates };
    }

    case 'inject_syncopated_pocket': {
      const instrument = issue.metadata?.instrument as InstrumentType;
      if (!instrument || !instrumentStates[instrument]) return {};
      const nextInstrumentStates = { ...instrumentStates };
      const current = nextInstrumentStates[instrument];
      const nextPocket =
        instrument === 'Bass' ? 68 :
        instrument === 'Guitar' ? 38 :
        instrument === 'Drums' ? 60 : 40;
      nextInstrumentStates[instrument] = {
        ...current,
        params: { ...current.params, pocket: nextPocket, groove: Math.max(current.params.groove, 65) }
      };
      return { nextInstrumentStates };
    }

    case 'unify_groove_grid': {
      const targetGroove = issue.metadata?.targetGroove ?? 65;
      const nextInstrumentStates = { ...instrumentStates };
      if (nextInstrumentStates.Drums) {
        nextInstrumentStates.Drums = {
          ...nextInstrumentStates.Drums,
          params: { ...nextInstrumentStates.Drums.params, groove: targetGroove }
        };
      }
      if (nextInstrumentStates.Bass) {
        nextInstrumentStates.Bass = {
          ...nextInstrumentStates.Bass,
          params: { ...nextInstrumentStates.Bass.params, groove: targetGroove }
        };
      }
      return { nextInstrumentStates };
    }

    case 'harmonic_syncopation_shift': {
      if (chords.length < 2) return {};
      // Apply a rhythmic pattern (3,5,3,5,...) cycling through all chords
      const nextChords = chords.map((c, idx) => {
        const dur = (idx % 4 === 0 || idx % 4 === 2) ? 3 : 5;
        return { ...c, duration: dur };
      });
      return { nextChords };
    }

    default:
      return {};
  }
}