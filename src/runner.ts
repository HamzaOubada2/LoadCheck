import { Worker } from 'worker_threads';
import { LatencyHistogram } from './histogram';
import { checkGeneratorHealth } from './selfcheck';
import { evaluateThresholds } from './thresholds';
import { diagnose } from './diagnostics';
import {
  RunOptions,
  LoadTestSummary,
  ThresholdConfig,
  HealthReport,
  ThresholdResult,
  DiagnosticReport,
} from './types';
import { runFlowLoadTest } from './flow-runner';
import path from 'path';

const WORKER_FILE = path.join(__dirname, 'worker.js');

/**
 * Run a simple load test (single URL) using worker threads.
 * Integrates HDR histograms to avoid coordinated omission bias.
 */
export async function runLoadTest(
  options: RunOptions,
): Promise<LoadTestSummary> {
  const { url, users, duration } = options;
  const durationMs = duration * 1000;
  const workerCount = Math.min(users, 8);
  const usersPerWorker = Math.ceil(users / workerCount);

  const workerPromises: Promise<{
    workerIndex: number;
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    durations: number[];
  }>[] = [];

  for (let i = 0; i < workerCount; i++) {
    const p = new Promise<{
      workerIndex: number;
      totalRequests: number;
      successfulRequests: number;
      failedRequests: number;
      durations: number[];
    }>((resolve, reject) => {
      const w = new Worker(WORKER_FILE, {
        workerData: {
          url,
          users: usersPerWorker,
          durationMs,
          workerIndex: i,
        },
      });
      w.on('message', resolve);
      w.on('error', reject);
      w.on('exit', (code) => {
        if (code !== 0) {
          reject(new Error(`Worker exited with code ${code}`));
        }
      });
    });
    workerPromises.push(p);
  }

  const results = await Promise.all(workerPromises);

  const aggregate = new LatencyHistogram();
  let totalRequests = 0;
  let successfulRequests = 0;
  let failedRequests = 0;

  for (const r of results) {
    totalRequests += r.totalRequests;
    successfulRequests += r.successfulRequests;
    failedRequests += r.failedRequests;
    for (const d of r.durations) {
      aggregate.record(d);
    }
  }

  const errorRate = totalRequests === 0 ? 0 : (failedRequests / totalRequests) * 100;
  const requestsPerSecond = duration === 0 ? 0 : totalRequests / duration;

  return {
    totalRequests,
    requestsPerSecond,
    p50: aggregate.getPercentile(50),
    p95: aggregate.getPercentile(95),
    p99: aggregate.getPercentile(99),
    errorRate,
    failedRequests,
    successfulRequests,
  };
}

/**
 * Run a load test with safety checks, threshold evaluation, and diagnostics.
 */
export async function runLoadTestWithChecks(
  options: RunOptions,
  thresholds: ThresholdConfig,
): Promise<{
  summary: LoadTestSummary;
  health: HealthReport;
  thresholdResult: ThresholdResult;
  diagnostics: DiagnosticReport;
}> {
  const health = checkGeneratorHealth();
  const summary = await runLoadTest(options);
  const thresholdResult = evaluateThresholds(summary, thresholds);
  const diagnostics = diagnose(summary, health);

  return { summary, health, thresholdResult, diagnostics };
}

/**
 * Run a multi-step flow-based load test.
 * Each virtual user executes all steps sequentially with variable interpolation.
 */
export { runFlowLoadTest };

export type {
  RunOptions,
  LoadTestSummary,
  ThresholdConfig,
  HealthReport,
  ThresholdResult,
};
export type { ConfigStep } from './config';
