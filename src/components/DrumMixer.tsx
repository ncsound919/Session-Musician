/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Drum, Sliders } from 'lucide-react';

interface DrumMixerProps {
  kitVolumes: Record<string, number>;
  onVolumeChange: (piece: string, volume: number) => void;
  onStart?: () => void;
  onEnd?: () => void;
}

const DRUM_PIECES = ['Kick', 'Snare', 'HiHat', 'Tom', 'Cymbal', 'Percussion'];

export const DrumMixer: React.FC<DrumMixerProps> = ({ kitVolumes, onVolumeChange, onStart, onEnd }) => {
  return (
    <div className="bg-black/40 border border-white/10 rounded-lg p-4 backdrop-blur-sm shadow-xl">
      <div className="flex items-center gap-3 mb-6 border-b border-white/5 pb-3">
        <div className="p-2 bg-studio-accent/20 rounded-md">
          <Drum className="w-4 h-4 text-studio-accent" />
        </div>
        <div>
          <h3 className="text-[10px] font-mono font-bold text-white uppercase tracking-wider">Drum Kit Mixer</h3>
          <p className="text-[8px] font-mono text-studio-muted">CHANNEL STRIP SUB-MIX</p>
        </div>
      </div>
      
      <div className="flex justify-between items-end gap-2">
        {DRUM_PIECES.map((piece) => (
          <div key={piece} className="flex flex-col items-center gap-2 group flex-1">
            <div className="relative h-24 w-full max-w-[40px] rounded-sm overflow-hidden flex flex-col justify-end p-0.5 bg-black/60 border border-white/10">
              {/* VU-style level meter */}
              <div 
                className="w-full rounded-sm transition-all duration-200"
                style={{ 
                  height: `${kitVolumes[piece] ?? 100}%`,
                  background: (kitVolumes[piece] ?? 100) > 85 
                    ? 'linear-gradient(180deg, #ef4444 0%, #6366f1 30%, #22c55e 100%)' 
                    : (kitVolumes[piece] ?? 100) > 60 
                      ? 'linear-gradient(180deg, #6366f1 0%, #22c55e 100%)' 
                      : '#22c55e'
                }}
              />
              <input 
                type="range" 
                min="0" 
                max="100" 
                aria-label={`${piece} volume`}
                value={kitVolumes[piece] ?? 100}
                onChange={(e) => onVolumeChange(piece, parseInt(e.target.value))}
                onMouseDown={onStart}
                onMouseUp={onEnd}
                onTouchStart={onStart}
                onTouchEnd={onEnd}
                className="absolute inset-0 opacity-0 cursor-ns-resize"
                style={{ writingMode: 'vertical-lr' as any }}
              />
              
              {/* Zero dB Mark */}
              <div className="absolute bottom-[80%] left-0 w-full border-t border-white/20 pointer-events-none" />
            </div>
            <span className="text-[7px] font-mono text-studio-muted uppercase group-hover:text-studio-accent transition-colors truncate w-full text-center">
              {piece}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
