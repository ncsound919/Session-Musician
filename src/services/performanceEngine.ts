import { Chord, InstrumentType, PerformanceContext, PerformedNote, PerformanceRule, PerformanceProfile, SwingCurve, SessionParameters } from '../types';
import { createSeededRng, SeededRng } from '../utils/prng';
import { getChordNotes, NOTE_MAP } from './musicTheoryEngine';

export function applyDefaultSwing(
  ctx: PerformanceContext,
  chordTones: number[],
  swing: SwingCurve,
  rng: SeededRng,
  absoluteBeat: number
): PerformedNote[] {
  const notes: PerformedNote[] = [];
  const beatFract = ctx.beatInBar % 1;
  const subdivisionIndex = Math.floor(beatFract * swing.subdivisionsPerBeat) % swing.subdivisionsPerBeat;
  const offset = swing.offsets[subdivisionIndex] ?? 0;
  
  // Basic default generation (placeholder for actual default fallback)
  const root = chordTones[0];
  
  notes.push({
    midi: root,
    startBeatOffset: offset,
    durationBeats: 1 / swing.subdivisionsPerBeat,
    velocity: 80 + Math.floor(rng.next() * 20),
    articulation: 'normal',
    reason: 'Default swing curve',
    absoluteBeat
  });
  
  return notes;
}

export function generatePerformance(
  chords: Chord[],
  instrument: InstrumentType,
  profile: PerformanceProfile,
  seed: number,
  sectionEnergy: (barIndex: number) => number,
  bpm: number,
  params: SessionParameters,
  syncopation: number = 50
): PerformedNote[] {
  const rng = createSeededRng(seed);
  const notes: PerformedNote[] = [];
  let barIndex = 0;
  let absoluteBeatCounter = 0;

  chords.forEach((chord, idx) => {
    for (let beat = 0; beat < chord.duration; beat++) {
      const ctx: PerformanceContext = {
        chord,
        prevChord: chords[idx - 1] ?? null,
        nextChord: chords[idx + 1] ?? null,
        beatInBar: beat,
        barIndex,
        isChordChangeBeat: beat === 0,
        isSectionStart: idx === 0 && beat === 0,
        isSectionEnd: idx === chords.length - 1 && beat === chord.duration - 1,
        bpm,
        energy: sectionEnergy(barIndex),
        params,
      };

      const chordTones = getChordNotes(chord.root, chord.type);

      const candidateRules = profile.rules
        .filter(r => r.appliesTo === instrument && r.matches(ctx));

      // Filter by syncopation preference
      const filteredRules = candidateRules.filter(r => {
        if (r.isSyncopated) {
          return rng.next() * 100 < syncopation;
        }
        return true;
      });

      const rule = filteredRules.sort((a, b) => b.priority - a.priority)[0];

      if (rule) {
        const generated = rule.generate(ctx, chordTones, rng);
        generated.forEach(n => n.absoluteBeat = absoluteBeatCounter);
        notes.push(...generated);
      } else {
        notes.push(...applyDefaultSwing(ctx, chordTones, profile.defaultSwing, rng, absoluteBeatCounter));
      }
      absoluteBeatCounter++;
    }
    
    barIndex += chord.duration / 4;
  });

  return notes;
}

// --- Performance Rules ---

export const jamersonAnticipatedRoot: PerformanceRule = {
  id: 'jamerson-anticipated-root',
  appliesTo: 'Bass',
  priority: 10,
  isSyncopated: true,
  matches: (ctx) => ctx.isChordChangeBeat && ctx.nextChord !== null && ctx.beatInBar === 3,
  generate: (ctx, chordTones, rng) => {
    if (!ctx.nextChord) return [];
    const nextChordTones = getChordNotes(ctx.nextChord.root, ctx.nextChord.type);
    const nextRoot = nextChordTones[0] + 36;
    const approachTone = nextRoot - 1;
    return [
      {
        midi: approachTone,
        startBeatOffset: -0.25,
        durationBeats: 0.25,
        velocity: 78,
        articulation: 'ghost',
        reason: 'Jamerson chromatic approach',
      } as PerformedNote,
      {
        midi: nextRoot,
        startBeatOffset: 0,
        durationBeats: 1,
        velocity: 100,
        articulation: 'accent',
        reason: 'Anticipated root',
      } as PerformedNote,
    ];
  },
};

export const tameImpalaSteadyBass: PerformanceRule = {
  id: 'tame-steady',
  appliesTo: 'Bass',
  priority: 5,
  matches: (ctx) => true,
  generate: (ctx, chordTones, rng) => {
    return [{
      midi: chordTones[0] + 36,
      startBeatOffset: 0,
      durationBeats: 0.9,
      velocity: 95,
      articulation: 'normal',
    } as PerformedNote];
  }
};

export const ahmadJamalStabs: PerformanceRule = {
  id: 'ahmad-stabs',
  appliesTo: 'Keys',
  priority: 15,
  isSyncopated: true,
  matches: (ctx) => ctx.beatInBar === 1 || ctx.beatInBar === 2.5,
  generate: (ctx, chordTones, rng) => {
    return chordTones.map(t => ({
      midi: t + 60,
      startBeatOffset: 0,
      durationBeats: 0.2,
      velocity: 110,
      articulation: 'accent',
    } as PerformedNote));
  }
};

export const defaultBassSwing: SwingCurve = {
  offsets: [0, -0.04, 0, 0.06],
  subdivisionsPerBeat: 2
};

export const jamersonMotownProfile: PerformanceProfile = {
  id: 'jamerson-motown',
  instrument: 'Bass',
  displayName: 'James Jamerson (Motown)',
  description: 'Melodic, syncopated bass with anticipated roots.',
  rules: [jamersonAnticipatedRoot],
  defaultSwing: defaultBassSwing
};

export const tameImpalaProfile: PerformanceProfile = {
  id: 'tame-impala',
  instrument: 'Bass',
  displayName: 'Kevin Parker (Tame)',
  description: 'Driving, steady bass with heavy compression feel.',
  rules: [tameImpalaSteadyBass],
  defaultSwing: { offsets: [0, 0.02], subdivisionsPerBeat: 2 }
};

export const ahmadJamalProfile: PerformanceProfile = {
  id: 'ahmad-jamal',
  instrument: 'Keys',
  displayName: 'Ahmad Jamal (Space)',
  description: 'Dramatic space and high-register stabs.',
  rules: [ahmadJamalStabs],
  defaultSwing: { offsets: [0, 0.1, 0, -0.05], subdivisionsPerBeat: 4 }
};

export const steveCropperChops: PerformanceRule = {
  id: 'cropper-chops',
  appliesTo: 'Guitar',
  priority: 10,
  matches: (ctx) => ctx.beatInBar === 1.5 || ctx.beatInBar === 3.5,
  generate: (ctx, chordTones, rng) => {
    return chordTones.slice(0, 3).map(t => ({
      midi: t + 60,
      startBeatOffset: 0,
      durationBeats: 0.15,
      velocity: 90,
      articulation: 'staccato',
    } as PerformedNote));
  }
};

export const ambientPadSwell: PerformanceRule = {
  id: 'ambient-swell',
  appliesTo: 'Pads',
  priority: 5,
  matches: (ctx) => ctx.isChordChangeBeat,
  generate: (ctx, chordTones, rng) => {
    return chordTones.map(t => ({
      midi: t + 48,
      startBeatOffset: 0,
      durationBeats: ctx.chord.duration,
      velocity: 60,
      articulation: 'legato',
    } as PerformedNote));
  }
};

export const maceoHornPhrasing: PerformanceRule = {
  id: 'maceo-phrasing',
  appliesTo: 'Lead',
  priority: 12,
  isSyncopated: true,
  matches: (ctx) => ctx.beatInBar % 1 === 0 && Math.random() > 0.5,
  generate: (ctx, chordTones, rng) => {
    const note = chordTones[Math.floor(rng.next() * chordTones.length)] + 72;
    return [{
      midi: note,
      startBeatOffset: 0,
      durationBeats: 0.25,
      velocity: 115,
      articulation: 'accent',
    } as PerformedNote];
  }
};

export const drumGhostSnare: PerformanceRule = {
  id: 'drum-ghost-snare',
  appliesTo: 'Drums',
  priority: 8,
  matches: (ctx) => ctx.beatInBar % 1 !== 0,
  generate: (ctx, chordTones, rng) => {
    // Generate ghost snare on off-beats with low velocity
    return [{
      midi: 38,
      startBeatOffset: 0.5,
      durationBeats: 0.1,
      velocity: 30 + Math.floor(rng.next() * 20),
      articulation: 'ghost',
      reason: 'Ghost note fill',
    } as PerformedNote];
  }
};

export const drumLatinTumbao: PerformanceRule = {
  id: 'drum-latin-tumbao',
  appliesTo: 'Drums',
  priority: 15,
  matches: (ctx) => ctx.params.drumComplexSyncopation > 50,
  generate: (ctx, chordTones, rng) => {
    return [
      { midi: 36, startBeatOffset: 0, durationBeats: 0.5, velocity: 100, articulation: 'normal', reason: 'Tumbao Kick', absoluteBeat: 0 },
      { midi: 38, startBeatOffset: 1.5, durationBeats: 0.5, velocity: 110, articulation: 'accent', reason: 'Tumbao Snare', absoluteBeat: 0 }
    ];
  }
};

export const drumFill: PerformanceRule = {
  id: 'drum-fill',
  appliesTo: 'Drums',
  priority: 20,
  matches: (ctx) => ctx.isSectionEnd && ctx.params.drumTomIntensity > 60,
  generate: (ctx, chordTones, rng) => {
    return [
      { midi: 47, startBeatOffset: 0.5, durationBeats: 0.25, velocity: 110, articulation: 'accent', reason: 'Tom Fill', absoluteBeat: 0 },
      { midi: 45, startBeatOffset: 0.75, durationBeats: 0.25, velocity: 115, articulation: 'accent', reason: 'Tom Fill', absoluteBeat: 0 }
    ];
  }
};

export const drumSteadyKick: PerformanceRule = {
  id: 'drum-steady-kick',
  appliesTo: 'Drums',
  priority: 10,
  matches: (ctx) => ctx.beatInBar % 1 === 0,
  generate: (ctx, chordTones, rng) => {
    return [{
      midi: 36,
      startBeatOffset: 0,
      durationBeats: 0.5,
      velocity: 100,
      articulation: 'normal',
      reason: 'Steady kick',
    } as PerformedNote];
  }
};

export const cropperProfile: PerformanceProfile = {
  id: 'steve-cropper',
  instrument: 'Guitar',
  displayName: 'Steve Cropper (Soul)',
  description: 'Minimalist soul chips and sliding sixths.',
  rules: [steveCropperChops],
  defaultSwing: { offsets: [0, 0.05], subdivisionsPerBeat: 2 }
};

export const ambientProfile: PerformanceProfile = {
  id: 'ambient-swells',
  instrument: 'Pads',
  displayName: 'Ambient Swells',
  description: 'Ethereal, slow-attack textures.',
  rules: [ambientPadSwell],
  defaultSwing: { offsets: [0, 0], subdivisionsPerBeat: 1 }
};

export const maceoProfile: PerformanceProfile = {
  id: 'maceo-horns',
  instrument: 'Lead',
  displayName: 'Maceo Phrasing',
  description: 'Staccato, funky horn-like lead phrasing.',
  rules: [maceoHornPhrasing],
  defaultSwing: { offsets: [0, -0.05, 0, 0.05], subdivisionsPerBeat: 4 }
};

export const bassSafeProfile: PerformanceProfile = {
  id: 'bass-safe',
  instrument: 'Bass',
  displayName: 'Bass Safe (Roots Only)',
  description: 'Strict root-focused playing.',
  rules: [tameImpalaSteadyBass],
  defaultSwing: defaultBassSwing
};

// Trap Groove
export const drumTrap: PerformanceRule = {
  id: 'drum-trap',
  appliesTo: 'Drums',
  priority: 25,
  matches: (ctx) => ctx.params.genre === 'Trap',
  generate: (ctx, chordTones, rng) => {
    // Basic trap hi-hat roll
    if (ctx.beatInBar % 0.25 === 0) {
      return [{ midi: 42, startBeatOffset: 0, durationBeats: 0.25, velocity: 80, articulation: 'normal', reason: 'Trap Hat' } as PerformedNote];
    }
    return [];
  }
};

// Neo-Soul Pocket
export const neoSoulChords: PerformanceRule = {
  id: 'neo-soul-chords',
  appliesTo: 'Keys',
  priority: 20,
  matches: (ctx) => ctx.params.genre === 'NeoSoul',
  generate: (ctx, chordTones, rng) => {
    // Embellished chords (adding 7ths/9ths if not present)
    return chordTones.map(t => ({
      midi: t + 60,
      startBeatOffset: 0.05, // "Lay back" in the pocket
      durationBeats: 0.8,
      velocity: 70,
      articulation: 'legato',
      reason: 'Neo-soul push/pull'
    } as PerformedNote));
  }
};

export const drumStandardProfile: PerformanceProfile = {
  id: 'drum-standard',
  instrument: 'Drums',
  displayName: 'Standard Drums',
  description: 'Steady kick and ghost notes.',
  rules: [drumSteadyKick, drumGhostSnare, drumFill, drumLatinTumbao, drumTrap],
  defaultSwing: { offsets: [0, 0, 0, 0], subdivisionsPerBeat: 4 }
};

export const trapProfile: PerformanceProfile = {
  id: 'trap-groove',
  instrument: 'Drums',
  displayName: 'Trap Groove',
  description: 'Fast hats and heavy kicks.',
  rules: [drumTrap, drumSteadyKick],
  defaultSwing: { offsets: [0, 0, 0, 0], subdivisionsPerBeat: 8 }
};

export const neoSoulProfile: PerformanceProfile = {
  id: 'neo-soul',
  instrument: 'Keys',
  displayName: 'Neo-Soul Keys',
  description: 'Laid back, complex voicings.',
  rules: [neoSoulChords],
  defaultSwing: { offsets: [0, 0.05, 0, 0.05], subdivisionsPerBeat: 4 }
};

// Map of profiles
export const PERFORMANCE_PROFILES: Record<string, PerformanceProfile> = {
  'Jamerson Chromatic': jamersonMotownProfile,
  'Tame Psych': tameImpalaProfile,
  'Ahmad Jamal Space': ahmadJamalProfile,
  'Steve Cropper Chops': cropperProfile,
  'Ambient Swells': ambientProfile,
  'Maceo Horn Phrasing': maceoProfile,
  'Bass Safe': bassSafeProfile,
  'Standard Drums': drumStandardProfile,
  'Trap Groove': trapProfile,
  'Neo-Soul Keys': neoSoulProfile
};

export function resolveProfile(playStyle: string): PerformanceProfile | null {
  return PERFORMANCE_PROFILES[playStyle] || null;
}
