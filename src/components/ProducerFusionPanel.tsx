/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { PRODUCER_PROFILES } from '../data/producers';
import { ProducerProfile } from '../types/producer';
import { cn } from '../lib/utils';
import { Brain, Users, Zap, Hash } from 'lucide-react';

interface ProducerFusionPanelProps {
  weights: Record<string, number>;
  onUpdateWeights: (weights: Record<string, number>) => void;
  fusedProfile: ProducerProfile;
}

export const ProducerFusionPanel: React.FC<ProducerFusionPanelProps> = ({
  weights,
  onUpdateWeights,
  fusedProfile
}) => {
  const handleWeightChange = (id: string, value: number) => {
    onUpdateWeights({
      ...weights,
      [id]: value
    });
  };

  return (
    <div className="flex flex-col gap-4 p-4 bg-[#0a0a0c] border-b border-studio-border/30">
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] font-mono text-studio-muted uppercase tracking-[0.2em] flex items-center gap-2">
          <Users className="w-3 h-3 text-studio-accent" /> Producer Fusion Engine
        </h3>
        <div className="flex gap-1">
          {fusedProfile.signature.tags.slice(0, 2).map(tag => (
            <span key={tag} className="px-1.5 py-0.5 rounded bg-studio-accent/10 text-studio-accent text-[8px] font-mono border border-studio-accent/20">
              #{tag.replace('_', ' ')}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {Object.values(PRODUCER_PROFILES).map((producer) => (
          <div key={producer.id} className="space-y-1.5 group">
            <div className="flex justify-between items-center text-[9px] font-mono">
              <span className="text-white/60 truncate group-hover:text-white transition-colors">{producer.name}</span>
              <span className={cn(
                "font-bold",
                weights[producer.id] > 0 ? "text-studio-accent" : "text-white/20"
              )}>
                {Math.round((weights[producer.id] || 0) * 100)}%
              </span>
            </div>
            <div className="relative h-1.5 bg-white/5 rounded-full overflow-hidden">
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={weights[producer.id] || 0}
                onChange={(e) => handleWeightChange(producer.id, parseFloat(e.target.value))}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
              <div 
                className="absolute inset-y-0 left-0 bg-studio-accent transition-all duration-300"
                style={{ width: `${(weights[producer.id] || 0) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Fused DNA Info */}
      <div className="flex items-center gap-6 mt-1 py-2 px-3 bg-white/[0.02] rounded-lg border border-white/[0.05]">
        <DNAStat label="Swing" value={fusedProfile.timing.swing} />
        <DNAStat label="Sync" value={fusedProfile.rhythm.syncopation} />
        <DNAStat label="Harm" value={fusedProfile.harmony.extensions_level} />
        <DNAStat label="Analog" value={fusedProfile.tone.analog_warmth} />
        <div className="ml-auto flex items-center gap-2">
          <Brain className="w-3 h-3 text-studio-green animate-pulse" />
          <span className="text-[9px] font-mono text-studio-muted uppercase tracking-tighter">Fused DNA Active</span>
        </div>
      </div>
    </div>
  );
};

const DNAStat = ({ label, value }: { label: string, value: number }) => (
  <div className="flex flex-col">
    <span className="text-[8px] font-mono text-studio-muted uppercase leading-none mb-1">{label}</span>
    <div className="flex items-center gap-1.5">
      <div className="w-8 h-1 bg-white/5 rounded-full overflow-hidden">
        <div className="h-full bg-studio-accent" style={{ width: `${value * 100}%` }} />
      </div>
      <span className="text-[8px] font-mono text-white/80">{Math.round(value * 100)}</span>
    </div>
  </div>
);
