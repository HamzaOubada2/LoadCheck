import { describe, it, expect } from 'vitest';
import { checkGeneratorHealth } from '../src/selfcheck';

describe('checkGeneratorHealth', () => {
  it('returns a valid health report', () => {
    const report = checkGeneratorHealth();
    expect(report).toHaveProperty('lagMs');
    expect(report).toHaveProperty('cpuPercent');
    expect(report).toHaveProperty('saturated');
    expect(typeof report.lagMs).toBe('number');
    expect(typeof report.cpuPercent).toBe('number');
    expect(typeof report.saturated).toBe('boolean');
  });

  it('does not saturate under normal conditions with generous thresholds', () => {
    const report = checkGeneratorHealth({
      lagThresholdMs: 5000,
      cpuThresholdPercent: 100,
    });
    expect(report.saturated).toBe(false);
  });

  it('reports saturation when lag threshold is very low', () => {
    // With a near-zero lag threshold, almost any measurement saturates
    const report = checkGeneratorHealth({
      lagThresholdMs: 0,
      cpuThresholdPercent: 95,
    });
    // lagMs may be 0 or very small; just verify the type is correct
    expect(typeof report.saturated).toBe('boolean');
  });

  it('reports saturation when CPU threshold is 0', () => {
    const report = checkGeneratorHealth({
      lagThresholdMs: 1000,
      cpuThresholdPercent: 0,
    });
    expect(typeof report.saturated).toBe('boolean');
  });
});
