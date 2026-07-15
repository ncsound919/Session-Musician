/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { 
  GraduationCap, 
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Layout,
  Sliders
} from 'lucide-react';
import { ChordSequencer } from '../ChordSequencer';
import { TheoryCriticPanel } from '../TheoryCriticPanel';
import { SeniorDevDashboard } from '../SeniorDevDashboard';
import { InstrumentType, Song, SessionParameters } from '../../types';
import { SONG_STRUCTURES } from '../../types';

interface TheoryViewProps {
  song: Song;
  songParams: Partial<SessionParameters>;
  onSongUpdate: (updater: (prev: Song) => Song) => void;
  onSongParamsUpdate: (params: Partial<SessionParameters>) => void;
  onRegenerateChords: () => void;
  onApplyTheoryFix: (fix: any) => void;
  activeSectionId: string;
}

export const TheoryView: React.FC<TheoryViewProps> = ({
  song,
  songParams,
  onSongUpdate,
  onSongParamsUpdate,
  onRegenerateChords,
  onApplyTheoryFix,
  activeSectionId
}) => {
  const activeSection = song.sections.find(s => s.id === activeSectionId) || song.sections[0];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-studio-accent/20 flex items-center justify-center">
            <GraduationCap className="w-5 h-5 text-studio-accent" />
          </div>
          <div>
            <h2 className="text-xl font-medium tracking-tight">Composition Engine</h2>
            <p className="text-xs text-studio-muted font-mono uppercase tracking-widest">Advanced Music Theory & AI Architecture</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex bg-studio-card border border-studio-border rounded-lg p-1">
            <button 
              onClick={() => {}} 
              className="p-1.5 hover:bg-white/5 rounded text-studio-muted"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="px-3 flex items-center">
              <span className="text-[10px] font-mono text-white/80 uppercase tracking-widest">{activeSection?.name}</span>
            </div>
            <button 
              onClick={() => {}} 
              className="p-1.5 hover:bg-white/5 rounded text-studio-muted"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <button 
            onClick={onRegenerateChords}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-studio-border text-white rounded-lg transition-all text-xs font-mono uppercase tracking-widest"
          >
            <Sparkles className="w-4 h-4 text-studio-accent" /> Re-compose Section
          </button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-8 space-y-6">
          <ChordSequencer 
            song={song} 
            activeSectionId={activeSectionId}
            onUpdate={(updater) => onSongUpdate(updater)}
          />

          <SeniorDevDashboard 
            song={song}
            songParams={songParams}
            onUpdateParams={onSongParamsUpdate}
          />
        </div>

        <div className="col-span-12 lg:col-span-4 space-y-6">
          <div className="bg-studio-card border border-studio-border rounded-2xl p-6">
            <h3 className="text-[10px] font-mono text-studio-muted uppercase tracking-widest mb-6 flex items-center gap-2">
              <Layout className="w-3 h-3 text-studio-accent" /> Arrangement Structure
            </h3>
            <div className="space-y-2">
              {song.sections.map((sec) => (
                <button
                  key={sec.id}
                  onClick={() => onSongUpdate(prev => ({ ...prev, activeSectionId: sec.id }))}
                  className={`w-full p-4 rounded-xl border text-left transition-all ${
                    sec.id === activeSectionId 
                      ? 'bg-studio-accent/20 border-studio-accent' 
                      : 'bg-white/5 border-studio-border/30 hover:border-studio-border/60'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-[11px] font-mono uppercase tracking-wider ${sec.id === activeSectionId ? 'text-studio-accent' : 'text-white/60'}`}>
                      {sec.name}
                    </span>
                    <span className="text-[9px] font-mono text-studio-muted">{sec.chords.length} Bars</span>
                  </div>
                </button>
              ))}
              <div className="pt-4 mt-4 border-t border-studio-border/30">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <span className="text-[8px] font-mono text-studio-muted uppercase">Structure</span>
                    <select 
                      className="w-full bg-white/5 border border-studio-border/30 rounded-lg p-2 text-[10px] font-mono text-white/80 outline-none"
                      onChange={(e) => {
                        const structure = SONG_STRUCTURES.find(s => s.name === e.target.value);
                        if (structure) {
                          onSongUpdate(prev => ({
                            ...prev,
                            sections: structure.sections.map(s => ({
                              id: Math.random().toString(36).substr(2, 9),
                              name: s,
                              chords: [], // musicTheoryEngine will handle populating
                              instrumentParams: {}
                            }))
                          }));
                        }
                      }}
                    >
                      {SONG_STRUCTURES.map(s => (
                        <option key={s.name} value={s.name}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[8px] font-mono text-studio-muted uppercase">Key Center</span>
                    <div className="flex gap-1">
                      <input 
                        type="text" 
                        value={song.key} 
                        readOnly
                        className="w-full bg-white/5 border border-studio-border/30 rounded-lg p-2 text-[10px] font-mono text-white/80 outline-none text-center"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <TheoryCriticPanel 
            song={song}
            activeSectionId={activeSectionId}
            onApplyFix={onApplyTheoryFix}
          />
        </div>
      </div>
    </div>
  );
};
