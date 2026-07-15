import { PerformanceContext, InstrumentState, SessionParameters } from '../types';

export function coordinateEnsemble(
  players: Record<string, InstrumentState>,
  params: SessionParameters
): SessionParameters {
  const adjustedParams = { ...params };

  // Example coordination logic:
  // If drums are energetic (high energy), encourage bass to be tighter (higher pocket).
  if (players.Drums?.params.energy > 70) {
    adjustedParams.pocket = Math.min(100, adjustedParams.pocket + 10);
  }

  // If jazz genre, increase syncopation
  if (params.genre === 'Jazz') {
    adjustedParams.syncopation = Math.min(100, adjustedParams.syncopation + 20);
  }

  return adjustedParams;
}
