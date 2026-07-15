/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SynthParams } from '../types';

export class ADSRBuilder {
  /**
   * Applies a classic ADSR envelope to a GainNode.
   * All times are in seconds relative to `time`.
   * `duration` is the total note duration.
   */
  apply(
    gainNode: GainNode,
    time: number,
    attack: number,
    decay: number,
    sustain: number,  // 0–1
    release: number,
    duration: number,
    velocity: number  // peak level
  ) {
    const now = time;
    const gain = gainNode.gain;

    attack = Math.max(0, attack);
    decay = Math.max(0, decay);
    release = Math.max(0, release);
    sustain = Math.max(0, Math.min(1, sustain));
    velocity = Math.max(0, velocity);

    const peakTime = now + attack;
    const sustainStart = peakTime + decay;
    const releaseStart = Math.max(peakTime, now + duration - release);

    gain.setValueAtTime(0, now);
    gain.linearRampToValueAtTime(velocity, peakTime);
    if (decay > 0 && releaseStart > peakTime) {
      gain.exponentialRampToValueAtTime(
        Math.max(0.001, velocity * sustain),
        sustainStart
      );
    }
    if (releaseStart > sustainStart) {
      gain.setValueAtTime(Math.max(0.001, velocity * sustain), sustainStart);
    }
    gain.exponentialRampToValueAtTime(0.001, now + duration);
    gain.setValueAtTime(0, now + duration + 0.005);
  }
}

export class FilterBuilder {
  create(
    ctx: AudioContext,
    type: BiquadFilterType,
    frequency: number,
    Q: number,
    time: number
  ) {
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(Math.max(0, frequency), time);
    filter.Q.setValueAtTime(Math.max(0, Q), time);
    return filter;
  }
}

export interface LFOHandle {
  connect: (destination: AudioParam | AudioNode) => void;
  start: (time?: number) => void;
  stop: (time?: number) => void;
  gain: GainNode;
}

export class LFOBuilder {
  /**
   * Creates an LFO that can modulate AudioParams or AudioNodes.
   * Returns a handle with `.gain` for connection and lifecycle control.
   */
  create(
    ctx: AudioContext,
    type: OscillatorType,
    frequency: number,
    depth: number,
    time: number,
    duration?: number
  ): LFOHandle {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(0, frequency), time);
    gain.gain.setValueAtTime(depth, time);

    osc.connect(gain);

    osc.start(time);

    if (duration !== undefined && duration > 0) {
      osc.stop(time + duration);
    }

    return {
      gain,
      connect: (dest) => {
        gain.connect(dest as any);
      },
      start: (t = time) => osc.start(t),
      stop: (t = 0) => {
        try {
          osc.stop(t);
        } catch {
          // already stopped
        }
      },
    };
  }
}

/**
 * Ramps an AudioParam to a target value over a given duration.
 * Uses exponential ramp for frequencies (logarithmic), linear for others.
 */
export function smoothParam(
  param: AudioParam,
  value: number,
  time: number,
  duration: number = 0.05,
  useExponential: boolean = false
) {
  const clampedValue = Math.max(0, value);
  if (useExponential && clampedValue > 0) {
    param.exponentialRampToValueAtTime(clampedValue, time + duration);
  } else if (clampedValue === 0) {
    param.linearRampToValueAtTime(0.001, time + duration);
    param.setValueAtTime(0, time + duration + 0.005);
  } else {
    param.linearRampToValueAtTime(clampedValue, time + duration);
  }
}
