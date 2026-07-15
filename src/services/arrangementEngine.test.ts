import { describe, it, expect } from 'vitest';
import { resolveArrangement, standardArrangementStyle } from './arrangementEngine';

describe('arrangementEngine', () => {
  it('should resolve arrangement correctly', () => {
    const sections = [{ id: 's1', name: 'Verse', chords: [], instrumentParams: {} }];
    const curve = { bySection: { s1: 0.5 } };
    const result = resolveArrangement(sections, curve, standardArrangementStyle);
    
    expect(result['s1']).toBeDefined();
    expect(result['s1'].Drums).toBeDefined();
    expect(result['s1'].Drums.sparseness).toBeCloseTo(100 - (0.5 * 80)); // 60
  });
});
