import { InstrumentType, SongSection, InstrumentState } from '../types';
import { ProducerProfile } from '../types/producer';

export interface EnergyCurve {
  bySection: Record<string, number>;
}

export interface ArrangementRole {
  instrument: InstrumentType;
  resolveParams: (energy: number, roleWeight: number, producer?: ProducerProfile) => {
    sparseness: number;
    velocityFloor: number;
    velocityCeiling: number;
    layerCount: number;
    fillProbabilitySeed: number;
  };
}

export interface ArrangementInteraction {
  id: string;
  resolve: (
    current: Record<InstrumentType, { sparseness: number; velocityFloor: number }>
  ) => Partial<Record<InstrumentType, { sparseness: number; velocityFloor: number }>>;
}

export interface ArrangementStyle {
  id: string;
  roles: Record<InstrumentType, ArrangementRole>;
  interactions: ArrangementInteraction[];
}

export function resolveArrangement(
  sections: SongSection[],
  curve: EnergyCurve,
  style: ArrangementStyle,
  producer?: ProducerProfile
): Record<string, Record<InstrumentType, Partial<InstrumentState['params']>>> {
  const result: Record<string, Record<InstrumentType, Partial<InstrumentState['params']>>> = {};

  sections.forEach(section => {
    const energy = curve.bySection[section.id] ?? 0.5;
    const perInstrument: Record<InstrumentType, any> = {} as any;

    const roleWeightFor = (inst: InstrumentType) => 1.0; // default weight

    // Pass 1: resolve each instrument independently from the energy curve
    (Object.keys(style.roles) as InstrumentType[]).forEach(inst => {
      const role = style.roles[inst];
      perInstrument[inst] = role.resolveParams(energy, roleWeightFor(inst), producer);
    });

    // Pass 2: deterministic cross-instrument interactions (frequency/role carve-outs)
    style.interactions.forEach(interaction => {
      const adjustments = interaction.resolve(perInstrument);
      Object.entries(adjustments).forEach(([inst, adj]) => {
        if (adj) {
          perInstrument[inst as InstrumentType] = { ...perInstrument[inst as InstrumentType], ...adj };
        }
      });
    });

    result[section.id] = perInstrument;
  });

  return result;
}

export const motownCallAndResponse: ArrangementInteraction = {
  id: 'motown-bass-keys-tradeoff',
  resolve: (current) => {
    // When bass gets busy (low sparseness = high density), keys must thin out
    const adjustments: any = {};
    if (current.Bass && current.Keys && current.Bass.sparseness < 30) {
      adjustments.Keys = { sparseness: Math.min(90, current.Keys.sparseness + 25), velocityFloor: current.Keys.velocityFloor };
    }
    return adjustments;
  },
};

export const standardArrangementStyle: ArrangementStyle = {
  id: 'standard-dynamic',
  roles: {
    Drums: {
      instrument: 'Drums',
      resolveParams: (e, w, p) => {
        const density = p ? p.rhythm.groove_density : 0.5;
        return {
          sparseness: Math.max(10, Math.min(95, 100 - (e * 80) - (density * 10))),
          velocityFloor: 40 + (e * 30),
          velocityCeiling: 90 + (e * 30),
          layerCount: e > 0.7 ? 3 : 1,
          fillProbabilitySeed: e
        };
      }
    },
    Bass: {
      instrument: 'Bass',
      resolveParams: (e, w, p) => {
        const sync = p ? p.rhythm.syncopation : 0.5;
        return {
          sparseness: Math.max(15, 80 - (e * 60) - (sync * 15)),
          velocityFloor: 50 + (e * 20),
          velocityCeiling: 100 + (e * 20),
          layerCount: 1,
          fillProbabilitySeed: e
        };
      }
    },
    Keys: {
      instrument: 'Keys',
      resolveParams: (e, w, p) => {
        const harm = p ? p.harmony.extensions_level : 0.5;
        return {
          sparseness: Math.max(20, 90 - (e * 70) - (harm * 10)),
          velocityFloor: 40 + (e * 20),
          velocityCeiling: 90 + (e * 20),
          layerCount: e > 0.5 ? Math.floor(4 + harm * 2) : 3,
          fillProbabilitySeed: e
        };
      }
    },
    Guitar: {
      instrument: 'Guitar',
      resolveParams: (e, w, p) => ({
        sparseness: 95 - (e * 60),
        velocityFloor: 40 + (e * 20),
        velocityCeiling: 90 + (e * 20),
        layerCount: 1,
        fillProbabilitySeed: e
      })
    },
    Pads: {
      instrument: 'Pads',
      resolveParams: (e, w, p) => {
        const layers = p ? p.arrangement.layer_count : 0.5;
        return {
          sparseness: 60 - (e * 30),
          velocityFloor: 30 + (e * 20),
          velocityCeiling: 70 + (e * 20),
          layerCount: Math.floor(2 + layers * 3),
          fillProbabilitySeed: e
        };
      }
    },
    Lead: {
      instrument: 'Lead',
      resolveParams: (e, w, p) => ({
        sparseness: 90 - (e * 40),
        velocityFloor: 60 + (e * 10),
        velocityCeiling: 100 + (e * 10),
        layerCount: 1,
        fillProbabilitySeed: e
      })
    },
    Sampler: {
      instrument: 'Sampler',
      resolveParams: (e, w, p) => ({
        sparseness: 95 - (e * 50),
        velocityFloor: 50 + (e * 20),
        velocityCeiling: 100 + (e * 20),
        layerCount: 1,
        fillProbabilitySeed: e
      })
    }
  },
  interactions: [motownCallAndResponse]
};
