/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';

interface KnobProps {
  label: string;
  value: number;
  onChange: (val: number) => void;
  onStart?: () => void;
  onEnd?: () => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
}

export const Knob: React.FC<KnobProps> = ({ 
  label, 
  value, 
  onChange,
  onStart,
  onEnd,
  min = 0, 
  max = 100, 
  unit = '%' 
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const startY = useRef(0);
  const startVal = useRef(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    startY.current = e.clientY;
    startVal.current = value;
    document.body.style.cursor = 'ns-resize';
    onStart?.();
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const delta = startY.current - e.clientY;
      const range = max - min;
      const sensitivity = 0.5;
      const newVal = Math.min(max, Math.max(min, startVal.current + (delta * sensitivity * (range / 100))));
      onChange(Math.round(newVal));
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.body.style.cursor = 'default';
      onEnd?.();
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, max, min, onChange]);

  const rotation = ((value - min) / (max - min)) * 270 - 135;

  return (
    <div className="knob-container">
      <div 
        className="knob-outer relative"
        onMouseDown={handleMouseDown}
      >
        {/* Tick marks */}
        {[...Array(11)].map((_, i) => {
          const tickRot = -135 + i * 27;
          return (
            <div
              key={i}
              className="absolute w-0.5 h-1 rounded-full"
              style={{
                transform: `rotate(${tickRot}deg)`,
                transformOrigin: 'center 24px',
                top: '2px',
                left: '23px', // centered within the 48px knob
                background: i * 10 <= ((value - min) / (max - min)) * 100 ? '#6366f1' : '#222224',
                opacity: i * 10 <= ((value - min) / (max - min)) * 100 ? 0.8 : 0.4,
              }}
            />
          );
        })}
        <div 
          className="knob-indicator"
          style={{ transform: `rotate(${rotation}deg)` }}
        />
      </div>
      <div className="flex flex-col items-center">
        <span className="text-[9px] font-mono text-studio-muted uppercase tracking-wider">{label}</span>
        <span className="text-[11px] font-mono text-studio-accent">{value}{unit}</span>
      </div>
    </div>
  );
};
