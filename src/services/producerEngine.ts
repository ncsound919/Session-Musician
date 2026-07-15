/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ProducerProfile, ProducerTiming, ProducerHarmony, ProducerRhythm, ProducerTone, ProducerArrangement, ProducerMix } from '../types/producer';
import { PRODUCER_PROFILES } from '../data/producers';

export class ProducerEngine {
  /**
   * Blends multiple producer profiles based on provided weights.
   */
  static blendProfiles(weights: Record<string, number>): ProducerProfile {
    const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
    
    // Default profile if no weights or total is zero
    const defaultProfile = PRODUCER_PROFILES['quincy'];
    if (totalWeight === 0) return { ...defaultProfile, id: 'fusion', name: 'Fusion Engine' };

    const normalized = Object.entries(weights).reduce((acc, [id, w]) => {
      acc[id] = w / totalWeight;
      return acc;
    }, {} as Record<string, number>);

    const fusion: ProducerProfile = {
      id: 'fusion',
      name: 'Fusion Engine',
      timing: this.blendSection('timing', normalized) as ProducerTiming,
      harmony: this.blendSection('harmony', normalized) as ProducerHarmony,
      rhythm: this.blendSection('rhythm', normalized) as ProducerRhythm,
      tone: this.blendSection('tone', normalized) as ProducerTone,
      arrangement: this.blendSection('arrangement', normalized) as ProducerArrangement,
      mix: this.blendSection('mix', normalized) as ProducerMix,
      signature: {
        tags: this.blendListField('signature', 'tags', normalized)
      }
    };

    return fusion;
  }

  private static blendSection(section: keyof ProducerProfile, normalizedWeights: Record<string, number>): any {
    const result: any = {};
    const firstProfile = Object.values(PRODUCER_PROFILES)[0];
    const fields = Object.keys((firstProfile as any)[section]);

    fields.forEach(field => {
      const firstVal = (firstProfile as any)[section][field];
      
      if (typeof firstVal === 'number') {
        let blended = 0;
        Object.entries(normalizedWeights).forEach(([id, w]) => {
          const profile = PRODUCER_PROFILES[id];
          if (profile) {
            blended += (profile as any)[section][field] * w;
          }
        });
        result[field] = blended;
      } else if (Array.isArray(firstVal)) {
        result[field] = this.blendListField(section, field, normalizedWeights);
      } else if (typeof firstVal === 'boolean') {
        let score = 0;
        Object.entries(normalizedWeights).forEach(([id, w]) => {
          const profile = PRODUCER_PROFILES[id];
          if (profile && (profile as any)[section][field]) {
            score += w;
          }
        });
        result[field] = score > 0.5;
      }
    });

    return result;
  }

  private static blendListField(section: string, field: string, normalizedWeights: Record<string, number>): string[] {
    const counts: Record<string, number> = {};
    Object.entries(normalizedWeights).forEach(([id, w]) => {
      const profile = PRODUCER_PROFILES[id];
      if (profile) {
        const list = (profile as any)[section][field] as string[];
        list.forEach(item => {
          counts[item] = (counts[item] || 0) + w;
        });
      }
    });

    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(entry => entry[0]);
  }
}
