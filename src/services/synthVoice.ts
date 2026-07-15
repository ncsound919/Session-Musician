/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SynthParams } from '../types';
import { applyJunoChorus } from './audioUtils';
import { buildOscBank } from './oscBank';
import { buildFilterStage } from './filterStage';
import { ADSRBuilder, LFOBuilder } from './synthEngine';

export interface VoiceInstrumentDefaults {
  oscType: OscillatorType;
  filterCutoff: number;
  filterResonance?: number;
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  velocityTrim: number;
  vibrato?: boolean; 
}

interface GlideVoiceState {
  oscillators: OscillatorNode[];
  subOsc?: OscillatorNode;
  lastFreq: number;
}
const glideVoices = new Map<string, GlideVoiceState>();

export function playVoiceCore(
  ctx: AudioContext,
  instrumentKey: string,
  midi: number,
  time: number,
  duration: number,
  velFraction: number,
  destination: AudioNode,
  defaults: VoiceInstrumentDefaults,
  params: SynthParams | undefined,
  onPlay?: (node: OscillatorNode) => void
): void {
  const freq = 440 * Math.pow(2, (midi - 69) / 12);
  const glideTime = Math.max(0, params?.glideTime ?? 0);

  // 1. Oscillator bank
  const oscSum = ctx.createGain();
  oscSum.gain.setValueAtTime(1, time);
  const oscBank = buildOscBank(ctx, oscSum, freq, time, params, defaults.oscType);

  if (glideTime > 0) {
    const prior = glideVoices.get(instrumentKey);
    if (prior) {
      oscBank.oscillators.forEach((osc) => {
        osc.frequency.cancelScheduledValues(time);
        osc.frequency.setValueAtTime(prior.lastFreq, time);
      });
      oscBank.setFrequency(freq, time, glideTime);
    }
    glideVoices.set(instrumentKey, { oscillators: oscBank.oscillators, subOsc: oscBank.subOsc, lastFreq: freq });
  }

  // 2. HPF pre-stage
  const hpf = ctx.createBiquadFilter();
  hpf.type = 'highpass';
  hpf.frequency.setValueAtTime(Math.max(10, params?.hpfCutoff ?? 10), time);
  hpf.Q.setValueAtTime(0.707, time);
  oscSum.connect(hpf);

  // 3. Filter stage
  const baseCutoff = params?.filterCutoff ?? defaults.filterCutoff;
  const filterStage = buildFilterStage(ctx, params, baseCutoff, time);
  hpf.connect(filterStage.input);

  const envAmountRaw = params?.filterEnvAmount ?? params?.envFilterMod ?? 0;
  const envAmountHz = envAmountRaw * 8000;
  filterStage.applyEnvelope(
    time,
    params?.filterAttack ?? params?.attack ?? defaults.attack,
    params?.filterDecay ?? params?.decay ?? defaults.decay,
    params?.filterSustain ?? params?.sustain ?? defaults.sustain,
    params?.filterRelease ?? params?.release ?? defaults.release,
    duration,
    baseCutoff,
    envAmountHz
  );

  // 4. LFO
  const lfoRate = params?.lfoRate ?? 5;
  const pitchModDepth = params?.lfoPitchMod ?? 0;
  const filterModDepth = params?.lfoFilterMod ?? 0;
  const lfoBuilder = new LFOBuilder();

  if (pitchModDepth > 0) {
    const pitchLfo = lfoBuilder.create(ctx, 'sine', lfoRate, pitchModDepth * 50, time, duration);
    oscBank.oscillators.forEach((osc) => pitchLfo.gain.connect(osc.detune));
    if (oscBank.subOsc) pitchLfo.gain.connect(oscBank.subOsc.detune);
  }
  if (filterModDepth > 0) {
    const filterLfo = lfoBuilder.create(ctx, 'sine', lfoRate, filterModDepth * 1500, time, duration);
    filterLfo.gain.connect(filterStage.filterNode.frequency);
  }

  // 5. Amp ADSR
  const ampGain = ctx.createGain();
  const adsr = new ADSRBuilder();
  adsr.apply(
    ampGain,
    time,
    params?.attack ?? defaults.attack,
    params?.decay ?? defaults.decay,
    params?.sustain ?? defaults.sustain,
    params?.release ?? defaults.release,
    duration,
    velFraction * defaults.velocityTrim
  );
  filterStage.output.connect(ampGain);

  // 6. Legacy vibrato
  if (defaults.vibrato && pitchModDepth === 0) {
    const vibrato = lfoBuilder.create(ctx, 'sine', 6, 3, time, duration);
    oscBank.oscillators.forEach((osc) => vibrato.gain.connect(osc.detune));
  }

  // 7. Juno chorus
  const chorusLevel = params?.junoChorus ?? 0;
  applyJunoChorus(ctx, ampGain, destination, chorusLevel, time, duration);

  // 8. Lifecycle
  const stopTime = time + duration + (params?.release ?? defaults.release) + 0.05;
  oscBank.oscillators.forEach((osc) => {
    if (onPlay) onPlay(osc);
  });
  oscBank.stop(stopTime);
}

// ──── Instrument Wrappers ────

export function playBassVoice(ctx: AudioContext, midi: number, time: number, duration: number, velFraction: number, destination: AudioNode, params?: SynthParams, onPlay?: (node: OscillatorNode) => void) {
  playVoiceCore(ctx, 'Bass', midi, time, duration, velFraction, destination, {
    oscType: 'sawtooth', filterCutoff: 350, attack: 0.01, decay: 0.15, sustain: 0.6, release: 0.2, velocityTrim: 0.4
  }, params, onPlay);
}

export function playKeysVoice(ctx: AudioContext, midi: number, time: number, duration: number, velFraction: number, destination: AudioNode, params?: SynthParams, onPlay?: (node: OscillatorNode) => void) {
  playVoiceCore(ctx, 'Keys', midi, time, duration, velFraction, destination, {
    oscType: 'triangle', filterCutoff: 1200, attack: 0.005, decay: 0.2, sustain: 0.4, release: 0.2, velocityTrim: 0.35
  }, params, onPlay);
}

export function playGuitarVoice(ctx: AudioContext, midi: number, time: number, duration: number, velFraction: number, destination: AudioNode, params?: SynthParams, onPlay?: (node: OscillatorNode) => void) {
  playVoiceCore(ctx, 'Guitar', midi, time, duration, velFraction, destination, {
    oscType: 'triangle', filterCutoff: 1500, attack: 0.002, decay: 0.1, sustain: 0.2, release: 0.15, velocityTrim: 0.3
  }, params, onPlay);
}

export function playPadsVoice(ctx: AudioContext, midi: number, time: number, duration: number, velFraction: number, destination: AudioNode, params?: SynthParams, onPlay?: (node: OscillatorNode) => void) {
  playVoiceCore(ctx, 'Pads', midi, time, duration, velFraction, destination, {
    oscType: 'sine', filterCutoff: 800, attack: 0.4, decay: 0.3, sustain: 0.8, release: 0.8, velocityTrim: 0.25
  }, params, onPlay);
}

export function playLeadVoice(ctx: AudioContext, midi: number, time: number, duration: number, velFraction: number, destination: AudioNode, params?: SynthParams, onPlay?: (node: OscillatorNode) => void) {
  playVoiceCore(ctx, 'Lead', midi, time, duration, velFraction, destination, {
    oscType: 'sawtooth', filterCutoff: 2000, attack: 0.02, decay: 0.1, sustain: 0.7, release: 0.15, velocityTrim: 0.3, vibrato: true
  }, params, onPlay);
}
