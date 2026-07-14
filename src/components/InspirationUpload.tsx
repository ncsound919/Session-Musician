/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
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
}

export const InspirationUpload: React.FC<InspirationUploadProps> = ({ 
  onAnalysisComplete, 
  selectedPreset,
  isListening,
  onToggleListen,
  mode
}) => {
  const [isAnalyzing, setIsAnalyzing] = React.useState(false);
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [status, setStatus] = React.useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const processAudio = async (blob: Blob, isLive: boolean) => {
    setIsAnalyzing(true);
    setStatus(isLive ? "Analyzing live input..." : "Analyzing file...");

    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onload = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
      });
      reader.readAsDataURL(blob);
      const base64Data = await base64Promise;

      const styleContext = selectedPreset 
        ? `The user has selected the style: "${selectedPreset.name}" (${selectedPreset.description}). `
        : "";

      const response = await fetch('/api/analyze-audio', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          audio: base64Data,
          mimeType: blob.type.includes('webm') ? 'audio/webm' : blob.type,
          mode,
          styleContext
        })
      });

      if (!response.ok) {
        throw new Error('Analysis request failed');
      }

      const result = await response.json();
      
      const isInterpolation = mode === 'Interpolation';
      const isHumming = mode === 'Humming';

      if (isHumming) {
        setStatus("Humming parsed! Lead, Bass, and Rhythm extracted.");
      } else if (isInterpolation) {
        setStatus("Interpolation Complete! New progression generated.");
      } else {
        setStatus(`Adapted to ${selectedPreset?.name || result.genre} style.`);
      }
      onAnalysisComplete(result);
    } catch (error) {
      console.error("Analysis failed", error);
      setStatus("Analysis failed. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleListenToggle = async () => {
    if (!isListening) {
      try {
        await audioCapture.start();
        onToggleListen();
        setStatus("Listening to track...");
      } catch (err) {
        setStatus("Microphone access denied.");
      }
    } else {
      onToggleListen();
      setStatus("Processing capture...");
      try {
        const audioBlob = await audioCapture.stop();
        processAudio(audioBlob, true);
      } catch (err) {
        setStatus(`Failed to process audio: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg" style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.15)' }}>
            <Music className="w-4 h-4 text-studio-accent" />
          </div>
          <div>
            <h3 className="text-sm font-display">
              {mode === 'Interpolation' ? 'Harmonic Interpolation' : mode === 'Humming' ? 'Sonic Parsing' : 'Style Adaptation'}
            </h3>
            <p className="text-[9px] font-mono text-studio-muted">
              {mode === 'Interpolation' 
                ? 'Generate a legally distinct progression with the same feeling' 
                : mode === 'Humming' ? 'Hum a melody, bassline, or rhythm to convert to MIDI' : selectedPreset ? `Adapting "${selectedPreset.name}" to your track` : "Capture audio to adapt session style"}
            </p>
          </div>
        </div>

        <button
          onClick={handleListenToggle}
          disabled={isAnalyzing}
          className={cn(
            "flex items-center gap-2 px-3.5 py-2 rounded-lg font-mono text-[9px] uppercase tracking-wider transition-all cursor-pointer",
            isListening 
              ? "text-white animate-pulse" 
              : "text-studio-accent"
          )}
          style={isListening 
            ? { background: '#ef4444' } 
            : { background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)' }
          }
        >
          {isListening ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
          {isListening ? "Stop Listening" : "Listen Live"}
        </button>
      </div>

      <div className="flex items-center gap-3">
        <label className="flex-1 cursor-pointer">
          <div className="rounded-xl p-3 transition-colors flex flex-col items-center justify-center gap-1"
            style={{ border: '1px dashed #222224' }}>
            <Upload className="w-3.5 h-3.5 text-studio-muted" />
            <span className="text-[9px] font-mono text-studio-muted">
              {selectedFile ? selectedFile.name : "Or upload reference audio"}
            </span>
          </div>
          <input type="file" className="hidden" accept="audio/*" onChange={handleFileChange} />
        </label>

        {selectedFile && (
          <button
            onClick={() => processAudio(selectedFile, false)}
            disabled={isAnalyzing}
            className="px-4 py-3 rounded-xl font-mono text-[9px] uppercase tracking-widest hover:scale-105 active:scale-95 transition-all cursor-pointer"
            style={{ background: 'linear-gradient(180deg, #6366f1 0%, #4f46e5 100%)', color: '#ffffff' }}
          >
            {isAnalyzing ? <Loader2 className="w-3 h-3 animate-spin" /> : "Analyze File"}
          </button>
        )}
      </div>

      <AnimatePresence>
        {status && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-2 rounded-md flex items-center gap-2"
            style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.12)' }}
          >
            {isAnalyzing ? <Loader2 className="w-3 h-3 animate-spin text-studio-accent" /> : <CheckCircle2 className="w-3 h-3 text-studio-accent" />}
            <span className="text-[9px] font-mono text-studio-accent">{status}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
