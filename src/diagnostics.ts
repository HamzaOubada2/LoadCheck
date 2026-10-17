/**
 * Automated diagnosis engine for LoadCheck test results.
 *
 * Inspects latencies, error rates, percentiles, and generator health to
 * detect common performance anomalies and produce actionable
 * recommendations.
 */

import {
  LoadTestSummary,
  HealthReport,
  DiagnosticInsight,
  DiagnosticReport,
} from './types';

/**
 * Thresholds used for anomaly detection.
 */
interface DetectionThresholds {
  /** p99/p50 ratio above which latency degradation is flagged */
  latencyDegradationRatio: number;
  /** Error rate above which error analysis is triggered */
  errorRatePercent: number;
  /** p99 latency above which tail latency is considered high */
  highP99Ms: number;
  /** Generator saturated triggers bottleneck analysis */
  generatorSaturated: boolean;
}

const DEFAULT_THRESHOLDS: DetectionThresholds = {
  latencyDegradationRatio: 3.0,
  errorRatePercent: 5.0,
  highP99Ms: 500,
  generatorSaturated: true,
};

/**
 * Classify errors as client-side (connection) or server-side (5xx).
 * Since the runner only tracks aggregate errorRate and not per-status
 * breakdowns, we use heuristics based on the magnitude of the error
 * rate combined with p99 to infer the likely source.
 */
function analyzeErrorPattern(
  summary: LoadTestSummary,
): DiagnosticInsight[] {
  const insights: DiagnosticInsight[] = [];

  if (summary.errorRate === 0) {
    return insights;
  }

  if (summary.errorRate >= DEFAULT_THRESHOLDS.errorRatePercent) {
    // High error rate. If p99 is also very high, requests are timing out
    // (client-side connection issues). If p99 is moderate but errors are
    // high, the server is likely returning 5xx responses.
    if (summary.p99 > DEFAULT_THRESHOLDS.highP99Ms) {
      insights.push({
        type: 'error',
        severity: 'critical',
        title: 'High error rate with elevated p99 latency — likely client-side connection issues',
        description: `Error rate is ${summary.errorRate.toFixed(2)}% with p99 latency of ${summary.p99.toFixed(0)}ms. Requests are timing out or failing to connect.`,
        recommendation:
          'Check connection limits (ulimit -n), DNS resolution, TLS handshake, and whether the target is rate-limiting or blocking the generator. Consider reducing --users or increasing connection pool limits.',
      });
    } else {
      insights.push({
        type: 'error',
        severity: 'warning',
        title: 'Elevated error rate — likely server-side 5xx responses',
        description: `Error rate is ${summary.errorRate.toFixed(2)}% but p99 latency remains moderate at ${summary.p99.toFixed(0)}ms, suggesting the server is responding with error status codes rather than timing out.`,
        recommendation:
          'Inspect server logs for 5xx responses. Check for unhandled exceptions, database connection pool exhaustion, or application crashes. Verify the target endpoint health independently.',
      });
    }
  } else if (summary.errorRate > 0) {
    insights.push({
      type: 'error',
      severity: 'info',
      title: 'Minor error rate detected',
      description: `Error rate is ${summary.errorRate.toFixed(2)}% (${summary.failedRequests} of ${summary.totalRequests} requests failed).`,
      recommendation:
        'Review failed requests to determine if they are isolated or part of a larger pattern. Monitor error trend over successive runs.',
    });
  }

  return insights;
}

/**
 * Detect if the local generator is saturated vs. the target server slowing down.
 */
function analyzeBottleneck(
  summary: LoadTestSummary,
  health: HealthReport,
): DiagnosticInsight[] {
  const insights: DiagnosticInsight[] = [];

  if (health.saturated) {
    // Generator is the bottleneck
    insights.push({
      type: 'bottleneck',
      severity: 'critical',
      title: 'Load generator is saturated — results may be inaccurate',
      description: `Event-loop lag is ${health.lagMs.toFixed(1)}ms and CPU is ${health.cpuPercent.toFixed(1)}%. The generator cannot keep up with approximately ${Math.round(summary.totalRequests / (summary.requestsPerSecond || 1))} effective concurrent users.`,
      recommendation:
        'Reduce --users, run on a larger host, or distribute the test across multiple machines. The recorded latencies are inflated by generator contention, not target slowness.',
    });
  } else if (summary.p99 > DEFAULT_THRESHOLDS.highP99Ms) {
    // Generator is healthy but target is slow — target is the bottleneck
    insights.push({
      type: 'bottleneck',
      severity: 'warning',
      title: 'Target server is the bottleneck — high tail latency with healthy generator',
      description: `Generator is healthy (lag ${health.lagMs.toFixed(1)}ms, CPU ${health.cpuPercent.toFixed(1)}%) but p99 latency is ${summary.p99.toFixed(0)}ms. The target cannot keep up with the request rate.`,
      recommendation:
        'Scale the target server, optimize application code, check database query performance, add caching, or reduce --users to match target capacity.',
    });
  } else {
    insights.push({
      type: 'bottleneck',
      severity: 'info',
      title: 'No significant bottleneck detected',
      description:
        'Generator is healthy and tail latency is within normal bounds.',
      recommendation:
        'Consider increasing --users to find the target\'s saturation point if more headroom is needed.',
    });
  }

  return insights;
}

/**
 * Detect latency degradation: p99 significantly higher than p50.
 */
function analyzeLatencyDegradation(
  summary: LoadTestSummary,
): DiagnosticInsight[] {
  const insights: DiagnosticInsight[] = [];

  if (summary.p50 === 0) {
    return insights;
  }

  const ratio = summary.p99 / summary.p50;

  if (ratio >= DEFAULT_THRESHOLDS.latencyDegradationRatio) {
    insights.push({
      type: 'latency',
      severity: ratio >= 5.0 ? 'critical' : 'warning',
      title: `High latency degradation (p99/p50 ratio = ${ratio.toFixed(1)}x)`,
      description: `p50 is ${summary.p50.toFixed(1)}ms but p99 is ${summary.p99.toFixed(1)}ms — a ${ratio.toFixed(1)}x spread. This indicates queueing, garbage collection pauses, database locking, or intermittent slowdowns.`,
      recommendation:
        'Investigate tail-latency causes: check GC logs, database slow queries, lock contention, thread pool exhaustion, and downstream dependency latency. Consider adding retries with exponential backoff for transient slowness.',
    });
  } else if (ratio >= 2.0) {
    insights.push({
      type: 'latency',
      severity: 'info',
      title: 'Moderate latency spread',
      description: `p50 is ${summary.p50.toFixed(1)}ms and p99 is ${summary.p99.toFixed(1)}ms (${ratio.toFixed(1)}x ratio). Some tail latency present but not severe.`,
      recommendation:
        'Monitor the p99/p50 trend over time. If it grows, investigate queueing or GC behavior.',
    });
  }

  return insights;
}

/**
 * Run the full diagnosis engine against test results.
 */
export function diagnose(
  summary: LoadTestSummary,
  health: HealthReport,
): DiagnosticReport {
  const insights: DiagnosticInsight[] = [];

  // Run all analyzers
  insights.push(...analyzeBottleneck(summary, health));
  insights.push(...analyzeLatencyDegradation(summary));
  insights.push(...analyzeErrorPattern(summary));

  // Sort by severity: critical > warning > info
  const severityOrder = { critical: 0, warning: 1, info: 2 };
  insights.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  const criticalCount = insights.filter((i) => i.severity === 'critical').length;
  const warningCount = insights.filter((i) => i.severity === 'warning').length;

  let summaryText: string;
  if (criticalCount > 0) {
    summaryText = `${criticalCount} critical issue(s) detected — review recommendations before proceeding.`;
  } else if (warningCount > 0) {
    summaryText = `${warningCount} warning(s) detected — monitor and address as needed.`;
  } else if (insights.length > 0) {
    summaryText = 'No significant issues detected. System appears healthy.';
  } else {
    summaryText = 'No diagnostic insights available.';
  }

  return { insights, summary: summaryText };
}


