/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SynthParams } from '../types';

export interface FilterStageHandle {
  input: AudioNode;
  output: AudioNode;
  filterNode: BiquadFilterNode;
  applyEnvelope: (
    time: number,
    attack: number,
    decay: number,
    sustain: number,
    release: number,
    duration: number,
    baseFreq: number,
    envAmountHz: number
  ) => void;
}

function makeDriveCurve(amount: number): Float32Array {
  const samples = 1024;
  const curve = new Float32Array(samples);
  const k = amount * 20;
  for (let i = 0; i < samples; i++) {
    const x = (i / (samples - 1)) * 2 - 1;
    curve[i] = k === 0 ? x : Math.tanh(x * (1 + k)) / Math.tanh(1 + k);
  }
  return curve;
}

export function buildFilterStage(
  ctx: AudioContext,
  params: SynthParams | undefined,
  baseCutoff: number,
  time: number
): FilterStageHandle {
  const filterType = params?.filterType ?? 'lowpass';
  const drive = Math.max(0, Math.min(1, params?.filterDrive ?? 0));
  const resonance = params?.filterResonance ?? 1;

  const preGain = ctx.createGain();
  preGain.gain.setValueAtTime(1 + drive * 1.5, time);

  const shaper = ctx.createWaveShaper();
  shaper.curve = drive > 0 ? makeDriveCurve(drive) : null;
  shaper.oversample = '4x';

  const filter = ctx.createBiquadFilter();
  filter.type = filterType;
  filter.frequency.setValueAtTime(Math.max(20, baseCutoff), time);
  filter.Q.setValueAtTime(Math.max(0.0001, resonance), time);

  const postTrim = ctx.createGain();
  postTrim.gain.setValueAtTime(drive > 0 ? 1 / (1 + drive * 0.6) : 1, time);

  if (drive > 0) {
    preGain.connect(shaper);
    shaper.connect(filter);
  } else {
    preGain.connect(filter);
  }
  filter.connect(postTrim);

  return {
    input: preGain,
    output: postTrim,
    filterNode: filter,
    applyEnvelope: (t, attack, decay, sustain, release, duration, baseFreq, envAmountHz) => {
      if (envAmountHz === 0) return;

      const freq = filter.frequency;
      const peak = Math.max(20, Math.min(20000, baseFreq + envAmountHz));
      const sustainFreq = Math.max(20, Math.min(20000, baseFreq + envAmountHz * sustain));
      const peakTime = t + Math.max(0, attack);
      const sustainStart = peakTime + Math.max(0, decay);
      const releaseStart = Math.max(peakTime, t + duration - Math.max(0, release));

      freq.cancelScheduledValues(t);
      freq.setValueAtTime(baseFreq, t);
      freq.linearRampToValueAtTime(peak, peakTime);
      if (sustainStart > peakTime) {
        freq.linearRampToValueAtTime(sustainFreq, sustainStart);
      }
      if (releaseStart > sustainStart) {
        freq.setValueAtTime(sustainFreq, releaseStart);
      }
      freq.linearRampToValueAtTime(baseFreq, t + duration);
    },
  };
}
