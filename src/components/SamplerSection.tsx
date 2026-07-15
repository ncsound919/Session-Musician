/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Upload, Trash2, Music, Check, ArrowRight, AlertTriangle, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { audioEngine } from '../services/audioEngine';

import { SynthParams } from '../types';

interface SamplerSectionProps {
  instrument: 'Bass' | 'Keys' | 'Guitar' | 'Pads' | 'Lead';
  fileName: string | undefined;
  rootMidi: number;
  synthParams?: SynthParams;
  onUpload: (file: File, rootMidi: number) => Promise<void>;
  onRemove: () => Promise<void>;
  onRootMidiChange: (rootMidi: number) => Promise<void>;
  onUpdateSynthParam?: (key: keyof SynthParams | 'reverb' | 'delay', val: any) => void;
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15MB, generous for uncompressed one-shots
const SUPPORTED_EXTENSIONS = /\.(wav|mp3|ogg|flac|aiff|aif|m4a|webm)$/i;
const WAVEFORM_POLL_MAX_ATTEMPTS = 25; // ~5s ceiling at 200ms intervals
const WAVEFORM_POLL_INTERVAL_MS = 200;

function getNoteName(midi: number): string {
  const noteName = NOTE_NAMES[midi % 12];
  const octave = Math.floor(midi / 12) - 1;
  return `${noteName}${octave}`;
}

function isLikelyAudioFile(file: File): boolean {
  if (file.type.startsWith('audio/')) return true;
  // Fall back to extension check since file.type can be empty/unreliable
  return SUPPORTED_EXTENSIONS.test(file.name);
}

export const SamplerSection: React.FC<SamplerSectionProps> = ({
  instrument,
  fileName,
  rootMidi,
  synthParams,
  onUpload,
  onRemove,
  onRootMidiChange,
  onUpdateSynthParam,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [waveformPath, setWaveformPath] = useState<string>('');
  const [isWaveformPending, setIsWaveformPending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const buildWaveformPath = useCallback((buffer: AudioBuffer): string => {
    const rawData = buffer.getChannelData(0);
    const samples = 140;
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

    let path = 'M 0 30 ';
    peaks.forEach((peak, index) => {
      const x = (index / (samples - 1)) * 300;
      const y = 30 - peak * 28;
      path += `L ${x} ${y} `;
    });
    for (let i = peaks.length - 1; i >= 0; i--) {
      const x = (i / (samples - 1)) * 300;
      const y = 30 + peaks[i] * 28;
      path += `L ${x} ${y} `;
    }
    path += 'Z';
    return path;
  }, []);

  // Poll with a bounded retry count instead of a single blind 200ms guess.
  useEffect(() => {
    if (!fileName) {
      setWaveformPath('');
      setIsWaveformPending(false);
      return;
    }

    let attempts = 0;
    let cancelled = false;
    setIsWaveformPending(true);
    setWaveformPath('');

    const tryGenerate = () => {
      if (cancelled) return;

      const buffer = (audioEngine as any).customInstrumentBuffers?.[instrument] as AudioBuffer | undefined;

      if (buffer) {
        try {
          setWaveformPath(buildWaveformPath(buffer));
        } catch (err) {
          console.warn('Failed to parse waveform data:', err);
          setWaveformPath('');
        }
        setIsWaveformPending(false);
        return;
      }

      attempts += 1;
      if (attempts >= WAVEFORM_POLL_MAX_ATTEMPTS) {
        setIsWaveformPending(false);
        return;
      }

      timer = setTimeout(tryGenerate, WAVEFORM_POLL_INTERVAL_MS);
    };

    let timer = setTimeout(tryGenerate, WAVEFORM_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [instrument, fileName, buildWaveformPath]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const processFile = async (file: File) => {
    setErrorMsg(null);

    if (!isLikelyAudioFile(file)) {
      setErrorMsg(`"${file.name}" doesn't look like an audio file. Use WAV, MP3, OGG, FLAC, AIFF, or M4A.`);
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setErrorMsg(
        `File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max size is ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB.`
      );
      return;
    }

    if (file.size === 0) {
      setErrorMsg(`"${file.name}" is empty (0 bytes).`);
      return;
    }

    setIsLoading(true);
    try {
      await onUpload(file, rootMidi);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to decode and save sample. The file may be corrupted or in an unsupported codec.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      processFile(e.target.files[0]);
    }
    e.target.value = ''; // allow re-selecting the same file later
  };

  const handleMidiSliderChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value);
    await onRootMidiChange(val);
  };

  return (
    <div className="bg-[#121214]/60 p-4 rounded-xl border border-studio-border/60 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono text-studio-muted uppercase tracking-[0.15em] flex items-center gap-1.5">
          <Music className="w-3.5 h-3.5 text-studio-accent" /> One-Shot Sampler
        </span>
        {fileName && (
          <button
            onClick={onRemove}
            className="p-1 rounded text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors cursor-pointer"
            title="Delete sample and revert to Synthesizer"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {fileName ? (
        <div className="space-y-4">
          <div className="bg-black/40 border border-studio-border/30 rounded-lg p-3 flex flex-col gap-2 relative overflow-hidden">
            <div className="flex justify-between items-start z-10">
              <div className="max-w-[200px]">
                <div className="text-[11px] font-mono text-white truncate font-bold">{fileName}</div>
                <div className="text-[8px] font-mono text-studio-green uppercase mt-0.5 flex items-center gap-1">
                  <Check className="w-2.5 h-2.5" /> Mapped & Persistent
                </div>
              </div>
              <div className="text-right">
                <span className="text-[9px] font-mono text-studio-accent uppercase bg-studio-accent/10 px-2 py-0.5 rounded border border-studio-accent/20">
                  Sampler Mode
                </span>
              </div>
            </div>

            <div className="h-16 flex items-center justify-center bg-black/20 rounded border border-[#1a1a1c] relative">
              {waveformPath ? (
                <svg viewBox="0 0 300 60" className="w-full h-full text-studio-accent fill-studio-accent/10 stroke-current opacity-80" preserveAspectRatio="none">
                  <path d={waveformPath} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : isWaveformPending ? (
                <div className="text-[9px] font-mono text-studio-muted animate-pulse">Decoding wave peaks...</div>
              ) : (
                <div className="text-[9px] font-mono text-studio-muted/60">Waveform unavailable</div>
              )}
            </div>
          </div>

          <div className="bg-black/25 p-3 rounded-lg border border-studio-border/30 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-[9px] font-mono text-studio-muted uppercase">Root Note (Pitch-shift center)</span>
              <span className="text-xs font-mono font-bold text-studio-accent bg-studio-accent/10 px-2 py-0.5 rounded border border-studio-accent/20">
                {getNoteName(rootMidi)} (MIDI {rootMidi})
              </span>
            </div>

            <div className="space-y-1">
              <input
                type="range"
                min="36"
                max="84"
                value={rootMidi}
                onChange={handleMidiSliderChange}
                className="w-full accent-studio-accent cursor-pointer"
              />
              <div className="flex justify-between text-[8px] font-mono text-studio-muted">
                <span>C2 (36)</span>
                <span>C3 (48)</span>
                <span>C4 (60 - Middle C)</span>
                <span>C5 (72)</span>
                <span>C6 (84)</span>
              </div>
            </div>

            <p className="text-[8px] font-mono text-studio-muted/70 leading-relaxed">
              Playing notes higher than {getNoteName(rootMidi)} will speed up (pitch-up) the sample. Playing notes lower will slow it down.
            </p>
          </div>

          {synthParams && onUpdateSynthParam && (
            <div className="bg-black/25 p-3 rounded-lg border border-studio-border/30 space-y-3">
              <span className="text-[9px] font-mono text-studio-muted uppercase">Sampler FX Chain</span>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-[8px] font-mono">
                    <span className="text-studio-muted">LP Filter Cutoff</span>
                    <span className="text-studio-accent">{Math.floor(synthParams.filterCutoff ?? 10000)}Hz</span>
                  </div>
                  <input
                    type="range"
                    min="200"
                    max="20000"
                    step="100"
                    value={synthParams.filterCutoff ?? 10000}
                    onChange={(e) => onUpdateSynthParam('filterCutoff', parseInt(e.target.value))}
                    className="w-full accent-studio-accent h-1 cursor-pointer"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between items-center text-[8px] font-mono">
                    <span className="text-studio-muted">Saturation/Drive</span>
                    <span className="text-studio-accent">{Math.floor((synthParams.fx?.reverb ?? 0) * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="0.8"
                    step="0.01"
                    value={synthParams.fx?.reverb ?? 0}
                    onChange={(e) => onUpdateSynthParam('reverb', parseFloat(e.target.value))}
                    className="w-full accent-studio-accent h-1 cursor-pointer"
                  />
                </div>

                <div className="space-y-1 col-span-2">
                  <div className="flex justify-between items-center text-[8px] font-mono">
                    <span className="text-studio-muted">Echo Feedback</span>
                    <span className="text-studio-accent">{Math.floor((synthParams.fx?.delay ?? 0) * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="0.8"
                    step="0.01"
                    value={synthParams.fx?.delay ?? 0}
                    onChange={(e) => onUpdateSynthParam('delay', parseFloat(e.target.value))}
                    className="w-full accent-studio-accent h-1 cursor-pointer"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !isLoading && fileInputRef.current?.click()}
          className={cn(
            "border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center gap-2 text-center cursor-pointer transition-all duration-200 select-none",
            isLoading && "opacity-50 cursor-wait",
            isDragging
              ? "border-studio-accent bg-studio-accent/10 scale-[1.01]"
              : "border-studio-border hover:border-studio-border/80 hover:bg-white/[0.01]"
          )}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*,.wav,.mp3,.ogg,.flac,.aiff,.aif,.m4a"
            className="hidden"
            onChange={handleFileChange}
          />
          
          <div className={cn(
            "p-3 rounded-full bg-[#121214] border border-[#222224] mb-1 transition-all",
            isDragging && "scale-110 border-studio-accent"
          )}>
            <Upload className={cn("w-5 h-5", isDragging ? "text-studio-accent" : "text-studio-muted")} />
          </div>

          <span className="text-[11px] font-mono text-studio-muted font-semibold uppercase tracking-wider">
            {isDragging ? 'Drop file to load' : 'Upload custom sample'}
          </span>
          <p className="text-[9px] font-mono text-studio-muted/60 max-w-xs">
            Drag & drop or click to import. Max {MAX_FILE_SIZE_BYTES / 1024 / 1024}MB. Mapped across keyboard automatically and persistent.
          </p>
        </div>
      )}

      {isLoading && (
        <div className="text-[9px] font-mono text-studio-accent animate-pulse text-center">
          Loading and decoding audio sample...
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
