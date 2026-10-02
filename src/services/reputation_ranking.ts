import { Resource } from '../types.js';

export interface OutcomeRecord {
  agent: string;
  success: boolean;
  weight: number;
  source: string;
  timestamp: string;
}

export interface ReputationScore {
  agent: string;
  successes: number;
  total: number;
  rate: number;
  score: number;
}

/**
 * WilsonLowerBound calculates the lower bound of the Wilson score interval at confidence z.
 * If z is 0, standard 95% confidence (1.96) is used.
 * Includes defensive input clamping and small-sample / zero-sample guards.
 * Eliminates low-sample distortions (e.g. 1 review of 100% vs 1000 reviews of 98%).
 */
export function wilsonScoreLowerBound(k: number, n: number, z = 1.96): number {
  if (z <= 0 || !Number.isFinite(z)) {
    z = 1.96;
  }
  if (n <= 0 || !Number.isFinite(n) || isNaN(n)) {
    return 0.0;
  }
  if (!Number.isFinite(k) || isNaN(k)) {
    return 0.0;
  }

  // Defensive clamping for invalid or out-of-range inputs
  const kClamped = Math.min(Math.max(0.0, k), n);
  const p = kClamped / n;

  const denominator = 1.0 + (z * z) / n;
  const centre = p + (z * z) / (2.0 * n);
  const radicand = Math.max(0.0, (p * (1.0 - p) + (z * z) / (4.0 * n)) / n);
  const spread = z * Math.sqrt(radicand);
  const lower = (centre - spread) / denominator;

  return Math.max(0.0, Math.min(1.0, lower));
}

/**
 * ReputationLedger & Ranking Service:
 * Aggregates verified outcome records and ranks marketplace plugins/skills
 * by their Wilson 95% confidence lower-bound score.
 */
export class ReputationRankingService {
  private readonly records: OutcomeRecord[] = [];

  constructor(initialRecords: OutcomeRecord[] = []) {
    for (const r of initialRecords) {
      this.recordOutcome(r);
    }
  }

  public recordOutcome(record: OutcomeRecord): void {
    if (record.weight <= 0 || !Number.isFinite(record.weight) || isNaN(record.weight)) {
      return;
    }
    this.records.push({
      ...record,
      timestamp: record.timestamp || new Date().toISOString(),
    });
  }

  public recordOutcomes(records: OutcomeRecord[]): void {
    for (const r of records) {
      this.recordOutcome(r);
    }
  }

  public getScore(agentOrPluginId: string, z = 1.96): ReputationScore {
    let successes = 0.0;
    let total = 0.0;

    for (const r of this.records) {
      if (r.agent === agentOrPluginId) {
        total += r.weight;
        if (r.success) {
          successes += r.weight;
        }
      }
    }

    const rate = total > 0 ? successes / total : 0.0;
    const score = wilsonScoreLowerBound(successes, total, z);

    return {
      agent: agentOrPluginId,
      successes,
      total,
      rate,
      score,
    };
  }

  public rankResources(resources: Resource[], z = 1.96): Array<Resource & { reputation: ReputationScore }> {
    const scored = resources.map((res) => {
      const rep = this.getScore(res.name, z);
      return {
        ...res,
        reputation: rep,
        // Update quality_score on resource directly
        quality_score: Math.round(rep.score * 100),
      };
    });

    // Sort by Wilson score descending; tiebreaker: total verified outcomes descending, then name ascending
    scored.sort((a, b) => {
      const scoreDiff = b.reputation.score - a.reputation.score;
      if (Math.abs(scoreDiff) > 0.0001) {
        return scoreDiff;
      }
      const totalDiff = b.reputation.total - a.reputation.total;
      if (totalDiff !== 0) {
        return totalDiff;
      }
      return a.name.localeCompare(b.name);
    });

    return scored;
  }

  public getRecordCount(): number {
    return this.records.length;
  }
}
