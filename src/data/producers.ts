/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ProducerProfile } from '../types/producer';

export const PRODUCER_PROFILES: Record<string, ProducerProfile> = {
  'quincy': {
    id: 'quincy',
    name: 'Quincy Jones',
    timing: {
      swing: 0.25,
      micro_variance_ms: 10.0,
      kick_offset_ms: 0.0,
      snare_offset_ms: 5.0,
      hihat_offset_ms: 0.0,
      bass_offset_ms: 0.0,
    },
    harmony: {
      extensions_level: 0.9,
      preferred_voicings: ['maj9', 'min9', 'dom13', 'alt_dom'],
      modulation_freq: 0.5,
      jazz_influence: 0.85,
      gospel_influence: 0.6,
      dark_modal_bias: 0.2,
    },
    rhythm: {
      groove_density: 0.7,
      syncopation: 0.6,
      drum_quantization_tightness: 0.7,
      loop_based: false,
    },
    tone: {
      analog_warmth: 0.9,
      digital_sheen: 0.3,
      distortion_level: 0.1,
      vinyl_dust: 0.3,
      brightness: 0.6,
      lowpass_bias_hz: 14000.0,
    },
    arrangement: {
      layer_count: 0.9,
      countermelody_freq: 0.8,
      pop_structure_bias: 0.5,
      orchestral_bias: 0.9,
      live_instrument_bias: 0.9,
    },
    mix: {
      stereo_width: 0.9,
      clarity: 0.9,
      polish: 0.9,
      reverb_amount: 0.6,
      mid_focus: 0.7,
    },
    signature: {
      tags: ['orchestral_soul', 'jazz_pop', 'big_band']
    }
  },
  'dre': {
    id: 'dre',
    name: 'Dr. Dre',
    timing: {
      swing: 0.1,
      micro_variance_ms: 5.0,
      kick_offset_ms: 5.0,
      snare_offset_ms: 20.0,
      hihat_offset_ms: -2.0,
      bass_offset_ms: 10.0,
    },
    harmony: {
      extensions_level: 0.2,
      preferred_voicings: ['min', 'min7'],
      modulation_freq: 0.1,
      jazz_influence: 0.1,
      gospel_influence: 0.1,
      dark_modal_bias: 0.8,
    },
    rhythm: {
      groove_density: 0.3,
      syncopation: 0.3,
      drum_quantization_tightness: 0.95,
      loop_based: true,
    },
    tone: {
      analog_warmth: 0.6,
      digital_sheen: 0.7,
      distortion_level: 0.2,
      vinyl_dust: 0.2,
      brightness: 0.7,
      lowpass_bias_hz: 16000.0,
    },
    arrangement: {
      layer_count: 0.4,
      countermelody_freq: 0.2,
      pop_structure_bias: 0.6,
      orchestral_bias: 0.2,
      live_instrument_bias: 0.3,
    },
    mix: {
      stereo_width: 0.8,
      clarity: 0.95,
      polish: 0.9,
      reverb_amount: 0.2,
      mid_focus: 0.6,
    },
    signature: {
      tags: ['west_coast', 'cinematic_minimalism', 'drum_forward']
    }
  },
  'dilla': {
    id: 'dilla',
    name: 'J Dilla',
    timing: {
      swing: 0.5,
      micro_variance_ms: 25.0,
      kick_offset_ms: 5.0,
      snare_offset_ms: 30.0,
      hihat_offset_ms: 10.0,
      bass_offset_ms: 15.0,
    },
    harmony: {
      extensions_level: 0.6,
      preferred_voicings: ['min9', 'maj7', 'quartal'],
      modulation_freq: 0.3,
      jazz_influence: 0.7,
      gospel_influence: 0.6,
      dark_modal_bias: 0.5,
    },
    rhythm: {
      groove_density: 0.6,
      syncopation: 0.75,
      drum_quantization_tightness: 0.4,
      loop_based: true,
    },
    tone: {
      analog_warmth: 0.9,
      digital_sheen: 0.3,
      distortion_level: 0.3,
      vinyl_dust: 0.9,
      brightness: 0.4,
      lowpass_bias_hz: 9000.0,
    },
    arrangement: {
      layer_count: 0.5,
      countermelody_freq: 0.4,
      pop_structure_bias: 0.3,
      orchestral_bias: 0.2,
      live_instrument_bias: 0.5,
    },
    mix: {
      stereo_width: 0.6,
      clarity: 0.6,
      polish: 0.5,
      reverb_amount: 0.3,
      mid_focus: 0.8,
    },
    signature: {
      tags: ['neo_soul', 'drunk_groove', 'sample_based']
    }
  },
  'dangelo': {
    id: 'dangelo',
    name: "D'Angelo",
    timing: {
      swing: 0.6,
      micro_variance_ms: 30.0,
      kick_offset_ms: 5.0,
      snare_offset_ms: 40.0,
      hihat_offset_ms: 15.0,
      bass_offset_ms: 20.0,
    },
    harmony: {
      extensions_level: 0.85,
      preferred_voicings: ['min11', 'dom13', 'maj9'],
      modulation_freq: 0.4,
      jazz_influence: 0.8,
      gospel_influence: 0.9,
      dark_modal_bias: 0.5,
    },
    rhythm: {
      groove_density: 0.6,
      syncopation: 0.7,
      drum_quantization_tightness: 0.4,
      loop_based: false,
    },
    tone: {
      analog_warmth: 0.95,
      digital_sheen: 0.3,
      distortion_level: 0.2,
      vinyl_dust: 0.7,
      brightness: 0.4,
      lowpass_bias_hz: 10000.0,
    },
    arrangement: {
      layer_count: 0.7,
      countermelody_freq: 0.6,
      pop_structure_bias: 0.4,
      orchestral_bias: 0.3,
      live_instrument_bias: 0.8,
    },
    mix: {
      stereo_width: 0.5,
      clarity: 0.6,
      polish: 0.6,
      reverb_amount: 0.4,
      mid_focus: 0.8,
    },
    signature: {
      tags: ['neo_soul', 'humanized_timing', 'dense_harmony']
    }
  },
  'steely': {
    id: 'steely',
    name: 'Steely Dan',
    timing: {
      swing: 0.2,
      micro_variance_ms: 5.0,
      kick_offset_ms: 0.0,
      snare_offset_ms: 0.0,
      hihat_offset_ms: 0.0,
      bass_offset_ms: 0.0,
    },
    harmony: {
      extensions_level: 0.95,
      preferred_voicings: ['maj9', 'maj7#11', 'alt_dom'],
      modulation_freq: 0.6,
      jazz_influence: 0.95,
      gospel_influence: 0.2,
      dark_modal_bias: 0.4,
    },
    rhythm: {
      groove_density: 0.5,
      syncopation: 0.5,
      drum_quantization_tightness: 0.9,
      loop_based: false,
    },
    tone: {
      analog_warmth: 0.8,
      digital_sheen: 0.7,
      distortion_level: 0.2,
      vinyl_dust: 0.3,
      brightness: 0.8,
      lowpass_bias_hz: 16000.0,
    },
    arrangement: {
      layer_count: 0.8,
      countermelody_freq: 0.7,
      pop_structure_bias: 0.5,
      orchestral_bias: 0.4,
      live_instrument_bias: 0.7,
    },
    mix: {
      stereo_width: 0.9,
      clarity: 1.0,
      polish: 1.0,
      reverb_amount: 0.4,
      mid_focus: 0.7,
    },
    signature: {
      tags: ['jazz_rock', 'studio_perfection', 'hyper_precise']
    }
  }
};
