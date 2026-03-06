/**
 * Threshold pruning for TNA models.
 */
import type { TNA, GroupTNA } from '../core/types.js';
import { isGroupTNA, groupEntries } from '../model/group.js';

/**
 * Prune edges below a weight threshold.
 */
export function prune(
  model: TNA | GroupTNA,
  threshold = 0.1,
): TNA | Record<string, TNA> {
  if (isGroupTNA(model)) {
    const result: Record<string, TNA> = {};
    for (const [name, m] of groupEntries(model)) {
      result[name] = prune(m, threshold) as TNA;
    }
    return result;
  }

  const tnaModel = model as TNA;
  const weights = tnaModel.weights.map((v) => (v < threshold ? 0 : v));

  return {
    weights,
    inits: new Float64Array(tnaModel.inits),
    labels: [...tnaModel.labels],
    data: tnaModel.data,
    type: tnaModel.type,
    scaling: [...tnaModel.scaling],
  };
}
