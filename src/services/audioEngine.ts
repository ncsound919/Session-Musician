/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Web Audio engine for chord preview and drum sample playback.
 */
class AudioEngine {
  private ctx: AudioContext | null = null;
  private bufferCache = new Map<string, AudioBuffer>();

  private async ensureRunning(): Promise<AudioContext | null> {
    if (!this.ctx) {
      this.ctx = new AudioContext();
    }
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
    return this.ctx;
  }

  public async playNote(freq: number, type: OscillatorType = 'sine', duration: number = 0.5): Promise<void> {
    const ctx = await this.ensureRunning();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);

    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + duration);
  }

  public async playChord(root: string, type: string): Promise<void> {
    const ctx = await this.ensureRunning();
    if (!ctx) return;

    const frequencies: Record<string, number> = {
      'C': 261.63, 'C#': 277.18, 'D': 293.66, 'D#': 311.13, 'E': 329.63,
      'F': 349.23, 'F#': 369.99, 'G': 392.00, 'G#': 415.30, 'A': 440.00,
      'A#': 466.16, 'B': 493.88
    };

    const baseFreq = frequencies[root] || 261.63;
    const thirdRatio = type.includes('min') ? 2 ** (3 / 12) : 2 ** (4 / 12);
    const fifthRatio = 2 ** (7 / 12);

    [baseFreq, baseFreq * thirdRatio, baseFreq * fifthRatio].forEach(freq => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    });
  }

  public async playDrumSample(sampleUrl: string, pocket: number): Promise<void> {
    const ctx = await this.ensureRunning();
    if (!ctx) return;

    let buffer = this.bufferCache.get(sampleUrl);
    if (!buffer) {
      const response = await fetch(sampleUrl);
      const arrayBuffer = await response.arrayBuffer();
      buffer = await ctx.decodeAudioData(arrayBuffer);
      this.bufferCache.set(sampleUrl, buffer);
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);

    // pocket: 0 = loose/behind the beat (up to 20 ms late), 100 = perfectly stiff (0 ms offset).
    // Linear mapping: offsetSec = (1 - pocket/100) * maxOffsetSec
    const maxOffsetSec = 0.02;
    const offsetSec = ((100 - pocket) / 100) * maxOffsetSec;
    source.start(ctx.currentTime + offsetSec);
  }

  /** Evict a URL from the buffer cache (call after revoking the blob: URL). */
  public evictSample(sampleUrl: string): void {
    this.bufferCache.delete(sampleUrl);
  }
}

export const audioEngine = new AudioEngine();
