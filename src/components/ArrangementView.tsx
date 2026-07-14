/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Plus, ChevronRight, MoreVertical, Layout } from 'lucide-react';
import { SongSection } from '../types';
import { cn } from '../lib/utils';

interface ArrangementViewProps {
  sections: SongSection[];
  activeSectionId: string;
  onSelectSection: (id: string) => void;
  onAddSection: () => void;
}

export const ArrangementView: React.FC<ArrangementViewProps> = ({ 
  sections, 
  activeSectionId, 
  onSelectSection,
  onAddSection 
}) => {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-studio-muted">
          <Layout className="w-3 h-3" />
          <span className="text-[9px] font-mono uppercase tracking-[0.15em]">Arrangement</span>
        </div>
        <button 
          onClick={onAddSection}
          className="p-1 rounded-md hover:bg-studio-accent/10 text-studio-accent transition-all"
        >
          <Plus className="w-3 h-3" />
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
        {sections.map((section) => (
          <button
            key={section.id}
            onClick={() => onSelectSection(section.id)}
            className={cn(
              "flex-shrink-0 w-28 p-2.5 rounded-lg transition-all text-left group relative overflow-hidden"
            )}
            style={activeSectionId === section.id 
              ? { background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.4)' }
              : { background: '#1a1a1c', border: '1px solid #222224' }
            }
          >
            <div className="flex justify-between items-start mb-1.5">
              <span className={cn(
                "text-[9px] font-mono font-bold uppercase",
                activeSectionId === section.id ? "text-studio-accent" : "text-studio-muted"
              )}>{section.name}</span>
              <MoreVertical className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-studio-muted" />
            </div>
            <div className="flex gap-1">
              {section.chords.slice(0, 4).map((chord, i) => (
                <div 
                  key={i} 
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: activeSectionId === section.id ? '#6366f1' : '#333336', opacity: 0.6 }}
                />
              ))}
            </div>
            {activeSectionId === section.id && (
              <div className="absolute bottom-0 left-0 h-0.5 w-full" style={{ background: '#6366f1' }} />
            )}
          </button>
        ))}
      </div>
    </div>
  );
};
