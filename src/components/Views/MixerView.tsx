/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { 
  Waves,
  Sliders,
  Volume2
} from 'lucide-react';
import { InstrumentType, InstrumentState } from '../../types';
import { Knob } from '../Knob';

interface MixerViewProps {
  instruments: InstrumentType[];
  instrumentStates: Record<InstrumentType, InstrumentState>;
  volumes: Record<InstrumentType, number>;
  onUpdateVolume: (inst: InstrumentType, vol: number) => void;
  onUpdateState: (inst: InstrumentType, enabled: boolean) => void;
  onUpdateSynthParam: (inst: Exclude<InstrumentType, 'Drums'>, key: string, val: any) => void;
}

export const MixerView: React.FC<MixerViewProps> = ({
  instruments,
  instrumentStates,
  volumes,
  onUpdateVolume,
  onUpdateState,
  onUpdateSynthParam
}) => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-studio-accent/20 flex items-center justify-center">
            <Waves className="w-5 h-5 text-studio-accent" />
          </div>
          <div>
            <h2 className="text-xl font-medium tracking-tight">Mixing Console</h2>
            <p className="text-xs text-studio-muted font-mono uppercase tracking-widest">Multi-Track Spatial Balance & FX Routing</p>
          </div>
        </div>
      </div>

      <div className="bg-studio-card border border-studio-border rounded-2xl p-8">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-6">
          {instruments.map((inst) => (
            <div key={inst} className="flex flex-col items-center gap-6 p-4 bg-black/20 rounded-2xl border border-studio-border/20 group hover:border-studio-border/50 transition-all">
              <div className="flex flex-col items-center gap-1">
                <span className="text-[10px] font-mono text-studio-muted uppercase tracking-widest">{inst}</span>
                <button 
                  onClick={() => onUpdateState(inst, !instrumentStates[inst].enabled)}
                  className={`w-12 h-6 rounded-full p-1 transition-all ${instrumentStates[inst].enabled ? 'bg-studio-accent' : 'bg-studio-border/30'}`}
                >
                  <div className={`w-4 h-4 rounded-full bg-white transition-transform ${instrumentStates[inst].enabled ? 'translate-x-6' : 'translate-x-0'}`} />
                </button>
              </div>

              <div className="flex-1 flex flex-col items-center justify-center">
                <div className="h-64 w-8 bg-black/40 rounded-lg relative overflow-hidden flex flex-col justify-end p-1 border border-studio-border/20">
                  <div 
                    className="w-full bg-studio-accent rounded-sm shadow-[0_0_15px_rgba(var(--studio-accent-rgb),0.5)] transition-all duration-200"
                    style={{ height: `${volumes[inst]}%` }}
                  />
                  {/* Fader Track Details */}
                  <div className="absolute inset-0 flex flex-col justify-between py-4 pointer-events-none opacity-20">
                    {[0, 20, 40, 60, 80, 100].map(m => (
                      <div key={m} className="w-full h-px bg-white" />
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-4 w-full">
                <Knob 
                  label="Gain" 
                  value={volumes[inst]} 
                  min={0} max={100} 
                  size={60}
                  onChange={(v) => onUpdateVolume(inst, v)}
                />
                
                {inst !== 'Drums' && (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <span className="text-[7px] font-mono text-studio-muted uppercase block text-center">Rev</span>
                      <Knob 
                        value={instrumentStates[inst].synthParams?.fx?.reverb ?? 0}
                        min={0} max={1} step={0.01}
                        size={32}
                        onChange={(v) => onUpdateSynthParam(inst as any, 'fx', { ...instrumentStates[inst].synthParams?.fx, reverb: v })}
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="text-[7px] font-mono text-studio-muted uppercase block text-center">Del</span>
                      <Knob 
                        value={instrumentStates[inst].synthParams?.fx?.delay ?? 0}
                        min={0} max={1} step={0.01}
                        size={32}
                        onChange={(v) => onUpdateSynthParam(inst as any, 'fx', { ...instrumentStates[inst].synthParams?.fx, delay: v })}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
