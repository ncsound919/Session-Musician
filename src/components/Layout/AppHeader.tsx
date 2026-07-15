/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { 
  Play, 
  Square, 
  Mic,
  Undo2,
  Redo2,
  Save,
  Cloud
} from 'lucide-react';
import { cn } from '../../lib/utils';

interface AppHeaderProps {
  isPlaying: boolean;
  isListening: boolean;
  onPlayToggle: () => void;
  onListenToggle: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  bpm: number;
  songKey: string;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  isPlaying,
  isListening,
  onPlayToggle,
  onListenToggle,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  bpm,
  songKey,
  saveStatus
}) => {
  return (
    <header className="h-16 bg-studio-card border-b border-studio-border flex items-center justify-between px-8 z-10">
      <div className="flex items-center gap-8">
        <div className="flex items-center gap-2">
          <button 
            onClick={onPlayToggle}
            className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center transition-all",
              isPlaying 
                ? "bg-red-500 hover:bg-red-600 shadow-[0_0_20px_rgba(239,68,68,0.4)]" 
                : "bg-studio-accent hover:bg-studio-accent-light shadow-[0_0_20px_rgba(var(--studio-accent-rgb),0.4)]"
            )}
          >
            {isPlaying ? <Square className="w-5 h-5 text-white" /> : <Play className="w-5 h-5 text-white ml-1" />}
          </button>
          <button 
            onClick={onListenToggle}
            className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center transition-all",
              isListening 
                ? "bg-red-500/20 border border-red-500/50 text-red-500 animate-pulse" 
                : "bg-white/5 border border-studio-border text-studio-muted hover:text-white"
            )}
          >
            <Mic className="w-5 h-5" />
          </button>
        </div>

        <div className="h-10 w-px bg-studio-border" />

        <div className="flex items-center gap-6">
          <div className="flex flex-col">
            <span className="text-[9px] font-mono text-studio-muted uppercase tracking-widest">Tempo</span>
            <span className="text-sm font-bold text-white font-mono">{bpm} BPM</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] font-mono text-studio-muted uppercase tracking-widest">Key</span>
            <span className="text-sm font-bold text-white font-mono">{songKey} Major</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <button 
            onClick={onUndo}
            disabled={!canUndo}
            className="p-2 text-studio-muted hover:text-white disabled:opacity-20 transition-colors"
          >
            <Undo2 className="w-5 h-5" />
          </button>
          <button 
            onClick={onRedo}
            disabled={!canRedo}
            className="p-2 text-studio-muted hover:text-white disabled:opacity-20 transition-colors"
          >
            <Redo2 className="w-5 h-5" />
          </button>
        </div>

        <div className="h-10 w-px bg-studio-border" />

        <div className="flex items-center gap-3 bg-black/20 rounded-full px-4 py-1.5 border border-studio-border/50">
          {saveStatus === 'saving' ? (
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 border-2 border-studio-accent border-t-transparent rounded-full animate-spin" />
              <span className="text-[9px] font-mono text-studio-muted uppercase">Syncing...</span>
            </div>
          ) : saveStatus === 'saved' ? (
            <div className="flex items-center gap-2">
              <Cloud className="w-3 h-3 text-green-500" />
              <span className="text-[9px] font-mono text-green-500 uppercase">Cloud Stored</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Save className="w-3 h-3 text-studio-muted" />
              <span className="text-[9px] font-mono text-studio-muted uppercase">Autosave Active</span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
