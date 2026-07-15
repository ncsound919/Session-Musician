/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef } from 'react';
import { audioEngine } from '../services/audioEngine';

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

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Retrieve active playback details from the synthesizer sequencer
    const state = audioEngine.getPlaybackState();

    // Clear background with subtle persistence trail effect
    ctx.fillStyle = 'rgba(10, 10, 11, 0.25)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const paddingX = 20;
    const totalWidth = canvas.width - paddingX * 2;

    // Draw horizontal grid lines for lanes
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
    ctx.lineWidth = 1;
    const rowsCount = instrumentType === 'Drums' ? 6 : 8;
    for (let r = 0; r < rowsCount; r++) {
      const ry = 15 + (r / (rowsCount - 1)) * (canvas.height - 30);
      ctx.beginPath();
      ctx.moveTo(paddingX, ry);
      ctx.lineTo(canvas.width - paddingX, ry);
      ctx.stroke();
    }

    // Filter notes relevant to the current instrument channel
    const notes = state.notes.filter(n => n.channel === instrumentType);

    // Coordinate mapping for Drums vs Melody instruments
    const getDrumY = (noteNum: number) => {
      // 36 (Kick), 38 (Snare), 42 (HiHat), 47 (Tom), 49/51 (Cymbal), 56 (Percussion)
      if (noteNum === 36) return canvas.height - 20;
      if (noteNum === 38) return canvas.height - 38;
      if (noteNum === 42) return canvas.height - 56;
      if (noteNum === 47) return canvas.height - 74;
      if (noteNum === 49 || noteNum === 51) return canvas.height - 92;
      return canvas.height - 110;
    };

    // Scaled notes calculation for melodies
    let minNote = 127;
    let maxNote = 0;
    notes.forEach(n => {
      if (n.note < minNote) minNote = n.note;
      if (n.note > maxNote) maxNote = n.note;
    });

    if (maxNote === minNote || notes.length === 0) {
      minNote = 36;
      maxNote = 84;
    } else {
      minNote = Math.max(0, minNote - 3);
      maxNote = Math.min(127, maxNote + 3);
    }
    const noteRange = maxNote - minNote;

    const getY = (noteNum: number) => {
      return canvas.height - 15 - ((noteNum - minNote) / noteRange) * (canvas.height - 30);
    };

    // Draw scheduled notes
    notes.forEach(note => {
      const x = paddingX + (note.tick / state.totalTicks) * totalWidth;
      const width = Math.max(5, (note.duration / state.totalTicks) * totalWidth);
      const y = instrumentType === 'Drums' ? getDrumY(note.note) : getY(note.note);
      const height = instrumentType === 'Drums' ? 6 : 8;

      // Determine if playhead is currently crossing/playing this note
      const isCrossed = state.isRunning && 
        state.currentTick >= note.tick && 
        state.currentTick <= note.tick + note.duration;

      if (isCrossed) {
        ctx.shadowBlur = 12;
        ctx.shadowColor = '#818cf8';
        ctx.fillStyle = '#818cf8';
      } else {
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(99, 102, 241, 0.4)';
      }

      ctx.beginPath();
      ctx.roundRect(x, y - height / 2, width - 2, height, 2);
      ctx.fill();
    });

    // Reset shadow blur before playhead
    ctx.shadowBlur = 0;

    // Draw playhead vertical line
    if (state.isRunning) {
      const px = paddingX + (state.currentTick / state.totalTicks) * totalWidth;
      
      // Playhead line
      ctx.strokeStyle = 'rgba(129, 140, 248, 0.8)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, canvas.height);
      ctx.stroke();

      // Glowing Playhead cap
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(px, 5, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    requestRef.current = requestAnimationFrame(draw);
  };

  useEffect(() => {
    requestRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(requestRef.current);
  }, [isPlaying, instrumentType, groove, density]);

  return (
    <div className="relative w-full h-28 rounded-xl overflow-hidden group"
      style={{ background: '#0d0d0e', border: '1px solid #222224' }}>
      <div className="absolute top-2 left-3 flex items-center gap-2 z-10">
        <div className={`w-1.5 h-1.5 rounded-full ${isPlaying ? 'bg-studio-accent led-on animate-pulse' : 'bg-studio-muted'}`} />
        <span className="text-[8px] font-mono text-studio-muted uppercase tracking-[0.15em] select-none">
          {instrumentType} Live MIDI Roll
        </span>
      </div>
      <canvas 
        ref={canvasRef} 
        width={800} 
        height={112} 
        className="w-full h-full"
      />
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(180deg, transparent 60%, rgba(10,10,11,0.8) 100%)' }} />
    </div>
  );
};
