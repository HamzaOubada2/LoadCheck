export function getVersion(): string {
  return '0.0.1';
}

export function initLoadCheck(): string {
  return 'LoadCheck initialized successfully.';
}

export { runLoadTest, runLoadTestWithChecks } from './runner';
export { runFlowLoadTest, runFlowLoadTestWithChecks } from './flow-runner';
export { diagnose } from './diagnostics';
export type {
  RunOptions,
  RequestResult,
  LoadTestSummary,
  ThresholdConfig,
  ThresholdResult,
  HealthReport,
  DiagnosticSeverity,
  DiagnosticInsight,
  DiagnosticReport,
} from './types';
export type { ConfigStep } from './config';
export { validateSafety, SafetyError } from './safety';
export { LatencyHistogram } from './histogram';
export { checkGeneratorHealth } from './selfcheck';
export { evaluateThresholds } from './thresholds';
export { validateConfig, loadConfig, formatConfigError } from './config';
export type { LoadCheckConfig } from './config';
export { initCommand } from './commands/init';
export { doctorCommand, printDoctorReport } from './commands/doctor';
export { reportCommand } from './commands/report';
export { interpolate, extractVariable } from './flow-runner';
export {
  generateJsonReport,
  writeReport,
  readReport,
  buildReport,
  type TestReport,
  type ReportMetadata,
  type ReportConfig,
  REPORT_SCHEMA_VERSION,
} from './reports/json';
export { buildHtmlReport, writeHtmlReport } from './reports/html';
export { EXIT_SUCCESS, EXIT_THRESHOLD_FAILED, EXIT_CONFIG_ERROR, EXIT_SAFETY_BLOCK } from './cli';
