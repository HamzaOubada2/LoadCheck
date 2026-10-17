import { fetch, Response as UndiciResponse } from 'undici';
import { ConfigStep } from './config';
import {
  LoadTestSummary,
  HealthReport,
  ThresholdResult,
  ThresholdConfig,
  DiagnosticReport,
} from './types';
import { LatencyHistogram } from './histogram';
import { checkGeneratorHealth } from './selfcheck';
import { evaluateThresholds } from './thresholds';
import { diagnose } from './diagnostics';

const VARIABLE_REGEX = /\{\{([a-zA-Z0-9_]+)\}\}/g;

/**
 * Interpolate {{variable}} placeholders in a string using the provided variables map.
 */
export function interpolate(template: string, variables: Record<string, string>): string {
  return template.replace(VARIABLE_REGEX, (_match, key) => {
    return variables[key] !== undefined ? variables[key] : _match;
  });
}

/**
 * Extract a value from an HTTP response based on the extraction rule.
 * Supports 'header' and 'json' sources.
 */
export async function extractVariable(
  response: UndiciResponse,
  rule: { source: 'header' | 'json'; selector: string },
): Promise<string | null> {
  try {
    if (rule.source === 'header') {
      const value = response.headers.get(rule.selector);
      return value !== null ? value : null;
    }

    if (rule.source === 'json') {
      const body = await response.clone().json();
      const parts = rule.selector.split('.');
      let current: unknown = body;
      for (const part of parts) {
        if (current === null || current === undefined || typeof current !== 'object') {
          return null;
        }
        current = (current as Record<string, unknown>)[part];
      }
      return current !== null && current !== undefined ? String(current) : null;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Run a single virtual user through a sequence of steps.
 * Each step is executed in order. Variables extracted from earlier steps
 * are interpolated into later steps.
 */
async function runUserSteps(
  steps: ConfigStep[],
  variables: Record<string, string>,
): Promise<{ durations: number[]; statuses: number[]; errors: string[] }> {
  const durations: number[] = [];
  const statuses: number[] = [];
  const errors: string[] = [];

  const currentVariables = { ...variables };

  for (const step of steps) {
    const start = Date.now();
    const resolvedUrl = interpolate(step.url, currentVariables);
    const resolvedHeaders: Record<string, string> = {};
    for (const [k, v] of Object.entries(step.headers ?? {})) {
      resolvedHeaders[k] = interpolate(v, currentVariables);
    }
    const resolvedBody = step.body ? interpolate(step.body, currentVariables) : undefined;

    try {
      const response = await fetch(resolvedUrl, {
        method: step.method,
        headers: resolvedHeaders,
        body: resolvedBody,
      });

      const status = response.status;

      // Extract variables before consuming the body
      for (const extractRule of step.extract ?? []) {
        const value = await extractVariable(response, extractRule);
        if (value !== null) {
          currentVariables[extractRule.name] = value;
        }
      }

      // Consume the body to ensure the request completes
      if (response.body) {
        await response.body.cancel();
      }

      const durationMs = Date.now() - start;
      durations.push(durationMs);
      statuses.push(status);
    } catch (err) {
      const durationMs = Date.now() - start;
      durations.push(durationMs);
      statuses.push(0);
      errors.push(err instanceof Error ? err.message : String(err));
    }
  }

  return { durations, statuses, errors };
}

/**
 * Run a multi-step flow-based load test.
 * Each virtual user executes all steps sequentially.
 * Results are aggregated across all users into a single LoadTestSummary.
 */
export async function runFlowLoadTest(
  options: { users: number; duration: number; steps: ConfigStep[]; iOwnThis?: boolean },
): Promise<LoadTestSummary> {
  const { users, duration, steps } = options;
  const endTime = Date.now() + duration * 1000;

  const histogram = new LatencyHistogram();

  let totalRequests = 0;
  let successfulRequests = 0;
  let failedRequests = 0;

  const runUser = async (): Promise<void> => {
    const variables: Record<string, string> = {};
    while (Date.now() < endTime) {
      const { durations, statuses, errors } = await runUserSteps(steps, variables);

      for (let i = 0; i < durations.length; i++) {
        histogram.record(durations[i]);
        totalRequests++;
        const isSuccess = !errors[i] && statuses[i] >= 200 && statuses[i] < 400;
        if (isSuccess) {
          successfulRequests++;
        } else {
          failedRequests++;
        }
      }
    }
  };

  await Promise.all(Array.from({ length: users }, () => runUser()));

  const errorRate = totalRequests === 0 ? 0 : (failedRequests / totalRequests) * 100;
  const requestsPerSecond = duration === 0 ? 0 : totalRequests / duration;

  return {
    totalRequests,
    requestsPerSecond,
    p50: histogram.getPercentile(50),
    p95: histogram.getPercentile(95),
    p99: histogram.getPercentile(99),
    errorRate,
    failedRequests,
    successfulRequests,
  };
}

export { VARIABLE_REGEX, runUserSteps };

/**
 * Run a multi-step flow-based load test with safety checks, threshold
 * evaluation, and diagnostics.
 */
export async function runFlowLoadTestWithChecks(
  options: { users: number; duration: number; steps: ConfigStep[]; iOwnThis?: boolean },
  thresholds: ThresholdConfig,
): Promise<{
  summary: LoadTestSummary;
  health: HealthReport;
  thresholdResult: ThresholdResult;
  diagnostics: DiagnosticReport;
}> {
  const summary = await runFlowLoadTest(options);
  const health = checkGeneratorHealth();
  const thresholdResult = evaluateThresholds(summary, thresholds);
  const diagnostics = diagnose(summary, health);

  return { summary, health, thresholdResult, diagnostics };
}
