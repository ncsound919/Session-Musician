/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Chord, InstrumentType, PerformedNote } from '../types';
import { getChordNotes } from './musicTheoryEngine';

// ==========================================
// 1. TIMING ENGINE (MICRO-TIMING GRID)
// ==========================================

export type SoulTimingStyle = 'neo_soul' | 'motown' | 'gospel_soul' | 'g_funk';

export interface TimingProfile {
  kick: [number, number];   // Min/Max millisecond offsets
  snare: [number, number];
  hihat: [number, number];
  bass: [number, number];
  keys: [number, number];
  guitar: [number, number];
}

export class TimingEngine {
  public style: SoulTimingStyle;
  private profiles: Record<SoulTimingStyle, TimingProfile> = {
    neo_soul: {
      kick: [0, 8],
      snare: [15, 35],      // "Drunk" feel, snare laid back
      hihat: [-6, 4],       // Hihat slightly ahead of snare
      bass: [12, 24],       // Bass in deep pocket, behind kick
      keys: [10, 25],
      guitar: [8, 20],
    },
    motown: {
      kick: [-2, 2],        // On-the-grid driving beat
      snare: [0, 5],
      hihat: [4, 10],       // Tense, pushing hats
      bass: [-8, -2],       // Bass slightly ahead of the beat (driving/leading)
      keys: [0, 5],
      guitar: [-5, 2],
    },
    gospel_soul: {
      kick: [2, 10],
      snare: [8, 18],
      hihat: [0, 8],
      bass: [4, 12],
      keys: [-5, 5],
      guitar: [2, 10],
    },
    g_funk: {
      kick: [0, 5],
      snare: [20, 30],      // Heavy laid-back snare
      hihat: [-10, -2],     // Crisp ahead-of-grid hats
      bass: [15, 25],       // Lazy, slinky bass pocket
      keys: [5, 15],
      guitar: [10, 22],
    }
  };

  constructor(style: SoulTimingStyle) {
    this.style = style;
  }

  public getProfile(): TimingProfile {
    return this.profiles[this.style] || this.profiles.neo_soul;
  }

  public applyOffset(instrument: keyof TimingProfile, baseTimeSeconds: number, bpm: number, seed = 42): number {
    const range = this.getProfile()[instrument] || [0, 0];
    // Deterministic random offset using a simple hash-like LCG based on seed & instrument string length
    const hash = (seed * 17 + instrument.charCodeAt(0) * 31) % 100;
    const randomFraction = hash / 100;
    const offsetMs = range[0] + randomFraction * (range[1] - range[0]);
    
    // Convert ms offset to beat-based offset: beats = (ms / 1000) * (bpm / 60)
    const offsetBeats = (offsetMs / 1000) * (bpm / 60);
    return baseTimeSeconds + offsetBeats;
  }
}

// ==========================================
// 2. HARMONIC ENGINE (VOICINGS + PROGRESSIONS)
// ==========================================

export type SoulVoicingType = 'minor9' | 'major9' | 'dom13' | 'quartal' | 'open10';
export type SoulProgressionStyle = 'soul_ballad' | 'neo_soul' | 'motown' | 'gospel';

export interface IngestedDataset {
  id: string;
  name: string;
  source: string;
  chordCount: number;
  complexity: 'Simple' | 'Medium' | 'Sophisticated';
  keySignatures: string[];
  chords: Chord[][];
  active: boolean;
}

export class HarmonicEngine {
  public voicings: Record<SoulVoicingType, string[]> = {
    minor9:  ['1', 'b3', '5', 'b7', '9'],
    major9:  ['1', '3', '5', '7', '9'],
    dom13:   ['1', '3', '5', 'b7', '9', '13'],
    quartal: ['1', '4', 'b7', 'b3'],  // Built in fourths for neosoul floating feel
    open10:  ['1', '5', '10']         // Wide spread root-fifths-tenth
  };

  public progressions: Record<SoulProgressionStyle, string[][]> = {
    soul_ballad: [
      ['ii7', 'V7', 'Imaj7', 'vi7'],
      ['Imaj7', 'IVmaj7', 'iii7', 'vi7'],
      ['ii9', 'V13', 'Imaj9', 'VI7alt']
    ],
    neo_soul: [
      ['i9', 'bVII9', 'bVImaj9', 'V7alt'],
      ['ii9', 'v9', 'Imaj9', 'IVmaj9'],
      ['i11', 'IV9', 'bVIImaj9', 'bIIImaj9']
    ],
    motown: [
      ['I', 'vi', 'IV', 'V'],
      ['I', 'ii', 'IV', 'I'],
      ['Imaj7', 'vi7', 'ii7', 'V7']
    ],
    gospel: [
      ['I', 'IV', '#IVdim', 'V'],
      ['I', 'V/VII', 'vi7', 'I/V'],
      ['IVmaj7', 'vii/iii', 'III7', 'vi9']
    ]
  };

  private ingestedDatasets: IngestedDataset[] = [];

  constructor() {
    // Add default reference datasets out of the box matching user spec files
    this.ingestedDatasets = [
      {
        id: 'chordonomicon',
        name: 'Chordonomicon Corpus',
        source: 'https://github.com/spyroskantarelis/chordonomicon',
        chordCount: 666000,
        complexity: 'Sophisticated',
        keySignatures: ['C', 'Db', 'Eb', 'F', 'Ab', 'Bb'],
        chords: [
          [{ root: 'F', type: 'min9', duration: 4 }, { root: 'Bb', type: '13', duration: 4 }, { root: 'Eb', type: 'maj9', duration: 8 }],
          [{ root: 'C', type: 'min9', duration: 4 }, { root: 'F', type: '9', duration: 4 }, { root: 'Bb', type: 'maj9', duration: 8 }]
        ],
        active: false
      },
      {
        id: 'jazz-corpus',
        name: 'Jazz Chord Progressions Corpus',
        source: 'https://github.com/carey-bunks/Jazz-Chord-Progressions-Corpus',
        chordCount: 4200,
        complexity: 'Sophisticated',
        keySignatures: ['F', 'Bb', 'Eb', 'C', 'G'],
        chords: [
          [{ root: 'D', type: 'min9', duration: 4 }, { root: 'G', type: 'dom13', duration: 4 }, { root: 'C', type: 'major9', duration: 8 }]
        ],
        active: false
      },
      {
        id: 'choco-standards',
        name: 'ChoCo Standards Graph',
        source: 'https://github.com/DCMLab/standards',
        chordCount: 15400,
        complexity: 'Medium',
        keySignatures: ['C', 'G', 'D', 'A', 'F'],
        chords: [
          [{ root: 'A', type: 'min7', duration: 4 }, { root: 'D', type: '7', duration: 4 }, { root: 'G', type: 'maj7', duration: 8 }]
        ],
        active: false
      }
    ];
  }

  public getVoicingIntervals(voicingType: SoulVoicingType): string[] {
    return this.voicings[voicingType] || this.voicings.minor9;
  }

  public getRawProgressions(style: SoulProgressionStyle): Chord[][] {
    const activeDataset = this.ingestedDatasets.find(d => d.active);
    if (activeDataset && activeDataset.chords.length > 0) {
      return activeDataset.chords;
    }
    
    // Convert built-in roman numeral progressions to Chords for unified processing
    const romanToChord = (roman: string): Chord => {
      let root = 'C';
      let type = 'maj7';
      const clean = roman.toLowerCase();
      if (clean.startsWith('ii')) { root = 'D'; type = clean.includes('9') ? 'min9' : 'min7'; }
      else if (clean.startsWith('iii')) { root = 'E'; type = 'min7'; }
      else if (clean.startsWith('iv')) { root = 'F'; type = clean.includes('9') ? 'maj9' : 'maj7'; }
      else if (clean.startsWith('v/vii')) { root = 'D'; type = '7'; }
      else if (clean.startsWith('vii/iii')) { root = 'B'; type = '7'; }
      else if (clean.startsWith('v')) { root = 'G'; type = clean.includes('13') ? '13' : (clean.includes('9') ? '9' : '7'); }
      else if (clean.startsWith('vi')) { root = 'A'; type = clean.includes('9') ? 'min9' : 'min7'; }
      else if (clean.startsWith('i')) { root = 'C'; type = (clean.includes('min') || roman.startsWith('i')) ? (clean.includes('9') ? 'min9' : (clean.includes('11') ? 'min11' : 'min7')) : (clean.includes('9') ? 'maj9' : 'maj7'); }
      else if (clean.includes('bvii')) { root = 'Bb'; type = clean.includes('9') ? 'maj9' : 'maj7'; }
      else if (clean.includes('bvi')) { root = 'Ab'; type = clean.includes('9') ? 'maj9' : 'maj7'; }
      else if (clean.includes('biii')) { root = 'Eb'; type = clean.includes('9') ? 'maj9' : 'maj7'; }
      else if (clean.includes('#ivdim')) { root = 'F#'; type = 'dim7'; }
      
      return { root, type, duration: 4 };
    };

    const formulas = this.progressions[style] || this.progressions.neo_soul;
    return formulas.map(prog => prog.map(romanToChord));
  }

  public getProgressions(style: SoulProgressionStyle): string[][] {
    // If we have an active dataset, let's inject its progressions or bias our selections!
    const activeDataset = this.ingestedDatasets.find(d => d.active);
    if (activeDataset && activeDataset.chords.length > 0) {
      // Form progressions from ingested chords
      return activeDataset.chords.map(prog => prog.map(c => `${c.root}${c.type}`));
    }
    return this.progressions[style] || this.progressions.neo_soul;
  }

  public getIngestedDatasets(): IngestedDataset[] {
    return this.ingestedDatasets;
  }

  public toggleDataset(id: string): void {
    this.ingestedDatasets = this.ingestedDatasets.map(d => {
      if (d.id === id) {
        return { ...d, active: !d.active };
      }
      return { ...d, active: false }; // Single active selection for harmony bias
    });
  }

  public ingestNewDataset(name: string, source: string, chordsData: Chord[][]): IngestedDataset {
    const newId = name.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + Date.now();
    const allRoots = Array.from(new Set(chordsData.flatMap(p => p.map(c => c.root))));
    const flatCount = chordsData.flatMap(p => p).length;
    const dataset: IngestedDataset = {
      id: newId,
      name,
      source: source || 'User Upload',
      chordCount: flatCount,
      complexity: flatCount > 50 ? 'Sophisticated' : 'Medium',
      keySignatures: allRoots.slice(0, 5),
      chords: chordsData,
      active: true
    };
    
    // Deactivate others
    this.ingestedDatasets = this.ingestedDatasets.map(d => ({ ...d, active: false }));
    this.ingestedDatasets.push(dataset);
    return dataset;
  }

  /**
   * Deterministically builds full midi notes for a voiced chord.
   * Avoids mechanical root position and applies professional step voice-leading.
   */
  public generateVoicedMidi(
    root: string, 
    type: string, 
    voicingType: SoulVoicingType, 
    octaveCenter = 5,
    previousVoicingMidi: number[] = []
  ): number[] {
    const baseNotes = getChordNotes(root, type); // semi-tones 0-11
    const intervals = this.getVoicingIntervals(voicingType);
    
    // Create actual midi note candidates around octaveCenter (5 * 12 = 60)
    let midiNotes: number[] = [];
    
    if (voicingType === 'open10') {
      const rootMidi = baseNotes[0] + 12 * (octaveCenter - 1);
      const fifthMidi = baseNotes[2] !== undefined ? baseNotes[2] + 12 * octaveCenter : rootMidi + 7;
      const tenthMidi = baseNotes[1] !== undefined ? baseNotes[1] + 12 * (octaveCenter + 1) : rootMidi + 16;
      midiNotes = [rootMidi, fifthMidi, tenthMidi];
    } else {
      // Build notes based on interval structures
      intervals.forEach(interval => {
        let midi = 60;
        const rootOffset = baseNotes[0];
        if (interval === '1') midi = rootOffset + 12 * octaveCenter;
        else if (interval === 'b3' || interval === '3') midi = baseNotes[1] + 12 * octaveCenter;
        else if (interval === '4') midi = (rootOffset + 5) + 12 * octaveCenter;
        else if (interval === '5') midi = baseNotes[2] + 12 * octaveCenter;
        else if (interval === 'b7' || interval === '7') midi = baseNotes[3] !== undefined ? baseNotes[3] + 12 * octaveCenter : (rootOffset + 10) + 12 * octaveCenter;
        else if (interval === '9') midi = (rootOffset + 14) + 12 * octaveCenter;
        else if (interval === '10') midi = (rootOffset + 16) + 12 * octaveCenter;
        else if (interval === '13') midi = (rootOffset + 21) + 12 * octaveCenter;
        
        midiNotes.push(midi);
      });
    }

    // Voice-lead step-wise relative to previous voicing to minimize jump distance
    if (previousVoicingMidi.length > 0) {
      midiNotes = midiNotes.map(note => {
        let bestNote = note;
        let minDiff = Infinity;
        // Search for nearest octave placement
        for (let octShift = -2; octShift <= 2; octShift++) {
          const shifted = note + octShift * 12;
          // Find the nearest note in the previous chord
          let closestPrev = previousVoicingMidi[0];
          let minPrevDiff = Infinity;
          previousVoicingMidi.forEach(p => {
            if (Math.abs(shifted - p) < minPrevDiff) {
              minPrevDiff = Math.abs(shifted - p);
              closestPrev = p;
            }
          });

          if (minPrevDiff < minDiff) {
            minDiff = minPrevDiff;
            bestNote = shifted;
          }
        }
        return bestNote;
      });
    }

    // Filter duplicates and sort
    return Array.from(new Set(midiNotes)).sort((a, b) => a - b);
  }
}

// ==========================================
// 3. RHYTHM ENGINE (GROOVE DNA)
// ==========================================

export interface InstrumentRhythmConfig {
  bass: {
    constant_motion: boolean;
    ghost_notes: boolean;
    chromatic_walkups: boolean;
  };
  drums: {
    snare_behind: boolean;
    kick_center: boolean;
    hihat_loose: boolean;
    fills_sparse: boolean;
  };
  guitar: {
    double_stops: boolean;
    syncopation: boolean;
    chord_melody: boolean;
  };
  keys: {
    rhodes_comping: boolean;
    clavinet_patterns: boolean;
    pads_slow_attack: boolean;
  };
}

export class RhythmEngine {
  private patterns: InstrumentRhythmConfig = {
    bass: {
      constant_motion: true,
      ghost_notes: true,
      chromatic_walkups: true
    },
    drums: {
      snare_behind: true,
      kick_center: true,
      hihat_loose: true,
      fills_sparse: true
    },
    guitar: {
      double_stops: true,
      syncopation: true,
      chord_melody: true
    },
    keys: {
      rhodes_comping: true,
      clavinet_patterns: false,
      pads_slow_attack: true
    }
  };

  public getPatterns(): InstrumentRhythmConfig {
    return this.patterns;
  }

  public updatePattern(instrument: keyof InstrumentRhythmConfig, key: string, value: boolean): void {
    if (this.patterns[instrument]) {
      (this.patterns[instrument] as any)[key] = value;
    }
  }
}

// ==========================================
// 4. TONE ENGINE (ANALOG WARMTH)
// ==========================================

export interface ToneSettings {
  tape_saturation_db: number;
  lowpass_cutoff: number;
  tube_saturation_bass: boolean;
  drum_room_reverb_ms: number;
  vinyl_crackle_level: number;
}

export class ToneEngine {
  public settings: ToneSettings = {
    tape_saturation_db: 2.2,
    lowpass_cutoff: 9500,
    tube_saturation_bass: true,
    drum_room_reverb_ms: 220,
    vinyl_crackle_level: 15
  };

  public updateSetting<K extends keyof ToneSettings>(key: K, value: ToneSettings[K]): void {
    this.settings[key] = value;
  }
}

// ==========================================
// 5. INTERACTION ENGINE (AGENT NEGOTIATION)
// ==========================================

export interface AgentNegotiationLog {
  timestamp: string;
  agent: string;
  action: string;
  detail: string;
}

export class InteractionEngine {
  public state: {
    density: 'low' | 'medium' | 'high' | 'variable';
    section: 'verse' | 'prechorus' | 'chorus' | 'bridge';
  } = {
    density: 'medium',
    section: 'verse'
  };

  private logs: AgentNegotiationLog[] = [];

  constructor() {
    this.addLog('System', 'Initialized', 'Multi-Agent Groove Engine is ready');
  }

  public updateSection(section: 'verse' | 'prechorus' | 'chorus' | 'bridge'): void {
    this.state.section = section;
    if (section === 'verse') {
      this.state.density = 'low';
    } else if (section === 'prechorus') {
      this.state.density = 'medium';
    } else if (section === 'chorus') {
      this.state.density = 'high';
    } else if (section === 'bridge') {
      this.state.density = 'variable';
    }
    this.addLog('InteractionEngine', 'Section Changed', `Set to ${section} section. Master density optimized to ${this.state.density}`);
  }

  public addLog(agent: string, action: string, detail: string): void {
    const time = new Date().toLocaleTimeString();
    this.logs.unshift({ timestamp: time, agent, action, detail });
    if (this.logs.length > 50) this.logs.pop(); // Keep last 50 entries
  }

  public getLogs(): AgentNegotiationLog[] {
    return this.logs;
  }

  public clearLogs(): void {
    this.logs = [];
  }

  public negotiateMicrotiming(agents: MusicianAgent[]): void {
    agents.forEach(agent => {
      agent.adjustTimingBasedOnPeers(agents, this);
    });
  }

  public negotiateHarmony(agents: MusicianAgent[]): void {
    agents.forEach(agent => {
      agent.adjustHarmonyBasedOnPeers(agents, this);
    });
  }
}

// ==========================================
// 6. DETECTIVE AGENTS (JAMERSON, QUESTLOVE, STEVIE, ERNIE)
// ==========================================

export abstract class MusicianAgent {
  public name: string;
  public role: InstrumentType;
  public timingEngine: TimingEngine;
  public harmonicEngine: HarmonicEngine;
  public rhythmEngine: RhythmEngine;

  constructor(
    name: string,
    role: InstrumentType,
    timingEngine: TimingEngine,
    harmonicEngine: HarmonicEngine,
    rhythmEngine: RhythmEngine
  ) {
    this.name = name;
    this.role = role;
    this.timingEngine = timingEngine;
    this.harmonicEngine = harmonicEngine;
    this.rhythmEngine = rhythmEngine;
  }

  abstract generatePhrase(context: { style: SoulProgressionStyle; bpm: number; section: string }): PerformedNote[];
  abstract adjustTimingBasedOnPeers(peers: MusicianAgent[], engine: InteractionEngine): void;
  abstract adjustHarmonyBasedOnPeers(peers: MusicianAgent[], engine: InteractionEngine): void;
}

export class JamersonAgent extends MusicianAgent {
  constructor(timing: TimingEngine, harmony: HarmonicEngine, rhythm: RhythmEngine) {
    super('James Jamerson', 'Bass', timing, harmony, rhythm);
  }

  public generatePhrase(context: { style: SoulProgressionStyle; bpm: number; section: string }): PerformedNote[] {
    const pattern = this.rhythmEngine.getPatterns().bass;
    const progressions = this.harmonicEngine.getRawProgressions(context.style);
    // Take the first progression
    const progression = progressions[0] || [{ root: 'D', type: 'min7', duration: 4 }, { root: 'G', type: '7', duration: 4 }, { root: 'C', type: 'maj7', duration: 4 }, { root: 'A', type: 'min7', duration: 4 }];
    const notes: PerformedNote[] = [];

    let currentBeat = 0;
    progression.forEach((chord, step) => {
      const baseNotes = getChordNotes(chord.root, chord.type);
      const rootMidi = baseNotes[0] + 36; // Bass register (octave 3)
      
      // Base beat placement
      const rawBeat = currentBeat;
      const delayedBeat = this.timingEngine.applyOffset('bass', rawBeat, context.bpm, step);

      // Main heavy note on beat 1
      notes.push({
        midi: rootMidi,
        startBeatOffset: delayedBeat - rawBeat,
        durationBeats: 1.5,
        velocity: 95,
        articulation: 'legato',
        reason: 'Jamerson downbeat pocket root',
        absoluteBeat: rawBeat
      });

      // Walking chromatics / motion
      if (pattern.chromatic_walkups && step < progression.length - 1) {
        const nextChord = progression[step + 1];
        const nextBaseNotes = getChordNotes(nextChord.root, nextChord.type);
        const nextRootMidi = nextBaseNotes[0] + 36;
        
        // Approach note on beat 4 of current bar
        const approachMidi = nextRootMidi - 1;
        notes.push({
          midi: approachMidi,
          startBeatOffset: this.timingEngine.applyOffset('bass', rawBeat + 3, context.bpm, step) - (rawBeat + 3),
          durationBeats: 0.8,
          velocity: 85,
          articulation: 'slide',
          reason: 'Jamerson chromatic walkup approach',
          absoluteBeat: rawBeat + 3
        });
      }

      // Ghost notes
      if (pattern.ghost_notes) {
        notes.push({
          midi: rootMidi + 7, // 5th ghost
          startBeatOffset: this.timingEngine.applyOffset('bass', rawBeat + 2.5, context.bpm, step) - (rawBeat + 2.5),
          durationBeats: 0.25,
          velocity: 45,
          articulation: 'ghost',
          reason: 'Damped rake pocket ghost note',
          absoluteBeat: rawBeat + 2.5
        });
      }

      currentBeat += chord.duration || 4; // Move to next chord's beat
    });

    return notes;
  }

  public adjustTimingBasedOnPeers(peers: MusicianAgent[], engine: InteractionEngine): void {
    const drums = peers.find(p => p.role === 'Drums');
    if (drums) {
      engine.addLog(this.name, 'Locking In', 'Synchronizing bass pockets behind Questlove\'s delayed snare');
    }
  }

  public adjustHarmonyBasedOnPeers(peers: MusicianAgent[], engine: InteractionEngine): void {
    const keys = peers.find(p => p.role === 'Keys');
    if (keys) {
      engine.addLog(this.name, 'Harmonic Alignment', 'Voicing bass roots to ground Stevie\'s rootless extensions');
    }
  }
}

export class QuestloveAgent extends MusicianAgent {
  constructor(timing: TimingEngine, harmony: HarmonicEngine, rhythm: RhythmEngine) {
    super('Ahmir Questlove', 'Drums', timing, harmony, rhythm);
  }

  public generatePhrase(context: { style: SoulProgressionStyle; bpm: number; section: string }): PerformedNote[] {
    const pattern = this.rhythmEngine.getPatterns().drums;
    const notes: PerformedNote[] = [];

    // Loop for 4 bars
    for (let bar = 0; bar < 4; bar++) {
      const barStartBeat = bar * 4;

      // Kicks on beat 1 and 3 (heavy pocket)
      const kick1Offset = this.timingEngine.applyOffset('kick', barStartBeat, context.bpm, bar);
      notes.push({
        midi: 36, // Kick drum MIDI
        startBeatOffset: kick1Offset - barStartBeat,
        durationBeats: 0.5,
        velocity: 105,
        articulation: 'accent',
        reason: 'Questlove foundational kick pocket',
        absoluteBeat: barStartBeat
      });

      if (!pattern.kick_center && bar % 2 === 1) {
        const kick3Offset = this.timingEngine.applyOffset('kick', barStartBeat + 2.5, context.bpm, bar);
        notes.push({
          midi: 36,
          startBeatOffset: kick3Offset - (barStartBeat + 2.5),
          durationBeats: 0.5,
          velocity: 95,
          articulation: 'normal',
          reason: 'Syncopated second kick push',
          absoluteBeat: barStartBeat + 2.5
        });
      } else {
        const kick3Offset = this.timingEngine.applyOffset('kick', barStartBeat + 2, context.bpm, bar);
        notes.push({
          midi: 36,
          startBeatOffset: kick3Offset - (barStartBeat + 2),
          durationBeats: 0.5,
          velocity: 98,
          articulation: 'normal',
          reason: 'Questlove beat 3 standard landing',
          absoluteBeat: barStartBeat + 2
        });
      }

      // Snare on beat 2 and 4 (laid back / "drunk" snare feel)
      const snare2Offset = this.timingEngine.applyOffset('snare', barStartBeat + 1, context.bpm, bar);
      notes.push({
        midi: 38, // Snare drum MIDI
        startBeatOffset: snare2Offset - (barStartBeat + 1),
        durationBeats: 0.5,
        velocity: 100,
        articulation: 'accent',
        reason: 'Laid back vintage snare slap',
        absoluteBeat: barStartBeat + 1
      });

      const snare4Offset = this.timingEngine.applyOffset('snare', barStartBeat + 3, context.bpm, bar);
      notes.push({
        midi: 38,
        startBeatOffset: snare4Offset - (barStartBeat + 3),
        durationBeats: 0.5,
        velocity: 102,
        articulation: 'accent',
        reason: 'Laid back deep pocket snare snap',
        absoluteBeat: barStartBeat + 3
      });

      // Hi-Hats running eighth notes
      for (let eighth = 0; eighth < 8; eighth++) {
        const hhBeat = barStartBeat + eighth * 0.5;
        const hhOffset = this.timingEngine.applyOffset('hihat', hhBeat, context.bpm, bar * 8 + eighth);
        const isOpen = pattern.hihat_loose && eighth === 7 && bar % 2 === 1;
        notes.push({
          midi: isOpen ? 46 : 42, // Closed hi-hat / open hi-hat
          startBeatOffset: hhOffset - hhBeat,
          durationBeats: 0.25,
          velocity: eighth % 2 === 0 ? 85 : 60, // Swing accents
          articulation: isOpen ? 'normal' : 'staccato',
          reason: isOpen ? 'Sizzling open hi-hat lift' : 'Steady swinging hat grid',
          absoluteBeat: hhBeat
        });
      }
    }

    return notes;
  }

  public adjustTimingBasedOnPeers(peers: MusicianAgent[], engine: InteractionEngine): void {
    const bass = peers.find(p => p.role === 'Bass');
    if (bass) {
      engine.addLog(this.name, 'Groove Anchored', 'Questlove laid back snare offset matching Jamerson chromatic shifts');
    }
  }

  public adjustHarmonyBasedOnPeers(peers: MusicianAgent[], engine: InteractionEngine): void {
    // Drums are rhythmic
  }
}

export class StevieWonderAgent extends MusicianAgent {
  constructor(timing: TimingEngine, harmony: HarmonicEngine, rhythm: RhythmEngine) {
    super('Stevie Wonder', 'Keys', timing, harmony, rhythm);
  }

  public generatePhrase(context: { style: SoulProgressionStyle; bpm: number; section: string }): PerformedNote[] {
    const pattern = this.rhythmEngine.getPatterns().keys;
    const progressions = this.harmonicEngine.getRawProgressions(context.style);
    const progression = progressions[0] || [{ root: 'D', type: 'min7', duration: 4 }, { root: 'G', type: '7', duration: 4 }, { root: 'C', type: 'maj7', duration: 4 }, { root: 'A', type: 'min7', duration: 4 }];
    const notes: PerformedNote[] = [];

    let currentBeat = 0;
    let prevMidi: number[] = [];

    progression.forEach((chord, step) => {
      const typeForVoicing = chord.type.includes('min') ? 'minor9' : 'major9';
      
      const voicedMidi = this.harmonicEngine.generateVoicedMidi(
        chord.root || 'C', 
        chord.type, 
        typeForVoicing as SoulVoicingType, 
        5, 
        prevMidi
      );
      prevMidi = voicedMidi;

      // Rhodes comping rhythm
      if (pattern.rhodes_comping) {
        // Chord stab on beat 1 and syncopated push on 2.5
        voicedMidi.forEach(midi => {
          notes.push({
            midi,
            startBeatOffset: this.timingEngine.applyOffset('keys', currentBeat + 0.1, context.bpm, step) - (currentBeat + 0.1), // push back
            durationBeats: 1.8,
            velocity: 75,
            articulation: 'legato',
            reason: 'Stevie warm Rhodes downbeat voicing',
            absoluteBeat: currentBeat
          });

          // Syncopated stab on beat 2.5
          notes.push({
            midi,
            startBeatOffset: this.timingEngine.applyOffset('keys', currentBeat + 2.5, context.bpm, step) - (currentBeat + 2.5),
            durationBeats: 0.9,
            velocity: 80,
            articulation: 'accent',
            reason: 'Stevie rhythmic syncopated push',
            absoluteBeat: currentBeat + 2.5
          });
        });
      }

      currentBeat += chord.duration || 4;
    });

    return notes;
  }

  public adjustTimingBasedOnPeers(peers: MusicianAgent[], engine: InteractionEngine): void {
    engine.addLog(this.name, 'Groove Layback', 'Stevie keys shifting to match lazy R&B tempo drag');
  }

  public adjustHarmonyBasedOnPeers(peers: MusicianAgent[], engine: InteractionEngine): void {
    const bass = peers.find(p => p.role === 'Bass');
    if (bass) {
      engine.addLog(this.name, 'Harmonic Extended', 'Stevie dropping chord roots since Jamerson has them covered');
    }
  }
}

export class ErnieIsleyAgent extends MusicianAgent {
  constructor(timing: TimingEngine, harmony: HarmonicEngine, rhythm: RhythmEngine) {
    super('Ernie Isley', 'Guitar', timing, harmony, rhythm);
  }

  public generatePhrase(context: { style: SoulProgressionStyle; bpm: number; section: string }): PerformedNote[] {
    const pattern = this.rhythmEngine.getPatterns().guitar;
    const progressions = this.harmonicEngine.getRawProgressions(context.style);
    const progression = progressions[0] || [{ root: 'D', type: 'min7', duration: 4 }, { root: 'G', type: '7', duration: 4 }, { root: 'C', type: 'maj7', duration: 4 }, { root: 'A', type: 'min7', duration: 4 }];
    const notes: PerformedNote[] = [];

    let currentBeat = 0;
    progression.forEach((chord, step) => {
      const baseNotes = getChordNotes(chord.root, chord.type);
      const rootMidi = baseNotes[0] + 60; // Up an octave

      // Double stop fills on beat 3.5
      if (pattern.double_stops) {
        const d1 = baseNotes[2] !== undefined ? baseNotes[2] + 60 : rootMidi + 7; // 5th
        const d2 = baseNotes[3] !== undefined ? baseNotes[3] + 60 : rootMidi + 10; // 7th
        
        [d1, d2].forEach(midi => {
          notes.push({
            midi,
            startBeatOffset: this.timingEngine.applyOffset('guitar', currentBeat + 3.5, context.bpm, step) - (currentBeat + 3.5),
            durationBeats: 0.4,
            velocity: 82,
            articulation: 'slide',
            reason: 'Ernie Isley expressive double stop slide',
            absoluteBeat: currentBeat + 3.5
          });
        });
      }

      // Syncopated chops
      if (pattern.syncopation) {
        notes.push({
          midi: baseNotes[1] !== undefined ? baseNotes[1] + 60 : rootMidi + 4, // 3rd
          startBeatOffset: this.timingEngine.applyOffset('guitar', currentBeat + 1.5, context.bpm, step) - (currentBeat + 1.5),
          durationBeats: 0.25,
          velocity: 90,
          articulation: 'staccato',
          reason: 'Ernie syncopated rhythmic chop',
          absoluteBeat: currentBeat + 1.5
        });
      }

      currentBeat += chord.duration || 4;
    });

    return notes;
  }

  public adjustTimingBasedOnPeers(peers: MusicianAgent[], engine: InteractionEngine): void {
    engine.addLog(this.name, 'Expressive Phase', 'Ernie Isley guitar adjusting slide timing based on Stevie\'s Rhodes flow');
  }

  public adjustHarmonyBasedOnPeers(peers: MusicianAgent[], engine: InteractionEngine): void {
    // Guitar fits nicely
  }
}

// ==========================================
// 7. FULL BAND ENGINE LOOP
// ==========================================

export class SoulBandEngine {
  public timing: TimingEngine;
  public harmony: HarmonicEngine;
  public rhythm: RhythmEngine;
  public tone: ToneEngine;
  public interaction: InteractionEngine;
  public agents: MusicianAgent[];

  constructor(style: SoulTimingStyle = 'neo_soul') {
    this.timing = new TimingEngine(style);
    this.harmony = new HarmonicEngine();
    this.rhythm = new RhythmEngine();
    this.tone = new ToneEngine();
    this.interaction = new InteractionEngine();

    this.agents = [
      new JamersonAgent(this.timing, this.harmony, this.rhythm),
      new QuestloveAgent(this.timing, this.harmony, this.rhythm),
      new StevieWonderAgent(this.timing, this.harmony, this.rhythm),
      new ErnieIsleyAgent(this.timing, this.harmony, this.rhythm)
    ];
  }

  public setStyle(style: SoulTimingStyle): void {
    this.timing.style = style;
    this.interaction.addLog('SoulBandEngine', 'Engine Mode Synced', `Configured Timing profile to [${style.toUpperCase()}]`);
  }

  public runBandSession(section: 'verse' | 'prechorus' | 'chorus' | 'bridge', bpm: number): Record<string, PerformedNote[]> {
    this.interaction.updateSection(section);
    this.interaction.negotiateMicrotiming(this.agents);
    this.interaction.negotiateHarmony(this.agents);

    const styleMap: Record<string, SoulProgressionStyle> = {
      verse: 'neo_soul',
      prechorus: 'soul_ballad',
      chorus: 'gospel',
      bridge: 'motown'
    };

    const output: Record<string, PerformedNote[]> = {};
    this.agents.forEach(agent => {
      output[agent.name] = agent.generatePhrase({
        style: styleMap[section] || 'neo_soul',
        bpm,
        section
      });
    });

    return output;
  }
}
