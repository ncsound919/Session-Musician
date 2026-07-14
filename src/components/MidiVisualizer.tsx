/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef } from 'react';

interface MidiVisualizerProps {
  isPlaying: boolean;
  instrumentType: string;
  groove: number;
  density: number;
}

export const MidiVisualizer: React.FC<MidiVisualizerProps> = ({ 
  isPlaying, 
  instrumentType,
  groove,
  density 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);

  const draw = (time: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (!startTimeRef.current) startTimeRef.current = time;
    const elapsed = time - startTimeRef.current;

    // Clear with warm fade for trail effect
    ctx.fillStyle = 'rgba(10, 10, 11, 0.2)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const barWidth = 4;
    const gap = 2;
    const stepCount = 32;
    const totalWidth = (barWidth + gap) * stepCount;
    const startX = (canvas.width - totalWidth) / 2;

    // Draw grid with warm tone
    ctx.strokeStyle = 'rgba(99, 102, 241, 0.05)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= stepCount; i++) {
      const x = startX + i * (barWidth + gap);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }

    // Draw "MIDI" notes based on instrument and params
    if (isPlaying) {
      const playhead = (elapsed / 2000) % 1; // 2 second loop
      const currentStep = Math.floor(playhead * stepCount);
      
      for (let i = 0; i < stepCount; i++) {
        // Pseudo-random generation seeded by instrument and params
        const seed = Math.sin(i * 0.5 + instrumentType.length) * 10000;
        const rand = Math.abs(seed % 100);
        
        if (rand < density) {
          const x = startX + i * (barWidth + gap);
          const height = 10 + (rand % 30);
          const y = (canvas.height / 2) - (height / 2) + Math.sin(i * groove * 0.01) * 10;
          
          const opacity = i === currentStep ? 1 : 0.3;
          ctx.fillStyle = `rgba(99, 102, 241, ${opacity})`;
          
          ctx.beginPath();
          ctx.roundRect(x, y, barWidth, height, 2);
          ctx.fill();

          if (i === currentStep) {
            // Warm glow effect for active note
            ctx.shadowBlur = 15;
            ctx.shadowColor = '#6366f1';
            ctx.fillRect(x, y, barWidth, height);
            ctx.shadowBlur = 0;
          }
        }
      }

      // Draw playhead
      const px = startX + playhead * totalWidth;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, canvas.height);
      ctx.stroke();
    }

    requestRef.current = requestAnimationFrame(draw);
  };

  useEffect(() => {
    startTimeRef.current = 0;
    requestRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(requestRef.current);
  }, [isPlaying, instrumentType, groove, density]);

  return (
    <div className="relative w-full h-28 rounded-xl overflow-hidden group"
      style={{ background: '#0d0d0e', border: '1px solid #222224' }}>
      <div className="absolute top-2 left-3 flex items-center gap-2">
        <div className={`w-1.5 h-1.5 rounded-full ${isPlaying ? 'bg-studio-accent led-on animate-pulse' : 'bg-studio-muted'}`} />
        <span className="text-[8px] font-mono text-studio-muted uppercase tracking-[0.15em]">MIDI Stream</span>
      </div>
      <canvas 
        ref={canvasRef} 
        width={800} 
        height={128} 
        className="w-full h-full"
      />
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(180deg, transparent 60%, rgba(10,10,11,0.8) 100%)' }} />
    </div>
  );
};
