import React, { useCallback } from 'react';
import { Activity, RotateCcw } from 'lucide-react';
import { SessionParameters } from '../types';

interface PocketLabProps {
  params: SessionParameters;
  onChange: (updates: Partial<SessionParameters>) => void;
}

export const PocketLab: React.FC<PocketLabProps> = ({ params, onChange }) => {
  const drumPieces = ['Kick', 'Snare', 'HiHat'] as const;

  const updatePiece = useCallback(
    (piece: string, type: 'pocket' | 'swing', val: number) => {
      const field = type === 'pocket' ? 'perDrumPocket' : 'perDrumSwing';
      const globalDefault = type === 'pocket' ? params.pocket : params.groove;

      // Start from existing per-piece map or fallback to global defaults
      const currentMap = params[field]
        ? { ...params[field] }
        : {
            Kick: globalDefault,
            Snare: globalDefault,
            HiHat: globalDefault,
          };

      onChange({
        [field]: {
          ...currentMap,
          [piece]: val,
        },
      });
    },
    [params.pocket, params.groove, params.perDrumPocket, params.perDrumSwing, onChange]
  );

  const resetPiece = useCallback(
    (piece: string, type: 'pocket' | 'swing') => {
      const field = type === 'pocket' ? 'perDrumPocket' : 'perDrumSwing';
      const globalDefault = type === 'pocket' ? params.pocket : params.groove;

      // Only keep the per-piece map if it still has a non‑default piece
      const currentMap = params[field] ? { ...params[field] } : undefined;
      if (currentMap) {
        delete currentMap[piece];
        // If all remaining entries equal the global default, remove the map entirely
        const stillCustom = Object.values(currentMap).some((v) => v !== globalDefault);
        onChange({ [field]: stillCustom ? currentMap : undefined });
      }
    },
    [params.pocket, params.groove, params.perDrumPocket, params.perDrumSwing, onChange]
  );

  return (
    <div className="bg-black/40 border border-white/5 rounded-xl p-4 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-studio-accent">
          <Activity className="w-4 h-4" />
          <h4 className="text-[10px] font-mono uppercase font-bold tracking-widest">
            Pocket Lab: Micro-Timing
          </h4>
        </div>
        <div className="px-2 py-0.5 rounded bg-studio-accent/10 border border-studio-accent/20 text-[8px] font-mono text-studio-accent uppercase font-bold">
          Live Engine Active
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {drumPieces.map((piece) => {
          const pocketVal = params.perDrumPocket?.[piece] ?? params.pocket;
          const swingVal = params.perDrumSwing?.[piece] ?? params.groove;

          return (
            <div
              key={piece}
              className="space-y-4 p-3 rounded-lg bg-white/[0.02] border border-white/5"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-display font-bold text-white uppercase tracking-tight">
                  {piece}
                </span>
                <span className="text-[8px] font-mono text-studio-muted uppercase">
                  Offset Control
                </span>
              </div>

              {/* Pocket slider */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] font-mono text-studio-muted uppercase tracking-tighter">
                      Pocket
                    </span>
                    <button
                      type="button"
                      onClick={() => resetPiece(piece, 'pocket')}
                      className="p-0.5 rounded hover:bg-white/10 text-studio-muted hover:text-studio-accent transition"
                      aria-label={`Reset ${piece} pocket to global default`}
                    >
                      <RotateCcw className="w-3 h-3" />
                    </button>
                  </div>
                  <span className="text-[9px] font-mono text-studio-accent font-bold">
                    {pocketVal}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={pocketVal}
                  onChange={(e) => updatePiece(piece, 'pocket', parseInt(e.target.value, 10))}
                  className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-studio-accent"
                  aria-label={`${piece} pocket`}
                />
                <div className="flex justify-between text-[7px] font-mono text-studio-muted/50 uppercase">
                  <span>Early</span>
                  <span>Laid Back</span>
                </div>
              </div>

              {/* Swing slider */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] font-mono text-studio-muted uppercase tracking-tighter">
                      Swing
                    </span>
                    <button
                      type="button"
                      onClick={() => resetPiece(piece, 'swing')}
                      className="p-0.5 rounded hover:bg-white/10 text-studio-muted hover:text-studio-accent transition"
                      aria-label={`Reset ${piece} swing to global default`}
                    >
                      <RotateCcw className="w-3 h-3" />
                    </button>
                  </div>
                  <span className="text-[9px] font-mono text-studio-accent font-bold">
                    {swingVal}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={swingVal}
                  onChange={(e) => updatePiece(piece, 'swing', parseInt(e.target.value, 10))}
                  className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  aria-label={`${piece} swing`}
                />
                <div className="flex justify-between text-[7px] font-mono text-studio-muted/50 uppercase">
                  <span>Straight</span>
                  <span>Heavy</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="pt-2 border-t border-white/5">
        <p className="text-[9px] font-mono text-studio-muted leading-relaxed">
          <span className="text-studio-accent font-bold">ENGINE ADVISORY:</span>{' '}
          Adjusting these values overrides global pocket/swing. Use{' '}
          <span className="text-white">Snare: 75%</span> and{' '}
          <span className="text-white">HiHat: 85%</span> for a classic Dilla/Soulquarian
          “wonky” feel.
        </p>
      </div>
    </div>
  );
};
