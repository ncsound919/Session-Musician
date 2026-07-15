/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';

interface XYPadProps {
  labelX: string;
  labelY: string;
  valueX: number; // 0–100
  valueY: number; // 0–100
  onChange: (x: number, y: number) => void;
  onStart?: () => void;
  onEnd?: () => void;
}

export const XYPad: React.FC<XYPadProps> = ({
  labelX,
  labelY,
  valueX,
  valueY,
  onChange,
  onStart,
  onEnd,
}) => {
  const padRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false); // synchronous drag state

  // Latest callback refs to avoid stale closures in event listeners
  const onChangeRef = useRef(onChange);
  const onStartRef = useRef(onStart);
  const onEndRef = useRef(onEnd);
  useEffect(() => {
    onChangeRef.current = onChange;
    onStartRef.current = onStart;
    onEndRef.current = onEnd;
  });

  const clamp = useCallback((v: number) => Math.min(100, Math.max(0, v)), []);

  // Compute XY from pointer position relative to pad
  const getPosFromEvent = useCallback(
    (clientX: number, clientY: number) => {
      const pad = padRef.current;
      if (!pad) return { x: valueX, y: valueY };
      const rect = pad.getBoundingClientRect();
      const x = clamp(((clientX - rect.left) / rect.width) * 100);
      const y = clamp((1 - (clientY - rect.top) / rect.height) * 100);
      return { x, y };
    },
    [valueX, valueY, clamp]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      isDraggingRef.current = true;
      onStartRef.current?.();

      const { x, y } = getPosFromEvent(e.clientX, e.clientY);
      onChangeRef.current(Math.round(x), Math.round(y));
    },
    [getPosFromEvent]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDraggingRef.current) return;
      e.preventDefault();
      const { x, y } = getPosFromEvent(e.clientX, e.clientY);
      onChangeRef.current(Math.round(x), Math.round(y));
    },
    [getPosFromEvent]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!isDraggingRef.current) return;
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      isDraggingRef.current = false;
      onEndRef.current?.();
    },
    []
  );

  // Cleanup: fire onEnd if component unmounts while dragging
  useEffect(() => {
    return () => {
      if (isDraggingRef.current) {
        onEndRef.current?.();
      }
    };
  }, []);

  // Keyboard control: arrows move by step (Shift accelerates)
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const step = e.shiftKey ? 10 : 1;
      let dx = 0,
        dy = 0;
      if (e.key === 'ArrowLeft') dx = -step;
      if (e.key === 'ArrowRight') dx = step;
      if (e.key === 'ArrowUp') dy = step;
      if (e.key === 'ArrowDown') dy = -step;
      if (dx === 0 && dy === 0) return;

      e.preventDefault();
      const newX = clamp(valueX + dx);
      const newY = clamp(valueY + dy);
      onChange(Math.round(newX), Math.round(newY));
    },
    [valueX, valueY, onChange, clamp]
  );

  // Interactive area CSS: prevent touch scrolling and show proper cursor
  const padStyle: React.CSSProperties = {
    background: '#0d0d0e',
    border: '1px solid #222224',
    touchAction: 'none', // prevent scroll on touch devices
  };

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-[9px] font-mono text-studio-muted uppercase tracking-[0.15em]">
          Morph Pad
        </span>
        <div className="flex gap-3 text-[8px] font-mono">
          <span className="text-studio-accent">X: {valueX}</span>
          <span className="text-studio-accent">Y: {valueY}</span>
        </div>
      </div>

      <div
        ref={padRef}
        role="application"
        aria-label={`XY pad: ${labelX} vs ${labelY}. Use arrow keys to adjust.`}
        tabIndex={0}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onKeyDown={handleKeyDown}
        className="relative aspect-square rounded-xl cursor-crosshair overflow-hidden group focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        style={padStyle}
      >
        {/* Grid Lines */}
        <div className="absolute inset-0 grid grid-cols-4 grid-rows-4 pointer-events-none">
          {[...Array(16)].map((_, i) => (
            <div
              key={i}
              style={{ border: '0.5px solid rgba(99,102,241,0.06)' }}
            />
          ))}
        </div>

        {/* Axis labels */}
        <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 text-[7px] font-mono text-studio-muted uppercase pointer-events-none">
          {labelX}
        </div>
        <div className="absolute left-1.5 top-1/2 -translate-y-1/2 -rotate-90 text-[7px] font-mono text-studio-muted uppercase pointer-events-none">
          {labelY}
        </div>

        {/* Handle – no animation while dragging (instant update) */}
        <div
          className="absolute w-3.5 h-3.5 -ml-[7px] -mt-[7px] rounded-full border-2 pointer-events-none"
          style={{
            background: '#6366f1',
            borderColor: '#ffffff',
            boxShadow: '0 0 12px rgba(99,102,241,0.7), 0 0 24px rgba(99,102,241,0.3)',
            left: `${valueX}%`,
            top: `${100 - valueY}%`,
            // Fast transition when not dragging, instant when dragging
            transition: isDraggingRef.current
              ? 'none'
              : 'left 0.1s ease-out, top 0.1s ease-out',
          }}
        >
          <div className="absolute inset-0 animate-ping rounded-full opacity-15" style={{ background: '#6366f1' }} />
        </div>
      </div>
    </div>
  );
};
