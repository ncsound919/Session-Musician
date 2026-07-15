/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SynthParams } from '../types';

/**
 * Applies a Juno-style chorus effect to an audio signal.
 */
export function applyJunoChorus(
  ctx: AudioContext,
  input: AudioNode,
  destination: AudioNode,
  level: number,
  time: number,
  duration: number
): void {
  if (!level) {
    input.connect(destination);
    return;
  }

  // Dry path
  input.connect(destination);

  const chorusDelay = ctx.createDelay(0.1);
  const chorusLfo = ctx.createOscillator();
  const chorusDepth = ctx.createGain();

  const rate = level === 1 ? 0.5 : 0.82;
  const depth = level === 1 ? 0.0025 : 0.0045;
  const baseDelay = level === 1 ? 0.015 : 0.025;

  chorusDelay.delayTime.setValueAtTime(baseDelay, time);
  chorusLfo.frequency.setValueAtTime(rate, time);
  chorusDepth.gain.setValueAtTime(depth, time);

  chorusLfo.connect(chorusDepth);
  chorusDepth.connect(chorusDelay.delayTime);
  chorusLfo.start(time);
  chorusLfo.stop(time + duration + 0.5);

  const chorusGain = ctx.createGain();
  chorusGain.gain.setValueAtTime(0.5, time);

  input.connect(chorusDelay);
  chorusDelay.connect(chorusGain);
  chorusGain.connect(destination);
}

/**
 * Simple delay effect.
 */
export function applySimpleDelay(
  ctx: AudioContext,
  input: AudioNode,
  destination: AudioNode,
  feedbackAmount: number,
  delayTime: number = 0.3
): void {
  const delay = ctx.createDelay(1.0);
  delay.delayTime.value = delayTime;
  const feedback = ctx.createGain();
  feedback.gain.value = Math.max(0, Math.min(0.9, feedbackAmount));
  
  input.connect(delay);
  delay.connect(feedback);
  feedback.connect(delay);
  delay.connect(destination);
}

/**
 * Waveshaper distortion / saturation.
 */
export function makeDriveCurve(amount: number): Float32Array {
  const samples = 1024;
  const curve = new Float32Array(samples);
  const k = amount * 20;
  for (let i = 0; i < samples; i++) {
    const x = (i / (samples - 1)) * 2 - 1;
    curve[i] = k === 0 ? x : Math.tanh(x * (1 + k)) / Math.tanh(1 + k);
  }
  return curve;
}
