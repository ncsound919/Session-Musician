import { Chord } from '../types';
import { getScaleDegreeRoot, transposeChord } from './musicTheoryEngine';


export type SophisticationLevel = 0 | 1 | 2 | 3; // Off / Subtle / Signature / Maximalist


export interface HarmonicContext {
  positionInSection: number;   // 0..1, where in the section this chord falls
  isTurnaround: boolean;       // last 1-2 chords before a repeat/section change
  isCadence: boolean;
  isPreChorus: boolean;
  functionalRole: 'T' | 'PD' | 'D'; 
  precedingChord: Chord | null;
  followingChord: Chord | null;
}


export interface SophisticationRule {
  id: string;
  label: string;               // e.g. "Turnaround ii-V substitution", "Added-9 cadence voicing"
  minLevel: SophisticationLevel;
  /** Deterministic: only fires at structurally meaningful positions */
  appliesAt: (ctx: HarmonicContext) => boolean;
  /** Pure transform — same chord + context always yields same substitution */
  transform: (chord: Chord, ctx: HarmonicContext) => Chord;
}


// Concrete rules
const addedNinthOnTonicReturn: SophisticationRule = {
  id: 'added-9-tonic-return',
  label: 'Bacharach/Jasper added-9 on tonic return',
  minLevel: 1, // available even at "Subtle"
  appliesAt: (ctx) => ctx.functionalRole === 'T' && ctx.isCadence,
  transform: (chord) => ({ ...chord, type: chord.type.includes('min') ? 'min9' : 'maj9' }),
};


const secondaryDominantIntoPreChorus: SophisticationRule = {
  id: 'secondary-dominant-prechorus-lift',
  label: 'Stevie/Babyface secondary V7 lift into pre-chorus',
  minLevel: 2, // "Signature" and above only
  appliesAt: (ctx) => ctx.isPreChorus && ctx.followingChord !== null,
  transform: (chord, ctx) => {
    // deterministically build V7 of the *next* chord's root
    const targetRoot = ctx.followingChord!.root;
    const dominantRoot = getScaleDegreeRoot(targetRoot, 5, false); 
    return { ...chord, root: dominantRoot, type: '7' };
  },
};


const chromaticMediantTurnaround: SophisticationRule = {
  id: 'chromatic-mediant-turnaround',
  label: 'Steely Dan chromatic mediant turnaround',
  minLevel: 3, // "Maximalist" only
  appliesAt: (ctx) => ctx.isTurnaround,
  transform: (chord) => transposeChord({ ...chord, type: 'maj7' }, 4),
};


const jazzTwoFiveOne: SophisticationRule = {
  id: 'jazz-2-5-1',
  label: 'Jazz ii-V-I substitution',
  minLevel: 2,
  appliesAt: (ctx) => ctx.functionalRole === 'PD' && ctx.followingChord !== null && ctx.followingChord.type.includes('7'),
  transform: (chord) => ({ ...chord, type: 'min7' }),
};


const tritoneSub: SophisticationRule = {
  id: 'tritone-sub',
  label: 'Tritone substitution (bII7)',
  minLevel: 3,
  appliesAt: (ctx) => ctx.functionalRole === 'D' && ctx.isTurnaround,
  transform: (chord) => {
    // FIXED: a tritone substitution replaces a dominant chord with a
    // dominant rooted a tritone (6 semitones) away. The previous code
    // transposed by 1 semitone — that isn't a tritone relationship at all,
    // so the "bII7" result described in the label/comment was never
    // actually produced. Also removed the dead, unused `semitones` array
    // and unused `root` local that were fossils of this bug.
    return transposeChord({ ...chord, type: '7' }, 6);
  },
};


const diminishedPass: SophisticationRule = {
  id: 'dim-pass',
  label: 'Diminished passing chord',
  minLevel: 2,
  // FIXED: replaced Math.random() with a deterministic, position-derived
  // condition. The original violated this module's explicit contract that
  // appliesAt/transform must be deterministic and pure — with Math.random(),
  // calling applySophistication twice on the same input could yield
  // different chords and even change which rule wins the priority sort.
  // This still produces non-uniform placement across a progression (so it
  // doesn't fire on every eligible chord), but two calls with identical
  // input now always agree.
  appliesAt: (ctx) => !ctx.isTurnaround && ctx.positionInSection > 0 && Math.round(ctx.positionInSection * 10) % 3 === 0,
  transform: (chord) => ({ ...chord, type: 'dim7' }),
};


export const SOPHISTICATION_RULES: SophisticationRule[] = [
  addedNinthOnTonicReturn,
  secondaryDominantIntoPreChorus,
  chromaticMediantTurnaround,
  jazzTwoFiveOne,
  tritoneSub,
  diminishedPass
];


export function applySophistication(
  chords: Chord[],
  level: SophisticationLevel
): Chord[] {
  if (level === 0) return chords;


  return chords.map((chord, idx) => {
    // Derive context
    const ctx: HarmonicContext = {
      positionInSection: idx / chords.length,
      isTurnaround: idx >= chords.length - 2,
      isCadence: chord.type === 'maj' || chord.type === 'min',
      isPreChorus: idx > 0 && idx < chords.length / 2,
      functionalRole: idx === 0 ? 'T' : (idx === chords.length - 1 ? 'D' : 'PD'),
      precedingChord: idx > 0 ? chords[idx - 1] : null,
      followingChord: idx < chords.length - 1 ? chords[idx + 1] : null,
    };


    // Deterministic: sorted by priority-in-vocabulary, strongest applicable rule first
    const rule = SOPHISTICATION_RULES
      .filter(r => r.minLevel <= level && r.appliesAt(ctx))
      .sort((a, b) => b.minLevel - a.minLevel)[0];


    return rule ? rule.transform(chord, ctx) : chord;
  });
}