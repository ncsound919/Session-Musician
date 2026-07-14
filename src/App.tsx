/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Activity, 
  Music2, 
  Cpu, 
  Waves,
  ChevronRight,
  Volume2,
  Download,
  Keyboard,
  Undo2,
  Redo2,
  Play,
  Square,
  Mic,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Knob } from './components/Knob';
import { InspirationUpload } from './components/InspirationUpload';
import { ChordSequencer } from './components/ChordSequencer';
import { PresetSelector } from './components/PresetSelector';
import { MidiVisualizer } from './components/MidiVisualizer';
import { XYPad } from './components/XYPad';
import { ArrangementView } from './components/ArrangementView';
import { Mixer } from './components/Mixer';
import { DrumKitManager } from './components/DrumKitManager';
import { useUndoRedo } from './hooks/useUndoRedo';
import { 
  InstrumentType, 
  InstrumentState, 
  GENRES, 
  ERAS, 
  VIBES, 
  NOTATION_STYLES, 
  INITIAL_PARAMS,
  INITIAL_SONG,
  Chord,
  StylePreset,
  INSTRUMENT_PLAY_STYLES,
  Song
} from './types';
import { cn } from './lib/utils';
import { audioEngine } from './services/audioEngine';
import { exportMidi } from './services/midiExport';

const INSTRUMENTS: InstrumentType[] = ['Drums', 'Bass', 'Keys', 'Guitar', 'Pads', 'Lead'];

type ContentTab = 'perform' | 'chords' | 'style' | 'inspire';

export default function App() {
  const [activeTab, setActiveTab] = useState<InstrumentType>('Drums');
  const [contentTab, setContentTab] = useState<ContentTab>('perform');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<StylePreset | null>(null);
  const [isChangingParam, setIsChangingParam] = useState(false);

  const { state, set, undo, redo, canUndo, canRedo } = useUndoRedo({
    song: INITIAL_SONG,
    volumes: { Drums: 80, Bass: 75, Keys: 70, Guitar: 65, Pads: 60, Lead: 85 } as Record<InstrumentType, number>,
    instrumentStates: INSTRUMENTS.reduce((acc, type) => ({
      ...acc,
      [type]: { type, enabled: type === 'Drums' || type === 'Bass', params: { ...INITIAL_PARAMS } }
    }), {} as Record<InstrumentType, InstrumentState>),
    mode: 'Plugin' as 'Plugin' | 'Scratch' | 'Interpolation' | 'Humming'
  });

  const { song, volumes, instrumentStates, mode } = state;

  const setSong = (newSong: Song | ((prev: Song) => Song), skipHistory = false) => {
    set(prev => ({
      ...prev,
      song: typeof newSong === 'function' ? newSong(prev.song) : newSong
    }), skipHistory);
  };

  const setVolumes = (newVolumes: Record<InstrumentType, number> | ((prev: Record<InstrumentType, number>) => Record<InstrumentType, number>), skipHistory = false) => {
    set(prev => ({
      ...prev,
      volumes: typeof newVolumes === 'function' ? newVolumes(prev.volumes) : newVolumes
    }), skipHistory);
  };

  const setInstrumentStates = (newStates: Record<InstrumentType, InstrumentState> | ((prev: Record<InstrumentType, InstrumentState>) => Record<InstrumentType, InstrumentState>), skipHistory = false) => {
    set(prev => ({
      ...prev,
      instrumentStates: typeof newStates === 'function' ? newStates(prev.instrumentStates) : newStates
    }), skipHistory);
  };

  const setMode = (newMode: 'Plugin' | 'Scratch' | 'Interpolation' | 'Humming', skipHistory = false) => {
    set(prev => ({ ...prev, mode: newMode }), skipHistory);
  };

  const commitHistory = () => {
    set(prev => prev, false);
  };

  const currentInstrument = instrumentStates[activeTab];

  const updateParam = (key: keyof typeof INITIAL_PARAMS, value: any) => {
    setInstrumentStates(prev => ({
      ...prev,
      [activeTab]: {
        ...prev[activeTab],
        params: { ...prev[activeTab].params, [key]: value }
      }
    }), isChangingParam);
  };

  const toggleInstrument = (type: InstrumentType) => {
    setInstrumentStates(prev => ({
      ...prev,
      [type]: { ...prev[type], enabled: !prev[type].enabled }
    }));
  };

  const handleAnalysis = (analysis: any) => {
    if (analysis.interpolatedChords || analysis.hummedChords) {
      const newChords = analysis.interpolatedChords || analysis.hummedChords;
      setSong(prev => ({
        ...prev,
        sections: prev.sections.map(s => s.id === prev.activeSectionId ? { ...s, chords: newChords } : s)
      }));
      setMode('Scratch');
    }

    if (analysis.hummedMelody) {
      console.log("Hummed Melody Detected:", analysis.hummedMelody);
    }

    setInstrumentStates(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(key => {
        const k = key as InstrumentType;
        next[k] = {
          ...next[k],
          params: {
            ...next[k].params,
            genre: analysis.genre || next[k].params.genre,
            vibe: analysis.vibe || next[k].params.vibe,
            groove: analysis.groove ?? next[k].params.groove,
            sparseness: analysis.sparseness ?? next[k].params.sparseness,
            pocket: analysis.pocket ?? next[k].params.pocket,
          }
        };
      });
      return next;
    });
  };

  const activeSection = song.sections.find(s => s.id === song.activeSectionId) || song.sections[0];

  const updateChords = (newChords: Chord[]) => {
    setSong(prev => ({
      ...prev,
      sections: prev.sections.map(s => s.id === prev.activeSectionId ? { ...s, chords: newChords } : s)
    }));
  };

  const addSection = () => {
    const id = crypto.randomUUID();
    setSong(prev => ({
      ...prev,
      sections: [...prev.sections, { id, name: `Section ${prev.sections.length + 1}`, chords: [...activeSection.chords] }],
      activeSectionId: id
    }));
  };

  const handleExport = () => {
    const enabledParams = Object.fromEntries(
      (Object.entries(instrumentStates) as [InstrumentType, InstrumentState][])
        .filter(([, i]) => i.enabled)
        .map(([type, i]) => [type, i.params])
    );
    exportMidi(activeSection.chords, enabledParams, song.bpm);
  };

  const playPreview = (chord: Chord) => {
    audioEngine.playChord(chord.root, chord.type);
  };

  const applyPreset = (preset: StylePreset) => {
    setSelectedPreset(preset);
    if (preset.instrument === 'All') {
      setInstrumentStates(prev => {
        const next = { ...prev };
        Object.keys(next).forEach(key => {
          const k = key as InstrumentType;
          next[k].params = { ...next[k].params, ...preset.params };
        });
        return next;
      });
    } else {
      setInstrumentStates(prev => ({
        ...prev,
        [preset.instrument as InstrumentType]: {
          ...prev[preset.instrument as InstrumentType],
          params: { ...prev[preset.instrument as InstrumentType].params, ...preset.params }
        }
      }));
    }
  };

  const CONTENT_TABS: { id: ContentTab; label: string; icon: React.ReactNode }[] = [
    { id: 'perform', label: 'Perform', icon: <Activity className="w-3.5 h-3.5" /> },
    { id: 'chords', label: 'Chords', icon: <Music2 className="w-3.5 h-3.5" /> },
    { id: 'style', label: 'Style', icon: <Sparkles className="w-3.5 h-3.5" /> },
    { id: 'inspire', label: 'Inspire', icon: <Waves className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="h-screen w-screen flex items-center justify-center p-3 md:p-6 bg-[#09090b]">
      {/* Main Plugin Window */}
      <div className="w-full max-w-6xl h-full max-h-[850px] panel-glass overflow-hidden flex flex-col">
        
        {/* ═══ Header / Transport ═══ */}
        <div className="h-14 border-b border-studio-border flex items-center justify-between px-5"
          style={{ background: 'linear-gradient(180deg, #18181b 0%, #121214 100%)' }}>
          
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-md flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' }}>
              <Cpu className="w-4 h-4 text-studio-bg" />
            </div>
            <div>
              <h1 className="text-sm font-display tracking-tight">Session Player</h1>
              <span className="text-[9px] font-mono text-studio-muted uppercase tracking-widest">AI MIDI Engine v2.5</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Mode Selector */}
            <div className="flex items-center gap-0.5 p-0.5 rounded-lg" style={{ background: '#0a0a0c', border: '1px solid #222224' }}>
              {(['Plugin', 'Scratch', 'Interpolation', 'Humming'] as const).map(m => (
                <button 
                  key={m}
                  onClick={() => setMode(m)}
                  className={cn(
                    "px-2.5 py-1 rounded-md text-[10px] font-mono uppercase transition-all cursor-pointer",
                    mode === m 
                      ? "text-white font-bold bg-[#6366f1]" 
                      : "text-studio-muted hover:text-studio-text"
                  )}
                  style={mode === m ? { background: 'linear-gradient(180deg, #6366f1 0%, #4f46e5 100%)' } : undefined}
                >
                  {m === 'Interpolation' ? 'Interp.' : m}
                </button>
              ))}
            </div>

            {/* Undo/Redo */}
            <div className="flex items-center gap-0.5">
              <button 
                onClick={undo}
                disabled={!canUndo}
                className={cn(
                  "p-1.5 rounded-md transition-colors cursor-pointer",
                  canUndo ? "text-studio-muted hover:text-studio-accent hover:bg-studio-accent/10" : "text-studio-muted/30 cursor-not-allowed"
                )}
                title="Undo (Ctrl+Z)"
              >
                <Undo2 size={14} />
              </button>
              <button 
                onClick={redo}
                disabled={!canRedo}
                className={cn(
                  "p-1.5 rounded-md transition-colors cursor-pointer",
                  canRedo ? "text-studio-muted hover:text-studio-accent hover:bg-studio-accent/10" : "text-studio-muted/30 cursor-not-allowed"
                )}
                title="Redo (Ctrl+Shift+Z)"
              >
                <Redo2 size={14} />
              </button>
            </div>

            <div className="w-px h-6 bg-studio-border" />

            {/* Transport Controls */}
            <div className="flex items-center gap-1 p-0.5 rounded-lg" style={{ background: '#0a0a0c', border: '1px solid #222224' }}>
              <button 
                onClick={() => setIsPlaying(!isPlaying)}
                className={cn(
                  "p-2 rounded-md transition-all cursor-pointer",
                  isPlaying ? "text-white" : "text-studio-muted hover:text-studio-text"
                )}
                style={isPlaying ? { background: 'linear-gradient(180deg, #6366f1 0%, #4f46e5 100%)' } : undefined}
              >
                {isPlaying ? <Square className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
              </button>
              <button 
                onClick={() => setIsListening(!isListening)}
                className={cn(
                  "p-2 rounded-md transition-all flex items-center gap-1.5 px-2.5 cursor-pointer",
                  isListening ? "text-white" : "text-studio-muted hover:text-studio-text"
                )}
                style={isListening ? { background: '#ef4444' } : undefined}
              >
                <Mic className="w-3.5 h-3.5" />
                <span className="text-[9px] font-mono uppercase font-bold">Rec</span>
              </button>
            </div>

            <div className="w-px h-6 bg-studio-border" />

            {/* BPM / Key */}
            <div className="flex items-center gap-3">
              <div className="flex flex-col items-center">
                <span className="text-[8px] font-mono text-studio-muted uppercase tracking-wider">BPM</span>
                <input 
                  type="number" 
                  value={song.bpm} 
                  onChange={(e) => setSong(prev => ({ ...prev, bpm: parseInt(e.target.value) || 120 }))}
                  className="bg-transparent text-center w-10 text-sm font-mono focus:outline-none text-studio-accent"
                />
              </div>
              <div className="flex flex-col items-center">
                <span className="text-[8px] font-mono text-studio-muted uppercase tracking-wider">Key</span>
                <select 
                  value={song.key}
                  onChange={(e) => setSong(prev => ({ ...prev, key: e.target.value }))}
                  className="bg-transparent text-center text-sm font-mono focus:outline-none text-studio-accent"
                >
                  {['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].map(k => <option key={k} value={k}>{k}</option>)}
                </select>
              </div>
            </div>

            {/* Export */}
            <button 
              onClick={handleExport}
              className="btn-vintage p-2 rounded-md text-studio-muted hover:text-studio-accent cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* ═══ Main Content Area ═══ */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* ── Left Sidebar: Instruments ── */}
          <div className="w-44 border-r border-studio-border flex flex-col" style={{ background: 'linear-gradient(180deg, #121214 0%, #0d0d0e 100%)' }}>
            <div className="px-4 py-3 border-b border-studio-border">
              <span className="text-[9px] font-mono text-studio-muted uppercase tracking-[0.2em]">Instruments</span>
            </div>
            <div className="flex-1 overflow-y-auto py-1">
              {INSTRUMENTS.map(type => (
                <button
                  key={type}
                  onClick={() => setActiveTab(type)}
                  className={cn(
                    "w-full px-4 py-2.5 flex items-center justify-between group transition-all cursor-pointer",
                    activeTab === type ? "border-r-2 border-studio-accent" : "hover:bg-white/3"
                  )}
                  style={activeTab === type ? { background: 'linear-gradient(90deg, transparent 0%, rgba(99,102,241,0.08) 100%)' } : undefined}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      role="switch"
                      aria-checked={instrumentStates[type].enabled}
                      aria-label={`Toggle ${type}`}
                      tabIndex={0}
                      onClick={(e) => { e.stopPropagation(); toggleInstrument(type); }}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); toggleInstrument(type); } }}
                      className={cn(
                        "w-2 h-2 rounded-full transition-all cursor-pointer",
                        instrumentStates[type].enabled ? "bg-studio-accent led-on" : "bg-studio-border"
                      )}
                    />
                    <span className={cn(
                      "text-[11px] font-mono uppercase tracking-wider",
                      activeTab === type ? "text-studio-accent" : "text-studio-muted group-hover:text-studio-text"
                    )}>{type}</span>
                  </div>
                  <ChevronRight className={cn(
                    "w-3 h-3 transition-all",
                    activeTab === type ? "text-studio-accent opacity-100" : "text-studio-muted opacity-0 group-hover:opacity-40"
                  )} />
                </button>
              ))}
            </div>
            
            {/* Compact Mixer in Sidebar */}
            <div className="border-t border-studio-border p-3 space-y-2">
              <span className="text-[8px] font-mono text-studio-muted uppercase tracking-[0.2em]">Levels</span>
              <div className="space-y-1.5">
                {INSTRUMENTS.map(type => (
                  <div key={type} className="flex items-center gap-2 group relative">
                    <span className={cn(
                      "text-[8px] font-mono uppercase w-5",
                      instrumentStates[type].enabled ? "text-studio-muted" : "text-studio-muted/40"
                    )}>{type.substring(0, 3)}</span>
                    <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: '#0a0a0c' }}>
                      <div 
                        className="h-full rounded-full transition-all duration-200"
                        style={{ 
                          width: `${volumes[type]}%`,
                          background: volumes[type] > 85 ? '#ef4444' : volumes[type] > 60 ? '#6366f1' : '#22c55e'
                        }}
                      />
                    </div>
                    <input 
                      type="range" 
                      min="0" 
                      max="100" 
                      aria-label={`${type} volume`}
                      value={volumes[type]}
                      onChange={(e) => setVolumes(prev => ({ ...prev, [type]: parseInt(e.target.value) }), isChangingParam)}
                      onMouseDown={() => setIsChangingParam(true)}
                      onMouseUp={() => { setIsChangingParam(false); commitHistory(); }}
                      onTouchStart={() => setIsChangingParam(true)}
                      onTouchEnd={() => { setIsChangingParam(false); commitHistory(); }}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Main Panel ── */}
          <div className="flex-1 flex flex-col bg-studio-panel/30">
            
            {/* Instrument Header + Content Tab Bar */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-studio-border">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center"
                   style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(99,102,241,0.05) 100%)', border: '1px solid rgba(99,102,241,0.2)' }}>
                  <Music2 className="w-4.5 h-4.5 text-studio-accent" />
                </div>
                <div>
                  <h2 className="text-base font-display">{activeTab}</h2>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => toggleInstrument(activeTab)}
                      className={cn(
                        "text-[9px] font-mono uppercase px-1.5 py-0.5 rounded transition-all cursor-pointer",
                        currentInstrument.enabled 
                          ? "bg-studio-accent/15 text-studio-accent" 
                          : "bg-studio-border/50 text-studio-muted"
                      )}
                      style={currentInstrument.enabled ? { border: '1px solid rgba(99,102,241,0.3)' } : { border: '1px solid #222224' }}
                    >
                      {currentInstrument.enabled ? 'Active' : 'Bypassed'}
                    </button>
                    <select 
                      value={currentInstrument.params.playStyle}
                      onChange={(e) => updateParam('playStyle', e.target.value)}
                      className="bg-transparent text-[9px] font-mono text-studio-muted focus:outline-none cursor-pointer"
                    >
                      {INSTRUMENT_PLAY_STYLES[activeTab].map(style => (
                        <option key={style} value={style} className="bg-[#121214] text-studio-text">{style}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Content Tab Bar */}
              <div className="flex items-center gap-0.5 p-0.5 rounded-lg" style={{ background: '#0a0a0c', border: '1px solid #222224' }}>
                {CONTENT_TABS.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setContentTab(tab.id)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-mono uppercase tracking-wide transition-all cursor-pointer",
                      contentTab === tab.id 
                        ? "text-white font-bold bg-[#6366f1]" 
                        : "text-studio-muted hover:text-studio-text"
                    )}
                    style={contentTab === tab.id ? { background: 'linear-gradient(180deg, #6366f1 0%, #4f46e5 100%)' } : undefined}
                  >
                    {tab.icon}
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Tab Content ── */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              <AnimatePresence mode="wait">
                
                {/* ═══ PERFORM TAB ═══ */}
                {contentTab === 'perform' && (
                  <motion.div 
                    key="perform"
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                    className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-6"
                  >
                    {/* Left: MIDI Viz + Sound Preview */}
                    <div className="space-y-5">
                      <MidiVisualizer 
                        isPlaying={isPlaying} 
                        instrumentType={activeTab}
                        groove={currentInstrument.params.groove}
                        density={currentInstrument.params.sparseness}
                      />

                      {mode === 'Scratch' && (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] font-mono text-studio-muted uppercase tracking-[0.15em]">Sound Preview</span>
                            <Keyboard className="w-3.5 h-3.5 text-studio-accent" />
                          </div>
                          <div className="grid grid-cols-4 gap-2">
                            {activeSection.chords.map((chord, i) => (
                              <button
                                key={i}
                                onClick={() => playPreview(chord)}
                                className="btn-vintage aspect-square rounded-lg flex flex-col items-center justify-center group cursor-pointer"
                              >
                                <span className="text-sm font-mono font-bold group-hover:text-studio-accent transition-colors">{chord.root}</span>
                                <span className="text-[8px] font-mono text-studio-muted">{chord.type}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {activeTab === 'Drums' && (
                        <DrumKitManager 
                          currentKit={currentInstrument.customKit}
                          onUpdateKit={(kit) => {
                            setInstrumentStates(prev => ({
                              ...prev,
                              Drums: { ...prev.Drums, customKit: kit }
                            }));
                          }}
                        />
                      )}
                    </div>

                    {/* Right: Knobs + XY Pad */}
                    <div className="panel-inset p-5 flex flex-col gap-6">
                      <span className="text-[9px] font-mono text-studio-muted uppercase tracking-[0.15em]">Performance Controls</span>
                      
                      <div className="grid grid-cols-2 gap-y-6 gap-x-4 place-items-center">
                        <Knob 
                          label="Groove" 
                          value={currentInstrument.params.groove} 
                          onChange={(val) => updateParam('groove', val)} 
                          onStart={() => setIsChangingParam(true)}
                          onEnd={() => { setIsChangingParam(false); commitHistory(); }}
                        />
                        <Knob 
                          label="Density" 
                          value={currentInstrument.params.sparseness} 
                          onChange={(val) => updateParam('sparseness', val)} 
                          onStart={() => setIsChangingParam(true)}
                          onEnd={() => { setIsChangingParam(false); commitHistory(); }}
                        />
                        <Knob 
                          label="Pocket" 
                          value={currentInstrument.params.pocket} 
                          onChange={(val) => updateParam('pocket', val)} 
                          onStart={() => setIsChangingParam(true)}
                          onEnd={() => { setIsChangingParam(false); commitHistory(); }}
                        />
                        <Knob 
                          label="Humanize" 
                          value={currentInstrument.params.humanize} 
                          onChange={(val) => updateParam('humanize', val)} 
                          onStart={() => setIsChangingParam(true)}
                          onEnd={() => { setIsChangingParam(false); commitHistory(); }}
                        />
                      </div>

                      <div className="border-t border-studio-border pt-5">
                        <XYPad 
                          labelX="Groove" 
                          labelY="Density" 
                          valueX={currentInstrument.params.groove}
                          valueY={currentInstrument.params.sparseness}
                          onChange={(x, y) => {
                            updateParam('groove', x);
                            updateParam('sparseness', y);
                          }}
                          onStart={() => setIsChangingParam(true)}
                          onEnd={() => { setIsChangingParam(false); commitHistory(); }}
                        />
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* ═══ CHORDS TAB ═══ */}
                {contentTab === 'chords' && (
                  <motion.div 
                    key="chords"
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                    className="p-5 space-y-6"
                  >
                    <ArrangementView 
                      sections={song.sections} 
                      activeSectionId={song.activeSectionId}
                      onSelectSection={(id) => setSong(prev => ({ ...prev, activeSectionId: id }))}
                      onAddSection={addSection}
                    />

                    <ChordSequencer 
                      chords={activeSection.chords} 
                      onChange={updateChords} 
                    />

                    {/* Chord Sound Preview */}
                    <div className="space-y-3">
                      <span className="text-[9px] font-mono text-studio-muted uppercase tracking-[0.15em]">Quick Preview</span>
                      <div className="flex gap-2 flex-wrap">
                        {activeSection.chords.map((chord, i) => (
                          <button
                            key={i}
                            onClick={() => playPreview(chord)}
                            className="btn-vintage px-3 py-2 rounded-lg flex items-center gap-2 group cursor-pointer"
                          >
                            <span className="text-xs font-mono font-bold group-hover:text-studio-accent transition-colors">{chord.root}{chord.type}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* ═══ STYLE TAB ═══ */}
                {contentTab === 'style' && (
                  <motion.div 
                    key="style"
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                    className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-6"
                  >
                    {/* Left: Presets */}
                    <div className="space-y-5">
                      <PresetSelector 
                        currentInstrument={activeTab} 
                        onSelect={applyPreset} 
                      />
                    </div>

                    {/* Right: Style selectors */}
                    <div className="space-y-5">
                      {mode !== 'Scratch' && (
                        <>
                          <div className="space-y-3">
                            <span className="text-[9px] font-mono text-studio-muted uppercase tracking-[0.15em] flex items-center gap-2">
                              <Waves className="w-3 h-3" /> Core Style
                            </span>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1.5">
                                <span className="text-[8px] font-mono text-studio-muted uppercase">Genre</span>
                                <select 
                                  value={currentInstrument.params.genre}
                                  onChange={(e) => updateParam('genre', e.target.value)}
                                  className="w-full bg-black/40 border border-studio-border rounded-md p-2 text-xs font-mono text-studio-text outline-none focus:border-studio-accent/50 cursor-pointer"
                                >
                                  {GENRES.map(g => <option key={g} value={g} className="bg-[#121214] text-studio-text">{g}</option>)}
                                </select>
                              </div>
                              <div className="space-y-1.5">
                                <span className="text-[8px] font-mono text-studio-muted uppercase">Era</span>
                                <select 
                                  value={currentInstrument.params.era}
                                  onChange={(e) => updateParam('era', e.target.value)}
                                  className="w-full bg-black/40 border border-studio-border rounded-md p-2 text-xs font-mono text-studio-text outline-none focus:border-studio-accent/50 cursor-pointer"
                                >
                                  {ERAS.map(e => <option key={e} value={e} className="bg-[#121214] text-studio-text">{e}</option>)}
                                </select>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-3">
                            <span className="text-[9px] font-mono text-studio-muted uppercase tracking-[0.15em] flex items-center gap-2">
                              <Activity className="w-3 h-3" /> Character
                            </span>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1.5">
                                <span className="text-[8px] font-mono text-studio-muted uppercase">Vibe</span>
                                <select 
                                  value={currentInstrument.params.vibe}
                                  onChange={(e) => updateParam('vibe', e.target.value)}
                                  className="w-full bg-black/40 border border-studio-border rounded-md p-2 text-xs font-mono text-studio-text outline-none focus:border-studio-accent/50 cursor-pointer"
                                >
                                  {VIBES.map(v => <option key={v} value={v} className="bg-[#121214] text-studio-text">{v}</option>)}
                                </select>
                              </div>
                              <div className="space-y-1.5">
                                <span className="text-[8px] font-mono text-studio-muted uppercase">Notation</span>
                                <select 
                                  value={currentInstrument.params.notationStyle}
                                  onChange={(e) => updateParam('notationStyle', e.target.value)}
                                  className="w-full bg-black/40 border border-studio-border rounded-md p-2 text-xs font-mono text-studio-text outline-none focus:border-studio-accent/50 cursor-pointer"
                                >
                                  {NOTATION_STYLES.map(s => <option key={s} value={s} className="bg-[#121214] text-studio-text">{s}</option>)}
                                </select>
                              </div>
                            </div>
                          </div>
                        </>
                      )}

                      {mode === 'Scratch' && (
                        <div className="panel-inset p-5 flex flex-col items-center justify-center gap-4 min-h-[200px]">
                          <Sparkles className="w-6 h-6 text-studio-accent/50" />
                          <p className="text-xs font-mono text-studio-muted text-center max-w-xs">
                            Style selectors are available in Plugin, Interpolation, and Humming modes. Switch modes above to access them.
                          </p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}

                {/* ═══ INSPIRE TAB ═══ */}
                {contentTab === 'inspire' && (
                  <motion.div 
                    key="inspire"
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                    className="p-5"
                  >
                    <InspirationUpload 
                      onAnalysisComplete={handleAnalysis} 
                      selectedPreset={selectedPreset}
                      isListening={isListening}
                      onToggleListen={() => setIsListening(!isListening)}
                      mode={mode}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* ═══ Mixer Bar ═══ */}
        <Mixer 
          instrumentVolumes={volumes} 
          onVolumeChange={(type, vol) => setVolumes(prev => ({ ...prev, [type]: vol }), isChangingParam)} 
          onStart={() => setIsChangingParam(true)}
          onEnd={() => {
            setIsChangingParam(false);
            commitHistory();
          }}
        />

        {/* ═══ Status Bar ═══ */}
        <div className="h-8 border-t border-studio-border flex items-center justify-between px-5" style={{ background: '#0a0a0c' }}>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-studio-green led-on" />
              <span className="text-[8px] font-mono text-studio-muted uppercase tracking-wider">Engine Ready</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Volume2 className="w-3 h-3 text-studio-muted" />
              <div className="w-16 h-1 rounded-full overflow-hidden" style={{ background: '#1a1a1c' }}>
                <div className="w-2/3 h-full bg-studio-accent rounded-full" />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-[8px] font-mono text-studio-muted uppercase">CPU: 12%</span>
            <span className="text-[8px] font-mono text-studio-muted uppercase">Latency: 2.4ms</span>
          </div>
        </div>

      </div>

      {/* Background Glow */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none opacity-15">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 blur-[120px] rounded-full animate-pulse" style={{ background: 'rgba(99,102,241,0.15)' }} />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 blur-[120px] rounded-full animate-pulse delay-700" style={{ background: 'rgba(124,58,237,0.1)' }} />
      </div>
    </div>
  );
}
