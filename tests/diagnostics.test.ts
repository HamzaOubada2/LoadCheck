import { describe, it, expect } from 'vitest';
import { diagnose } from '../src/diagnostics';
import {
  LoadTestSummary,
  HealthReport,
  DiagnosticReport,
  DiagnosticInsight,
} from '../src/types';

describe('diagnose', () => {
  const baseSummary: LoadTestSummary = {
    totalRequests: 1000,
    requestsPerSecond: 100,
    p50: 50,
    p95: 70,
    p99: 90,
    errorRate: 0,
    failedRequests: 0,
    successfulRequests: 1000,
  };

  const healthyHealth: HealthReport = {
    lagMs: 5,
    cpuPercent: 20,
    saturated: false,
  };

  const saturatedHealth: HealthReport = {
    lagMs: 100,
    cpuPercent: 95,
    saturated: true,
  };

  it('returns a valid DiagnosticReport', () => {
    const report = diagnose(baseSummary, healthyHealth);
    expect(report).toHaveProperty('insights');
    expect(report).toHaveProperty('summary');
    expect(Array.isArray(report.insights)).toBe(true);
    expect(typeof report.summary).toBe('string');
  });

  it('reports no significant issues for healthy results', () => {
    const report = diagnose(baseSummary, healthyHealth);
    expect(report.summary).toContain('healthy');
    const critical = report.insights.filter((i) => i.severity === 'critical');
    expect(critical).toHaveLength(0);
  });

  it('detects generator saturation as critical bottleneck', () => {
    const report = diagnose(baseSummary, saturatedHealth);
    const bottleneck = report.insights.find((i) => i.type === 'bottleneck');
    expect(bottleneck).toBeDefined();
    expect(bottleneck!.severity).toBe('critical');
    expect(bottleneck!.title).toContain('saturated');
    expect(bottleneck!.recommendation).toContain('--users');
  });

  it('detects target server as bottleneck when generator is healthy but p99 is high', () => {
    const slowSummary: LoadTestSummary = {
      ...baseSummary,
      p99: 800,
    };
    const report = diagnose(slowSummary, healthyHealth);
    const bottleneck = report.insights.find((i) => i.type === 'bottleneck');
    expect(bottleneck).toBeDefined();
    expect(bottleneck!.title).toContain('Target server');
    expect(bottleneck!.recommendation).toContain('target');
  });

  it('detects latency degradation when p99/p50 ratio is high', () => {
    const degradedSummary: LoadTestSummary = {
      ...baseSummary,
      p50: 50,
      p99: 300, // 6x ratio
    };
    const report = diagnose(degradedSummary, healthyHealth);
    const latency = report.insights.find((i) => i.type === 'latency');
    expect(latency).toBeDefined();
    expect(latency!.severity).toBe('critical');
    expect(latency!.title).toContain('ratio');
    expect(latency!.recommendation).toContain('GC');
  });

  it('detects moderate latency spread at 2x ratio', () => {
    const moderateSummary: LoadTestSummary = {
      ...baseSummary,
      p50: 50,
      p99: 110, // 2.2x ratio
    };
    const report = diagnose(moderateSummary, healthyHealth);
    const latency = report.insights.find((i) => i.type === 'latency');
    expect(latency).toBeDefined();
    expect(latency!.severity).toBe('info');
  });

  it('reports no latency insight when p99/p50 ratio is low', () => {
    const report = diagnose(baseSummary, healthyHealth);
    const latency = report.insights.find((i) => i.type === 'latency');
    expect(latency).toBeUndefined();
  });

  it('detects client-side connection issues when error rate is high and p99 is high', () => {
    const errorSummary: LoadTestSummary = {
      ...baseSummary,
      errorRate: 15,
      failedRequests: 150,
      successfulRequests: 850,
      p99: 800,
    };
    const report = diagnose(errorSummary, healthyHealth);
    const errorInsight = report.insights.find((i) => i.type === 'error');
    expect(errorInsight).toBeDefined();
    expect(errorInsight!.severity).toBe('critical');
    expect(errorInsight!.title).toContain('client-side');
    expect(errorInsight!.recommendation).toContain('connection');
  });

  it('detects server-side 5xx errors when error rate is high but p99 is moderate', () => {
    const errorSummary: LoadTestSummary = {
      ...baseSummary,
      errorRate: 12,
      failedRequests: 120,
      successfulRequests: 880,
      p99: 100,
    };
    const report = diagnose(errorSummary, healthyHealth);
    const errorInsight = report.insights.find((i) => i.type === 'error');
    expect(errorInsight).toBeDefined();
    expect(errorInsight!.severity).toBe('warning');
    expect(errorInsight!.title).toContain('server-side');
    expect(errorInsight!.recommendation).toContain('5xx');
  });

  it('reports minor error rate as info', () => {
    const errorSummary: LoadTestSummary = {
      ...baseSummary,
      errorRate: 2,
      failedRequests: 20,
      successfulRequests: 980,
    };
    const report = diagnose(errorSummary, healthyHealth);
    const errorInsight = report.insights.find((i) => i.type === 'error');
    expect(errorInsight).toBeDefined();
    expect(errorInsight!.severity).toBe('info');
  });

  it('returns no error insights when error rate is zero', () => {
    const report = diagnose(baseSummary, healthyHealth);
    const errorInsight = report.insights.find((i) => i.type === 'error');
    expect(errorInsight).toBeUndefined();
  });

  it('sorts insights by severity (critical first)', () => {
    const criticalSummary: LoadTestSummary = {
      ...baseSummary,
      errorRate: 20,
      failedRequests: 200,
      successfulRequests: 800,
      p99: 1000,
      p50: 50,
    };
    const report = diagnose(criticalSummary, saturatedHealth);
    const severities = report.insights.map((i) => i.severity);
    const order = { critical: 0, warning: 1, info: 2 };
    for (let i = 0; i < severities.length - 1; i++) {
      expect(order[severities[i]]).toBeLessThanOrEqual(order[severities[i + 1]]);
    }
  });

  it('includes a human-readable summary string', () => {
    const report = diagnose(baseSummary, healthyHealth);
    expect(typeof report.summary).toBe('string');
    expect(report.summary.length).toBeGreaterThan(0);
  });

  it('critical issues produce critical summary', () => {
    const criticalSummary: LoadTestSummary = {
      ...baseSummary,
      p99: 2000,
    };
    const report = diagnose(criticalSummary, saturatedHealth);
    expect(report.summary).toContain('critical');
  });

  it('DiagnosticInsight has all required fields', () => {
    const report = diagnose(baseSummary, healthyHealth);
    for (const insight of report.insights) {
      expect(insight).toHaveProperty('type');
      expect(insight).toHaveProperty('severity');
      expect(insight).toHaveProperty('title');
      expect(insight).toHaveProperty('description');
      expect(insight).toHaveProperty('recommendation');
      expect(['bottleneck', 'latency', 'error', 'health']).toContain(insight.type);
      expect(['info', 'warning', 'critical']).toContain(insight.severity);
    }
  });

  it('handles zero requests gracefully', () => {
    const emptySummary: LoadTestSummary = {
      totalRequests: 0,
      requestsPerSecond: 0,
      p50: 0,
      p95: 0,
      p99: 0,
      errorRate: 0,
      failedRequests: 0,
      successfulRequests: 0,
    };
    expect(() => diagnose(emptySummary, healthyHealth)).not.toThrow();
    const report = diagnose(emptySummary, healthyHealth);
    expect(report).toBeDefined();
  });
});

describe('diagnose type exports', () => {
  it('DiagnosticReport type is valid', () => {
    const report: DiagnosticReport = {
      insights: [],
      summary: 'No issues',
    };
    expect(report.summary).toBe('No issues');
  });

  it('DiagnosticInsight type is valid', () => {
    const insight: DiagnosticInsight = {
      type: 'bottleneck',
      severity: 'warning',
      title: 'Test insight',
      description: 'Test description',
      recommendation: 'Test recommendation',
    };
    expect(insight.type).toBe('bottleneck');
    expect(insight.severity).toBe('warning');
  });
});
