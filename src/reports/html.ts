/**
 * Self-contained interactive HTML report generator for LoadCheck.
 *
 * Produces a single standalone HTML file with inline CSS and embedded
 * SVG charts/tables. No external CDN dependencies. Designed for easy
 * sharing, viewing, and screenshot capture.
 */

import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { TestReport } from './types';

/**
 * Node-safe HTML escape (no DOM dependency).
 */
function escape(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Generate a simple SVG bar chart.
 */
function svgBarChart(
  labels: string[],
  values: number[],
  width = 400,
  height = 200,
): string {
  const max = Math.max(...values, 1);
  const barWidth = width / labels.length * 0.6;
  const gap = width / labels.length * 0.4;
  const chartTop = 40;
  const chartBottom = height - 30;

  const bars = labels
    .map((label, i) => {
      const barHeight = ((values[i] || 0) / max) * (chartBottom - chartTop);
      const x = i * (barWidth + gap) + gap / 2;
      const y = chartBottom - barHeight;
      return `<rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" fill="#4f46e5" rx="2" />`;
    })
    .join('');

  const axisLabels = labels
    .map((label, i) => {
      const x = i * (barWidth + gap) + gap / 2 + barWidth / 2;
      return `<text x="${x}" y="${chartBottom + 18}" text-anchor="middle" font-size="11" fill="#6b7280" font-family="system-ui, -apple-system, sans-serif">${escape(label)}</text>`;
    })
    .join('');

  const valueLabels = labels
    .map((label, i) => {
      const barHeight = ((values[i] || 0) / max) * (chartBottom - chartTop);
      const x = i * (barWidth + gap) + gap / 2 + barWidth / 2;
      const y = chartBottom - barHeight - 6;
      return `<text x="${x}" y="${y}" text-anchor="middle" font-size="10" fill="#4f46e5" font-family="system-ui, -apple-system, sans-serif" font-weight="600">${(values[i] || 0).toFixed(1)}</text>`;
    })
    .join('');

  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    ${bars}
    ${axisLabels}
    ${valueLabels}
    <line x1="0" y1="${chartBottom}" x2="${width}" y2="${chartBottom}" stroke="#9ca3af" stroke-width="1" />
  </svg>`;
}

/**
 * Generate a status badge (pass/fail/warning).
 */
function statusBadge(passed: boolean): string {
  const color = passed ? '#10b981' : '#ef4444';
  const bg = passed ? '#dcfce7' : '#fee2e2';
  const text = passed ? 'PASSED' : 'FAILED';
  return `<span style="display:inline-block;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:700;color:${color};background:${bg};text-transform:uppercase;letter-spacing:0.05em;">${text}</span>`;
}

/**
 * Build the full HTML document string from a TestReport.
 */
export function buildHtmlReport(report: TestReport): string {
  const { summary, health, thresholds, diagnostics, config, metadata, steps } = report;
  const thresholdConfig = config.thresholdConfig ?? {};

  const p95Color = summary.p95 <= (thresholdConfig.p95Ms ?? 500) ? '#10b981' : '#ef4444';
  const errorRateColor = summary.errorRate <= (thresholdConfig.errorRatePercent ?? 5) ? '#10b981' : '#ef4444';
  const rpsColor = summary.requestsPerSecond >= (thresholdConfig.minRequestsPerSecond ?? 0) ? '#10b981' : '#ef4444';

  const allPassed = thresholds.passed && !health.saturated;

  const latencyChart = svgBarChart(
    ['P50', 'P95', 'P99'],
    [summary.p50, summary.p95, summary.p99],
  );

  const statusChart = svgBarChart(
    ['Successful', 'Failed'],
    [summary.successfulRequests, summary.failedRequests],
  );

  const stepsHtml = steps && steps.length > 0
    ? `<div class="section">
      <h2>Flow Steps</h2>
      <table>
        <thead><tr><th>#</th><th>Method</th><th>URL</th><th>Extract</th></tr></thead>
        <tbody>
        ${steps
          .map(
            (s, i) => `<tr>
            <td>${i + 1}</td>
            <td><code>${escape(s.method)}</code></td>
            <td><code>${escape(s.url)}</code></td>
            <td>${s.extract?.length ? s.extract.map((e) => `${e.name}:${e.source}`).join(', ') : '—'}</td>
          </tr>`,
          )
          .join('')}
        </tbody>
      </table>
    </div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>LoadCheck Report — ${escape(config.url)}</title>
  <style>
    :root {
      --bg: #ffffff;
      --surface: #f8fafc;
      --border: #e2e8f0;
      --text: #0f172a;
      --muted: #64748b;
      --accent: #4f46e5;
      --pass: #10b981;
      --fail: #ef4444;
      --warn: #f59e0b;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--surface);
      color: var(--text);
      line-height: 1.5;
      padding: 24px;
    }
    .container { max-width: 900px; margin: 0 auto; background: var(--bg); border-radius: 12px; border: 1px solid var(--border); padding: 32px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05); }
    header { margin-bottom: 28px; border-bottom: 2px solid var(--border); padding-bottom: 16px; }
    h1 { font-size: 24px; font-weight: 700; letter-spacing: -0.02em; display: flex; align-items: center; gap: 12px; }
    h1 .dot { width: 8px; height: 8px; border-radius: 50%; background: ${allPassed ? 'var(--pass)' : 'var(--fail)'}; }
    h2 { font-size: 16px; font-weight: 600; margin: 24px 0 12px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; }
    .meta { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; font-size: 13px; color: var(--muted); margin-bottom: 24px; }
    .meta b { color: var(--text); font-size: 11px; text-transform: uppercase; display: block; margin-bottom: 4px; }
    .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 16px; margin-bottom: 28px; }
    .kpi { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 18px; }
    .kpi .label { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px; }
    .kpi .value { font-size: 26px; font-weight: 700; letter-spacing: -0.03em; }
    .kpi .sub { font-size: 12px; color: var(--muted); margin-top: 6px; }
    .charts { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-bottom: 28px; }
    .chart-card { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 16px; }
    .charts-title { font-size: 12px; font-weight: 600; color: var(--muted); text-transform: uppercase; margin-bottom: 10px; }
    table { width: 100%; border-collapse: collapse; background: var(--surface); border-radius: 10px; overflow: hidden; border: 1px solid var(--border); }
    th { background: #f1f5f9; text-align: left; padding: 10px 14px; font-size: 12px; font-weight: 600; color: var(--muted); border-bottom: 1px solid var(--border); }
    td { padding: 10px 14px; font-size: 13px; border-bottom: 1px solid var(--border); }
    tr:last-child td { border-bottom: none; }
    tr:hover td { background: #f8fafc; }
    code { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 12px; background: #f1f5f9; padding: 1px 6px; border-radius: 4px; color: var(--accent); }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
    .badge-pass { background: #dcfce7; color: #15803d; }
    .badge-fail { background: #fee2e2; color: #991b1b; }
    .badge-warn { background: #fef3c7; color: #92400e; }
    .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid var(--border); font-size: 11px; color: var(--muted); }
    .status-row { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
    .diagnostics { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 20px; margin-bottom: 20px; }
    .diagnostic-summary { font-size: 13px; font-weight: 600; color: var(--muted); margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid var(--border); }
    .diagnostic-item { margin-bottom: 16px; padding: 14px; border-radius: 8px; border: 1px solid var(--border); background: var(--bg); }
    .diagnostic-item.severity-critical { border-left: 4px solid var(--fail); background: #fef2f2; }
    .diagnostic-item.severity-warning { border-left: 4px solid var(--warn); background: #fffbeb; }
    .diagnostic-item.severity-info { border-left: 4px solid var(--accent); background: #f8fafc; }
    .diagnostic-header { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; flex-wrap: wrap; }
    .diagnostic-description { font-size: 13px; color: var(--text); margin-bottom: 8px; line-height: 1.5; }
    .diagnostic-recommendation { font-size: 12px; color: var(--muted); font-style: italic; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1><span class="dot"></span>LoadCheck Report</h1>
      <div class="meta">
        <div><b>Target</b>${escape(config.url)}</div>
        <div><b>Generated</b>${new Date(metadata.generatedAt).toLocaleString()}</div>
        <div><b>Schema</b>${metadata.version}</div>
        <div><b>Tool</b>${metadata.tool} v${metadata.toolVersion}</div>
      </div>
    </header>

    <div class="status-row">
      <strong>Overall Status:</strong>
      ${statusBadge(allPassed && thresholds.passed)}
      ${health.saturated ? '<span class="badge badge-warn">Generator Saturated</span>' : ''}
    </div>

    <div class="kpis">
      <div class="kpi">
        <div class="label">Total Requests</div>
        <div class="value">${summary.totalRequests.toLocaleString()}</div>
        <div class="sub">${summary.successfulRequests} successful · ${summary.failedRequests} failed</div>
      </div>
      <div class="kpi">
        <div class="label">Requests/sec</div>
        <div class="value" style="color:${rpsColor}">${summary.requestsPerSecond.toFixed(2)}</div>
        <div class="sub">over ${config.duration}s</div>
      </div>
      <div class="kpi">
        <div class="label">Error Rate</div>
        <div class="value" style="color:${errorRateColor}">${summary.errorRate.toFixed(2)}%</div>
        <div class="sub">${thresholdConfig.errorRatePercent !== undefined ? `limit: ${thresholdConfig.errorRatePercent}%` : '—'}</div>
      </div>
      <div class="kpi">
        <div class="label">P50 Latency</div>
        <div class="value">${summary.p50.toFixed(2)}ms</div>
        <div class="sub">median response time</div>
      </div>
      <div class="kpi">
        <div class="label">P95 Latency</div>
        <div class="value" style="color:${p95Color}">${summary.p95.toFixed(2)}ms</div>
        <div class="sub">${thresholdConfig.p95Ms !== undefined ? `limit: ${thresholdConfig.p95Ms}ms` : '—'}</div>
      </div>
      <div class="kpi">
        <div class="label">P99 Latency</div>
        <div class="value">${summary.p99.toFixed(2)}ms</div>
        <div class="sub">tail latency</div>
      </div>
    </div>

    <div class="charts">
      <div class="chart-card">
        <div class="charts-title">Latency Percentiles</div>
        ${latencyChart}
      </div>
      <div class="chart-card">
        <div class="charts-title">Request Outcomes</div>
        ${statusChart}
      </div>
    </div>

    <h2>Thresholds</h2>
    <table>
      <thead>
        <tr><th>Metric</th><th>Value</th><th>Threshold</th><th>Status</th></tr>
      </thead>
      <tbody>
        <tr>
          <td>P95 Latency</td>
          <td><code>${summary.p95.toFixed(2)}ms</code></td>
          <td>${thresholdConfig.p95Ms !== undefined ? `${thresholdConfig.p95Ms}ms` : '—'}</td>
          <td>${summary.p95 <= (thresholdConfig.p95Ms ?? Infinity) ? '<span class="badge badge-pass">Pass</span>' : '<span class="badge badge-fail">Fail</span>'}</td>
        </tr>
        <tr>
          <td>P99 Latency</td>
          <td><code>${summary.p99.toFixed(2)}ms</code></td>
          <td>${thresholdConfig.p99Ms !== undefined ? `${thresholdConfig.p99Ms}ms` : '—'}</td>
          <td>${summary.p99 <= (thresholdConfig.p99Ms ?? Infinity) ? '<span class="badge badge-pass">Pass</span>' : '<span class="badge badge-fail">Fail</span>'}</td>
        </tr>
        <tr>
          <td>Error Rate</td>
          <td><code>${summary.errorRate.toFixed(2)}%</code></td>
          <td>${thresholdConfig.errorRatePercent !== undefined ? `${thresholdConfig.errorRatePercent}%` : '—'}</td>
          <td>${summary.errorRate <= (thresholdConfig.errorRatePercent ?? 100) ? '<span class="badge badge-pass">Pass</span>' : '<span class="badge badge-fail">Fail</span>'}</td>
        </tr>
        <tr>
          <td>Requests/sec</td>
          <td><code>${summary.requestsPerSecond.toFixed(2)}</code></td>
          <td>${thresholdConfig.minRequestsPerSecond !== undefined ? thresholdConfig.minRequestsPerSecond : '—'}</td>
          <td>${summary.requestsPerSecond >= (thresholdConfig.minRequestsPerSecond ?? 0) ? '<span class="badge badge-pass">Pass</span>' : '<span class="badge badge-fail">Fail</span>'}</td>
        </tr>
      </tbody>
    </table>

    <h2>Generator Health</h2>
    <table>
      <thead><tr><th>Metric</th><th>Value</th><th>Status</th></tr></thead>
      <tbody>
        <tr>
          <td>Event-loop lag</td>
          <td><code>${health.lagMs.toFixed(1)}ms</code></td>
          <td>${health.saturated ? '<span class="badge badge-warn">Saturated</span>' : '<span class="badge badge-pass">Healthy</span>'}</td>
        </tr>
        <tr>
          <td>CPU usage</td>
          <td><code>${health.cpuPercent.toFixed(1)}%</code></td>
          <td>${health.saturated ? '<span class="badge badge-warn">High</span>' : '<span class="badge badge-pass">Normal</span>'}</td>
        </tr>
      </tbody>
    </table>

    ${stepsHtml}

    <h2>Diagnostic Insights &amp; Recommendations</h2>
    <div class="diagnostics">
      <div class="diagnostic-summary">${escape(diagnostics.summary)}</div>
      ${diagnostics.insights
        .map(
          (insight) => `
        <div class="diagnostic-item severity-${insight.severity}">
          <div class="diagnostic-header">
            <span class="badge ${insight.severity === 'critical' ? 'badge-fail' : insight.severity === 'warning' ? 'badge-warn' : 'badge-pass'}">${insight.severity.toUpperCase()}</span>
            <strong>${escape(insight.title)}</strong>
          </div>
          <div class="diagnostic-description">${escape(insight.description)}</div>
          <div class="diagnostic-recommendation"><strong>Recommendation:</strong> ${escape(insight.recommendation)}</div>
        </div>
        `,
        )
        .join('')}
    </div>

    <div class="footer">
      Generated by LoadCheck v${metadata.toolVersion} at ${new Date(metadata.generatedAt).toISOString()}.
      ${allPassed ? 'All checks passed.' : 'Some checks failed — review thresholds and generator health.'}
    </div>
  </div>
</body>
</html>`;
}

/**
 * Write an HTML report file to disk.
 */
export function writeHtmlReport(report: TestReport, outputPath: string): void {
  const dir = dirname(outputPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  const html = buildHtmlReport(report);
  writeFileSync(outputPath, html, 'utf-8');
}

export type { TestReport };
