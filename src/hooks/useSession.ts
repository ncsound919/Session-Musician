/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { User } from 'firebase/auth';
import { 
  InstrumentType, 
  InstrumentState, 
  Song, 
  SessionParameters,
  PerformedNote,
  StylePreset,
  INITIAL_PARAMS,
  SophisticationLevel
} from '../types';
import { useUndoRedo } from './useUndoRedo';
import { loginAnonymously, saveSession, loadLatestSession } from '../lib/firebase';
import { audioEngine } from '../services/audioEngine';
import { generateSongSections, applyTheoryFix } from '../services/musicTheoryEngine';
import { SONG_STRUCTURES } from '../types';
import { ProducerEngine } from '../services/producerEngine';
import { performSmartRandomize } from '../services/smartRandomizer';
import { SampleStorage } from '../services/sampleStorage';

const INSTRUMENTS: InstrumentType[] = ['Drums', 'Bass', 'Keys', 'Guitar', 'Pads', 'Lead', 'Sampler'];

const DEFAULT_SYNTH_PARAMS: Record<Exclude<InstrumentType, 'Drums'>, any> = {
  Bass: { oscType: 'sawtooth', filterCutoff: 350, filterResonance: 1, attack: 0.01, decay: 0.15, sustain: 0.6, release: 0.2, lfoRate: 5, lfoFilterMod: 0, lfoPitchMod: 0, hpfCutoff: 10, junoChorus: 0, noiseLevel: 0, filterType: 'lowpass', filterDrive: 0.1, unisonVoices: 1, subOscLevel: 0.3, subOscOctave: -1, glideTime: 0.05 },
  Keys: { oscType: 'triangle', filterCutoff: 1200, filterResonance: 1, attack: 0.005, decay: 0.2, sustain: 0.4, release: 0.2, lfoRate: 5, lfoFilterMod: 0, lfoPitchMod: 0, hpfCutoff: 10, junoChorus: 0, noiseLevel: 0, filterType: 'lowpass', filterDrive: 0, unisonVoices: 1, subOscLevel: 0, glideTime: 0 },
  Guitar: { oscType: 'triangle', filterCutoff: 1500, filterResonance: 1, attack: 0.002, decay: 0.1, sustain: 0.2, release: 0.15, lfoRate: 5, lfoFilterMod: 0, lfoPitchMod: 0, hpfCutoff: 10, junoChorus: 0, noiseLevel: 0, filterType: 'lowpass', filterDrive: 0.2, unisonVoices: 1, subOscLevel: 0, glideTime: 0 },
  Pads: { oscType: 'sine', filterCutoff: 800, filterResonance: 1, attack: 0.4, decay: 0.3, sustain: 0.8, release: 0.8, lfoRate: 5, lfoFilterMod: 0, lfoPitchMod: 0, hpfCutoff: 10, junoChorus: 1, noiseLevel: 0, filterType: 'lowpass', filterDrive: 0, unisonVoices: 3, unisonDetune: 15, unisonStereoWidth: 0.8, subOscLevel: 0.2, glideTime: 0.1 },
  Lead: { oscType: 'sawtooth', filterCutoff: 2000, filterResonance: 1, attack: 0.02, decay: 0.1, sustain: 0.7, release: 0.15, lfoRate: 5, lfoFilterMod: 0, lfoPitchMod: 0, hpfCutoff: 10, junoChorus: 0, noiseLevel: 0, filterType: 'lowpass', filterDrive: 0.1, unisonVoices: 1, subOscLevel: 0, glideTime: 0.08 },
  Sampler: { oscType: 'sine', filterCutoff: 10000, filterResonance: 1, attack: 0.001, decay: 0.1, sustain: 1.0, release: 0.2, lfoRate: 5, lfoFilterMod: 0, lfoPitchMod: 0, hpfCutoff: 10, junoChorus: 0, noiseLevel: 0, filterType: 'lowpass', filterDrive: 0, unisonVoices: 1, subOscLevel: 0, glideTime: 0 },
};

const defaultInitialSong: Song = {
  bpm: 120,
  key: 'C',
  sections: generateSongSections(SONG_STRUCTURES[0], 'C', true),
  activeSectionId: ''
};
if (defaultInitialSong.sections.length > 0) {
  defaultInitialSong.activeSectionId = defaultInitialSong.sections[0].id;
}

export const useSession = () => {
  const [activeTab, setActiveTab] = useState<InstrumentType>('Drums');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [isChangingParam, setIsChangingParam] = useState(false);
  const [producerWeights, setProducerWeights] = useState<Record<string, number>>({
    quincy: 0.2, dre: 0.1, dilla: 0.2, dangelo: 0.1, steely: 0.1
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

  const { song, volumes, instrumentStates, songParams, editedMidi, sophisticationLevel, vibeSeed } = state;

  // Audio Engine Sync
  useEffect(() => {
    audioEngine.setBPM(song.bpm);
    audioEngine.setKey(song.key);
    audioEngine.updateMixer(volumes, instrumentStates);
    audioEngine.updateSongData(song);
    audioEngine.updateInstrumentStates(instrumentStates);
  }, [song, volumes, instrumentStates]);

  useEffect(() => {
    if (isPlaying) {
      audioEngine.start();
    } else {
      audioEngine.stop();
    }
  }, [isPlaying]);

  // Persistence
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

  useEffect(() => {
    if (!user || isChangingParam) return;
    const timer = setTimeout(async () => {
      setSaveStatus('saving');
      try {
        const id = sessionId 
          ? await saveSession(user.uid, "Untitled Session", song, instrumentStates, sessionId)
          : await saveSession(user.uid, "Untitled Session", song, instrumentStates);
        if (id) setSessionId(id);
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 3000);
      } catch (e) {
        setSaveStatus('error');
      }
    }, 5000);
    return () => clearTimeout(timer);
  }, [song, instrumentStates, user, isChangingParam]);

  const handleMasterRandomize = useCallback((keepSampler = false) => {
    // Note: sophisticationLevel and vibeSeed should be incorporated into the generation logic
    // For now we match the service signature: (instrumentStates, song, trials, lockedKeys)
    const { song: newSong, instrumentStates: newStates } = performSmartRandomize(
      instrumentStates,
      song,
      8, // trials
      keepSampler ? ['vibe'] : [] // sample/vibe locking heuristic
    );
    set(prev => ({ ...prev, song: newSong, instrumentStates: newStates }));
  }, [song, instrumentStates, sophisticationLevel, vibeSeed, set]);

  const updateSynthParam = (instrument: Exclude<InstrumentType, 'Drums'>, key: string, val: any) => {
    set(prev => ({
      ...prev,
      instrumentStates: {
        ...prev.instrumentStates,
        [instrument]: {
          ...prev.instrumentStates[instrument],
          synthParams: { ...prev.instrumentStates[instrument].synthParams, [key]: val }
        }
      }
    }), isChangingParam);
  };

  const updateVolume = (inst: InstrumentType, vol: number) => {
    set(prev => ({
      ...prev,
      volumes: { ...prev.volumes, [inst]: vol }
    }), isChangingParam);
  };

  const updateInstrumentEnabled = (inst: InstrumentType, enabled: boolean) => {
    set(prev => ({
      ...prev,
      instrumentStates: {
        ...prev.instrumentStates,
        [inst]: { ...prev.instrumentStates[inst], enabled }
      }
    }));
  };

  const applyFix = useCallback((issue: any) => {
    const result = applyTheoryFix(issue, song.sections.find(s => s.id === song.activeSectionId)?.chords || [], song.key, instrumentStates);
    if (result.nextChords) {
      set(prev => ({
        ...prev,
        song: {
          ...prev.song,
          sections: prev.song.sections.map(s => s.id === prev.song.activeSectionId ? { ...s, chords: result.nextChords! } : s)
        }
      }));
    }
    if (result.nextInstrumentStates) {
      set(prev => ({ ...prev, instrumentStates: result.nextInstrumentStates! }));
    }
  }, [song, instrumentStates, set]);

  return {
    state,
    activeTab,
    setActiveTab,
    isPlaying,
    setIsPlaying,
    isListening,
    setIsListening,
    producerWeights,
    setProducerWeights,
    handleMasterRandomize,
    updateSynthParam,
    updateVolume,
    updateInstrumentEnabled,
    applyFix,
    undo,
    redo,
    canUndo,
    canRedo,
    saveStatus,
    setIsChangingParam,
    setSong: (newSong: Song | ((prev: Song) => Song)) => set(prev => ({ ...prev, song: typeof newSong === 'function' ? newSong(prev.song) : newSong })),
    setSongParams: (params: Partial<SessionParameters>) => set(prev => ({ ...prev, songParams: { ...prev.songParams, ...params } }))
  };
};
