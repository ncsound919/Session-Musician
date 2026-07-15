/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useRef, useEffect } from 'react';
import { Upload, Music, CheckCircle2, Loader2, Mic, MicOff } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { StylePreset } from '../types';
import { audioCapture } from '../services/audioCapture';

interface InspirationUploadProps {
  onAnalysisComplete: (analysis: any) => void;
  selectedPreset?: StylePreset | null;
  isListening: boolean;
  onToggleListen: () => void;
  mode: 'Plugin' | 'Scratch' | 'Interpolation' | 'Humming';
  selectedFile: File | null;
  onSelectedFileChange: (file: File | null) => void;
  status: string | null;
  onStatusChange: (status: string | null) => void;
  onSpecialFile?: (file: File) => void;
}

export const InspirationUpload: React.FC<InspirationUploadProps> = ({
  onAnalysisComplete,
  selectedPreset,
  isListening,
  onToggleListen,
  mode,
  selectedFile,
  onSelectedFileChange,
  status,
  onStatusChange,
  onSpecialFile,
}) => {
  const [isAnalyzing, setIsAnalyzing] = React.useState(false);
  const [isDragging, setIsDragging] = React.useState(false);

  // Keep track of mounted state and current AbortController
  const mountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isAnalyzing) {
      setIsDragging(true);
    }
  }, [isAnalyzing]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (isAnalyzing) return;

    if (e.dataTransfer.files?.[0]) {
      const file = e.dataTransfer.files[0];
      const isAudio = file.type.startsWith('audio/');
      const isSpecial = file.name.endsWith('.json') || file.name.endsWith('.zip') || file.name.endsWith('.mid') || file.name.endsWith('.midi');
      
      if (isSpecial) {
        if (onSpecialFile) {
          onSpecialFile(file);
        } else {
          onStatusChange('Special file received, but no handler provided.');
        }
      } else if (isAudio) {
        onSelectedFileChange(file);
        onStatusChange(`Selected "${file.name}" via drag-and-drop`);
      } else {
        onStatusChange('Invalid file type. Please drop an audio or session file.');
      }
    }
  }, [isAnalyzing, onSelectedFileChange, onStatusChange, onSpecialFile]);

  // FIXED: track the latest isListening/onToggleListen via refs so the
  // unmount cleanup below always reads the current value instead of a
  // stale closure captured at mount time. Without this, unmounting while
  // the mic is actively recording would silently leave capture running,
  // since the cleanup's closure over `isListening` was frozen at `false`
  // (its value on the initial render) and never updated.
  const isListeningRef = useRef(isListening);
  const onToggleListenRef = useRef(onToggleListen);

  useEffect(() => {
    isListeningRef.current = isListening;
    onToggleListenRef.current = onToggleListen;
  }, [isListening, onToggleListen]);

  // Cleanup on unmount: abort any ongoing request and stop audio capture
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      abortControllerRef.current?.abort();
      // If still listening, stop capture silently.
      // Reads from the ref (always current) rather than the closed-over
      // `isListening` prop (frozen at its mount-time value).
      if (isListeningRef.current) {
        audioCapture.stop().catch(() => {});
        onToggleListenRef.current();
      }
    };
  }, []);

  // Helper to stop live capture before file analysis
  const stopListeningIfActive = useCallback(async () => {
    if (isListening) {
      try {
        await audioCapture.stop();
        onToggleListen(); // sync parent state
      } catch (err) {
        console.error('Failed to stop live capture', err);
        onToggleListen(); // still toggle to avoid dead UI
      }
    }
  }, [isListening, onToggleListen]);

  const processAudio = useCallback(
    async (blob: Blob, isLive: boolean) => {
      // Stop live capture if we're about to analyze a file
      if (!isLive) {
        await stopListeningIfActive();
      }

      setIsAnalyzing(true);
      onStatusChange(isLive ? 'Analyzing live input...' : 'Analyzing file...');

      try {
        // Read blob as base64
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve, reject) => {
          reader.onload = () => {
            const base64 = (reader.result as string).split(',')[1];
            resolve(base64);
          };
          reader.onerror = () => reject(new Error('File reading failed'));
        });
        reader.readAsDataURL(blob);
        const base64Data = await base64Promise;

        if (!mountedRef.current) return; // unmounted during read

        const styleContext = selectedPreset
          ? `The user has selected the style: "${selectedPreset.name}" (${selectedPreset.description}). `
          : '';

        // Cancel any previous request
        abortControllerRef.current?.abort();
        const controller = new AbortController();
        abortControllerRef.current = controller;

        const response = await fetch('/api/analyze-audio', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            audio: base64Data,
            mimeType: blob.type.includes('webm') ? 'audio/webm' : blob.type,
            mode,
            styleContext,
          }),
          signal: controller.signal,
        });

        if (!mountedRef.current) return;

        if (!response.ok) {
          let errorMsg = `Analysis failed (${response.status})`;
          try {
            const errorBody = await response.json();
            errorMsg = errorBody.message || errorMsg;
          } catch {}
          throw new Error(errorMsg);
        }

        const result = await response.json();

        if (!mountedRef.current) return;

        const isInterpolation = mode === 'Interpolation';
        const isHumming = mode === 'Humming';

        if (isHumming) {
          onStatusChange('Humming parsed! Lead, Bass, and Rhythm extracted.');
        } else if (isInterpolation) {
          onStatusChange('Interpolation Complete! New progression generated.');
        } else {
          onStatusChange(`Adapted to ${selectedPreset?.name || result.genre} style.`);
        }

        onAnalysisComplete(result);
      } catch (error: any) {
        if (!mountedRef.current) return;
        if (error.name === 'AbortError') return; // intentional abort

        console.error('Analysis failed', error);
        onStatusChange(error.message || 'Analysis failed. Please try again.');
      } finally {
        if (mountedRef.current) {
          setIsAnalyzing(false);
        }
      }
    },
    [selectedPreset, mode, onAnalysisComplete, onStatusChange, stopListeningIfActive]
  );

  const handleListenToggle = useCallback(async () => {
    if (!isListening) {
      try {
        await audioCapture.start();
        onToggleListen();
        onStatusChange('Listening to track...');
      } catch (err) {
        console.error('Mic access error', err);
        onStatusChange('Microphone access denied.');
      }
    } else {
      // Stop capture first, then update parent and process
      try {
        const audioBlob = await audioCapture.stop();
        onToggleListen();
        onStatusChange('Processing capture...');
        processAudio(audioBlob, true);
      } catch (err: any) {
        console.error('Failed to stop listening', err);
        onToggleListen(); // ensure UI sync
        onStatusChange('Failed to capture audio.');
      }
    }
  }, [isListening, onToggleListen, onStatusChange, processAudio]);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files?.[0]) {
        const file = e.target.files[0];
        const isSpecial = file.name.endsWith('.json') || file.name.endsWith('.zip') || file.name.endsWith('.mid') || file.name.endsWith('.midi');
        if (isSpecial) {
          if (onSpecialFile) {
            onSpecialFile(file);
          }
        } else {
          onSelectedFileChange(file);
        }
      }
    },
    [onSelectedFileChange, onSpecialFile]
  );

  const handleUploadKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLLabelElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        document.getElementById('file-upload')?.click();
      }
    },
    []
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="p-2 rounded-lg"
            style={{
              background: 'rgba(99,102,241,0.1)',
              border: '1px solid rgba(99,102,241,0.15)',
            }}
          >
            <Music className="w-4 h-4 text-studio-accent" />
          </div>
          <div>
            <h3 className="text-sm font-display">
              {mode === 'Interpolation'
                ? 'Harmonic Interpolation'
                : mode === 'Humming'
                ? 'Sonic Parsing'
                : 'Style Adaptation'}
            </h3>
            <p className="text-[9px] font-mono text-studio-muted">
              {mode === 'Interpolation'
                ? 'Generate a legally distinct progression with the same feeling'
                : mode === 'Humming'
                ? 'Hum a melody, bassline, or rhythm to convert to MIDI'
                : selectedPreset
                ? `Adapting "${selectedPreset.name}" to your track`
                : 'Capture audio to adapt session style'}
            </p>
          </div>
        </div>

        <button
          onClick={handleListenToggle}
          disabled={isAnalyzing}
          className={cn(
            'flex items-center gap-2 px-3.5 py-2 rounded-lg font-mono text-[9px] uppercase tracking-wider transition-all cursor-pointer',
            isListening ? 'text-white animate-pulse' : 'text-studio-accent'
          )}
          style={
            isListening
              ? { background: '#ef4444' }
              : {
                  background: 'rgba(99,102,241,0.1)',
                  border: '1px solid rgba(99,102,241,0.2)',
                }
          }
        >
          {isListening ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
          {isListening ? 'Stop Listening' : 'Listen Live'}
        </button>
      </div>

      <div className="flex items-center gap-3">
        {/* Keyboard‑accessible upload area with full Drag & Drop handling */}
        <label
          htmlFor="file-upload"
          tabIndex={0}
          role="button"
          onKeyDown={handleUploadKeyDown}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            'flex-1 cursor-pointer transition-all duration-200 block',
            isAnalyzing && 'pointer-events-none opacity-50',
            isDragging && 'scale-[1.01]'
          )}
        >
          <div
            className={cn(
              "rounded-xl p-4 transition-all flex flex-col items-center justify-center gap-1.5",
              isDragging 
                ? "bg-studio-accent/15 border-studio-accent border-solid shadow-[0_0_15px_rgba(99,102,241,0.2)] animate-pulse" 
                : "border-dashed border-[#222224] hover:border-studio-border/50 hover:bg-white/[0.01]"
            )}
            style={isDragging ? {} : { border: '1px dashed #222224' }}
          >
            <Upload className={cn("w-4 h-4 transition-colors", isDragging ? "text-studio-accent" : "text-studio-muted")} />
            <span className={cn("text-[9px] font-mono transition-colors text-center px-2", isDragging ? "text-studio-accent font-medium" : "text-studio-muted")}>
              {isDragging 
                ? 'Drop audio file here...' 
                : (selectedFile ? selectedFile.name : 'Drag & drop or upload reference audio')}
            </span>
          </div>
          <input
            id="file-upload"
            type="file"
            className="hidden"
            accept="audio/*,.zip,.json,.mid,.midi"
            onChange={handleFileChange}
            disabled={isAnalyzing}
          />
        </label>

        {selectedFile && (
          <button
            onClick={() => processAudio(selectedFile, false)}
            disabled={isAnalyzing}
            className="px-4 py-3 rounded-xl font-mono text-[9px] uppercase tracking-widest hover:scale-105 active:scale-95 transition-all cursor-pointer"
            style={{
              background: 'linear-gradient(180deg, #6366f1 0%, #4f46e5 100%)',
              color: '#ffffff',
            }}
          >
            {isAnalyzing ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Analyze File'}
          </button>
        )}
      </div>

      <AnimatePresence>
        {status && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-2 rounded-md flex items-center gap-2"
            style={{
              background: 'rgba(99,102,241,0.06)',
              border: '1px solid rgba(99,102,241,0.12)',
            }}
          >
            {isAnalyzing ? (
              <Loader2 className="w-3 h-3 animate-spin text-studio-accent" />
            ) : (
              <CheckCircle2 className="w-3 h-3 text-studio-accent" />
            )}
            <span className="text-[9px] font-mono text-studio-accent">{status}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};