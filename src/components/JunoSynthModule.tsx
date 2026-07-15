/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { cn } from '../lib/utils';
import { Sliders, Activity, Zap, Waves, Volume2, Wind } from 'lucide-react';
import { SynthParams } from '../types';

interface JunoSynthModuleProps {
  params: SynthParams;
  instrumentName: string;
  onUpdate: (key: string, val: any) => void;
}

export const JunoSynthModule: React.FC<JunoSynthModuleProps> = ({ params, instrumentName, onUpdate }) => {
  return (
    <div className="bg-[#0f0f11] rounded-2xl border border-studio-border/60 p-6 flex flex-col gap-8 shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-studio-border/30 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-studio-accent/10 flex items-center justify-center border border-studio-accent/20">
            <Activity className="w-6 h-6 text-studio-accent" />
          </div>
          <div>
            <h3 className="text-white font-bold text-lg leading-none">Juno Core Engine</h3>
            <p className="text-[10px] text-studio-muted font-mono uppercase tracking-[0.2em] mt-1.5">
              Sculpting: <span className="text-studio-accent">{instrumentName}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-[10px] font-mono text-studio-muted uppercase tracking-widest">
          <span className="flex items-center gap-1.5"><Zap className="w-3 h-3" /> Analog Mode</span>
          <span className="flex items-center gap-1.5 text-studio-green"><Volume2 className="w-3 h-3" /> Active</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        
        {/* LFO SECTION */}
        <div className="space-y-4 bg-black/20 p-4 rounded-xl border border-studio-border/20">
          <h4 className="text-[10px] font-mono text-studio-muted uppercase tracking-widest flex items-center gap-2">
            <Waves className="w-3 h-3 text-studio-accent" /> LFO Modulation
          </h4>
          <div className="space-y-6">
            <SliderField 
              label="Rate" 
              value={params.lfoRate ?? 5} 
              min={0.1} max={20} step={0.1}
              unit="Hz"
              onChange={(v) => onUpdate('lfoRate', v)}
            />
            <SliderField 
              label="Pitch Mod" 
              value={params.lfoPitchMod ?? 0} 
              min={0} max={1} step={0.01}
              onChange={(v) => onUpdate('lfoPitchMod', v)}
            />
            <SliderField 
              label="Filter Mod" 
              value={params.lfoFilterMod ?? 0} 
              min={0} max={1} step={0.01}
              onChange={(v) => onUpdate('lfoFilterMod', v)}
            />
          </div>
        </div>

        {/* DCO & UNISON SECTION */}
        <div className="space-y-4 bg-black/20 p-4 rounded-xl border border-studio-border/20">
          <h4 className="text-[10px] font-mono text-studio-muted uppercase tracking-widest flex items-center gap-2">
            <Sliders className="w-3 h-3 text-studio-accent" /> DCO & Unison
          </h4>
          <div className="space-y-6">
            <div className="grid grid-cols-4 gap-2">
              {['sine', 'square', 'sawtooth', 'triangle'].map(type => (
                <button
                  key={type}
                  onClick={() => onUpdate('oscType', type)}
                  className={cn(
                    "text-[8px] font-mono py-2 rounded border transition-all uppercase",
                    params.oscType === type 
                      ? "bg-studio-accent text-white border-studio-accent shadow-[0_0_10px_rgba(var(--studio-accent-rgb),0.3)]" 
                      : "bg-white/5 text-studio-muted border-studio-border/30 hover:border-studio-border/60"
                  )}
                >
                  {type}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <SliderField 
                label="Sub Level" 
                value={params.subOscLevel ?? 0} 
                min={0} max={1} step={0.01}
                onChange={(v) => onUpdate('subOscLevel', v)}
              />
              <div className="space-y-2">
                <span className="text-[9px] font-mono text-studio-muted uppercase tracking-tighter">Sub Octave</span>
                <div className="flex gap-1">
                  {[-1, -2].map(oct => (
                    <button
                      key={oct}
                      onClick={() => onUpdate('subOscOctave', oct)}
                      className={cn(
                        "flex-1 py-1 rounded border text-[8px] font-mono transition-all",
                        params.subOscOctave === oct ? "bg-studio-accent text-white border-studio-accent" : "bg-white/5 text-studio-muted border-studio-border/30"
                      )}
                    >
                      {oct} Oct
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {params.oscType === 'square' && (
              <SliderField 
                label="PWM Amount" 
                value={params.pwmAmount ?? 0} 
                min={0} max={1} step={0.01}
                onChange={(v) => onUpdate('pwmAmount', v)}
              />
            )}

            <div className="pt-4 border-t border-white/5 space-y-4">
              <SliderField 
                label="Unison Voices" 
                value={params.unisonVoices ?? 1} 
                min={1} max={7} step={1}
                onChange={(v) => onUpdate('unisonVoices', v)}
              />
              <div className="grid grid-cols-2 gap-4">
                <SliderField 
                  label="Detune" 
                  value={params.unisonDetune ?? 0} 
                  min={0} max={50} step={0.1}
                  unit="c"
                  onChange={(v) => onUpdate('unisonDetune', v)}
                />
                <SliderField 
                  label="Width" 
                  value={params.unisonStereoWidth ?? 0} 
                  min={0} max={1} step={0.01}
                  onChange={(v) => onUpdate('unisonStereoWidth', v)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* VCF SECTION */}
        <div className="space-y-4 bg-black/20 p-4 rounded-xl border border-studio-border/20">
          <h4 className="text-[10px] font-mono text-studio-muted uppercase tracking-widest flex items-center gap-2">
            <Sliders className="w-3 h-3 text-studio-accent" /> VCF & Drive
          </h4>
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-2">
              {['lowpass', 'highpass', 'bandpass', 'notch'].map(type => (
                <button
                  key={type}
                  onClick={() => onUpdate('filterType', type)}
                  className={cn(
                    "text-[8px] font-mono py-1.5 rounded border transition-all uppercase",
                    (params.filterType ?? 'lowpass') === type 
                      ? "bg-studio-accent text-white border-studio-accent" 
                      : "bg-white/5 text-studio-muted border-studio-border/30 hover:border-studio-border/60"
                  )}
                >
                  {type}
                </button>
              ))}
            </div>

            <SliderField 
              label="Frequency" 
              value={params.filterCutoff ?? 20000} 
              min={20} max={20000} step={1}
              unit="Hz"
              onChange={(v) => onUpdate('filterCutoff', v)}
            />
            <div className="grid grid-cols-2 gap-4">
              <SliderField 
                label="Resonance" 
                value={params.filterResonance ?? 1} 
                min={1} max={20} step={0.1}
                onChange={(v) => onUpdate('filterResonance', v)}
              />
              <SliderField 
                label="Drive" 
                value={params.filterDrive ?? 0} 
                min={0} max={1} step={0.01}
                onChange={(v) => onUpdate('filterDrive', v)}
              />
            </div>
            <SliderField 
              label="Env Amount" 
              value={params.filterEnvAmount ?? params.envFilterMod ?? 0} 
              min={-1} max={1} step={0.01}
              onChange={(v) => onUpdate('filterEnvAmount', v)}
            />
          </div>
        </div>

        {/* VCA / VOICING SECTION */}
        <div className="space-y-4 bg-black/20 p-4 rounded-xl border border-studio-border/20">
          <h4 className="text-[10px] font-mono text-studio-muted uppercase tracking-widest flex items-center gap-2">
            <Volume2 className="w-3 h-3 text-studio-accent" /> VCA & Voicing
          </h4>
          <div className="grid grid-cols-2 gap-4">
            <SliderField label="A" value={params.attack ?? 0.01} min={0.001} max={2} step={0.001} onChange={(v) => onUpdate('attack', v)} />
            <SliderField label="D" value={params.decay ?? 0.1} min={0.001} max={2} step={0.001} onChange={(v) => onUpdate('decay', v)} />
            <SliderField label="S" value={params.sustain ?? 0.5} min={0} max={1} step={0.01} onChange={(v) => onUpdate('sustain', v)} />
            <SliderField label="R" value={params.release ?? 0.2} min={0.001} max={3} step={0.001} onChange={(v) => onUpdate('release', v)} />
          </div>
          <div className="pt-4 border-t border-white/5 space-y-4">
            <SliderField 
              label="Glide Time" 
              value={params.glideTime ?? 0} 
              min={0} max={1} step={0.001}
              unit="s"
              onChange={(v) => onUpdate('glideTime', v)}
            />
            <SliderField 
              label="HPF Cutoff" 
              value={params.hpfCutoff ?? 10} 
              min={10} max={2000} step={1}
              unit="Hz"
              onChange={(v) => onUpdate('hpfCutoff', v)}
            />
          </div>
        </div>

        {/* CHORUS SECTION */}
        <div className="space-y-4 bg-black/20 p-4 rounded-xl border border-studio-border/20">
          <h4 className="text-[10px] font-mono text-studio-muted uppercase tracking-widest flex items-center gap-2">
            <Wind className="w-3 h-3 text-studio-accent" /> Juno Chorus
          </h4>
          <div className="grid grid-cols-3 gap-2 h-full items-center">
            {[0, 1, 2].map(level => (
              <button
                key={level}
                onClick={() => onUpdate('junoChorus', level)}
                className={cn(
                  "py-4 rounded border transition-all text-xs font-bold font-mono",
                  params.junoChorus === level 
                    ? "bg-studio-accent text-white border-studio-accent shadow-[0_0_15px_rgba(var(--studio-accent-rgb),0.4)]" 
                    : "bg-white/5 text-studio-muted border-studio-border/30 hover:border-studio-border/60"
                )}
              >
                {level === 0 ? 'OFF' : level === 1 ? 'CHORUS I' : 'CHORUS II'}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

interface SliderFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (v: number) => void;
}

const SliderField: React.FC<SliderFieldProps> = ({ label, value, min, max, step, unit, onChange }) => (
  <div className="space-y-2">
    <div className="flex justify-between items-center text-[9px] font-mono">
      <span className="text-studio-muted uppercase tracking-tighter">{label}</span>
      <span className="text-studio-accent font-bold">
        {value.toFixed(step < 0.1 ? 3 : 1)}{unit}
      </span>
    </div>
    <input 
      type="range" 
      min={min} max={max} step={step} 
      value={value} 
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="w-full h-1 accent-studio-accent cursor-pointer opacity-80 hover:opacity-100 transition-opacity"
    />
  </div>
);
