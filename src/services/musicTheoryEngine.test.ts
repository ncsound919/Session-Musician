import { describe, it, expect } from 'vitest';
import { getChordNotes } from './musicTheoryEngine';

describe('musicTheoryEngine', () => {
  it('should get correct notes for a C major chord', () => {
    const notes = getChordNotes('C', 'maj');
    expect(notes).toEqual([0, 4, 7]);
  });

  it('should get correct notes for an A minor chord', () => {
    const notes = getChordNotes('A', 'min');
    expect(notes).toEqual([9, 0, 4]); // A (9), C (0), E (4)
  });
});
