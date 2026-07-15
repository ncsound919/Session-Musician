/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { 
  Activity, 
  GraduationCap, 
  Waves,
  Keyboard,
  Sliders,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Users
} from 'lucide-react';
import { InstrumentType } from '../../types';
import { cn } from '../../lib/utils';

type ContentTab = 'perform' | 'theory' | 'mix' | 'synth' | 'settings' | 'fusion';

interface SidebarProps {
  contentTab: ContentTab;
  onContentTabChange: (tab: ContentTab) => void;
  isSidebarCollapsed: boolean;
  setIsSidebarCollapsed: (collapsed: boolean) => void;
  activeTab: InstrumentType;
  onTabChange: (tab: InstrumentType) => void;
  instruments: InstrumentType[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  contentTab,
  onContentTabChange,
  isSidebarCollapsed,
  setIsSidebarCollapsed,
  activeTab,
  onTabChange,
  instruments
}) => {
  const tabs = [
    { id: 'perform', label: 'Perform', icon: Activity },
    { id: 'theory', label: 'Theory', icon: GraduationCap },
    { id: 'mix', label: 'Mix', icon: Waves },
    { id: 'synth', label: 'Synth', icon: Keyboard },
    { id: 'fusion', label: 'Fusion', icon: Users },
    { id: 'settings', label: 'Settings', icon: Sliders },
  ];

  return (
    <div 
      className={cn(
        "bg-studio-card border-r border-studio-border transition-all duration-300 flex flex-col z-20",
        isSidebarCollapsed ? "w-20" : "w-64"
      )}
    >
      <div className="p-6 flex items-center justify-between border-b border-studio-border bg-black/20">
        {!isSidebarCollapsed && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-studio-accent rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(var(--studio-accent-rgb),0.4)]">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold tracking-tight text-white">JUNO<span className="text-studio-accent">AI</span></span>
          </div>
        )}
        <button 
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          className="p-2 hover:bg-white/5 rounded-lg text-studio-muted transition-colors mx-auto"
        >
          {isSidebarCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
        </button>
      </div>

      <div className="flex-1 py-6 px-3 space-y-2 overflow-y-auto">
        <div className="space-y-1">
          {!isSidebarCollapsed && <span className="text-[10px] font-mono text-studio-muted uppercase tracking-[0.2em] ml-4 mb-2 block">Navigation</span>}
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onContentTabChange(tab.id as ContentTab)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all group",
                contentTab === tab.id 
                  ? "bg-studio-accent text-white shadow-lg shadow-studio-accent/20" 
                  : "text-studio-muted hover:text-white hover:bg-white/5"
              )}
            >
              <tab.icon className={cn("w-5 h-5", contentTab === tab.id ? "text-white" : "text-studio-accent/60 group-hover:text-studio-accent")} />
              {!isSidebarCollapsed && <span className="text-sm font-medium">{tab.label}</span>}
            </button>
          ))}
        </div>

        <div className="pt-6 space-y-1">
          {!isSidebarCollapsed && <span className="text-[10px] font-mono text-studio-muted uppercase tracking-[0.2em] ml-4 mb-2 block">Instruments</span>}
          {instruments.map((inst) => (
            <button
              key={inst}
              onClick={() => onTabChange(inst)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all group",
                activeTab === inst 
                  ? "bg-white/10 text-white border border-studio-border/50" 
                  : "text-studio-muted hover:text-white hover:bg-white/5 border border-transparent"
              )}
            >
              <div className={cn(
                "w-2 h-2 rounded-full",
                activeTab === inst ? "bg-studio-accent shadow-[0_0_8px_rgba(var(--studio-accent-rgb),0.6)]" : "bg-studio-border/50"
              )} />
              {!isSidebarCollapsed && <span className="text-sm font-medium">{inst}</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 border-t border-studio-border bg-black/10">
        {!isSidebarCollapsed ? (
          <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-studio-border/20">
            <div className="w-8 h-8 rounded-full bg-studio-accent/20 flex items-center justify-center border border-studio-accent/30">
              <span className="text-xs font-bold text-studio-accent">JD</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-medium text-white truncate">Session Player</p>
              <p className="text-[9px] font-mono text-studio-accent uppercase tracking-tighter">Pro Studio Mode</p>
            </div>
          </div>
        ) : (
          <div className="w-10 h-10 rounded-full bg-studio-accent/20 flex items-center justify-center mx-auto border border-studio-accent/30">
            <span className="text-xs font-bold text-studio-accent">JD</span>
          </div>
        )}
      </div>
    </div>
  );
};
