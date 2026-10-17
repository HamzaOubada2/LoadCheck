/**
 * The `report` command for LoadCheck.
 *
 * Allows users to generate or re-export JSON/HTML reports from past
 * test execution logs or JSON outputs.
 */

import { readFileSync, existsSync } from 'fs';
import { writeReport, TestReport } from '../reports/json';
import { writeHtmlReport } from '../reports/html';
import { EXIT_SUCCESS, EXIT_CONFIG_ERROR } from '../cli';

export interface ReportCommandOptions {
  input?: string;   // Path to an existing JSON report to re-export
  json?: string;    // Output path for JSON report
  html?: string;    // Output path for HTML report
}

/**
 * Re-export a previously saved JSON report to new output formats.
 */
export function reportCommand(opts: ReportCommandOptions): void {
  let report: TestReport;

  if (opts.input) {
    if (!existsSync(opts.input)) {
      console.error(`Report file not found: ${opts.input}`);
      process.exit(EXIT_CONFIG_ERROR);
    }
    try {
      const raw = readFileSync(opts.input, 'utf-8');
      report = JSON.parse(raw) as TestReport;
    } catch (err) {
      console.error(
        `Failed to parse report file "${opts.input}": ${err instanceof Error ? err.message : String(err)}`,
      );
      process.exit(EXIT_CONFIG_ERROR);
    }
  } else {
    console.error('No input report specified. Use --input <path> to load a report.');
    process.exit(EXIT_CONFIG_ERROR);
  }

  let wroteAny = false;

  if (opts.json) {
    writeReport(report, opts.json);
    console.log(`JSON report written to ${opts.json}`);
    wroteAny = true;
  }

  if (opts.html) {
    writeHtmlReport(report, opts.html);
    console.log(`HTML report written to ${opts.html}`);
    wroteAny = true;
  }

  if (!wroteAny) {
    console.error('No output format specified. Use --json <path> and/or --html <path>.');
    process.exit(EXIT_CONFIG_ERROR);
  }

  process.exit(EXIT_SUCCESS);
}
