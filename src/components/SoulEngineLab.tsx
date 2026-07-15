/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Flame, 
  GitMerge, 
  Layers, 
  Radio, 
  Activity, 
  Sliders, 
  Music, 
  Database, 
  ArrowRight, 
  Upload, 
  Compass, 
  RefreshCw, 
  HelpCircle,
  FileSpreadsheet,
  Cpu,
  AlertTriangle,
  X
} from 'lucide-react';
import { 
  SoulBandEngine, 
  SoulTimingStyle, 
  SoulVoicingType, 
  SoulProgressionStyle, 
  IngestedDataset 
} from '../services/soulEngine';

interface SoulEngineLabProps {
  bpm: number;
  onApplyProgression: (chords: { root: string; type: string; duration: number }[]) => void;
}

type ChordShape = { root: string; type: string; duration: number };

const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2MB
const SUPPORTED_EXTENSIONS = /\.(json|csv)$/i;

export const SoulEngineLab: React.FC<SoulEngineLabProps> = ({ bpm, onApplyProgression }) => {
  const [engine] = useState(() => new SoulBandEngine('neo_soul'));
  const [style, setStyle] = useState<SoulTimingStyle>('neo_soul');
  const [selectedVoicing, setSelectedVoicing] = useState<SoulVoicingType>('minor9');
  const [selectedProgression, setSelectedProgression] = useState<SoulProgressionStyle>('neo_soul');
  const [logs, setLogs] = useState(() => engine.interaction.getLogs());
  const [datasets, setDatasets] = useState<IngestedDataset[]>(() => engine.harmony.getIngestedDatasets());
  const [tone, setTone] = useState(() => engine.tone.settings);
  const [rhythm, setRhythm] = useState(() => engine.rhythm.getPatterns());

  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isIngesting, setIsIngesting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    engine.setStyle(style);
    setLogs([...engine.interaction.getLogs()]);
  }, [style, engine]);

  const triggerNegotiation = () => {
    engine.runBandSession('verse', bpm);
    engine.runBandSession('chorus', bpm);
    setLogs([...engine.interaction.getLogs()]);
  };

  const toggleDataset = (id: string) => {
    engine.harmony.toggleDataset(id);
    setDatasets([...engine.harmony.getIngestedDatasets()]);
    setLogs([...engine.interaction.getLogs()]);
  };

  const handleApplyProgression = (styleKey: SoulProgressionStyle) => {
    const rawProgressions = engine.harmony.getRawProgressions(styleKey);
    const mappedChords = rawProgressions[0] || [];

    onApplyProgression(mappedChords);
    engine.interaction.addLog('HarmonicEngine', 'Progression Applied', `Injected ${styleKey} progression into live canvas`);
    setLogs([...engine.interaction.getLogs()]);
  };

  // ── Real dataset parsing ──

  const parseChordCsv = (text: string): ChordShape[][] => {
    const lines = text
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean);

    if (lines.length < 2) {
      throw new Error('CSV must include a header row and at least one chord row');
    }

    const header = lines[0].split(',').map(col => col.trim().toLowerCase());
    const rootIdx = header.indexOf('root');
    const typeIdx = header.indexOf('type');
    const durationIdx = header.indexOf('duration');
    const progressionIdx = header.indexOf('progression_id');

    if (rootIdx === -1 || typeIdx === -1) {
      throw new Error('CSV must include "root" and "type" columns');
    }

    const progressionMap = new Map<string, ChordShape[]>();

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map(col => col.trim());
      if (!cols[rootIdx] || !cols[typeIdx]) continue;

      const progressionKey = progressionIdx >= 0 ? cols[progressionIdx] : 'default';
      const chord: ChordShape = {
        root: cols[rootIdx],
        type: cols[typeIdx],
        duration: durationIdx >= 0 ? parseFloat(cols[durationIdx]) || 4 : 4,
      };

      const existing = progressionMap.get(progressionKey) || [];
      existing.push(chord);
      progressionMap.set(progressionKey, existing);
    }

    const progressions = Array.from(progressionMap.values());
    if (progressions.length === 0) {
      throw new Error('No valid chord rows found in CSV');
    }

    return progressions;
  };

  const parseChordJson = (text: string): ChordShape[][] => {
    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error('File is not valid JSON');
    }

    const raw = Array.isArray(parsed) ? parsed : parsed.progressions;
    if (!Array.isArray(raw) || raw.length === 0) {
      throw new Error('JSON must be an array of chords or { progressions: [...] }');
    }

    const isFlat = !Array.isArray(raw[0]);
    const progressions = isFlat ? [raw] : raw;

    const mapped = progressions.map((progression: any[]) =>
      progression
        .filter(chord => chord && chord.root && chord.type)
        .map(chord => ({
          root: String(chord.root),
          type: String(chord.type),
          duration: Number(chord.duration) || 4,
        }))
    );

    if (mapped.every((p: ChordShape[]) => p.length === 0)) {
      throw new Error('No valid chords found in JSON');
    }

    return mapped;
  };

  const ingestFile = (file: File) => {
    setUploadError(null);

    if (!SUPPORTED_EXTENSIONS.test(file.name)) {
      setUploadError(`Unsupported file type: "${file.name}". Use .json or .csv`);
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setUploadError(
        `File too large (${(file.size / 1024 / 1024).toFixed(2)}MB). Max size is ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB.`
      );
      return;
    }

    setIsIngesting(true);
    setUploadStatus(`Reading ${file.name}...`);

    const reader = new FileReader();

    reader.onload = () => {
      try {
        const text = reader.result as string;
        const isJson = file.name.toLowerCase().endsWith('.json');
        const parsedProgressions = isJson ? parseChordJson(text) : parseChordCsv(text);

        const newDataset = engine.harmony.ingestNewDataset(
          `${file.name} (Ingested)`,
          'Local File Upload',
          parsedProgressions
        );

        setDatasets([...engine.harmony.getIngestedDatasets()]);
        setUploadStatus(`Success! Ingested ${newDataset.chordCount} chords across ${parsedProgressions.length} progressions.`);
        engine.interaction.addLog(
          'HarmonicEngine',
          'Dataset Ingested',
          `Parsed ${parsedProgressions.length} progressions from ${file.name}`
        );
        setLogs([...engine.interaction.getLogs()]);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown parsing error';
        setUploadError(`Failed to parse "${file.name}": ${message}`);
        setUploadStatus(null);
      } finally {
        setIsIngesting(false);
      }
    };

    reader.onerror = () => {
      setUploadError(`Failed to read "${file.name}". The file may be corrupted.`);
      setUploadStatus(null);
      setIsIngesting(false);
    };

    reader.readAsText(file);
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) ingestFile(file);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) ingestFile(file);
    e.target.value = '';
  };

  const updateToneSetting = <K extends keyof typeof tone>(key: K, value: typeof tone[K]) => {
    engine.tone.updateSetting(key, value);
    setTone({ ...engine.tone.settings });
  };

  const toggleRhythmPattern = (inst: keyof typeof rhythm, key: string) => {
    const currentVal = (rhythm[inst] as any)[key];
    engine.rhythm.updatePattern(inst, key, !currentVal);
    setRhythm({ ...engine.rhythm.getPatterns() });
    engine.interaction.addLog('RhythmEngine', 'Groove DNA Mutation', `Modified ${inst as string} pattern settings`);
    setLogs([...engine.interaction.getLogs()]);
  };

  const activeProfile = engine.timing.getProfile();

  return (
    <div className="space-y-6" id="soul-engine-lab">
      {/* ── HEADER ── */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-5 bg-[#121216] border border-studio-border/60 rounded-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-5">
          <Flame className="w-48 h-48 text-studio-accent animate-pulse" />
        </div>
        
        <div className="space-y-1 z-10">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-studio-accent/20 rounded-lg text-studio-accent">
              <Cpu className="w-4 h-4" />
            </span>
            <span className="text-[10px] font-mono font-bold text-studio-accent uppercase tracking-widest">v1.0 ENGINE SPECIFICATION ACTIVE</span>
          </div>
          <h3 className="text-xl font-display font-bold text-white tracking-tight">Soul/R&B Groove & Timing Engine</h3>
          <p className="text-xs font-mono text-studio-muted max-w-2xl">
            A deterministic multi-agent timing, harmonic, and rhythm synthesizer generating micro-timing drift, laying back "snare behind kick" pockets, and step voice-led extended voicings.
          </p>
        </div>

        <button 
          onClick={triggerNegotiation}
          className="btn-vintage px-4 py-2 rounded-lg flex items-center gap-2 text-xs font-mono text-studio-accent hover:text-white transition cursor-pointer self-stretch md:self-auto justify-center"
        >
          <RefreshCw className="w-4 h-4 animate-spin-slow" />
          <span>Negotiate Live Agents</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* ── LEFT: GROOVE & TIMING DEVIATIONS (7 Columns) ── */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* TIMING ENGINE GRID */}
          <div className="bg-[#0e0e11]/90 p-5 rounded-xl border border-studio-border/50 space-y-4">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-studio-accent" />
                <h4 className="text-xs font-mono font-bold text-white uppercase tracking-wider">Timing Engine: Micro-Timing Grids</h4>
              </div>
              
              <div className="flex gap-1.5 bg-black/40 p-1 rounded-lg border border-studio-border/30">
                {(['neo_soul', 'motown', 'gospel_soul', 'g_funk'] as SoulTimingStyle[]).map(s => (
                  <button
                    key={s}
                    onClick={() => setStyle(s)}
                    className={`px-2.5 py-1 rounded text-[9px] font-mono uppercase font-bold transition-all cursor-pointer ${
                      style === s 
                        ? 'bg-studio-accent text-white shadow-sm' 
                        : 'text-studio-muted hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {s.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            <p className="text-[10px] font-mono text-studio-muted leading-relaxed">
              {style === 'neo_soul' && "⏱️ Neo-Soul Pocket: Snare heavily laid back (15-35ms behind) + lazy bass drift for that classic 'drunk' Dilla-esque bounce."}
              {style === 'motown' && "⏱️ Motown Style: Fast hi-hat tension (4-10ms ahead) with tight, highly coordinated on-the-grid snaps."}
              {style === 'gospel_soul' && "⏱️ Gospel Feel: Pushing hats slightly, laying back snare for an emotional collective forward lean."}
              {style === 'g_funk' && "⏱️ G-Funk Swing: Laid back slinky bass (15-25ms behind) and extremely relaxed snare snaps."}
            </p>

            <div className="space-y-3.5 pt-2">
              {Object.entries(activeProfile).map(([inst, range]) => {
                const centerVal = (range[0] + range[1]) / 2;
                const visualPercent = Math.min(100, Math.max(0, ((centerVal + 15) / 55) * 100));

                return (
                  <div key={inst} className="space-y-1">
                    <div className="flex items-center justify-between text-[10px] font-mono">
                      <span className="uppercase font-bold text-white">{inst}</span>
                      <span className="text-studio-accent">{range[0]}ms to {range[1]}ms</span>
                    </div>
                    <div className="relative h-6 bg-black/50 rounded-md overflow-hidden flex items-center px-2 border border-white/5">
                      <div className="absolute left-[33%] top-0 bottom-0 w-px bg-white/20 border-dashed" />
                      
                      <div 
                        className="absolute h-3 rounded transition-all duration-300"
                        style={{ 
                          left: centerVal >= 0 ? '33%' : `${visualPercent}%`, 
                          width: `${Math.abs(centerVal) / 55 * 100}%`,
                          background: 'linear-gradient(90deg, #6366f1 0%, #a855f7 100%)'
                        }}
                      />
                      
                      <span className="absolute left-2 text-[8px] font-mono text-studio-muted uppercase">Ahead</span>
                      <span className="absolute right-2 text-[8px] font-mono text-studio-muted uppercase">Behind</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* HARMONIC ENGINE & DECISIONS */}
          <div className="bg-[#0e0e11]/90 p-5 rounded-xl border border-studio-border/50 space-y-4">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-studio-accent" />
                <h4 className="text-xs font-mono font-bold text-white uppercase tracking-wider">Harmonic Engine: Extended Voicings</h4>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-3">
                <span className="text-[10px] font-mono text-studio-muted uppercase tracking-wider block">Theoretical Intervals</span>
                <div className="space-y-2">
                  {Object.keys(engine.harmony.voicings).map(vType => {
                    const active = selectedVoicing === vType;
                    const chordFormula = engine.harmony.voicings[vType as SoulVoicingType].join(' - ');
                    return (
                      <button
                        key={vType}
                        onClick={() => setSelectedVoicing(vType as SoulVoicingType)}
                        className={`w-full p-3 rounded-lg border text-left font-mono transition-all cursor-pointer ${
                          active 
                            ? 'bg-studio-accent/15 border-studio-accent/60 text-white' 
                            : 'bg-black/35 border-white/5 text-studio-muted hover:border-white/10 hover:text-studio-text'
                        }`}
                      >
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-[11px] font-bold uppercase text-white">{vType}</span>
                          {active && <span className="w-1.5 h-1.5 rounded-full bg-studio-accent" />}
                        </div>
                        <span className="text-[9px] text-studio-muted block">Formula: {chordFormula}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-3">
                <span className="text-[10px] font-mono text-studio-muted uppercase tracking-wider block">Soul Progressions</span>
                <div className="space-y-2">
                  {Object.keys(engine.harmony.progressions).map(pStyle => {
                    const active = selectedProgression === pStyle;
                    const progressionFormula = engine.harmony.getProgressions(pStyle as SoulProgressionStyle)[0].join(' → ');
                    return (
                      <div
                        key={pStyle}
                        className={`p-3 rounded-lg border text-left font-mono transition-all ${
                          active 
                            ? 'bg-studio-accent/15 border-studio-accent/40' 
                            : 'bg-black/35 border-white/5'
                        }`}
                      >
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-[11px] font-bold uppercase text-white">{pStyle.replace('_', ' ')}</span>
                          <button
                            onClick={() => {
                              setSelectedProgression(pStyle as SoulProgressionStyle);
                              handleApplyProgression(pStyle as SoulProgressionStyle);
                            }}
                            className="text-[9px] bg-studio-accent px-1.5 py-0.5 rounded text-white font-bold uppercase hover:bg-studio-accent-hover transition cursor-pointer"
                          >
                            Apply Chords
                          </button>
                        </div>
                        <span className="text-[9px] text-studio-muted block">Formula: {progressionFormula}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* RHYTHM ENGINE (GROOVE DNA FLAGS) */}
          <div className="bg-[#0e0e11]/90 p-5 rounded-xl border border-studio-border/50 space-y-4">
            <div className="flex items-center gap-2 border-b border-white/5 pb-3">
              <Compass className="w-4 h-4 text-studio-accent" />
              <h4 className="text-xs font-mono font-bold text-white uppercase tracking-wider">Rhythm Engine: Dynamic Groove DNA</h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(rhythm).map(([inst, flags]) => (
                <div key={inst} className="bg-black/40 p-4 rounded-xl border border-white/5 space-y-3">
                  <span className="text-[11px] font-mono font-bold text-white uppercase block mb-1 border-b border-white/5 pb-1">{inst} Patterns</span>
                  <div className="space-y-2">
                    {Object.entries(flags).map(([flagKey, val]) => (
                      <div key={flagKey} className="flex items-center justify-between text-[10px] font-mono">
                        <span className="text-studio-muted capitalize">{flagKey.replace('_', ' ')}</span>
                        <button
                          onClick={() => toggleRhythmPattern(inst as any, flagKey)}
                          className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer ${
                            val ? 'bg-studio-accent flex justify-end' : 'bg-studio-muted/30 flex justify-start'
                          }`}
                        >
                          <div className="w-4 h-4 rounded-full bg-white shadow-sm" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* ── RIGHT: ANALOG TONE, DATASETS, AGENTS (5 Columns) ── */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* ANALOG TONE WARMTH (DSP PHYSICAL MODELING) */}
          <div className="bg-[#0e0e11]/90 p-5 rounded-xl border border-studio-border/50 space-y-4">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-studio-accent" />
                <h4 className="text-xs font-mono font-bold text-white uppercase tracking-wider">Tone Engine: Analog Emulation</h4>
              </div>
            </div>

            <div className="space-y-4 pt-1">
              <div className="space-y-1.5">
                <div className="flex justify-between text-[10px] font-mono">
                  <span className="text-studio-muted uppercase">Tape Saturation DB</span>
                  <span className="text-studio-accent font-bold">{tone.tape_saturation_db} dB</span>
                </div>
                <input 
                  type="range" min="0" max="6" step="0.1"
                  value={tone.tape_saturation_db} 
                  onChange={(e) => updateToneSetting('tape_saturation_db', parseFloat(e.target.value))}
                  className="w-full accent-studio-accent bg-black/40 h-1.5 rounded-lg outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-[10px] font-mono">
                  <span className="text-studio-muted uppercase">Lowpass Cutoff (HF Dampen)</span>
                  <span className="text-studio-accent font-bold">{tone.lowpass_cutoff} Hz</span>
                </div>
                <input 
                  type="range" min="4000" max="15000" step="100"
                  value={tone.lowpass_cutoff} 
                  onChange={(e) => updateToneSetting('lowpass_cutoff', parseInt(e.target.value))}
                  className="w-full accent-studio-accent bg-black/40 h-1.5 rounded-lg outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-[10px] font-mono">
                  <span className="text-studio-muted uppercase">Drum Room Size</span>
                  <span className="text-studio-accent font-bold">{tone.drum_room_reverb_ms} ms</span>
                </div>
                <input 
                  type="range" min="50" max="800" step="10"
                  value={tone.drum_room_reverb_ms} 
                  onChange={(e) => updateToneSetting('drum_room_reverb_ms', parseInt(e.target.value))}
                  className="w-full accent-studio-accent bg-black/40 h-1.5 rounded-lg outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-[10px] font-mono">
                  <span className="text-studio-muted uppercase">Vinyl Crackle & Dust</span>
                  <span className="text-studio-accent font-bold">{tone.vinyl_crackle_level}%</span>
                </div>
                <input 
                  type="range" min="0" max="100" step="1"
                  value={tone.vinyl_crackle_level} 
                  onChange={(e) => updateToneSetting('vinyl_crackle_level', parseInt(e.target.value))}
                  className="w-full accent-studio-accent bg-black/40 h-1.5 rounded-lg outline-none"
                />
              </div>

              <div className="flex items-center justify-between text-[10px] font-mono pt-1">
                <span className="text-studio-muted uppercase">Bass Tube Preamp Drive</span>
                <button
                  onClick={() => updateToneSetting('tube_saturation_bass', !tone.tube_saturation_bass)}
                  className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer ${
                    tone.tube_saturation_bass ? 'bg-studio-accent flex justify-end' : 'bg-studio-muted/30 flex justify-start'
                  }`}
                >
                  <div className="w-4 h-4 rounded-full bg-white shadow-sm" />
                </button>
              </div>
            </div>
          </div>

          {/* DATASET INGESTION PIPELINE */}
          <div className="bg-[#0e0e11]/90 p-5 rounded-xl border border-studio-border/50 space-y-4">
            <div className="flex items-center gap-2 border-b border-white/5 pb-3">
              <Database className="w-4 h-4 text-studio-accent" />
              <h4 className="text-xs font-mono font-bold text-white uppercase tracking-wider">Symbolic Dataset Ingest</h4>
            </div>

            <p className="text-[10px] font-mono text-studio-muted leading-relaxed">
              Inject external research corpuses (Chordonomicon, ChoCo, Jazz Corps) into the active engine to shift probabilities of generated progressions towards real historical patterns.
            </p>

            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {datasets.map(d => (
                <div key={d.id} className="p-2.5 rounded-lg bg-black/30 border border-white/5 flex items-center justify-between text-[10px] font-mono">
                  <div className="space-y-1">
                    <span className="text-white font-bold block">{d.name}</span>
                    <span className="text-[8px] text-studio-muted block max-w-[200px] truncate">{d.source}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[8px] px-1 bg-studio-accent/10 border border-studio-accent/20 text-studio-accent rounded">{d.chordCount.toLocaleString()} Chords</span>
                      <span className="text-[8px] px-1 bg-white/5 text-studio-muted rounded">{d.complexity}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => toggleDataset(d.id)}
                    className={`px-2 py-1 rounded text-[8px] font-mono font-bold uppercase transition-all cursor-pointer ${
                      d.active 
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                        : 'bg-white/5 text-studio-muted hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {d.active ? 'Active' : 'Utilize'}
                  </button>
                </div>
              ))}
            </div>

            {/* DRAG AND DROP ZONE */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,.csv"
              onChange={handleFileInputChange}
              className="hidden"
            />

            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleFileDrop}
              onClick={() => !isIngesting && fileInputRef.current?.click()}
              className={`p-4 rounded-lg border-2 border-dashed text-center transition-all ${
                isIngesting ? 'opacity-50 cursor-wait border-white/10' :
                isDragging 
                  ? 'border-studio-accent bg-studio-accent/10 cursor-pointer' 
                  : 'border-white/10 hover:border-studio-accent/30 hover:bg-white/[0.02] cursor-pointer'
              }`}
            >
              <Upload className={`w-5 h-5 mx-auto text-studio-muted mb-2 ${isIngesting ? 'animate-pulse' : ''}`} />
              <span className="text-[9px] font-mono text-white block uppercase font-bold">
                {isIngesting ? 'PROCESSING...' : 'DRAG & DROP DATASETS'}
              </span>
              <span className="text-[8px] font-mono text-studio-muted block mt-0.5">
                SUPPORTED: .JSON / .CSV CHORD SEQUENCES (MAX {MAX_FILE_SIZE_BYTES / 1024 / 1024}MB)
              </span>
            </div>

            {uploadStatus && !uploadError && (
              <div className="p-2 rounded bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-mono text-emerald-400 text-center">
                {uploadStatus}
              </div>
            )}

            {uploadError && (
              <div className="p-2.5 rounded bg-red-500/10 border border-red-500/30 text-[9px] font-mono text-red-400 flex items-start gap-2">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                <span className="flex-1">{uploadError}</span>
                <button onClick={() => setUploadError(null)} className="cursor-pointer flex-shrink-0">
                  <X className="w-3.5 h-3.5 text-red-400/70 hover:text-red-300" />
                </button>
              </div>
            )}
          </div>

          {/* ACTIVE MULTI-AGENT NEGOTIATION WORKSPACE */}
          <div className="bg-[#0e0e11]/90 p-5 rounded-xl border border-studio-border/50 space-y-4">
            <div className="flex items-center gap-2 border-b border-white/5 pb-3">
              <GitMerge className="w-4 h-4 text-studio-accent" />
              <h4 className="text-xs font-mono font-bold text-white uppercase tracking-wider">Multi-Agent State logs</h4>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="p-2 rounded bg-black/40 text-center border border-white/5">
                <span className="text-[8px] font-mono text-studio-muted block uppercase">ACTIVE SECTION</span>
                <span className="text-xs font-mono font-bold text-studio-accent uppercase">{engine.interaction.state.section}</span>
              </div>
              <div className="p-2 rounded bg-black/40 text-center border border-white/5">
                <span className="text-[8px] font-mono text-studio-muted block uppercase">PEER DENSITY</span>
                <span className="text-xs font-mono font-bold text-studio-accent uppercase">{engine.interaction.state.density}</span>
              </div>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {logs.map((log, idx) => (
                <div key={idx} className="p-2 rounded-lg bg-black/30 border border-white/5 text-[9px] font-mono space-y-0.5">
                  <div className="flex justify-between items-center text-[8px]">
                    <span className="text-studio-muted font-bold">{log.agent}</span>
                    <span className="text-studio-muted/60">{log.timestamp}</span>
                  </div>
                  <div className="text-white">
                    <span className="text-studio-accent font-bold uppercase mr-1">[{log.action}]</span>
                    {log.detail}
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
