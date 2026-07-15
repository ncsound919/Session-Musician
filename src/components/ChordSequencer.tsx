/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useRef, useState, useEffect } from 'react';
import { Plus, Trash2, GripVertical, Music, Sparkles, Loader2 } from 'lucide-react';
import { Chord, CHORD_ROOTS, CHORD_TYPES } from '../types';

interface ChordSequencerProps {
  chords: Chord[];
  onChange: (chords: Chord[]) => void;
}

interface ChordWithId extends Chord {
  _id: number; // internal stable ID for keying & drag
}

const DEFAULT_CHORD: Chord = { root: 'C', type: 'maj', duration: 4 };

let nextId = 1; // module‑level ID counter – survives HMR resets

// FIXED: widen these for runtime .includes() checks against a plain string,
// avoiding a TS error where a literal-union array rejects a `string` argument.
const CHORD_ROOTS_LIST: readonly string[] = CHORD_ROOTS;
const CHORD_TYPES_LIST: readonly string[] = CHORD_TYPES;

export const ChordSequencer: React.FC<ChordSequencerProps> = ({ chords, onChange }) => {
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Keep an internal version of the chords with stable IDs
  const [internalChords, setInternalChords] = useState<ChordWithId[]>(() =>
    chords.map((c) => ({ ...c, _id: nextId++ }))
  );

  // When parent chords change (e.g., AI generation), sync the internal state.
  // We match existing chords by index to preserve IDs and keep a smooth UX.
  useEffect(() => {
    // If the array length or content changed, rebuild internal list,
    // preserving IDs for chords that didn't change structurally.
    // For simplicity, we assume that if the parent replaces the array,
    // we want to map over it and assign new IDs where needed.
    setInternalChords((prevInternal) => {
      const newInternal = chords.map((c, i) => {
        const existing = prevInternal[i];
        // Keep existing ID if chord data is the same (prevents re‑mount)
        if (
          existing &&
          existing.root === c.root &&
          existing.type === c.type &&
          existing.duration === c.duration
        ) {
          return existing;
        }
        return { ...c, _id: nextId++ };
      });

      const changed =
        newInternal.length !== prevInternal.length ||
        newInternal.some((c, i) => c._id !== prevInternal[i]?._id);

      return changed ? newInternal : prevInternal;
    });
  }, [chords]);

  // Keep a ref of the current chords (with IDs stripped) for the AI suggestion endpoint
  const chordsForAPI = useRef(chords);
  useEffect(() => {
    chordsForAPI.current = chords; // always keep the latest pure chords
  }, [chords]);

  const abortControllerRef = useRef<AbortController | null>(null);

  // Cleanup on unmount – abort any in‑flight suggestion
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  // Notify parent with chords without internal _id
  const emitChords = useCallback(
    (next: ChordWithId[]) => {
      onChange(next.map(({ _id, ...rest }) => rest));
    },
    [onChange]
  );

  // FIXED: all mutations below now use the functional setState form so they
  // always operate on the latest state rather than a closure snapshot. This
  // prevents lost updates when two mutations (e.g. an edit and an in-flight
  // AI suggestion) resolve in overlapping render cycles.

  const addChord = useCallback(() => {
    setInternalChords((prev) => {
      const newChord: ChordWithId = { ...DEFAULT_CHORD, _id: nextId++ };
      const updated = [...prev, newChord];
      emitChords(updated);
      return updated;
    });
  }, [emitChords]);

  const removeChord = useCallback(
    (index: number) => {
      setInternalChords((prev) => {
        const updated = prev.filter((_, i) => i !== index);
        emitChords(updated);
        return updated;
      });
    },
    [emitChords]
  );

  const updateChord = useCallback(
    (index: number, updates: Partial<Chord>) => {
      setInternalChords((prev) => {
        const updated = prev.map((c, i) => (i === index ? { ...c, ...updates } : c));
        emitChords(updated);
        return updated;
      });
    },
    [emitChords]
  );

  const suggestNextChord = useCallback(async () => {
    if (isSuggesting) return;
    setIsSuggesting(true);

    // Abort any previous lingering request
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch('/api/suggest-chord', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chords: chordsForAPI.current }),
        signal: controller.signal,
      });

      if (!response.ok) throw new Error('Suggestion request failed');

      const result = await response.json();

      if (
        result &&
        typeof result.root === 'string' &&
        CHORD_ROOTS_LIST.includes(result.root) &&
        typeof result.type === 'string' &&
        CHORD_TYPES_LIST.includes(result.type)
      ) {
        // FIXED: append via functional setState so this doesn't clobber any
        // edit made by the user while the request was in flight.
        setInternalChords((prev) => {
          const newChord: ChordWithId = {
            root: result.root,
            type: result.type,
            duration: DEFAULT_CHORD.duration,
            _id: nextId++,
          };
          const updated = [...prev, newChord];
          emitChords(updated);
          return updated;
        });
      } else {
        console.warn('Received invalid chord from AI suggestion:', result);
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('Suggestion failed', error);
      }
    } finally {
      // Only reset if the same controller is still active
      if (abortControllerRef.current === controller) {
        setIsSuggesting(false);
      }
    }
  }, [isSuggesting, emitChords]);

  // Drag‑and‑drop handlers (use internal index)
  const handleDragStart = useCallback((e: React.DragEvent, idx: number) => {
    e.dataTransfer.setData('text/plain', idx.toString());
    e.dataTransfer.effectAllowed = 'move';
    setDraggedIndex(idx);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggedIndex(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, targetIdx: number) => {
      e.preventDefault();
      const draggedIdxStr = e.dataTransfer.getData('text/plain');
      if (!draggedIdxStr) return;
      const draggedIdx = parseInt(draggedIdxStr, 10);
      if (isNaN(draggedIdx) || draggedIdx === targetIdx) return;

      setInternalChords((prev) => {
        if (draggedIdx < 0 || draggedIdx >= prev.length) return prev;
        const newChords = [...prev];
        const [removed] = newChords.splice(draggedIdx, 1);
        newChords.splice(targetIdx, 0, removed);
        emitChords(newChords);
        return newChords;
      });

      setDraggedIndex(null);
    },
    [emitChords]
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-[9px] font-mono text-studio-muted uppercase tracking-[0.15em] flex items-center gap-2">
          <Music className="w-3 h-3" /> Chord Progression
        </label>
        <div className="flex items-center gap-2">
          <button
            onClick={suggestNextChord}
            disabled={isSuggesting}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[9px] font-mono font-bold uppercase hover:scale-105 transition-all disabled:opacity-50 cursor-pointer"
            style={{
              background: 'linear-gradient(180deg, #6366f1 0%, #4f46e5 100%)',
              color: '#ffffff',
            }}
          >
            {isSuggesting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
            AI Suggest
          </button>
          <button
            onClick={addChord}
            className="p-1.5 rounded-md text-studio-accent hover:bg-studio-accent/10 transition-all cursor-pointer"
            style={{ border: '1px solid rgba(99,102,241,0.2)' }}
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-1.5 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
        {internalChords.map((chord, index) => {
          const isDragging = draggedIndex === index;
          return (
            <div
              key={chord._id} // ✅ stable key – no DOM re‑creation during reorder
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleDrop(e, index)}
              className={`flex items-center gap-2 p-2 rounded-lg group cursor-grab active:cursor-grabbing transition-all hover:bg-studio-accent/5 ${
                isDragging ? 'opacity-50 border-dashed border-studio-accent' : ''
              }`}
              style={{
                background: '#1a1a1c',
                border: isDragging ? '1px dashed #6366f1' : '1px solid #222224',
              }}
            >
              {/* Drag handle – now keyboard focusable */}
              <button
                type="button"
                aria-label="Reorder chord"
                className="p-0.5 rounded hover:bg-white/10 focus:outline-none focus-visible:ring-1 focus-visible:ring-studio-accent"
                onDragStart={(e) => e.preventDefault()} // prevent drag from button itself
              >
                <GripVertical className="w-3 h-3 text-studio-muted" />
              </button>

              <div className="flex-1 grid grid-cols-3 gap-2">
                <select
                  value={chord.root}
                  onChange={(e) => updateChord(index, { root: e.target.value })}
                  aria-label={`Chord ${index + 1} root`}
                  className="bg-studio-panel border border-studio-border rounded-md px-2 py-1 text-xs font-mono text-studio-text outline-none focus:border-studio-accent/50"
                >
                  {CHORD_ROOTS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>

                <select
                  value={chord.type}
                  onChange={(e) => updateChord(index, { type: e.target.value })}
                  aria-label={`Chord ${index + 1} type`}
                  className="bg-studio-panel border border-studio-border rounded-md px-2 py-1 text-xs font-mono text-studio-text outline-none focus:border-studio-accent/50"
                >
                  {CHORD_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>

                <div className="flex items-center gap-2 bg-studio-panel border border-studio-border rounded-md px-2 py-1">
                  <span className="text-[8px] font-mono text-studio-muted">BEATS</span>
                  <input
                    type="number"
                    min="1"
                    max="32"
                    value={chord.duration}
                    onChange={(e) => {
                      const val = Math.max(1, Math.min(32, parseInt(e.target.value, 10) || 1));
                      updateChord(index, { duration: val });
                    }}
                    aria-label={`Chord ${index + 1} duration in beats`}
                    className="w-full bg-transparent text-xs font-mono text-studio-accent outline-none text-center"
                  />
                </div>
              </div>

              <button
                onClick={() => removeChord(index)}
                aria-label={`Remove chord ${index + 1}`}
                className="p-1.5 text-studio-muted hover:text-studio-red opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all cursor-pointer"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
