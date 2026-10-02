import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ReputationRankingService,
  wilsonScoreLowerBound,
} from '../src/services/reputation_ranking.js';
import { Resource } from '../src/types.js';

describe('acr-marketplace: Wilson 95% Reputation Ranking Service', () => {
  it('should calculate defensive Wilson lower bound score', () => {
    // Edge case: 0 trials
    assert.equal(wilsonScoreLowerBound(0, 0), 0.0);
    assert.equal(wilsonScoreLowerBound(-5, 0), 0.0);
    assert.equal(wilsonScoreLowerBound(0, -10), 0.0);
    assert.equal(wilsonScoreLowerBound(NaN, 10), 0.0);
    assert.equal(wilsonScoreLowerBound(5, NaN), 0.0);

    // Single 100% sample: high uncertainty => low confidence lower bound
    const oneSample = wilsonScoreLowerBound(1, 1);
    assert.ok(oneSample > 0.15 && oneSample < 0.35);

    // 100 samples with 95% success
    const hundredSamples = wilsonScoreLowerBound(95, 100);
    assert.ok(hundredSamples > 0.88 && hundredSamples < 0.93);

    // 1000 samples with 93% success
    const thousandSamples = wilsonScoreLowerBound(930, 1000);
    assert.ok(thousandSamples > 0.91 && thousandSamples < 0.95);

    // Elimination of low-sample distortion: 930/1000 beats 1/1
    assert.ok(thousandSamples > oneSample);
  });

  it('should track outcomes and compute weighted reputation scores', () => {
    const service = new ReputationRankingService();

    service.recordOutcome({
      agent: 'acr-plugin-git',
      success: true,
      weight: 1.0,
      source: 'test-runner',
      timestamp: new Date().toISOString(),
    });

    service.recordOutcome({
      agent: 'acr-plugin-git',
      success: true,
      weight: 2.0,
      source: 'live-execution',
      timestamp: new Date().toISOString(),
    });

    service.recordOutcome({
      agent: 'acr-plugin-git',
      success: false,
      weight: 1.0,
      source: 'live-execution',
      timestamp: new Date().toISOString(),
    });

    // Ignored invalid weight
    service.recordOutcome({
      agent: 'acr-plugin-git',
      success: true,
      weight: -5.0,
      source: 'bad',
      timestamp: new Date().toISOString(),
    });

    const rep = service.getScore('acr-plugin-git');
    assert.equal(rep.total, 4.0);
    assert.equal(rep.successes, 3.0);
    assert.equal(rep.rate, 0.75);
    assert.ok(rep.score > 0.0 && rep.score < 0.75);
  });

  it('should rank verified marketplace catalog resources by Wilson score', () => {
    const service = new ReputationRankingService();

    // Plugin A: 1 trial, 1 success (raw rate 100%, but small sample => low confidence)
    service.recordOutcome({ agent: 'plugin-untested', success: true, weight: 1.0, source: 'user', timestamp: '' });

    // Plugin B: 50 trials, 48 successes (raw rate 96%, established => high confidence)
    for (let i = 0; i < 48; i++) {
      service.recordOutcome({ agent: 'plugin-veteran', success: true, weight: 1.0, source: 'ci', timestamp: '' });
    }
    for (let i = 0; i < 2; i++) {
      service.recordOutcome({ agent: 'plugin-veteran', success: false, weight: 1.0, source: 'ci', timestamp: '' });
    }

    // Plugin C: 0 trials (unseen)
    const testPlugins: Resource[] = [
      {
        name: 'plugin-untested',
        description: 'New shiny plugin',
        type: 'plugin',
        install_command: 'acr install untested',
        source: 'catalog',
      },
      {
        name: 'plugin-veteran',
        description: 'Established reliable plugin',
        type: 'plugin',
        install_command: 'acr install veteran',
        source: 'catalog',
      },
      {
        name: 'plugin-zero',
        description: 'Brand new zero-run plugin',
        type: 'plugin',
        install_command: 'acr install zero',
        source: 'catalog',
      },
    ];

    const ranked = service.rankResources(testPlugins);

    // Verified veteran plugin MUST be ranked first despite 96% < 100%
    assert.equal(ranked[0].name, 'plugin-veteran');
    assert.equal(ranked[1].name, 'plugin-untested');
    assert.equal(ranked[2].name, 'plugin-zero');

    assert.ok(ranked[0].reputation.score > ranked[1].reputation.score);
    assert.equal(ranked[2].reputation.score, 0.0);
    assert.equal(ranked[2].quality_score, 0);
  });
});
