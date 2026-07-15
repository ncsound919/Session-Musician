/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { 
  Sliders,
  Download,
  Upload,
  Undo2,
  Redo2,
  Cpu
} from 'lucide-react';
import { InstrumentType, StylePreset, SessionParameters } from '../../types';
import { DrumKitManager } from '../DrumKitManager';
import { InspirationUpload } from '../InspirationUpload';
import { PresetSelector } from '../PresetSelector';

interface SettingsViewProps {
  onMasterRandomize: () => void;
  onExportMidi: () => void;
  onExportZip: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onInspirationUpload: (file: File) => void;
  inspirationStatus: string | null;
  selectedPreset: StylePreset | null;
  onSelectPreset: (preset: StylePreset) => void;
  songParams: Partial<SessionParameters>;
  onUpdateSongParams: (params: Partial<SessionParameters>) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  onMasterRandomize,
  onExportMidi,
  onExportZip,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onInspirationUpload,
  inspirationStatus,
  selectedPreset,
  onSelectPreset,
  songParams,
  onUpdateSongParams
}) => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-studio-accent/20 flex items-center justify-center">
            <Sliders className="w-5 h-5 text-studio-accent" />
          </div>
          <div>
            <h2 className="text-xl font-medium tracking-tight">System & Workflow</h2>
            <p className="text-xs text-studio-muted font-mono uppercase tracking-widest">Global Configuration & Session Management</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-8 space-y-6">
          <div className="bg-studio-card border border-studio-border rounded-2xl p-6">
            <h3 className="text-[10px] font-mono text-studio-muted uppercase tracking-widest mb-6">AI Style Inference</h3>
            <PresetSelector 
              selectedPreset={selectedPreset} 
              onSelect={onSelectPreset} 
            />
          </div>

          <div className="bg-studio-card border border-studio-border rounded-2xl p-6">
            <h3 className="text-[10px] font-mono text-studio-muted uppercase tracking-widest mb-6">Auditory Inspiration</h3>
            <InspirationUpload 
              onUpload={onInspirationUpload}
              status={inspirationStatus}
            />
          </div>

          <div className="bg-studio-card border border-studio-border rounded-2xl p-6">
            <h3 className="text-[10px] font-mono text-studio-muted uppercase tracking-widest mb-6">Percussion Architecture</h3>
            <DrumKitManager />
          </div>
        </div>

        <div className="col-span-12 lg:col-span-4 space-y-6">
          <div className="bg-studio-card border border-studio-border rounded-2xl p-6">
            <h3 className="text-[10px] font-mono text-studio-muted uppercase tracking-widest mb-6">Session Commands</h3>
            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={onUndo}
                disabled={!canUndo}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-white/5 border border-studio-border rounded-xl text-[10px] font-mono uppercase tracking-wider text-white/60 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none transition-all"
              >
                <Undo2 className="w-4 h-4" /> Undo
              </button>
              <button 
                onClick={onRedo}
                disabled={!canRedo}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-white/5 border border-studio-border rounded-xl text-[10px] font-mono uppercase tracking-wider text-white/60 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none transition-all"
              >
                <Redo2 className="w-4 h-4" /> Redo
              </button>
            </div>
            
            <div className="h-px bg-studio-border/30 my-6" />

            <div className="space-y-3">
              <button 
                onClick={onExportMidi}
                className="w-full flex items-center justify-center gap-2 px-4 py-4 bg-studio-accent text-white rounded-xl text-xs font-mono uppercase tracking-[0.2em] hover:bg-studio-accent-light transition-all shadow-lg shadow-studio-accent/20"
              >
                <Download className="w-4 h-4" /> Export All MIDI
              </button>
              <button 
                onClick={onExportZip}
                className="w-full flex items-center justify-center gap-2 px-4 py-4 bg-white/5 border border-studio-border rounded-xl text-xs font-mono uppercase tracking-[0.2em] text-white/80 hover:bg-white/10 transition-all"
              >
                <Upload className="w-4 h-4" /> Export Project (.ZIP)
              </button>
            </div>
          </div>

          <div className="bg-studio-card border border-studio-border rounded-2xl p-6">
            <h3 className="text-[10px] font-mono text-studio-muted uppercase tracking-widest mb-6">Engine Telemetry</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-white/40 uppercase">Sophistication</span>
                <span className="text-[10px] font-mono text-studio-accent">LEVEL 7</span>
              </div>
              <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                <div className="w-[70%] h-full bg-studio-accent" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-white/40 uppercase">AI Entropy</span>
                <span className="text-[10px] font-mono text-studio-accent">MODERATE</span>
              </div>
              <div className="pt-4 mt-4 border-t border-studio-border/30">
                <p className="text-[9px] font-mono text-studio-muted leading-relaxed uppercase tracking-tighter">
                  System operating at optimal neural resonance. All buffers cleared and initialized.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
