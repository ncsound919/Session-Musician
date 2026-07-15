/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ProducerTiming {
  swing: number;
  micro_variance_ms: number;
  kick_offset_ms: number;
  snare_offset_ms: number;
  hihat_offset_ms: number;
  bass_offset_ms: number;
}

export interface ProducerHarmony {
  extensions_level: number;
  preferred_voicings: string[];
  modulation_freq: number;
  jazz_influence: number;
  gospel_influence: number;
  dark_modal_bias: number;
}

export interface ProducerRhythm {
  groove_density: number;
  syncopation: number;
  drum_quantization_tightness: number;
  loop_based: boolean;
}

export interface ProducerTone {
  analog_warmth: number;
  digital_sheen: number;
  distortion_level: number;
  vinyl_dust: number;
  brightness: number;
  lowpass_bias_hz: number;
}

export interface ProducerArrangement {
  layer_count: number;
  countermelody_freq: number;
  pop_structure_bias: number;
  orchestral_bias: number;
  live_instrument_bias: number;
}

export interface ProducerMix {
  stereo_width: number;
  clarity: number;
  polish: number;
  reverb_amount: number;
  mid_focus: number;
}

export interface ProducerProfile {
  id: string;
  name: string;
  timing: ProducerTiming;
  harmony: ProducerHarmony;
  rhythm: ProducerRhythm;
  tone: ProducerTone;
  arrangement: ProducerArrangement;
  mix: ProducerMix;
  signature: {
    tags: string[];
  };
}
