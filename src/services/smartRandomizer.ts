/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  Song, 
  InstrumentState, 
  InstrumentType, 
  Chord, 
  SONG_STRUCTURES, 
  GENRES, 
  ERAS, 
  VIBES, 
  INSTRUMENT_PLAY_STYLES,
  SynthParams,
  SessionParameters
} from '../types';
import { generateSongSections, critiqueSection, applyTheoryFix, CritiqueIssue } from './musicTheoryEngine';

interface SongDraft {
  song: Song;
  instrumentStates: Record<InstrumentType, InstrumentState>;
  score: number;
}

// ──── Performance Personalities (unchanged content, omitted for brevity) ────
// NOTE: This object's contents were not included in the source provided, so
// its internal data could not be audited. A defensive fallback has been
// added in getPersonality() below to avoid crashes if a lookup key is missing.
const PERFORMANCE_PERSONALITIES: Record<string, any> = {
  // ... same as before ...
};

const DEFAULT_PERSONALITY = {
  groove: [50, 70],
  pocket: [48, 52],
  humanize: [50, 70],
  energy: [40, 80],
  harmony: 'Extended',
  voicing: 'Open',
  mood: 'Chill',
  drumStyles: ['Standard']
};

// Robust personality selector – maps vibe / genre to a personality name
function getPersonalityName(genre: string, vibe: string): string {
  if (vibe === 'Ahmad Jamal' || (genre === 'Jazz' && vibe === 'Chill')) return 'Ahmad Jamal';
  if (vibe === 'Chick Corea' || genre === 'Jazz Fusion') return 'Chick Corea';
  if (vibe === 'Tame Impala' || genre.includes('Psych')) return 'Tame Impala'; // remains a bit broad but intentional
  if (vibe === 'John Mayer') return 'John Mayer';
  if (vibe === 'Taylor Swift' || (genre === 'Pop' && vibe === 'Bright')) return 'Taylor Swift';
  if (genre === 'House' || genre === 'Electronic') return 'Deep House';
  if (genre.includes('Soul') || vibe === 'Chill') return 'Neo-Soul';
  if (genre.includes('Funk') || vibe === 'Energetic') return 'Funk';
  if (genre.includes('Hip Hop') || vibe === 'Gritty') return 'Hip Hop';
  return 'Modern';
}

function getPersonality(genre: string, vibe: string) {
  const name = getPersonalityName(genre, vibe);
  // FIXED: fall back to a safe default rather than returning undefined and
  // crashing generateGrooveDNA() if a personality key is missing.
  return PERFORMANCE_PERSONALITIES[name] ?? DEFAULT_PERSONALITY;
}

// ──── Scoring & Refinement ────

function scoreDraft(draft: SongDraft): number {
  let score = 0;
  
  // Harmonic Interest
  draft.song.sections.forEach(sec => {
    const issues = critiqueSection(sec.chords, draft.song.bpm, draft.instrumentStates, draft.song.key);

    // FIXED: previously computed but discarded. Now penalizes drafts that
    // still carry unresolved theory/rhythm problems, weighted by severity,
    // so the Monte Carlo selector actually reflects critique quality.
    issues.forEach(issue => {
      if (issue.severity === 'error') score -= 8;
      else if (issue.severity === 'warning') score -= 3;
      else score -= 1;
    });

    // Reward extended chords
    const complexityScore = sec.chords.filter(c => c.type.includes('7') || c.type.includes('9')).length;
    score += complexityScore * 2;
    
    // Penalize too few unique chords
    const uniqueChords = new Set(sec.chords.map(c => `${c.root}${c.type}`)).size;
    if (uniqueChords < 2) score -= 15;
    else score += uniqueChords * 4;
  });

  // Instrument Balance
  const enabledCount = Object.values(draft.instrumentStates).filter(i => i.enabled).length;
  if (enabledCount < 3) score -= 10;
  if (enabledCount > 5) score -= 5;

  // Rhythmic Coherence
  const pockets = Object.values(draft.instrumentStates)
    .filter(i => i.enabled)
    .map(i => i.params.pocket);
  if (pockets.length > 1) {
    const minP = Math.min(...pockets);
    const maxP = Math.max(...pockets);
    if (maxP - minP > 30) score -= 20;
  }

  // Vibe / BPM match
  const vibe = draft.instrumentStates.Drums?.params.vibe;
  if (vibe === 'Smooth' && draft.song.bpm > 130) score -= 10;
  if (vibe === 'Energetic' && draft.song.bpm < 80) score -= 10;

  return score;
}

/**
 * Applies all fixable critique issues to the draft.
 * Uses the engine's `applyTheoryFix` so all fix types are handled correctly.
 */
function applyFixesToDraft(draft: SongDraft): SongDraft {
  const { song, instrumentStates } = draft;

  // We'll work with mutable copies, then assign back
  let currentChords = song.sections.map(s => [...s.chords]);
  let currentStates = { ...instrumentStates };

  song.sections.forEach((sec, secIdx) => {
    // FIXED: critique must use the accumulated `currentStates` (and the
    // in-progress `currentChords[secIdx]`), not the original, unmodified
    // `instrumentStates`/`sec.chords`. Otherwise instrument-level fixes
    // applied while processing earlier sections are invisible to later
    // sections' critique pass, causing redundant or inconsistent fixes.
    const issues = critiqueSection(currentChords[secIdx], song.bpm, currentStates, song.key);
    
    // Apply each fixable issue sequentially
    issues.forEach(issue => {
      if (!issue.canFix) return;
      
      const result = applyTheoryFix(issue, currentChords[secIdx], song.key, currentStates);
      if (result.nextChords) {
        currentChords[secIdx] = result.nextChords;
      }
      if (result.nextInstrumentStates) {
        currentStates = result.nextInstrumentStates;
      }
    });
  });

  // Build a new Song object with the fixed chords
  const fixedSections = song.sections.map((sec, idx) => ({
    ...sec,
    chords: currentChords[idx]
  }));

  return {
    song: { ...song, sections: fixedSections },
    instrumentStates: currentStates,
    score: draft.score // will be recalculated later
  };
}

// ──── Random Generation Helpers ────

function generateGrooveDNA(personality: any): {
  groove: number;
  pocket: number;
  humanize: number;
  syncopation: number;
  harmony: string;
  voicing: string;
  mood: string;
  energy: number;
} {
  const rand = (range: number[] | undefined, fallback: [number, number]) =>
    Array.isArray(range)
      ? Math.floor(range[0] + Math.random() * (range[1] - range[0]))
      : Math.floor(fallback[0] + Math.random() * (fallback[1] - fallback[0]));

  return {
    groove: rand(personality.groove, [50, 70]),
    pocket: rand(personality.pocket, [48, 52]),
    humanize: rand(personality.humanize, [50, 70]),
    syncopation: 50 + (Math.random() * 40 - 20),
    harmony: personality.harmony || 'Extended',
    voicing: personality.voicing || 'Open',
    mood: personality.mood || 'Chill',
    energy: rand(personality.energy, [40, 80])
  };
}

function randomizeSynthParams(type: InstrumentType, vibe: string): SynthParams {
  const oscTypes: Array<'sine' | 'square' | 'sawtooth' | 'triangle'> = ['sine', 'square', 'sawtooth', 'triangle'];
  const isExperimental = vibe === 'Cosmic' || vibe === 'Spirit-Filled';

  const baseParams = (): SynthParams => ({
    oscType: oscTypes[Math.floor(Math.random() * oscTypes.length)],
    filterCutoff: 200 + Math.random() * 8000,
    filterResonance: 0.5 + Math.random() * 10,
    attack: 0.005 + Math.random() * 0.1,
    decay: 0.1 + Math.random() * 0.5,
    sustain: 0.2 + Math.random() * 0.6,
    release: 0.1 + Math.random() * 1.5,
  });

  switch (type) {
    case 'Bass':
      return {
        ...baseParams(),
        oscType: Math.random() > 0.5 ? 'sawtooth' : 'square',
        filterCutoff: 60 + Math.random() * 400,
        filterResonance: 1 + Math.random() * 5,
        attack: 0.005,
        decay: 0.1 + Math.random() * 0.2,
        sustain: 0.2 + Math.random() * 0.3,
        release: 0.1,
        fx: { delay: Math.random() > 0.5 ? 0.2 : 0 }
      } as SynthParams;
    case 'Pads':
      return {
        ...baseParams(),
        oscType: isExperimental ? 'sawtooth' : 'triangle',
        filterCutoff: 200 + Math.random() * 2000,
        filterResonance: 0.5 + Math.random() * 2,
        attack: 0.5 + Math.random() * 2.0,
        decay: 0.4,
        sustain: 0.6 + Math.random() * 0.3,
        release: 1.0 + Math.random() * 3.0,
        fx: { reverb: 0.6 + Math.random() * 0.4, chorus: 0.5 }
      } as SynthParams;
    case 'Lead':
      return {
        ...baseParams(),
        oscType: Math.random() > 0.5 ? 'square' : 'sawtooth',
        filterCutoff: 1000 + Math.random() * 7000,
        filterResonance: 2 + Math.random() * 10,
        attack: 0.01 + Math.random() * 0.05,
        decay: 0.1 + Math.random() * 0.1,
        sustain: 0.3 + Math.random() * 0.4,
        release: 0.1 + Math.random() * 0.2,
        fx: { reverb: 0.1 + Math.random() * 0.2, delay: 0.3 }
      } as SynthParams;
    default:
      // Keys / Guitar synthetic
      return {
        ...baseParams(),
        filterCutoff: 500 + Math.random() * 6000,
        filterResonance: 1 + Math.random() * 4,
        attack: 0.005 + Math.random() * 0.02,
        decay: 0.1 + Math.random() * 0.2,
        sustain: 0.4 + Math.random() * 0.2,
        release: 0.1 + Math.random() * 0.3,
        fx: { reverb: Math.random() * 0.3, delay: Math.random() * 0.1, chorus: Math.random() > 0.5 ? 0.3 : 0 }
      } as SynthParams;
  }
}

// ──── Main Generator ────

export function generateSmartRandomDraft(
  currentStates: Record<InstrumentType, InstrumentState>,
  currentSong: Song,
  lockedKeys: (keyof SessionParameters)[] = []
): SongDraft {
  const bpmList = [80, 88, 92, 95, 100, 108, 115, 120, 124];
  const keys = ['C', 'D', 'E', 'F', 'G', 'A', 'B', 'C#', 'F#', 'Bb', 'Eb'];
  
  const bpm = bpmList[Math.floor(Math.random() * bpmList.length)];
  const key = keys[Math.floor(Math.random() * keys.length)];
  const genre = GENRES[Math.floor(Math.random() * GENRES.length)];
  const era = ERAS[Math.floor(Math.random() * ERAS.length)];
  const vibe = VIBES[Math.floor(Math.random() * VIBES.length)];
  
  const personality = getPersonality(genre, vibe);
  const grooveDNA = generateGrooveDNA(personality);
  const template = SONG_STRUCTURES[Math.floor(Math.random() * SONG_STRUCTURES.length)];
  
  const sections = generateSongSections(template, key, true, {
    harmony: grooveDNA.harmony,
    mood: grooveDNA.mood,
    energy: grooveDNA.energy
  });
  
  // Helper: returns a value for a numeric param, respecting locks
  const getNumericParam = (type: InstrumentType, paramKey: keyof SessionParameters, newVal: number) => {
    if (lockedKeys.includes(paramKey)) {
      const lockedVal = currentStates[type].params[paramKey];
      return typeof lockedVal === 'number' ? lockedVal : newVal;
    }
    return newVal;
  };

  const instrumentStates: Record<InstrumentType, InstrumentState> = { ...currentStates };
  
  (Object.keys(instrumentStates) as InstrumentType[]).forEach(type => {
    const playStyles = INSTRUMENT_PLAY_STYLES[type];
    const randomPlayStyle = playStyles[Math.floor(Math.random() * playStyles.length)];
    
    // per‑instrument drift
    const drift = () => (Math.random() * 10 - 5);
    
    // Drums get special per‑drum pocket/swing
    let perDrumPocket: Record<string, number> | undefined;
    let perDrumSwing: Record<string, number> | undefined;
    if (type === 'Drums') {
      const dStyles = personality.drumStyles;
      const selectedStyle = dStyles[Math.floor(Math.random() * dStyles.length)];
      
      perDrumPocket = {
        Kick: Math.max(0, Math.min(100, grooveDNA.pocket + (selectedStyle === 'J Dilla Unquantized' ? -15 : drift()))),
        Snare: Math.max(0, Math.min(100, grooveDNA.pocket + (selectedStyle === 'Questlove Displacement' || selectedStyle === 'J Dilla Unquantized' ? 12 : drift()))),
        HiHat: Math.max(0, Math.min(100, grooveDNA.pocket + drift()))
      };
      perDrumSwing = {
        Kick: Math.max(0, Math.min(100, grooveDNA.groove + drift())),
        Snare: Math.max(0, Math.min(100, grooveDNA.groove + drift())),
        HiHat: Math.max(0, Math.min(100, grooveDNA.groove + (selectedStyle === 'J Dilla Unquantized' ? 10 : drift())))
      };
    }

    instrumentStates[type] = {
      ...instrumentStates[type],
      enabled: type === 'Drums' || type === 'Bass' || Math.random() > 0.4,
      params: {
        ...instrumentStates[type].params,
        genre: lockedKeys.includes('genre') ? currentStates[type].params.genre : genre,
        era: lockedKeys.includes('era') ? currentStates[type].params.era : era,
        vibe: lockedKeys.includes('vibe') ? currentStates[type].params.vibe : vibe,
        playStyle: lockedKeys.includes('playStyle') ? currentStates[type].params.playStyle : randomPlayStyle,
        pocket: getNumericParam(type, 'pocket', Math.max(0, Math.min(100, grooveDNA.pocket + (type === 'Drums' ? 10 : drift())))),
        groove: getNumericParam(type, 'groove', Math.max(0, Math.min(100, grooveDNA.groove + drift()))),
        humanize: getNumericParam(type, 'humanize', Math.max(0, Math.min(100, grooveDNA.humanize + drift()))),
        syncopation: getNumericParam(type, 'syncopation', Math.max(0, Math.min(100, grooveDNA.syncopation + drift()))),
        harmony: grooveDNA.harmony,
        voicing: grooveDNA.voicing,
        mood: grooveDNA.mood,
        energy: grooveDNA.energy,
        sparseness: getNumericParam(type, 'sparseness', Math.floor(30 + Math.random() * 40)),
        perDrumPocket,
        perDrumSwing
      },
      synthParams: type !== 'Drums' ? randomizeSynthParams(type, vibe) : undefined
    };
  });

  const song: Song = {
    ...currentSong,
    bpm,
    key,
    sections,
    activeSectionId: sections[0].id
  };

  const draft: SongDraft = { song, instrumentStates, score: 0 };
  return applyFixesToDraft(draft);
}

/**
 * Monte Carlo Randomization – generates N drafts, picks the highest scored one.
 */
export function performSmartRandomize(
  currentStates: Record<InstrumentType, InstrumentState>,
  currentSong: Song,
  trials: number = 8,
  lockedKeys: (keyof SessionParameters)[] = []
): { song: Song; instrumentStates: Record<InstrumentType, InstrumentState> } {
  const drafts: SongDraft[] = [];
  
  for (let i = 0; i < trials; i++) {
    const draft = generateSmartRandomDraft(currentStates, currentSong, lockedKeys);
    draft.score = scoreDraft(draft);
    drafts.push(draft);
  }

  drafts.sort((a, b) => b.score - a.score);
  const winner = drafts[0];
  
  return {
    song: winner.song,
    instrumentStates: winner.instrumentStates
  };
}