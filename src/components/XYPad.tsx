/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';

interface XYPadProps {
  labelX: string;
  labelY: string;
  valueX: number; // 0-100
  valueY: number; // 0-100
  onChange: (x: number, y: number) => void;
  onStart?: () => void;
  onEnd?: () => void;
}

export const XYPad: React.FC<XYPadProps> = ({ labelX, labelY, valueX, valueY, onChange, onStart, onEnd }) => {
  const padRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging && e.type !== 'mousedown') return;
    const pad = padRef.current;
    if (!pad) return;

    const rect = pad.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

    const x = Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100));
    const y = Math.min(100, Math.max(0, (1 - (clientY - rect.top) / rect.height) * 100));

    onChange(Math.round(x), Math.round(y));
  };

  useEffect(() => {
    const handleGlobalUp = () => {
      if (isDragging) {
        setIsDragging(false);
        onEnd?.();
      }
    };
    window.addEventListener('mouseup', handleGlobalUp);
    window.addEventListener('touchend', handleGlobalUp);
    return () => {
      window.removeEventListener('mouseup', handleGlobalUp);
      window.removeEventListener('touchend', handleGlobalUp);
    };
  }, [isDragging, onEnd]);

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-[9px] font-mono text-studio-muted uppercase tracking-[0.15em]">Morph Pad</span>
        <div className="flex gap-3 text-[8px] font-mono">
          <span className="text-studio-accent">X: {valueX}</span>
          <span className="text-studio-accent">Y: {valueY}</span>
        </div>
      </div>
      
      <div 
        ref={padRef}
        onMouseDown={(e) => { 
          setIsDragging(true); 
          onStart?.();
          handleMove(e); 
        }}
        onMouseMove={handleMove}
        className="relative aspect-square rounded-xl cursor-crosshair overflow-hidden group"
        style={{ background: '#0d0d0e', border: '1px solid #222224' }}
      >
        {/* Grid Lines with vintage tone */}
        <div className="absolute inset-0 grid grid-cols-4 grid-rows-4 pointer-events-none">
          {[...Array(16)].map((_, i) => (
            <div key={i} style={{ border: '0.5px solid rgba(99,102,241,0.06)' }} />
          ))}
        </div>

        {/* Labels */}
        <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 text-[7px] font-mono text-studio-muted uppercase pointer-events-none">
          {labelX}
        </div>
        <div className="absolute left-1.5 top-1/2 -translate-y-1/2 -rotate-90 text-[7px] font-mono text-studio-muted uppercase pointer-events-none">
          {labelY}
        </div>

        {/* Handle */}
        <motion.div 
          className="absolute w-3.5 h-3.5 -ml-[7px] -mt-[7px] rounded-full border-2 pointer-events-none"
          style={{ 
            background: '#6366f1', 
            borderColor: '#ffffff',
            boxShadow: '0 0 12px rgba(99,102,241,0.7), 0 0 24px rgba(99,102,241,0.3)'
          }}
          animate={{ left: `${valueX}%`, top: `${100 - valueY}%` }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
        >
          <div className="absolute inset-0 animate-ping rounded-full opacity-15" style={{ background: '#6366f1' }} />
        </motion.div>
      </div>
    </div>
  );
};
