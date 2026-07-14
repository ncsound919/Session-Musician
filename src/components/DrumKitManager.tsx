/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Upload, Trash2, Music, Plus, Drum } from 'lucide-react';
import { DrumKit, DrumSample } from '../types';
import { cn } from '../lib/utils';
import { audioEngine } from '../services/audioEngine';

interface DrumKitManagerProps {
  currentKit?: DrumKit;
  onUpdateKit: (kit: DrumKit) => void;
}

const SAMPLE_TYPES: DrumSample['type'][] = ['Kick', 'Snare', 'HiHat', 'Tom', 'Cymbal', 'Percussion'];

export const DrumKitManager: React.FC<DrumKitManagerProps> = ({ currentKit, onUpdateKit }) => {
  const [kitName, setKitName] = React.useState(currentKit?.name || 'New Custom Kit');
  const [samples, setSamples] = React.useState<DrumSample[]>(currentKit?.samples || []);

  // Track all active blob: URLs so every one is revoked on unmount regardless of when it was added
  const activeUrlsRef = React.useRef<Set<string>>(new Set(currentKit?.samples.map(s => s.url) ?? []));

  React.useEffect(() => {
    return () => {
      activeUrlsRef.current.forEach(url => {
        URL.revokeObjectURL(url);
        audioEngine.evictSample(url);
      });
      activeUrlsRef.current.clear();
    };
  }, []);

  const revokeAndEvict = (url: string) => {
    URL.revokeObjectURL(url);
    audioEngine.evictSample(url);
    activeUrlsRef.current.delete(url);
  };

  const handleFileUpload = (type: DrumSample['type'], e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Revoke the old URL for this slot to avoid a memory leak
      const oldSample = samples.find(s => s.type === type);
      if (oldSample) revokeAndEvict(oldSample.url);

      const newUrl = URL.createObjectURL(file);
      activeUrlsRef.current.add(newUrl);
      const newSample: DrumSample = {
        id: crypto.randomUUID(),
        name: file.name,
        url: newUrl,
        type
      };
      const updatedSamples = [...samples.filter(s => s.type !== type), newSample];
      setSamples(updatedSamples);
      onUpdateKit({
        id: currentKit?.id || crypto.randomUUID(),
        name: kitName,
        samples: updatedSamples
      });
    }
  };

  const removeSample = (id: string) => {
    const sample = samples.find(s => s.id === id);
    if (sample) revokeAndEvict(sample.url);

    const updatedSamples = samples.filter(s => s.id !== id);
    setSamples(updatedSamples);
    onUpdateKit({
      id: currentKit?.id || crypto.randomUUID(),
      name: kitName,
      samples: updatedSamples
    });
  };

  return (
    <div className="space-y-3 rounded-xl p-4" style={{ background: '#121214', border: '1px solid #222224' }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Drum className="w-3.5 h-3.5 text-studio-accent" />
          <h3 className="text-[9px] font-mono text-studio-muted uppercase tracking-[0.15em]">Custom Drum Kit</h3>
        </div>
        <input 
          type="text"
          value={kitName}
          onChange={(e) => setKitName(e.target.value)}
          className="bg-transparent text-right text-[9px] font-mono text-studio-accent focus:outline-none border-b border-transparent focus:border-studio-accent/30"
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {SAMPLE_TYPES.map(type => {
          const sample = samples.find(s => s.type === type);
          return (
            <div key={type} className="space-y-1">
              <span className="text-[8px] font-mono text-studio-muted uppercase">{type}</span>
              <div className={cn(
                "relative group aspect-video rounded-lg flex flex-col items-center justify-center transition-all overflow-hidden"
              )}
              style={sample 
                ? { border: '1px solid rgba(99,102,241,0.3)', background: 'rgba(99,102,241,0.05)' }
                : { border: '1px dashed #222224' }
              }>
                {sample ? (
                  <>
                    <Music className="w-3.5 h-3.5 text-studio-accent mb-0.5" />
                    <span className="text-[7px] font-mono text-studio-accent truncate px-2 w-full text-center">
                      {sample.name}
                    </span>
                    <button 
                      onClick={() => removeSample(sample.id)}
                      className="absolute top-0.5 right-0.5 p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}
                    >
                      <Trash2 className="w-2.5 h-2.5" />
                    </button>
                  </>
                ) : (
                  <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer">
                    <Plus className="w-3.5 h-3.5 text-studio-muted group-hover:text-studio-accent transition-colors" />
                    <input 
                      type="file" 
                      className="hidden" 
                      accept="audio/*" 
                      onChange={(e) => handleFileUpload(type, e)} 
                    />
                  </label>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
