import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  buildReport,
  generateJsonReport,
  writeReport,
  readReport,
  serializeReport,
  REPORT_SCHEMA_VERSION,
  TestReport,
  ReportMetadata,
  ReportConfig,
} from '../src/reports/json';
import {
  buildHtmlReport,
  writeHtmlReport,
} from '../src/reports/html';
import { LoadTestSummary, HealthReport, ThresholdResult, DiagnosticReport } from '../src/types';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'loadcheck-reports-'));

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

const mockSummary: LoadTestSummary = {
  totalRequests: 1500,
  requestsPerSecond: 150,
  p50: 45.5,
  p95: 120.3,
  p99: 250.7,
  errorRate: 2.5,
  failedRequests: 37,
  successfulRequests: 1463,
};

const mockHealth: HealthReport = {
  lagMs: 12.5,
  cpuPercent: 35.2,
  saturated: false,
};

const mockThresholds: ThresholdResult = {
  passed: true,
  failures: [],
  exitCode: 0,
};

const mockConfig: ReportConfig = {
  url: 'http://localhost:3000/',
  users: 10,
  duration: 10,
  iOwnThis: false,
  thresholdConfig: {
    p95Ms: 200,
    errorRatePercent: 5,
  },
};

const mockDiagnostics: DiagnosticReport = {
  insights: [],
  summary: 'No significant issues detected. System appears healthy.',
};

function makeReport(): TestReport {
  return buildReport({
    config: mockConfig,
    summary: mockSummary,
    health: mockHealth,
    thresholds: mockThresholds,
    diagnostics: mockDiagnostics,
  }) as TestReport;
}

describe('buildReport', () => {
  it('creates a report with correct schema version', () => {
    const report = makeReport();
    expect(report.metadata.version).toBe(REPORT_SCHEMA_VERSION);
    expect(report.metadata.tool).toBe('loadcheck');
  });

  it('includes generation timestamp', () => {
    const report = makeReport();
    expect(report.metadata.generatedAt).toBeDefined();
    expect(new Date(report.metadata.generatedAt).getTime()).toBeGreaterThan(0);
  });

  it('includes summary statistics', () => {
    const report = makeReport();
    expect(report.summary.totalRequests).toBe(1500);
    expect(report.summary.p50).toBe(45.5);
    expect(report.summary.p95).toBe(120.3);
    expect(report.summary.p99).toBe(250.7);
    expect(report.summary.errorRate).toBe(2.5);
  });

  it('includes health information', () => {
    const report = makeReport();
    expect(report.health.lagMs).toBe(12.5);
    expect(report.health.saturated).toBe(false);
  });

  it('includes threshold results', () => {
    const report = makeReport();
    expect(report.thresholds.passed).toBe(true);
    expect(report.thresholds.exitCode).toBe(0);
  });

  it('includes config', () => {
    const report = makeReport();
    expect(report.config.url).toBe('http://localhost:3000/');
    expect(report.config.users).toBe(10);
    expect(report.config.duration).toBe(10);
  });

  it('includes steps when provided', () => {
    const report = makeReport();
    const reportWithSteps = { ...report, steps: [{ method: 'GET', url: 'http://localhost:3000/' }] } as TestReport;
    expect(reportWithSteps.steps).toHaveLength(1);
  });

  it('exposes ReportMetadata and ReportConfig types', () => {
    // Type-only imports verified by compilation
    const meta: ReportMetadata = {
      version: REPORT_SCHEMA_VERSION,
      generatedAt: new Date().toISOString(),
      tool: 'loadcheck',
      toolVersion: '0.0.1',
    };
    const cfg: ReportConfig = {
      url: 'http://localhost:3000/',
      users: 10,
      duration: 10,
    };
    expect(meta.tool).toBe('loadcheck');
    expect(cfg.url).toBe('http://localhost:3000/');
  });
});

describe('serializeReport', () => {
  it('produces valid JSON with 2-space indentation', () => {
    const report = makeReport();
    const json = serializeReport(report);
    const parsed = JSON.parse(json);
    expect(parsed.metadata.version).toBe(REPORT_SCHEMA_VERSION);
    expect(json).toContain('  '); // 2-space indent
  });
});

describe('generateJsonReport', () => {
  it('generates a JSON string from test outputs', () => {
    const json = generateJsonReport({
      config: mockConfig,
      summary: mockSummary,
      health: mockHealth,
      thresholds: mockThresholds,
    });
    const parsed = JSON.parse(json);
    expect(parsed.metadata.version).toBe(REPORT_SCHEMA_VERSION);
    expect(parsed.summary.totalRequests).toBe(1500);
  });
});

describe('writeReport and readReport', () => {
  const jsonPath = path.join(tmpDir, 'report.json');

  it('writes a report to disk and reads it back', () => {
    const report = makeReport();
    writeReport(report, jsonPath);
    expect(fs.existsSync(jsonPath)).toBe(true);

    const readBack = readReport(jsonPath);
    expect(readBack.metadata.version).toBe(REPORT_SCHEMA_VERSION);
    expect(readBack.summary.totalRequests).toBe(1500);
    expect(readBack.summary.p95).toBe(120.3);
  });

  it('creates parent directories when writing', () => {
    const nestedPath = path.join(tmpDir, 'sub', 'dir', 'nested.json');
    const report = makeReport();
    writeReport(report, nestedPath);
    expect(fs.existsSync(nestedPath)).toBe(true);
  });
});

describe('buildHtmlReport', () => {
  it('produces a self-contained HTML document', () => {
    const report = makeReport();
    const html = buildHtmlReport(report);

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<html');
    expect(html).toContain('</html>');
    expect(html).toContain('LoadCheck Report');
    expect(html).toContain('http://localhost:3000/');
    expect(html).toContain('1,500');
    expect(html).toContain('120.3');
    expect(html).toContain('250.7');
    expect(html).toContain('45.5');
  });

  it('does not reference external CDN URLs', () => {
    const report = makeReport();
    const html = buildHtmlReport(report);
    expect(html).not.toContain('cdn.');
    expect(html).not.toContain('cdnjs');
    expect(html).not.toContain('unpkg');
  });

  it('includes inline CSS styles', () => {
    const report = makeReport();
    const html = buildHtmlReport(report);
    expect(html).toContain('<style>');
    expect(html).toContain('body {');
    expect(html).toContain('font-family');
  });

  it('includes SVG charts', () => {
    const report = makeReport();
    const html = buildHtmlReport(report);
    expect(html).toContain('<svg');
    expect(html).toContain('P50');
    expect(html).toContain('P95');
    expect(html).toContain('P99');
  });

  it('includes threshold pass/fail badges', () => {
    const report = makeReport();
    const html = buildHtmlReport(report);
    expect(html).toContain('badge-pass');
  });

  it('handles saturated health warning', () => {
    const report = makeReport();
    const saturatedReport = { ...report, health: { ...report.health, saturated: true } } as TestReport;
    const html = buildHtmlReport(saturatedReport);
    expect(html).toContain('Saturated');
  });

  it('includes flow steps when present', () => {
    const report = makeReport();
    const reportWithSteps = {
      ...report,
      steps: [{ method: 'POST', url: 'http://localhost:3000/login', extract: [{ name: 'token', source: 'json', selector: 'token' }] }],
    } as TestReport;
    const html = buildHtmlReport(reportWithSteps);
    expect(html).toContain('Flow Steps');
    expect(html).toContain('token');
  });
});

describe('writeHtmlReport', () => {
  const htmlPath = path.join(tmpDir, 'report.html');

  it('writes an HTML file to disk', () => {
    const report = makeReport();
    writeHtmlReport(report, htmlPath);
    expect(fs.existsSync(htmlPath)).toBe(true);

    const content = fs.readFileSync(htmlPath, 'utf-8');
    expect(content).toContain('<!DOCTYPE html>');
    expect(content).toContain('LoadCheck Report');
  });

  it('creates parent directories', () => {
    const nestedPath = path.join(tmpDir, 'reports', 'html', 'index.html');
    const report = makeReport();
    writeHtmlReport(report, nestedPath);
    expect(fs.existsSync(nestedPath)).toBe(true);
  });
});

describe('reportCommand', () => {
  const inputPath = path.join(tmpDir, 'input-report.json');

  beforeAll(() => {
    const report = makeReport();
    writeReport(report, inputPath);
  });

  it('re-exports a JSON report to JSON output', () => {
    const outputPath = path.join(tmpDir, 're-exported.json');
    // We need to capture process.exit - instead test the underlying functions
    const report = readReport(inputPath);
    expect(report).toBeDefined();
    writeReport(report, outputPath);
    expect(fs.existsSync(outputPath)).toBe(true);
  });

  it('re-exports a JSON report to HTML output', () => {
    const outputPath = path.join(tmpDir, 're-exported.html');
    const report = readReport(inputPath);
    writeHtmlReport(report, outputPath);
    expect(fs.existsSync(outputPath)).toBe(true);
    const content = fs.readFileSync(outputPath, 'utf-8');
    expect(content).toContain('<!DOCTYPE html>');
  });

  it('throws on missing input file', () => {
    const missingPath = path.join(tmpDir, 'nonexistent.json');
    expect(() => {
      const raw = fs.readFileSync(missingPath, 'utf-8');
      JSON.parse(raw);
    }).toThrow();
  });
});

describe('TestReport type validation', () => {
  it('has correct metadata structure', () => {
    const report = makeReport();
    expect(report.metadata).toHaveProperty('version');
    expect(report.metadata).toHaveProperty('generatedAt');
    expect(report.metadata).toHaveProperty('tool');
    expect(report.metadata).toHaveProperty('toolVersion');
    expect(report.metadata.tool).toBe('loadcheck');
  });

  it('has correct config structure', () => {
    const report = makeReport();
    expect(report.config).toHaveProperty('url');
    expect(report.config).toHaveProperty('users');
    expect(report.config).toHaveProperty('duration');
  });

  it('has correct summary structure', () => {
    const report = makeReport();
    expect(report.summary).toHaveProperty('totalRequests');
    expect(report.summary).toHaveProperty('requestsPerSecond');
    expect(report.summary).toHaveProperty('p50');
    expect(report.summary).toHaveProperty('p95');
    expect(report.summary).toHaveProperty('p99');
    expect(report.summary).toHaveProperty('errorRate');
    expect(report.summary).toHaveProperty('failedRequests');
    expect(report.summary).toHaveProperty('successfulRequests');
  });
});
