/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { 
  Keyboard,
  Sliders,
  Sparkles
} from 'lucide-react';
import { InstrumentType, InstrumentState } from '../../types';
import { JunoSynthModule } from '../JunoSynthModule';
import { SamplerWorkbench } from '../SamplerWorkbench';
import { cn } from '../../lib/utils';

interface SynthViewProps {
  activeTab: InstrumentType;
  instrumentStates: Record<InstrumentType, InstrumentState>;
  onUpdateSynthParam: (inst: Exclude<InstrumentType, 'Drums'>, key: string, val: any) => void;
  onUpdateDrumKit: (piece: string, vol: number) => void;
  onTabChange: (tab: InstrumentType) => void;
  onLearnFromSampler?: () => void;
}

export const SynthView: React.FC<SynthViewProps> = ({
  activeTab,
  instrumentStates,
  onUpdateSynthParam,
  onUpdateDrumKit,
  onTabChange,
  onLearnFromSampler
}) => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-studio-accent/20 flex items-center justify-center">
            <Keyboard className="w-5 h-5 text-studio-accent" />
          </div>
          <div>
            <h2 className="text-xl font-medium tracking-tight">Sound Design Lab</h2>
            <p className="text-xs text-studio-muted font-mono uppercase tracking-widest">Oscillator Architecture & Signal Processing</p>
          </div>
        </div>
        <div className="flex bg-studio-card border border-studio-border rounded-lg p-1">
          {['Drums', 'Bass', 'Keys', 'Guitar', 'Pads', 'Lead', 'Sampler'].map((inst) => (
            <button
              key={inst}
              onClick={() => onTabChange(inst as InstrumentType)}
              className={cn(
                "px-4 py-1.5 rounded text-[10px] font-mono uppercase tracking-wider transition-all",
                activeTab === inst ? "bg-studio-accent text-white" : "text-studio-muted hover:text-white"
              )}
            >
              {inst}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-studio-card border border-studio-border rounded-3xl p-8 min-h-[600px] flex items-center justify-center">
        {activeTab === 'Drums' ? (
          <div className="text-center space-y-4">
            <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto border border-studio-border">
              <Sliders className="w-10 h-10 text-studio-muted" />
            </div>
            <h3 className="text-lg font-medium text-white/80">Drum Kit Engine</h3>
            <p className="text-sm text-studio-muted max-w-xs mx-auto font-mono">Select individual drum pieces in the mixer to adjust characteristics.</p>
          </div>
        ) : activeTab === 'Sampler' ? (
          <div className="w-full h-full space-y-6">
            <SamplerWorkbench />
            {onLearnFromSampler && (
              <div className="flex justify-center">
                <button 
                  onClick={onLearnFromSampler}
                  className="flex items-center gap-2 px-6 py-3 bg-studio-accent hover:bg-studio-accent-light text-white rounded-xl transition-all text-xs font-mono uppercase tracking-widest shadow-lg shadow-studio-accent/20"
                >
                  <Sparkles className="w-4 h-4" /> AI Learn from Sampler Grooves
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="w-full">
            <JunoSynthModule 
              instrument={activeTab as any}
              params={instrumentStates[activeTab].synthParams || {}}
              onUpdate={(key, val) => onUpdateSynthParam(activeTab as any, key, val)}
            />
          </div>
        )}
      </div>
    </div>
  );
};
