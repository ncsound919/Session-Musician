/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type InstrumentType = 'Drums' | 'Bass' | 'Keys' | 'Guitar' | 'Pads' | 'Lead' | 'Sampler';

export interface Chord {
  root: string;
  type: string;
  duration: number;
  inversion?: number;
}

export interface SongSection {
  id: string;
  name: string;
  chords: Chord[];
  instrumentParams?: Record<string, Partial<InstrumentState['params']>>;
  midiData?: Record<string, PerformedNote[]>;
}

export interface Song {
  bpm: number;
  key: string;
  sections: SongSection[];
  activeSectionId: string;
}

export interface SessionParameters {
  genre: string;
  era: string;
  vibe: string;
  notationStyle: string;
  playStyle: string;
  groove: number;
  sparseness: number;
  pocket: number;
  humanize: number;
  syncopation: number;
  sophistication?: number;
  harmony: string;
  voicing: string;
  mood: string;
  energy: number;
  tactileInject?: string;
  perDrumPocket?: Record<string, number>; // Individual drum piece pocket offsets
  perDrumSwing?: Record<string, number>;  // Individual drum piece swing factors
  drumGhostNoteIntensity?: number;      // 0-100
  drumTomIntensity?: number;            // 0-100
  drumComplexSyncopation?: number;      // 0-100
}

import { SeededRng } from './utils/prng';

export interface PerformanceContext {
  chord: Chord;
  prevChord: Chord | null;
  nextChord: Chord | null;
  beatInBar: number;
  barIndex: number;
  isChordChangeBeat: boolean;
  isSectionStart: boolean;
  isSectionEnd: boolean;
  bpm: number;
  energy: number;
  params: SessionParameters;
}

export interface PerformedNote {
  id?: string;
  midi: number;
  startBeatOffset: number;
  durationBeats: number;
  velocity: number;
  articulation: 'normal' | 'ghost' | 'accent' | 'slide' | 'staccato' | 'legato';
  reason: string;
  absoluteBeat: number;

  // Piano Roll / Editable MIDI properties
  note?: number;
  tick?: number;
  duration?: number;
  channel?: InstrumentType;
}

export interface PerformanceRule {
  id: string;
  appliesTo: InstrumentType;
  isSyncopated?: boolean;
  matches: (ctx: PerformanceContext) => boolean;
  generate: (ctx: PerformanceContext, chordTones: number[], rng: SeededRng) => PerformedNote[];
  priority: number;
}

export interface SwingCurve {
  offsets: number[];
  subdivisionsPerBeat: number;
}

export interface PerformanceProfile {
  id: string;
  instrument: InstrumentType;
  displayName: string;
  description: string;
  rules: PerformanceRule[];
  defaultSwing: SwingCurve;
  allowedInversions?: number[]; // e.g. [0, 1] for tight voicings, [2] for drop-2
}

export interface DrumSample {
  id: string;
  name: string;
  url: string;
  type: 'Kick' | 'Snare' | 'HiHat' | 'Tom' | 'Cymbal' | 'Percussion';
}

export interface DrumKit {
  id: string;
  name: string;
  samples: DrumSample[];
}

export interface SynthParams {
  // Existing (unchanged)
  oscType?: 'sine' | 'square' | 'sawtooth' | 'triangle';
  filterCutoff?: number;
  filterResonance?: number;
  attack?: number;
  decay?: number;
  sustain?: number;
  release?: number;
  lfoRate?: number;
  lfoPitchMod?: number;
  lfoFilterMod?: number;
  hpfCutoff?: number;
  envFilterMod?: number;
  junoChorus?: number;
  noiseLevel?: number;
  fx?: {
    reverb?: number;
    delay?: number;
    chorus?: number;
  };

  // ── NEW: Oscillator ──
  subOscLevel?: number;      // 0–1, sub-osc mix
  subOscOctave?: -1 | -2;    // one or two octaves below fundamental
  pwmAmount?: number;        // 0–1, only meaningful when oscType === 'square'; drives pulse width via two detuned saws
  unisonVoices?: number;     // 1–7, odd numbers recommended (1 = off)
  unisonDetune?: number;     // 0–50 cents, spread between unison voices
  unisonStereoWidth?: number;// 0–1, pans unison voices across stereo field

  // ── NEW: Filter ──
  filterType?: 'lowpass' | 'highpass' | 'bandpass' | 'notch';
  filterDrive?: number;      // 0–1, waveshaper saturation pre/post filter
  filterEnvAmount?: number;  // -1 to 1, signed depth
  filterAttack?: number;
  filterDecay?: number;
  filterSustain?: number;    // 0–1
  filterRelease?: number;

  // ── NEW: Voicing ──
  glideTime?: number;        // seconds, portamento time between notes
}

export type SophisticationLevel = number;

export interface InstrumentState {
  type: InstrumentType;
  enabled: boolean;
  params: SessionParameters;
  synthParams?: SynthParams;
  customKit?: DrumKit;
  kitVolumes?: Record<string, number>;
}

export interface StylePreset {
  id: string;
  name: string;
  description: string;
  instrument: string; // 'All' or key of InstrumentType
  params: Partial<SessionParameters>;
}

export interface MidiNote {
  pitch: number;
  velocity: number;
  start: number;
  end: number;
}

export interface HighlightRegion {
  id: string;
  start: number;
  end: number;
  action: string;
  comment?: string;
}

export interface ExpressionSection {
  start: number;
  end: number;
  label: string;
  strength: number;
}

export interface Expressions {
  overall: string;
  sections: ExpressionSection[];
}

export interface Take {
  id: number;
  recorded_at: string;
  midi_notes: MidiNote[];
  expressions?: Expressions;
  highlight_regions: HighlightRegion[];
  applied_hints_from_previous_take?: string[];
}

export interface TakeTrack {
  track_id: string;
  instrument_hint: string;
  takes: Take[];
}

export const GENRES = [
  'Jazz', 'Soul', 'Funk', 'Hip Hop', 'R&B', 'House', 'Ambient', 'Synthwave', 'Rock',
  'Motown', 'Stax Soul', 'West Coast Rock', 'AOR Fusion', 'P-Funk', 'James Brown Funk', 'Sly Psychedelic',
  '70s Black Gospel', '90s Alternative Rock'
];
export const ERAS = ['60s', '70s', '80s', '90s', 'Modern', 'Futuristic'];
export const VIBES = ['Smooth', 'Gritty', 'Chill', 'Energetic', 'Dark', 'Warm', 'Lush', 'Tight', 'Greasy', 'Raw', 'Cosmic', 'Polished', 'Spirit-Filled', 'Angsty', 'Ahmad Jamal', 'Chick Corea', 'Tame Impala', 'John Mayer'];
export const HARMONY_LEVELS = ['Diatonic', 'Extended', 'Chromatic', 'Avant-Garde'];
export const VOICING_STYLES = ['Closed', 'Open', 'Drop-2', 'Quartal', 'Cluster'];
export const MOODS = ['Bright', 'Dark', 'Chill', 'Aggressive', 'Melancholic', 'Euphoric', 'Suspenseful'];
export const NOTATION_STYLES = [
  'Standard', 'Arpeggiated', 'Syncopated', 'Chords', 'Staccato', 'Legato',
  'Linear Breaks', 'Slap & Pop', 'Chank Stabs', 'Organ Drawbars', 'Envelope Sweep', 'Chords & Fills',
  'Gospel Chops Phrasing', 'Grunge Power Strum'
];

export const CHORD_ROOTS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const CHORD_TYPES = ['maj', 'min', '7', 'maj7', 'min7', 'dim', 'aug', 'sus4', '9'];

export const INSTRUMENT_PLAY_STYLES: Record<InstrumentType, string[]> = {
  Drums: [
    'Boom Bap', 'Neo-Soul Hop', 'Four-on-the-floor', 'Jazz swing', 'Lofi Beat',
    'Purdie Shuffle', 'Hal Blaine Pocket', 'Al Jackson Backbeat', 'Stubblefield Breakbeat', 'Greg Errico Drive',
    'Gospel Chops', 'Grunge Power', 'Amen Break', 'Funky Drummer', 'Think Break', 'Apache Break',
    'Ahmad Jamal Space', 'Tame Psych', 'Deep House 4/4', 'Questlove Displacement', 'J Dilla Unquantized'
  ],
  Bass: [
    'Walking Bass', 'Synth Arp', 'Funk Slap', 'Smooth Groove', 'Sub Pedal',
    'Jamerson Chromatic', 'Bootsy Envelope Slap', 'Carol Kaye Picked', 'Chuck Rainey Session', 'Larry Graham Slap', 'Duck Dunn Stax Pocket',
    'Gospel Slap & Slide', 'Grunge Picked Drive'
  ],
  Keys: [
    'Jazz Voicings', 'Rhodes Chords', 'Neo-Soul Riffs', 'Arpeggio run', 'Ambient Swells',
    'Bernie Worrell Clav', 'Booker T Drawbars', 'Earl Van Dyke Chomp', 'Steely Fagen Rhodes',
    'Smallwood Chops', 'Grunge Alt-Piano'
  ],
  Guitar: [
    'Funky Riffs', 'Jazz Licks', 'Acoustic Strum', 'Plucked Swells', 'Lead Solo',
    'Steve Cropper Chops', 'Larry Carlton Fusion', 'Jimmy Nolen Chank', 'Eddie Hazel Psych', 'Tommy Tedesco Session',
    'Gospel Rhythm Strum', 'Grunge Powerchords'
  ],
  Pads: ['Sustained Pad', 'Filter Swell', 'Lush Strings', 'Warm Ambient', 'Stutter Pad', 'Vintage Organ Swells', 'Cosmic String Machine', 'Gospel Hammond Swell', 'Grunge feedback'],
  Lead: [
    'Improvisation', 'Melodic Theme', 'Arp Run', 'Synth Slide', 'Jazz Solo',
    'Maceo Horn Phrasing', 'Eddie Hazel Lead', 'Larry Carlton Lead', 'Steve Cropper Fill-In',
    'Gospel Melodic Run', 'Grunge Fuzzy Solo'
  ],
  Sampler: [
    'Chop One-Shot', 'Pad Grid Sequence', 'Atmospheric Loop'
  ]
};

export interface SongSectionTemplate {
  name: string;
  bars: number;
}

export interface SongStructureTemplate {
  id: string;
  name: string;
  sections: SongSectionTemplate[];
}

export const SONG_STRUCTURES: SongStructureTemplate[] = [
  {
    id: 'pop-standard',
    name: 'Pop Standard',
    sections: [
      { name: 'Intro', bars: 4 },
      { name: 'Verse 1', bars: 8 },
      { name: 'Chorus', bars: 8 },
      { name: 'Verse 2', bars: 8 },
      { name: 'Chorus', bars: 8 },
      { name: 'Bridge', bars: 8 },
      { name: 'Chorus', bars: 8 },
      { name: 'Outro', bars: 4 }
    ]
  },
  {
    id: 'edm-anthem',
    name: 'EDM Anthem',
    sections: [
      { name: 'Intro', bars: 8 },
      { name: 'Build', bars: 8 },
      { name: 'Drop', bars: 16 },
      { name: 'Break', bars: 8 },
      { name: 'Build', bars: 8 },
      { name: 'Drop', bars: 16 },
      { name: 'Outro', bars: 8 }
    ]
  },
  {
    id: 'jazz-standard',
    name: 'Jazz Standard (AABA)',
    sections: [
      { name: 'A1 (Head)', bars: 8 },
      { name: 'A2', bars: 8 },
      { name: 'B (Bridge)', bars: 8 },
      { name: 'A3', bars: 8 },
      { name: 'Solos', bars: 32 },
      { name: 'A4 (Out Head)', bars: 8 }
    ]
  },
  {
    id: 'rock-ballad',
    name: 'Rock Ballad',
    sections: [
      { name: 'Intro', bars: 4 },
      { name: 'Verse 1', bars: 8 },
      { name: 'Pre-Chorus', bars: 4 },
      { name: 'Chorus', bars: 8 },
      { name: 'Verse 2', bars: 8 },
      { name: 'Pre-Chorus', bars: 4 },
      { name: 'Chorus', bars: 8 },
      { name: 'Guitar Solo', bars: 8 },
      { name: 'Chorus', bars: 8 },
      { name: 'Outro', bars: 8 }
    ]
  }
];

export const INITIAL_PARAMS: SessionParameters = {
  genre: 'Jazz',
  era: 'Modern',
  vibe: 'Smooth',
  notationStyle: 'Standard',
  playStyle: 'Jazz swing',
  groove: 50,
  sparseness: 50,
  pocket: 50,
  humanize: 50,
  syncopation: 50,
  harmony: 'Extended',
  voicing: 'Open',
  mood: 'Chill',
  energy: 50,
  perDrumPocket: { Kick: 50, Snare: 50, HiHat: 50 },
  perDrumSwing: { Kick: 50, Snare: 50, HiHat: 50 }
};

export const INITIAL_SONG: Song = {
  bpm: 120,
  key: 'C',
  sections: [
    {
      id: 'initial-section',
      name: 'Verse',
      chords: [
        { root: 'C', type: 'maj7', duration: 4 },
        { root: 'A', type: 'min7', duration: 4 },
        { root: 'D', type: 'min7', duration: 4 },
        { root: 'G', type: '7', duration: 4 }
      ]
    }
  ],
  activeSectionId: 'initial-section'
};

export const STYLE_PRESETS: StylePreset[] = [
  // --- MOTOWN (THE FUNK BROTHERS) ---
  {
    id: 'james-jamerson',
    name: 'James Jamerson (Bass)',
    description: 'The legendary "Hook" technique. Heavy flatwounds, active chromatic passing tones, syncopation, and deep pocket behind the beat.',
    instrument: 'Bass',
    params: {
      genre: 'Motown',
      era: '60s',
      vibe: 'Warm',
      notationStyle: 'Standard',
      playStyle: 'Jamerson Chromatic',
      groove: 78,
      sparseness: 30,
      pocket: 22,
      humanize: 88
    }
  },
  {
    id: 'benny-benjamin',
    name: 'Benny Benjamin (Drums)',
    description: 'Driving "Motown Pulse". Crisp four-on-the-snare tambourines, syncopated pickups, and dynamic pickup fills.',
    instrument: 'Drums',
    params: {
      genre: 'Motown',
      era: '60s',
      vibe: 'Tight',
      notationStyle: 'Standard',
      playStyle: 'Hal Blaine Pocket',
      groove: 82,
      sparseness: 45,
      pocket: 45,
      humanize: 78
    }
  },
  {
    id: 'earl-van-dyke',
    name: 'Earl Van Dyke (Keys)',
    description: 'Motown piano & B3 organ chomp. Chunky, heavy-handed piano stabs driving the backbeat with gospel chord extensions.',
    instrument: 'Keys',
    params: {
      genre: 'Motown',
      era: '60s',
      vibe: 'Warm',
      notationStyle: 'Chords',
      playStyle: 'Earl Van Dyke Chomp',
      groove: 70,
      sparseness: 55,
      pocket: 50,
      humanize: 72
    }
  },

  // --- STAX (BOOKER T. & THE M.G.'s) ---
  {
    id: 'duck-dunn',
    name: 'Donald "Duck" Dunn (Bass)',
    description: 'Unyielding Stax groove. Root-fifth-octave steady lock, sparse note choice, heavy bridge-mute pluck, and strict adherence to the downbeat.',
    instrument: 'Bass',
    params: {
      genre: 'Stax Soul',
      era: '60s',
      vibe: 'Tight',
      notationStyle: 'Standard',
      playStyle: 'Duck Dunn Stax Pocket',
      groove: 65,
      sparseness: 55,
      pocket: 88,
      humanize: 65
    }
  },
  {
    id: 'al-jackson',
    name: 'Al Jackson Jr. (Drums)',
    description: 'The "Human Timekeeper". Minimalistic, dry backbeat, deeply locked pocket, crisp hat openings, and unmatched stability.',
    instrument: 'Drums',
    params: {
      genre: 'Stax Soul',
      era: '70s',
      vibe: 'Tight',
      notationStyle: 'Standard',
      playStyle: 'Al Jackson Backbeat',
      groove: 68,
      sparseness: 65,
      pocket: 95,
      humanize: 45
    }
  },
  {
    id: 'steve-cropper',
    name: 'Steve Cropper (Guitar)',
    description: 'Telescaster soul chips. Minimalist treble-heavy rhythm chops, sliding sixths, and fill lines tucked in around the vocals.',
    instrument: 'Guitar',
    params: {
      genre: 'Stax Soul',
      era: '60s',
      vibe: 'Raw',
      notationStyle: 'Syncopated',
      playStyle: 'Steve Cropper Chops',
      groove: 72,
      sparseness: 62,
      pocket: 80,
      humanize: 75
    }
  },

  // --- THE WRECKING CREW ---
  {
    id: 'carol-kaye',
    name: 'Carol Kaye (Bass)',
    description: 'Precision pick playing on flatwounds. Treble click, muted strings, active scalar lines, and impeccable dynamic pop-session timing.',
    instrument: 'Bass',
    params: {
      genre: 'West Coast Rock',
      era: '60s',
      vibe: 'Polished',
      notationStyle: 'Arpeggiated',
      playStyle: 'Carol Kaye Picked',
      groove: 60,
      sparseness: 35,
      pocket: 84,
      humanize: 58
    }
  },
  {
    id: 'hal-blaine',
    name: 'Hal Blaine (Drums)',
    description: 'Symphonic pop studio titan. Epic tom fills, standard snare drive, wide room ambience, and unmatched multi-genre session adaptability.',
    instrument: 'Drums',
    params: {
      genre: 'West Coast Rock',
      era: '60s',
      vibe: 'Energetic',
      notationStyle: 'Standard',
      playStyle: 'Hal Blaine Pocket',
      groove: 78,
      sparseness: 40,
      pocket: 76,
      humanize: 70
    }
  },
  {
    id: 'tommy-tedesco',
    name: 'Tommy Tedesco (Guitar)',
    description: 'L.A. session chameleon. High-precision clean jazz/rock voicing, classical fingers, and smooth rhythmic overlay.',
    instrument: 'Guitar',
    params: {
      genre: 'West Coast Rock',
      era: '70s',
      vibe: 'Smooth',
      notationStyle: 'Chords & Fills',
      playStyle: 'Tommy Tedesco Session',
      groove: 65,
      sparseness: 50,
      pocket: 82,
      humanize: 70
    }
  },

  // --- STEELY DAN SESSIONS ---
  {
    id: 'bernard-purdie',
    name: 'Bernard Purdie (Drums)',
    description: 'The infamous half-time "Purdie Shuffle". Ghost notes, syncopated hi-hat rebounds, and a greasy, rolling street pocket.',
    instrument: 'Drums',
    params: {
      genre: 'AOR Fusion',
      era: '70s',
      vibe: 'Greasy',
      notationStyle: 'Linear Breaks',
      playStyle: 'Purdie Shuffle',
      groove: 92,
      sparseness: 28,
      pocket: 62,
      humanize: 90
    }
  },
  {
    id: 'chuck-rainey',
    name: 'Chuck Rainey (Bass)',
    description: 'Polished fusion basslines. Melodic double stops, thumb-slide accents, complex chord outlining, and high musicality.',
    instrument: 'Bass',
    params: {
      genre: 'AOR Fusion',
      era: '70s',
      vibe: 'Smooth',
      notationStyle: 'Syncopated',
      playStyle: 'Chuck Rainey Session',
      groove: 84,
      sparseness: 42,
      pocket: 72,
      humanize: 82
    }
  },
  {
    id: 'larry-carlton',
    name: 'Larry Carlton (Guitar)',
    description: 'Silky smooth ES-335 "Kid Charlemagne" jazz-fusion licks. Rich chord extensions, sustain, and perfect chromatic resolution.',
    instrument: 'Guitar',
    params: {
      genre: 'AOR Fusion',
      era: '70s',
      vibe: 'Polished',
      notationStyle: 'Legato',
      playStyle: 'Larry Carlton Fusion',
      groove: 80,
      sparseness: 48,
      pocket: 78,
      humanize: 74
    }
  },

  // --- PARLIAMENT / P-FUNK ---
  {
    id: 'bootsy-pfunk',
    name: 'Bootsy Collins (Bass - Funk)',
    description: 'Mutron envelope space bass. Slap and pluck, deep grease, heavy bottom end, and highly syncopated rubber-band timing.',
    instrument: 'Bass',
    params: {
      genre: 'P-Funk',
      era: '70s',
      vibe: 'Greasy',
      notationStyle: 'Envelope Sweep',
      playStyle: 'Bootsy Envelope Slap',
      groove: 96,
      sparseness: 35,
      pocket: 18,
      humanize: 92
    }
  },
  {
    id: 'bernie-worrell',
    name: 'Bernie Worrell (Keys)',
    description: 'Futuristic Minimoog filter sweeps and Clavinet runs with a wah pedal. The godfather of synth-funk orchestrations.',
    instrument: 'Keys',
    params: {
      genre: 'P-Funk',
      era: '70s',
      vibe: 'Cosmic',
      notationStyle: 'Envelope Sweep',
      playStyle: 'Bernie Worrell Clav',
      groove: 90,
      sparseness: 45,
      pocket: 25,
      humanize: 84
    }
  },

  // --- JAMES BROWN (THE J.B.\'s) ---
  {
    id: 'clyde-stubblefield',
    name: 'Clyde Stubblefield (Drums)',
    description: 'The "Funky Drummer". High-speed syncopated ghost notes, snapping rimshots, and a highly disciplined breakbeat pocket.',
    instrument: 'Drums',
    params: {
      genre: 'James Brown Funk',
      era: '70s',
      vibe: 'Tight',
      notationStyle: 'Linear Breaks',
      playStyle: 'Stubblefield Breakbeat',
      groove: 86,
      sparseness: 22,
      pocket: 92,
      humanize: 68
    }
  },
  {
    id: 'jimmy-nolen',
    name: 'Jimmy Nolen (Guitar)',
    description: 'The "Chank" rhythm. Tight 9th chords, continuous scratch strumming, and sharp, percussive dynamic accents.',
    instrument: 'Guitar',
    params: {
      genre: 'James Brown Funk',
      era: '60s',
      vibe: 'Raw',
      notationStyle: 'Chank Stabs',
      playStyle: 'Jimmy Nolen Chank',
      groove: 84,
      sparseness: 55,
      pocket: 96,
      humanize: 42
    }
  },

  // --- SLY AND THE FAMILY STONE ---
  {
    id: 'larry-graham',
    name: 'Larry Graham (Bass)',
    description: 'The pioneer of slapping & popping. Thumping basslines with fuzz-wah, heavy driving rhythm, and unmatched low-end force.',
    instrument: 'Bass',
    params: {
      genre: 'Sly Psychedelic',
      era: '70s',
      vibe: 'Raw',
      notationStyle: 'Slap & Pop',
      playStyle: 'Larry Graham Slap',
      groove: 88,
      sparseness: 40,
      pocket: 50,
      humanize: 80
    }
  },

  // --- 70s BLACK GOSPEL ---
  {
    id: 'richard-smallwood',
    name: 'Richard Smallwood (Keys)',
    description: 'Dynamic orchestral gospel chops. Classically-infused cascading runs, suspended passing chords, and deep spiritual voicing.',
    instrument: 'Keys',
    params: {
      genre: '70s Black Gospel',
      era: '70s',
      vibe: 'Spirit-Filled',
      notationStyle: 'Gospel Chops Phrasing',
      playStyle: 'Smallwood Chops',
      groove: 82,
      sparseness: 35,
      pocket: 55,
      humanize: 75
    }
  },
  {
    id: 'joel-smith',
    name: 'Joel Smith (Bass)',
    description: 'Elastic gospel basslines. Double thumb-slaps, rapid pentatonic runs, sub drops, and high rhythmic syncopation.',
    instrument: 'Bass',
    params: {
      genre: '70s Black Gospel',
      era: '70s',
      vibe: 'Spirit-Filled',
      notationStyle: 'Slap & Pop',
      playStyle: 'Gospel Slap & Slide',
      groove: 86,
      sparseness: 42,
      pocket: 48,
      humanize: 80
    }
  },
  {
    id: 'gospel-chops-drums',
    name: 'Gospel Chops (Drums)',
    description: 'Hyperactive, explosive linear drum-chops. Triplet snare rolls, lightning fast fills, and heavy crashing downbeats.',
    instrument: 'Drums',
    params: {
      genre: '70s Black Gospel',
      era: '70s',
      vibe: 'Energetic',
      notationStyle: 'Gospel Chops Phrasing',
      playStyle: 'Gospel Chops',
      groove: 88,
      sparseness: 30,
      pocket: 60,
      humanize: 78
    }
  },

  // --- 90s ALTERNATIVE ROCK / GRUNGE ---
  {
    id: 'dave-grohl',
    name: 'Dave Grohl (Drums)',
    description: 'Thunderous, high-power alternative grunge backbeat. Heavy hit hats, slamming rimshots, and massive rolling tom fills.',
    instrument: 'Drums',
    params: {
      genre: '90s Alternative Rock',
      era: '90s',
      vibe: 'Angsty',
      notationStyle: 'Grunge Power Strum',
      playStyle: 'Grunge Power',
      groove: 55,
      sparseness: 25,
      pocket: 78,
      humanize: 72
    }
  },
  {
    id: 'krist-novoselic',
    name: 'Krist Novoselic (Bass)',
    description: 'Melodic, deep driving grunge pick-bass. Fuzzed out low-end warmth, sliding root-fifth transitions, and locked rhythm.',
    instrument: 'Bass',
    params: {
      genre: '90s Alternative Rock',
      era: '90s',
      vibe: 'Angsty',
      notationStyle: 'Standard',
      playStyle: 'Grunge Picked Drive',
      groove: 52,
      sparseness: 38,
      pocket: 80,
      humanize: 65
    }
  },
  {
    id: 'kurt-cobain',
    name: 'Kurt Cobain (Guitar)',
    description: 'Slacker powerchord wall of sound. Grungy chorus-modulated clean verses exploding into full fuzz feedback stabs.',
    instrument: 'Guitar',
    params: {
      genre: '90s Alternative Rock',
      era: '90s',
      vibe: 'Angsty',
      notationStyle: 'Grunge Power Strum',
      playStyle: 'Grunge Powerchords',
      groove: 50,
      sparseness: 45,
      pocket: 68,
      humanize: 82
    }
  }
];
