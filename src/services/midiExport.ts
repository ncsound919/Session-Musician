/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Chord, SessionParameters } from '../types';

const TICKS_PER_BEAT = 480;

const NOTE_MAP: Record<string, number> = {
  'C': 60, 'C#': 61, 'D': 62, 'D#': 63, 'E': 64, 'F': 65,
  'F#': 66, 'G': 67, 'G#': 68, 'A': 69, 'A#': 70, 'B': 71
};

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

interface MidiEvent {
  tick: number;
  status: number;
  data: number[];
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

function generateDrums(chords: Chord[], playStyle: string, groove: number, sparseness: number, pocket: number, humanize: number): MidiEvent[] {
  const events: MidiEvent[] = [];
  let currentTick = 0;

  for (let cIdx = 0; cIdx < chords.length; cIdx++) {
    const chord = chords[cIdx];
    const durationBeats = chord.duration;
    
    for (let beat = 0; beat < durationBeats; beat++) {
      const beatTick = currentTick + beat * TICKS_PER_BEAT;
      
      const maxOffsetMs = 20;
      const offsetMs = ((100 - pocket) / 100) * maxOffsetMs;
      const ticksPerMs = (120 * TICKS_PER_BEAT) / 60000;
      const pocketOffsetTicks = Math.round(offsetMs * ticksPerMs);

      const maxHumanizeOffset = (humanize / 100) * 12;
      const humanizeOffset = Math.round((Math.random() - 0.5) * maxHumanizeOffset);
      const timingOffset = pocketOffsetTicks + humanizeOffset;

      const addDrumEvent = (tick: number, note: number, vel: number, dur = 120) => {
        const velVar = Math.round((Math.random() - 0.5) * (humanize / 100) * 20);
        const finalVel = Math.max(1, Math.min(127, vel + velVar));
        
        events.push({
          tick: Math.max(0, tick + timingOffset),
          status: 0x99, // Ch 10 Note On
          data: [note, finalVel]
        });
        events.push({
          tick: Math.max(0, tick + timingOffset + dur),
          status: 0x89, // Ch 10 Note Off
          data: [note, 0]
        });
      };

      if (playStyle === 'Purdie Shuffle') {
        if (beat === 0) {
          addDrumEvent(beatTick, 36, 110);
        } else if (beat === 2) {
          addDrumEvent(beatTick, 36, 105);
          addDrumEvent(beatTick + 320, 36, 85);
        }
        
        if (beat === 1 || beat === 3) {
          addDrumEvent(beatTick, 38, 120);
        } else {
          addDrumEvent(beatTick + 160, 38, 45);
          addDrumEvent(beatTick + 320, 38, 50);
        }

        addDrumEvent(beatTick, 42, 95);
        addDrumEvent(beatTick + 160, 42, 50);
        addDrumEvent(beatTick + 320, 42, 85);
      } 
      else if (playStyle === 'Stubblefield Breakbeat') {
        if (beat === 0) {
          addDrumEvent(beatTick, 36, 115);
          addDrumEvent(beatTick + 240, 36, 95);
        } else if (beat === 2) {
          addDrumEvent(beatTick + 120, 36, 100);
          addDrumEvent(beatTick + 360, 36, 90);
        }

        if (beat === 1 || beat === 3) {
          addDrumEvent(beatTick, 38, 120);
          addDrumEvent(beatTick + 360, 38, 50);
        } else {
          addDrumEvent(beatTick + 120, 38, 45);
          addDrumEvent(beatTick + 240, 38, 48);
        }

        addDrumEvent(beatTick, 42, 90);
        addDrumEvent(beatTick + 120, 42, 70);
        if (beat === 1 || beat === 3) {
          addDrumEvent(beatTick + 240, 46, 100);
          addDrumEvent(beatTick + 360, 42, 80);
        } else {
          addDrumEvent(beatTick + 240, 42, 85);
          addDrumEvent(beatTick + 360, 42, 75);
        }
      } 
      else if (playStyle === 'Al Jackson Backbeat') {
        if (beat === 0 || beat === 2) {
          addDrumEvent(beatTick, 36, 110);
        } else if (beat === 1 && Math.random() > 0.6) {
          addDrumEvent(beatTick + 360, 36, 85);
        }

        if (beat === 1 || beat === 3) {
          addDrumEvent(beatTick, 38, 115);
        }

        addDrumEvent(beatTick, 42, 85);
        addDrumEvent(beatTick + 240, 42, 75);
      } 
      else if (playStyle === 'Hal Blaine Pocket') {
        if (beat === 0) {
          addDrumEvent(beatTick, 36, 115);
          if (cIdx === 0) addDrumEvent(beatTick, 49, 110); // Crash on very start
        } else if (beat === 2) {
          addDrumEvent(beatTick, 36, 105);
          addDrumEvent(beatTick + 240, 36, 90);
        }

        if (beat === 1 || beat === 3) {
          addDrumEvent(beatTick, 38, 120);
        }

        addDrumEvent(beatTick, 42, 90);
        addDrumEvent(beatTick + 240, 42, 80);

        if (cIdx === chords.length - 1 && beat === durationBeats - 1) {
          addDrumEvent(beatTick + 240, 50, 105);
          addDrumEvent(beatTick + 360, 47, 105);
          addDrumEvent(beatTick + 420, 45, 110);
        }
      }
      else if (playStyle === 'Greg Errico Drive') {
        if (beat === 0 || beat === 2) {
          addDrumEvent(beatTick, 36, 110);
          if (beat === 2) addDrumEvent(beatTick + 240, 36, 95);
        }
        if (beat === 1 || beat === 3) {
          addDrumEvent(beatTick, 38, 115);
        }

        addDrumEvent(beatTick, 51, 95);
        addDrumEvent(beatTick + 240, 53, 105);
      }
      else if (playStyle === 'Jazz swing') {
        addDrumEvent(beatTick, 51, 85);
        if (beat === 1 || beat === 3) {
          addDrumEvent(beatTick + 320, 51, 75);
        } else {
          addDrumEvent(beatTick + 320, 51, 55);
        }

        if (beat === 1 || beat === 3) {
          addDrumEvent(beatTick, 44, 85);
        }

        addDrumEvent(beatTick, 36, 35);

        if (Math.random() > 0.4) {
          addDrumEvent(beatTick + 160, 40, 40);
        }
      }
      else if (playStyle === 'Four-on-the-floor') {
        addDrumEvent(beatTick, 36, 110);
        if (beat === 1 || beat === 3) {
          addDrumEvent(beatTick, 38, 115);
        }
        addDrumEvent(beatTick + 240, 46, 95);
      }
      else {
        if (beat === 0 || beat === 2) {
          addDrumEvent(beatTick, 36, 105);
        }
        if (beat === 1 || beat === 3) {
          addDrumEvent(beatTick, 38, 110);
        }
        addDrumEvent(beatTick, 42, 85);
        addDrumEvent(beatTick + 240, 42, 75);
      }
    }
    
    currentTick += durationBeats * TICKS_PER_BEAT;
  }

  return events;
}

function generateBass(chords: Chord[], playStyle: string, groove: number, sparseness: number, pocket: number, humanize: number): MidiEvent[] {
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

    const addBassNote = (tick: number, note: number, vel: number, dur: number) => {
      const maxHumanizeOffset = (humanize / 100) * 15;
      const timingOffset = Math.round((Math.random() - 0.5) * maxHumanizeOffset);
      const finalTick = Math.max(0, tick + timingOffset);
      
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
    };

    if (playStyle === 'Jamerson Chromatic') {
      for (let beat = 0; beat < durationBeats; beat++) {
        const beatTick = currentTick + beat * TICKS_PER_BEAT;
        
        if (beat === 0) {
          addBassNote(beatTick, bassBase, 115, 360);
          addBassNote(beatTick + 240, chordNotes[1] ?? (bassBase + 4), 95, 200);
        } else if (beat === 1) {
          addBassNote(beatTick, chordNotes[2] ?? (bassBase + 7), 100, 200);
          addBassNote(beatTick + 240, bassBase + 12, 105, 200);
        } else if (beat === 2) {
          addBassNote(beatTick + 120, bassBase, 105, 200);
          addBassNote(beatTick + 360, chordNotes[1] ?? (bassBase + 4), 95, 100);
        } else if (beat === 3) {
          addBassNote(beatTick, chordNotes[2] ?? (bassBase + 7), 100, 200);
          
          let approachNote = nextRootNote - 1;
          if (nextRootNote < bassBase) {
            approachNote = nextRootNote + 1;
          } else if (nextRootNote === bassBase) {
            approachNote = bassBase + 7;
          }
          addBassNote(beatTick + 240, approachNote, 110, 200);
        }
      }
    } 
    else if (playStyle === 'Bootsy Envelope Slap') {
      for (let beat = 0; beat < durationBeats; beat++) {
        const beatTick = currentTick + beat * TICKS_PER_BEAT;
        
        if (beat === 0) {
          addBassNote(beatTick, bassBase, 125, 180);
          addBassNote(beatTick + 240, bassBase + 12, 120, 180);
        } else if (beat === 1) {
          addBassNote(beatTick + 120, bassBase + 10, 115, 180);
          if (Math.random() > 0.5) {
            addBassNote(beatTick + 360, bassBase + 12, 110, 100);
          }
        } else if (beat === 2) {
          addBassNote(beatTick, bassBase, 120, 180);
          addBassNote(beatTick + 240, bassBase + 7, 115, 180);
        } else if (beat === 3) {
          addBassNote(beatTick + 120, bassBase + 10, 120, 180);
          addBassNote(beatTick + 360, nextRootNote - 1, 115, 100);
        }
      }
    } 
    else if (playStyle === 'Carol Kaye Picked') {
      for (let beat = 0; beat < durationBeats; beat++) {
        const beatTick = currentTick + beat * TICKS_PER_BEAT;
        
        if (beat === 0) {
          addBassNote(beatTick, bassBase, 105, 200);
          addBassNote(beatTick + 240, bassBase, 100, 200);
        } else if (beat === 1) {
          addBassNote(beatTick, chordNotes[1] ?? (bassBase + 4), 105, 200);
          addBassNote(beatTick + 240, chordNotes[2] ?? (bassBase + 7), 105, 200);
        } else if (beat === 2) {
          addBassNote(beatTick, bassBase + 9, 105, 200);
          addBassNote(beatTick + 240, chordNotes[2] ?? (bassBase + 7), 100, 200);
        } else if (beat === 3) {
          addBassNote(beatTick, chordNotes[1] ?? (bassBase + 4), 105, 200);
          addBassNote(beatTick + 240, nextRootNote, 105, 200);
        }
      }
    }
    else if (playStyle === 'Duck Dunn Stax Pocket') {
      for (let beat = 0; beat < durationBeats; beat++) {
        const beatTick = currentTick + beat * TICKS_PER_BEAT;
        
        if (beat === 0) {
          addBassNote(beatTick, bassBase, 115, 380);
        } else if (beat === 2) {
          addBassNote(beatTick, chordNotes[2] ?? (bassBase + 7), 110, 380);
        } else if (beat === 3 && Math.random() > 0.6) {
          addBassNote(beatTick + 240, nextRootNote - 1, 105, 200);
        }
      }
    }
    else if (playStyle === 'Chuck Rainey Session') {
      for (let beat = 0; beat < durationBeats; beat++) {
        const beatTick = currentTick + beat * TICKS_PER_BEAT;
        
        if (beat === 0) {
          addBassNote(beatTick, bassBase, 110, 350);
        } else if (beat === 1) {
          addBassNote(beatTick + 240, bassBase + 12, 100, 200);
          addBassNote(beatTick + 240, bassBase + 16, 95, 200);
        } else if (beat === 2) {
          addBassNote(beatTick, chordNotes[2] ?? (bassBase + 7), 105, 350);
        } else if (beat === 3) {
          addBassNote(beatTick + 240, nextRootNote, 105, 200);
        }
      }
    }
    else if (playStyle === 'Walking Bass') {
      for (let beat = 0; beat < durationBeats; beat++) {
        const beatTick = currentTick + beat * TICKS_PER_BEAT;
        
        if (beat === 0) {
          addBassNote(beatTick, bassBase, 110, 440);
        } else if (beat === 1) {
          addBassNote(beatTick, chordNotes[1] ?? (bassBase + 4), 100, 440);
        } else if (beat === 2) {
          addBassNote(beatTick, chordNotes[2] ?? (bassBase + 7), 105, 440);
        } else if (beat === 3) {
          const chromaticStep = nextRootNote > bassBase + 7 ? nextRootNote - 1 : nextRootNote + 1;
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
    else {
      for (let beat = 0; beat < durationBeats; beat++) {
        const beatTick = currentTick + beat * TICKS_PER_BEAT;
        if (beat === 0) {
          addBassNote(beatTick, bassBase, 110, 400);
        } else if (beat === 2) {
          addBassNote(beatTick, chordNotes[2] ?? (bassBase + 7), 105, 400);
        }
      }
    }

    currentTick += durationBeats * TICKS_PER_BEAT;
  }

  return events;
}

function generateKeys(chords: Chord[], playStyle: string, groove: number, sparseness: number, pocket: number, humanize: number): MidiEvent[] {
  const events: MidiEvent[] = [];
  let currentTick = 0;

  for (let cIdx = 0; cIdx < chords.length; cIdx++) {
    const chord = chords[cIdx];
    const durationBeats = chord.duration;
    const keysBase = (NOTE_MAP[chord.root] ?? 60) - 12; // Octave 4

    let voicing: number[] = [];
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

    const addKeysChords = (tick: number, notes: number[], vel: number, dur: number) => {
      const maxStrumDelay = (humanize / 100) * 20;
      
      notes.forEach((note, index) => {
        const noteDelay = Math.round(index * (maxStrumDelay / notes.length));
        const finalTick = Math.max(0, tick + noteDelay);
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
          addKeysChords(beatTick + 240, voicing, 95, 480);
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
        addKeysChords(beatTick, voicing, 105, 180);
      }
    } 
    else if (playStyle === 'Booker T Drawbars') {
      addKeysChords(currentTick, voicing, 85, durationBeats * TICKS_PER_BEAT - 20);
    } 
    else if (playStyle === 'Bernie Worrell Clav') {
      const clavVoicing = voicing.slice(0, 3);
      for (let beat = 0; beat < durationBeats; beat++) {
        const beatTick = currentTick + beat * TICKS_PER_BEAT;
        if (beat === 0 || beat === 2) {
          addKeysChords(beatTick, clavVoicing, 105, 100);
          addKeysChords(beatTick + 240, clavVoicing, 95, 100);
        } else {
          addKeysChords(beatTick + 120, clavVoicing, 100, 100);
          addKeysChords(beatTick + 360, clavVoicing, 90, 100);
        }
      }
    }
    else {
      addKeysChords(currentTick, voicing, 90, TICKS_PER_BEAT * 2 - 40);
      addKeysChords(currentTick + TICKS_PER_BEAT * 2, voicing, 85, TICKS_PER_BEAT * 2 - 40);
    }

    currentTick += durationBeats * TICKS_PER_BEAT;
  }

  return events;
}

function generateGuitar(chords: Chord[], playStyle: string, groove: number, sparseness: number, pocket: number, humanize: number): MidiEvent[] {
  const events: MidiEvent[] = [];
  let currentTick = 0;

  for (let cIdx = 0; cIdx < chords.length; cIdx++) {
    const chord = chords[cIdx];
    const durationBeats = chord.duration;
    const gtrBase = (NOTE_MAP[chord.root] ?? 60) - 12; // Octave 4

    let voicing = [gtrBase + 4, gtrBase + 7, gtrBase + 12];
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

    const addGuitarChord = (tick: number, notes: number[], vel: number, dur: number, isPercussive = false) => {
      notes.forEach((note, idx) => {
        const strumDelay = idx * 6;
        const finalTick = Math.max(0, tick + strumDelay);
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
          addGuitarChord(beatTick - 40, doubleStop.map(n => n - 1), 90, 40);
          addGuitarChord(beatTick, doubleStop, 110, 240);
        }
      }
    } 
    else if (playStyle === 'Larry Carlton Fusion') {
      for (let beat = 0; beat < durationBeats; beat++) {
        const beatTick = currentTick + beat * TICKS_PER_BEAT;
        
        if (beat === 0) {
          addGuitarChord(beatTick + 120, voicing, 95, 480);
        } else if (beat === 2) {
          addGuitarChord(beatTick + 240, voicing, 90, 360);
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
    else {
      for (let beat = 0; beat < durationBeats; beat++) {
        const beatTick = currentTick + beat * TICKS_PER_BEAT;
        addGuitarChord(beatTick + 240, voicing, 90, 180);
      }
    }

    currentTick += durationBeats * TICKS_PER_BEAT;
  }

  return events;
}

function generatePads(chords: Chord[], playStyle: string, groove: number, sparseness: number, pocket: number, humanize: number): MidiEvent[] {
  const events: MidiEvent[] = [];
  let currentTick = 0;

  for (let cIdx = 0; cIdx < chords.length; cIdx++) {
    const chord = chords[cIdx];
    const durationBeats = chord.duration;
    const padsBase = (NOTE_MAP[chord.root] ?? 60) - 12; // Octave 4

    let voicing = [padsBase, padsBase + 7, padsBase + 12];
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

    voicing = Array.from(new Set(voicing));

    const addPadNotes = (tick: number, notes: number[], vel: number, dur: number) => {
      notes.forEach(note => {
        events.push({
          tick,
          status: 0x94, // Channel 5 Note On
          data: [note, vel]
        });
        events.push({
          tick: tick + dur,
          status: 0x84, // Channel 5 Note Off
          data: [note, 0]
        });
      });
    };

    addPadNotes(currentTick, voicing, 75, durationBeats * TICKS_PER_BEAT - 20);

    currentTick += durationBeats * TICKS_PER_BEAT;
  }

  return events;
}

function generateLead(chords: Chord[], playStyle: string, groove: number, sparseness: number, pocket: number, humanize: number): MidiEvent[] {
  const events: MidiEvent[] = [];
  let currentTick = 0;

  for (let cIdx = 0; cIdx < chords.length; cIdx++) {
    const chord = chords[cIdx];
    const durationBeats = chord.duration;
    const leadBase = (NOTE_MAP[chord.root] ?? 60) + 12; // Octave 6

    const scaleDegrees = chord.type.includes('min') 
      ? [0, 3, 5, 7, 10, 12]  // Minor Pentatonic
      : [0, 2, 4, 7, 9, 12];  // Major Pentatonic

    const addMelodicNote = (tick: number, note: number, vel: number, dur: number) => {
      const finalVel = Math.max(1, Math.min(127, vel + Math.round((Math.random() - 0.5) * 15)));
      events.push({
        tick,
        status: 0x95, // Channel 6 Note On
        data: [note, finalVel]
      });
      events.push({
        tick: tick + dur,
        status: 0x85, // Channel 6 Note Off
        data: [note, 0]
      });
    };

    if (playStyle === 'Maceo Horn Phrasing') {
      for (let beat = 0; beat < durationBeats; beat++) {
        const beatTick = currentTick + beat * TICKS_PER_BEAT;
        if (beat === 0) {
          addMelodicNote(beatTick, leadBase + scaleDegrees[3], 115, 120);
        } else if (beat === 1) {
          addMelodicNote(beatTick + 120, leadBase + scaleDegrees[4], 110, 120);
        } else if (beat === 2) {
          addMelodicNote(beatTick, leadBase + scaleDegrees[2], 105, 120);
          addMelodicNote(beatTick + 240, leadBase + scaleDegrees[0], 115, 120);
        }
      }
    } 
    else if (playStyle === 'Larry Carlton Lead') {
      const melodySub = [0, 2, 3, 2];
      melodySub.forEach((beatIdx, idx) => {
        const note = leadBase + scaleDegrees[idx % scaleDegrees.length];
        addMelodicNote(currentTick + idx * TICKS_PER_BEAT, note, 95, 380);
      });
    } 
    else if (playStyle === 'Eddie Hazel Lead') {
      for (let beat = 0; beat < durationBeats; beat++) {
        const beatTick = currentTick + beat * TICKS_PER_BEAT;
        if (beat === 0 || beat === 2) {
          addMelodicNote(beatTick, leadBase + scaleDegrees[4], 110, 240);
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
      addMelodicNote(currentTick + 240, leadBase + scaleDegrees[2], 85, 480);
    }

    currentTick += durationBeats * TICKS_PER_BEAT;
  }

  return events;
}

// --- Main Export Process ---

export const exportMidi = (chords: Chord[], params: Record<string, SessionParameters>, bpm = 120) => {
  const safeBpm = Number.isFinite(bpm) && bpm > 0 ? bpm : 120;
  const microsPerBeat = Math.round(60_000_000 / safeBpm);

  const tracks: number[][] = [];

  // Track 0: Conductor Track (Tempo, Time Signature)
  const conductorEvents: MidiEvent[] = [
    buildTrackNameEvent("Tempo Conductor"),
    {
      tick: 0,
      status: 0xff,
      data: [0x51, 0x03, (microsPerBeat >> 16) & 0xff, (microsPerBeat >> 8) & 0xff, microsPerBeat & 0xff] // Tempo
    },
    {
      tick: 0,
      status: 0xff,
      data: [0x58, 0x04, 0x04, 0x02, 0x18, 0x08] // 4/4 time signature
    }
  ];
  tracks.push(compileTrack(conductorEvents));

  // Helper to compile track with specific name and dynamic generator
  const addTrack = (name: string, generatorEvents: MidiEvent[]) => {
    const trackEvents = [
      buildTrackNameEvent(name),
      ...generatorEvents
    ];
    tracks.push(compileTrack(trackEvents));
  };

  // --- Track 1: Drums ---
  if (params.Drums) {
    const p = params.Drums;
    addTrack("Drums (Session)", generateDrums(chords, p.playStyle, p.groove, p.sparseness, p.pocket, p.humanize));
  } else {
    addTrack("Drums (Session)", []);
  }

  // --- Track 2: Bass ---
  if (params.Bass) {
    const p = params.Bass;
    addTrack("Bass (Session)", generateBass(chords, p.playStyle, p.groove, p.sparseness, p.pocket, p.humanize));
  } else {
    addTrack("Bass (Session)", []);
  }

  // --- Track 3: Keys / Piano ---
  if (params.Keys) {
    const p = params.Keys;
    addTrack("Piano Keys (Session)", generateKeys(chords, p.playStyle, p.groove, p.sparseness, p.pocket, p.humanize));
  } else {
    addTrack("Piano Keys (Session)", []);
  }

  // --- Track 4: Guitar ---
  if (params.Guitar) {
    const p = params.Guitar;
    addTrack("Guitar (Session)", generateGuitar(chords, p.playStyle, p.groove, p.sparseness, p.pocket, p.humanize));
  } else {
    addTrack("Guitar (Session)", []);
  }

  // --- Track 5: Pads / Strings ---
  if (params.Pads) {
    const p = params.Pads;
    addTrack("Strings Pads (Session)", generatePads(chords, p.playStyle, p.groove, p.sparseness, p.pocket, p.humanize));
  } else {
    addTrack("Strings Pads (Session)", []);
  }

  // --- Track 6: Lead / Bells ---
  if (params.Lead) {
    const p = params.Lead;
    addTrack("Bells Lead (Session)", generateLead(chords, p.playStyle, p.groove, p.sparseness, p.pocket, p.humanize));
  } else {
    addTrack("Bells Lead (Session)", []);
  }

  // MIDI header chunk: format 1, tracks length, TICKS_PER_BEAT division
  const header = [
    0x4d, 0x54, 0x68, 0x64, // "MThd"
    0x00, 0x00, 0x00, 0x06, // Chunk length = 6
    0x00, 0x01,             // Format = 1 (multiple tracks)
    (tracks.length >> 8) & 0xff, tracks.length & 0xff, // Number of tracks
    (TICKS_PER_BEAT >> 8) & 0xff, TICKS_PER_BEAT & 0xff // Ticks per beat
  ];

  // Concatenate all tracks
  const fileBytes: number[] = [...header];
  for (const track of tracks) {
    fileBytes.push(...track);
  }

  const midiData = new Uint8Array(fileBytes);
  const blob = new Blob([midiData], { type: 'audio/midi' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'session_accompaniment_multitrack.mid';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
