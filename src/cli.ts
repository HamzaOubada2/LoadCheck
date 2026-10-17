import { Command } from 'commander';
import { validateSafety } from './safety';
import { runLoadTestWithChecks } from './runner';
import { runFlowLoadTestWithChecks } from './flow-runner';
import { loadConfig } from './config';
import { initCommand } from './commands/init';
import { doctorCommand, printDoctorReport } from './commands/doctor';
import { reportCommand } from './commands/report';
import { writeReport, TestReport } from './reports/json';
import { writeHtmlReport } from './reports/html';
import {
  RunOptions,
  ThresholdConfig,
  LoadTestSummary,
  HealthReport,
  ThresholdResult,
} from './types';
import { ConfigStep as ConfigStepType } from './config';

export const EXIT_SUCCESS = 0;
export const EXIT_THRESHOLD_FAILED = 1;
export const EXIT_CONFIG_ERROR = 2;
export const EXIT_SAFETY_BLOCK = 3;

interface FullResult {
  summary: LoadTestSummary;
  health: HealthReport;
  thresholdResult: ThresholdResult;
  diagnostics: import('./types').DiagnosticReport;
}

function printCiSummary(url: string, options: RunOptions, result: FullResult): void {
  const { summary, thresholdResult, diagnostics } = result;
  const criticalCount = diagnostics.insights.filter((i) => i.severity === 'critical').length;
  const warningCount = diagnostics.insights.filter((i) => i.severity === 'warning').length;
  console.log(
    `loadcheck run complete | url=${url} users=${options.users} duration=${options.duration}s ` +
      `total=${summary.totalRequests} rps=${summary.requestsPerSecond.toFixed(2)} ` +
      `p50=${summary.p50.toFixed(2)}ms p95=${summary.p95.toFixed(2)}ms p99=${summary.p99.toFixed(2)}ms ` +
      `errorRate=${summary.errorRate.toFixed(2)}% ` +
      `thresholds=${thresholdResult.passed ? 'passed' : 'failed'} ` +
      `diagnostics=${diagnostics.summary}`,
  );
  if (criticalCount > 0 || warningCount > 0) {
    console.log(
      `  diagnostics: ${criticalCount} critical, ${warningCount} warning(s) — ${diagnostics.summary}`,
    );
  }
}

function printSummary(url: string, options: RunOptions, result: FullResult): void {
  const { summary, health, thresholdResult } = result;

  console.log('\nLoadCheck Results');
  console.log('=================');
  console.log(`URL: ${url}`);
  console.log(`Users: ${options.users}`);
  console.log(`Duration: ${options.duration}s\n`);
  console.log(`Total Requests: ${summary.totalRequests}`);
  console.log(`Requests/sec:   ${summary.requestsPerSecond.toFixed(2)}`);
  console.log(`P50:            ${summary.p50.toFixed(2)}ms`);
  console.log(`P95:            ${summary.p95.toFixed(2)}ms`);
  console.log(`P99:            ${summary.p99.toFixed(2)}ms`);
  console.log(`Error Rate:     ${summary.errorRate.toFixed(2)}%`);
  console.log(`Successful:     ${summary.successfulRequests}`);
  console.log(`Failed:         ${summary.failedRequests}`);

  if (health.saturated) {
    console.warn(
      `\nWARNING: Generator saturated ` +
        `(lag ${health.lagMs.toFixed(1)}ms, ` +
        `CPU ${health.cpuPercent.toFixed(1)}%). ` +
        `Results may be inaccurate.\n`,
    );
  }

  if (thresholdResult.failures.length > 0) {
    console.log('\nThresholds: FAILED');
    for (const f of thresholdResult.failures) {
      console.log(`  - ${f}`);
    }
  } else {
    console.log('\nThresholds: PASSED');
  }

  // Diagnostic highlights
  const { diagnostics } = result;
  if (diagnostics.insights.length > 0) {
    console.log('\nDiagnostic Insights:');
    for (const insight of diagnostics.insights) {
      const sevLabel = insight.severity.toUpperCase();
      console.log(`  [${sevLabel}] ${insight.title}`);
      console.log(`    ${insight.description}`);
      console.log(`    → ${insight.recommendation}`);
    }
  }
  console.log('');
}

async function generateReports(
  result: FullResult,
  config: ReportConfig,
  opts: { json?: string; html?: string; ci?: boolean },
  steps?: ConfigStepType[],
): Promise<void> {
  const report: TestReport = buildTestReport(result, config, steps);

  if (opts.json) {
    writeReport(report, opts.json);
    if (!opts.ci) {
      console.log(`JSON report written to ${opts.json}`);
    }
  }

  if (opts.html) {
    writeHtmlReport(report, opts.html);
    if (!opts.ci) {
      console.log(`HTML report written to ${opts.html}`);
    }
  }
}

function buildTestReport(
  result: FullResult,
  config: ReportConfig,
  steps?: ConfigStepType[],
): TestReport {
  return {
    metadata: {
      version: '1.0.0',
      generatedAt: new Date().toISOString(),
      tool: 'loadcheck',
      toolVersion: '0.0.1',
    },
    config,
    summary: result.summary,
    health: result.health,
    thresholds: result.thresholdResult,
    diagnostics: result.diagnostics,
    ...(steps ? { steps } : {}),
  };
}

interface ReportConfig {
  url: string;
  users: number;
  duration: number;
  iOwnThis?: boolean;
  thresholdConfig?: ThresholdConfig;
  steps?: ConfigStepType[];
}

async function runFromConfig(
  configPath: string,
  opts: {
    users?: string;
    duration?: string;
    iOwnThis?: boolean;
    p95Ms?: string;
    p99Ms?: string;
    errorRate?: string;
    minRps?: string;
    output?: string;
    html?: string;
    ci?: boolean;
  },
): Promise<void> {
  let config;
  try {
    config = await loadConfig(configPath);
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(EXIT_CONFIG_ERROR);
  }

  const users = opts.users ? parseInt(opts.users, 10) : config.users;
  const duration = opts.duration ? parseInt(opts.duration, 10) : config.duration;
  const iOwnThis = opts.iOwnThis ?? config.iOwnThis;

  const thresholds: ThresholdConfig = {};
  if (opts.p95Ms) thresholds.p95Ms = parseFloat(opts.p95Ms);
  if (opts.p99Ms) thresholds.p99Ms = parseFloat(opts.p99Ms);
  if (opts.errorRate) thresholds.errorRatePercent = parseFloat(opts.errorRate);
  if (opts.minRps) thresholds.minRequestsPerSecond = parseFloat(opts.minRps);
  if (!thresholds.p95Ms && config.thresholds?.p95Ms) thresholds.p95Ms = config.thresholds.p95Ms;
  if (!thresholds.p99Ms && config.thresholds?.p99Ms) thresholds.p99Ms = config.thresholds.p99Ms;
  if (!thresholds.errorRatePercent && config.thresholds?.errorRatePercent) thresholds.errorRatePercent = config.thresholds.errorRatePercent;
  if (!thresholds.minRequestsPerSecond && config.thresholds?.minRequestsPerSecond) thresholds.minRequestsPerSecond = config.thresholds.minRequestsPerSecond;

  const runOptions: RunOptions = {
    url: config.steps[0]?.url ?? 'http://localhost/',
    users,
    duration,
    iOwnThis,
  };

  try {
    validateSafety(runOptions);

    let result: FullResult;
    if (config.steps && config.steps.length > 0) {
      const flowResult = await runFlowLoadTestWithChecks(
        {
          ...runOptions,
          steps: config.steps as unknown as ConfigStepType[],
        },
        thresholds,
      );
      result = flowResult;

      if (!opts.ci) {
        console.log('\nLoadCheck Flow Results');
        console.log('=======================');
        console.log(`Config: ${configPath}`);
        console.log(`Users: ${users}`);
        console.log(`Duration: ${duration}s\n`);
        console.log(`Total Requests: ${flowResult.summary.totalRequests}`);
        console.log(`Requests/sec:   ${flowResult.summary.requestsPerSecond.toFixed(2)}`);
        console.log(`P50:            ${flowResult.summary.p50.toFixed(2)}ms`);
        console.log(`P95:            ${flowResult.summary.p95.toFixed(2)}ms`);
        console.log(`P99:            ${flowResult.summary.p99.toFixed(2)}ms`);
        console.log(`Error Rate:     ${flowResult.summary.errorRate.toFixed(2)}%`);
        console.log(`Successful:     ${flowResult.summary.successfulRequests}`);
        console.log(`Failed:         ${flowResult.summary.failedRequests}`);

        if (flowResult.health.saturated) {
          console.warn(
            `\nWARNING: Generator saturated ` +
              `(lag ${flowResult.health.lagMs.toFixed(1)}ms, ` +
              `CPU ${flowResult.health.cpuPercent.toFixed(1)}%). ` +
              `Results may be inaccurate.\n`,
          );
        }

        if (flowResult.thresholdResult.failures.length > 0) {
          console.log('\nThresholds: FAILED');
          for (const f of flowResult.thresholdResult.failures) {
            console.log(`  - ${f}`);
          }
        } else {
          console.log('\nThresholds: PASSED');
        }

        // Diagnostic highlights
        const { diagnostics } = flowResult;
        if (diagnostics.insights.length > 0) {
          console.log('\nDiagnostic Insights:');
          for (const insight of diagnostics.insights) {
            const sevLabel = insight.severity.toUpperCase();
            console.log(`  [${sevLabel}] ${insight.title}`);
            console.log(`    ${insight.description}`);
            console.log(`    → ${insight.recommendation}`);
          }
        }
        console.log('');
      } else {
        printCiSummary(runOptions.url, runOptions, flowResult);
      }

      await generateReports(
        flowResult,
        {
          url: runOptions.url,
          users,
          duration,
          iOwnThis,
          thresholdConfig: thresholds,
          steps: config.steps,
        },
        { json: opts.output, html: opts.html, ci: opts.ci },
        config.steps as ConfigStepType[],
      );

      if (flowResult.thresholdResult.failures.length > 0) {
        process.exit(EXIT_THRESHOLD_FAILED);
      }
    } else {
      result = await runLoadTestWithChecks(runOptions, thresholds);

      if (!opts.ci) {
        printSummary(runOptions.url, runOptions, result);
      } else {
        printCiSummary(runOptions.url, runOptions, result);
      }

      await generateReports(
        result,
        {
          url: runOptions.url,
          users,
          duration,
          iOwnThis,
          thresholdConfig: thresholds,
        },
        { json: opts.output, html: opts.html, ci: opts.ci },
      );

      if (result.thresholdResult.failures.length > 0) {
        process.exit(EXIT_THRESHOLD_FAILED);
      }
    }

    process.exit(EXIT_SUCCESS);
  } catch (err) {
    const knownErr = err as unknown as { exitCode?: number };
    if (knownErr.exitCode !== undefined) {
      console.error(err instanceof Error ? err.message : String(err));
      process.exit(knownErr.exitCode);
    }
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(EXIT_CONFIG_ERROR);
  }
}

const program = new Command();

program
  .name('loadcheck')
  .description('Lightweight load testing tool')
  .version('0.0.1');

program
  .command('run <url>')
  .description('Run a load test against a target URL')
  .option('-u, --users <number>', 'Number of concurrent virtual users', '10')
  .option('-d, --duration <seconds>', 'Duration of the test in seconds', '10')
  .option('--i-own-this', 'Confirm you own the target (required for non-local/non-private URLs)')
  .option('--config <path>', 'Path to loadcheck.config.js for flow-based testing')
  .option('--output <path>', 'Write JSON report to <path>')
  .option('--html <path>', 'Write HTML report to <path>')
  .option('--ci', 'Non-interactive output for CI environments')
  .option('--p95-ms <number>', 'p95 latency threshold in milliseconds')
  .option('--p99-ms <number>', 'p99 latency threshold in milliseconds')
  .option('--error-rate <number>', 'Maximum allowed error rate percentage')
  .option('--min-rps <number>', 'Minimum requests per second')
  .action(async (url: string, opts: {
    users: string;
    duration: string;
    iOwnThis: boolean;
    config?: string;
    output?: string;
    html?: string;
    ci?: boolean;
    p95Ms?: string;
    p99Ms?: string;
    errorRate?: string;
    minRps?: string;
  }) => {
    if (opts.config) {
      await runFromConfig(opts.config, opts);
      return;
    }

    const thresholds: ThresholdConfig = {};
    if (opts.p95Ms) thresholds.p95Ms = parseFloat(opts.p95Ms);
    if (opts.p99Ms) thresholds.p99Ms = parseFloat(opts.p99Ms);
    if (opts.errorRate) thresholds.errorRatePercent = parseFloat(opts.errorRate);
    if (opts.minRps) thresholds.minRequestsPerSecond = parseFloat(opts.minRps);

    const runOptions: RunOptions = {
      url,
      users: parseInt(opts.users, 10),
      duration: parseInt(opts.duration, 10),
      iOwnThis: opts.iOwnThis,
    };

    try {
      validateSafety(runOptions);
      const result = await runLoadTestWithChecks(runOptions, thresholds);

      if (!opts.ci) {
        printSummary(url, runOptions, result);
      } else {
        printCiSummary(url, runOptions, result);
      }

      await generateReports(
        result,
        {
          url: runOptions.url,
          users: runOptions.users,
          duration: runOptions.duration,
          iOwnThis: runOptions.iOwnThis,
          thresholdConfig: thresholds,
        },
        { json: opts.output, html: opts.html, ci: opts.ci },
      );

      if (result.thresholdResult.failures.length > 0) {
        process.exit(EXIT_THRESHOLD_FAILED);
      }
      process.exit(EXIT_SUCCESS);
    } catch (err) {
      const knownErr = err as unknown as { exitCode?: number };
      if (knownErr.exitCode !== undefined) {
        console.error(err instanceof Error ? err.message : String(err));
        process.exit(knownErr.exitCode);
      }
      console.error(err instanceof Error ? err.message : String(err));
      process.exit(EXIT_CONFIG_ERROR);
    }
  });



program
  .command('init')
  .description('Generate a starter loadcheck.config.js')
  .option('--force', 'Overwrite existing config file')
  .action((opts: { force?: boolean }) => {
    try {
      const configPath = initCommand({ force: opts.force });
      console.log(`Created ${configPath}`);
      process.exit(EXIT_SUCCESS);
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      process.exit(EXIT_CONFIG_ERROR);
    }
  });

program
  .command('doctor')
  .description('Run system diagnostic checks')
  .action(() => {
    const report = doctorCommand();
    printDoctorReport(report);
    process.exit(EXIT_SUCCESS);
  });

program
  .command('report')
  .description('Generate or re-export JSON/HTML reports from a saved JSON report')
  .requiredOption('--input <path>', 'Path to an existing JSON report to load')
  .option('--json <path>', 'Write JSON report to <path>')
  .option('--html <path>', 'Write HTML report to <path>')
  .action((opts: { input: string; json?: string; html?: string }) => {
    reportCommand(opts);
  });

export async function runCli(): Promise<void> {
  await program.parseAsync(process.argv);
}

// Only auto-run when executed directly (not when imported by tests or bundlers)
const isMainModule =
  typeof require !== 'undefined' && require.main === module;

if (isMainModule) {
  runCli().catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(EXIT_CONFIG_ERROR);
  });
}
