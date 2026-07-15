/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useRef } from 'react';
import { Volume2, VolumeX, Sliders } from 'lucide-react';
import { InstrumentType } from '../types';
import { audioEngine } from '../services/audioEngine';

interface MixerProps {
  instrumentVolumes: Record<InstrumentType, number>;
  onVolumeChange: (type: InstrumentType, volume: number) => void;
  mutes: Record<InstrumentType, boolean>;
  solos: Record<InstrumentType, boolean>;
  onMuteToggle: (type: InstrumentType) => void;
  onSoloToggle: (type: InstrumentType) => void;
  onStart?: () => void;
  onEnd?: () => void;
}

export const Mixer: React.FC<MixerProps> = ({
  instrumentVolumes,
  onVolumeChange,
  mutes,
  solos,
  onMuteToggle,
  onSoloToggle,
  onStart,
  onEnd,
}) => {
  // Peak VU states for the meters
  const [vuPeaks, setVuPeaks] = useState<Record<InstrumentType, number>>({
    Drums: 0,
    Bass: 0,
    Keys: 0,
    Guitar: 0,
    Pads: 0,
    Lead: 0,
  });

  const animFrameId = useRef<number>(0);
  const prevPeaksRef = useRef<Record<InstrumentType, number>>({
    Drums: 0,
    Bass: 0,
    Keys: 0,
    Guitar: 0,
    Pads: 0,
    Lead: 0,
  });

  // Track master output volume peak as well
  const [masterPeak, setMasterPeak] = useState<number>(0);
  const prevMasterPeakRef = useRef<number>(0);

  useEffect(() => {
    const channels = Object.keys(instrumentVolumes) as InstrumentType[];

    const drawVUMeters = () => {
      const nextPeaks = {} as Record<InstrumentType, number>;
      let maxChannelPeak = 0;

      channels.forEach((type) => {
        // Fetch fresh real-time amplitude peak (0.0 to 1.0)
        const currentPeak = audioEngine.getChannelVolumePeak(type);
        const previousPeak = prevPeaksRef.current[type] || 0;

        // Ballistics filter: instant attack, exponential decay for a realistic analog fader meter feel
        const decayed = previousPeak * 0.88;
        const finalPeak = Math.max(currentPeak, decayed);

        nextPeaks[type] = finalPeak;
        prevPeaksRef.current[type] = finalPeak;

        if (finalPeak > maxChannelPeak) {
          maxChannelPeak = finalPeak;
        }
      });

      setVuPeaks(nextPeaks);

      // Simple master peak estimate based on submix peaks attenuated slightly
      const masterDecayed = prevMasterPeakRef.current * 0.92;
      const finalMasterPeak = Math.max(maxChannelPeak * 0.85, masterDecayed);
      setMasterPeak(finalMasterPeak);
      prevMasterPeakRef.current = finalMasterPeak;

      animFrameId.current = requestAnimationFrame(drawVUMeters);
    };

    animFrameId.current = requestAnimationFrame(drawVUMeters);

    return () => {
      if (animFrameId.current) {
        cancelAnimationFrame(animFrameId.current);
      }
    };
  }, [instrumentVolumes]);

  return (
    <div id="mixer-container" className="border-t border-studio-border px-5 py-4" style={{ background: '#0a0a0c' }}>
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        
        {/* Left Side: Mixer Branding Header */}
        <div className="flex items-center gap-2 text-studio-muted select-none">
          <Sliders className="w-4 h-4 text-studio-accent" />
          <div className="flex flex-col">
            <span className="text-[9px] font-mono uppercase tracking-[0.2em] font-medium text-studio-text">STUDIO MIXER</span>
            <span className="text-[7px] font-mono uppercase text-studio-muted tracking-widest">SUBMIX CONSOLE</span>
          </div>
        </div>

        {/* Center: Six Channel Strips */}
        <div className="flex-1 w-full grid grid-cols-6 justify-between gap-2 max-w-3xl">
          {(Object.keys(instrumentVolumes) as InstrumentType[]).map((type) => {
            const vol = instrumentVolumes[type];
            const peak = vuPeaks[type] || 0;
            const isMuted = mutes[type];
            const isSoloed = solos[type];

            // Map peaks to height percent
            const peakHeightPercent = Math.min(100, Math.round(peak * 100));

            return (
              <div key={type} className="flex flex-col items-center gap-2 group p-1 bg-black/20 rounded-lg border border-white/[0.02]">
                
                {/* Mute and Solo Buttons (DAW Standard layout) */}
                <div className="flex items-center gap-1 w-full justify-center px-1">
                  <button
                    onClick={() => onSoloToggle(type)}
                    className={`w-6 h-5 rounded text-[8px] font-mono font-bold transition-all cursor-pointer border ${
                      isSoloed
                        ? 'bg-amber-500/20 text-amber-400 border-amber-500/50 shadow-[0_0_8px_rgba(245,158,11,0.25)]'
                        : 'bg-black/40 text-studio-muted hover:text-studio-text border-studio-border/30'
                    }`}
                    title={`Solo ${type}`}
                  >
                    S
                  </button>
                  <button
                    onClick={() => onMuteToggle(type)}
                    className={`w-6 h-5 rounded text-[8px] font-mono font-bold transition-all cursor-pointer border ${
                      isMuted
                        ? 'bg-red-500/20 text-red-400 border-red-500/50 shadow-[0_0_8px_rgba(239,68,68,0.25)]'
                        : 'bg-black/40 text-studio-muted hover:text-studio-text border-studio-border/30'
                    }`}
                    title={`Mute ${type}`}
                  >
                    M
                  </button>
                </div>

                {/* Fader Track & Bouncing LED Strip Container */}
                <div className="flex items-center gap-2 h-28 px-1.5 py-1">
                  
                  {/* Vertical VU LED Meter */}
                  <div className="relative w-1.5 h-full bg-black/50 rounded-sm overflow-hidden flex flex-col justify-end border border-white/[0.04]">
                    {/* Bouncing peak overlay */}
                    <div
                      className="w-full rounded-sm transition-all duration-[45ms]"
                      style={{
                        height: isMuted ? '0%' : `${peakHeightPercent}%`,
                        background: 'linear-gradient(to top, #22c55e 0%, #22c55e 65%, #eab308 80%, #ef4444 100%)',
                      }}
                    />
                  </div>

                  {/* Physical Style Fader Slot */}
                  <div className="relative h-full w-4 flex items-center justify-center">
                    {/* Track slot background line */}
                    <div className="absolute top-0 bottom-0 w-1 bg-black/60 rounded-full border border-white/[0.04]" />
                    
                    {/* Tick Mark Indicators behind fader */}
                    <div className="absolute inset-y-0 flex flex-col justify-between text-white/[0.08] pointer-events-none select-none w-full">
                      <span className="text-[5px] font-mono text-center">-0dB</span>
                      <span className="text-[5px] font-mono text-center">-6dB</span>
                      <span className="text-[5px] font-mono text-center">-12dB</span>
                      <span className="text-[5px] font-mono text-center">-INF</span>
                    </div>

                    {/* Draggable Fader Thumb */}
                    <div
                      className="absolute w-5 h-2.5 rounded bg-zinc-800 border border-zinc-600 shadow-[0_1px_4px_rgba(0,0,0,0.5)] cursor-ns-resize flex flex-col justify-between p-[1px] group-hover:bg-zinc-700 transition-colors pointer-events-none"
                      style={{
                        bottom: `calc(${vol}% - 5px)`,
                        transform: 'translateY(0px)',
                      }}
                    >
                      <div className="h-[1px] bg-studio-accent/80 w-full" />
                    </div>

                    {/* Invisible Interactive Range Input */}
                    <input
                      type="range"
                      min="0"
                      max="100"
                      aria-label={`${type} fader`}
                      value={vol}
                      onChange={(e) => onVolumeChange(type, parseInt(e.target.value))}
                      onMouseDown={onStart}
                      onMouseUp={onEnd}
                      onTouchStart={onStart}
                      onTouchEnd={onEnd}
                      className="absolute inset-0 opacity-0 cursor-ns-resize h-full w-full"
                      style={{ writingMode: 'vertical-lr' as any }}
                    />
                  </div>

                </div>

                {/* Channel Label */}
                <div className="flex flex-col items-center select-none pt-0.5">
                  <span className="text-[8px] font-mono text-studio-text uppercase tracking-wider font-semibold">
                    {type.substring(0, 3)}
                  </span>
                  <span className="text-[6px] font-mono text-studio-muted font-bold">
                    {isMuted ? 'MUTE' : `${vol}%`}
                  </span>
                </div>

              </div>
            );
          })}
        </div>

        {/* Right: Consolidated Master Bus Unit */}
        <div className="flex items-center gap-4 border-l border-studio-border/50 pl-6 select-none min-w-[130px] justify-end">
          {/* Master VU strip */}
          <div className="relative w-2.5 h-16 bg-black/60 rounded overflow-hidden flex flex-col justify-end border border-white/[0.05]">
            <div
              className="w-full transition-all duration-[45ms]"
              style={{
                height: `${Math.min(100, Math.round(masterPeak * 100))}%`,
                background: 'linear-gradient(to top, #6366f1 0%, #a855f7 65%, #ec4899 100%)',
              }}
            />
          </div>

          <div className="flex flex-col items-end gap-1">
            <span className="text-[9px] font-mono text-studio-accent uppercase tracking-widest font-bold">MASTER OUT</span>
            <span className="text-[7px] font-mono text-studio-muted font-bold uppercase tracking-wider">
              PEAK: {masterPeak > 0.01 ? `-${Math.abs(Math.round((1 - masterPeak) * 24))} dB` : '-INF dB'}
            </span>
            <div className="flex items-center gap-1 bg-[#121215] border border-studio-border/30 rounded px-1.5 py-0.5 text-studio-green">
              <Volume2 className="w-2.5 h-2.5 text-studio-green animate-pulse" />
              <span className="text-[7px] font-mono font-bold uppercase tracking-wider">LIMITER ON</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
