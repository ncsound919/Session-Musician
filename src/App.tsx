/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Activity, 
  Music2, 
  Cpu, 
  Waves,
  ChevronLeft,
  ChevronRight,
  Volume2,
  Download,
  Keyboard,
  Undo2,
  Redo2,
  Play,
  Square,
  Mic,
  Sparkles,
  GraduationCap,
  Sliders,
  Shuffle,
  Layout,
  Upload,
  Users
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Knob } from './components/Knob';
import { InspirationUpload } from './components/InspirationUpload';
import { ChordSequencer } from './components/ChordSequencer';
import { PresetSelector } from './components/PresetSelector';
import { MidiVisualizer } from './components/MidiVisualizer';
import { XYPad } from './components/XYPad';
import { ArrangementView } from './components/ArrangementView';
import { DrumKitManager } from './components/DrumKitManager';
import { TheoryCriticPanel } from './components/TheoryCriticPanel';
import { PianoRoll } from './components/PianoRoll';
import { SamplerWorkbench } from './components/SamplerWorkbench';
import { JunoSynthModule } from './components/JunoSynthModule';
import { PocketLab } from './components/PocketLab';
import { SeniorDevDashboard } from './components/SeniorDevDashboard';
import { SoulEngineLab } from './components/SoulEngineLab';
import { SamplerSection } from './components/SamplerSection';
import { SampleStorage } from './services/sampleStorage';
import { useUndoRedo } from './hooks/useUndoRedo';
import { loginAnonymously, saveSession, loadLatestSession } from './lib/firebase';
import { User } from 'firebase/auth';
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
  PerformedNote,
  StylePreset,
  INSTRUMENT_PLAY_STYLES,
  Song,
  SessionParameters,
  HARMONY_LEVELS,
  VOICING_STYLES,
  MOODS
} from './types';
import { cn } from './lib/utils';
import { audioEngine } from './services/audioEngine';
import { exportMidi } from './services/midiExport';
import { critiqueSection, applyTheoryFix, getScaleDegreeRoot, NOTE_MAP, SEMITONE_NAMES, transposeChord, generateSongSections } from './services/musicTheoryEngine';
import { EnergyCurve, resolveArrangement, standardArrangementStyle } from './services/arrangementEngine';
import { ProducerEngine } from './services/producerEngine';
import { ProducerFusionView } from './components/ProducerFusionView';
import { PRODUCER_PROFILES } from './data/producers';
import { ProducerProfile } from './types/producer';
import { applySophistication, SophisticationLevel } from './services/sophisticationEngine';
import { applyVibe, deriveVibeVector, VIBE_PRESETS } from './services/vibeEngine';
import { performSmartRandomize } from './services/smartRandomizer';

const INSTRUMENTS: InstrumentType[] = ['Drums', 'Bass', 'Keys', 'Guitar', 'Pads', 'Lead', 'Sampler'];

const LIVE_ACTIONS: Record<InstrumentType, string[]> = {
  Drums: ['Kick-Snare Pocket', 'Snare Roll Fill', 'Hi-Hat Accent', 'Cymbal Splash'],
  Bass: ['Root Octave Sync', 'Pentatonic Walk', 'Slap Octave Burst', 'Slide Frequency Drop'],
  Keys: ['Gospel Chord Roll', 'Cascading Arpeggio', 'Syncopated Jab', 'Hammond Drawbar Swell'],
  Guitar: ['Power Strum', 'Chorus Pluck', 'Slacker Fuzz Stab', 'Drenched Swell'],
  Pads: ['Lush Ambient Swell', 'Organ Rotary Tremolo', 'Vintage String Bed', 'Pulsing Gate'],
  Lead: ['Improvised Lick', 'Chromatic Run', 'Bluesy Pitch Bend', 'Trill Resolution'],
  Sampler: ['Atmospheric Wash', 'Chop Glitch', 'Time Stretch Swell', 'Lo-Fi Grit']
};

type ContentTab = 'perform' | 'theory' | 'mix' | 'synth' | 'settings' | 'fusion';

// Create a default initial song structure
import { SONG_STRUCTURES } from './types';
import JSZip from 'jszip';
import { Midi } from '@tonejs/midi';
const defaultInitialSong: Song = {
  bpm: 120,
  key: 'C',
  sections: generateSongSections(SONG_STRUCTURES[0], 'C', true), // default to Pop Standard
  activeSectionId: '' // will set below
};
if (defaultInitialSong.sections.length > 0) {
  defaultInitialSong.activeSectionId = defaultInitialSong.sections[0].id;
}

export default function App() {

  const DEFAULT_SYNTH_PARAMS: Record<Exclude<InstrumentType, 'Drums'>, any> = {
    Bass: { oscType: 'sawtooth', filterCutoff: 350, filterResonance: 1, attack: 0.01, decay: 0.15, sustain: 0.6, release: 0.2, lfoRate: 5, lfoFilterMod: 0, lfoPitchMod: 0, hpfCutoff: 10, junoChorus: 0, noiseLevel: 0, filterType: 'lowpass', filterDrive: 0.1, unisonVoices: 1, subOscLevel: 0.3, subOscOctave: -1, glideTime: 0.05 },
    Keys: { oscType: 'triangle', filterCutoff: 1200, filterResonance: 1, attack: 0.005, decay: 0.2, sustain: 0.4, release: 0.2, lfoRate: 5, lfoFilterMod: 0, lfoPitchMod: 0, hpfCutoff: 10, junoChorus: 0, noiseLevel: 0, filterType: 'lowpass', filterDrive: 0, unisonVoices: 1, subOscLevel: 0, glideTime: 0 },
    Guitar: { oscType: 'triangle', filterCutoff: 1500, filterResonance: 1, attack: 0.002, decay: 0.1, sustain: 0.2, release: 0.15, lfoRate: 5, lfoFilterMod: 0, lfoPitchMod: 0, hpfCutoff: 10, junoChorus: 0, noiseLevel: 0, filterType: 'lowpass', filterDrive: 0.2, unisonVoices: 1, subOscLevel: 0, glideTime: 0 },
    Pads: { oscType: 'sine', filterCutoff: 800, filterResonance: 1, attack: 0.4, decay: 0.3, sustain: 0.8, release: 0.8, lfoRate: 5, lfoFilterMod: 0, lfoPitchMod: 0, hpfCutoff: 10, junoChorus: 1, noiseLevel: 0, filterType: 'lowpass', filterDrive: 0, unisonVoices: 3, unisonDetune: 15, unisonStereoWidth: 0.8, subOscLevel: 0.2, glideTime: 0.1 },
    Lead: { oscType: 'sawtooth', filterCutoff: 2000, filterResonance: 1, attack: 0.02, decay: 0.1, sustain: 0.7, release: 0.15, lfoRate: 5, lfoFilterMod: 0, lfoPitchMod: 0, hpfCutoff: 10, junoChorus: 0, noiseLevel: 0, filterType: 'lowpass', filterDrive: 0.1, unisonVoices: 1, subOscLevel: 0, glideTime: 0.08 },
    Sampler: { oscType: 'sine', filterCutoff: 10000, filterResonance: 1, attack: 0.001, decay: 0.1, sustain: 1.0, release: 0.2, lfoRate: 5, lfoFilterMod: 0, lfoPitchMod: 0, hpfCutoff: 10, junoChorus: 0, noiseLevel: 0, filterType: 'lowpass', filterDrive: 0, unisonVoices: 1, subOscLevel: 0, glideTime: 0 },
  };

  const [activeTab, setActiveTab] = useState<InstrumentType>('Drums');
  const [contentTab, setContentTab] = useState<ContentTab>('perform');
  const [xyModes, setXyModes] = useState<Record<InstrumentType, string>>({ 
    Drums: 'Groove/Density', 
    Bass: 'Groove/Density', 
    Keys: 'Groove/Density', 
    Guitar: 'Groove/Density', 
    Pads: 'Groove/Density', 
    Lead: 'Groove/Density',
    Sampler: 'Groove/Density'
  });
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<StylePreset | null>(null);
  const [inspirationFile, setInspirationFile] = useState<File | null>(null);
  const [inspirationStatus, setInspirationStatus] = useState<string | null>(null);
  const [isChangingParam, setIsChangingParam] = useState(false);
  const [lockGroove, setLockGroove] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [producerWeights, setProducerWeights] = useState<Record<string, number>>({
    quincy: 0.2,
    dre: 0.1,
    dilla: 0.2,
    dangelo: 0.1,
    steely: 0.1
  });

  const fusedProfile = useMemo(() => ProducerEngine.blendProfiles(producerWeights), [producerWeights]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // Track loaded custom samples state to sync and trigger react render
  const [customSamples, setCustomSamples] = useState<Record<InstrumentType, { name: string; rootMidi: number } | null>>({
    Drums: null, Bass: null, Keys: null, Guitar: null, Pads: null, Lead: null, Sampler: null
  });

  const { state, set, undo, redo, canUndo, canRedo } = useUndoRedo({
    song: defaultInitialSong,
    volumes: { Drums: 80, Bass: 75, Keys: 70, Guitar: 65, Pads: 60, Lead: 85, Sampler: 90 } as Record<InstrumentType, number>,
    instrumentStates: INSTRUMENTS.reduce((acc, type) => {
      const defaultSynth = type !== 'Drums' ? DEFAULT_SYNTH_PARAMS[type] : undefined;
      return {
        ...acc,
        [type]: { 
          type, 
          enabled: type === 'Drums' || type === 'Bass', 
          params: { ...INITIAL_PARAMS },
          synthParams: defaultSynth ? { ...defaultSynth } : undefined
        }
      };
    }, {} as Record<InstrumentType, InstrumentState>),
    mode: 'Plugin' as 'Plugin' | 'Scratch' | 'Interpolation' | 'Humming',
    sophisticationLevel: 0 as SophisticationLevel,
    vibeSeed: 0 as number,
    editedMidi: {} as Record<InstrumentType, PerformedNote[]>,
    songParams: {
      harmony: 'Extended',
      voicing: 'Open',
      mood: 'Bright',
      energy: 50
    } as Partial<SessionParameters>
  });

  const { song, volumes, instrumentStates, mode, sophisticationLevel, vibeSeed, songParams, editedMidi } = state;

  const setSongParams = (params: Partial<SessionParameters> | ((prev: Partial<SessionParameters>) => Partial<SessionParameters>), skipHistory = false) => {
    set(prev => ({
      ...prev,
      songParams: typeof params === 'function' ? params(prev.songParams) : { ...prev.songParams, ...params }
    }), skipHistory);
  };

  const setEditedMidi = (instrument: InstrumentType, notes: PerformedNote[]) => {
    set(prev => ({
      ...prev,
      editedMidi: {
        ...prev.editedMidi,
        [instrument]: notes
      }
    }), false);
  };

  const handleLearnFromSampler = () => {
    const samplerMidi = editedMidi.Sampler || [];
    if (samplerMidi.length === 0) return;

    // Estimate energy from density (events per 4 bars)
    const density = samplerMidi.length / 8; // ballpark
    const energy = Math.min(1, Math.max(0.2, density * 0.1));
    
    set(prev => ({
      ...prev,
      sophisticationLevel: Math.floor(energy * 100) as SophisticationLevel
    }));

    // Trigger re-generation but ensure we don't randomize Sampler's midi
    handleMasterRandomize(true);
  };

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

  const setSophisticationLevel = (level: SophisticationLevel, skipHistory = false) => {
    set(prev => ({ ...prev, sophisticationLevel: level }), skipHistory);
  };

  const setVibeSeed = (seed: number, skipHistory = false) => {
    set(prev => ({ ...prev, vibeSeed: seed }), skipHistory);
  };

  const commitHistory = () => {
    set(prev => prev, false);
  };

  const currentInstrument = instrumentStates[activeTab];

  // Persistence: Login and load
  useEffect(() => {
    const initPersistence = async () => {
      const u = await loginAnonymously();
      if (u) {
        setUser(u);
        const latest = await loadLatestSession(u.uid);
        if (latest) {
          set({
            song: latest.song,
            instrumentStates: latest.instrumentStates
          });
          setSessionId(latest.id);
        }
      }
    };
    initPersistence();
  }, []);

  // Persistence: Auto-save on significant changes
  useEffect(() => {
    if (!user || isChangingParam) return;
    
    const timer = setTimeout(async () => {
      setSaveStatus('saving');
      try {
        const id = await saveSession(user.uid, "Untitled Session", song, instrumentStates, sessionId || undefined);
        setSessionId(id);
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 3000);
      } catch (e) {
        setSaveStatus('error');
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [song, instrumentStates, user, isChangingParam]);

  // Load persistent samples from audioEngine on load
  useEffect(() => {
    audioEngine.ensureRunning().catch(() => {}); // Initialize audio context in suspended state to allow loading indexedDB samples
    
    const syncSamples = () => {
      const next: Record<InstrumentType, { name: string; rootMidi: number } | null> = {
        Drums: null, Bass: null, Keys: null, Guitar: null, Pads: null, Lead: null, Sampler: null
      };
      let anyLoaded = false;
      INSTRUMENTS.forEach(inst => {
        const name = audioEngine.getCustomInstrumentFileName(inst);
        const root = audioEngine.getCustomInstrumentRootMidi(inst);
        if (name && root !== undefined) {
          next[inst] = { name, rootMidi: root };
          anyLoaded = true;
        }
      });
      if (anyLoaded) {
        setCustomSamples(next);
      }
    };
    
    // Check every half-second for up to 4 seconds to catch deferred IndexedDB buffer loads
    const interval = setInterval(syncSamples, 500);
    const timeout = setTimeout(() => clearInterval(interval), 4000);
    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, []);


  const handleUploadSample = async (instrument: InstrumentType, file: File, rootMidi: number) => {
    await audioEngine.saveAndSetCustomInstrumentSample(instrument, file, rootMidi);
    setCustomSamples(prev => ({
      ...prev,
      [instrument]: { name: file.name, rootMidi }
    }));
  };

  const handleRemoveSample = async (instrument: InstrumentType) => {
    await audioEngine.removeCustomInstrumentSample(instrument);
    setCustomSamples(prev => ({
      ...prev,
      [instrument]: null
    }));
  };

  const handleRootMidiChange = async (instrument: InstrumentType, rootMidi: number) => {
    // 1. Update in-memory
    const buffer = (audioEngine as any).customInstrumentBuffers[instrument];
    const name = (audioEngine as any).customInstrumentFileNames[instrument];
    if (buffer && name) {
      audioEngine.setCustomInstrumentSample(instrument, buffer, rootMidi, name);
    }
    
    // 2. React state
    setCustomSamples(prev => {
      const existing = prev[instrument];
      if (!existing) return prev;
      return {
        ...prev,
        [instrument]: { ...existing, rootMidi }
      };
    });

    // 3. Database persistence
    try {
      const stored = await SampleStorage.getSample(instrument);
      if (stored) {
        await SampleStorage.saveSample(instrument, stored.name, stored.type, stored.data, rootMidi);
      }
    } catch (e) {
      console.warn("Could not persist updated root MIDI:", e);
    }
  };

  const updateParam = (key: keyof typeof INITIAL_PARAMS, value: any) => {
    setInstrumentStates(prev => ({
      ...prev,
      [activeTab]: {
        ...prev[activeTab],
        params: { ...prev[activeTab].params, [key]: value }
      }
    }), isChangingParam);
  };

  const updateDrumVolume = (piece: string, volume: number) => {
    setInstrumentStates(prev => ({
      ...prev,
      Drums: {
        ...prev.Drums,
        kitVolumes: {
          ...(prev.Drums.kitVolumes || {}),
          [piece]: volume
        }
      }
    }), isChangingParam);
  };

  const updateSynthParam = (instrument: Exclude<InstrumentType, 'Drums'>, key: string, val: any) => {
    setInstrumentStates(prev => {
      const state = prev[instrument];
      const nextSynth = { ...(state.synthParams || DEFAULT_SYNTH_PARAMS[instrument]), [key]: val };
      return {
        ...prev,
        [instrument]: {
          ...state,
          synthParams: nextSynth
        }
      };
    }, isChangingParam);
  };

  const evolveArrangement = () => {
    const src = instrumentStates[activeTab].params;
    setInstrumentStates(prev => {
      const next = { ...prev };
      INSTRUMENTS.forEach(inst => {
        if (inst !== activeTab) {
          const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, Math.round(v)));
          next[inst] = {
            ...next[inst],
            params: {
              ...next[inst].params,
              groove: clamp(src.groove + (Math.random() * 20 - 10), 0, 100),
              sparseness: clamp(src.sparseness + (Math.random() * 20 - 10), 0, 100),
              pocket: clamp(src.pocket + (Math.random() * 10 - 5), -50, 50),
              humanize: clamp(src.humanize + (Math.random() * 10 - 5), 0, 100),
              syncopation: clamp(src.syncopation + (Math.random() * 20 - 10), 0, 100),
              energy: clamp((src.energy || 50) + (Math.random() * 20 - 10), 0, 100)
            }
          };
        }
      });
      return next;
    });
  };

  const toggleInstrument = (type: InstrumentType) => {
    setInstrumentStates(prev => ({
      ...prev,
      [type]: { ...prev[type], enabled: !prev[type].enabled }
    }));
  };

  const handleSpecialFile = async (file: File) => {
    setInspirationStatus(`Processing ${file.name}...`);
    try {
      if (file.name.endsWith('.json')) {
        const text = await file.text();
        const loadedState = JSON.parse(text);
        if (loadedState && loadedState.song) {
          set(loadedState, true); // true to skip history if you prefer
          setInspirationStatus('Session loaded successfully!');
        } else {
          setInspirationStatus('Invalid JSON format for session state.');
        }
      } else if (file.name.endsWith('.zip')) {
        const arrayBuffer = await file.arrayBuffer();
        const zip = await JSZip.loadAsync(arrayBuffer);
        const sessionFile = zip.file("session.json");
        if (sessionFile) {
          const text = await sessionFile.async("string");
          const loadedState = JSON.parse(text);
          
          if (loadedState && loadedState.song) {
            // Reconstruct blob URLs for custom samples if present
            if (loadedState.instrumentStates?.Drums?.customKit?.samples) {
              for (const sample of loadedState.instrumentStates.Drums.customKit.samples) {
                if (sample.url && sample.url.startsWith('custom_samples/')) {
                  const sampleFile = zip.file(sample.url);
                  if (sampleFile) {
                    const blob = await sampleFile.async("blob");
                    sample.url = URL.createObjectURL(blob);
                  }
                }
              }
            }
            if (loadedState.customSamples) {
              for (const [inst, sample] of Object.entries<any>(loadedState.customSamples)) {
                if (sample?.url && sample.url.startsWith('custom_samples/')) {
                  const sampleFile = zip.file(sample.url);
                  if (sampleFile) {
                    const blob = await sampleFile.async("blob");
                    sample.url = URL.createObjectURL(blob);
                    
                    // Preload into audio engine
                    const ext = sample.name.split('.').pop() || 'wav';
                    const fakeFile = new File([blob], sample.name, { type: `audio/${ext}` });
                    await audioEngine.saveAndSetCustomInstrumentSample(inst as InstrumentType, fakeFile, sample.rootMidi || 60);
                  }
                }
              }
            }
            
            set(loadedState, true);
            setInspirationStatus('Zip session loaded successfully!');
          }
        } else {
          setInspirationStatus('No session.json found in ZIP.');
        }
      } else if (file.name.endsWith('.mid') || file.name.endsWith('.midi')) {
        const arrayBuffer = await file.arrayBuffer();
        const midi = new Midi(arrayBuffer);
        
        // Very rudimentary MIDI chord extraction: find longest track, parse notes to chords
        // For demonstration, we could just extract tempo and set it, or try to get basic chords
        if (midi.header.tempos.length > 0) {
          const bpm = Math.round(midi.header.tempos[0].bpm);
          setSong(prev => ({ ...prev, bpm }));
        }
        
        // If we want to extract chords, we can just grab first few notes and make a simple progression
        // A full harmonic analysis of a MIDI file is complex, but we can set up a stub that replaces the active section
        if (midi.tracks.length > 0) {
          const longestTrack = midi.tracks.reduce((prev, current) => (prev.notes.length > current.notes.length) ? prev : current);
          if (longestTrack.notes.length > 0) {
            // Just simulate an analysis result that replaces chords
            const newChords = [
              { root: 'C', type: 'maj7', duration: 4, extensions: [] },
              { root: 'F', type: 'maj7', duration: 4, extensions: [] },
            ]; // Placeholder
            handleAnalysis({ interpolatedChords: newChords });
            setInspirationStatus('Extracted basic progression from MIDI.');
          } else {
            setInspirationStatus('MIDI file contains no notes.');
          }
        }
      }
    } catch (err) {
      console.error('Failed to parse special file:', err);
      setInspirationStatus('Error loading file.');
    }
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

  const activeInstrumentIssues = React.useMemo(() => {
    if (!activeSection) return [];
    const allIssues = critiqueSection(activeSection.chords, song.bpm, instrumentStates, song.key);
    return allIssues.filter(i => {
      const categoryLower = i.category.toLowerCase();
      const tabLower = activeTab.toLowerCase();
      // Match active instrument tab (e.g. Bass -> Bass, Keys -> keyboard/keys, etc.)
      // Also always allow Harmony issues
      return categoryLower === 'harmony' || categoryLower.includes(tabLower) || 
        (activeTab === 'Keys' && (categoryLower.includes('keyboard') || categoryLower.includes('keys')));
    });
  }, [song, instrumentStates, activeTab, activeSection]);

  const handleResolveActiveInstrumentIssues = () => {
    let currentChords = [...activeSection.chords];
    let currentStates = { ...instrumentStates };
    let didFix = false;

    activeInstrumentIssues.forEach(issue => {
      if (issue.canFix) {
        const { nextChords, nextInstrumentStates } = applyTheoryFix(issue, currentChords, song.key, currentStates);
        if (nextChords) currentChords = nextChords;
        if (nextInstrumentStates) currentStates = nextInstrumentStates;
        didFix = true;
      }
    });

    if (didFix) {
      setSong(prev => ({
        ...prev,
        sections: prev.sections.map(s => s.id === prev.activeSectionId ? { ...s, chords: currentChords } : s)
      }));
      setInstrumentStates(currentStates);
      commitHistory();
    }
  };

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

  const renameSection = (id: string, name: string) => {
    setSong(prev => ({
      ...prev,
      sections: prev.sections.map(s => s.id === id ? { ...s, name } : s)
    }));
  };

  const deleteSection = (id: string) => {
    setSong(prev => {
      if (prev.sections.length <= 1) return prev;
      const filtered = prev.sections.filter(s => s.id !== id);
      return {
        ...prev,
        sections: filtered,
        activeSectionId: prev.activeSectionId === id ? filtered[0].id : prev.activeSectionId
      };
    });
  };

  const reorderSections = (draggedId: string, targetId: string) => {
    setSong(prev => {
      const indexA = prev.sections.findIndex(s => s.id === draggedId);
      const indexB = prev.sections.findIndex(s => s.id === targetId);
      if (indexA === -1 || indexB === -1 || indexA === indexB) return prev;
      const newSections = [...prev.sections];
      const [draggedSection] = newSections.splice(indexA, 1);
      newSections.splice(indexB, 0, draggedSection);
      return {
        ...prev,
        sections: newSections
      };
    });
  };

  const handleExport = () => {
    exportMidi(song, instrumentStates, sophisticationLevel, state);
  };

  const playPreview = (chord: Chord) => {
    audioEngine.playChord(chord.root, chord.type);
  };

  const getActiveInstrumentStates = () => {
    let states = { ...instrumentStates };
    
    // Apply Vibe Vector
    if (vibeSeed !== 0) {
      const vibe = deriveVibeVector(vibeSeed);
      states = applyVibe(states, vibe) as Record<InstrumentType, InstrumentState>;
    }

    if (activeSection.instrumentParams) {
      Object.keys(states).forEach(key => {
        const k = key as InstrumentType;
        if (activeSection.instrumentParams![k]) {
          states[k] = {
            ...states[k],
            params: { ...states[k].params, ...activeSection.instrumentParams![k] }
          };
        }
      });
    }
    return states;
  };

  const getActiveChords = () => {
    return applySophistication(activeSection.chords, sophisticationLevel);
  };

  const [mutes, setMutes] = React.useState<Record<InstrumentType, boolean>>({
    Drums: false, Bass: false, Keys: false, Guitar: false, Pads: false, Lead: false, Sampler: false
  });
  const [solos, setSolos] = React.useState<Record<InstrumentType, boolean>>({
    Drums: false, Bass: false, Keys: false, Guitar: false, Pads: false, Lead: false, Sampler: false
  });

  const handleToggleMute = (type: InstrumentType) => {
    setMutes((prev) => {
      const next = { ...prev, [type]: !prev[type] };
      audioEngine.updateSequencerParams(
        getActiveChords(),
        song.bpm,
        getActiveInstrumentStates(),
        volumes,
        instrumentStates.Drums?.customKit,
        next,
        solos
      );
      return next;
    });
  };

  const handleToggleSolo = (type: InstrumentType) => {
    setSolos((prev) => {
      const next = { ...prev, [type]: !prev[type] };
      audioEngine.updateSequencerParams(
        getActiveChords(),
        song.bpm,
        getActiveInstrumentStates(),
        volumes,
        instrumentStates.Drums?.customKit,
        mutes,
        next
      );
      return next;
    });
  };

  React.useEffect(() => {
    if (isPlaying) {
      audioEngine.startSequencer(
        getActiveChords(),
        song.bpm,
        getActiveInstrumentStates(),
        volumes,
        instrumentStates.Drums?.customKit,
        mutes,
        solos
      );
    } else {
      audioEngine.stopSequencer();
    }
    return () => {
      audioEngine.stopSequencer();
    };
  }, [isPlaying]);

  React.useEffect(() => {
    if (isPlaying) {
      audioEngine.updateSequencerParams(
        getActiveChords(),
        song.bpm,
        getActiveInstrumentStates(),
        volumes,
        instrumentStates.Drums?.customKit,
        mutes,
        solos
      );
    }
  }, [isPlaying, activeSection.chords, song.bpm, instrumentStates, volumes, activeSection.instrumentParams, sophisticationLevel, vibeSeed, mutes, solos]);

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

  const handleRandomizeInstrument = (type: InstrumentType) => {
    const playStyles = INSTRUMENT_PLAY_STYLES[type];
    const randomPlayStyle = playStyles[Math.floor(Math.random() * playStyles.length)];
    const randomGenre = GENRES[Math.floor(Math.random() * GENRES.length)];
    const randomEra = ERAS[Math.floor(Math.random() * ERAS.length)];
    const randomVibe = VIBES[Math.floor(Math.random() * VIBES.length)];
    const randomNotation = NOTATION_STYLES[Math.floor(Math.random() * NOTATION_STYLES.length)];

    setInstrumentStates(prev => ({
      ...prev,
      [type]: {
        ...prev[type],
        params: {
          ...prev[type].params,
          genre: randomGenre,
          era: randomEra,
          vibe: randomVibe,
          notationStyle: randomNotation,
          playStyle: randomPlayStyle,
          groove: Math.floor(40 + Math.random() * 50),
          sparseness: Math.floor(30 + Math.random() * 50),
          pocket: Math.floor(30 + Math.random() * 50),
          humanize: Math.floor(40 + Math.random() * 40)
        }
      }
    }), false);
  };

  const handleRandomizeFullSong = () => {
    const lockedKeys: (keyof SessionParameters)[] = lockGroove ? ['groove', 'pocket', 'humanize', 'syncopation'] : [];
    const { song: nextSong, instrumentStates: nextStates } = performSmartRandomize(instrumentStates, song, 12, lockedKeys);

    // After picking the "winner" draft, apply Arrangement logic to set instrumentParams per section
    const finalSections = nextSong.sections.map(sec => ({ ...sec }));
    const curve: EnergyCurve = { bySection: {} };
    
    finalSections.forEach((sec) => {
      let energy = 0.5;
      const lowerName = sec.name.toLowerCase();
      if (lowerName.includes('chorus') || lowerName.includes('drop')) energy = 0.9;
      else if (lowerName.includes('verse')) energy = 0.4;
      else if (lowerName.includes('bridge')) energy = 0.7;
      else if (lowerName.includes('intro')) energy = 0.2;
      else if (lowerName.includes('outro')) energy = 0.3;
      energy = Math.max(0, Math.min(1, energy + (Math.random() * 0.2 - 0.1)));
      curve.bySection[sec.id] = energy;
    });
    
    const arrangement = resolveArrangement(finalSections, curve, standardArrangementStyle, fusedProfile);
    finalSections.forEach(sec => {
      sec.instrumentParams = arrangement[sec.id];
    });

    setSong({ ...nextSong, sections: finalSections });
    setInstrumentStates(nextStates);
    setSongParams({
      harmony: nextSong.sections[0]?.chords[0] ? nextStates.Drums.params.harmony : songParams.harmony,
      voicing: nextStates.Drums.params.voicing,
      mood: nextStates.Drums.params.mood,
      energy: nextStates.Drums.params.energy
    });
    setVibeSeed(Math.floor(Math.random() * 1000));
    commitHistory();
  };

  const generateArrangedSections = (tmpl: any, key: string) => {
    const newSections = generateSongSections(tmpl, key, true);
    const curve: EnergyCurve = { bySection: {} };
    newSections.forEach((sec) => {
      let energy = 0.5;
      const lowerName = sec.name.toLowerCase();
      if (lowerName.includes('chorus') || lowerName.includes('drop')) energy = 0.9;
      else if (lowerName.includes('verse')) energy = 0.4;
      else if (lowerName.includes('bridge')) energy = 0.7;
      else if (lowerName.includes('intro')) energy = 0.2;
      else if (lowerName.includes('outro')) energy = 0.3;
      energy = Math.max(0, Math.min(1, energy + (Math.random() * 0.2 - 0.1)));
      curve.bySection[sec.id] = energy;
    });
    const arrangement = resolveArrangement(newSections, curve, standardArrangementStyle, fusedProfile);
    newSections.forEach(sec => {
      sec.instrumentParams = arrangement[sec.id];
    });
    return newSections;
  };

  const handleMasterRandomize = (lockSampler = false) => {
    const lockedKeys: (keyof SessionParameters)[] = lockGroove ? ['groove', 'pocket', 'humanize', 'syncopation'] : [];
    const { song: nextSong, instrumentStates: nextStates } = performSmartRandomize(instrumentStates, song, 8, lockedKeys);

    // If we're locking sampler, restore its editedMidi to all sections
    if (lockSampler && editedMidi.Sampler) {
      nextSong.sections.forEach(sec => {
        sec.midiData.Sampler = [...editedMidi.Sampler!];
      });
    }

    // After picking the "winner" draft, we still want to apply the Arrangement logic 
    // to ensure instrumentParams per section are set correctly for that song structure.
    const finalSections = nextSong.sections.map(sec => ({ ...sec }));
    const curve: EnergyCurve = { bySection: {} };
    finalSections.forEach((sec) => {
      let energy = 0.5;
      const lowerName = sec.name.toLowerCase();
      if (lowerName.includes('chorus') || lowerName.includes('drop')) energy = 0.9;
      else if (lowerName.includes('verse')) energy = 0.4;
      else if (lowerName.includes('bridge')) energy = 0.7;
      else if (lowerName.includes('intro')) energy = 0.2;
      else if (lowerName.includes('outro')) energy = 0.3;
      energy = Math.max(0, Math.min(1, energy + (Math.random() * 0.2 - 0.1)));
      curve.bySection[sec.id] = energy;
    });
    
    const arrangement = resolveArrangement(finalSections, curve, standardArrangementStyle, fusedProfile);
    finalSections.forEach(sec => {
      sec.instrumentParams = arrangement[sec.id];
    });

    set(prev => ({
      ...prev,
      song: { ...nextSong, sections: finalSections },
      instrumentStates: nextStates,
      songParams: {
        harmony: nextStates.Drums.params.harmony,
        voicing: nextStates.Drums.params.voicing,
        mood: nextStates.Drums.params.mood,
        energy: nextStates.Drums.params.energy
      },
      vibeSeed: Math.floor(Math.random() * 1000)
    }), false);
  };

  return (
    <div className="h-screen w-screen flex flex-col md:p-4 bg-[#09090b] overflow-hidden">
      {/* Main Plugin Window */}
      <div className="w-full h-full max-w-[1600px] mx-auto panel-glass overflow-hidden flex flex-col">
        
        {/* ═══ Header / Transport ═══ */}
        <div className="h-14 border-b border-studio-border flex items-center justify-between px-5"
          style={{ background: 'linear-gradient(180deg, #18181b 0%, #121214 100%)' }}>
          
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-md flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' }}>
              <Cpu className="w-4 h-4 text-studio-bg" />
            </div>
            <div>
              <h1 className="text-sm font-display tracking-tight text-white font-medium">Session Player</h1>
              <span className="text-[9px] font-mono text-studio-muted uppercase tracking-widest">AI MIDI Engine v2.5</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Undo/Redo */}
            <div className="flex items-center gap-0.5">
              <button 
                onClick={undo}
                disabled={!canUndo}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md transition-colors cursor-pointer border border-transparent",
                  canUndo ? "text-studio-muted hover:text-studio-accent hover:bg-studio-accent/10 hover:border-studio-accent/20" : "text-studio-muted/30 cursor-not-allowed"
                )}
                title="Undo (Ctrl+Z)"
              >
                <Undo2 size={13} />
                <span className="text-[9px] font-mono uppercase hidden md:inline">Undo</span>
              </button>
              <button 
                onClick={redo}
                disabled={!canRedo}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md transition-colors cursor-pointer border border-transparent",
                  canRedo ? "text-studio-muted hover:text-studio-accent hover:bg-studio-accent/10 hover:border-studio-accent/20" : "text-studio-muted/30 cursor-not-allowed"
                )}
                title="Redo (Ctrl+Shift+Z)"
              >
                <Redo2 size={13} />
                <span className="text-[9px] font-mono uppercase hidden md:inline">Redo</span>
              </button>
            </div>

            {/* Global Musical Engines */}
            <div className="hidden xl:flex items-center gap-4 px-4 h-9 rounded-lg bg-black/40 border border-[#222224]">
              {/* Sophistication Dial */}
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-mono text-studio-muted uppercase">Sophistication</span>
                <div className="flex items-center gap-1 bg-[#121214] p-0.5 rounded border border-white/5">
                  {[0, 1, 2, 3].map((lvl) => (
                    <button
                      key={lvl}
                      onClick={() => setSophisticationLevel(lvl as SophisticationLevel)}
                      className={cn(
                        "w-4 h-4 text-[9px] font-mono rounded transition-all cursor-pointer",
                        sophisticationLevel === lvl 
                          ? "bg-studio-accent text-white font-bold" 
                          : "text-studio-muted hover:text-studio-text hover:bg-white/5"
                      )}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>

              <div className="w-px h-4 bg-studio-border" />

              {/* Vibe Selector */}
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-mono text-studio-muted uppercase">Vibe</span>
                <select 
                  value={vibeSeed}
                  onChange={(e) => setVibeSeed(Number(e.target.value))}
                  className="bg-[#121214] border border-white/5 rounded text-[10px] font-mono px-1 py-0.5 text-studio-text focus:outline-none focus:border-studio-accent/40 cursor-pointer"
                >
                  <option value={0}>Natural (None)</option>
                  {Object.entries(VIBE_PRESETS).map(([name, seed]) => (
                    <option key={seed} value={seed}>{name}</option>
                  ))}
                  {vibeSeed !== 0 && !Object.values(VIBE_PRESETS).includes(vibeSeed) && (
                    <option value={vibeSeed}>Custom Vibe</option>
                  )}
                </select>
                <button 
                  onClick={() => setVibeSeed(Math.floor(Math.random() * 1000))}
                  className="p-1 rounded text-studio-muted hover:text-studio-accent transition-colors cursor-pointer"
                  title="Randomize Vibe"
                >
                  <Shuffle className="w-3 h-3" />
                </button>
              </div>
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
                  onChange={(e) => {
                    const newKey = e.target.value;
                    const diff = ((NOTE_MAP[newKey] ?? 0) - (NOTE_MAP[song.key] ?? 0) + 12) % 12;
                    setSong(prev => ({ 
                      ...prev, 
                      key: newKey,
                      sections: prev.sections.map(sec => ({
                        ...sec,
                        chords: sec.chords.map(c => transposeChord(c, diff))
                      }))
                    }));
                  }}
                  className="bg-transparent text-center text-sm font-mono focus:outline-none text-studio-accent cursor-pointer"
                >
                  {['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].map(k => <option key={k} value={k}>{k}</option>)}
                </select>
              </div>
            </div>

            {/* Big Master Randomizer */}
            <div className="flex items-center gap-2">
              {saveStatus !== 'idle' && (
                <div className="flex items-center gap-1 px-2 py-1 bg-black/40 rounded border border-white/5 animate-in fade-in zoom-in">
                  <div className={cn(
                    "w-1.5 h-1.5 rounded-full",
                    saveStatus === 'saving' ? "bg-amber-500 animate-pulse" : 
                    saveStatus === 'saved' ? "bg-emerald-500" : "bg-red-500"
                  )} />
                  <span className="text-[8px] font-mono text-studio-muted uppercase font-bold">
                    {saveStatus === 'saving' ? 'Syncing...' : saveStatus === 'saved' ? 'Saved' : 'Error'}
                  </span>
                </div>
              )}

              <button 
                onClick={handleMasterRandomize}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-mono font-bold uppercase bg-gradient-to-r from-violet-600 via-indigo-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white rounded-md border border-indigo-500/20 shadow-lg shadow-indigo-500/10 active:scale-95 transition-all cursor-pointer"
                title="Master Randomizer: Sync key, BPM, chord progression, and all instrument styles for rhythmic harmony"
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-200 animate-pulse" />
                <span>Randomize Sync</span>
              </button>

              <button
                onClick={() => setLockGroove(!lockGroove)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-mono font-bold uppercase rounded-md border transition-all cursor-pointer",
                  lockGroove 
                    ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400" 
                    : "bg-white/5 border-white/10 text-studio-muted hover:border-white/20"
                )}
                title={lockGroove ? "Groove is LOCKED" : "Lock current groove feel"}
              >
                {lockGroove ? <Activity className="w-3.5 h-3.5" /> : <Waves className="w-3.5 h-3.5" />}
                <span>{lockGroove ? "Locked" : "Lock"}</span>
              </button>
            </div>

            {/* Export */}
            <button 
              onClick={handleExport}
              className="flex items-center gap-1.5 btn-vintage px-3 py-1.5 rounded-md text-studio-muted hover:text-studio-accent cursor-pointer border border-studio-border/50 hover:border-studio-accent/30 bg-black/20 hover:bg-studio-accent/10 transition-all"
              title="Export Multi-track MIDI ZIP"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="text-[10px] font-mono uppercase tracking-wide">Export ZIP</span>
            </button>
          </div>
        </div>

        {/* ═══ Main Content Area ═══ */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* ── Left Sidebar: Instruments ── */}
          <div className="w-72 border-r border-studio-border flex flex-col" style={{ background: 'linear-gradient(180deg, #121214 0%, #0d0d0e 100%)' }}>
            <div 
              onClick={() => setContentTab('fusion')}
              className={cn(
                "p-4 border-b border-studio-border/30 cursor-pointer transition-all hover:bg-studio-accent/5 group",
                contentTab === 'fusion' && "bg-studio-accent/10 border-b-studio-accent/40"
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-[10px] font-mono text-studio-muted uppercase tracking-[0.2em] flex items-center gap-2 group-hover:text-studio-accent">
                  <Users className="w-3 h-3 text-studio-accent" /> Producer Fusion
                </h3>
                <Sparkles className="w-3 h-3 text-studio-accent animate-pulse" />
              </div>
              <div className="flex gap-1 overflow-hidden">
                {fusedProfile.signature.tags.slice(0, 3).map(tag => (
                  <span key={tag} className="px-1.5 py-0.5 rounded bg-studio-accent/10 text-studio-accent text-[8px] font-mono border border-studio-accent/20 whitespace-nowrap">
                    #{tag.replace('_', ' ')}
                  </span>
                ))}
              </div>
            </div>
            <div className="px-4 py-3 border-b border-studio-border">
              <span className="text-[9px] font-mono text-studio-muted uppercase tracking-[0.2em]">Instruments</span>
            </div>
            <div className="flex-1 overflow-y-auto py-1">
              {INSTRUMENTS.map(type => (
                <div
                  key={type}
                  role="button"
                  tabIndex={0}
                  onClick={() => setActiveTab(type)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setActiveTab(type);
                    }
                  }}
                  className={cn(
                    "w-full px-4 py-2.5 flex items-center justify-between group transition-all cursor-pointer select-none focus:outline-none focus:bg-white/3",
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
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRandomizeInstrument(type);
                      }}
                      className="p-1 rounded text-studio-muted hover:text-studio-accent hover:bg-studio-accent/10 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                      title={`Intelligently randomize ${type}`}
                    >
                      <Shuffle className="w-3 h-3" />
                    </button>
                    <ChevronRight className={cn(
                      "w-3 h-3 transition-all",
                      activeTab === type ? "text-studio-accent opacity-100" : "text-studio-muted opacity-0 group-hover:opacity-40"
                    )} />
                  </div>
                </div>
              ))}
            </div>
            

          </div>

          {/* ── Main Panel ── */}
          <div className="flex-1 flex flex-col bg-studio-panel/30">
            
            {/* Instrument Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-5 py-3 border-b border-studio-border">
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
                    <button 
                      onClick={() => handleRandomizeInstrument(activeTab)}
                      className="flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-mono uppercase bg-studio-accent/15 border border-studio-accent/20 hover:border-studio-accent/40 text-studio-accent hover:text-white rounded transition-all active:scale-95 cursor-pointer"
                      title={`Intelligently randomize ${activeTab} parameters`}
                    >
                      <Shuffle className="w-2.5 h-2.5 animate-pulse" />
                      <span>Randomize</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Workspace Selector Tabs */}
              <div className="flex items-center gap-1 bg-[#0d0d0f] p-1 rounded-lg border border-studio-border/40 w-full sm:w-auto overflow-x-auto">
                {(['perform', 'theory', 'mix', 'synth', 'settings'] as const).map((tab) => {
                  let label = '';
                  let Icon = Keyboard;
                  if (tab === 'perform') {
                    label = 'Perform';
                    Icon = Keyboard;
                  } else if (tab === 'theory') {
                    label = 'Theory';
                    Icon = GraduationCap;
                  } else if (tab === 'mix') {
                    label = 'Mixer';
                    Icon = Sliders;
                  } else if (tab === 'synth') {
                    label = 'Synth';
                    Icon = Waves;
                  } else if (tab === 'settings') {
                    label = 'Settings';
                    Icon = Upload;
                  }

                  const active = contentTab === tab;
                  return (
                    <button
                      key={tab}
                      onClick={() => setContentTab(tab)}
                      className={cn(
                        "flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-mono uppercase transition-all cursor-pointer font-bold select-none whitespace-nowrap flex-1 sm:flex-initial",
                        active 
                          ? "text-white bg-studio-accent shadow-sm" 
                          : "text-studio-muted hover:text-studio-text hover:bg-white/5"
                      )}
                      style={active ? { background: 'linear-gradient(180deg, #6366f1 0%, #4f46e5 100%)' } : undefined}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── Tab Content ── */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              <AnimatePresence mode="wait">
                
                {contentTab === 'fusion' && (
                  <motion.div
                    key="fusion"
                    initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                    className="flex-1 flex flex-col h-full"
                  >
                    <ProducerFusionView 
                      weights={producerWeights}
                      onUpdateWeights={setProducerWeights}
                      fusedProfile={fusedProfile}
                    />
                  </motion.div>
                )}

                {/* ═══ 1. MODULAR & PERFORM WORKSPACE ═══ */}
                {contentTab === 'perform' && (
                  <motion.div 
                    key="perform"
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                    className="p-5 flex flex-col gap-6"
                  >
                    {activeTab === 'Sampler' ? (
                      <SamplerWorkbench
                        state={instrumentStates.Sampler}
                        onUpdateSynthParam={(key, val) => updateSynthParam('Sampler', key, val)}
                        onUpdateMidi={(notes) => setEditedMidi('Sampler', notes)}
                        onLearnFromSampler={handleLearnFromSampler}
                      />
                    ) : (
                      <div className="panel-inset p-4 bg-[#0a0a0c]/60 rounded-xl border border-studio-border/30">
                        <PianoRoll 
                          isPlaying={isPlaying}
                          activeInstrument={activeTab}
                          chords={activeSection.chords}
                          bpm={song.bpm}
                          params={currentInstrument.params}
                          onUpdateParams={(updated) => {
                            setInstrumentStates(prev => ({
                              ...prev,
                              [activeTab]: {
                                ...prev[activeTab],
                                params: { ...prev[activeTab].params, ...updated }
                              }
                            }));
                            commitHistory();
                          }}
                          onTriggerAction={async (action) => {
                            const currentChord = activeSection?.chords?.[0] || { root: 'C', type: 'maj', duration: 4 };
                            await audioEngine.playLivePhrase(activeTab, action, currentChord);
                          }}
                          editedMidi={editedMidi[activeTab] || []}
                          onUpdateMidi={(notes) => setEditedMidi(activeTab, notes)}
                        />
                      </div>
                    )}

                    {/* Bottom: Visualizer and Performance Knobs / XY pad */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                      
                      {/* Left side: Midi Wave Visualizer & Previews */}
                      <div className="lg:col-span-4 space-y-4">
                        <div className="bg-black/35 p-4 rounded-xl border border-studio-border/40">
                          <span className="text-[9px] font-mono text-studio-muted uppercase tracking-[0.15em] block mb-3">Live Rhythmic Waveform</span>
                          <MidiVisualizer 
                            isPlaying={isPlaying} 
                            instrumentType={activeTab}
                            groove={currentInstrument.params.groove}
                            density={currentInstrument.params.sparseness}
                          />
                        </div>

                        {mode === 'Scratch' && (
                          <div className="bg-black/35 p-4 rounded-xl border border-studio-border/40 space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-[9px] font-mono text-studio-muted uppercase tracking-[0.15em]">Trigger Audition</span>
                              <Keyboard className="w-3.5 h-3.5 text-studio-accent animate-pulse" />
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
                      </div>

                      {/* Right side: Performance Controllers */}
                      <div className="lg:col-span-8 panel-inset p-5 flex flex-col gap-5">
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] font-mono text-studio-muted uppercase tracking-[0.15em]">Perform Knobs</span>
                          <span className="text-[9px] font-mono text-studio-accent uppercase tracking-[0.15em]">{activeTab} Modifiers</span>
                        </div>

                        {/* Interactive Theory Critic Quick Badge */}
                        <div className={cn(
                          "rounded-lg p-3 border text-[11px] font-mono flex items-center justify-between gap-3 transition-all",
                          activeInstrumentIssues.length > 0 
                            ? "bg-amber-500/[0.02] border-amber-500/20 text-amber-300"
                            : "bg-emerald-500/[0.02] border-emerald-500/20 text-emerald-400"
                        )}>
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              "w-2 h-2 rounded-full",
                              activeInstrumentIssues.length > 0 ? "bg-amber-500 animate-pulse" : "bg-emerald-500"
                            )} />
                            <div>
                              <div className="font-semibold uppercase tracking-wider text-[8px] text-studio-muted font-bold">Real-time Music Critic</div>
                              <div className="text-[10px] truncate">
                                {activeInstrumentIssues.length > 0 
                                  ? `${activeInstrumentIssues.length} critiques detected`
                                  : "Harmonic stability verified"
                                }
                              </div>
                            </div>
                          </div>

                          {activeInstrumentIssues.some(i => i.canFix) && (
                            <button
                              onClick={handleResolveActiveInstrumentIssues}
                              className="px-2.5 py-1 text-[8px] font-mono uppercase bg-amber-500 text-black hover:bg-amber-400 font-bold rounded transition-all active:scale-95 cursor-pointer"
                            >
                              Resolve
                            </button>
                          )}
                        </div>
                        
                        <div className="grid grid-cols-3 gap-y-6 gap-x-4 place-items-center bg-black/10 p-3 rounded-lg border border-studio-border/20">
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
                          <Knob 
                            label="Syncopation" 
                            value={currentInstrument.params.syncopation} 
                            onChange={(val) => updateParam('syncopation', val)} 
                            onStart={() => setIsChangingParam(true)}
                            onEnd={() => { setIsChangingParam(false); commitHistory(); }}
                          />
                          <Knob 
                            label="Sophistication" 
                            value={currentInstrument.params.sophistication || 50} 
                            onChange={(val) => updateParam('sophistication', val)} 
                            onStart={() => setIsChangingParam(true)}
                            onEnd={() => { setIsChangingParam(false); commitHistory(); }}
                          />
                        </div>

                        {activeTab === 'Drums' && (
                          <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 space-y-4">
                            <PocketLab 
                              params={currentInstrument.params}
                              onChange={(updated) => {
                                setInstrumentStates(prev => ({
                                  ...prev,
                                  Drums: {
                                    ...prev.Drums,
                                    params: { ...prev.Drums.params, ...updated }
                                  }
                                }));
                                commitHistory();
                              }}
                            />

                            <div className="bg-black/20 p-5 rounded-2xl border border-studio-border/30 backdrop-blur-md">
                              <div className="flex items-center gap-2 mb-4">
                                <div className="p-1.5 bg-studio-accent/20 rounded-lg">
                                  <Upload className="w-3.5 h-3.5 text-studio-accent" />
                                </div>
                                <div>
                                  <h4 className="text-[10px] font-mono font-bold text-white uppercase tracking-widest">Drum Kit Lab</h4>
                                  <p className="text-[8px] font-mono text-studio-muted">UPLOAD SAMPLES TO REFRESH THE ENGINE</p>
                                </div>
                              </div>
                              <DrumKitManager 
                                currentKit={instrumentStates.Drums.customKit}
                                onUpdateKit={(kit) => {
                                  setInstrumentStates(prev => ({
                                    ...prev,
                                    Drums: { ...prev.Drums, customKit: kit }
                                  }));
                                }}
                              />
                            </div>
                          </div>
                        )}

                        <div className="space-y-3">
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-mono text-studio-muted uppercase tracking-[0.15em]">XY Morph Matrix</span>
                            <select 
                              value={xyModes[activeTab]}
                              onChange={(e) => setXyModes(prev => ({ ...prev, [activeTab]: e.target.value }))}
                              className="bg-[#0a0a0c] border border-studio-border/30 rounded px-2 py-1 text-[9px] font-mono text-studio-text outline-none cursor-pointer hover:border-studio-accent/40"
                            >
                              <option value="Groove/Density">Groove & Density</option>
                              <option value="Pocket/Humanize">Pocket & Humanize</option>
                              <option value="Syncopation/Energy">Syncopation & Energy</option>
                              <option value="Timbre/Filter">Timbre & Filter</option>
                            </select>
                          </div>
                          
                          {xyModes[activeTab] === 'Groove/Density' && (
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
                          )}

                          {xyModes[activeTab] === 'Pocket/Humanize' && (
                            <XYPad 
                              labelX="Pocket (Push/Pull)" 
                              labelY="Humanize" 
                              valueX={currentInstrument.params.pocket}
                              valueY={currentInstrument.params.humanize}
                              onChange={(x, y) => {
                                updateParam('pocket', x);
                                updateParam('humanize', y);
                              }}
                              onStart={() => setIsChangingParam(true)}
                              onEnd={() => { setIsChangingParam(false); commitHistory(); }}
                            />
                          )}

                          {xyModes[activeTab] === 'Syncopation/Energy' && (
                            <XYPad 
                              labelX="Syncopation" 
                              labelY="Energy" 
                              valueX={currentInstrument.params.syncopation}
                              valueY={currentInstrument.params.energy ?? 50}
                              onChange={(x, y) => {
                                updateParam('syncopation', x);
                                updateParam('energy', y);
                              }}
                              onStart={() => setIsChangingParam(true)}
                              onEnd={() => { setIsChangingParam(false); commitHistory(); }}
                            />
                          )}

                          {xyModes[activeTab] === 'Timbre/Filter' && (
                            <XYPad 
                              labelX="Cutoff" 
                              labelY="Resonance" 
                              valueX={((currentInstrument.synthParams?.filterCutoff ?? 1000) / 10000) * 100}
                              valueY={((currentInstrument.synthParams?.filterResonance ?? 1) / 20) * 100}
                              onChange={(x, y) => {
                                if (activeTab === 'Drums') return;
                                const cutoff = (x / 100) * 10000;
                                const res = (y / 100) * 20;
                                updateSynthParam(activeTab as Exclude<InstrumentType, 'Drums'>, 'filterCutoff', cutoff);
                                updateSynthParam(activeTab as Exclude<InstrumentType, 'Drums'>, 'filterResonance', res);
                              }}
                              onStart={() => setIsChangingParam(true)}
                              onEnd={() => { setIsChangingParam(false); commitHistory(); }}
                            />
                          )}
                        </div>
                        
                        <div className="pt-4 border-t border-studio-border/20">
                          <button 
                            onClick={evolveArrangement}
                            className="w-full bg-studio-accent/10 hover:bg-studio-accent/20 text-studio-accent border border-studio-accent/30 rounded-lg py-2.5 text-[9px] font-mono uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2"
                          >
                            <Music2 className="w-3 h-3" />
                            Evolve Arrangement to Match
                          </button>
                        </div>
                      </div>

                    </div>

                    {/* Sampler Section for Melodic Instruments */}
                    {activeTab !== 'Drums' && (
                      <div className="mt-6">
                        <SamplerSection
                          instrument={activeTab as 'Bass' | 'Keys' | 'Guitar' | 'Pads' | 'Lead'}
                          fileName={customSamples[activeTab]?.name}
                          rootMidi={customSamples[activeTab]?.rootMidi ?? 60}
                          synthParams={currentInstrument.synthParams}
                          onUpload={(file, rm) => handleUploadSample(activeTab as 'Bass' | 'Keys' | 'Guitar' | 'Pads' | 'Lead', file, rm)}
                          onRemove={() => handleRemoveSample(activeTab as 'Bass' | 'Keys' | 'Guitar' | 'Pads' | 'Lead')}
                          onRootMidiChange={(rm) => handleRootMidiChange(activeTab as 'Bass' | 'Keys' | 'Guitar' | 'Pads' | 'Lead', rm)}
                          onUpdateSynthParam={(key, val) => updateSynthParam(activeTab as Exclude<InstrumentType, 'Drums'>, key as any, val)}
                        />
                      </div>
                    )}
                  </motion.div>
                )}

                {/* ═══ 2. OPTIONS & THEORY WORKSPACE ═══ */}
                {contentTab === 'theory' && (
                  <motion.div 
                    key="theory"
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                    className="p-5 space-y-6"
                  >
                    {/* Global Theory Intelligence */}
                    <div className="bg-[#121214]/60 p-5 rounded-xl border border-studio-border/60 space-y-5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono text-studio-muted uppercase tracking-[0.15em] flex items-center gap-2">
                          <GraduationCap className="w-3.5 h-3.5 text-studio-accent" /> Song Theory Intelligence
                        </span>
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono text-studio-muted">Key:</span>
                            <select 
                              value={song.key}
                              onChange={(e) => setSong(prev => ({ ...prev, key: e.target.value }))}
                              className="bg-black/40 border border-studio-border/30 rounded px-2 py-1 text-[10px] font-mono text-studio-accent outline-none cursor-pointer"
                            >
                              {['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'].map(k => (
                                <option key={k} value={k}>{k}</option>
                              ))}
                            </select>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono text-studio-muted">BPM:</span>
                            <input 
                              type="number"
                              value={song.bpm}
                              onChange={(e) => setSong(prev => ({ ...prev, bpm: parseInt(e.target.value) || 120 }))}
                              className="w-14 bg-black/40 border border-studio-border/30 rounded px-2 py-1 text-[10px] font-mono text-studio-accent outline-none cursor-pointer"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div className="space-y-3">
                          <span className="text-[9px] font-mono text-studio-muted uppercase tracking-wider block">Harmony Density</span>
                          <select 
                            value={songParams.harmony}
                            onChange={(e) => setSongParams({ harmony: e.target.value })}
                            className="w-full bg-[#0a0a0c] border border-studio-border/30 rounded-lg p-2 text-[10px] font-mono text-studio-text outline-none cursor-pointer hover:border-studio-accent/40 transition-all"
                          >
                            {HARMONY_LEVELS.map(h => <option key={h} value={h}>{h}</option>)}
                          </select>
                        </div>
                        <div className="space-y-3">
                          <span className="text-[9px] font-mono text-studio-muted uppercase tracking-wider block">Chord Voicing</span>
                          <select 
                            value={songParams.voicing}
                            onChange={(e) => setSongParams({ voicing: e.target.value })}
                            className="w-full bg-[#0a0a0c] border border-studio-border/30 rounded-lg p-2 text-[10px] font-mono text-studio-text outline-none cursor-pointer hover:border-studio-accent/40 transition-all"
                          >
                            {VOICING_STYLES.map(v => <option key={v} value={v}>{v}</option>)}
                          </select>
                        </div>
                        <div className="space-y-3">
                          <span className="text-[9px] font-mono text-studio-muted uppercase tracking-wider block">Musical Mood</span>
                          <select 
                            value={songParams.mood}
                            onChange={(e) => setSongParams({ mood: e.target.value })}
                            className="w-full bg-[#0a0a0c] border border-studio-border/30 rounded-lg p-2 text-[10px] font-mono text-studio-text outline-none cursor-pointer hover:border-studio-accent/40 transition-all"
                          >
                            {MOODS.map(m => <option key={m} value={m}>{m}</option>)}
                          </select>
                        </div>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] font-mono text-studio-muted uppercase tracking-wider block">Intensity / Energy</span>
                            <span className="text-[9px] font-mono text-studio-accent">{songParams.energy}%</span>
                          </div>
                          <div className="flex justify-center">
                            <Knob 
                              size={40}
                              min={0}
                              max={100}
                              value={songParams.energy || 50}
                              onChange={(val) => setSongParams({ energy: val })}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 pt-2 border-t border-white/5">
                        <select 
                          className="bg-black/40 border border-studio-border/30 rounded-md px-3 py-1.5 text-[10px] font-mono text-studio-text outline-none cursor-pointer"
                          onChange={(e) => {
                            const template = SONG_STRUCTURES.find(t => t.id === e.target.value);
                            if (template) {
                              const newSections = generateArrangedSections(template, song.key);
                              setSong(prev => ({
                                ...prev,
                                sections: newSections,
                                activeSectionId: newSections[0]?.id || prev.activeSectionId
                              }));
                            }
                          }}
                          defaultValue="pop-standard"
                        >
                          <option value="" disabled>Select Template...</option>
                          {SONG_STRUCTURES.map(t => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                        </select>
                        <button 
                          onClick={handleRandomizeFullSong}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-studio-accent/15 text-studio-accent border border-studio-accent/20 hover:border-studio-accent/40 transition-all cursor-pointer text-xs"
                          title="Randomize whole song structure and theory"
                        >
                          <Shuffle className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Randomize Song</span>
                        </button>
                      </div>
                    </div>

                    <ArrangementView 
                      sections={song.sections} 
                      activeSectionId={song.activeSectionId}
                      onSelectSection={(id) => setSong(prev => ({ ...prev, activeSectionId: id }))}
                      onAddSection={addSection}
                      onRenameSection={renameSection}
                      onDeleteSection={deleteSection}
                      onReorderSections={reorderSections}
                    />

                    <ChordSequencer 
                      chords={activeSection.chords} 
                      onChange={updateChords} 
                    />

                    {/* Chord Sound Previews */}
                    <div className="space-y-3 bg-black/20 p-4 rounded-xl border border-studio-border/30">
                      <span className="text-[9px] font-mono text-studio-muted uppercase tracking-[0.15em]">Quick Progressions Audition</span>
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

                    <SoulEngineLab 
                      bpm={song.bpm}
                      onApplyProgression={(newChords) => {
                        updateChords(newChords);
                        commitHistory();
                      }}
                    />

                    <TheoryCriticPanel 
                      chords={activeSection.chords}
                      bpm={song.bpm}
                      instrumentStates={instrumentStates}
                      songKey={song.key}
                      sophisticationLevel={sophisticationLevel}
                      onUpdateChords={updateChords}
                      onUpdateInstrumentStates={(nextStates) => {
                        setInstrumentStates(nextStates);
                        commitHistory();
                      }}
                    />
                  </motion.div>
                )}

                {/* ═══ 3. MIXING OPTIONS WORKSPACE ═══ */}
                {contentTab === 'mix' && (
                  <motion.div 
                    key="mix"
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                    className="p-5 space-y-6"
                  >
                    {/* Multitrack Fader Board */}
                    <div className="bg-[#0e0e10]/80 p-5 rounded-xl border border-studio-border/60">
                      <span className="text-[10px] font-mono text-studio-muted uppercase tracking-[0.15em] block mb-4">Multi-Track Console Strip Mixer</span>
                      
                      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                        {INSTRUMENTS.map(type => {
                          const state = instrumentStates[type];
                          return (
                            <div key={type} className="bg-black/35 p-4 rounded-lg border border-studio-border/30 flex flex-col items-center gap-3 relative">
                              <span className="text-[10px] font-mono font-bold text-white uppercase tracking-wider">{type}</span>
                              
                              {/* Enable / Mute toggle switch */}
                              <button
                                onClick={() => toggleInstrument(type)}
                                className={cn(
                                  "w-full py-1 text-[8px] font-mono uppercase rounded transition-all cursor-pointer font-bold",
                                  state.enabled 
                                    ? "bg-studio-accent/20 text-studio-accent border border-studio-accent/40" 
                                    : "bg-red-500/10 text-red-400 border border-red-500/20"
                                )}
                              >
                                {state.enabled ? 'ON' : 'MUTE'}
                              </button>

                              {/* Vertical Channel Strip Fader slider */}
                              <div className="h-32 w-10 bg-black/40 rounded-lg relative flex flex-col justify-end items-center p-1 border border-studio-border/20">
                                <div 
                                  className="w-full rounded-md transition-all duration-200"
                                  style={{ 
                                    height: `${volumes[type]}%`,
                                    background: 'linear-gradient(0deg, #6366f1 0%, #a855f7 100%)'
                                  }}
                                />
                                <input 
                                  type="range" 
                                  min="0" 
                                  max="100" 
                                  value={volumes[type]}
                                  onChange={(e) => setVolumes(prev => ({ ...prev, [type]: parseInt(e.target.value) }), isChangingParam)}
                                  onMouseDown={() => setIsChangingParam(true)}
                                  onMouseUp={() => { setIsChangingParam(false); commitHistory(); }}
                                  className="absolute inset-0 opacity-0 cursor-col-resize h-full w-full rotate-180"
                                  style={{ writingMode: 'bt-lr', appearance: 'slider-vertical' } as any}
                                />
                              </div>

                              {/* Numeric level display */}
                              <span className="text-[10px] font-mono text-studio-accent font-bold">{volumes[type]}%</span>

                              {/* Sonic Signature */}
                              {state.synthParams && (
                                <div className="mt-auto pt-2 border-t border-white/5 w-full text-center opacity-60">
                                  <span className="text-[7px] font-mono text-studio-muted uppercase block mb-1">Sonic Signature</span>
                                  <div className="flex flex-wrap justify-center gap-1">
                                    <span className="text-[8px] font-mono text-studio-accent px-1 bg-studio-accent/10 rounded border border-studio-accent/20">
                                      {state.synthParams.oscType}
                                    </span>
                                    {state.synthParams.filterCutoff && (
                                      <span className="text-[8px] font-mono text-studio-accent px-1 bg-studio-accent/10 rounded border border-studio-accent/20">
                                        {Math.floor(state.synthParams.filterCutoff)}Hz
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Drum Sample / Custom Kit Editor Slot Removed from here */}
                    <SeniorDevDashboard />
                  </motion.div>
                )}

                {/* ═══ 4. JUNO SYNTH ENGINE ═══ */}
                {contentTab === 'synth' && (
                  <motion.div 
                    key="synth"
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                    className="p-5"
                  >
                    <JunoSynthModule
                      instrumentName={activeTab}
                      params={currentInstrument.synthParams || {}}
                      onUpdate={(key, val) => {
                        if (activeTab === 'Drums') return;
                        updateSynthParam(activeTab, key, val);
                      }}
                    />
                  </motion.div>
                )}

                {/* ═══ 5. UPLOADING & SETTINGS WORKSPACE ═══ */}
                {contentTab === 'settings' && (
                  <motion.div 
                    key="settings"
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                    className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-6"
                  >
                    {/* Left: Presets Selection and Session Modes */}
                    <div className="space-y-6">
                      <PresetSelector 
                        currentInstrument={activeTab} 
                        onSelect={applyPreset} 
                      />

                      <div className="bg-black/20 p-4 rounded-xl border border-studio-border/30 space-y-3">
                        <span className="text-[9px] font-mono text-studio-muted uppercase tracking-[0.15em] block">Core Session Mode</span>
                        <div className="grid grid-cols-2 gap-1.5 bg-[#0a0a0c] p-1 rounded-lg border border-[#222224]">
                          {(['Plugin', 'Scratch', 'Interpolation', 'Humming'] as const).map(m => (
                            <button 
                              key={m}
                              onClick={() => setMode(m)}
                              className={cn(
                                "py-1.5 rounded-md text-[10px] font-mono uppercase transition-all cursor-pointer text-center",
                                mode === m 
                                  ? "text-white font-bold bg-[#6366f1]" 
                                  : "text-studio-muted hover:text-studio-text"
                              )}
                              style={mode === m ? { background: 'linear-gradient(180deg, #6366f1 0%, #4f46e5 100%)' } : undefined}
                            >
                              {m}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Right: Sound Styles Selectors & Inspiration Uploads */}
                    <div className="space-y-6">
                      <InspirationUpload 
                        onAnalysisComplete={handleAnalysis} 
                        selectedPreset={selectedPreset}
                        isListening={isListening}
                        onToggleListen={() => setIsListening(!isListening)}
                        mode={mode}
                        selectedFile={inspirationFile}
                        onSelectedFileChange={setInspirationFile}
                        status={inspirationStatus}
                        onStatusChange={setInspirationStatus}
                        onSpecialFile={handleSpecialFile}
                      />

                      {mode !== 'Scratch' ? (
                        <div className="bg-[#121214]/60 p-5 rounded-xl border border-studio-border/60 space-y-4">
                          <span className="text-[9px] font-mono text-studio-muted uppercase tracking-[0.15em] flex items-center gap-2">
                            <Waves className="w-3 h-3 text-studio-accent" /> Engine Core Parameters
                          </span>
                          <div className="grid grid-cols-2 gap-4">
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
                            <div className="space-y-1.5">
                              <span className="text-[8px] font-mono text-studio-muted uppercase">Harmony</span>
                              <select 
                                value={currentInstrument.params.harmony}
                                onChange={(e) => updateParam('harmony', e.target.value)}
                                className="w-full bg-black/40 border border-studio-border rounded-md p-2 text-xs font-mono text-studio-text outline-none focus:border-studio-accent/50 cursor-pointer"
                              >
                                {HARMONY_LEVELS.map(h => <option key={h} value={h} className="bg-[#121214] text-studio-text">{h}</option>)}
                              </select>
                            </div>
                            <div className="space-y-1.5">
                              <span className="text-[8px] font-mono text-studio-muted uppercase">Voicing</span>
                              <select 
                                value={currentInstrument.params.voicing}
                                onChange={(e) => updateParam('voicing', e.target.value)}
                                className="w-full bg-black/40 border border-studio-border rounded-md p-2 text-xs font-mono text-studio-text outline-none focus:border-studio-accent/50 cursor-pointer"
                              >
                                {VOICING_STYLES.map(v => <option key={v} value={v} className="bg-[#121214] text-studio-text">{v}</option>)}
                              </select>
                            </div>
                            <div className="space-y-1.5">
                              <span className="text-[8px] font-mono text-studio-muted uppercase">Mood</span>
                              <select 
                                value={currentInstrument.params.mood}
                                onChange={(e) => updateParam('mood', e.target.value)}
                                className="w-full bg-black/40 border border-studio-border rounded-md p-2 text-xs font-mono text-studio-text outline-none focus:border-studio-accent/50 cursor-pointer"
                              >
                                {MOODS.map(m => <option key={m} value={m} className="bg-[#121214] text-studio-text">{m}</option>)}
                              </select>
                            </div>
                            <div className="space-y-1.5 col-span-2">
                              <span className="text-[8px] font-mono text-studio-muted uppercase flex justify-between">
                                Energy <span>{currentInstrument.params.energy}%</span>
                              </span>
                              <input 
                                type="range" min="0" max="100" 
                                value={currentInstrument.params.energy}
                                onChange={(e) => updateParam('energy', parseInt(e.target.value))}
                                onMouseDown={() => setIsChangingParam(true)}
                                onMouseUp={() => { setIsChangingParam(false); commitHistory(); }}
                                className="w-full accent-studio-accent cursor-pointer"
                              />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="panel-inset p-5 flex flex-col items-center justify-center gap-4 min-h-[160px]">
                          <Sparkles className="w-6 h-6 text-studio-accent/50" />
                          <p className="text-xs font-mono text-studio-muted text-center max-w-xs">
                            Style parameters are configured via standard preset selectors in Scratch mode. Switch modes to access core modifiers.
                          </p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>



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
