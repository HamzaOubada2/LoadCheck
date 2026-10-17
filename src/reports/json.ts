/**
 * Versioned JSON report generation for LoadCheck.
 *
 * Produces a structured, machine-readable JSON document suitable for
 * CI/CD consumption and artifact storage. The report includes a schema
 * version, generation metadata, full test configuration, summary
 * statistics (p50, p95, p99, RPS, error rate), health information,
 * applied thresholds, and pass/fail result.
 */

import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import {
  TestReport,
  ReportMetadata,
  ReportConfig,
  REPORT_SCHEMA_VERSION,
} from './types';
import { LoadTestSummary, HealthReport, ThresholdResult, DiagnosticReport } from '../types';
import { ConfigStep } from '../config';

/**
 * Build a complete TestReport from test results and configuration.
 */
export function buildReport({
  config,
  summary,
  health,
  thresholds,
  diagnostics,
  toolVersion = '0.0.1',
  steps,
}: {
  config: ReportConfig;
  summary: LoadTestSummary;
  health: HealthReport;
  thresholds: ThresholdResult;
  diagnostics: DiagnosticReport;
  toolVersion?: string;
  steps?: ConfigStep[];
}): TestReport {
  const metadata: ReportMetadata = {
    version: REPORT_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    tool: 'loadcheck',
    toolVersion,
  };

  return {
    metadata,
    config,
    summary,
    health,
    thresholds,
    diagnostics,
    ...(steps ? { steps } : {}),
  };
}

/**
 * Serialize a TestReport to a JSON string with 2-space indentation.
 */
export function serializeReport(report: TestReport): string {
  return JSON.stringify(report, null, 2);
}

/**
 * Write a TestReport to a JSON file at the given path.
 * Creates parent directories if they do not exist.
 */
export function writeReport(report: TestReport, outputPath: string): void {
  const dir = dirname(outputPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  const json = serializeReport(report);
  writeFileSync(outputPath, json, 'utf-8');
}

/**
 * Read a JSON report file from disk and parse it into a TestReport.
 */
import { readFileSync } from 'fs';

export function readReport(inputPath: string): TestReport {
  const raw = readFileSync(inputPath, 'utf-8');
  return JSON.parse(raw) as TestReport;
}

/**
 * Generate a complete JSON report string from test outputs.
 */
export function generateJsonReport({
  config,
  summary,
  health,
  thresholds,
  diagnostics,
  toolVersion,
  steps,
}: {
  config: ReportConfig;
  summary: LoadTestSummary;
  health: HealthReport;
  thresholds: ThresholdResult;
  diagnostics: DiagnosticReport;
  toolVersion?: string;
  steps?: ConfigStep[];
}): string {
  const report = buildReport({
    config,
    summary,
    health,
    thresholds,
    diagnostics,
    toolVersion,
    steps,
  });
  return serializeReport(report);
}

export type { TestReport, ReportMetadata, ReportConfig };
export { REPORT_SCHEMA_VERSION };
