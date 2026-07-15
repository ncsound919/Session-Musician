/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Plus, Trash2, GripVertical, Music, Layers, Sliders } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { SongSection, InstrumentType, InstrumentState } from '../types';
import { resolveArrangement, EnergyCurve, ArrangementStyle, standardArrangementStyle } from '../services/arrangementEngine';

interface ArrangementViewProps {
  sections: SongSection[];
  activeSectionId?: string;
  instrumentStates?: Record<InstrumentType, InstrumentState>;
  energyCurve?: EnergyCurve;
  arrangementStyle?: ArrangementStyle;

  // New callback
  onSectionsChange?: (sections: SongSection[]) => void;
  onSectionSelect?: (sectionId: string) => void;

  // Legacy props
  onSelectSection?: (sectionId: string) => void;
  onAddSection?: () => void;
  onRenameSection?: (id: string, name: string) => void;
  onDeleteSection?: (id: string) => void;
  onReorderSections?: (draggedId: string, targetId: string) => void;
}

export const ArrangementView: React.FC<ArrangementViewProps> = ({
  sections,
  instrumentStates = {} as any,
  energyCurve = { bySection: {} },
  arrangementStyle = standardArrangementStyle,
  onSectionsChange,
  onSectionSelect,
  activeSectionId,
  // Legacy props
  onSelectSection,
  onAddSection,
  onRenameSection,
  onDeleteSection,
  onReorderSections,
}) => {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Resolve arrangement parameters per section
  const sectionParams = React.useMemo(() => {
    if (!energyCurve || !energyCurve.bySection) return {};
    return resolveArrangement(sections, energyCurve, arrangementStyle);
  }, [sections, energyCurve, arrangementStyle]);

  const addSection = () => {
    if (onAddSection) {
      onAddSection();
    } else if (onSectionsChange) {
      const newSection: SongSection = {
        id: `section-${Date.now()}`,
        name: `Section ${sections.length + 1}`,
        chords: [],
      };
      onSectionsChange([...sections, newSection]);
    }
  };

  const removeSection = (sectionId: string) => {
    if (onDeleteSection) {
      onDeleteSection(sectionId);
    } else if (onSectionsChange) {
      onSectionsChange(sections.filter((s) => s.id !== sectionId));
    }
  };

  const updateSectionName = (sectionId: string, name: string) => {
    if (onRenameSection) {
      onRenameSection(sectionId, name);
    } else if (onSectionsChange) {
      onSectionsChange(
        sections.map((s) => (s.id === sectionId ? { ...s, name } : s))
      );
    }
  };

  const handleSelect = (sectionId: string) => {
    if (onSectionSelect) {
      onSectionSelect(sectionId);
    } else if (onSelectSection) {
      onSelectSection(sectionId);
    }
  };

  // Drag-and-drop reordering
  const handleDragStart = (e: React.DragEvent, idx: number) => {
    e.dataTransfer.setData('text/plain', idx.toString());
    e.dataTransfer.effectAllowed = 'move';
    setDraggedIndex(idx);
  };

  const handleDragEnd = () => setDraggedIndex(null);

  const handleDrop = (e: React.DragEvent, targetIdx: number) => {
    e.preventDefault();
    const draggedIdxStr = e.dataTransfer.getData('text/plain');
    if (!draggedIdxStr) return;
    const draggedIdx = parseInt(draggedIdxStr, 10);
    if (isNaN(draggedIdx) || draggedIdx === targetIdx) return;

    if (onReorderSections) {
        onReorderSections(sections[draggedIdx].id, sections[targetIdx].id);
    } else if (onSectionsChange) {
        const newSections = [...sections];
        const [removed] = newSections.splice(draggedIdx, 1);
        newSections.splice(targetIdx, 0, removed);
        onSectionsChange(newSections);
    }
    setDraggedIndex(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-studio-accent">
          <Layers className="w-4 h-4" />
          <h4 className="text-[10px] font-mono uppercase font-bold tracking-widest">
            Arrangement View
          </h4>
        </div>
        <button
          onClick={addSection}
          className="p-1.5 rounded-md text-studio-accent hover:bg-studio-accent/10 transition-all cursor-pointer"
          style={{ border: '1px solid rgba(99,102,241,0.2)' }}
        >
          <Plus className="w-3 h-3" />
        </button>
      </div>

      {/* Section List */}
      <div className="space-y-2">
        <AnimatePresence>
          {sections.map((section, index) => {
            const isActive = section.id === activeSectionId;
            const params = sectionParams[section.id];
            const hasParams = params && Object.keys(params).length > 0;

            return (
              <motion.div
                key={section.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0 }}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleDrop(e, index)}
                className={cn(
                  'rounded-xl border p-3 transition-all cursor-pointer',
                  isActive
                    ? 'bg-studio-accent/10 border-studio-accent/30'
                    : 'bg-black/20 border-white/5 hover:bg-white/[0.02]'
                )}
                onClick={() => handleSelect(section.id)}
              >
                <div className="flex items-center gap-2">
                  {/* Drag handle */}
                  <button
                    type="button"
                    aria-label="Reorder section"
                    className="p-0.5 rounded hover:bg-white/10 focus:outline-none"
                  >
                    <GripVertical className="w-3 h-3 text-studio-muted" />
                  </button>

                  {/* Editable section name */}
                  <input
                    type="text"
                    value={section.name}
                    onChange={(e) => updateSectionName(section.id, e.target.value)}
                    className="bg-transparent text-xs font-display font-bold text-white outline-none border-b border-transparent hover:border-studio-muted/30 focus:border-studio-accent/50 transition-colors flex-1 min-w-0"
                  />

                    {/* Bar count */}
                  <span className="text-[9px] font-mono text-studio-muted">
                    bars
                  </span>

                  {/* Instrument parameter summary (if available) */}
                  {hasParams && (
                    <div className="hidden md:flex items-center gap-1.5">
                      <Sliders className="w-3 h-3 text-studio-muted" />
                      {Object.entries(params!).slice(0, 3).map(([inst, p]: [string, any]) => (
                        <span key={inst} className="text-[7px] font-mono text-studio-accent/70">
                          {inst}:{p.sparseness}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Delete */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeSection(section.id);
                    }}
                    className="p-1 rounded text-studio-muted hover:text-red-400 hover:bg-red-400/10 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Empty state */}
      {sections.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 rounded-xl border border-dashed border-white/10 text-studio-muted space-y-2">
          <Music className="w-8 h-8 opacity-30" />
          <p className="text-xs font-mono">No sections yet. Add one to start arranging.</p>
        </div>
      )}
    </div>
  );
};
