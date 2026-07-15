/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SynthParams } from '../types';

// ──── Oscillator Bank ────
// Builds a unison stack + optional sub-oscillator + optional noise,
// all summed into a single provided destination gain node.

export interface OscBankHandle {
  oscillators: OscillatorNode[];       // main unison stack
  subOsc?: OscillatorNode;
  noiseSource?: AudioBufferSourceNode;
  pwmOscB?: OscillatorNode[];          // secondary saw stack for PWM subtraction trick
  stop: (time: number) => void;
  setFrequency: (freq: number, time: number, glideTime: number) => void;
}

let cachedNoiseBuffer: AudioBuffer | null = null;
function getNoiseBuffer(ctx: AudioContext): AudioBuffer {
  // White noise, cached per-context-lifetime; cheap and avoids CPU churn on every note-on.
  if (cachedNoiseBuffer && cachedNoiseBuffer.sampleRate === ctx.sampleRate) {
    return cachedNoiseBuffer;
  }
  const length = ctx.sampleRate * 2; // 2s loopable buffer
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  cachedNoiseBuffer = buffer;
  return buffer;
}

export function buildOscBank(
  ctx: AudioContext,
  destination: AudioNode,
  freq: number,
  time: number,
  params: SynthParams | undefined,
  defaultOscType: OscillatorType
): OscBankHandle {
  const oscType = params?.oscType ?? defaultOscType;
  const unisonVoices = Math.max(1, Math.min(7, Math.round(params?.unisonVoices ?? 1)));
  const unisonDetuneCents = params?.unisonDetune ?? 0;
  const stereoWidth = Math.max(0, Math.min(1, params?.unisonStereoWidth ?? 0));
  const usePwm = oscType === 'square' && (params?.pwmAmount ?? 0) > 0;

  const oscillators: OscillatorNode[] = [];
  const pwmOscB: OscillatorNode[] = [];

  // Splitter gain per unison voice keeps mixed level constant regardless of voice count
  const unisonTrim = 1 / Math.sqrt(unisonVoices);

  for (let i = 0; i < unisonVoices; i++) {
    // Spread voices symmetrically around center: e.g. 3 voices -> [-1, 0, 1] * detune
    const spread = unisonVoices === 1 ? 0 : (i / (unisonVoices - 1)) * 2 - 1;
    const detune = spread * unisonDetuneCents;

    const osc = ctx.createOscillator();
    osc.type = usePwm ? 'sawtooth' : oscType;
    osc.frequency.setValueAtTime(Math.max(1, freq), time);
    osc.detune.setValueAtTime(detune, time);

    const voiceGain = ctx.createGain();
    voiceGain.gain.setValueAtTime(unisonTrim, time);

    if (stereoWidth > 0 && unisonVoices > 1) {
      const panner = ctx.createStereoPanner();
      panner.pan.setValueAtTime(spread * stereoWidth, time);
      osc.connect(voiceGain);
      voiceGain.connect(panner);
      panner.connect(destination);
    } else {
      osc.connect(voiceGain);
      voiceGain.connect(destination);
    }

    osc.start(time);
    oscillators.push(osc);

    if (usePwm) {
      // Second saw, phase-inverted, pulse-width-scaled second saw.
      const oscB = ctx.createOscillator();
      oscB.type = 'sawtooth';
      oscB.frequency.setValueAtTime(Math.max(1, freq), time);
      oscB.detune.setValueAtTime(detune, time);

      const invert = ctx.createGain();
      invert.gain.setValueAtTime(-1 * (params?.pwmAmount ?? 0.5), time);

      oscB.connect(invert);
      invert.connect(voiceGain);
      oscB.start(time);
      pwmOscB.push(oscB);
    }
  }

  // Sub-oscillator: plain sine, one or two octaves down
  let subOsc: OscillatorNode | undefined;
  const subLevel = params?.subOscLevel ?? 0;
  if (subLevel > 0) {
    const octaveDown = params?.subOscOctave === -2 ? 4 : 2;
    subOsc = ctx.createOscillator();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(Math.max(1, freq / octaveDown), time);
    const subGain = ctx.createGain();
    subGain.gain.setValueAtTime(subLevel, time);
    subOsc.connect(subGain);
    subGain.connect(destination);
    subOsc.start(time);
  }

  // Noise mixer
  let noiseSource: AudioBufferSourceNode | undefined;
  const noiseLevel = params?.noiseLevel ?? 0;
  if (noiseLevel > 0) {
    noiseSource = ctx.createBufferSource();
    noiseSource.buffer = getNoiseBuffer(ctx);
    noiseSource.loop = true;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(noiseLevel * 0.5, time);
    noiseSource.connect(noiseGain);
    noiseGain.connect(destination);
    noiseSource.start(time);
  }

  return {
    oscillators,
    subOsc,
    noiseSource,
    pwmOscB,
    setFrequency: (newFreq: number, t: number, glideTime: number) => {
      const targets = [...oscillators, ...pwmOscB];
      targets.forEach((osc) => {
        if (glideTime > 0) {
          osc.frequency.cancelScheduledValues(t);
          osc.frequency.setTargetAtTime(Math.max(1, newFreq), t, glideTime / 3);
        } else {
          osc.frequency.setValueAtTime(Math.max(1, newFreq), t);
        }
      });
      if (subOsc) {
        const octaveDown = params?.subOscOctave === -2 ? 4 : 2;
        const subFreq = Math.max(1, newFreq / octaveDown);
        if (glideTime > 0) {
          subOsc.frequency.cancelScheduledValues(t);
          subOsc.frequency.setTargetAtTime(subFreq, t, glideTime / 3);
        } else {
          subOsc.frequency.setValueAtTime(subFreq, t);
        }
      }
    },
    stop: (stopTime: number) => {
      [...oscillators, ...pwmOscB].forEach((osc) => {
        try { osc.stop(stopTime); } catch { /* already stopped */ }
      });
      if (subOsc) {
        try { subOsc.stop(stopTime); } catch { /* already stopped */ }
      }
      if (noiseSource) {
        try { noiseSource.stop(stopTime); } catch { /* already stopped */ }
      }
    },
  };
}
