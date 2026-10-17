export interface RunOptions {
  url: string;
  users: number;
  duration: number;
  iOwnThis?: boolean;
}

export interface RequestResult {
  durationMs: number;
  status: number;
  error?: string;
}

export interface LoadTestSummary {
  totalRequests: number;
  requestsPerSecond: number;
  p50: number;
  p95: number;
  p99: number;
  errorRate: number;
  failedRequests: number;
  successfulRequests: number;
}

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

export interface HealthReport {
  lagMs: number;
  cpuPercent: number;
  saturated: boolean;
}

export interface ConfigStep {
  method: string;
  url: string;
  headers?: Record<string, string>;
  body?: string;
  extract?: Array<{
    name: string;
    source: 'header' | 'json';
    selector: string;
  }>;
}

export type DiagnosticSeverity = 'info' | 'warning' | 'critical';

export interface DiagnosticInsight {
  type: 'bottleneck' | 'latency' | 'error' | 'health';
  severity: DiagnosticSeverity;
  title: string;
  description: string;
  recommendation: string;
}

export interface DiagnosticReport {
  insights: DiagnosticInsight[];
  summary: string;
}
