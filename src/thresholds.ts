import { LoadTestSummary } from './types';

/**
 * Exit codes:
 *   0 — Success (all checks and thresholds passed)
 *   1 — Threshold failed (performance thresholds breached)
 *   2 — Configuration error
 *   3 — Safety block (from Phase 1 safety layer)
 */

export interface ThresholdConfig {
  p95Ms?: number;
  p99Ms?: number;
  errorRatePercent?: number;
  minRequestsPerSecond?: number;
}

export interface ThresholdResult {
  passed: boolean;
  failures: string[];
  exitCode: number;
}

/**
 * Evaluate a LoadTestSummary against a ThresholdConfig.
 */
export function evaluateThresholds(
  summary: LoadTestSummary,
  thresholds: ThresholdConfig,
): ThresholdResult {
  const failures: string[] = [];

  if (thresholds.p95Ms !== undefined && summary.p95 > thresholds.p95Ms) {
    failures.push(
      `p95 latency ${summary.p95.toFixed(2)}ms exceeds threshold ${thresholds.p95Ms}ms`,
    );
  }

  if (thresholds.p99Ms !== undefined && summary.p99 > thresholds.p99Ms) {
    failures.push(
      `p99 latency ${summary.p99.toFixed(2)}ms exceeds threshold ${thresholds.p99Ms}ms`,
    );
  }

  if (
    thresholds.errorRatePercent !== undefined &&
    summary.errorRate > thresholds.errorRatePercent
  ) {
    failures.push(
      `error rate ${summary.errorRate.toFixed(2)}% exceeds threshold ${thresholds.errorRatePercent}%`,
    );
  }

  if (
    thresholds.minRequestsPerSecond !== undefined &&
    summary.requestsPerSecond < thresholds.minRequestsPerSecond
  ) {
    failures.push(
      `requests/sec ${summary.requestsPerSecond.toFixed(2)} below threshold ${thresholds.minRequestsPerSecond}`,
    );
  }

  return {
    passed: failures.length === 0,
    failures,
    exitCode: failures.length === 0 ? 0 : 1,
  };
}
