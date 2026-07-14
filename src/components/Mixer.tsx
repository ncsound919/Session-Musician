/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Volume2, VolumeX, Sliders } from 'lucide-react';
import { InstrumentType } from '../types';

interface MixerProps {
  instrumentVolumes: Record<InstrumentType, number>;
  onVolumeChange: (type: InstrumentType, volume: number) => void;
  onStart?: () => void;
  onEnd?: () => void;
}

export const Mixer: React.FC<MixerProps> = ({ instrumentVolumes, onVolumeChange, onStart, onEnd }) => {
  return (
    <div className="border-t border-studio-border px-5 py-3" style={{ background: '#0d0d0e' }}>
      <div className="max-w-5xl mx-auto flex items-center justify-between gap-6">
        <div className="flex items-center gap-2 text-studio-muted">
          <Sliders className="w-3.5 h-3.5" />
          <span className="text-[8px] font-mono uppercase tracking-[0.2em]">Mix</span>
        </div>
        
        <div className="flex-1 flex justify-around items-end gap-3">
          {(Object.keys(instrumentVolumes) as InstrumentType[]).map((type) => (
            <div key={type} className="flex flex-col items-center gap-1.5 group">
              <div className="relative h-20 w-6 rounded-md overflow-hidden flex flex-col justify-end p-0.5"
                style={{ background: 'rgba(10,10,11,0.6)', border: '1px solid #222224' }}>
                {/* VU-style level meter */}
                <div 
                  className="w-full rounded-sm transition-all duration-200"
                  style={{ 
                    height: `${instrumentVolumes[type]}%`,
                    background: instrumentVolumes[type] > 85 
                      ? 'linear-gradient(180deg, #ef4444 0%, #6366f1 30%, #22c55e 100%)' 
                      : instrumentVolumes[type] > 60 
                        ? 'linear-gradient(180deg, #6366f1 0%, #22c55e 100%)' 
                        : '#22c55e'
                  }}
                />
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  aria-label={`${type} volume`}
                  value={instrumentVolumes[type]}
                  onChange={(e) => onVolumeChange(type, parseInt(e.target.value))}
                  onMouseDown={onStart}
                  onMouseUp={onEnd}
                  onTouchStart={onStart}
                  onTouchEnd={onEnd}
                  className="absolute inset-0 opacity-0 cursor-ns-resize"
                  style={{ writingMode: 'vertical-lr' as any }}
                />
              </div>
              <span className="text-[7px] font-mono text-studio-muted uppercase group-hover:text-studio-accent transition-colors">
                {type.substring(0, 3)}
              </span>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3 border-l border-studio-border pl-6">
          <div className="flex flex-col items-end">
            <span className="text-[9px] font-mono text-studio-accent">MASTER</span>
            <span className="text-[7px] font-mono text-studio-muted">-3.2 dB</span>
          </div>
          <button className="p-1.5 rounded-md text-studio-accent hover:bg-studio-accent/10 transition-all"
            style={{ border: '1px solid rgba(99,102,241,0.2)' }}>
            <Volume2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
