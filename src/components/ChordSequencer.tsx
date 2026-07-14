/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Plus, Trash2, GripVertical, Music, Sparkles, Loader2 } from 'lucide-react';
import { Chord, CHORD_ROOTS, CHORD_TYPES } from '../types';

interface ChordSequencerProps {
  chords: Chord[];
  onChange: (chords: Chord[]) => void;
}

export const ChordSequencer: React.FC<ChordSequencerProps> = ({ chords, onChange }) => {
  const [isSuggesting, setIsSuggesting] = React.useState(false);

  const addChord = () => {
    onChange([...chords, { root: 'C', type: 'maj', duration: 4 }]);
  };

  const suggestNextChord = async () => {
    if (isSuggesting) return;
    setIsSuggesting(true);

    try {
      const response = await fetch('/api/suggest-chord', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ chords })
      });

      if (!response.ok) {
        throw new Error('Suggestion request failed');
      }

      const result = await response.json();
      if (result && result.root && result.type) {
        onChange([...chords, { root: result.root, type: result.type, duration: 4 }]);
      }
    } catch (error) {
      console.error("Suggestion failed", error);
    } finally {
      setIsSuggesting(false);
    }
  };

  const removeChord = (index: number) => {
    onChange(chords.filter((_, i) => i !== index));
  };

  const updateChord = (index: number, updates: Partial<Chord>) => {
    const newChords = [...chords];
    newChords[index] = { ...newChords[index], ...updates };
    onChange(newChords);
  };

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
            style={{ background: 'linear-gradient(180deg, #6366f1 0%, #4f46e5 100%)', color: '#ffffff' }}
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
        {chords.map((chord, index) => (
          <div 
            key={index}
            className="flex items-center gap-2 p-2 rounded-lg group"
            style={{ background: '#1a1a1c', border: '1px solid #222224' }}
          >
            <GripVertical className="w-3 h-3 text-studio-muted cursor-grab" />
            
            <div className="flex-1 grid grid-cols-3 gap-2">
              <select 
                value={chord.root}
                onChange={(e) => updateChord(index, { root: e.target.value })}
                className="bg-studio-panel border border-studio-border rounded-md px-2 py-1 text-xs font-mono text-studio-text outline-none focus:border-studio-accent/50"
              >
                {CHORD_ROOTS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>

              <select 
                value={chord.type}
                onChange={(e) => updateChord(index, { type: e.target.value })}
                className="bg-studio-panel border border-studio-border rounded-md px-2 py-1 text-xs font-mono text-studio-text outline-none focus:border-studio-accent/50"
              >
                {CHORD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>

              <div className="flex items-center gap-2 bg-studio-panel border border-studio-border rounded-md px-2 py-1">
                <span className="text-[8px] font-mono text-studio-muted">BEATS</span>
                <input 
                  type="number"
                  value={chord.duration}
                  onChange={(e) => updateChord(index, { duration: parseInt(e.target.value) || 1 })}
                  className="w-full bg-transparent text-xs font-mono text-studio-accent outline-none text-center"
                />
              </div>
            </div>

            <button 
              onClick={() => removeChord(index)}
              className="p-1.5 text-studio-muted hover:text-studio-red opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
