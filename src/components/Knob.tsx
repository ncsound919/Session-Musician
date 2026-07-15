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
  defaultValue?: number;
}

export const Knob: React.FC<KnobProps> = ({ 
  label, 
  value, 
  onChange,
  onStart,
  onEnd,
  min = 0, 
  max = 100, 
  step = 1,
  unit = '%',
  defaultValue
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

  const handleTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true);
    startY.current = e.touches[0].clientY;
    startVal.current = value;
    onStart?.();
  };

  const handleDoubleClick = () => {
    // Reset to provided default or halfway point between min and max
    const target = defaultValue !== undefined ? defaultValue : Math.round((min + max) / 2);
    onChange(target);
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

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging) return;
      const delta = startY.current - e.touches[0].clientY;
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

    const handleTouchEnd = () => {
      setIsDragging(false);
      onEnd?.();
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleTouchMove, { passive: true });
      window.addEventListener('touchend', handleTouchEnd);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isDragging, max, min, onChange, onEnd]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const range = max - min;
    const stepSize = step ?? Math.max(1, Math.round(range / 100));
    let newVal = value;

    switch (e.key) {
      case 'ArrowUp':
      case 'ArrowRight':
        e.preventDefault();
        newVal = Math.min(max, value + stepSize);
        break;
      case 'ArrowDown':
      case 'ArrowLeft':
        e.preventDefault();
        newVal = Math.max(min, value - stepSize);
        break;
      case 'PageUp':
        e.preventDefault();
        newVal = Math.min(max, value + stepSize * 10);
        break;
      case 'PageDown':
        e.preventDefault();
        newVal = Math.max(min, value - stepSize * 10);
        break;
      case 'Home':
        e.preventDefault();
        newVal = min;
        break;
      case 'End':
        e.preventDefault();
        newVal = max;
        break;
      case 'Enter':
      case 'Space':
        e.preventDefault();
        handleDoubleClick();
        break;
      default:
        return;
    }

    onChange(Math.round(newVal));
  };

  const rotation = ((value - min) / (max - min)) * 270 - 135;

  return (
    <div className="knob-container flex flex-col items-center">
      <div 
        tabIndex={0}
        role="slider"
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        onKeyDown={handleKeyDown}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onDoubleClick={handleDoubleClick}
        className="knob-outer relative select-none cursor-ns-resize focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-studio-accent focus-visible:ring-offset-2 focus-visible:ring-offset-[#121214] rounded-full"
        title="Drag vertically to adjust. Double-click to reset."
      >
        {/* Tick marks */}
        {[...Array(11)].map((_, i) => {
          const tickRot = -135 + i * 27;
          const isLit = i * 10 <= ((value - min) / (max - min)) * 100;
          return (
            <div
              key={i}
              className="absolute w-0.5 h-1 rounded-full transition-all duration-150"
              style={{
                transform: `rotate(${tickRot}deg)`,
                transformOrigin: 'center 24px',
                top: '2px',
                left: '23px', // centered within the 48px knob
                background: isLit ? '#6366f1' : '#222224',
                opacity: isLit ? 0.9 : 0.4,
                boxShadow: isLit ? '0 0 4px rgba(99,102,241,0.6)' : 'none'
              }}
            />
          );
        })}
        <div 
          className="knob-indicator"
          style={{ transform: `rotate(${rotation}deg)` }}
        />
      </div>
      <div className="flex flex-col items-center mt-1 select-none">
        <span className="text-[9px] font-mono text-studio-muted uppercase tracking-wider">{label}</span>
        <span className="text-[11px] font-mono text-studio-accent font-semibold">{value}{unit}</span>
      </div>
    </div>
  );
};
