import React, { useState, useEffect, useRef, useMemo } from 'react';
import { audioEngine } from '../services/audioEngine';
import { InstrumentType, Chord, SessionParameters, INSTRUMENT_PLAY_STYLES, PerformedNote } from '../types';
import { 
  ZoomIn, ZoomOut, Sparkles, Volume2, 
  HelpCircle, Play, Square, Layers, Shuffle, Flame
} from 'lucide-react';
import { cn } from '../lib/utils';

interface PianoRollProps {
  isPlaying: boolean;
  activeInstrument: InstrumentType;
  chords: Chord[];
  bpm: number;
  params: SessionParameters;
  onUpdateParams: (updatedParams: Partial<SessionParameters>) => void;
  onTriggerAction?: (actionName: string) => void;
  editedMidi: PerformedNote[];
  onUpdateMidi: (notes: PerformedNote[]) => void;
}

// Map MIDI notes for standard instruments
const DRUM_NOTES = [
  { pitch: 49, name: 'Cymbal (49)' },
  { pitch: 47, name: 'Mid Tom (47)' },
  { pitch: 46, name: 'Open Hat (46)' },
  { pitch: 42, name: 'Hi-Hat (42)' },
  { pitch: 38, name: 'Snare (38)' },
  { pitch: 36, name: 'Kick (36)' }
];

const MELODIC_SCALE_PITCHES = [
  { offset: 12, name: 'Octave (+12)' },
  { offset: 10, name: '7th (+10)' },
  { offset: 9, name: '6th (+9)' },
  { offset: 7, name: '5th (+7)' },
  { offset: 5, name: '4th (+5)' },
  { offset: 4, name: '3rd (+4)' },
  { offset: 2, name: '2nd (+2)' },
  { offset: 0, name: 'Root (0)' },
  { offset: -12, name: 'Bass Octave (-12)' }
];

export const PianoRoll: React.FC<PianoRollProps> = ({
  isPlaying,
  activeInstrument,
  chords,
  bpm,
  params,
  onUpdateParams,
  onTriggerAction,
  editedMidi,
  onUpdateMidi,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);

  // Zoom Levels
  const [zoomX, setZoomX] = useState<number>(1.2); // Horizontal zoom multiplier
  const [zoomY, setZoomY] = useState<number>(1.0); // Vertical row height multiplier

  const [hoveredStep, setHoveredStep] = useState<{ step: number; lane: number } | null>(null);

  const totalBeats = useMemo(() => chords.reduce((sum, c) => sum + c.duration, 0), [chords]);
  const totalTicks = totalBeats * 480;
  const stepsPerBeat = 4; // 16th notes snap
  const totalSteps = totalBeats * stepsPerBeat;

  // Editor Actions & Refs
  type EditorAction =
    | {
        type: 'create';
        pointerId: number;
        pitch: number;
        startTick: number;
        currentTick: number;
      }
    | {
        type: 'move';
        pointerId: number;
        noteId: string;
        originTick: number;
        originNote: number;
        startClientX: number;
        startClientY: number;
      }
    | {
        type: 'resize';
        pointerId: number;
        noteId: string;
        startTick: number;
      };

  const editorActionRef = useRef<EditorAction | null>(null);

  const TICKS_PER_BEAT = 480;
  const STEPS_PER_BEAT = 4;
  const TICKS_PER_STEP = TICKS_PER_BEAT / STEPS_PER_BEAT; // 120 = 16th note
  const MIN_NOTE_DURATION = TICKS_PER_STEP;

  // Retrieve current MIDI notes compiled by audioEngine
  const playbackState = useMemo(() => {
    return audioEngine.getPlaybackState();
  }, [isPlaying, chords, bpm, params, activeInstrument]);

  // Handle styles in sidebar
  const availableStyles = useMemo(() => {
    return INSTRUMENT_PLAY_STYLES[activeInstrument] || [];
  }, [activeInstrument]);

  const tactileOptions = [
    'None',
    'Kick-Snare Pocket',
    'Snare Roll Fill',
    'Hi-Hat Accent',
    'Cymbal Splash'
  ];

  const getGridMetrics = () => {
    const baseRowHeight = activeInstrument === 'Drums' ? 32 : 24;

    return {
      rowHeight: baseRowHeight * zoomY,
      stepWidth: 36 * zoomX,
      lanes: activeInstrument === 'Drums' ? DRUM_NOTES : MELODIC_SCALE_PITCHES,
    };
  };

  const snapTick = (tick: number) => {
    const clamped = Math.max(0, Math.min(totalTicks - MIN_NOTE_DURATION, tick));
    return Math.round(clamped / TICKS_PER_STEP) * TICKS_PER_STEP;
  };

  const getCanvasPosition = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();

    // Canvas pixels can differ from displayed CSS pixels.
    const x = (event.clientX - rect.left) * (canvas.width / rect.width);
    const y = (event.clientY - rect.top) * (canvas.height / rect.height);

    return { x, y };
  };

  const getTickAtX = (x: number) => {
    const { stepWidth } = getGridMetrics();
    return snapTick((x / stepWidth) * TICKS_PER_STEP);
  };

  const getPitchAtY = (y: number) => {
    const { rowHeight, lanes } = getGridMetrics();
    const laneIndex = Math.max(0, Math.min(lanes.length - 1, Math.floor(y / rowHeight)));

    if (activeInstrument === 'Drums') {
      return DRUM_NOTES[laneIndex].pitch;
    }

    return 60 + MELODIC_SCALE_PITCHES[laneIndex].offset;
  };

  const getNoteAtPosition = (x: number, y: number) => {
    const { rowHeight, stepWidth } = getGridMetrics();
    const tick = (x / stepWidth) * TICKS_PER_STEP;
    const pitch = getPitchAtY(y);

    return editedMidi
      .filter(note => note.channel === activeInstrument)
      .find(note => {
        const samePitch = note.note === pitch;
        const insideTime = tick >= note.tick! && tick <= note.tick! + note.duration!;
        return samePitch && insideTime;
      });
  };

  // Draw the piano roll on canvas
  const drawPianoRoll = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { rowHeight, stepWidth, lanes } = getGridMetrics();
    const laneCount = lanes.length;

    // Adjust canvas size to zoom factors
    canvas.width = totalSteps * stepWidth + 100; // room for playhead/margin
    canvas.height = laneCount * rowHeight;

    // Background color
    ctx.fillStyle = '#0a0a0c';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw horizontal grid lines (lanes)
    ctx.strokeStyle = '#1e1e24';
    ctx.lineWidth = 1;
    for (let i = 0; i <= laneCount; i++) {
      ctx.beginPath();
      ctx.moveTo(0, i * rowHeight);
      ctx.lineTo(canvas.width, i * rowHeight);
      ctx.stroke();
    }

    // Draw vertical step lines (subdivisions)
    for (let s = 0; s <= totalSteps; s++) {
      const isBeatStart = s % stepsPerBeat === 0;
      const isBarStart = s % (stepsPerBeat * 4) === 0;

      ctx.strokeStyle = isBarStart 
        ? 'rgba(99, 102, 241, 0.25)' 
        : isBeatStart 
          ? 'rgba(255, 255, 255, 0.12)' 
          : 'rgba(255, 255, 255, 0.04)';
      
      ctx.lineWidth = isBarStart ? 1.5 : 1;

      ctx.beginPath();
      ctx.moveTo(s * stepWidth, 0);
      ctx.lineTo(s * stepWidth, canvas.height);
      ctx.stroke();
    }

    // Draw active notes
    const state = audioEngine.getPlaybackState();
    const notes = editedMidi.filter(note => note.channel === activeInstrument);

    notes.forEach(note => {
      // Find row index based on pitch
      let laneIndex = -1;
      if (activeInstrument === 'Drums') {
        laneIndex = DRUM_NOTES.findIndex(drum => drum.pitch === note.note);
      } else {
        const relativeOffset = note.note! - 60;
        laneIndex = MELODIC_SCALE_PITCHES.findIndex(
          lane => lane.offset === relativeOffset
        );
      }

      if (laneIndex >= 0 && laneIndex < laneCount) {
        const noteX = (note.tick! / totalTicks) * (totalSteps * stepWidth);
        const noteW = (note.duration! / totalTicks) * (totalSteps * stepWidth);
        const noteY = laneIndex * rowHeight;

        // Is currently playing?
        const isCurrentlyPlaying = state.isRunning &&
          state.currentTick >= note.tick! &&
          state.currentTick <= note.tick! + note.duration!;

        ctx.fillStyle = isCurrentlyPlaying
          ? 'rgba(99, 102, 241, 0.85)' // Bright glowing indigo
          : 'rgba(129, 140, 248, 0.35)'; // Darker translucent indigo
        
        ctx.strokeStyle = isCurrentlyPlaying ? '#ffffff' : '#4f46e5';
        ctx.lineWidth = 1;

        // Draw note rectangle
        ctx.beginPath();
        ctx.roundRect(noteX + 1.5, noteY + 2, Math.max(4, noteW - 3), rowHeight - 4, 3);
        ctx.fill();
        ctx.stroke();
      }
    });

    // Draw Drag / Create Preview
    const activeEdit = editorActionRef.current;
    if (activeEdit?.type === 'create') {
      const laneIndex =
        activeInstrument === 'Drums'
          ? DRUM_NOTES.findIndex(drum => drum.pitch === activeEdit.pitch)
          : MELODIC_SCALE_PITCHES.findIndex(
              lane => 60 + lane.offset === activeEdit.pitch
            );

      const startTick = Math.min(activeEdit.startTick, activeEdit.currentTick);
      const endTick = Math.max(activeEdit.startTick, activeEdit.currentTick);

      const previewX = (startTick / totalTicks) * (totalSteps * stepWidth);
      const previewW =
        ((endTick - startTick) / totalTicks) * (totalSteps * stepWidth);

      ctx.fillStyle = 'rgba(167, 139, 250, 0.4)';
      ctx.strokeStyle = '#a78bfa';
      ctx.setLineDash([4, 3]);

      ctx.beginPath();
      ctx.roundRect(
        previewX + 1.5,
        laneIndex * rowHeight + 2,
        Math.max(4, previewW - 3),
        rowHeight - 4,
        3
      );
      ctx.fill();
      ctx.stroke();

      ctx.setLineDash([]);
    }

    // Draw playhead vertical line
    if (state.isRunning) {
      const playheadX = (state.currentTick / totalTicks) * (totalSteps * stepWidth);

      // Vertical line
      ctx.strokeStyle = 'rgba(244, 63, 94, 0.85)'; // Beautiful ruby pink
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, canvas.height);
      ctx.stroke();

      // playhead dot
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(playheadX, 3, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    animationRef.current = requestAnimationFrame(drawPianoRoll);
  };

  useEffect(() => {
    animationRef.current = requestAnimationFrame(drawPianoRoll);
    return () => cancelAnimationFrame(animationRef.current);
  }, [isPlaying, activeInstrument, chords, bpm, params, zoomX, zoomY, editedMidi]);

  // Play single note synthetically on row header click
  const handlePlayRowNote = (pitch: number) => {
    // Basic frequency mapping
    const baseFreq = 130.81; // C3
    const factor = Math.pow(2, (pitch - 48) / 12);
    const freq = baseFreq * factor;

    if (activeInstrument === 'Drums') {
      if (pitch === 36) audioEngine.playNote(55, 'triangle', 0.15); // Kick
      else if (pitch === 38) audioEngine.playNote(220, 'sawtooth', 0.1); // Snare
      else if (pitch === 42) audioEngine.playNote(1000, 'sine', 0.04); // Hihat
      else if (pitch === 46) audioEngine.playNote(800, 'sine', 0.15); // OpenHat
      else if (pitch === 47) audioEngine.playNote(90, 'triangle', 0.2); // Tom
      else audioEngine.playNote(3000, 'sine', 0.08); // Cymbal / perc
    } else {
      audioEngine.playNote(freq, 'sawtooth', 0.35);
    }
  };

  const handleCanvasPointerDown = (
    event: React.PointerEvent<HTMLCanvasElement>
  ) => {
    const position = getCanvasPosition(event);
    if (!position) return;

    event.currentTarget.setPointerCapture(event.pointerId);

    const hitNote = getNoteAtPosition(position.x, position.y);

    // Right-click deletes an existing note.
    if (event.button === 2) {
      if (hitNote) {
        onUpdateMidi(editedMidi.filter(note => note.id !== hitNote.id));
      }
      return;
    }

    if (event.button !== 0) return;

    const { stepWidth } = getGridMetrics();
    const pointerTick = getTickAtX(position.x);

    if (hitNote) {
      const noteStartX = (hitNote.tick! / TICKS_PER_STEP) * stepWidth;
      const noteEndX =
        ((hitNote.tick! + hitNote.duration!) / TICKS_PER_STEP) * stepWidth;

      const resizeHandleWidth = 10;
      const isResizeHandle = position.x >= noteEndX - resizeHandleWidth;

      if (isResizeHandle) {
        editorActionRef.current = {
          type: 'resize',
          pointerId: event.pointerId,
          noteId: hitNote.id!,
          startTick: hitNote.tick!,
        };
      } else {
        editorActionRef.current = {
          type: 'move',
          pointerId: event.pointerId,
          noteId: hitNote.id!,
          originTick: hitNote.tick!,
          originNote: hitNote.note!,
          startClientX: event.clientX,
          startClientY: event.clientY,
        };
      }

      return;
    }

    const pitch = getPitchAtY(position.y);

    editorActionRef.current = {
      type: 'create',
      pointerId: event.pointerId,
      pitch,
      startTick: pointerTick,
      currentTick: pointerTick + MIN_NOTE_DURATION,
    };
  };

  const handleCanvasPointerMove = (
    event: React.PointerEvent<HTMLCanvasElement>
  ) => {
    const action = editorActionRef.current;
    if (!action || action.pointerId !== event.pointerId) return;

    const position = getCanvasPosition(event);
    if (!position) return;

    const currentTick = getTickAtX(position.x);

    if (action.type === 'create') {
      action.currentTick = Math.max(
        action.startTick + MIN_NOTE_DURATION,
        currentTick + MIN_NOTE_DURATION
      );
      return;
    }

    if (action.type === 'resize') {
      const updatedNotes = editedMidi.map(note => {
        if (note.id !== action.noteId) return note;

        const duration = Math.max(
          MIN_NOTE_DURATION,
          currentTick - action.startTick + MIN_NOTE_DURATION
        );

        return {
          ...note,
          duration: Math.min(duration, totalTicks - note.tick!),
        };
      });

      onUpdateMidi(updatedNotes);
      return;
    }

    const { rowHeight, stepWidth } = getGridMetrics();
    const tickDelta = Math.round(
      ((event.clientX - action.startClientX) / stepWidth) * TICKS_PER_STEP
    );

    const rowDelta = Math.round(
      (event.clientY - action.startClientY) / rowHeight
    );

    const nextTick = snapTick(action.originTick + tickDelta);

    let nextPitch = action.originNote;

    if (activeInstrument === 'Drums') {
      const drumIndex = DRUM_NOTES.findIndex(drum => drum.pitch === action.originNote);
      const nextDrumIndex = Math.max(
        0,
        Math.min(DRUM_NOTES.length - 1, drumIndex + rowDelta)
      );
      nextPitch = DRUM_NOTES[nextDrumIndex].pitch;
    } else {
      const scaleIndex = MELODIC_SCALE_PITCHES.findIndex(
        lane => 60 + lane.offset === action.originNote
      );
      const nextScaleIndex = Math.max(
        0,
        Math.min(MELODIC_SCALE_PITCHES.length - 1, scaleIndex + rowDelta)
      );
      nextPitch = 60 + MELODIC_SCALE_PITCHES[nextScaleIndex].offset;
    }

    onUpdateMidi(
      editedMidi.map(note =>
        note.id === action.noteId
          ? {
              ...note,
              note: nextPitch,
              tick: Math.min(nextTick, totalTicks - note.duration!),
            }
          : note
      )
    );
  };

  const handleCanvasPointerUp = (
    event: React.PointerEvent<HTMLCanvasElement>
  ) => {
    const action = editorActionRef.current;
    if (!action || action.pointerId !== event.pointerId) return;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (action.type === 'create') {
      const startTick = Math.min(action.startTick, action.currentTick);
      const endTick = Math.max(action.startTick, action.currentTick);

      const generatedId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15);

      const newNote: PerformedNote = {
        id: generatedId,
        note: action.pitch,
        tick: startTick,
        duration: Math.max(MIN_NOTE_DURATION, endTick - startTick),
        velocity: 100,
        channel: activeInstrument,
        midi: action.pitch,
        startBeatOffset: startTick / 480,
        durationBeats: Math.max(MIN_NOTE_DURATION, endTick - startTick) / 480,
        absoluteBeat: 0,
        articulation: 'normal',
        reason: 'User Created'
      };

      onUpdateMidi([...editedMidi, newNote]);
    }

    editorActionRef.current = null;
  };

  const handleCanvasDoubleClick = (
    event: React.MouseEvent<HTMLCanvasElement>
  ) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) * (canvas.width / rect.width);
    const y = (event.clientY - rect.top) * (canvas.height / rect.height);

    const note = getNoteAtPosition(x, y);

    if (note) {
      onUpdateMidi(editedMidi.filter(item => item.id !== note.id));
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 p-1">
      
      {/* ── Sound Styles & DNA Customizer Sidebar ── */}
      <div className="lg:col-span-1 p-4 rounded-xl border border-studio-border/60 bg-[#121214]/60 flex flex-col gap-4">
        
        {/* Play styles sidebar */}
        <div>
          <span className="text-[9px] font-mono text-studio-muted uppercase tracking-[0.15em] block mb-2.5">
            DNA Sound Templates
          </span>
          <div className="flex flex-wrap lg:flex-col gap-1.5 max-h-[160px] lg:max-h-[220px] overflow-y-auto custom-scrollbar pr-1">
            {availableStyles.map(style => (
              <button
                key={style}
                onClick={() => onUpdateParams({ playStyle: style })}
                className={cn(
                  "px-3 py-1.5 text-left text-[10px] font-mono rounded-lg transition-all border flex items-center justify-between cursor-pointer",
                  params.playStyle === style
                    ? "bg-studio-accent/15 border-studio-accent text-white font-bold"
                    : "bg-black/20 border-studio-border/40 text-studio-muted hover:text-studio-text hover:bg-white/[0.02]"
                )}
              >
                <div className="flex items-center gap-2 truncate">
                  <Layers className={cn("w-3 h-3 flex-shrink-0", params.playStyle === style ? "text-studio-accent" : "text-studio-muted")} />
                  <span className="truncate">{style}</span>
                </div>
                {params.playStyle === style && <span className="w-1.5 h-1.5 rounded-full bg-studio-accent animate-pulse flex-shrink-0" />}
              </button>
            ))}
          </div>
        </div>

        {/* Tactile Drum DNA Injections */}
        {activeInstrument === 'Drums' && (
          <div className="space-y-2 border-t border-studio-border/40 pt-3">
            <span className="text-[9px] font-mono text-studio-muted uppercase tracking-[0.15em] flex items-center gap-1.5 mb-1">
              <Flame className="w-3 h-3 text-studio-accent" /> Tactile DNA Injector
            </span>
            <div className="grid grid-cols-1 gap-1">
              {tactileOptions.map(opt => (
                <button
                  key={opt}
                  onClick={() => onUpdateParams({ tactileInject: opt })}
                  className={cn(
                    "px-2.5 py-1 text-left text-[9px] font-mono rounded border cursor-pointer flex items-center justify-between",
                    (params.tactileInject || 'None') === opt
                      ? "bg-amber-500/10 border-amber-500/30 text-amber-300 font-bold"
                      : "bg-transparent border-studio-border/30 text-studio-muted hover:text-studio-text"
                  )}
                >
                  <span>{opt}</span>
                  {(params.tactileInject || 'None') === opt && <span className="text-[8px] font-mono text-amber-400">ACTIVE</span>}
                </button>
              ))}
            </div>
            <p className="text-[8px] font-mono text-studio-muted leading-relaxed mt-1">
              Injects tactile performance phrases directly onto rhythmic boundaries section-by-section.
            </p>
          </div>
        )}

        {/* Live Tactile Phrase Triggers for current instrument */}
        <div className="space-y-2 border-t border-studio-border/40 pt-3">
          <span className="text-[9px] font-mono text-studio-muted uppercase tracking-[0.15em] block">
            Tactile Phrase Hits
          </span>
          <div className="grid grid-cols-2 gap-1.5">
            {activeInstrument === 'Drums' ? (
              <>
                <button 
                  onClick={() => onTriggerAction && onTriggerAction('Kick-Snare Pocket')}
                  className="px-2 py-1.5 bg-studio-panel-inset hover:bg-studio-accent/10 border border-studio-border hover:border-studio-accent text-[9px] font-mono uppercase text-studio-muted hover:text-white rounded text-center cursor-pointer transition-colors"
                >
                  Pocket
                </button>
                <button 
                  onClick={() => onTriggerAction && onTriggerAction('Snare Roll Fill')}
                  className="px-2 py-1.5 bg-studio-panel-inset hover:bg-studio-accent/10 border border-studio-border hover:border-studio-accent text-[9px] font-mono uppercase text-studio-muted hover:text-white rounded text-center cursor-pointer transition-colors"
                >
                  Roll Fill
                </button>
                <button 
                  onClick={() => onTriggerAction && onTriggerAction('Hi-Hat Accent')}
                  className="px-2 py-1.5 bg-studio-panel-inset hover:bg-studio-accent/10 border border-studio-border hover:border-studio-accent text-[9px] font-mono uppercase text-studio-muted hover:text-white rounded text-center cursor-pointer transition-colors"
                >
                  Hat Accent
                </button>
                <button 
                  onClick={() => onTriggerAction && onTriggerAction('Cymbal Splash')}
                  className="px-2 py-1.5 bg-studio-panel-inset hover:bg-studio-accent/10 border border-studio-border hover:border-studio-accent text-[9px] font-mono uppercase text-studio-muted hover:text-white rounded text-center cursor-pointer transition-colors"
                >
                  Splash
                </button>
              </>
            ) : (
              <>
                <button 
                  onClick={() => onTriggerAction && onTriggerAction('Improvised Lick')}
                  className="px-2 py-1.5 bg-studio-panel-inset hover:bg-studio-accent/10 border border-studio-border hover:border-studio-accent text-[9px] font-mono uppercase text-studio-muted hover:text-white rounded text-center cursor-pointer transition-colors"
                >
                  Lick
                </button>
                <button 
                  onClick={() => onTriggerAction && onTriggerAction('Chromatic Run')}
                  className="px-2 py-1.5 bg-studio-panel-inset hover:bg-studio-accent/10 border border-studio-border hover:border-studio-accent text-[9px] font-mono uppercase text-studio-muted hover:text-white rounded text-center cursor-pointer transition-colors"
                >
                  Run
                </button>
                <button 
                  onClick={() => onTriggerAction && onTriggerAction('Bluesy Pitch Bend')}
                  className="px-2 py-1.5 bg-studio-panel-inset hover:bg-studio-accent/10 border border-studio-border hover:border-studio-accent text-[9px] font-mono uppercase text-studio-muted hover:text-white rounded text-center cursor-pointer transition-colors"
                >
                  Bend
                </button>
                <button 
                  onClick={() => onTriggerAction && onTriggerAction('Trill Resolution')}
                  className="px-2 py-1.5 bg-studio-panel-inset hover:bg-studio-accent/10 border border-studio-border hover:border-studio-accent text-[9px] font-mono uppercase text-studio-muted hover:text-white rounded text-center cursor-pointer transition-colors"
                >
                  Trill
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Zoomable Interactive Piano Roll Canvas Grid ── */}
      <div className="lg:col-span-3 p-4 rounded-xl border border-studio-border/60 bg-[#0d0d0e]/90 flex flex-col gap-3">
        
        {/* Top bar: Zoom controls & state */}
        <div className="flex items-center justify-between border-b border-studio-border/50 pb-2.5">
          <div className="flex items-center gap-2">
            <Layers className="w-3.5 h-3.5 text-studio-accent" />
            <span className="text-[10px] font-mono text-white font-bold uppercase tracking-wider">
              {activeInstrument} Intelligent Midi Matrix
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Zoom Controls */}
            <div className="flex items-center gap-1.5 bg-black/40 px-2 py-1 rounded-lg border border-studio-border/30">
              <span className="text-[8px] font-mono text-studio-muted uppercase mr-1">X-Zoom</span>
              <button 
                onClick={() => setZoomX(prev => Math.max(0.6, prev - 0.15))}
                className="p-1 rounded bg-studio-border/30 hover:bg-studio-accent/15 hover:text-studio-accent text-studio-muted cursor-pointer transition-colors"
                title="Zoom Out X"
              >
                <ZoomOut className="w-3 h-3" />
              </button>
              <span className="text-[9px] font-mono text-studio-text w-8 text-center">{Math.round(zoomX * 100)}%</span>
              <button 
                onClick={() => setZoomX(prev => Math.min(2.5, prev + 0.15))}
                className="p-1 rounded bg-studio-border/30 hover:bg-studio-accent/15 hover:text-studio-accent text-studio-muted cursor-pointer transition-colors"
                title="Zoom In X"
              >
                <ZoomIn className="w-3 h-3" />
              </button>
            </div>

            <div className="flex items-center gap-1.5 bg-black/40 px-2 py-1 rounded-lg border border-studio-border/30">
              <span className="text-[8px] font-mono text-studio-muted uppercase mr-1">Y-Zoom</span>
              <button 
                onClick={() => setZoomY(prev => Math.max(0.7, prev - 0.1))}
                className="p-1 rounded bg-studio-border/30 hover:bg-studio-accent/15 hover:text-studio-accent text-studio-muted cursor-pointer transition-colors"
                title="Zoom Out Y"
              >
                <ZoomOut className="w-3 h-3" />
              </button>
              <span className="text-[9px] font-mono text-studio-text w-8 text-center">{Math.round(zoomY * 100)}%</span>
              <button 
                onClick={() => setZoomY(prev => Math.min(1.8, prev + 0.1))}
                className="p-1 rounded bg-studio-border/30 hover:bg-studio-accent/15 hover:text-studio-accent text-studio-muted cursor-pointer transition-colors"
                title="Zoom In Y"
              >
                <ZoomIn className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>

        {/* The Grid Canvas Container */}
        <div className="flex-1 flex overflow-hidden border border-studio-border/50 rounded-lg bg-black/50" style={{ minHeight: '260px' }}>
          
          {/* Lane Titles Headers (Vertical Keyboard Column) */}
          <div className="w-24 bg-black/80 border-r border-studio-border/80 flex flex-col select-none flex-shrink-0 z-10"
            style={{
              height: `${(activeInstrument === 'Drums' ? DRUM_NOTES : MELODIC_SCALE_PITCHES).length * (activeInstrument === 'Drums' ? 32 : 24) * zoomY}px`
            }}
          >
            {(activeInstrument === 'Drums' ? DRUM_NOTES : MELODIC_SCALE_PITCHES).map((lane, idx) => {
              const baseRowHeight = activeInstrument === 'Drums' ? 32 : 24;
              const rowHeight = baseRowHeight * zoomY;

              return (
                <button
                  key={idx}
                  onClick={() => handlePlayRowNote(activeInstrument === 'Drums' ? (lane as any).pitch : 60 + (lane as any).offset)}
                  className={cn(
                    "w-full text-left px-2.5 flex items-center justify-between text-[9px] font-mono transition-all hover:bg-studio-accent/10 border-b border-studio-border/30 cursor-pointer text-studio-muted hover:text-white",
                    activeInstrument !== 'Drums' && (lane as any).offset === 0 ? "bg-indigo-500/5 text-studio-accent" : ""
                  )}
                  style={{ height: `${rowHeight}px` }}
                >
                  <span className="truncate pr-1">{lane.name}</span>
                  <Volume2 className="w-2.5 h-2.5 opacity-0 group-hover:opacity-60" />
                </button>
              );
            })}
          </div>

          {/* Scrolling Canvas Container */}
          <div 
            ref={containerRef}
            className="flex-1 overflow-x-auto overflow-y-hidden custom-scrollbar bg-black/40"
          >
            <div className="relative" style={{ width: `${totalSteps * 36 * zoomX + 100}px` }}>
              <canvas 
                ref={canvasRef} 
                className="block cursor-crosshair touch-none"
                onPointerDown={handleCanvasPointerDown}
                onPointerMove={handleCanvasPointerMove}
                onPointerUp={handleCanvasPointerUp}
                onDoubleClick={handleCanvasDoubleClick}
                onContextMenu={(e) => e.preventDefault()}
              />
            </div>
          </div>
        </div>

        {/* Canvas instructions */}
        <div className="flex items-center justify-between text-[8px] font-mono text-studio-muted mt-1.5 px-1">
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-studio-accent" />
            <span>Interactive Real-time Visuals of the MIDI Performance Sequence. Click Row headers to audition parts.</span>
          </div>
          <div>
            <span>Snap: 16th Notes</span>
          </div>
        </div>

      </div>

    </div>
  );
};
