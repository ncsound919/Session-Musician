import { Chord, InstrumentType, InstrumentState, SessionParameters, SynthParams } from '../types';
import { MidiEvent, generateDrums, generateBass, generateKeys, generateGuitar, generatePads, generateLead } from './midiExport';
import { playBassVoice, playKeysVoice, playGuitarVoice, playPadsVoice, playLeadVoice } from './synthVoice';
import { buildFilterStage } from './filterStage';
import { ADSRBuilder } from './synthEngine';
import { SampleStorage } from './sampleStorage';
import { getChordNotes } from './musicTheoryEngine';
import { applySophistication } from './sophisticationEngine';

export class AudioEngine {
  public ctx: AudioContext | null = null;
  public editedMidi: Record<InstrumentType, any[]> = {} as any;
  private isRunning = false;
  private currentChords: Chord[] = [];
  private currentBpm = 120;
  private volumes: Record<InstrumentType, number> = {
    Drums: 100,
    Bass: 100,
    Keys: 100,
    Guitar: 100,
    Pads: 100,
    Lead: 100,
    Sampler: 100,
  };
  private customKit: any = null;
  private currentInstrumentStates: Record<InstrumentType, InstrumentState> | null = null;

  private playbackNotes: Array<{
    tick: number;
    duration: number;
    note: number;
    vel: number;
    channel: InstrumentType;
  }> = [];

  private nextEventIndex = 0;
  private loopStartTime = 0;
  private scheduleAheadTime = 0.2;
  private timerId: ReturnType<typeof setTimeout> | null = null;

  private mutes: Record<InstrumentType, boolean> = {
    Drums: false,
    Bass: false,
    Keys: false,
    Guitar: false,
    Pads: false,
    Lead: false,
    Sampler: false,
  };
  private solos: Record<InstrumentType, boolean> = {
    Drums: false,
    Bass: false,
    Keys: false,
    Guitar: false,
    Pads: false,
    Lead: false,
    Sampler: false,
  };
  private channelGains: Record<InstrumentType, GainNode | null> = {
    Drums: null,
    Bass: null,
    Keys: null,
    Guitar: null,
    Pads: null,
    Lead: null,
    Sampler: null,
  };
  private analysers: Record<InstrumentType, AnalyserNode | null> = {
    Drums: null,
    Bass: null,
    Keys: null,
    Guitar: null,
    Pads: null,
    Lead: null,
    Sampler: null,
  };

  private bufferCache = new Map<string, AudioBuffer>();
  private pendingSampleLoads = new Map<string, Promise<AudioBuffer>>();

  private customInstrumentBuffers: Partial<Record<InstrumentType, AudioBuffer>> = {};
  public customInstrumentRootMidis: Partial<Record<InstrumentType, number>> = {};
  public customInstrumentFileNames: Partial<Record<InstrumentType, string>> = {};
  private customInstrumentChokeNodes: Partial<Record<InstrumentType, { source: AudioBufferSourceNode, gain: GainNode }>> = {};

  // Sampler-specific variables
  public samplerBuffer: AudioBuffer | null = null;
  public samplerFileName: string = '';
  public samplerChops: Array<{ id: string; start: number; end: number; label: string }> = [];
  private samplerChokeNodes: Record<number, { source: AudioBufferSourceNode, gain: GainNode } | null> = {};

  // Senior Dev Additions: Voice tracking & Master FX chain
  private activeSources = new Set<OscillatorNode | AudioBufferSourceNode>();
  private masterGainNode: GainNode | null = null;
  private masterLimiter: DynamicsCompressorNode | null = null;
  private masterVolume = 80; // 0 to 100 scale
  private latencyMode: 'low' | 'medium' | 'high' = 'medium';

  /* ──── Public API ──── */

  public async init(): Promise<AudioContext> {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();

      // Configure standard context state logger
      this.ctx.onstatechange = () => {
        console.log(`[AudioEngine] Context state changed to: ${this.ctx?.state}`);
      };

      // Create Master compressor-limiter & clickless gain stage
      this.masterLimiter = this.ctx.createDynamicsCompressor();
      this.masterGainNode = this.ctx.createGain();

      // Configure brickwall limiter parameters to prevent digital clipping
      this.masterLimiter.threshold.setValueAtTime(-1.0, this.ctx.currentTime);
      this.masterLimiter.knee.setValueAtTime(0, this.ctx.currentTime);
      this.masterLimiter.ratio.setValueAtTime(20, this.ctx.currentTime);
      this.masterLimiter.attack.setValueAtTime(0.003, this.ctx.currentTime);
      this.masterLimiter.release.setValueAtTime(0.1, this.ctx.currentTime);

      // Connect Limiter -> Master Gain -> Output Destination
      this.masterLimiter.connect(this.masterGainNode);
      this.masterGainNode.connect(this.ctx.destination);

      // Initialize sub-channel routing with Gain and Analyser nodes for real-time VU and clicks-free Mute/Solo
      (Object.keys(this.volumes) as InstrumentType[]).forEach((channel) => {
        const gainNode = this.ctx!.createGain();
        const analyser = this.ctx!.createAnalyser();
        analyser.fftSize = 32; // small, fast buffer for real-time time-domain tracking

        gainNode.connect(analyser);
        analyser.connect(this.masterLimiter!);

        this.channelGains[channel] = gainNode;
        this.analysers[channel] = analyser;
      });

      // Apply initial master volume setting
      this.setMasterVolume(this.masterVolume);
      this.updateChannelGains();

      // Try to load any persistent custom samples from IndexedDB
      this.loadPersistentCustomSamples().catch((err) => {
        console.warn('Error loading persistent custom samples:', err);
      });
    }

    return this.ctx;
  }

  public async ensureRunning(): Promise<AudioContext | null> {
    const ctx = await this.init();

    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    return ctx;
  }

  public getMasterDestination(): AudioNode {
    if (this.masterLimiter) {
      return this.masterLimiter;
    }
    return this.ctx?.destination || (null as any);
  }

  private normalizeAudioBuffer(buffer: AudioBuffer): AudioBuffer {
    const numberOfChannels = buffer.numberOfChannels;
    const length = buffer.length;
    let maxVal = 0;
    for (let c = 0; c < numberOfChannels; c++) {
      const data = buffer.getChannelData(c);
      for (let i = 0; i < length; i++) {
        const val = Math.abs(data[i]);
        if (val > maxVal) {
          maxVal = val;
        }
      }
    }
    if (maxVal > 0 && maxVal < 0.99) {
      const scale = 0.95 / maxVal;
      for (let c = 0; c < numberOfChannels; c++) {
        const data = buffer.getChannelData(c);
        for (let i = 0; i < length; i++) {
          data[i] *= scale;
        }
      }
      console.log(`[AudioEngine] Normalized AudioBuffer from peak ${maxVal.toFixed(3)} to 0.95 (scale factor: ${scale.toFixed(2)})`);
    }
    return buffer;
  }

  public async loadPersistentCustomSamples(): Promise<void> {
    const ctx = this.ctx;
    if (!ctx) return;

    const channels: InstrumentType[] = ['Bass', 'Keys', 'Guitar', 'Pads', 'Lead', 'Sampler'];
    for (const instrument of channels) {
      try {
        const stored = await SampleStorage.getSample(instrument);
        if (stored) {
          const arrayBuffer = await stored.data.arrayBuffer();
          const buffer = this.normalizeAudioBuffer(await ctx.decodeAudioData(arrayBuffer));
          
          if (instrument === 'Sampler') {
            this.samplerBuffer = buffer;
            this.samplerFileName = stored.name;
            // Restore chops if saved, or recreate 12 equal chops
            const chopData = localStorage.getItem('sampler_chops');
            if (chopData) {
              this.samplerChops = JSON.parse(chopData);
            } else {
              this.samplerChops = Array.from({ length: 12 }, (_, i) => {
                const step = buffer.duration / 12;
                return {
                  id: `chop-${i}`,
                  start: i * step,
                  end: (i + 1) * step,
                  label: `Pad ${i + 1}`,
                };
              });
            }
          } else {
            this.customInstrumentBuffers[instrument] = buffer;
            this.customInstrumentRootMidis[instrument] = stored.rootMidi;
            this.customInstrumentFileNames[instrument] = stored.name;
          }
          console.log(`[AudioEngine] Restored custom sample for ${instrument}: ${stored.name}`);
        }
      } catch (err) {
        console.warn(`[AudioEngine] Failed to restore custom sample for ${instrument}:`, err);
      }
    }
  }

  public setCustomInstrumentSample(instrument: InstrumentType, buffer: AudioBuffer, rootMidi: number, fileName: string): void {
    const normalized = this.normalizeAudioBuffer(buffer);
    if (instrument === 'Sampler') {
      this.samplerBuffer = normalized;
      this.samplerFileName = fileName;
      this.samplerChops = Array.from({ length: 12 }, (_, i) => {
        const step = normalized.duration / 12;
        return {
          id: `chop-${i}`,
          start: i * step,
          end: (i + 1) * step,
          label: `Pad ${i + 1}`,
        };
      });
      localStorage.setItem('sampler_chops', JSON.stringify(this.samplerChops));
    } else {
      this.customInstrumentBuffers[instrument] = normalized;
      this.customInstrumentRootMidis[instrument] = rootMidi;
      this.customInstrumentFileNames[instrument] = fileName;
    }
  }

  public async saveAndSetCustomInstrumentSample(instrument: InstrumentType, file: File, rootMidi: number): Promise<void> {
    const ctx = this.ctx;
    if (!ctx) throw new Error('Audio Context is not initialized');

    const arrayBuffer = await file.arrayBuffer();
    // Decode audio data to AudioBuffer
    const buffer = await ctx.decodeAudioData(arrayBuffer);

    // Save to IndexedDB
    await SampleStorage.saveSample(instrument, file.name, file.type, file, rootMidi);

    // Keep in memory and normalize
    this.setCustomInstrumentSample(instrument, buffer, rootMidi, file.name);
  }

  public async removeCustomInstrumentSample(instrument: InstrumentType): Promise<void> {
    delete this.customInstrumentBuffers[instrument];
    delete this.customInstrumentRootMidis[instrument];
    delete this.customInstrumentFileNames[instrument];
    await SampleStorage.deleteSample(instrument);
  }

  public getCustomInstrumentFileName(instrument: InstrumentType): string | undefined {
    return this.customInstrumentFileNames[instrument];
  }

  public getCustomInstrumentRootMidi(instrument: InstrumentType): number | undefined {
    return this.customInstrumentRootMidis[instrument];
  }

  public hasCustomInstrumentSample(instrument: InstrumentType): boolean {
    return !!this.customInstrumentBuffers[instrument];
  }

  public getChannelDestination(channel: InstrumentType): AudioNode {
    if (this.channelGains[channel]) {
      return this.channelGains[channel]!;
    }
    return this.getMasterDestination();
  }

  public setMasterVolume(vol: number): void {
    this.masterVolume = clamp(vol, 0, 100);
    const ctx = this.ctx;
    if (ctx && this.masterGainNode) {
      const targetGain = (this.masterVolume / 100) * 0.8;
      const now = ctx.currentTime;
      // Fade volume changes smoothly over 15ms to fully eliminate "zipper noise"
      this.masterGainNode.gain.setValueAtTime(this.masterGainNode.gain.value, now);
      this.masterGainNode.gain.linearRampToValueAtTime(targetGain, now + 0.015);
    }
  }

  public getMasterVolume(): number {
    return this.masterVolume;
  }

  public getMutes(): Record<InstrumentType, boolean> {
    return this.mutes;
  }

  public getSolos(): Record<InstrumentType, boolean> {
    return this.solos;
  }

  public updateChannelGains(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const now = ctx.currentTime;

    const anySolo = Object.values(this.solos).some((val) => val);

    (Object.keys(this.volumes) as InstrumentType[]).forEach((channel) => {
      const gainNode = this.channelGains[channel];
      if (!gainNode) return;

      let targetVolume = (this.volumes[channel] ?? 100) / 100;

      if (this.mutes[channel]) {
        targetVolume = 0;
      } else if (anySolo && !this.solos[channel]) {
        targetVolume = 0;
      }

      // Smooth fade over 15ms to prevent digital click artifacts
      gainNode.gain.setValueAtTime(gainNode.gain.value, now);
      gainNode.gain.linearRampToValueAtTime(targetVolume, now + 0.015);
    });
  }

  public getChannelVolumePeak(channel: InstrumentType): number {
    const analyser = this.analysers[channel];
    if (!analyser || !this.ctx) return 0;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteTimeDomainData(dataArray);

    let maxVal = 128;
    for (let i = 0; i < bufferLength; i++) {
      if (dataArray[i] > maxVal) {
        maxVal = dataArray[i];
      }
    }

    const amplitude = (maxVal - 128) / 128; // scale to 0.0 - 1.0 range
    return amplitude;
  }

  public setLatencyMode(mode: 'low' | 'medium' | 'high'): void {
    this.latencyMode = mode;
    switch (mode) {
      case 'low':
        this.scheduleAheadTime = 0.075; // Fast interactive response
        break;
      case 'medium':
        this.scheduleAheadTime = 0.2;   // Standard balanced buffer
        break;
      case 'high':
        this.scheduleAheadTime = 0.4;   // Heavy performance safety buffer
        break;
    }
  }

  public getLatencyMode(): 'low' | 'medium' | 'high' {
    return this.latencyMode;
  }

  public panic(): void {
    this.stopSequencer();
    if (this.ctx) {
      try {
        this.ctx.close();
      } catch (err) {
        console.warn('[AudioEngine] Error closing context during panic:', err);
      }
      this.ctx = null;
    }
    this.activeSources.clear();
    console.log('[AudioEngine] Panic executed: all voices silenced and AudioContext reset.');
  }

  private trackSource(source: OscillatorNode | AudioBufferSourceNode): void {
    this.activeSources.add(source);
    source.onended = () => {
      this.activeSources.delete(source);
    };
  }

  public getActiveVoiceCount(): number {
    return this.activeSources.size;
  }

  public async startSequencer(
    chords: Chord[],
    bpm: number,
    instrumentStates: Record<InstrumentType, InstrumentState>,
    volumes?: Record<InstrumentType, number>,
    customKit?: any,
    mutes?: Record<InstrumentType, boolean>,
    solos?: Record<InstrumentType, boolean>
  ): Promise<void> {
    const ctx = await this.ensureRunning();
    if (!ctx) return;

    this.stopSequencer();

    if (volumes) this.volumes = volumes;
    if (customKit) this.customKit = customKit;
    if (mutes) this.mutes = mutes;
    if (solos) this.solos = solos;
    this.updateChannelGains();

    const validChords = chords.filter(
      (chord) => Number.isFinite(chord.duration) && chord.duration > 0
    );

    if (validChords.length === 0) {
      this.currentChords = [];
      this.playbackNotes = [];
      return;
    }

    this.currentChords = validChords;
    this.currentBpm = Number.isFinite(bpm) && bpm > 0 ? bpm : 120;

    this.playbackNotes = this.compilePlaybackNotes(
      validChords,
      instrumentStates,
      {} as any
    );

    this.currentInstrumentStates = instrumentStates;

    this.nextEventIndex = 0;

    // Schedule slightly ahead of the hardware clock. Using an explicit
    // future anchor avoids every tick being interpreted as "in the past."
    this.loopStartTime = ctx.currentTime + 0.05;
    this.isRunning = true;

    this.scheduleLoop();
  }

  public stopSequencer(): void {
    this.isRunning = false;
    this.nextEventIndex = 0;

    if (this.timerId !== null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }

    // Stop and clear all active voices to guarantee instantaneous silence
    this.activeSources.forEach((source) => {
      try {
        source.stop();
        source.disconnect();
      } catch (err) {
        // Voice might already be finished playing
      }
    });
    this.activeSources.clear();
  }

  public updateSequencerParams(
    chords: Chord[],
    bpm: number,
    instrumentStates: Record<InstrumentType, InstrumentState>,
    volumes?: Record<InstrumentType, number>,
    customKit?: any,
    mutes?: Record<InstrumentType, boolean>,
    solos?: Record<InstrumentType, boolean>
  ): void {
    if (volumes) this.volumes = volumes;
    if (customKit) this.customKit = customKit;
    if (mutes) this.mutes = mutes;
    if (solos) this.solos = solos;
    this.updateChannelGains();

    const validChords = chords.filter(
      (chord) => Number.isFinite(chord.duration) && chord.duration > 0
    );

    this.currentChords = validChords;
    this.currentBpm = Number.isFinite(bpm) && bpm > 0 ? bpm : 120;

    this.playbackNotes = this.compilePlaybackNotes(
      validChords,
      instrumentStates,
      {} as any
    );

    this.currentInstrumentStates = instrumentStates;
  }

  public playChord(root: string, type: string): void {
    const ctx = this.ctx;
    if (!ctx) return;
    this.ensureRunning();

    const notes = getChordNotes(root, type);
    const now = ctx.currentTime;
    notes.forEach((pitch) => {
      this.playSynthNote('Keys', pitch, now, 1.5, 0.4, this.getMasterDestination());
    });
  }

  public async playNote(frequency: number, type: 'sine' | 'square' | 'sawtooth' | 'triangle', duration: number): Promise<void> {
    const ctx = await this.ensureRunning();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(1, frequency), ctx.currentTime);

    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(this.getMasterDestination());

    osc.start(ctx.currentTime);
    this.trackSource(osc);
    osc.stop(ctx.currentTime + duration + 0.05);
  }

  public getPlaybackState() {
    const ctx = this.ctx;
    let currentTick = 0;
    if (this.isRunning && ctx && this.currentBpm > 0) {
      const elapsedSec = ctx.currentTime - this.loopStartTime;
      const totalTicks = this.getTotalTicks();
      if (totalTicks > 0) {
        const loopDurationSec = this.tickToSeconds(totalTicks);
        const elapsedModulo = elapsedSec % loopDurationSec;
        currentTick = Math.floor((elapsedModulo / loopDurationSec) * totalTicks);
        if (currentTick < 0) currentTick = 0;
      }
    }

    return {
      isRunning: this.isRunning,
      notes: this.playbackNotes,
      totalTicks: this.getTotalTicks(),
      currentTick: currentTick,
    };
  }

  public evictSample(sampleUrl: string): void {
    this.bufferCache.delete(sampleUrl);
  }

  public async playDrumSample(sampleUrl: string, pocket: number): Promise<void> {
    const ctx = await this.ensureRunning();
    if (!ctx) return;

    try {
      const buffer = await this.loadSample(sampleUrl);
      const source = ctx.createBufferSource();

      source.buffer = buffer;
      source.connect(this.getMasterDestination());

      const maxOffsetSec = 0.02;
      const clampedPocket = clamp(pocket, 0, 100);
      const offsetSec = ((100 - clampedPocket) / 100) * maxOffsetSec;

      source.start(ctx.currentTime + offsetSec);
      this.trackSource(source);
    } catch (error) {
      console.warn('Failed to play drum sample:', error);
    }
  }

  public async playLivePhrase(
    notes: string[],
    bpm: number,
    instrument: InstrumentType,
    params?: SynthParams
  ): Promise<void> {
    const ctx = await this.ensureRunning();
    if (!ctx || notes.length === 0) return;

    const NOTE_MAP: Record<string, number> = {
      C: 0,
      'C#': 1,
      Db: 1,
      D: 2,
      'D#': 3,
      Eb: 3,
      E: 4,
      F: 5,
      'F#': 6,
      Gb: 6,
      G: 7,
      'G#': 8,
      Ab: 8,
      A: 9,
      'A#': 10,
      Bb: 10,
      B: 11,
    };

    const safeBpm = Number.isFinite(bpm) && bpm > 0 ? bpm : 120;
    const beatDuration = 60 / safeBpm;
    const startTime = ctx.currentTime + 0.01;

    notes.forEach((noteStr, index) => {
      const normalized = noteStr.trim();
      const root = normalized.replace(/-?\d+/g, '');
      const octaveMatch = normalized.match(/-?\d+/);
      const octave = Number.parseInt(octaveMatch?.[0] ?? '4', 10);
      const pitch = NOTE_MAP[root];

      if (pitch === undefined || !Number.isFinite(octave)) return;

      const midi = (octave + 1) * 12 + pitch;
      const time = startTime + index * beatDuration;

      this.playSynthNote(
        instrument,
        midi,
        time,
        beatDuration * 0.9,
        0.7,
        this.getMasterDestination(),
        params
      );
    });
  }

  /* ──── Scheduling ──── */

  private scheduleLoop(): void {
    const ctx = this.ctx;
    const totalTicks = this.getTotalTicks();

    if (
      !this.isRunning ||
      !ctx ||
      this.currentChords.length === 0 ||
      this.currentBpm <= 0 ||
      totalTicks <= 0
    ) {
      return;
    }

    const loopDurationSec = this.tickToSeconds(totalTicks);
    const scheduleUntil = ctx.currentTime + this.scheduleAheadTime;

    /*
     * Schedule events one by one, not "the next note after a tick."
     *
     * The old implementation set:
     *   nextTickToSchedule = note.tick + note.duration
     *
     * That skipped:
     * - Multiple notes at the same tick, such as chord voicings.
     * - Drum hits that occur while another note is sustained.
     * - Any later event between note-on and note-off duration.
     */
    while (this.isRunning) {
      const nextEvent = this.playbackNotes[this.nextEventIndex];

      if (!nextEvent) {
        // No more events in this loop. Advance the audio-time origin and
        // begin scanning the same playback events for the next repetition.
        this.loopStartTime += loopDurationSec;
        this.nextEventIndex = 0;

        // An empty event list must still advance once per loop rather than
        // creating an infinite synchronous loop.
        if (this.playbackNotes.length === 0) {
          break;
        }

        continue;
      }

      const eventTime = this.loopStartTime + this.tickToSeconds(nextEvent.tick);

      if (eventTime > scheduleUntil) {
        break;
      }

      this.scheduleNote(nextEvent, eventTime);
      this.nextEventIndex += 1;
    }

    this.timerId = setTimeout(() => this.scheduleLoop(), 25);
  }

  private getTotalTicks(): number {
    return this.currentChords.reduce((sum, chord) => sum + chord.duration, 0) * 480;
  }

  private tickToSeconds(tick: number): number {
    return (60 / this.currentBpm) * (tick / 480);
  }

  private scheduleNote(
    note: {
      tick: number;
      duration: number;
      note: number;
      vel: number;
      channel: InstrumentType;
    },
    time: number
  ): void {
    const ctx = this.ctx;
    if (!ctx) return;

    const durationSec = Math.max(
      0.005,
      (60 / this.currentBpm) * (Math.max(1, note.duration) / 480)
    );

    const volumeMultiplier = (this.volumes[note.channel] ?? 100) / 100;
    const velFraction = clamp((note.vel / 127) * volumeMultiplier, 0, 1);

    if (note.channel === 'Drums') {
      this.scheduleDrumNote(note.note, time, velFraction, durationSec);
      return;
    }

    if (note.channel === 'Sampler') {
      this.playSamplerChopNote(note.note, time, durationSec, velFraction);
      return;
    }

    const channelState = this.currentInstrumentStates?.[note.channel];
    const synthParams = channelState?.synthParams;

    this.playSynthNote(
      note.channel,
      note.note,
      time,
      durationSec,
      velFraction,
      this.getChannelDestination(note.channel),
      synthParams
    );
  }

  /* ──── Drum Samples ──── */

  private async loadSample(sampleUrl: string): Promise<AudioBuffer> {
    const cached = this.bufferCache.get(sampleUrl);
    if (cached) return cached;

    const pending = this.pendingSampleLoads.get(sampleUrl);
    if (pending) return pending;

    const loadPromise = (async () => {
      const ctx = this.ctx;
      if (!ctx) {
        throw new Error('Audio context is not available');
      }

      const response = await fetch(sampleUrl);

      if (!response.ok) {
        throw new Error(`Failed to fetch sample: ${response.status}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = await ctx.decodeAudioData(arrayBuffer);

      this.bufferCache.set(sampleUrl, buffer);
      return buffer;
    })();

    this.pendingSampleLoads.set(sampleUrl, loadPromise);

    try {
      return await loadPromise;
    } finally {
      this.pendingSampleLoads.delete(sampleUrl);
    }
  }

  private getDrumSampleType(
    noteNum: number
  ): 'Kick' | 'Snare' | 'HiHat' | 'Tom' | 'Cymbal' | 'Percussion' {
    if (noteNum === 35 || noteNum === 36) return 'Kick';
    if (noteNum === 38 || noteNum === 40) return 'Snare';
    if (noteNum === 42 || noteNum === 44 || noteNum === 46) return 'HiHat';
    if ([41, 43, 45, 47, 48, 50].includes(noteNum)) return 'Tom';
    if ([49, 51, 52, 53, 55, 57, 59].includes(noteNum)) return 'Cymbal';

    return 'Percussion';
  }

  private scheduleDrumNote(
    noteNum: number,
    time: number,
    velFraction: number,
    duration: number
  ): void {
    const ctx = this.ctx;
    if (!ctx) return;

    const sampleType = this.getDrumSampleType(noteNum);
    
    let sampleUrl = `/samples/${sampleType}.wav`;
    
    // Check if there's a custom kit with a matching sample type
    if (this.customKit && Array.isArray(this.customKit.samples)) {
      const customSample = this.customKit.samples.find((s: any) => s.type === sampleType);
      if (customSample?.url) {
        sampleUrl = customSample.url;
      }
    }

    this.playBufferSample(
      sampleUrl,
      time,
      velFraction,
      this.getChannelDestination('Drums'),
      () => this.playDrumFallback(noteNum, time, velFraction, duration, this.getChannelDestination('Drums'))
    );
  }

  private playBufferSample(
    sampleUrl: string,
    time: number,
    velFraction: number,
    destination: AudioNode,
    fallback?: () => void
  ): void {
    const ctx = this.ctx;
    if (!ctx) return;

    const buffer = this.bufferCache.get(sampleUrl);

    if (!buffer) {
      /*
       * Do not await a network request inside real-time scheduling.
       * A network request can complete after the intended beat, so use the
       * synthetic voice for this hit and cache the sample for later loops.
       */
      void this.loadSample(sampleUrl).catch((error) => {
        console.warn('Failed to preload drum sample:', error);
      });

      fallback?.();
      return;
    }

    try {
      const source = ctx.createBufferSource();
      const gain = ctx.createGain();

      source.buffer = buffer;
      gain.gain.setValueAtTime(clamp(velFraction, 0, 1), time);

      source.connect(gain);
      gain.connect(destination);
      source.start(time);
      this.trackSource(source);
    } catch (error) {
      console.warn('Failed to play cached drum sample; using fallback:', error);
      fallback?.();
    }
  }

  private playDrumFallback(
    noteNum: number,
    time: number,
    velFraction: number,
    duration: number,
    destination: AudioNode
  ): void {
    const ctx = this.ctx;
    if (!ctx) return;

    const safeDuration = Math.max(0.01, duration);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    const freq = 220 * Math.pow(2, (noteNum - 36) / 12);

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(Math.max(1, freq), time);
    osc.frequency.exponentialRampToValueAtTime(
      Math.max(1, freq * 0.5),
      time + safeDuration * 0.3
    );

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(4000, time);
    filter.frequency.exponentialRampToValueAtTime(200, time + safeDuration);

    gain.gain.setValueAtTime(Math.max(0.0001, 0.3 * velFraction), time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + safeDuration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(destination);

    osc.start(time);
    this.trackSource(osc);
    osc.stop(time + safeDuration + 0.01);
  }

  /* ──── Synth Routing ──── */

  private playCustomInstrumentSample(
    instrument: InstrumentType,
    midi: number,
    time: number,
    duration: number,
    velFraction: number,
    destination: AudioNode,
    params?: SynthParams
  ): void {
    const ctx = this.ctx;
    const buffer = this.customInstrumentBuffers[instrument];
    const rootMidi = this.customInstrumentRootMidis[instrument] ?? 60;
    if (!ctx || !buffer) return;

    const previousNode = this.customInstrumentChokeNodes[instrument];
    if (previousNode) {
      try {
        previousNode.gain.gain.cancelScheduledValues(time);
        previousNode.gain.gain.setValueAtTime(previousNode.gain.gain.value, time);
        previousNode.gain.gain.linearRampToValueAtTime(0.001, time + 0.05);
        previousNode.source.stop(time + 0.06);
      } catch (e) {}
    }

    try {
      const source = ctx.createBufferSource();
      const gain = ctx.createGain();

      source.buffer = buffer;

      const playbackRate = Math.pow(2, (midi - rootMidi) / 12);
      source.playbackRate.setValueAtTime(playbackRate, time);

      const adsr = new ADSRBuilder();
      adsr.apply(
        gain,
        time,
        params?.attack ?? 0.01,
        params?.decay ?? 0.15,
        params?.sustain ?? 0.8,
        params?.release ?? 0.3,
        duration,
        velFraction * 0.4
      );

      source.connect(gain);
      
      let currentOut: AudioNode = gain;

      // Juno-Style Highpass Filter
      if (params?.hpfCutoff !== undefined && params.hpfCutoff > 10) {
        const hpf = ctx.createBiquadFilter();
        hpf.type = 'highpass';
        hpf.frequency.setValueAtTime(params.hpfCutoff, time);
        currentOut.connect(hpf);
        currentOut = hpf;
      }

      // Juno-Style Lowpass Filter
      let lowpassFilter: BiquadFilterNode | null = null;
      if (params?.filterCutoff !== undefined && params.filterCutoff < 20000) {
        lowpassFilter = ctx.createBiquadFilter();
        lowpassFilter.type = 'lowpass';
        lowpassFilter.frequency.setValueAtTime(Math.max(20, params.filterCutoff), time);
        lowpassFilter.Q.setValueAtTime(params.filterResonance ?? 1, time);
        currentOut.connect(lowpassFilter);
        currentOut = lowpassFilter;
      }

      // Juno-Style LFO Filter Modulation
      if (lowpassFilter && params?.lfoFilterMod && params.lfoFilterMod > 0) {
        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();
        lfo.frequency.setValueAtTime(params.lfoRate ?? 5, time);
        lfoGain.gain.setValueAtTime(params.lfoFilterMod * 1500, time); // Scale modulation depth up to 1500 Hz
        lfo.connect(lfoGain);
        lfoGain.connect(lowpassFilter.frequency);
        lfo.start(time);
        this.trackSource(lfo);
        lfo.stop(time + duration + (params?.release ?? 0.3) + 0.1);
      }

      // Juno-Style LFO Pitch Modulation (Vibrato)
      if (params?.lfoPitchMod && params.lfoPitchMod > 0) {
        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();
        lfo.frequency.setValueAtTime(params.lfoRate ?? 5, time);
        lfoGain.gain.setValueAtTime(params.lfoPitchMod * 50, time); // Detune up to 50 cents
        lfo.connect(lfoGain);
        lfoGain.connect(source.detune);
        lfo.start(time);
        this.trackSource(lfo);
        lfo.stop(time + duration + (params?.release ?? 0.3) + 0.1);
      }

      // White Noise Layer
      if (params?.noiseLevel && params.noiseLevel > 0) {
        const actualDur = Math.min(duration, buffer.duration / playbackRate);
        const bufferSize = ctx.sampleRate * Math.min(2.0, actualDur);
        const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const noiseData = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          noiseData[i] = Math.random() * 2 - 1;
        }
        const noiseSource = ctx.createBufferSource();
        noiseSource.buffer = noiseBuffer;
        
        const noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(params.noiseLevel * velFraction * 0.08, time);
        noiseGain.gain.exponentialRampToValueAtTime(0.0001, time + actualDur);
        
        noiseSource.connect(noiseGain);
        noiseGain.connect(destination);
        noiseSource.start(time);
        this.trackSource(noiseSource);
        noiseSource.stop(time + actualDur + 0.1);
      }

      // FX Section: Reverb
      if (params?.fx?.reverb && params.fx.reverb > 0) {
        const amount = params.fx.reverb; 
        const curve = new Float32Array(400);
        const k = amount * 100;
        const deg = Math.PI / 180;
        for (let i = 0; i < 400; ++i) {
          const x = (i * 2) / 400 - 1;
          curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
        }
        const shaper = ctx.createWaveShaper();
        shaper.curve = curve;
        shaper.oversample = '2x';
        currentOut.connect(shaper);
        currentOut = shaper;
      }

      // FX Section: Delay
      if (params?.fx?.delay && params.fx.delay > 0) {
        const delay = ctx.createDelay(1.0);
        delay.delayTime.value = 0.3;
        const feedback = ctx.createGain();
        feedback.gain.value = params.fx.delay;
        
        currentOut.connect(delay);
        delay.connect(feedback);
        feedback.connect(delay);
        delay.connect(destination);
      }

      // Juno Chorus I and II Emulation
      if (params?.junoChorus && params.junoChorus > 0) {
        const chorusDelay = ctx.createDelay(0.1);
        const chorusLfo = ctx.createOscillator();
        const chorusDepth = ctx.createGain();
        
        const rate = params.junoChorus === 1 ? 0.5 : 0.82;
        const depth = params.junoChorus === 1 ? 0.0025 : 0.0045;
        const baseDelay = params.junoChorus === 1 ? 0.015 : 0.025;
        
        chorusDelay.delayTime.setValueAtTime(baseDelay, time);
        chorusLfo.frequency.setValueAtTime(rate, time);
        chorusDepth.gain.setValueAtTime(depth, time);
        
        chorusLfo.connect(chorusDepth);
        chorusDepth.connect(chorusDelay.delayTime);
        chorusLfo.start(time);
        this.trackSource(chorusLfo);
        chorusLfo.stop(time + duration + (params?.release ?? 0.3) + 0.1);
        
        const chorusGain = ctx.createGain();
        chorusGain.gain.setValueAtTime(0.5, time);
        currentOut.connect(chorusDelay);
        chorusDelay.connect(chorusGain);
        chorusGain.connect(destination);
      }

      currentOut.connect(destination);

      source.start(time);
      this.trackSource(source);
      this.customInstrumentChokeNodes[instrument] = { source, gain };
      
      const actualDuration = Math.min(duration, buffer.duration / playbackRate);
      source.stop(time + actualDuration + (params?.release ?? 0.3) + 0.05);
    } catch (err) {
      console.error('Error playing custom instrument sample:', err);
    }
  }

  public updateSamplerChop(index: number, start: number, end: number): void {
    if (!this.samplerChops) this.samplerChops = [];
    this.samplerChops[index] = {
      id: `chop-${index}`,
      start: start,
      end: end,
      label: `Chop ${index + 1}`
    };
  }

  public playSamplerChopNote(midi: number, time: number, durationSec: number, velFraction: number): void {
    const ctx = this.ctx;
    const buffer = this.samplerBuffer;
    if (!ctx || !buffer) return;

    const chopIndex = midi - 60;
    const chop = this.samplerChops[chopIndex];
    if (!chop) return;

    try {
      const previousChoke = this.samplerChokeNodes[chopIndex];
      if (previousChoke) {
        try {
          previousChoke.gain.gain.cancelScheduledValues(time);
          previousChoke.gain.gain.setValueAtTime(previousChoke.gain.gain.value, time);
          previousChoke.gain.gain.linearRampToValueAtTime(0.001, time + 0.02);
          previousChoke.source.stop(time + 0.03);
        } catch (e) {}
      }

      const source = ctx.createBufferSource();
      const gain = ctx.createGain();

      source.buffer = buffer;
      
      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(velFraction * 0.8, time + 0.005);
      
      const chopDuration = chop.end - chop.start;
      const playDuration = Math.min(durationSec, chopDuration);

      gain.gain.setValueAtTime(velFraction * 0.8, time + playDuration - 0.01);
      gain.gain.linearRampToValueAtTime(0.001, time + playDuration);

      source.connect(gain);
      
      const destination = this.getChannelDestination('Sampler');
      const channelState = this.currentInstrumentStates?.['Sampler'];
      const params = channelState?.synthParams;

      let currentOut: AudioNode = gain;

      // Highpass filter
      if (params?.hpfCutoff !== undefined && params.hpfCutoff > 10) {
        const hpf = ctx.createBiquadFilter();
        hpf.type = 'highpass';
        hpf.frequency.setValueAtTime(params.hpfCutoff, time);
        currentOut.connect(hpf);
        currentOut = hpf;
      }

      // Lowpass filter
      let lowpassFilter: BiquadFilterNode | null = null;
      if (params?.filterCutoff !== undefined && params.filterCutoff < 20000) {
        lowpassFilter = ctx.createBiquadFilter();
        lowpassFilter.type = 'lowpass';
        lowpassFilter.frequency.setValueAtTime(Math.max(20, params.filterCutoff), time);
        lowpassFilter.Q.setValueAtTime(params.filterResonance ?? 1, time);
        currentOut.connect(lowpassFilter);
        currentOut = lowpassFilter;
      }

      // LFO Filter Mod
      if (lowpassFilter && params?.lfoFilterMod && params.lfoFilterMod > 0) {
        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();
        lfo.frequency.setValueAtTime(params.lfoRate ?? 5, time);
        lfoGain.gain.setValueAtTime(params.lfoFilterMod * 1500, time);
        lfo.connect(lfoGain);
        lfoGain.connect(lowpassFilter.frequency);
        lfo.start(time);
        this.trackSource(lfo);
        lfo.stop(time + playDuration + 0.1);
      }

      // LFO Pitch Mod
      if (params?.lfoPitchMod && params.lfoPitchMod > 0) {
        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();
        lfo.frequency.setValueAtTime(params.lfoRate ?? 5, time);
        lfoGain.gain.setValueAtTime(params.lfoPitchMod * 50, time);
        lfo.connect(lfoGain);
        lfoGain.connect(source.detune);
        lfo.start(time);
        this.trackSource(lfo);
        lfo.stop(time + playDuration + 0.1);
      }

      // Reverb / Delay / Chorus FX
      if (params?.fx?.reverb && params.fx.reverb > 0) {
        const amount = params.fx.reverb;
        const curve = new Float32Array(400);
        const k = amount * 100;
        const deg = Math.PI / 180;
        for (let i = 0; i < 400; ++i) {
          const x = (i * 2) / 400 - 1;
          curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
        }
        const shaper = ctx.createWaveShaper();
        shaper.curve = curve;
        shaper.oversample = '2x';
        currentOut.connect(shaper);
        currentOut = shaper;
      }

      if (params?.junoChorus && params.junoChorus > 0) {
        const chorusDelay = ctx.createDelay(0.1);
        const chorusLfo = ctx.createOscillator();
        const chorusDepth = ctx.createGain();
        const rate = params.junoChorus === 1 ? 0.5 : 0.82;
        const depth = params.junoChorus === 1 ? 0.0025 : 0.0045;
        const baseDelay = params.junoChorus === 1 ? 0.015 : 0.025;
        
        chorusDelay.delayTime.setValueAtTime(baseDelay, time);
        chorusLfo.frequency.setValueAtTime(rate, time);
        chorusDepth.gain.setValueAtTime(depth, time);
        chorusLfo.connect(chorusDepth);
        chorusDepth.connect(chorusDelay.delayTime);
        chorusLfo.start(time);
        this.trackSource(chorusLfo);
        chorusLfo.stop(time + playDuration + 0.1);
        
        const chorusGain = ctx.createGain();
        chorusGain.gain.setValueAtTime(0.5, time);
        currentOut.connect(chorusDelay);
        chorusDelay.connect(chorusGain);
        chorusGain.connect(destination);
      }

      currentOut.connect(destination);

      source.start(time, chop.start, playDuration);
      this.trackSource(source);

      this.samplerChokeNodes[chopIndex] = { source, gain };
      source.stop(time + playDuration + 0.1);
    } catch (err) {
      console.error('Error playing sampler chop:', err);
    }
  }

  private playSynthNote(
    instrument: InstrumentType,
    midi: number,
    time: number,
    duration: number,
    velFraction: number,
    destination: AudioNode,
    params?: SynthParams
  ): void {
    const ctx = this.ctx;
    if (!ctx) return;

    // Check if custom sample exists for this instrument channel
    if (this.customInstrumentBuffers[instrument]) {
      this.playCustomInstrumentSample(instrument, midi, time, duration, velFraction, destination, params);
      return;
    }

    const tracker = (osc: OscillatorNode) => {
      this.trackSource(osc);
    };

    switch (instrument) {
      case 'Bass':
        playBassVoice(ctx, midi, time, duration, velFraction, destination, params, tracker);
        break;
      case 'Keys':
        playKeysVoice(ctx, midi, time, duration, velFraction, destination, params, tracker);
        break;
      case 'Guitar':
        playGuitarVoice(ctx, midi, time, duration, velFraction, destination, params, tracker);
        break;
      case 'Pads':
        playPadsVoice(ctx, midi, time, duration, velFraction, destination, params, tracker);
        break;
      case 'Lead':
        playLeadVoice(ctx, midi, time, duration, velFraction, destination, params, tracker);
        break;
    }
  }

  /* ──── MIDI Event Compilation ──── */

  private compilePlaybackNotes(
    chords: Chord[],
    instrumentStates: Record<InstrumentType, InstrumentState>,
    _params: SessionParameters
  ): Array<{
    tick: number;
    duration: number;
    note: number;
    vel: number;
    channel: InstrumentType;
  }> {
    const rawEventsByChannel: Partial<Record<InstrumentType, MidiEvent[]>> = {};
    const channels: InstrumentType[] = ['Drums', 'Bass', 'Keys', 'Guitar', 'Pads', 'Lead', 'Sampler'];

    const notes: Array<{
      tick: number;
      duration: number;
      note: number;
      vel: number;
      channel: InstrumentType;
    }> = [];

    for (const instrument of channels) {
      // If we have custom user-edited MIDI notes, use them directly instead of generating procedural parts!
      if (this.editedMidi && this.editedMidi[instrument] && this.editedMidi[instrument].length > 0) {
        for (const note of this.editedMidi[instrument]) {
          notes.push({
            tick: note.tick ?? 0,
            duration: note.duration ?? 240,
            note: note.note ?? 60,
            vel: note.vel ?? note.velocity ?? 90,
            channel: instrument,
          });
        }
        continue;
      }

      const state = instrumentStates[instrument];
      if (!state?.enabled) continue;

      const p = state.params;
      
      // Map 0-100 to 0-3 sophistication level
      const instSophistication = Math.floor((p.sophistication || 50) / 25);
      const safeSophistication = Math.min(3, Math.max(0, instSophistication)) as 0 | 1 | 2 | 3;
      const instrumentChords = applySophistication(chords, safeSophistication);

      switch (instrument) {
        case 'Drums':
          rawEventsByChannel[instrument] = generateDrums(
            instrumentChords,
            p.playStyle,
            p.groove,
            p.sparseness,
            p.pocket,
            p.humanize,
            p.syncopation,
            p.tactileInject,
            p.perDrumPocket,
            p.perDrumSwing
          );
          break;

        case 'Bass':
          rawEventsByChannel[instrument] = generateBass(
            instrumentChords, p.playStyle, p.groove, p.sparseness,
            p.pocket, p.humanize, p.syncopation
          );
          break;

        case 'Keys':
          rawEventsByChannel[instrument] = generateKeys(
            instrumentChords, p.playStyle, p.groove, p.sparseness,
            p.pocket, p.humanize, p.syncopation
          );
          break;

        case 'Guitar':
          rawEventsByChannel[instrument] = generateGuitar(
            instrumentChords, p.playStyle, p.groove, p.sparseness,
            p.pocket, p.humanize, p.syncopation
          );
          break;

        case 'Pads':
          rawEventsByChannel[instrument] = generatePads(
            instrumentChords, p.playStyle, p.groove, p.sparseness,
            p.pocket, p.humanize, p.syncopation
          );
          break;

        case 'Lead':
          rawEventsByChannel[instrument] = generateLead(
            instrumentChords, p.playStyle, p.groove, p.sparseness,
            p.pocket, p.humanize, p.syncopation
          );
          break;
      }
    }

    const totalTicks = chords.reduce((sum, chord) => sum + chord.duration, 0) * 480;

    for (const instrument of channels) {
      const rawEvents = rawEventsByChannel[instrument] ?? [];

      /*
       * A queue is required because repeated MIDI pitches may overlap.
       * A simple Map<number, NoteOn> overwrites a prior note-on for the
       * same pitch and loses note duration information.
       */
      const activeNotes = new Map<number, Array<{ tick: number; vel: number }>>();

      const orderedEvents = [...rawEvents].sort((a, b) => {
        if (a.tick !== b.tick) return a.tick - b.tick;

        const aIsRelease =
          (a.status & 0xf0) === 0x80 ||
          ((a.status & 0xf0) === 0x90 && a.data[1] === 0);

        const bIsRelease =
          (b.status & 0xf0) === 0x80 ||
          ((b.status & 0xf0) === 0x90 && b.data[1] === 0);

        // Release before re-trigger at the same tick.
        return Number(bIsRelease) - Number(aIsRelease);
      });

      for (const event of orderedEvents) {
        const messageType = event.status & 0xf0;
        const noteNum = event.data[0];
        const velocity = event.data[1];

        const isNoteOn = messageType === 0x90 && velocity > 0;
        const isNoteOff = messageType === 0x80 || (messageType === 0x90 && velocity === 0);

        if (isNoteOn) {
          const queue = activeNotes.get(noteNum) ?? [];
          queue.push({ tick: event.tick, vel: velocity });
          activeNotes.set(noteNum, queue);
          continue;
        }

        if (!isNoteOff) continue;

        const queue = activeNotes.get(noteNum);
        const noteOn = queue?.shift();

        if (!noteOn) continue;

        notes.push({
          tick: noteOn.tick,
          duration: Math.max(1, event.tick - noteOn.tick),
          note: noteNum,
          vel: noteOn.vel,
          channel: instrument,
        });

        if (queue?.length === 0) {
          activeNotes.delete(noteNum);
        }
      }

      activeNotes.forEach((queue, noteNum) => {
        for (const noteOn of queue) {
          notes.push({
            tick: noteOn.tick,
            duration: Math.max(120, totalTicks - noteOn.tick),
            note: noteNum,
            vel: noteOn.vel,
            channel: instrument,
          });
        }
      });
    }

    return notes.sort((a, b) => a.tick - b.tick);
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export const audioEngine = new AudioEngine();