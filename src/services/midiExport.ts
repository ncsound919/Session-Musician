/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { Chord, SessionParameters, PerformedNote, Song, InstrumentType, InstrumentState } from '../types';
import { getChordVoicingWithInversion } from './musicTheoryEngine';
import { applySophistication, SophisticationLevel } from './sophisticationEngine';
import { generatePerformance, resolveProfile } from './performanceEngine';

const defaultParams: SessionParameters = {
  genre: 'Jazz',
  era: 'Modern',
  vibe: 'Chill',
  notationStyle: 'Standard',
  playStyle: 'Standard',
  groove: 50,
  sparseness: 50,
  pocket: 50,
  humanize: 50,
  syncopation: 50,
  harmony: 'Extended',
  voicing: 'Open',
  mood: 'Bright',
  energy: 50
};

export const TICKS_PER_BEAT = 480;

export const NOTE_MAP: Record<string, number> = {
  'C': 60, 'C#': 61, 'D': 62, 'D#': 63, 'E': 64, 'F': 65,
  'F#': 66, 'G': 67, 'G#': 68, 'A': 69, 'A#': 70, 'B': 71
};

export function applyGrooveOffset(tick: number, grooveVal: number): number {
  const positionInBeat = tick % TICKS_PER_BEAT;
  
  // Handle subdivisions for more nuanced swing
  if (positionInBeat === 240) { // Eighth-note off-beat
    const maxSwingTicks = 85; // Slightly wider range for Dilla swing
    const swingOffset = Math.round((grooveVal / 100) * maxSwingTicks);
    return tick + swingOffset;
  } else if (positionInBeat === 120 || positionInBeat === 360) { // Sixteenth-note off-beat
    const maxSwingTicks = 45;
    const swingOffset = Math.round((grooveVal / 100) * maxSwingTicks);
    return tick + swingOffset;
  }
  return tick;
}

/**
 * Helper to resolve the correct pitch for a bass note degree while avoiding theory clashes.
 * @param chord The current chord context
 * @param degree 0=Root, 1=Third, 2=Fifth, 3=Seventh/Ninth/etc
 * @param octave Octave offset from default bass range
 */
function getBassPitch(chord: Chord, degree: number, octave: number = 0): number {
  const bassBase = (NOTE_MAP[chord.root] ?? 60) - 24 + (octave * 12);
  
  // SAFE INTERVAL CONSTRAINT FOR DIMINISHED & AUGMENTED CHORDS:
  // Prevent any standard third/fifth clash by restricting bass pitches to either root or altered fifths.
  if (chord.type === 'dim' || chord.type === 'aug') {
    if (degree === 2) {
      // Return altered fifths (6 semitones for dim, 8 for aug)
      const alteredFifthOffset = chord.type === 'dim' ? 6 : 8;
      return bassBase + alteredFifthOffset;
    }
    // For all other degrees (like third), force root to avoid any dissonant beating
    return bassBase;
  }

  const semitones = chordSemitones(chord.type);
  
  // If the requested degree doesn't exist in the chord (e.g. asking for 5th in a power chord),
  // we fallback to the closest safe interval or octaves.
  if (semitones[degree] !== undefined) {
    return bassBase + semitones[degree];
  }
  
  // Safety: If asking for 5th but it's not in our list, use root octave
  if (degree === 2) return bassBase + 12; 
  return bassBase;
}

export function shouldSkipNote(tick: number, sparseness: number, syncopation: number = 50): boolean {
  if (sparseness <= 0) return false;
  
  const positionInBar = tick % (TICKS_PER_BEAT * 4);
  const positionInBeat = tick % TICKS_PER_BEAT;
  
  if (positionInBar === 0) return false; // never skip absolute downbeat of bar
  
  // Syncopation factor: 0 means we prefer on-beats, 100 means we prefer off-beats
  const isOnBeat = positionInBeat === 0;
  let skipProbability = sparseness;
  
  if (isOnBeat) {
    // If syncopation is high, we skip ON-beats more often
    skipProbability += (syncopation - 50) * 0.5;
  } else {
    // If syncopation is high, we skip OFF-beats LESS often
    skipProbability -= (syncopation - 50) * 0.5;
  }
  
  return Math.random() * 100 < Math.max(5, skipProbability);
}

export interface MidiEvent {
  tick: number;
  status: number;
  data: number[];
}

function varLen(value: number): number[] {
  const bytes: number[] = [];
  bytes.push(value & 0x7f);
  let v = value >> 7;
  while (v > 0) {
    bytes.unshift((v & 0x7f) | 0x80);
    v >>= 7;
  }
  return bytes;
}

function chordSemitones(type: string): number[] {
  switch (type) {
    case 'min':   return [0, 3, 7];
    case '7':     return [0, 4, 7, 10];
    case 'maj7':  return [0, 4, 7, 11];
    case 'min7':  return [0, 3, 7, 10];
    case 'dim':   return [0, 3, 6];
    case 'aug':   return [0, 4, 8];
    case 'sus4':  return [0, 5, 7];
    case '9':     return [0, 4, 7, 10, 14];
    default:      return [0, 4, 7]; // maj
  }
}

function compileTrack(events: MidiEvent[]): number[] {
  // Sort events by absolute tick
  events.sort((a, b) => {
    if (a.tick !== b.tick) return a.tick - b.tick;
    // Note Off (0x80) should precede Note On (0x90) for cleaner overlapping
    const statusA = a.status & 0xf0;
    const statusB = b.status & 0xf0;
    if (statusA !== statusB) {
      if (statusA === 0x80) return -1;
      if (statusB === 0x80) return 1;
    }
    return 0;
  });

  const trackEvents: number[] = [];
  let lastTick = 0;
  for (const ev of events) {
    const delta = ev.tick - lastTick;
    lastTick = ev.tick;
    trackEvents.push(...varLen(delta), ev.status, ...ev.data);
  }

  // End of Track meta-event
  trackEvents.push(...varLen(0), 0xff, 0x2f, 0x00);

  const len = trackEvents.length;
  return [
    0x4d, 0x54, 0x72, 0x6b, // "MTrk"
    (len >> 24) & 0xff,
    (len >> 16) & 0xff,
    (len >> 8) & 0xff,
    len & 0xff,
    ...trackEvents
  ];
}

function buildTrackNameEvent(name: string): MidiEvent {
  const bytes = Array.from(name).map(c => c.charCodeAt(0));
  return {
    tick: 0,
    status: 0xff,
    data: [0x03, bytes.length, ...bytes]
  };
}

// --- Dynamic Generators for Individual Sections ---

export function generateDrums(
  chords: Chord[], 
  playStyle: string, 
  groove: number, 
  sparseness: number, 
  pocket: number, 
  humanize: number, 
  syncopation: number, 
  tactileInject?: string,
  perDrumPocket?: Record<string, number>,
  perDrumSwing?: Record<string, number>
): MidiEvent[] {
  const events: MidiEvent[] = [];
  let currentTick = 0;

  for (let cIdx = 0; cIdx < chords.length; cIdx++) {
    const chord = chords[cIdx];
    const durationBeats = chord.duration;
    
    for (let beat = 0; beat < durationBeats; beat++) {
      const beatTick = currentTick + beat * TICKS_PER_BEAT;
      const beatInBar = (beatTick / TICKS_PER_BEAT) % 4;
      
      const getDrumTiming = (drumType: string) => {
        const dPocket = perDrumPocket?.[drumType] ?? pocket;
        const dSwing = perDrumSwing?.[drumType] ?? groove;

        const maxOffsetMs = 24;
        const offsetMs = ((100 - dPocket) / 100) * maxOffsetMs;
        const ticksPerMs = (120 * TICKS_PER_BEAT) / 60000;
        const pocketOffsetTicks = Math.round(offsetMs * ticksPerMs);

        const maxHumanizeOffset = (humanize / 100) * 14;
        const humanizeOffset = Math.round((Math.random() - 0.5) * maxHumanizeOffset);
        
        return { offset: pocketOffsetTicks + humanizeOffset, swing: dSwing };
      };

      const addDrumEvent = (tick: number, note: number, vel: number, dur = 120, isPrimary = false) => {
        if (!isPrimary && shouldSkipNote(tick, sparseness, syncopation)) return;
        
        let drumType = 'Percussion';
        if (note === 36) drumType = 'Kick';
        else if (note === 38) drumType = 'Snare';
        else if (note === 42 || note === 44 || note === 46) drumType = 'HiHat';

        const { offset, swing } = getDrumTiming(drumType);
        const groovedTick = applyGrooveOffset(tick, swing);

        const velVar = Math.round((Math.random() - 0.5) * (humanize / 100) * 22);
        const finalVel = Math.max(1, Math.min(127, vel + velVar));
        
        events.push({
          tick: Math.max(0, groovedTick + offset),
          status: 0x99, 
          data: [note, finalVel]
        });
        events.push({
          tick: Math.max(0, groovedTick + offset + dur),
          status: 0x89, 
          data: [note, 0]
        });
      };

      if (playStyle === 'Ahmad Jamal Space') {
        // Ahmad Jamal: Dramatic space, sparse kick/snare, heavy emphasis on piano-like rhythmic stabs (simulated)
        if (beatInBar === 0 && Math.random() > 0.4) {
          addDrumEvent(beatTick, 36, 90, 100, true);
        }
        if (beatInBar === 1 && Math.random() > 0.6) {
          addDrumEvent(beatTick + 240, 38, 85, 40); // Ghost snare
        }
        if (beatInBar === 2) {
          addDrumEvent(beatTick, 36, 95, 100, true);
        }
        if (beatInBar === 3) {
          addDrumEvent(beatTick + 120, 38, 110, 60, true); // Sharp rimshot
        }
        // Sophisticated ride pattern
        addDrumEvent(beatTick, 51, 80, 40);
        addDrumEvent(beatTick + 320, 51, 60, 40);
      }
      else if (playStyle === 'Tame Psych') {
        // Tame Impala: Heavily compressed feel, steady 8th notes, "lazy" snare
        addDrumEvent(beatTick, 42, 100, 40); // 8th note hats
        addDrumEvent(beatTick + 240, 42, 90, 40);

        if (beatInBar === 0 || beatInBar === 2) {
          addDrumEvent(beatTick, 36, 110, 150, true);
        }
        if (beatInBar === 1 || beatInBar === 3) {
          addDrumEvent(beatTick + 20, 38, 115, 100, true); // Slightly late, fat snare
        }
      }
      else if (playStyle === 'Deep House 4/4') {
        // Straight 4/4 kick, syncopated hats
        addDrumEvent(beatTick, 36, 120, 200, true);
        addDrumEvent(beatTick + 240, 42, 105, 50, true); // Off-beat open hat
        if (beatInBar === 1 || beatInBar === 3) {
          addDrumEvent(beatTick, 38, 110, 100, true);
        }
      }
      else if (playStyle === 'Questlove Displacement') {
        // Questlove: High precision, but snare is intentionally late ("displaced")
        // Tuning is high (simulated via velocity/duration logic here)
        if (beatInBar === 0 || beatInBar === 2) {
          addDrumEvent(beatTick, 36, 105, 80, true); // Tight, dry kick
        }
        if (beatInBar === 1 || beatInBar === 3) {
          // Snare is slightly delayed beyond global pocket for that "lazy" feel
          addDrumEvent(beatTick + 25, 38, 120, 60, true); 
        }
        
        // High, crisp hats
        addDrumEvent(beatTick, 42, 95, 40);
        addDrumEvent(beatTick + 120, 42, 60, 40);
        addDrumEvent(beatTick + 240, 42, 85, 40);
        addDrumEvent(beatTick + 360, 42, 65, 40);
      }
      else if (playStyle === 'J Dilla Unquantized') {
        // J Dilla: Unquantized "wonky" feel. Early kicks, late snares, heavy swing.
        if (beatInBar === 0) {
          addDrumEvent(beatTick - 35, 36, 115, 120, true); // Early kick
        } else if (beatInBar === 2) {
          addDrumEvent(beatTick + 80, 36, 105, 120, true); // Late/rushed kick
        }

        if (beatInBar === 1 || beatInBar === 3) {
          addDrumEvent(beatTick + 45, 38, 110, 120, true); // Very late snare
        }

        // Drunk swing hats
        addDrumEvent(beatTick, 42, 90);
        addDrumEvent(beatTick + 300, 42, 80); // Extreme swing placement
      }
      else if (playStyle === 'Purdie Shuffle') {
        if (beatInBar === 0) {
          addDrumEvent(beatTick, 36, 110, 120, true);
        } else if (beatInBar === 2) {
          addDrumEvent(beatTick, 36, 105, 120, true);
          addDrumEvent(beatTick + 320, 36, 85);
        }
        
        if (beatInBar === 1 || beatInBar === 3) {
          addDrumEvent(beatTick, 38, 120, 120, true);
        } else {
          addDrumEvent(beatTick + 160, 38, 45);
          addDrumEvent(beatTick + 320, 38, 50);
        }

        addDrumEvent(beatTick, 42, 95);
        addDrumEvent(beatTick + 160, 42, 50);
        addDrumEvent(beatTick + 320, 42, 85);
      } 
      else if (playStyle === 'Stubblefield Breakbeat') {
        if (beatInBar === 0) {
          addDrumEvent(beatTick, 36, 115, 120, true);
          addDrumEvent(beatTick + 240, 36, 95);
        } else if (beatInBar === 2) {
          addDrumEvent(beatTick + 120, 36, 100);
          addDrumEvent(beatTick + 360, 36, 90);
        }

        if (beatInBar === 1 || beatInBar === 3) {
          addDrumEvent(beatTick, 38, 120, 120, true);
          addDrumEvent(beatTick + 360, 38, 50);
        } else {
          addDrumEvent(beatTick + 120, 38, 45);
          addDrumEvent(beatTick + 240, 38, 48);
        }

        addDrumEvent(beatTick, 42, 90);
        addDrumEvent(beatTick + 120, 42, 70);
        if (beatInBar === 1 || beatInBar === 3) {
          addDrumEvent(beatTick + 240, 46, 100);
          addDrumEvent(beatTick + 360, 42, 80);
        } else {
          addDrumEvent(beatTick + 240, 42, 85);
          addDrumEvent(beatTick + 360, 42, 75);
        }
      } 
      else if (playStyle === 'Al Jackson Backbeat') {
        if (beatInBar === 0 || beatInBar === 2) {
          addDrumEvent(beatTick, 36, 110, 120, true);
        } else if (beatInBar === 1 && Math.random() > 0.6) {
          addDrumEvent(beatTick + 360, 36, 85);
        }

        if (beatInBar === 1 || beatInBar === 3) {
          addDrumEvent(beatTick, 38, 115, 120, true);
        }

        addDrumEvent(beatTick, 42, 85);
        addDrumEvent(beatTick + 240, 42, 75);
      } 
      else if (playStyle === 'Hal Blaine Pocket') {
        if (beatInBar === 0) {
          addDrumEvent(beatTick, 36, 115, 120, true);
          if (cIdx === 0) addDrumEvent(beatTick, 49, 110, 240, true); // Crash
        } else if (beatInBar === 2) {
          addDrumEvent(beatTick, 36, 105, 120, true);
          addDrumEvent(beatTick + 240, 36, 90);
        }

        if (beatInBar === 1 || beatInBar === 3) {
          addDrumEvent(beatTick, 38, 120, 120, true);
        }

        addDrumEvent(beatTick, 42, 90);
        addDrumEvent(beatTick + 240, 42, 80);

        if (cIdx === chords.length - 1 && beatInBar === durationBeats - 1) {
          addDrumEvent(beatTick + 240, 50, 105);
          addDrumEvent(beatTick + 360, 47, 105);
          addDrumEvent(beatTick + 420, 45, 110);
        }
      }
      else if (playStyle === 'Greg Errico Drive') {
        if (beatInBar === 0 || beatInBar === 2) {
          addDrumEvent(beatTick, 36, 110, 120, true);
          if (beatInBar === 2) addDrumEvent(beatTick + 240, 36, 95);
        }
        if (beatInBar === 1 || beatInBar === 3) {
          addDrumEvent(beatTick, 38, 115, 120, true);
        }

        addDrumEvent(beatTick, 51, 95);
        addDrumEvent(beatTick + 240, 53, 105);
      }
      else if (playStyle === 'Boom Bap') {
        // Gritty boom-bap groove
        if (beatInBar === 0) {
          addDrumEvent(beatTick, 36, 120, 120, true); // heavy kick
        } else if (beatInBar === 2) {
          addDrumEvent(beatTick, 36, 110, 120, true);
          addDrumEvent(beatTick + 240, 36, 90); // ghost kick on offbeat
        }

        if (beatInBar === 1 || beatInBar === 3) {
          addDrumEvent(beatTick, 38, 115, 120, true); // snappy snare
        }

        // Swung sixteenth hats
        addDrumEvent(beatTick, 42, 90);
        addDrumEvent(beatTick + 240, 42, 70);
      }
      else if (playStyle === 'Neo-Soul Hop') {
        // Laid back feel, delayed snares and subtle kicks
        if (beatInBar === 0) {
          addDrumEvent(beatTick, 36, 110, 120, true);
        } else if (beatInBar === 2) {
          addDrumEvent(beatTick + 120, 36, 95); // delayed kick roll
          addDrumEvent(beatTick + 360, 36, 85);
        }

        if (beatInBar === 1 || beatInBar === 3) {
          addDrumEvent(beatTick + 30, 38, 105, 120, true); // laid back pocket-delayed snare
        }

        addDrumEvent(beatTick, 42, 85);
        addDrumEvent(beatTick + 120, 42, 45);
        addDrumEvent(beatTick + 240, 42, 75);
        addDrumEvent(beatTick + 360, 42, 50);
      }
      else if (playStyle === 'Lofi Beat') {
        // Filtered soft kicks, wood-rim snares, lazy swing
        if (beatInBar === 0) {
          addDrumEvent(beatTick, 36, 85, 120, true);
        } else if (beatInBar === 2) {
          addDrumEvent(beatTick + 240, 36, 75);
        }

        if (beatInBar === 1 || beatInBar === 3) {
          addDrumEvent(beatTick, 38, 80, 120, true); // rimshot snare
        }

        // Lazy hats
        addDrumEvent(beatTick, 42, 80);
        addDrumEvent(beatTick + 240, 42, 45);
      }
      else if (playStyle === 'Jazz swing') {
        addDrumEvent(beatTick, 51, 85);
        if (beatInBar === 1 || beatInBar === 3) {
          addDrumEvent(beatTick + 320, 51, 75);
        } else {
          addDrumEvent(beatTick + 320, 51, 55);
        }

        if (beatInBar === 1 || beatInBar === 3) {
          addDrumEvent(beatTick, 44, 85);
        }

        addDrumEvent(beatTick, 36, 35);

        if (Math.random() > 0.4) {
          addDrumEvent(beatTick + 160, 40, 40);
        }
      }
      else if (playStyle === 'Four-on-the-floor') {
        addDrumEvent(beatTick, 36, 110, 120, true);
        if (beatInBar === 1 || beatInBar === 3) {
          addDrumEvent(beatTick, 38, 115, 120, true);
        }
        addDrumEvent(beatTick + 240, 46, 95);
      }
      else if (playStyle === 'Gospel Chops') {
        // Gospel style: fast syncopation, rim accents, lightning subdivisions
        if (beatInBar === 0) {
          addDrumEvent(beatTick, 36, 122, 120, true); // explosive kick
          if (cIdx % 2 === 0) addDrumEvent(beatTick, 49, 118, 240, true); // loud crash
        } else if (beatInBar === 2) {
          addDrumEvent(beatTick, 36, 110, 120, true);
          addDrumEvent(beatTick + 160, 36, 95); // double kicks
        }

        if (beatInBar === 1 || beatInBar === 3) {
          addDrumEvent(beatTick, 38, 125, 120, true); // hard cracking rim snare
          addDrumEvent(beatTick + 320, 38, 55); // quiet ghost snare
        } else {
          addDrumEvent(beatTick + 160, 38, 65); // ghost snare rolls
          addDrumEvent(beatTick + 320, 38, 60);
        }

        // Gospel high-speed hats with open splashes
        addDrumEvent(beatTick, 42, 95);
        if (beatInBar === 1 || beatInBar === 3) {
          addDrumEvent(beatTick + 160, 46, 105); // open hat splash
        } else {
          addDrumEvent(beatTick + 160, 42, 85);
        }
        
        // Dynamic tom fills at the end of the chord bar
        if (cIdx === chords.length - 1 && beatInBar === durationBeats - 1) {
          addDrumEvent(beatTick + 160, 50, 115); // high tom
          addDrumEvent(beatTick + 240, 47, 115); // mid tom
          addDrumEvent(beatTick + 320, 45, 120); // floor tom
        }
      }
      else if (playStyle === 'Grunge Power') {
        // Heavy, thick, aggressive 90s alt-rock drive
        if (beatInBar === 0 || beatInBar === 2) {
          addDrumEvent(beatTick, 36, 125, 150, true); // giant heavy kick
          if (beatInBar === 2) {
            addDrumEvent(beatTick + 240, 36, 115, 120); // rapid double-kick
          }
        }
        if (beatInBar === 1 || beatInBar === 3) {
          addDrumEvent(beatTick, 38, 127, 150, true); // slamming rim snare backbeat
        }
        // Heavy open-hihat or crash ride wash
        if (cIdx % 2 === 0) {
          addDrumEvent(beatTick, 49, 110, 180); // crash on 1
        }
        addDrumEvent(beatTick, 46, 112); // driving open hats washing
        addDrumEvent(beatTick + 240, 46, 102);
      }
      else if (playStyle === 'Amen Break') {
        // Legendary Amen Brother break logic with classic double rides & syncopations
        const rideCymbal = 51;
        const snare = 38;
        const kick = 36;
        
        // Ride patterns (steady syncopations)
        addDrumEvent(beatTick, rideCymbal, 105);
        addDrumEvent(beatTick + 240, rideCymbal, 95);
        addDrumEvent(beatTick + 360, rideCymbal, 90);
        
        if (beatInBar === 0) {
          addDrumEvent(beatTick, kick, 120, 120, true);
        } else if (beatInBar === 1) {
          addDrumEvent(beatTick, snare, 125, 120, true); // heavy cracking backbeat snare
          addDrumEvent(beatTick + 360, snare, 65); // ghost roll snare
        } else if (beatInBar === 2) {
          addDrumEvent(beatTick, kick, 115, 120, true);
          addDrumEvent(beatTick + 240, kick, 110, 120); // rapid double kick
        } else if (beatInBar === 3) {
          addDrumEvent(beatTick, snare, 125, 120, true);
          addDrumEvent(beatTick + 120, snare, 60); // ghost
          addDrumEvent(beatTick + 240, snare, 80); // off-beat sync snare
          addDrumEvent(beatTick + 360, kick, 105); // syncopated pickup kick for next bar
        }
      }
      else if (playStyle === 'Funky Drummer') {
        // Clyde Stubblefield's Clyde Break: complex hi-hat control, ghost snares
        const hihat = 42;
        const openHat = 46;
        const snare = 38;
        const kick = 36;
        
        // Dynamic hi-hat groove
        addDrumEvent(beatTick, hihat, 100);
        addDrumEvent(beatTick + 120, hihat, 60);
        addDrumEvent(beatTick + 240, hihat, 90);
        
        if (beatInBar === 1 && cIdx % 2 === 1) {
          addDrumEvent(beatTick + 360, openHat, 110); // iconic open hat splash
        } else {
          addDrumEvent(beatTick + 360, hihat, 70);
        }

        if (beatInBar === 0) {
          addDrumEvent(beatTick, kick, 120, 120, true);
          addDrumEvent(beatTick + 360, snare, 50); // subtle ghost note
        } else if (beatInBar === 1) {
          addDrumEvent(beatTick, snare, 120, 120, true);
          addDrumEvent(beatTick + 240, snare, 55); // ghost note
        } else if (beatInBar === 2) {
          addDrumEvent(beatTick + 120, kick, 110);
          addDrumEvent(beatTick + 240, kick, 95);
          addDrumEvent(beatTick + 360, snare, 55); // ghost
        } else if (beatInBar === 3) {
          addDrumEvent(beatTick, snare, 120, 120, true);
          addDrumEvent(beatTick + 120, snare, 60);
          addDrumEvent(beatTick + 240, kick, 105); // syncopated kick
          addDrumEvent(beatTick + 360, snare, 50); // ghost
        }
      }
      else if (playStyle === 'Think Break') {
        // Lyn Collins' Think break with tambourine / hi-hat layering and high-pitch double snare cracks
        const snare = 38;
        const kick = 36;
        const tamb = 56; // Percussion slot mapped to tambourine
        
        // Shaker/Tambourine on sixteenth sub-divisions
        addDrumEvent(beatTick, tamb, 110);
        addDrumEvent(beatTick + 120, tamb, 75);
        addDrumEvent(beatTick + 240, tamb, 100);
        addDrumEvent(beatTick + 360, tamb, 80);

        if (beatInBar === 0) {
          addDrumEvent(beatTick, kick, 115, 120, true);
        } else if (beatInBar === 1) {
          addDrumEvent(beatTick, snare, 122, 120, true);
          addDrumEvent(beatTick + 240, snare, 115); // double crack 1
          addDrumEvent(beatTick + 360, snare, 110); // double crack 2
        } else if (beatInBar === 2) {
          addDrumEvent(beatTick + 120, kick, 110);
          addDrumEvent(beatTick + 360, snare, 55); // ghost
        } else if (beatInBar === 3) {
          addDrumEvent(beatTick, snare, 122, 120, true);
          addDrumEvent(beatTick + 120, snare, 65);
          addDrumEvent(beatTick + 240, kick, 105);
          addDrumEvent(beatTick + 360, snare, 70);
        }
      }
      else if (playStyle === 'Apache Break') {
        // Bongo Band driving tribal break beat
        const kick = 36;
        const snare = 38;
        const congaHigh = 47;
        const congaLow = 45;
        
        // Active conga/percussion accents
        if (beatInBar % 2 === 0) {
          addDrumEvent(beatTick + 120, congaHigh, 105);
          addDrumEvent(beatTick + 360, congaLow, 95);
        } else {
          addDrumEvent(beatTick + 240, congaHigh, 100);
        }

        if (beatInBar === 0) {
          addDrumEvent(beatTick, kick, 120, 120, true);
          addDrumEvent(beatTick + 240, kick, 105);
        } else if (beatInBar === 1) {
          addDrumEvent(beatTick, snare, 118, 120, true);
        } else if (beatInBar === 2) {
          addDrumEvent(beatTick + 120, kick, 110);
          addDrumEvent(beatTick + 360, kick, 115);
        } else if (beatInBar === 3) {
          addDrumEvent(beatTick, snare, 122, 120, true);
        }
      }
      else {
        if (beatInBar === 0 || beatInBar === 2) {
          addDrumEvent(beatTick, 36, 105, 120, true);
        }
        if (beatInBar === 1 || beatInBar === 3) {
          addDrumEvent(beatTick, 38, 110, 120, true);
        }
        addDrumEvent(beatTick, 42, 85);
        addDrumEvent(beatTick + 240, 42, 75);
      }

      // ── Tactile Drum DNA Phrase Injection Overlay ──
      if (tactileInject && tactileInject !== 'None') {
        if (tactileInject === 'Kick-Snare Pocket') {
          if (beatInBar === 0 || beatInBar === 2) {
            addDrumEvent(beatTick, 36, 115, 120, true);
          }
          if (beatInBar === 1 || beatInBar === 3) {
            addDrumEvent(beatTick, 38, 118, 120, true);
          }
          addDrumEvent(beatTick + 240, 42, 90);
        } else if (tactileInject === 'Snare Roll Fill') {
          const isFinalChord = cIdx === chords.length - 1;
          const isFinalBeat = beatInBar === durationBeats - 1;
          if (isFinalChord && isFinalBeat) {
            addDrumEvent(beatTick, 38, 70);
            addDrumEvent(beatTick + 80, 38, 80);
            addDrumEvent(beatTick + 160, 38, 90);
            addDrumEvent(beatTick + 240, 38, 100);
            addDrumEvent(beatTick + 320, 38, 110);
            addDrumEvent(beatTick + 400, 38, 120);
            addDrumEvent(beatTick + 440, 49, 125, 240, true); // Cymbal splash
          }
        } else if (tactileInject === 'Hi-Hat Accent') {
          addDrumEvent(beatTick, 42, 115, 120, true);
          addDrumEvent(beatTick + 120, 42, 60);
          addDrumEvent(beatTick + 240, 42, 95);
          addDrumEvent(beatTick + 360, 42, 65);
        } else if (tactileInject === 'Cymbal Splash') {
          if (beatInBar === 0) {
            addDrumEvent(beatTick, 49, 120, 240, true);
            addDrumEvent(beatTick, 36, 110, 120, true);
          }
        }
      }
    }
    
    currentTick += durationBeats * TICKS_PER_BEAT;
  }

  return events;
}

export function generateBass(chords: Chord[], playStyle: string, groove: number, sparseness: number, pocket: number, humanize: number, syncopation: number): MidiEvent[] {
  const profile = resolveProfile(playStyle);
  if (profile) {
    const events: MidiEvent[] = [];
    const performedNotes = generatePerformance(chords, 'Bass', profile, 42, (barIdx) => 0.8, 120, defaultParams, syncopation);
    
    for (const note of performedNotes) {
      // Calculate absolute tick based on beat and offset
      const exactBeat = note.absoluteBeat + note.startBeatOffset;
      const startTick = Math.max(0, Math.round(exactBeat * TICKS_PER_BEAT));
      const durationTicks = Math.round(note.durationBeats * TICKS_PER_BEAT);
      
      // Sparseness/Syncopation check for performed notes
      if (shouldSkipNote(startTick, sparseness, syncopation)) continue;

      // Articulation logic
      let finalVel = note.velocity;
      if (note.articulation === 'ghost') finalVel = Math.floor(finalVel * 0.6);
      if (note.articulation === 'accent') finalVel = Math.min(127, Math.floor(finalVel * 1.2));

      events.push({
        tick: startTick,
        status: 0x91, // Channel 2 Note On
        data: [note.midi, finalVel]
      });
      events.push({
        tick: startTick + durationTicks,
        status: 0x81, // Channel 2 Note Off
        data: [note.midi, 0]
      });
    }
    
    // The events are not guaranteed to be sorted by tick, which the audio engine can handle, but midi export might expect sorted.
    return events.sort((a, b) => a.tick - b.tick);
  }

  const events: MidiEvent[] = [];
  let currentTick = 0;

  for (let cIdx = 0; cIdx < chords.length; cIdx++) {
    const chord = chords[cIdx];
    const durationBeats = chord.duration;
    const bassBase = (NOTE_MAP[chord.root] ?? 60) - 24; // Octave 3
    const semitones = chordSemitones(chord.type);
    const chordNotes = semitones.map(s => bassBase + s);

    const nextChord = chords[cIdx + 1] ?? chords[0];
    const nextRootNote = (NOTE_MAP[nextChord.root] ?? 60) - 24;

    const addBassNote = (tick: number, note: number, vel: number, dur: number, isPrimary = false) => {
      // Syncopation: High values ( > 70) can trigger a rhythmic "push" (shift forward)
      let adjustedTick = tick;
      if (syncopation > 75 && !isPrimary && Math.random() > 0.6) {
        adjustedTick -= 120; // Shift 16th note early for a "pushed" feel
      }

      if (!isPrimary && shouldSkipNote(adjustedTick, sparseness, syncopation)) return;
      const groovedTick = applyGrooveOffset(adjustedTick, groove);

      const maxHumanizeOffset = (humanize / 100) * 15;
      const timingOffset = Math.round((Math.random() - 0.5) * maxHumanizeOffset);
      const finalTick = Math.max(0, groovedTick + timingOffset);
      
      const finalVel = Math.max(1, Math.min(127, vel + Math.round((Math.random() - 0.5) * (humanize / 100) * 15)));

      events.push({
        tick: finalTick,
        status: 0x91, // Channel 2 Note On
        data: [note, finalVel]
      });
      events.push({
        tick: finalTick + dur,
        status: 0x81, // Channel 2 Note Off
        data: [note, 0]
      });

      // Add a syncopated ghost note if syncopation is high
      if (syncopation > 85 && isPrimary && Math.random() > 0.7) {
        const ghostTick = finalTick + 240; // 8th note later
        events.push({
          tick: ghostTick,
          status: 0x91,
          data: [note, Math.floor(finalVel * 0.4)]
        });
        events.push({
          tick: ghostTick + 120,
          status: 0x81,
          data: [note, 0]
        });
      }
    };

    if (playStyle === 'Jamerson Chromatic') {
      for (let beat = 0; beat < durationBeats; beat++) {
        const beatTick = currentTick + beat * TICKS_PER_BEAT;
        
        if (beat === 0) {
          addBassNote(beatTick, getBassPitch(chord, 0), 115, 360, true);
          addBassNote(beatTick + 240, getBassPitch(chord, 1), 95, 200);
        } else if (beat === 1) {
          addBassNote(beatTick, getBassPitch(chord, 2), 100, 200);
          addBassNote(beatTick + 240, getBassPitch(chord, 0, 1), 105, 200); // Octave up
        } else if (beat === 2) {
          addBassNote(beatTick + 120, getBassPitch(chord, 0), 105, 200);
          addBassNote(beatTick + 360, getBassPitch(chord, 1), 95, 100);
        } else if (beat === 3) {
          addBassNote(beatTick, getBassPitch(chord, 2), 100, 200);
          
          let approachNote = nextRootNote - 1;
          if (nextRootNote < bassBase) {
            approachNote = nextRootNote + 1;
          } else if (nextRootNote === bassBase) {
            approachNote = getBassPitch(chord, 2);
          }
          addBassNote(beatTick + 240, approachNote, 110, 200);
        }
      }
    } 
    else if (playStyle === 'Bootsy Envelope Slap') {
      for (let beat = 0; beat < durationBeats; beat++) {
        const beatTick = currentTick + beat * TICKS_PER_BEAT;
        
        if (beat === 0) {
          addBassNote(beatTick, getBassPitch(chord, 0), 125, 180, true);
          addBassNote(beatTick + 240, getBassPitch(chord, 0, 1), 120, 180);
        } else if (beat === 1) {
          addBassNote(beatTick + 120, getBassPitch(chord, 3), 115, 180); // Use 7th if available
          if (Math.random() > 0.5) {
            addBassNote(beatTick + 360, getBassPitch(chord, 0, 1), 110, 100);
          }
        } else if (beat === 2) {
          addBassNote(beatTick, getBassPitch(chord, 0), 120, 180, true);
          addBassNote(beatTick + 240, getBassPitch(chord, 2), 115, 180);
        } else if (beat === 3) {
          addBassNote(beatTick + 120, getBassPitch(chord, 3), 120, 180);
          addBassNote(beatTick + 360, nextRootNote - 1, 115, 100);
        }
      }
    } 
    else if (playStyle === 'Larry Graham Slap' || playStyle === 'Larry Graham') {
      for (let beat = 0; beat < durationBeats; beat++) {
        const beatTick = currentTick + beat * TICKS_PER_BEAT;
        if (beat === 0) {
          addBassNote(beatTick, getBassPitch(chord, 0), 127, 240, true); 
          addBassNote(beatTick + 240, getBassPitch(chord, 0, 1), 125, 120); 
        } else if (beat === 1) {
          addBassNote(beatTick + 120, getBassPitch(chord, 3), 115, 120); 
          addBassNote(beatTick + 240, getBassPitch(chord, 0, 1), 127, 120); 
        } else if (beat === 2) {
          addBassNote(beatTick, getBassPitch(chord, 0), 125, 240, true); 
          addBassNote(beatTick + 240, getBassPitch(chord, 1), 115, 120);
        } else if (beat === 3) {
          addBassNote(beatTick + 120, getBassPitch(chord, 2), 120, 120);
          addBassNote(beatTick + 240, nextRootNote - 1, 125, 120); 
        }
      }
    }
    else if (playStyle === 'Carol Kaye Picked') {
      for (let beat = 0; beat < durationBeats; beat++) {
        const beatTick = currentTick + beat * TICKS_PER_BEAT;
        
        if (beat === 0) {
          addBassNote(beatTick, getBassPitch(chord, 0), 105, 200, true);
          addBassNote(beatTick + 240, getBassPitch(chord, 0), 100, 200);
        } else if (beat === 1) {
          addBassNote(beatTick, getBassPitch(chord, 1), 105, 200);
          addBassNote(beatTick + 240, getBassPitch(chord, 2), 105, 200);
        } else if (beat === 2) {
          addBassNote(beatTick, getBassPitch(chord, 3), 105, 200, true);
          addBassNote(beatTick + 240, getBassPitch(chord, 2), 100, 200);
        } else if (beat === 3) {
          addBassNote(beatTick, getBassPitch(chord, 1), 105, 200);
          addBassNote(beatTick + 240, nextRootNote, 105, 200);
        }
      }
    }
    else if (playStyle === 'Duck Dunn Stax Pocket') {
      for (let beat = 0; beat < durationBeats; beat++) {
        const beatTick = currentTick + beat * TICKS_PER_BEAT;
        
        if (beat === 0) {
          addBassNote(beatTick, getBassPitch(chord, 0), 115, 380, true);
        } else if (beat === 2) {
          addBassNote(beatTick, getBassPitch(chord, 2), 110, 380, true);
        } else if (beat === 3 && Math.random() > 0.6) {
          addBassNote(beatTick + 240, nextRootNote - 1, 105, 200);
        }
      }
    }
    else if (playStyle === 'Chuck Rainey Session') {
      for (let beat = 0; beat < durationBeats; beat++) {
        const beatTick = currentTick + beat * TICKS_PER_BEAT;
        
        if (beat === 0) {
          addBassNote(beatTick, getBassPitch(chord, 0), 110, 350, true);
        } else if (beat === 1) {
          addBassNote(beatTick + 240, getBassPitch(chord, 0, 1), 100, 200);
          addBassNote(beatTick + 240, getBassPitch(chord, 1, 1), 95, 200);
        } else if (beat === 2) {
          addBassNote(beatTick, getBassPitch(chord, 2), 105, 350, true);
        } else if (beat === 3) {
          addBassNote(beatTick + 240, nextRootNote, 105, 200);
        }
      }
    }
    else if (playStyle === 'Walking Bass') {
      for (let beat = 0; beat < durationBeats; beat++) {
        const beatTick = currentTick + beat * TICKS_PER_BEAT;
        
        if (beat === 0) {
          addBassNote(beatTick, getBassPitch(chord, 0), 110, 440, true);
        } else if (beat === 1) {
          addBassNote(beatTick, getBassPitch(chord, 1), 100, 440);
        } else if (beat === 2) {
          addBassNote(beatTick, getBassPitch(chord, 2), 105, 440, true);
        } else if (beat === 3) {
          const chromaticStep = nextRootNote > getBassPitch(chord, 2) ? nextRootNote - 1 : nextRootNote + 1;
          addBassNote(beatTick, chromaticStep, 108, 440);
        }
      }
    }
    else if (playStyle === 'Synth Arp') {
      const pattern = [0, 7, 12, 7, 3, 7, 12, 7];
      for (let beat = 0; beat < durationBeats; beat++) {
        const beatTick = currentTick + beat * TICKS_PER_BEAT;
        for (let sub = 0; sub < 4; sub++) {
          const stepNote = bassBase + (pattern[(beat * 4 + sub) % pattern.length]);
          addBassNote(beatTick + sub * 120, stepNote, 100, 100);
        }
      }
    }
    else if (playStyle === 'Gospel Slap & Slide') {
      // Elastic gospel slaps, octaves, and pentatonic slide drops
      for (let beat = 0; beat < durationBeats; beat++) {
        const beatTick = currentTick + beat * TICKS_PER_BEAT;
        
        if (beat === 0) {
          addBassNote(beatTick, bassBase, 126, 300, true); // Slapped root
          addBassNote(beatTick + 240, bassBase + 12, 118, 120); // Popped octave
        } else if (beat === 1) {
          addBassNote(beatTick + 120, bassBase + 7, 110, 180); // Popped fifth
          addBassNote(beatTick + 360, bassBase + 5, 115, 100);
        } else if (beat === 2) {
          addBassNote(beatTick, bassBase, 120, 240); 
          addBassNote(beatTick + 240, bassBase + 10, 112, 120); // Syncopated b7 flat
        } else if (beat === 3) {
          // Rapid pentatonic gospel run descending to the next root note
          addBassNote(beatTick, bassBase + 7, 118, 100);
          addBassNote(beatTick + 120, bassBase + 5, 115, 100);
          addBassNote(beatTick + 240, bassBase + 3, 112, 100);
          addBassNote(beatTick + 360, nextRootNote - 1, 120, 100); // Slide approach
        }
      }
    }
    else if (playStyle === 'Grunge Picked Drive') {
      // Heavy driving picked eighth-notes on the root and fifth
      for (let beat = 0; beat < durationBeats; beat++) {
        const beatTick = currentTick + beat * TICKS_PER_BEAT;
        // 4 eighth notes per beat
        addBassNote(beatTick, bassBase, 122, 220, true);
        addBassNote(beatTick + 240, bassBase, 118, 220);
        
        if (beat === 1 || beat === 3) {
          addBassNote(beatTick, bassBase + 7, 115, 220);
          addBassNote(beatTick + 240, bassBase, 120, 220);
        }
      }
    }
    else {
      for (let beat = 0; beat < durationBeats; beat++) {
        const beatTick = currentTick + beat * TICKS_PER_BEAT;
        if (beat === 0) {
          addBassNote(beatTick, bassBase, 110, 400, true);
        } else if (beat === 2) {
          addBassNote(beatTick, chordNotes[2] ?? (bassBase + 7), 105, 400, true);
        }
      }
    }

    currentTick += durationBeats * TICKS_PER_BEAT;
  }

  return events;
}

export function generateKeys(chords: Chord[], playStyle: string, groove: number, sparseness: number, pocket: number, humanize: number, syncopation: number): MidiEvent[] {
  const profile = resolveProfile(playStyle);
  if (profile) {
    const events: MidiEvent[] = [];
    const performedNotes = generatePerformance(chords, 'Keys', profile, 44, (barIdx) => 0.7, 120, defaultParams, syncopation);
    
    for (const note of performedNotes) {
      const exactBeat = note.absoluteBeat + note.startBeatOffset;
      const startTick = Math.max(0, Math.round(exactBeat * TICKS_PER_BEAT));
      const durationTicks = Math.round(note.durationBeats * TICKS_PER_BEAT);
      
      if (shouldSkipNote(startTick, sparseness, syncopation)) continue;

      let finalVel = note.velocity;
      if (note.articulation === 'ghost') finalVel = Math.floor(finalVel * 0.5);
      if (note.articulation === 'accent') finalVel = Math.min(127, Math.floor(finalVel * 1.3));

      events.push({
        tick: startTick,
        status: 0x92, // Channel 3 Note On
        data: [note.midi, finalVel]
      });
      events.push({
        tick: startTick + durationTicks,
        status: 0x82, // Channel 3 Note Off
        data: [note.midi, 0]
      });
    }
    return events.sort((a, b) => a.tick - b.tick);
  }

  const events: MidiEvent[] = [];
  let currentTick = 0;

  for (let cIdx = 0; cIdx < chords.length; cIdx++) {
    const chord = chords[cIdx];
    const durationBeats = chord.duration;
    const keysBase = (NOTE_MAP[chord.root] ?? 60) - 12; // Octave 4

    let voicing: number[] = [];
    if (chord.inversion !== undefined) {
      voicing = getChordVoicingWithInversion(chord.root, chord.type, chord.inversion);
    } else {
      if (chord.type.includes('maj7')) {
        voicing = [keysBase + 4, keysBase + 7, keysBase + 11, keysBase + 14];
      } else if (chord.type.includes('min7')) {
        voicing = [keysBase + 3, keysBase + 7, keysBase + 10, keysBase + 14];
      } else if (chord.type.includes('7')) {
        voicing = [keysBase + 4, keysBase + 9, keysBase + 10, keysBase + 14];
      } else if (chord.type.includes('9')) {
        voicing = [keysBase + 4, keysBase + 7, keysBase + 10, keysBase + 14, keysBase + 18];
      } else {
        voicing = [keysBase + 4, keysBase + 7, keysBase + 12];
        if (chord.type.includes('min')) {
          voicing[0] = keysBase + 3;
        }
      }

      voicing = voicing.map(note => {
        let n = note;
        while (n < 50) n += 12;
        while (n > 80) n -= 12;
        return n;
      });
    }

    const addKeysChords = (tick: number, notes: number[], vel: number, dur: number, isPrimary = false) => {
      if (!isPrimary && shouldSkipNote(tick, sparseness, syncopation)) return;
      const groovedTick = applyGrooveOffset(tick, groove);

      const maxStrumDelay = (humanize / 100) * 20;
      
      notes.forEach((note, index) => {
        const noteDelay = Math.round(index * (maxStrumDelay / notes.length));
        const finalTick = Math.max(0, groovedTick + noteDelay);
        const finalVel = Math.max(1, Math.min(127, vel + Math.round((Math.random() - 0.5) * (humanize / 100) * 12)));

        events.push({
          tick: finalTick,
          status: 0x92, // Channel 3 Note On
          data: [note, finalVel]
        });
        events.push({
          tick: finalTick + dur,
          status: 0x82, // Channel 3 Note Off
          data: [note, 0]
        });
      });
    };

    if (playStyle === 'Steely Fagen Rhodes') {
      for (let beat = 0; beat < durationBeats; beat++) {
        const beatTick = currentTick + beat * TICKS_PER_BEAT;
        
        if (beat === 0) {
          addKeysChords(beatTick + 240, voicing, 95, 480, true);
        } else if (beat === 1) {
          addKeysChords(beatTick + 240, voicing, 90, 360);
        } else if (beat === 3) {
          addKeysChords(beatTick, voicing, 100, 720);
        }
      }
    } 
    else if (playStyle === 'Earl Van Dyke Chomp') {
      for (let beat = 0; beat < durationBeats; beat++) {
        const beatTick = currentTick + beat * TICKS_PER_BEAT;
        addKeysChords(beatTick, voicing, 105, 180, true);
      }
    } 
    else if (playStyle === 'Booker T Drawbars') {
      addKeysChords(currentTick, voicing, 85, durationBeats * TICKS_PER_BEAT - 20, true);
    } 
    else if (playStyle === 'Bernie Worrell Clav') {
      const clavVoicing = voicing.slice(0, 3);
      for (let beat = 0; beat < durationBeats; beat++) {
        const beatTick = currentTick + beat * TICKS_PER_BEAT;
        if (beat === 0 || beat === 2) {
          addKeysChords(beatTick, clavVoicing, 105, 100, true);
          addKeysChords(beatTick + 240, clavVoicing, 95, 100);
        } else {
          addKeysChords(beatTick + 120, clavVoicing, 100, 100);
          addKeysChords(beatTick + 360, clavVoicing, 90, 100);
        }
      }
    }
    else if (playStyle === 'Smallwood Chops') {
      // Sweeping gospel chords, grace notes, rolled arpeggios
      for (let beat = 0; beat < durationBeats; beat++) {
        const beatTick = currentTick + beat * TICKS_PER_BEAT;
        if (beat === 0) {
          // Play rolled chords (staggered note start)
          addKeysChords(beatTick, voicing, 112, 480, true);
        } else if (beat === 1) {
          // Suspended passing chords
          const susVoicing = voicing.map(n => n + 1);
          addKeysChords(beatTick + 240, susVoicing, 100, 240);
        } else if (beat === 2) {
          addKeysChords(beatTick, voicing, 105, 480);
        } else if (beat === 3) {
          // Classically-infused descending scalar runs
          const runNotes = [voicing[2] ?? 72, voicing[1] ?? 67, voicing[0] ?? 64, (voicing[0] ?? 64) - 2];
          runNotes.forEach((n, idx) => {
            addKeysChords(beatTick + idx * 120, [n], 95, 120);
          });
        }
      }
    }
    else if (playStyle === 'Grunge Alt-Piano') {
      // Heavy staccato low-register powerchord banging
      const lowVoicing = voicing.map(n => n - 12); // Transpose down for heavy grunge sludge
      for (let beat = 0; beat < durationBeats; beat++) {
        const beatTick = currentTick + beat * TICKS_PER_BEAT;
        // Bashing on beat downbeats and upbeats
        addKeysChords(beatTick, lowVoicing, 118, 180, true);
        addKeysChords(beatTick + 240, lowVoicing, 110, 180);
      }
    }
    else {
      addKeysChords(currentTick, voicing, 90, TICKS_PER_BEAT * 2 - 40, true);
      addKeysChords(currentTick + TICKS_PER_BEAT * 2, voicing, 85, TICKS_PER_BEAT * 2 - 40);
    }

    currentTick += durationBeats * TICKS_PER_BEAT;
  }

  return events;
}

export function generateGuitar(chords: Chord[], playStyle: string, groove: number, sparseness: number, pocket: number, humanize: number, syncopation: number): MidiEvent[] {
  const profile = resolveProfile(playStyle);
  if (profile) {
    const events: MidiEvent[] = [];
    const performedNotes = generatePerformance(chords, 'Guitar', profile, 45, (barIdx) => 0.6, 120, defaultParams, syncopation);
    
    for (const note of performedNotes) {
      const exactBeat = note.absoluteBeat + note.startBeatOffset;
      const startTick = Math.max(0, Math.round(exactBeat * TICKS_PER_BEAT));
      const durationTicks = Math.round(note.durationBeats * TICKS_PER_BEAT);
      
      if (shouldSkipNote(startTick, sparseness, syncopation)) continue;

      let finalVel = note.velocity;
      if (note.articulation === 'ghost') finalVel = Math.floor(finalVel * 0.4);
      if (note.articulation === 'accent') finalVel = Math.min(127, Math.floor(finalVel * 1.4));

      events.push({
        tick: startTick,
        status: 0x93, // Channel 4 Note On
        data: [note.midi, finalVel]
      });
      events.push({
        tick: startTick + durationTicks,
        status: 0x83, // Channel 4 Note Off
        data: [note.midi, 0]
      });
    }
    return events.sort((a, b) => a.tick - b.tick);
  }

  const events: MidiEvent[] = [];
  let currentTick = 0;

  for (let cIdx = 0; cIdx < chords.length; cIdx++) {
    const chord = chords[cIdx];
    const durationBeats = chord.duration;
    const gtrBase = (NOTE_MAP[chord.root] ?? 60) - 12; // Octave 4

    let voicing: number[] = [];
    if (chord.inversion !== undefined) {
      voicing = getChordVoicingWithInversion(chord.root, chord.type, chord.inversion);
    } else {
      voicing = [gtrBase + 4, gtrBase + 7, gtrBase + 12];
      if (chord.type.includes('min')) {
        voicing[0] = gtrBase + 3;
      }
      if (chord.type.includes('7') || chord.type.includes('9')) {
        voicing.push(gtrBase + 10);
      }
      if (chord.type.includes('maj7')) {
        voicing.push(gtrBase + 11);
      }

      voicing = voicing.map(note => {
        let n = note;
        while (n < 55) n += 12;
        while (n > 80) n -= 12;
        return n;
      });
    }

    const addGuitarChord = (tick: number, notes: number[], vel: number, dur: number, isPercussive = false, isPrimary = false) => {
      if (!isPrimary && !isPercussive && shouldSkipNote(tick, sparseness, syncopation)) return;
      const groovedTick = applyGrooveOffset(tick, groove);

      notes.forEach((note, idx) => {
        const strumDelay = idx * 6;
        const finalTick = Math.max(0, groovedTick + strumDelay);
        const finalVel = isPercussive ? 35 : Math.max(1, Math.min(127, vel + Math.round((Math.random() - 0.5) * 15)));
        
        events.push({
          tick: finalTick,
          status: 0x93, // Channel 4 Note On
          data: [isPercussive ? 40 : note, finalVel]
        });
        events.push({
          tick: finalTick + dur,
          status: 0x83, // Channel 4 Note Off
          data: [isPercussive ? 40 : note, 0]
        });
      });
    };

    if (playStyle === 'Jimmy Nolen Chank') {
      const topStrings = voicing.slice(-3);
      for (let beat = 0; beat < durationBeats; beat++) {
        const beatTick = currentTick + beat * TICKS_PER_BEAT;
        
        addGuitarChord(beatTick, topStrings, 40, 40, true);
        addGuitarChord(beatTick + 120, topStrings, 115, 60);
        addGuitarChord(beatTick + 240, topStrings, 40, 40, true);
        addGuitarChord(beatTick + 360, topStrings, 105, 60);
      }
    } 
    else if (playStyle === 'Steve Cropper Chops') {
      for (let beat = 0; beat < durationBeats; beat++) {
        const beatTick = currentTick + beat * TICKS_PER_BEAT;
        
        if (beat === 1 || beat === 3) {
          const doubleStop = [gtrBase + 16, gtrBase + 21];
          addGuitarChord(beatTick - 40, doubleStop.map(n => n - 1), 90, 40, false, true);
          addGuitarChord(beatTick, doubleStop, 110, 240, false, true);
        }
      }
    } 
    else if (playStyle === 'Larry Carlton Fusion') {
      for (let beat = 0; beat < durationBeats; beat++) {
        const beatTick = currentTick + beat * TICKS_PER_BEAT;
        
        if (beat === 0) {
          addGuitarChord(beatTick + 120, voicing, 95, 480, false, true);
        } else if (beat === 2) {
          addGuitarChord(beatTick + 240, voicing, 90, 360);
        }
      }
    } 
    else if (playStyle === 'Tommy Tedesco Session') {
      // Arpeggiated fingerpicking pattern over chords
      for (let beat = 0; beat < durationBeats; beat++) {
        const beatTick = currentTick + beat * TICKS_PER_BEAT;
        addGuitarChord(beatTick, [voicing[0]], 100, 240, false, true);
        addGuitarChord(beatTick + 120, [voicing[1]], 85, 120);
        addGuitarChord(beatTick + 240, [voicing[2]], 90, 120);
        if (voicing[3]) {
          addGuitarChord(beatTick + 360, [voicing[3]], 80, 120);
        } else {
          addGuitarChord(beatTick + 360, [voicing[1]], 80, 120);
        }
      }
    }
    else if (playStyle === 'Eddie Hazel Psych') {
      const pentatonicNotes = [gtrBase, gtrBase + 3, gtrBase + 5, gtrBase + 7, gtrBase + 10, gtrBase + 12];
      for (let beat = 0; beat < durationBeats; beat++) {
        const beatTick = currentTick + beat * TICKS_PER_BEAT;
        if (beat === 1 || beat === 3) {
          addGuitarChord(beatTick + 120, [pentatonicNotes[Math.floor(Math.random() * pentatonicNotes.length)]], 110, 200);
          addGuitarChord(beatTick + 240, [pentatonicNotes[Math.floor(Math.random() * pentatonicNotes.length)]], 100, 200);
        }
      }
    }
    else if (playStyle === 'Gospel Rhythm Strum') {
      // Dynamic syncopated gospel guitar strumming on the offbeats
      for (let beat = 0; beat < durationBeats; beat++) {
        const beatTick = currentTick + beat * TICKS_PER_BEAT;
        if (beat === 0) {
          addGuitarChord(beatTick + 240, voicing, 102, 180, false, true); // Strum on upbeat
        } else if (beat === 1) {
          addGuitarChord(beatTick + 120, voicing, 95, 120);
          addGuitarChord(beatTick + 360, voicing, 108, 120);
        } else if (beat === 2) {
          addGuitarChord(beatTick + 240, voicing, 104, 240);
        } else if (beat === 3) {
          const slidingGtr = voicing.map(n => n + 1); // Slide into chord
          addGuitarChord(beatTick + 120, slidingGtr, 95, 120);
          addGuitarChord(beatTick + 240, voicing, 110, 240);
        }
      }
    }
    else if (playStyle === 'Grunge Powerchords') {
      // Massive raw wall of 5th chords on downbeats & eighth notes
      const powerchord = [gtrBase, gtrBase + 7, gtrBase + 12]; // Root - Fifth - Octave
      for (let beat = 0; beat < durationBeats; beat++) {
        const beatTick = currentTick + beat * TICKS_PER_BEAT;
        // Strum down-up-down-up eighth notes
        addGuitarChord(beatTick, powerchord, 126, 220, false, true); // heavy downstrum
        addGuitarChord(beatTick + 120, powerchord, 115, 100);
        addGuitarChord(beatTick + 240, powerchord, 122, 220); // upstrum
        addGuitarChord(beatTick + 360, powerchord, 110, 100);
      }
    }
    else {
      for (let beat = 0; beat < durationBeats; beat++) {
        const beatTick = currentTick + beat * TICKS_PER_BEAT;
        addGuitarChord(beatTick + 240, voicing, 90, 180, false, true);
      }
    }

    currentTick += durationBeats * TICKS_PER_BEAT;
  }

  return events;
}

export function generatePads(chords: Chord[], playStyle: string, groove: number, sparseness: number, pocket: number, humanize: number, syncopation: number): MidiEvent[] {
  const profile = resolveProfile(playStyle);
  if (profile) {
    const events: MidiEvent[] = [];
    const performedNotes = generatePerformance(chords, 'Pads', profile, 46, (barIdx) => 0.5, 120, defaultParams, syncopation);
    
    for (const note of performedNotes) {
      const exactBeat = note.absoluteBeat + note.startBeatOffset;
      const startTick = Math.max(0, Math.round(exactBeat * TICKS_PER_BEAT));
      const durationTicks = Math.round(note.durationBeats * TICKS_PER_BEAT);
      
      if (shouldSkipNote(startTick, sparseness, syncopation)) continue;

      events.push({
        tick: startTick,
        status: 0x94, // Channel 5 Note On
        data: [note.midi, note.velocity]
      });
      events.push({
        tick: startTick + durationTicks,
        status: 0x84, // Channel 5 Note Off
        data: [note.midi, 0]
      });
    }
    return events.sort((a, b) => a.tick - b.tick);
  }

  const events: MidiEvent[] = [];
  let currentTick = 0;

  for (let cIdx = 0; cIdx < chords.length; cIdx++) {
    const chord = chords[cIdx];
    const durationBeats = chord.duration;
    const padsBase = (NOTE_MAP[chord.root] ?? 60) - 12; // Octave 4

    let voicing: number[] = [];
    if (chord.inversion !== undefined) {
      voicing = getChordVoicingWithInversion(chord.root, chord.type, chord.inversion);
    } else {
      voicing = [padsBase, padsBase + 7, padsBase + 12];
      if (chord.type.includes('min')) {
        voicing.push(padsBase + 3);
      } else {
        voicing.push(padsBase + 4);
      }
      if (chord.type.includes('7') || chord.type.includes('9')) {
        voicing.push(padsBase + 10);
      }

      voicing = voicing.map(note => {
        let n = note;
        while (n < 48) n += 12;
        while (n > 72) n -= 12;
        return n;
      });
    }

    voicing = Array.from(new Set(voicing));

    const addPadNotes = (tick: number, notes: number[], vel: number, dur: number, isPrimary = false) => {
      if (!isPrimary && shouldSkipNote(tick, sparseness, syncopation)) return;
      const groovedTick = applyGrooveOffset(tick, groove);

      notes.forEach(note => {
        events.push({
          tick: groovedTick,
          status: 0x94, // Channel 5 Note On
          data: [note, vel]
        });
        events.push({
          tick: groovedTick + dur,
          status: 0x84, // Channel 5 Note Off
          data: [note, 0]
        });
      });
    };

    addPadNotes(currentTick, voicing, 75, durationBeats * TICKS_PER_BEAT - 20, true);

    currentTick += durationBeats * TICKS_PER_BEAT;
  }

  return events;
}

export function generateLead(chords: Chord[], playStyle: string, groove: number, sparseness: number, pocket: number, humanize: number, syncopation: number): MidiEvent[] {
  const profile = resolveProfile(playStyle);
  if (profile) {
    const events: MidiEvent[] = [];
    const performedNotes = generatePerformance(chords, 'Lead', profile, 47, (barIdx) => 0.9, 120, defaultParams, syncopation);
    
    for (const note of performedNotes) {
      const exactBeat = note.absoluteBeat + note.startBeatOffset;
      const startTick = Math.max(0, Math.round(exactBeat * TICKS_PER_BEAT));
      const durationTicks = Math.round(note.durationBeats * TICKS_PER_BEAT);
      
      if (shouldSkipNote(startTick, sparseness, syncopation)) continue;

      let finalVel = note.velocity;
      if (note.articulation === 'ghost') finalVel = Math.floor(finalVel * 0.4);
      if (note.articulation === 'accent') finalVel = Math.min(127, Math.floor(finalVel * 1.5));

      events.push({
        tick: startTick,
        status: 0x95, // Channel 6 Note On
        data: [note.midi, finalVel]
      });
      events.push({
        tick: startTick + durationTicks,
        status: 0x85, // Channel 6 Note Off
        data: [note.midi, 0]
      });
    }
    return events.sort((a, b) => a.tick - b.tick);
  }

  const events: MidiEvent[] = [];
  let currentTick = 0;

  for (let cIdx = 0; cIdx < chords.length; cIdx++) {
    const chord = chords[cIdx];
    const durationBeats = chord.duration;
    const leadBase = (NOTE_MAP[chord.root] ?? 60) + 12; // Octave 6

    const scaleDegrees = chord.type.includes('min') 
      ? [0, 3, 5, 7, 10, 12]  // Minor Pentatonic
      : [0, 2, 4, 7, 9, 12];  // Major Pentatonic

    const addMelodicNote = (tick: number, note: number, vel: number, dur: number, isPrimary = false) => {
      if (!isPrimary && shouldSkipNote(tick, sparseness, syncopation)) return;
      const groovedTick = applyGrooveOffset(tick, groove);

      const finalVel = Math.max(1, Math.min(127, vel + Math.round((Math.random() - 0.5) * 15)));
      events.push({
        tick: groovedTick,
        status: 0x95, // Channel 6 Note On
        data: [note, finalVel]
      });
      events.push({
        tick: groovedTick + dur,
        status: 0x85, // Channel 6 Note Off
        data: [note, 0]
      });
    };

    if (playStyle === 'Maceo Horn Phrasing') {
      for (let beat = 0; beat < durationBeats; beat++) {
        const beatTick = currentTick + beat * TICKS_PER_BEAT;
        if (beat === 0) {
          addMelodicNote(beatTick, leadBase + scaleDegrees[3], 115, 120, true);
        } else if (beat === 1) {
          addMelodicNote(beatTick + 120, leadBase + scaleDegrees[4], 110, 120);
        } else if (beat === 2) {
          addMelodicNote(beatTick, leadBase + scaleDegrees[2], 105, 120, true);
          addMelodicNote(beatTick + 240, leadBase + scaleDegrees[0], 115, 120);
        }
      }
    } 
    else if (playStyle === 'Larry Carlton Lead') {
      const melodySub = [0, 2, 3, 2];
      melodySub.forEach((beatIdx, idx) => {
        const note = leadBase + scaleDegrees[idx % scaleDegrees.length];
        addMelodicNote(currentTick + idx * TICKS_PER_BEAT, note, 95, 380, true);
      });
    } 
    else if (playStyle === 'Steve Cropper Fill-In') {
      for (let beat = 0; beat < durationBeats; beat++) {
        const beatTick = currentTick + beat * TICKS_PER_BEAT;
        if (beat === 1) {
          addMelodicNote(beatTick + 240, leadBase + scaleDegrees[1], 100, 120);
        } else if (beat === 2) {
          addMelodicNote(beatTick, leadBase + scaleDegrees[2], 105, 120, true);
          addMelodicNote(beatTick + 240, leadBase + scaleDegrees[3], 110, 240);
        } else if (beat === 3) {
          addMelodicNote(beatTick + 240, leadBase + scaleDegrees[1], 95, 200);
        }
      }
    }
    else if (playStyle === 'Eddie Hazel Lead') {
      for (let beat = 0; beat < durationBeats; beat++) {
        const beatTick = currentTick + beat * TICKS_PER_BEAT;
        if (beat === 0 || beat === 2) {
          addMelodicNote(beatTick, leadBase + scaleDegrees[4], 110, 240, true);
          addMelodicNote(beatTick + 240, leadBase + scaleDegrees[3], 100, 200);
        } else if (beat === 3) {
          addMelodicNote(beatTick, leadBase + scaleDegrees[2], 105, 240);
          addMelodicNote(beatTick + 240, leadBase + scaleDegrees[0], 115, 200);
        }
      }
    } 
    else if (playStyle === 'Improvisation') {
      for (let beat = 0; beat < durationBeats; beat++) {
        const beatTick = currentTick + beat * TICKS_PER_BEAT;
        if (beat === 1 || beat === 3) {
          const randNote = leadBase + scaleDegrees[Math.floor(Math.random() * scaleDegrees.length)];
          addMelodicNote(beatTick + 120, randNote, 100, 240);
        }
      }
    }
    else {
      addMelodicNote(currentTick + 240, leadBase + scaleDegrees[2], 85, 480, true);
    }

    currentTick += durationBeats * TICKS_PER_BEAT;
  }

  return events;
}

// --- Main Export Process ---

export const exportMidi = async (song: Song, instrumentStates: Record<InstrumentType, InstrumentState>, sophisticationLevel: SophisticationLevel = 0, fullState?: any) => {
  const safeBpm = Number.isFinite(song.bpm) && song.bpm > 0 ? song.bpm : 120;
  const microsPerBeat = Math.round(60_000_000 / safeBpm);

  const tracks: number[][] = [];

  // Track 0: Conductor Track (Tempo, Time Signature)
  const conductorEvents: MidiEvent[] = [
    buildTrackNameEvent("Tempo Conductor"),
    {
      tick: 0,
      status: 0xff,
      data: [0x51, 0x03, (microsPerBeat >> 16) & 0xff, (microsPerBeat >> 8) & 0xff, microsPerBeat & 0xff]
    },
    {
      tick: 0,
      status: 0xff,
      data: [0x58, 0x04, 0x04, 0x02, 0x18, 0x08] // 4/4
    }
  ];
  tracks.push(compileTrack(conductorEvents));

  const instrumentTypes: InstrumentType[] = ['Drums', 'Bass', 'Keys', 'Guitar', 'Pads', 'Lead', 'Sampler'];
  const displayNames: Record<InstrumentType, string> = {
    Drums: 'Drums', Bass: 'Bass', Keys: 'Piano Keys', Guitar: 'Guitar', Pads: 'Strings Pads', Lead: 'Bells Lead', Sampler: 'Sampler Chops'
  };
  
  instrumentTypes.forEach(type => {
    const allInstrumentEvents: MidiEvent[] = [];
    let currentTickOffset = 0;

    song.sections.forEach(section => {
      const baseParams = instrumentStates[type].params;
      const sectionParams = section.instrumentParams?.[type] 
        ? { ...baseParams, ...section.instrumentParams[type] }
        : baseParams;

      const instSophistication = Math.floor((sectionParams.sophistication || 50) / 25);
      const safeSophistication = Math.min(3, Math.max(0, instSophistication)) as 0 | 1 | 2 | 3;
      
      const sophisticatedChords = applySophistication(section.chords, safeSophistication);
      let sectionEvents: MidiEvent[] = [];
      
      if (instrumentStates[type].enabled) {
        switch (type) {
          case 'Drums':
            sectionEvents = generateDrums(
              sophisticatedChords, sectionParams.playStyle, sectionParams.groove, 
              sectionParams.sparseness, sectionParams.pocket, sectionParams.humanize, 
              sectionParams.syncopation, sectionParams.tactileInject, 
              sectionParams.perDrumPocket, sectionParams.perDrumSwing
            );
            break;
          case 'Bass':
            sectionEvents = generateBass(
              sophisticatedChords, sectionParams.playStyle, sectionParams.groove, 
              sectionParams.sparseness, sectionParams.pocket, sectionParams.humanize, 
              sectionParams.syncopation
            );
            break;
          case 'Keys':
            sectionEvents = generateKeys(
              sophisticatedChords, sectionParams.playStyle, sectionParams.groove, 
              sectionParams.sparseness, sectionParams.pocket, sectionParams.humanize,
              sectionParams.syncopation
            );
            break;
          case 'Guitar':
            sectionEvents = generateGuitar(
              sophisticatedChords, sectionParams.playStyle, sectionParams.groove, 
              sectionParams.sparseness, sectionParams.pocket, sectionParams.humanize,
              sectionParams.syncopation
            );
            break;
          case 'Pads':
            sectionEvents = generatePads(
              sophisticatedChords, sectionParams.playStyle, sectionParams.groove, 
              sectionParams.sparseness, sectionParams.pocket, sectionParams.humanize,
              sectionParams.syncopation
            );
            break;
          case 'Lead':
            sectionEvents = generateLead(
              sophisticatedChords, sectionParams.playStyle, sectionParams.groove, 
              sectionParams.sparseness, sectionParams.pocket, sectionParams.humanize,
              sectionParams.syncopation
            );
            break;
          case 'Sampler':
            // Sampler currently relies on recorded sequences (editedMidi)
            // Procedural sampler generation could be added here
            sectionEvents = [];
            break;
        }
      }

      sectionEvents.forEach(ev => {
        allInstrumentEvents.push({
          ...ev,
          tick: ev.tick + currentTickOffset
        });
      });

      const sectionDurationBeats = section.chords.reduce((sum, c) => sum + c.duration, 0);
      currentTickOffset += sectionDurationBeats * TICKS_PER_BEAT;
    });

    const trackEvents = [
      buildTrackNameEvent(`${displayNames[type]} (Session)`),
      ...allInstrumentEvents
    ];
    tracks.push(compileTrack(trackEvents));
  });

  const createMidiFile = (tracksToInclude: number[][]): Uint8Array => {
    const header = [
      0x4d, 0x54, 0x68, 0x64,
      0x00, 0x00, 0x00, 0x06,
      0x00, 0x01,
      (tracksToInclude.length >> 8) & 0xff, tracksToInclude.length & 0xff,
      (TICKS_PER_BEAT >> 8) & 0xff, TICKS_PER_BEAT & 0xff
    ];

    const fileBytes: number[] = [...header];
    for (const track of tracksToInclude) {
      fileBytes.push(...track);
    }
    return new Uint8Array(fileBytes);
  };

  const zip = new JSZip();
  if (fullState) {
    // Clone fullState to modify URLs without mutating original state
    const stateCopy = JSON.parse(JSON.stringify(fullState));
    const samplesFolder = zip.folder("custom_samples");

    if (samplesFolder) {
      // Package Drum Kit Samples
      if (stateCopy.instrumentStates?.Drums?.customKit?.samples) {
        for (const sample of stateCopy.instrumentStates.Drums.customKit.samples) {
          if (sample.url && sample.url.startsWith('blob:')) {
            try {
              const res = await fetch(sample.url);
              const blob = await res.blob();
              const ext = sample.name.split('.').pop() || 'wav';
              const filename = `drums_${sample.type}.${ext}`;
              samplesFolder.file(filename, blob);
              sample.url = `custom_samples/${filename}`; // Rewrite URL for import
            } catch (err) {
              console.warn("Failed to fetch custom drum sample blob for zip export.", err);
            }
          }
        }
      }
      // Package Melodic Custom Samples
      if (stateCopy.customSamples) {
        for (const [inst, sample] of Object.entries<any>(stateCopy.customSamples)) {
          if (sample?.url && sample.url.startsWith('blob:')) {
            try {
              const res = await fetch(sample.url);
              const blob = await res.blob();
              const ext = sample.name.split('.').pop() || 'wav';
              const filename = `${inst}_${sample.name}`;
              samplesFolder.file(filename, blob);
              sample.url = `custom_samples/${filename}`; // Rewrite URL for import
            } catch (err) {
              console.warn("Failed to fetch custom melodic sample blob for zip export.", err);
            }
          }
        }
      }
    }

    zip.file("session.json", JSON.stringify(stateCopy, null, 2));
  }
  const midiFolder = zip.folder("session_midi_stems");

  if (midiFolder) {
    midiFolder.file("session_multitrack.mid", createMidiFile(tracks));
    instrumentTypes.forEach((inst, idx) => {
      if (instrumentStates[inst].enabled) {
        midiFolder.file(`${inst}.mid`, createMidiFile([tracks[0], tracks[idx + 1]]));
      }
    });
  }

  const content = await zip.generateAsync({ type: "blob" });
  saveAs(content, "session_export.zip");
};

