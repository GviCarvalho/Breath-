import type { Posture } from './types';

export type OpponentAction = 'attack' | 'defense' | 'dodge' | 'draw';

export interface PredictorState {
  count: Record<OpponentAction, number>;
  heat: Record<OpponentAction, [number, number, number]>;
  heatPosture: [number, number, number];
}

export interface PredictorOptions {
  decay?: number; // forgetting factor
  alpha?: number; // mix base vs posture-conditional
  noise?: number; // exploration
}

export interface Predictor {
  observe(input: { posture: number; breath: number; action: OpponentAction }): void;
  predict(input: { posture: number; breath: number }): Record<OpponentAction, number>;
  chooseAction(input: { posture: number; breath: number; myActionOptions: OpponentAction[] }): { pick: OpponentAction; scored: Array<{ type: OpponentAction; ev: number }>; probs: Record<OpponentAction, number> };
  reset(prior?: PredictorState | null): void;
  snapshot(): PredictorState;
}

function applyDecay(values: number[], decay: number): void {
  for (let i = 0; i < values.length; i++) {
    values[i] *= decay;
  }
}

function normalizeProbabilities<T extends string>(obj: Record<T, number>): Record<T, number> {
  const values = Object.values(obj) as number[];
  const sum: number = values.reduce((a, b) => a + b, 0) || 1;
  const out = {} as Record<T, number>;
  for (const k in obj) out[k as T] = obj[k as T] / sum;
  return out;
}

function clampProbabilities<T extends string>(p: Record<T, number>): Record<T, number> {
  const eps = 1e-6;
  let sum = 0;
  for (const k in p) {
    p[k as T] = Math.max(p[k as T], eps);
    sum += p[k as T];
  }
  for (const k in p) {
    p[k as T] /= sum || 1;
  }
  return p;
}

export function createPredictor(opts: PredictorOptions = {}): Predictor {
  const decay = opts.decay ?? 0.9;
  const alpha = opts.alpha ?? 0.4;
  const noise = opts.noise ?? 0.12;

  const state: PredictorState = {
    count: { attack: 1, defense: 1, dodge: 1, draw: 1 },
    heat: {
      attack: [1, 1, 1],
      defense: [1, 1, 1],
      dodge: [1, 1, 1],
      draw: [1, 1, 1],
    },
    heatPosture: [1, 1, 1],
  };

  function decayAll() {
    for (const k in state.count) state.count[k as OpponentAction] *= decay;
    for (const k in state.heat) {
      applyDecay(state.heat[k as OpponentAction], decay);
    }
    applyDecay(state.heatPosture, decay);
  }

  function observe(input: { posture: number; breath: number; action: OpponentAction }) {
    const { posture, action } = input;
    if (posture < 0 || posture > 2) return;
    decayAll();
    state.count[action] += 1;
    state.heat[action][posture] += 1;
    state.heatPosture[posture] += 1;
  }

  function predict(input: { posture: number; breath: number }): Record<OpponentAction, number> {
    const { posture, breath } = input;
    const pBase = normalizeProbabilities({ ...state.count });
    const raw = {
      attack: state.heat.attack[posture] ?? 0,
      defense: state.heat.defense[posture] ?? 0,
      dodge: state.heat.dodge[posture] ?? 0,
      draw: state.heat.draw[posture] ?? 0,
    } as Record<OpponentAction, number>;
    const pPost = normalizeProbabilities(raw);
    let p: Record<OpponentAction, number> = {
      attack: alpha * pBase.attack + (1 - alpha) * pPost.attack,
      defense: alpha * pBase.defense + (1 - alpha) * pPost.defense,
      dodge: alpha * pBase.dodge + (1 - alpha) * pPost.dodge,
      draw: alpha * pBase.draw + (1 - alpha) * pPost.draw,
    };
    if (breath <= 0) {
      p = { attack: 0, defense: 0, dodge: 0, draw: 1 };
    } else if (breath === 1) {
      p.attack *= 0.6;
      p.defense *= 1.2;
      p.dodge *= 1.2;
      p.draw *= 1.1;
    }
    return clampProbabilities(p);
  }

  function expectedValue(myActionType: OpponentAction, oppType: OpponentAction): number {
    const M: Record<OpponentAction, Record<OpponentAction, number>> = {
      attack: { attack: -0.3, defense: -1.2, dodge: -0.8, draw: +0.8 },
      defense: { attack: +1.6, defense: +0.1, dodge: -0.2, draw: +0.2 },
      dodge: { attack: +0.8, defense: 0.0, dodge: 0.0, draw: +0.1 },
      draw: { attack: -0.9, defense: -0.3, dodge: -0.1, draw: 0.0 },
    };
    return M[myActionType][oppType];
  }

  function chooseAction(input: { posture: number; breath: number; myActionOptions: OpponentAction[] }) {
    const { posture, breath, myActionOptions } = input;
    const probs = predict({ posture, breath });
    const uniq = Array.from(new Set(myActionOptions));
    const scored = uniq.map((type) => {
      const ev =
        probs.attack * expectedValue(type, 'attack') +
        probs.defense * expectedValue(type, 'defense') +
        probs.dodge * expectedValue(type, 'dodge') +
        probs.draw * expectedValue(type, 'draw');
      return { type, ev };
    });
    for (const s of scored) s.ev *= (1 - noise) + Math.random() * noise * 2;
    scored.sort((a, b) => b.ev - a.ev);
    const pick = scored.length ? scored[0].type : 'draw';
    return { pick, scored, probs };
  }

  function reset(prior?: PredictorState | null) {
    if (!prior) {
      state.count = { attack: 1, defense: 1, dodge: 1, draw: 1 };
      state.heat = { attack: [1, 1, 1], defense: [1, 1, 1], dodge: [1, 1, 1], draw: [1, 1, 1] } as any;
      state.heatPosture = [1, 1, 1];
    } else {
      state.count = { ...prior.count };
      state.heat = {
        attack: [...prior.heat.attack],
        defense: [...prior.heat.defense],
        dodge: [...prior.heat.dodge],
        draw: [...prior.heat.draw],
      } as any;
      state.heatPosture = [...prior.heatPosture];
    }
  }

  function snapshot(): PredictorState {
    return JSON.parse(JSON.stringify(state));
  }

  return { observe, predict, chooseAction, reset, snapshot };
}

export function postureCharToIndex(p: Posture): number {
  return p === 'A' ? 0 : p === 'B' ? 1 : 2;
}
