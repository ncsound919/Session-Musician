/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { TakeTrack, Take, HighlightRegion, MidiNote } from '../types';
import takeTrackSchema from '../schemas/takes.schema.json';

const ajv = new Ajv({ allErrors: true });
addFormats(ajv);
const validateTakeTrack = ajv.compile(takeTrackSchema);

/**
 * Generate a unique highlight-region ID using a random suffix to avoid
 * collisions across multiple TakeTrack instances.
 */
export function generateHighlightId(): string {
  const random = Math.random().toString(36).slice(2, 8);
  return `h_${Date.now()}_${random}`;
}

/**
 * Create a new empty TakeTrack.
 */
export function createTakeTrack(trackId: string, instrumentHint: string): TakeTrack {
  return {
    track_id: trackId,
    instrument_hint: instrumentHint,
    takes: [],
  };
}

/**
 * Build a new Take from a set of MIDI notes.  Automatically assigns the next
 * sequential ID and records the current timestamp.
 */
export function createTake(
  track: TakeTrack,
  midiNotes: MidiNote[],
): Take {
  const nextId = track.takes.length > 0
    ? Math.max(...track.takes.map(t => t.id)) + 1
    : 1;

  return {
    id: nextId,
    recorded_at: new Date().toISOString(),
    midi_notes: midiNotes,
    highlight_regions: [],
  };
}

/**
 * Append a take to a track (returns a new TakeTrack).
 */
export function addTake(track: TakeTrack, take: Take): TakeTrack {
  return {
    ...track,
    takes: [...track.takes, take],
  };
}

/**
 * Add a highlight region to a specific take inside a track.
 */
export function addHighlightRegion(
  track: TakeTrack,
  takeId: number,
  region: Omit<HighlightRegion, 'id'>,
): TakeTrack {
  return {
    ...track,
    takes: track.takes.map(t =>
      t.id === takeId
        ? {
            ...t,
            highlight_regions: [
              ...t.highlight_regions,
              { ...region, id: generateHighlightId() },
            ],
          }
        : t
    ),
  };
}

/**
 * Remove a highlight region from a specific take.
 */
export function removeHighlightRegion(
  track: TakeTrack,
  takeId: number,
  highlightId: string,
): TakeTrack {
  return {
    ...track,
    takes: track.takes.map(t =>
      t.id === takeId
        ? {
            ...t,
            highlight_regions: t.highlight_regions.filter(h => h.id !== highlightId),
          }
        : t
    ),
  };
}

/**
 * Collect user-readable hints from the previous take's highlight regions and
 * expression sections.  These strings can be stored in the next take's
 * `applied_hints_from_previous_take` field and used to drive AI generation.
 */
export function collectHintsFromTake(take: Take): string[] {
  const hints: string[] = [];

  for (const region of take.highlight_regions) {
    const range = `${region.start}-${region.end}`;
    if (region.action === 'keep') {
      hints.push(`keep bars ${range}`);
    } else if (region.action === 'delete') {
      hints.push(`delete bars ${range}`);
    } else {
      hints.push(`${region.action} bars ${range}`);
    }
  }

  if (take.expressions) {
    for (const section of take.expressions.sections) {
      hints.push(`${section.label} bars ${section.start}-${section.end} (strength ${section.strength})`);
    }
  }

  return hints;
}

/**
 * Serialize a TakeTrack to a JSON string (for export / saving).
 */
export function exportTakeTrack(track: TakeTrack): string {
  return JSON.stringify(track, null, 2);
}

/**
 * Parse a JSON string into a TakeTrack (for import / loading).
 * Validates against the TakeTrack JSON Schema. Throws if the data is invalid.
 */
export function importTakeTrack(json: string): TakeTrack {
  const parsed = JSON.parse(json);

  if (!validateTakeTrack(parsed)) {
    const errors = validateTakeTrack.errors ?? [];
    const details = errors.map(e => `${e.instancePath || '/'}: ${e.message}`).join('; ');
    throw new Error(`Invalid TakeTrack JSON: ${details}`);
  }

  return parsed as TakeTrack;
}
