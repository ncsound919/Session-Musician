/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useCallback } from 'react';
import { 
  GraduationCap, 
  AlertTriangle, 
  Info, 
  Sparkles, 
  CheckCircle2,
  Scale
} from 'lucide-react';
import { Chord, InstrumentState, InstrumentType } from '../types';
import { 
  critiqueSection, 
  applyTheoryFix, 
  inferKeyMode, 
  getScaleDegreeRoot,
  CritiqueIssue,
  TheoryFixType
} from '../services/musicTheoryEngine';
import { applySophistication, SophisticationLevel } from '../services/sophisticationEngine';

// Ensure musicTheoryEngine.ts exports:
// export type TheoryFixType = 'resubstitute' | 'revoice' | ... | 'sophistication_apply';

interface TheoryCriticPanelProps {
  chords: Chord[];
  bpm: number;
  instrumentStates: Record<InstrumentType, InstrumentState>;
  songKey: string;
  sophisticationLevel: SophisticationLevel;
  onUpdateChords: (nextChords: Chord[]) => void;
  onUpdateInstrumentStates: (nextStates: Record<InstrumentType, InstrumentState>) => void;
}

interface SophisticationCritiqueIssue extends CritiqueIssue {
  fixType: 'sophistication_apply';
  metadata: {
    index: number;
    targetChord: Chord;
  };
}

const getColors = (severity: string) => {
  if (severity === 'error') {
    return {
      border: 'border-red-500/10',
      bg: 'bg-red-500/[0.01]',
      text: 'text-red-400',
      badgeBg: 'bg-red-500/10 text-red-500',
      badgeLabel: 'Error',
      icon: <AlertTriangle className="w-4 h-4 text-red-500" />
    };
  }
  if (severity === 'warning') {
    return {
      border: 'border-amber-500/10',
      bg: 'bg-amber-500/[0.01]',
      text: 'text-amber-400',
      badgeBg: 'bg-amber-500/10 text-amber-500',
      badgeLabel: 'Warning',
      icon: <AlertTriangle className="w-4 h-4 text-amber-400" />
    };
  }
  return {
    border: 'border-indigo-500/10',
    bg: 'bg-indigo-500/[0.01]',
    text: 'text-indigo-400',
    badgeBg: 'bg-indigo-500/10 text-indigo-400',
    badgeLabel: 'Theory Tip',
    icon: <Info className="w-4 h-4 text-indigo-400" />
  };
};

const IssueRow: React.FC<{ issue: CritiqueIssue; onFix: (i: CritiqueIssue) => void }> = React.memo(({ issue, onFix }) => {
  const style = getColors(issue.severity);

  return (
    <div 
      className={`border ${style.border} ${style.bg} rounded-lg p-4 flex flex-col md:flex-row md:items-start justify-between gap-4 transition-all hover:bg-white/[0.02] shadow-sm`}
    >
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <div className="mt-1 flex-shrink-0">
          {style.icon}
        </div>
        <div className="space-y-1.5 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-display text-white font-bold truncate">
              {issue.title}
            </span>
            <span className={`text-[7px] font-mono uppercase px-2 py-0.5 rounded-full font-black tracking-tighter ${style.badgeBg}`}>
              {style.badgeLabel}
            </span>
          </div>
          <p className="text-[10px] font-mono text-studio-muted leading-relaxed">
            {issue.description}
          </p>
          <div className="mt-1.5 p-2 bg-black/20 rounded border border-white/5 text-[10px] font-mono text-studio-accent flex items-start gap-1.5">
            <Sparkles className="w-3 h-3 flex-shrink-0 mt-0.5 text-studio-accent/60" />
            <span>
              <strong className="text-studio-muted opacity-80">PRO TIP:</strong> {issue.suggestion}
            </span>
          </div>
        </div>
      </div>

      {issue.canFix && (
        <div className="flex-shrink-0 flex items-center mt-2 md:mt-0">
          <button
            onClick={() => onFix(issue)}
            className="w-full md:w-auto px-4 py-2 rounded-lg bg-studio-accent/10 hover:bg-studio-accent border border-studio-accent/30 hover:border-studio-accent text-[9px] font-mono uppercase font-bold text-studio-accent hover:text-black transition-all transform hover:scale-[1.02] active:scale-95 shadow-lg shadow-studio-accent/5 cursor-pointer"
          >
            Apply Fix
          </button>
        </div>
      )}
    </div>
  );
});

export const TheoryCriticPanel: React.FC<TheoryCriticPanelProps> = ({
  chords,
  bpm,
  instrumentStates,
  songKey,
  sophisticationLevel,
  onUpdateChords,
  onUpdateInstrumentStates
}) => {
  const isMinor = useMemo(() => inferKeyMode(chords, songKey), [chords, songKey]);

  // Core critique issues
  const issues = useMemo(() => {
    return critiqueSection(chords, bpm, instrumentStates, songKey);
  }, [chords, bpm, instrumentStates, songKey]);

  // Sophistication suggestions
  const sophisticationIssues: SophisticationCritiqueIssue[] = useMemo(() => {
    if (sophisticationLevel === 0) return [];
    
    const sophisticatedChords = applySophistication(chords, sophisticationLevel);
    const results: SophisticationCritiqueIssue[] = [];
    
    sophisticatedChords.forEach((soph, idx) => {
      const orig = chords[idx];
      if (soph.root !== orig.root || soph.type !== orig.type) {
        results.push({
          id: `soph-${idx}`,
          title: `Enhancement: ${orig.root}${orig.type} → ${soph.root}${soph.type}`,
          description: `Automatic substitution active due to sophistication dial level ${sophisticationLevel}.`,
          severity: 'info',
          suggestion: `Using advanced harmonic vocabulary in this structural position.`,
          category: 'harmony',
          canFix: true,
          fixType: 'sophistication_apply',
          metadata: { index: idx, targetChord: soph }
        });
      }
    });
    
    return results;
  }, [chords, sophisticationLevel]);

  // All issues combined
  const allIssues = useMemo(() => [...issues, ...sophisticationIssues], [issues, sophisticationIssues]);

  // Diatonic scale degrees for display
  const scaleDegrees = useMemo(() => {
    const degrees = [1, 2, 3, 4, 5, 6, 7];
    return degrees.map(deg => {
      const root = getScaleDegreeRoot(songKey, deg, isMinor);
      let type = 'maj';
      let roman = '';
      
      if (isMinor) {
        if (deg === 1) { type = 'min7'; roman = 'i'; }
        else if (deg === 2) { type = 'dim'; roman = 'ii°'; }
        else if (deg === 3) { type = 'maj7'; roman = 'III'; }
        else if (deg === 4) { type = 'min7'; roman = 'iv'; }
        else if (deg === 5) { type = 'min7'; roman = 'v'; }
        else if (deg === 6) { type = 'maj7'; roman = 'VI'; }
        else if (deg === 7) { type = '7'; roman = 'VII'; }
      } else {
        if (deg === 1) { type = 'maj7'; roman = 'I'; }
        else if (deg === 2) { type = 'min7'; roman = 'ii'; }
        else if (deg === 3) { type = 'min7'; roman = 'iii'; }
        else if (deg === 4) { type = 'maj7'; roman = 'IV'; }
        else if (deg === 5) { type = '7'; roman = 'V'; }
        else if (deg === 6) { type = 'min7'; roman = 'vi'; }
        else if (deg === 7) { type = 'dim'; roman = 'vii°'; }
      }

      return { degree: deg, roman, chord: `${root}${type}` };
    });
  }, [songKey, isMinor]);

  // ---- FIX 1: handleFix now dispatches based on fixType ----
  const handleFix = useCallback((issue: CritiqueIssue) => {
    if (issue.fixType === 'sophistication_apply') {
      const meta = (issue as SophisticationCritiqueIssue).metadata;
      if (meta && meta.index >= 0 && meta.index < chords.length) {
        const nextChords = [...chords];
        nextChords[meta.index] = meta.targetChord;
        onUpdateChords(nextChords);
      }
      return;
    }

    const { nextChords, nextInstrumentStates } = applyTheoryFix(issue, chords, songKey, instrumentStates);
    if (nextChords) onUpdateChords(nextChords);
    if (nextInstrumentStates) onUpdateInstrumentStates(nextInstrumentStates);
  }, [chords, songKey, instrumentStates, onUpdateChords, onUpdateInstrumentStates]);

  // ---- FIX 2: applyMultipleFixes handles both standard and sophistication issues ----
  const applyMultipleFixes = useCallback((issuesToFix: CritiqueIssue[]) => {
    let currentChords = [...chords];
    let currentStates = { ...instrumentStates };
    let appliedCount = 0;

    const standardIssues = issuesToFix.filter(i => i.fixType !== 'sophistication_apply');
    const sophIssues = issuesToFix.filter(
      (i): i is SophisticationCritiqueIssue => i.fixType === 'sophistication_apply'
    );

    // Re-derive standard fixes using the latest state
    for (const issue of standardIssues) {
      const currentIssues = critiqueSection(currentChords, bpm, currentStates, songKey);
      const freshIssue = currentIssues.find(i => i.id === issue.id);
      if (freshIssue?.canFix) {
        const { nextChords, nextInstrumentStates } = applyTheoryFix(freshIssue, currentChords, songKey, currentStates);
        if (nextChords) currentChords = nextChords;
        if (nextInstrumentStates) currentStates = nextInstrumentStates;
        appliedCount++;
      }
    }

    // Apply sophistication fixes directly by index
    for (const issue of sophIssues) {
      const { index, targetChord } = issue.metadata;
      if (index >= 0 && index < currentChords.length) {
        currentChords[index] = targetChord;
        appliedCount++;
      }
    }

    if (appliedCount > 0) {
      onUpdateChords(currentChords);
      onUpdateInstrumentStates(currentStates);
    }
  }, [chords, bpm, instrumentStates, songKey, onUpdateChords, onUpdateInstrumentStates]);

  // ---- FIX 3: handleFixAll uses allIssues instead of issues ----
  const handleFixAll = useCallback(() => {
    applyMultipleFixes(allIssues.filter(i => i.canFix));
  }, [allIssues, applyMultipleFixes]);

  const handleFixTrack = useCallback((trackName: string, trackIssues: CritiqueIssue[]) => {
    applyMultipleFixes(trackIssues.filter(i => i.canFix));
  }, [applyMultipleFixes]);

  const errors = allIssues.filter(i => i.severity === 'error');
  const warnings = allIssues.filter(i => i.severity === 'warning');
  const infos = allIssues.filter(i => i.severity === 'info');

  const groupedIssues = useMemo(() => {
    const map: Record<string, CritiqueIssue[]> = {
      'Harmony & Chords': [],
      'Drums Track': [],
      'Bass Track': [],
      'Keys Track': [],
      'Guitar Track': [],
      'Pads Track': [],
      'Lead Track': []
    };

    allIssues.forEach(issue => {
      const title = issue.title.toLowerCase();
      if (title.includes('bass:')) map['Bass Track'].push(issue);
      else if (title.includes('drum:')) map['Drums Track'].push(issue);
      else if (title.includes('key:') || title.includes('keys:') || title.includes('keyboard:')) map['Keys Track'].push(issue);
      else if (title.includes('guitar:')) map['Guitar Track'].push(issue);
      else if (title.includes('pad:') || title.includes('pads:')) map['Pads Track'].push(issue);
      else if (title.includes('lead:')) map['Lead Track'].push(issue);
      else map['Harmony & Chords'].push(issue);
    });

    return map;
  }, [allIssues]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-xl p-5 relative overflow-hidden" 
        style={{ background: '#0c0c0e', border: '1px solid #222224' }}>
        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
          <GraduationCap size={120} />
        </div>
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Scale className="w-4 h-4 text-studio-accent" />
              <h3 className="text-sm font-display tracking-tight text-white">
                Diatonic Harmony Analyzer
              </h3>
            </div>
            <p className="text-[11px] font-mono text-studio-muted">
              Analyzing progression roots in <span className="text-studio-accent font-bold">{songKey} {isMinor ? 'Natural Minor' : 'Major'}</span> scale.
            </p>
          </div>

          {/* FIX: button visibility now uses allIssues */}
          {allIssues.some(i => i.canFix) && (
            <button 
              onClick={handleFixAll}
              className="btn-accent px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-[10px] font-mono uppercase font-bold cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Auto-Resolve All Issues
            </button>
          )}
        </div>

        {/* Scale degrees */}
        <div className="mt-4 pt-4 border-t border-studio-border/50">
          <span className="text-[8px] font-mono text-studio-muted uppercase tracking-wider block mb-2">
            Key Signatures & Diatonic Degrees:
          </span>
          <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
            {scaleDegrees.map(sd => (
              <div 
                key={sd.degree} 
                className="bg-black/30 border border-studio-border/30 rounded-lg p-2 flex flex-col items-center justify-center text-center"
              >
                <span className="text-[7px] font-mono text-studio-muted uppercase font-bold">{sd.roman}</span>
                <span className="text-[11px] font-mono text-studio-accent font-semibold">{sd.chord}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Empty state now checks allIssues */}
      {allIssues.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center rounded-xl border border-studio-border/40 bg-[#0c0c0e]/40 space-y-3">
          <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          </div>
          <div className="space-y-1">
            <h4 className="text-xs font-display text-white">Theoretical Perfection Achieved</h4>
            <p className="text-[10px] font-mono text-studio-muted max-w-sm">
              Your loop complies 100% with traditional diatonic harmony, maintains smooth voice leading registers, and has optimized micro-timing boundaries. No flaws detected!
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* summary cards unchanged */}
          <div className="bg-black/20 border border-studio-border/30 rounded-xl p-3 flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${errors.length > 0 ? 'bg-red-500/10 border border-red-500/20 text-red-500' : 'bg-studio-border/40 text-studio-muted'}`}>
              <AlertTriangle size={15} />
            </div>
            <div>
              <div className="text-[10px] font-mono text-studio-muted uppercase">Errors</div>
              <div className="text-sm font-mono text-white font-bold">{errors.length}</div>
            </div>
          </div>
          <div className="bg-black/20 border border-studio-border/30 rounded-xl p-3 flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${warnings.length > 0 ? 'bg-amber-500/10 border border-amber-500/20 text-amber-500' : 'bg-studio-border/40 text-studio-muted'}`}>
              <AlertTriangle size={15} />
            </div>
            <div>
              <div className="text-[10px] font-mono text-studio-muted uppercase">Warnings</div>
              <div className="text-sm font-mono text-white font-bold">{warnings.length}</div>
            </div>
          </div>
          <div className="bg-black/20 border border-studio-border/30 rounded-xl p-3 flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${infos.length > 0 ? 'bg-indigo-500/10 border border-indigo-500/20 text-indigo-400' : 'bg-studio-border/40 text-studio-muted'}`}>
              <Info size={15} />
            </div>
            <div>
              <div className="text-[10px] font-mono text-studio-muted uppercase">Critic Tips</div>
              <div className="text-sm font-mono text-white font-bold">{infos.length}</div>
            </div>
          </div>
        </div>
      )}

      {/* Track panels */}
      <div className="space-y-4">
        <span className="text-[9px] font-mono text-studio-muted uppercase tracking-[0.15em] block">
          Instrument Performance Tracks & Correctors:
        </span>
        
        <div className="space-y-4">
          {(Object.entries(groupedIssues) as Array<[string, CritiqueIssue[]]>).map(([trackName, trackIssues]) => {
            const hasIssues = trackIssues.length > 0;
            const fixableIssues = trackIssues.filter(i => i.canFix);
            const hasFixable = fixableIssues.length > 0;

            return (
              <div 
                key={trackName}
                className={`rounded-xl border transition-all ${
                  hasIssues 
                    ? 'bg-[#121214]/60 border-studio-border' 
                    : 'bg-black/10 border-studio-border/30 opacity-75'
                }`}
              >
                {/* Track Header */}
                <div className="flex items-center justify-between p-4 border-b border-studio-border/50 flex-wrap gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className={`w-2 h-2 rounded-full ${hasIssues ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
                    <span className="text-xs font-display font-bold text-white uppercase tracking-wider">{trackName}</span>
                    <span className="text-[9px] font-mono text-studio-muted px-2 py-0.5 rounded-md bg-studio-panel-inset">
                      {trackIssues.length} issues
                    </span>
                  </div>

                  {hasFixable && (
                    <button
                      onClick={() => handleFixTrack(trackName, trackIssues)}
                      className="btn-vintage px-3 py-1 flex items-center gap-1.5 text-[9px] font-mono uppercase font-bold cursor-pointer hover:border-studio-accent/40"
                    >
                      <Sparkles className="w-3 h-3 text-studio-accent animate-spin-slow" />
                      Execute {trackName} Fixes
                    </button>
                  )}
                </div>

                {/* Issues list */}
                <div className="p-4 space-y-3">
                  {!hasIssues ? (
                    <p className="text-[10px] font-mono text-emerald-400/80 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                      Instrument performance complies completely with theory scope and is locked in.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {trackIssues.map(issue => (
                        <IssueRow key={issue.id} issue={issue} onFix={handleFix} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};