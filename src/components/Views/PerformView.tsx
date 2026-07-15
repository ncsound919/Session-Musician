/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion } from 'motion/react';
import { 
  Activity, 
  Cpu, 
  Sparkles,
  Shuffle,
  Volume2
} from 'lucide-react';
import { InstrumentType, InstrumentState, StylePreset, PerformedNote } from '../../types';
import { Knob } from '../Knob';
import { XYPad } from '../XYPad';
import { MidiVisualizer } from '../MidiVisualizer';
import { ArrangementView } from '../ArrangementView';
import { cn } from '../../lib/utils';

interface PerformViewProps {
  activeTab: InstrumentType;
  instrumentStates: Record<InstrumentType, InstrumentState>;
  xyModes: Record<InstrumentType, string>;
  volumes: Record<InstrumentType, number>;
  onXyChange: (x: number, y: number) => void;
  onLiveAction: (action: string) => void;
  onUpdateVolume: (inst: InstrumentType, vol: number) => void;
  onMasterRandomize: () => void;
  onTabChange: (tab: InstrumentType) => void;
  liveActions: string[];
  editedMidi: Record<InstrumentType, PerformedNote[]>;
  song: any;
}

export const PerformView: React.FC<PerformViewProps> = ({
  activeTab,
  instrumentStates,
  xyModes,
  volumes,
  onXyChange,
  onLiveAction,
  onUpdateVolume,
  onMasterRandomize,
  onTabChange,
  liveActions,
  editedMidi,
  song
}) => {
  const currentInstrument = instrumentStates[activeTab];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-studio-accent/20 flex items-center justify-center">
            <Activity className="w-5 h-5 text-studio-accent" />
          </div>
          <div>
            <h2 className="text-xl font-medium tracking-tight">Performance Lab</h2>
            <p className="text-xs text-studio-muted font-mono uppercase tracking-widest">Global Interaction & Macro Control</p>
          </div>
        </div>
        <button 
          onClick={onMasterRandomize}
          className="flex items-center gap-2 px-4 py-2 bg-studio-accent hover:bg-studio-accent-light text-white rounded-lg transition-all text-xs font-mono uppercase tracking-widest"
        >
          <Shuffle className="w-4 h-4" /> Smart Randomize
        </button>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-8 space-y-6">
          {/* XY Pad & Macro Controls */}
          <div className="bg-studio-card border border-studio-border rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-studio-border flex items-center justify-between bg-black/20">
              <div className="flex items-center gap-4">
                <span className="text-[10px] font-mono text-studio-muted uppercase tracking-widest flex items-center gap-2">
                  <Cpu className="w-3 h-3 text-studio-accent" /> AI Macro Engine
                </span>
                <div className="h-4 w-px bg-studio-border/50" />
                <span className="text-[10px] font-mono text-white/80 uppercase tracking-widest">{activeTab}: {xyModes[activeTab]}</span>
              </div>
            </div>
            <div className="p-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
              <XYPad 
                label={xyModes[activeTab]} 
                onChange={onXyChange}
                className="aspect-square w-full"
              />
              <div className="space-y-8">
                <div className="grid grid-cols-2 gap-8">
                  <Knob 
                    label="Complexity" 
                    value={currentInstrument.params.complexity} 
                    min={0} max={1} 
                    onChange={() => {}}
                  />
                  <Knob 
                    label="Humanize" 
                    value={currentInstrument.params.humanize} 
                    min={0} max={1} 
                    onChange={() => {}}
                  />
                </div>
                <div className="space-y-4">
                  <span className="text-[9px] font-mono text-studio-muted uppercase tracking-[0.2em]">Quick Actions</span>
                  <div className="grid grid-cols-2 gap-2">
                    {liveActions.map(action => (
                      <button
                        key={action}
                        onClick={() => onLiveAction(action)}
                        className="px-3 py-2 bg-white/5 hover:bg-studio-accent/20 border border-studio-border/30 rounded-lg text-[10px] text-white/60 hover:text-white font-mono text-left transition-all group relative overflow-hidden"
                      >
                        <div className="absolute inset-0 bg-studio-accent/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <Sparkles className="w-3 h-3 mb-1 text-studio-accent/40 group-hover:text-studio-accent transition-colors" />
                        {action}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* MIDI & Visualizer */}
          <div className="bg-studio-card border border-studio-border rounded-2xl overflow-hidden p-6 h-64">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-mono text-studio-muted uppercase tracking-widest">Real-time Expression</span>
              <div className="flex gap-2">
                {['Drums', 'Bass', 'Keys', 'Guitar', 'Pads', 'Lead', 'Sampler'].map((inst) => (
                  <button
                    key={inst}
                    onClick={() => onTabChange(inst as InstrumentType)}
                    className={cn(
                      "px-2 py-1 rounded text-[9px] font-mono uppercase transition-all",
                      activeTab === inst ? "bg-studio-accent text-white" : "text-studio-muted hover:text-white"
                    )}
                  >
                    {inst}
                  </button>
                ))}
              </div>
            </div>
            <MidiVisualizer 
              notes={editedMidi[activeTab] || []}
              activeTab={activeTab}
            />
          </div>
        </div>

        <div className="col-span-12 lg:col-span-4 space-y-6">
          <ArrangementView 
            song={song} 
            activeSectionId={song.activeSectionId}
          />
          
          <div className="bg-studio-card border border-studio-border rounded-2xl p-6">
            <h3 className="text-[10px] font-mono text-studio-muted uppercase tracking-widest mb-6 flex items-center gap-2">
              <Volume2 className="w-3 h-3 text-studio-accent" /> Active Channel Control
            </h3>
            <div className="flex flex-col items-center gap-4">
              <Knob 
                label={`${activeTab} Level`} 
                value={volumes[activeTab]} 
                min={0} max={100} 
                size={140}
                onChange={(v) => onUpdateVolume(activeTab, v)}
              />
              <div className="w-full h-px bg-studio-border/30 my-2" />
              <div className="grid grid-cols-2 gap-4 w-full">
                <div className="space-y-1">
                  <span className="text-[8px] font-mono text-studio-muted uppercase">Mute</span>
                  <button 
                    onClick={() => {}} 
                    className="w-full py-2 bg-white/5 border border-studio-border/30 rounded-lg text-[10px] font-mono uppercase hover:bg-red-500/20 transition-all"
                  >
                    Mute
                  </button>
                </div>
                <div className="space-y-1">
                  <span className="text-[8px] font-mono text-studio-muted uppercase">Solo</span>
                  <button 
                    onClick={() => {}} 
                    className="w-full py-2 bg-white/5 border border-studio-border/30 rounded-lg text-[10px] font-mono uppercase hover:bg-studio-accent/20 transition-all"
                  >
                    Solo
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
