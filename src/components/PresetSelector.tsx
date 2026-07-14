/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Sparkles, Info } from 'lucide-react';
import { StylePreset, STYLE_PRESETS, InstrumentType } from '../types';

interface PresetSelectorProps {
  currentInstrument: InstrumentType;
  onSelect: (preset: StylePreset) => void;
}

export const PresetSelector: React.FC<PresetSelectorProps> = ({ currentInstrument, onSelect }) => {
  const filteredPresets = STYLE_PRESETS.filter(
    p => p.instrument === currentInstrument || p.instrument === 'All'
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-[9px] font-mono text-studio-muted uppercase tracking-[0.15em] flex items-center gap-2">
          <Sparkles className="w-3 h-3" /> Style Presets
        </label>
      </div>

      <div className="grid grid-cols-1 gap-1.5 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
        {filteredPresets.map((preset) => (
          <button
            key={preset.id}
            onClick={() => onSelect(preset)}
            className="group flex flex-col items-start gap-1 p-3 rounded-lg transition-all text-left bg-[#1a1a1c] border border-[#222224] hover:border-indigo-500/50"
          >
            <div className="w-full flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-studio-text group-hover:text-studio-accent transition-colors">
                {preset.name}
              </span>
              <div className="relative group/info">
                <Info className="w-3 h-3 text-studio-muted cursor-help" />
                <div className="absolute bottom-full right-0 mb-2 w-48 p-2 rounded-md opacity-0 group-hover/info:opacity-100 pointer-events-none transition-opacity z-50"
                  style={{ background: '#121214', border: '1px solid #222224', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
                  <p className="text-[9px] font-sans text-studio-text leading-tight">
                    {preset.description}
                  </p>
                </div>
              </div>
            </div>
            <span className="text-[8px] font-mono text-studio-muted uppercase tracking-wider">
              {preset.instrument === 'All' ? 'Global Style' : `${preset.instrument} Focus`}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};
