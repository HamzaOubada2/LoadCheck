/**
 * Shared types for LoadCheck reports.
 */

import {
  LoadTestSummary,
  HealthReport,
  ThresholdResult,
  ThresholdConfig,
  DiagnosticReport,
} from '../types';
import { ConfigStep } from '../config';

export const REPORT_SCHEMA_VERSION = '1.0.0';

export interface ReportMetadata {
  version: string;
  generatedAt: string;
  tool: 'loadcheck';
  toolVersion: string;
}

export interface ReportConfig {
  url: string;
  users: number;
  duration: number;
  iOwnThis?: boolean;
  thresholdConfig?: ThresholdConfig;
  steps?: ConfigStep[];
}

export interface TestReport {
  metadata: ReportMetadata;
  config: ReportConfig;
  summary: LoadTestSummary;
  health: HealthReport;
  thresholds: ThresholdResult;
  diagnostics: DiagnosticReport;
  steps?: ConfigStep[];
}

export interface ReportOutputOptions {
  json?: string;
  html?: string;
  ci?: boolean;
}
