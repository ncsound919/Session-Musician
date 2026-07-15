/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { PRODUCER_PROFILES } from '../data/producers';
import { ProducerProfile } from '../types/producer';
import { cn } from '../lib/utils';
import { Brain, Users, Zap, Hash, Sliders, Activity, Info, Sparkles, ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';

interface ProducerFusionViewProps {
  weights: Record<string, number>;
  onUpdateWeights: (weights: Record<string, number>) => void;
  fusedProfile: ProducerProfile;
}

export const ProducerFusionView: React.FC<ProducerFusionViewProps> = ({
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
    <div className="flex-1 flex flex-col bg-[#0a0a0c] overflow-y-auto">
      {/* Hero Header */}
      <div className="p-8 border-b border-white/[0.05] relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-20 pointer-events-none">
          <Brain className="w-64 h-64 text-studio-accent animate-pulse" />
        </div>
        
        <div className="relative z-10 max-w-4xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-studio-accent/20 rounded-xl">
              <Users className="w-6 h-6 text-studio-accent" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white tracking-tight">Producer Fusion Engine</h1>
              <p className="text-studio-muted font-mono text-[10px] uppercase tracking-[0.3em]">Neural Influence Blending v2.0</p>
            </div>
          </div>
          
          <p className="text-white/60 text-sm max-w-2xl leading-relaxed mb-8">
            The Fusion Engine mathematically blends the musical DNA of legendary producers. 
            Adjust the weights below to guide the AI's orchestration, timing, and harmonic complexity.
          </p>

          <div className="flex flex-wrap gap-2">
            {fusedProfile.signature.tags.map(tag => (
              <span key={tag} className="px-3 py-1 rounded-full bg-studio-accent/10 text-studio-accent text-[10px] font-mono border border-studio-accent/20 flex items-center gap-2">
                <Hash className="w-3 h-3" /> {tag.replace('_', ' ')}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="p-8 max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Sliders */}
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-6">
            <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
              <Sliders className="w-5 h-5 text-studio-accent" /> Influence Mix
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
              {Object.values(PRODUCER_PROFILES).map((producer) => (
                <div key={producer.id} className="space-y-4">
                  <div className="flex justify-between items-end">
                    <div>
                      <h3 className="text-sm font-bold text-white mb-0.5">{producer.name}</h3>
                      <div className="flex gap-1">
                        {producer.signature.tags.slice(0, 2).map(t => (
                          <span key={t} className="text-[8px] font-mono text-studio-muted uppercase">{t}</span>
                        ))}
                      </div>
                    </div>
                    <span className={cn(
                      "text-xl font-mono font-bold transition-all",
                      weights[producer.id] > 0 ? "text-studio-accent scale-110" : "text-white/10"
                    )}>
                      {Math.round((weights[producer.id] || 0) * 100)}%
                    </span>
                  </div>
                  
                  <div className="relative pt-2">
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={weights[producer.id] || 0}
                      onChange={(e) => handleWeightChange(producer.id, parseFloat(e.target.value))}
                      className="w-full h-2 bg-white/5 rounded-lg appearance-none cursor-pointer accent-studio-accent"
                    />
                    <div className="flex justify-between mt-2 text-[8px] font-mono text-white/20 uppercase tracking-widest">
                      <span>Subtle</span>
                      <span>Dominant</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <DNASection title="Timing & Feel" icon={<Activity className="w-4 h-4" />}>
              <DNAMetric label="Swing Intensity" value={fusedProfile.timing.swing} />
              <DNAMetric label="Micro Variance" value={fusedProfile.timing.micro_variance_ms / 20} />
              <DNAMetric label="Pocket Deviation" value={Math.abs(fusedProfile.timing.snare_offset_ms) / 10} />
            </DNASection>
            
            <DNASection title="Harmonic Engine" icon={<Sparkles className="w-4 h-4" />}>
              <DNAMetric label="Extension Depth" value={fusedProfile.harmony.extensions_level} />
              <DNAMetric label="Jazz Influence" value={fusedProfile.harmony.jazz_influence} />
              <DNAMetric label="Modal Complexity" value={fusedProfile.harmony.dark_modal_bias} />
            </DNASection>

            <DNASection title="Rhythm DNA" icon={<Zap className="w-4 h-4" />}>
              <DNAMetric label="Groove Density" value={fusedProfile.rhythm.groove_density} />
              <DNAMetric label="Syncopation" value={fusedProfile.rhythm.syncopation} />
              <DNAMetric label="Loop Bias" value={fusedProfile.rhythm.loop_based ? 1 : 0} />
            </DNASection>

            <DNASection title="Sonic Profile" icon={<Activity className="w-4 h-4" />}>
              <DNAMetric label="Analog Warmth" value={fusedProfile.tone.analog_warmth} />
              <DNAMetric label="Digital Sheen" value={fusedProfile.tone.digital_sheen} />
              <DNAMetric label="Vinyl Saturation" value={fusedProfile.tone.vinyl_dust} />
            </DNASection>
          </div>
        </div>

        {/* Right Column: Fused DNA & Profile */}
        <div className="space-y-6">
          <div className="bg-studio-accent/5 border border-studio-accent/20 rounded-2xl p-6 sticky top-8">
            <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
              <Brain className="w-5 h-5 text-studio-accent" /> Fused Profile DNA
            </h2>
            
            <div className="space-y-6">
              <div className="p-4 bg-black/40 rounded-xl border border-white/5 space-y-3">
                <div className="flex justify-between text-[10px] font-mono text-studio-muted uppercase tracking-wider">
                  <span>Current Archetype</span>
                  <span className="text-studio-accent font-bold">ACTIVE</span>
                </div>
                <div className="text-xl font-bold text-white">
                  {getArchetypeName(fusedProfile)}
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-[10px] font-mono text-studio-muted uppercase tracking-[0.2em]">Top Influences</h3>
                {(Object.entries(weights) as [string, number][])
                  .filter(([_, w]) => w > 0)
                  .sort((a, b) => b[1] - a[1])
                  .map(([id, weight]) => (
                    <div key={id} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-[10px] font-bold text-studio-accent border border-studio-accent/20">
                        {Math.round(weight * 100)}%
                      </div>
                      <div className="flex-1">
                        <div className="text-xs font-bold text-white">{PRODUCER_PROFILES[id].name}</div>
                        <div className="h-1 w-full bg-white/5 rounded-full mt-1 overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${weight * 100}%` }}
                            className="h-full bg-studio-accent" 
                          />
                        </div>
                      </div>
                    </div>
                  ))
                }
              </div>

              <div className="pt-6 border-t border-white/10">
                <div className="flex items-center gap-2 mb-4">
                  <Info className="w-3.5 h-3.5 text-studio-accent" />
                  <span className="text-[10px] font-mono text-studio-muted uppercase">Blending Logic</span>
                </div>
                <p className="text-[11px] text-white/50 leading-relaxed italic">
                  "The engine is currently interpolating the syncopation vectors of {getTopProducerName(weights)} with the harmonic sophistication of {getSecondProducerName(weights)}."
                </p>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

const DNASection = ({ title, icon, children }: { title: string, icon: React.ReactNode, children: React.ReactNode }) => (
  <div className="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-5">
    <div className="flex items-center gap-2 mb-4">
      <div className="text-studio-accent">{icon}</div>
      <h3 className="text-xs font-mono uppercase tracking-[0.2em] text-white/80">{title}</h3>
    </div>
    <div className="space-y-4">
      {children}
    </div>
  </div>
);

const DNAMetric = ({ label, value }: { label: string, value: number }) => (
  <div className="space-y-1.5">
    <div className="flex justify-between text-[10px] font-mono">
      <span className="text-studio-muted">{label}</span>
      <span className="text-white">{Math.round(value * 100)}%</span>
    </div>
    <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
      <motion.div 
        initial={{ width: 0 }}
        animate={{ width: `${value * 100}%` }}
        className="h-full bg-studio-accent/50" 
      />
    </div>
  </div>
);

function getArchetypeName(profile: ProducerProfile): string {
  const tags = profile.signature.tags;
  if (tags.includes('g-funk') && tags.includes('soulquarian')) return 'Atmospheric G-Soul';
  if (tags.includes('boom_bap') && tags.includes('neo_soul')) return 'J Dilla Spirit';
  if (tags.includes('hi-fi') && tags.includes('smooth')) return 'Polished Yacht-Soul';
  if (tags.includes('orchestral') && tags.includes('jazz')) return 'Cinematic Jazz Hybrid';
  return 'Evolved Hybrid Engine';
}

function getTopProducerName(weights: Record<string, number>): string {
  const top = (Object.entries(weights) as [string, number][]).sort((a, b) => b[1] - a[1])[0];
  return top ? PRODUCER_PROFILES[top[0]]?.name : 'the collective';
}

function getSecondProducerName(weights: Record<string, number>): string {
  const sorted = (Object.entries(weights) as [string, number][]).sort((a, b) => b[1] - a[1]);
  return sorted[1] ? PRODUCER_PROFILES[sorted[1][0]]?.name : 'the collective';
}
