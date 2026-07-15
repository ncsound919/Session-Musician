/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Upload, Trash2, Scissors, Play, Square, Save, Brain, Zap, Grid, Layers, Crosshair, ArrowRight, RotateCw, AlertTriangle, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { audioEngine } from '../services/audioEngine';
import { InstrumentState, PerformedNote } from '../types';
import { motion, AnimatePresence } from 'motion/react';

interface SamplerWorkbenchProps {
  state: InstrumentState;
  bpm: number;
  onUpdateSynthParam: (key: string, val: any) => void;
  onUpdateMidi: (notes: PerformedNote[]) => void;
  onLearnFromSampler?: () => void;
}

const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15MB
const SUPPORTED_EXTENSIONS = /\.(wav|mp3|ogg|flac|aiff|aif|m4a|webm)$/i;
const TICKS_PER_BEAT = 480;
const MIN_SLICE_GAP_SEC = 0.05;

function isLikelyAudioFile(file: File): boolean {
  if (file.type.startsWith('audio/')) return true;
  return SUPPORTED_EXTENSIONS.test(file.name);
}

// Snap a tick to the nearest 16th note grid line.
function quantizeTick(tick: number, ticksPerStep = TICKS_PER_BEAT / 4): number {
  return Math.round(tick / ticksPerStep) * ticksPerStep;
}

export const SamplerWorkbench: React.FC<SamplerWorkbenchProps> = ({
  state,
  bpm,
  onUpdateSynthParam,
  onUpdateMidi,
  onLearnFromSampler
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [waveformPath, setWaveformPath] = useState<string>('');
  const [activePad, setActivePad] = useState<number | null>(null);

  const [sliceStart, setSliceStart] = useState(0);
  const [sliceEnd, setSliceEnd] = useState(1);
  const [isDraggingHandle, setIsDraggingHandle] = useState<'start' | 'end' | null>(null);
  const [draggedSlice, setDraggedSlice] = useState<boolean>(false);

  const [isRecording, setIsRecording] = useState(false);
  const [recordedNotes, setRecordedNotes] = useState<PerformedNote[]>([]);
  const [recordStartTime, setRecordStartTime] = useState<number>(0);
  const [loopLengthBars, setLoopLengthBars] = useState(2);
  const [quantizeRecording, setQuantizeRecording] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const waveformRef = useRef<HTMLDivElement>(null);

  // AUDIT FIX: mirror sliceStart/sliceEnd in a ref so the drag mousemove
  // listener can read the *current* clamp bounds without needing them in
  // the effect's dependency array. Previously sliceStart/sliceEnd were
  // effect deps, which meant every setSliceStart/setSliceEnd call during a
  // drag tore down and re-added the document listeners on every mousemove.
  const sliceBoundsRef = useRef({ sliceStart, sliceEnd });
  useEffect(() => {
    sliceBoundsRef.current = { sliceStart, sliceEnd };
  }, [sliceStart, sliceEnd]);

  const samplerBuffer = (audioEngine as any).samplerBuffer as AudioBuffer | null;
  const chops = (audioEngine as any).samplerChops || [];

  useEffect(() => {
    if (!samplerBuffer) {
      setWaveformPath('');
      return;
    }

    if (sliceEnd > samplerBuffer.duration) setSliceEnd(samplerBuffer.duration);

    const generateWaveform = () => {
      try {
        const rawData = samplerBuffer.getChannelData(0);
        const samples = 800;
        const blockSize = Math.max(1, Math.floor(rawData.length / samples));
        const peaks: number[] = [];

        for (let i = 0; i < samples; i++) {
          let max = 0;
          const start = i * blockSize;
          const end = Math.min(rawData.length, start + blockSize);
          for (let j = start; j < end; j++) {
            const val = Math.abs(rawData[j]);
            if (val > max) max = val;
          }
          peaks.push(max);
        }

        let path = 'M 0 50 ';
        peaks.forEach((peak, index) => {
          const x = (index / (samples - 1)) * 800;
          const y = 50 - peak * 45;
          path += `L ${x} ${y} `;
        });
        for (let i = peaks.length - 1; i >= 0; i--) {
          const x = (i / (samples - 1)) * 800;
          const y = 50 + peaks[i] * 45;
          path += `L ${x} ${y} `;
        }
        path += 'Z';
        setWaveformPath(path);
      } catch (err) {
        setWaveformPath('');
      }
    };

    generateWaveform();
  }, [samplerBuffer]);

  // AUDIT FIX: sliceStart/sliceEnd removed from deps — the listener now
  // reads live bounds from sliceBoundsRef instead, so this effect only
  // re-subscribes when a drag actually starts/stops (isDraggingHandle
  // changes) or the buffer changes, not on every mousemove.
  useEffect(() => {
    if (!isDraggingHandle) return;

    const handleDocumentMouseMove = (e: MouseEvent) => {
      if (!waveformRef.current || !samplerBuffer) return;

      const rect = waveformRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
      const time = (x / rect.width) * samplerBuffer.duration;
      const { sliceStart: curStart, sliceEnd: curEnd } = sliceBoundsRef.current;

      if (isDraggingHandle === 'start') {
        setSliceStart(Math.min(time, curEnd - MIN_SLICE_GAP_SEC));
      } else {
        setSliceEnd(Math.max(time, curStart + MIN_SLICE_GAP_SEC));
      }
    };

    const handleDocumentMouseUp = () => setIsDraggingHandle(null);

    document.addEventListener('mousemove', handleDocumentMouseMove);
    document.addEventListener('mouseup', handleDocumentMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleDocumentMouseMove);
      document.removeEventListener('mouseup', handleDocumentMouseUp);
    };
  }, [isDraggingHandle, samplerBuffer]);

  const processFile = async (file: File) => {
    setErrorMsg(null);

    if (!isLikelyAudioFile(file)) {
      setErrorMsg(`"${file.name}" doesn't look like an audio file. Use WAV, MP3, OGG, FLAC, AIFF, or M4A.`);
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setErrorMsg(`File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max size is ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB.`);
      return;
    }

    if (file.size === 0) {
      setErrorMsg(`"${file.name}" is empty (0 bytes).`);
      return;
    }

    setIsLoading(true);
    try {
      await audioEngine.saveAndSetCustomInstrumentSample('Sampler', file, 60);
      const buffer = (audioEngine as any).samplerBuffer;
      if (buffer) {
        // AUDIT FIX: guard against a decoded buffer with ~zero duration
        // (e.g. a corrupted or truncated file that still passes the
        // byte-size check). Without this, sliceStart/sliceEnd could both
        // collapse to 0, producing a zero-length chop with no feedback.
        if (buffer.duration < MIN_SLICE_GAP_SEC) {
          setErrorMsg(`"${file.name}" decoded to a near-zero-length sample (${buffer.duration.toFixed(3)}s) and can't be sliced. The file may be corrupted.`);
          setIsLoading(false);
          return;
        }
        setSliceStart(0);
        setSliceEnd(Math.min(buffer.duration, 2.0));
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to load sample. The file may be corrupted or in an unsupported codec.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handlePadDown = (index: number) => {
    setActivePad(index);
    const midi = 60 + index;

    if (!audioEngine.ctx) {
      setErrorMsg('Audio engine is not initialized yet. Click anywhere on the page first, then try again.');
      return;
    }

    audioEngine.playSamplerChopNote(midi, audioEngine.ctx.currentTime, 1.0, 0.8);

    if (isRecording) {
      const now = Date.now();
      const elapsedMs = now - recordStartTime;
      const rawTick = Math.floor(elapsedMs * (bpm / 60000) * TICKS_PER_BEAT);
      const tick = quantizeRecording ? quantizeTick(rawTick) : rawTick;

      const newNote: PerformedNote = {
        id: `sampler-${Date.now()}-${index}`,
        midi: midi,
        note: midi,
        tick: tick,
        duration: 240,
        velocity: 100,
        channel: 'Sampler',
        startBeatOffset: tick / TICKS_PER_BEAT,
        durationBeats: 0.5,
        articulation: 'normal',
        reason: 'Sampler Pad Performance',
        absoluteBeat: tick / TICKS_PER_BEAT
      };
      setRecordedNotes(prev => [...prev, newNote]);
    }
  };

  const handlePadUp = () => setActivePad(null);

  const assignSliceToPad = (index: number) => {
    if (!samplerBuffer) return;
    // AUDIT: sliceStart/sliceEnd are clamped to a MIN_SLICE_GAP_SEC minimum
    // during drag, and the zero-duration-buffer case is now rejected at
    // load time above, so this is safe. Kept as a defensive guard in case
    // future callers set slice bounds programmatically without the same
    // clamps.
    if (sliceEnd - sliceStart < MIN_SLICE_GAP_SEC) return;
    audioEngine.updateSamplerChop(index, sliceStart, sliceEnd);
    setActivePad(index);
    setTimeout(() => setActivePad(null), 200);
  };

  const toggleRecording = () => {
    if (!isRecording) {
      setRecordedNotes([]);
      setRecordStartTime(Date.now());
      setIsRecording(true);
    } else {
      setIsRecording(false);
      onUpdateMidi(recordedNotes);
    }
  };

  const playPreview = () => {
    if (!samplerBuffer || !audioEngine.ctx) {
      setErrorMsg('Cannot preview: no sample loaded or audio engine not ready.');
      return;
    }
    const ctx = audioEngine.ctx;
    const source = ctx.createBufferSource();
    source.buffer = samplerBuffer;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.8, ctx.currentTime);
    source.connect(gain);
    gain.connect(ctx.destination);
    source.start(ctx.currentTime, sliceStart, Math.max(0.01, sliceEnd - sliceStart));
  };

  return (
    <div className="flex flex-col gap-6 p-6 bg-[#0a0a0c] rounded-2xl border border-studio-border/40 min-h-[600px] select-none">
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Layers className="w-6 h-6 text-studio-accent" /> MPC-Style Sampler Workbench
          </h2>
          <p className="text-xs text-studio-muted font-mono uppercase tracking-widest mt-1">
            Chop, Loop, and Sequence Custom Textures
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setQuantizeRecording(prev => !prev)}
            title="Toggle 16th-note quantization while recording"
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 rounded-full font-mono text-[9px] uppercase tracking-wider transition-all border",
              quantizeRecording
                ? "bg-studio-accent/15 border-studio-accent/40 text-studio-accent"
                : "bg-white/5 border-white/10 text-studio-muted hover:text-white"
            )}
          >
            <Grid className="w-3 h-3" /> Quantize {quantizeRecording ? 'On' : 'Off'}
          </button>

          <button
            onClick={toggleRecording}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-full font-mono text-[10px] uppercase tracking-wider transition-all",
              isRecording 
                ? "bg-red-500 text-white animate-pulse" 
                : "bg-white/5 text-studio-muted hover:bg-white/10"
            )}
          >
            {isRecording ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            {isRecording ? 'Stop Recording' : 'Record Sequence'}
          </button>

          <button
            onClick={onLearnFromSampler}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-full font-mono text-[10px] uppercase tracking-wider transition-all",
              recordedNotes.length > 0
                ? "bg-studio-accent/20 text-studio-accent border border-studio-accent/30 hover:bg-studio-accent/30"
                : "opacity-40 grayscale cursor-not-allowed pointer-events-none"
            )}
          >
            <Brain className="w-3.5 h-3.5" /> Learn Loop & Accompany
          </button>
        </div>
      </div>

      {/* Waveform Area with Slicer Handles */}
      <div className="relative group flex flex-col gap-3">
        <div 
          ref={waveformRef}
          className="h-56 bg-black/40 rounded-xl border border-studio-border/30 overflow-hidden relative"
        >
          {!samplerBuffer ? (
            <div 
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => !isLoading && fileInputRef.current?.click()}
              className={cn(
                "absolute inset-0 flex flex-col items-center justify-center cursor-pointer transition-colors",
                isDragging ? "bg-studio-accent/10" : "hover:bg-white/[0.02]",
                isLoading && "opacity-50 cursor-wait"
              )}
            >
              <Upload className="w-10 h-10 text-studio-muted mb-3" />
              <span className="text-xs font-mono text-studio-muted uppercase">
                {isLoading ? 'Loading sample...' : isDragging ? 'Drop to load' : 'Upload Audio to Begin Chopping'}
              </span>
              <span className="text-[9px] font-mono text-studio-muted/50 mt-1">Max {MAX_FILE_SIZE_BYTES / 1024 / 1024}MB</span>
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*,.wav,.mp3,.ogg,.flac,.aiff,.aif,.m4a"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.[0]) processFile(e.target.files[0]);
                  e.target.value = '';
                }}
              />
            </div>
          ) : (
            <>
              <svg viewBox="0 0 800 100" className="w-full h-full text-studio-accent/30 fill-studio-accent/5 stroke-current" preserveAspectRatio="none">
                <path d={waveformPath} strokeWidth="1" />
                {chops.map((chop: any) => (
                  <line 
                    key={chop.id} 
                    x1={(chop.start / samplerBuffer.duration) * 800} 
                    y1="0" 
                    x2={(chop.start / samplerBuffer.duration) * 800} 
                    y2="100" 
                    stroke="rgba(255,255,255,0.15)" 
                    strokeDasharray="4"
                  />
                ))}
              </svg>

              <div 
                className="absolute inset-y-0 bg-studio-accent/10 border-x border-studio-accent/50 pointer-events-none"
                style={{ 
                  left: `${(sliceStart / samplerBuffer.duration) * 100}%`, 
                  width: `${((sliceEnd - sliceStart) / samplerBuffer.duration) * 100}%` 
                }}
              >
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-2">
                  <Scissors className="w-4 h-4 text-studio-accent opacity-60" />
                </div>
              </div>

              <div 
                onMouseDown={() => setIsDraggingHandle('start')}
                className="absolute inset-y-0 w-4 -ml-2 cursor-col-resize group/handle"
                style={{ left: `${(sliceStart / samplerBuffer.duration) * 100}%` }}
              >
                <div className="absolute inset-y-0 left-1/2 w-0.5 bg-studio-accent group-hover/handle:w-1 transition-all" />
              </div>
              <div 
                onMouseDown={() => setIsDraggingHandle('end')}
                className="absolute inset-y-0 w-4 -ml-2 cursor-col-resize group/handle"
                style={{ left: `${(sliceEnd / samplerBuffer.duration) * 100}%` }}
              >
                <div className="absolute inset-y-0 left-1/2 w-0.5 bg-studio-accent group-hover/handle:w-1 transition-all" />
              </div>

              <div className="absolute top-2 left-3 bg-black/60 backdrop-blur px-2 py-1 rounded text-[9px] font-mono text-white/70 border border-white/10 uppercase tracking-tighter">
                {(audioEngine as any).samplerFileName} • {samplerBuffer.duration.toFixed(2)}s
              </div>
              
              <div className="absolute top-2 right-3 flex items-center gap-2">
                <button 
                  onClick={playPreview}
                  className="bg-studio-accent/80 hover:bg-studio-accent text-white p-1.5 rounded-lg transition-colors"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                </button>
              </div>
            </>
          )}
        </div>
        
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-4">
            <div className="flex flex-col">
              <span className="text-[9px] font-mono text-studio-muted uppercase">Start</span>
              <span className="text-xs font-mono text-white">{sliceStart.toFixed(3)}s</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[9px] font-mono text-studio-muted uppercase">End</span>
              <span className="text-xs font-mono text-white">{sliceEnd.toFixed(3)}s</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[9px] font-mono text-studio-muted uppercase">Duration</span>
              <span className="text-xs font-mono text-studio-accent">{(sliceEnd - sliceStart).toFixed(3)}s</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-mono text-studio-muted uppercase flex items-center gap-1.5">
               <ArrowRight className="w-3 h-3" /> Drag handle to assign:
            </span>
            <div 
              draggable 
              onDragStart={(e) => {
                e.dataTransfer.setData('text/plain', 'slice');
                setDraggedSlice(true);
              }}
              onDragEnd={() => setDraggedSlice(false)}
              className="p-1.5 bg-studio-accent rounded cursor-grab active:cursor-grabbing hover:scale-110 transition-transform shadow-lg shadow-studio-accent/20"
            >
              <Scissors className="w-3.5 h-3.5 text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* Pad Grid with Drop Targets */}
      <div className="grid grid-cols-4 gap-4 max-w-2xl mx-auto w-full">
        {Array.from({ length: 12 }).map((_, i) => (
          <Pad 
            key={i} 
            index={i} 
            active={activePad === i}
            onDown={() => handlePadDown(i)}
            onUp={handlePadUp}
            onAssign={() => assignSliceToPad(i)}
            chop={chops[i]}
          />
        ))}
      </div>

      {/* Recorder Status */}
      {recordedNotes.length > 0 && (
        <div className="bg-black/20 p-4 rounded-xl border border-studio-border/20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex flex-col">
              <span className="text-[10px] font-mono text-studio-muted uppercase">Recorded Loop</span>
              <span className="text-sm font-bold text-white">{recordedNotes.length} Events</span>
            </div>
            <div className="h-8 w-px bg-white/10" />
            <div className="flex flex-col">
              <span className="text-[10px] font-mono text-studio-muted uppercase">Length</span>
              <span className="text-sm font-bold text-studio-accent">{loopLengthBars} Bars</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
             <button 
              onClick={() => setLoopLengthBars(prev => prev === 2 ? 4 : 2)}
              className="text-[10px] font-mono text-studio-muted uppercase border border-white/10 px-2 py-1 rounded hover:bg-white/5"
            >
              <RotateCw className="w-3 h-3 inline mr-1" /> {loopLengthBars} Bars
            </button>
            <button onClick={() => setRecordedNotes([])} className="text-[10px] font-mono text-red-400 uppercase hover:underline">Discard</button>
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="text-[9px] font-mono text-red-400 bg-red-500/10 p-2.5 rounded border border-red-500/20 flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span className="flex-1 text-left">{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="cursor-pointer flex-shrink-0">
            <X className="w-3.5 h-3.5 text-red-400/70 hover:text-red-300" />
          </button>
        </div>
      )}
    </div>
  );
};

const Pad = ({ index, active, onDown, onUp, onAssign, chop }: any) => {
  const [isOver, setIsOver] = useState(false);

  return (
    <div 
      className="relative"
      onDragEnter={() => setIsOver(true)}
      onDragLeave={() => setIsOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsOver(false);
        onAssign();
      }}
      onDragOver={(e) => e.preventDefault()}
    >
      <button
        onMouseDown={onDown}
        onMouseUp={onUp}
        onMouseLeave={onUp}
        className={cn(
          "w-full aspect-square rounded-xl border-2 flex flex-col items-center justify-center gap-2 transition-all active:scale-95 select-none relative overflow-hidden",
          active 
            ? "bg-studio-accent border-white text-white shadow-[0_0_20px_rgba(var(--studio-accent-rgb),0.5)]" 
            : isOver
            ? "bg-studio-accent/20 border-studio-accent text-studio-accent"
            : chop 
            ? "bg-[#1c1c1f] border-studio-accent/40 text-studio-accent/80" 
            : "bg-[#161618] border-studio-border/40 text-studio-muted hover:border-studio-accent/40 hover:text-studio-accent"
        )}
      >
        <div className="absolute top-1.5 left-2 text-[8px] font-bold opacity-30">PAD {index + 1}</div>
        <Grid className={cn("w-6 h-6", chop ? "opacity-60" : "opacity-20")} />
        {chop && (
          <div className="absolute bottom-1.5 inset-x-0 flex flex-col items-center">
            <span className="text-[7px] font-mono uppercase tracking-tighter">{(chop.end - chop.start).toFixed(2)}s</span>
            <div className="w-8 h-0.5 bg-studio-accent mt-0.5 rounded-full" />
          </div>
        )}
        {!chop && <span className="text-[8px] font-mono uppercase opacity-40">Empty</span>}
        
        <div 
          onClick={onAssign}
          className="absolute inset-0 flex items-center justify-center bg-studio-accent/80 text-white opacity-0 hover:opacity-100 transition-opacity cursor-pointer group"
        >
          <Scissors className="w-5 h-5 group-hover:scale-110 transition-transform" />
        </div>
      </button>
    </div>
  );
};
