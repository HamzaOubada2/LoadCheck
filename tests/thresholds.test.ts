import { describe, it, expect } from 'vitest';
import { evaluateThresholds } from '../src/thresholds';
import { EXIT_SUCCESS, EXIT_THRESHOLD_FAILED } from '../src/cli';
import { LoadTestSummary } from '../src/types';

const baseSummary: LoadTestSummary = {
  totalRequests: 100,
  requestsPerSecond: 10,
  p50: 50,
  p95: 100,
  p99: 200,
  errorRate: 5,
  failedRequests: 5,
  successfulRequests: 95,
};

describe('evaluateThresholds', () => {
  it('passes when all thresholds are within limits', () => {
    const result = evaluateThresholds(baseSummary, {
      p95Ms: 200,
      p99Ms: 300,
      errorRatePercent: 10,
      minRequestsPerSecond: 5,
    });
    expect(result.passed).toBe(true);
    expect(result.failures).toHaveLength(0);
    expect(result.exitCode).toBe(EXIT_SUCCESS);
  });

  it('fails when p95 is exceeded', () => {
    const result = evaluateThresholds(baseSummary, { p95Ms: 50 });
    expect(result.passed).toBe(false);
    expect(result.exitCode).toBe(EXIT_THRESHOLD_FAILED);
    expect(result.failures.length).toBeGreaterThan(0);
    expect(result.failures[0]).toContain('p95');
  });

  it('fails when p99 is exceeded', () => {
    const result = evaluateThresholds(baseSummary, { p99Ms: 50 });
    expect(result.passed).toBe(false);
    expect(result.exitCode).toBe(EXIT_THRESHOLD_FAILED);
    expect(result.failures[0]).toContain('p99');
  });

  it('fails when error rate is exceeded', () => {
    const result = evaluateThresholds(baseSummary, { errorRatePercent: 1 });
    expect(result.passed).toBe(false);
    expect(result.exitCode).toBe(EXIT_THRESHOLD_FAILED);
    expect(result.failures[0]).toContain('error rate');
  });

  it('fails when requests per second is below minimum', () => {
    const result = evaluateThresholds(baseSummary, { minRequestsPerSecond: 50 });
    expect(result.passed).toBe(false);
    expect(result.exitCode).toBe(EXIT_THRESHOLD_FAILED);
    expect(result.failures[0]).toContain('requests/sec');
  });

  it('passes with empty thresholds', () => {
    const result = evaluateThresholds(baseSummary, {});
    expect(result.passed).toBe(true);
    expect(result.exitCode).toBe(EXIT_SUCCESS);
  });

  it('collects multiple failures', () => {
    const result = evaluateThresholds(baseSummary, {
      p95Ms: 50,
      p99Ms: 50,
      errorRatePercent: 1,
    });
    expect(result.passed).toBe(false);
    expect(result.failures.length).toBe(3);
  });
});
