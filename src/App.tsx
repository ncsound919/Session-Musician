/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Activity, 
  Cpu, 
  Waves,
  Keyboard,
  Sliders,
  Shuffle,
  Users
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import JSZip from 'jszip';

// Types & Hooks
import { 
  InstrumentType, 
  StylePreset,
  SONG_STRUCTURES
} from './types';
import { useSession } from './hooks/useSession';

// Components
import { Sidebar } from './components/Layout/Sidebar';
import { AppHeader } from './components/Layout/AppHeader'; // Wait, I named it AppHeader.tsx in components/Layout/
import { ErrorBoundary } from './components/ErrorBoundary';

// Views
import { PerformView } from './components/Views/PerformView';
import { TheoryView } from './components/Views/TheoryView';
import { MixerView } from './components/Views/MixerView';
import { SynthView } from './components/Views/SynthView';
import { SettingsView } from './components/Views/SettingsView';
import { ProducerFusionView } from './components/ProducerFusionView';

// Services
import { exportMidi } from './services/midiExport';
import { applyTheoryFix } from './services/musicTheoryEngine';

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

export default function App() {
  const {
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
    undo,
    redo,
    canUndo,
    canRedo,
    saveStatus,
    setIsChangingParam,
    setSong,
    setSongParams,
    applyFix
  } = useSession();

  const [contentTab, setContentTab] = useState<ContentTab>('perform');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<StylePreset | null>(null);
  const [inspirationStatus, setInspirationStatus] = useState<string | null>(null);

  const { song, volumes, instrumentStates, editedMidi } = state;

  return (
    <ErrorBoundary>
      <div className="flex h-screen bg-studio-bg text-white overflow-hidden font-sans selection:bg-studio-accent/30">
        <Sidebar 
          contentTab={contentTab}
          onContentTabChange={setContentTab}
          isSidebarCollapsed={isSidebarCollapsed}
          setIsSidebarCollapsed={setIsSidebarCollapsed}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          instruments={INSTRUMENTS}
        />

        <div className="flex-1 flex flex-col min-w-0 relative">
          <AppHeader 
            isPlaying={isPlaying}
            isListening={isListening}
            onPlayToggle={() => setIsPlaying(!isPlaying)}
            onListenToggle={() => setIsListening(!isListening)}
            onUndo={undo}
            onRedo={redo}
            canUndo={canUndo}
            canRedo={canRedo}
            bpm={song.bpm}
            songKey={song.key}
            saveStatus={saveStatus}
          />

          <main className="flex-1 overflow-y-auto p-8 custom-scrollbar relative">
            <AnimatePresence mode="wait">
              <motion.div
                key={contentTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="max-w-[1600px] mx-auto"
              >
                {contentTab === 'perform' && (
                  <PerformView 
                    activeTab={activeTab}
                    instrumentStates={instrumentStates}
                    xyModes={{ Drums: 'Groove', Bass: 'Density', Keys: 'Harmony', Guitar: 'Strum', Pads: 'Swell', Lead: 'Licks', Sampler: 'Chop' }}
                    volumes={volumes}
                    onXyChange={() => {}}
                    onLiveAction={() => {}}
                    onUpdateVolume={updateVolume}
                    onMasterRandomize={handleMasterRandomize}
                    onTabChange={setActiveTab}
                    liveActions={LIVE_ACTIONS[activeTab]}
                    editedMidi={editedMidi}
                    song={song}
                  />
                )}
                {contentTab === 'theory' && (
                  <TheoryView 
                    song={song}
                    songParams={state.songParams}
                    onSongUpdate={setSong}
                    onSongParamsUpdate={setSongParams}
                    onRegenerateChords={() => handleMasterRandomize()}
                    onApplyTheoryFix={applyFix}
                    activeSectionId={song.activeSectionId}
                  />
                )}
                {contentTab === 'mix' && (
                  <MixerView 
                    instruments={INSTRUMENTS}
                    instrumentStates={instrumentStates}
                    volumes={volumes}
                    onUpdateVolume={updateVolume}
                    onUpdateState={updateInstrumentEnabled}
                    onUpdateSynthParam={updateSynthParam}
                  />
                )}
                {contentTab === 'synth' && (
                  <SynthView 
                    activeTab={activeTab}
                    instrumentStates={instrumentStates}
                    onUpdateSynthParam={updateSynthParam}
                    onUpdateDrumKit={() => {}}
                    onTabChange={setActiveTab}
                  />
                )}
                {contentTab === 'fusion' && (
                  <ProducerFusionView 
                    weights={producerWeights}
                    onWeightsChange={setProducerWeights}
                  />
                )}
                {contentTab === 'settings' && (
                  <SettingsView 
                    onMasterRandomize={handleMasterRandomize}
                    onExportMidi={() => exportMidi(song, editedMidi)}
                    onExportZip={async () => {
                      const zip = new JSZip();
                      zip.file("session.json", JSON.stringify({ song, instrumentStates, volumes }));
                      const content = await zip.generateAsync({ type: "blob" });
                      const url = URL.createObjectURL(content);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `juno-session-${Date.now()}.zip`;
                      a.click();
                    }}
                    onUndo={undo}
                    onRedo={redo}
                    canUndo={canUndo}
                    canRedo={canRedo}
                    onInspirationUpload={() => {}}
                    inspirationStatus={inspirationStatus}
                    selectedPreset={selectedPreset}
                    onSelectPreset={setSelectedPreset}
                    songParams={state.songParams}
                    onUpdateSongParams={setSongParams}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>
    </ErrorBoundary>
  );
}
