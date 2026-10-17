# LoadCheck

**Lightweight, safe-by-design load testing for Node.js applications.**

LoadCheck is a zero-config, developer-friendly load testing tool built for JavaScript and TypeScript teams. It lets you simulate concurrent virtual users against your API, measure latency percentiles (p50, p95, p99), track error rates, and enforce performance thresholds — all from a single CLI with no external dependencies beyond Node.js.

## Why LoadCheck?

| | LoadCheck | k6 / JMeter / Artillery |
|---|---|---|
| **Language** | JavaScript / TypeScript | Go / Java / JS (heavy runtimes) |
| **Install** | `npm install loadcheck` | Separate binary / large runtime |
| **Config** | Simple JS config file | DSL / JSON / script-heavy |
| **Safety** | Localhost/private-only by default | No built-in guardrails |
| **CI/CD** | Native JSON/HTML reports | Custom integration |
| **Bundle size** | Tiny (single dependency tree) | Heavy standalone binaries |

LoadCheck is designed to be **lighter and easier** for JS/TS developers who want load testing without leaving the npm ecosystem.

## Key Features

- **Zero-config quick start** — run `npx loadcheck` against any local URL
- **Multi-step flows** — sequential requests with variable extraction (`{{token}}`)
- **Safe by default** — only localhost and private IPs allowed unless you opt in
- **Hard caps** — max 500 users, max 300s duration to prevent accidents
- **HDR histograms** — accurate latency percentiles without coordinated omission
- **Worker threads** — true concurrent virtual users across CPU cores
- **Generator self-check** — warns if your own machine is saturated
- **JSON & HTML reports** — machine-readable for CI/CD, shareable for teams
- **Flexible exit codes** — 0 (success), 1 (threshold failed), 2 (config error), 3 (safety block)

## Installation

LoadCheck is published to npm:

```bash
npm install --save-dev loadcheck
```

Or use it directly without installing:

```bash
npx loadcheck run http://localhost:3000/health
```

## Quick Start

### 1. Initialize a config file

Detects your project framework (Next.js, NestJS, Express, Fastify) and writes a starter `loadcheck.config.js`:

```bash
npx loadcheck init
```

### 2. Run a load test

```bash
# Simple single-URL test
npx loadcheck run http://localhost:3000/health -u 20 -d 30

# With thresholds (exits 1 if breached)
npx loadcheck run http://localhost:3000/health --p95-ms 200 --error-rate 1

# From a config file (supports multi-step flows)
npx loadcheck run --config loadcheck.config.js

# Generate reports
npx loadcheck run --config loadcheck.config.js --output report.json --html report.html

# CI mode (clean, non-interactive output)
npx loadcheck run --config loadcheck.config.js --ci
```

### 3. Run system diagnostics

```bash
npx loadcheck doctor
```

Checks Node.js version, CPU, memory, load average, and file descriptor limits.

### 4. Re-export reports from past runs

```bash
npx loadcheck report --input report.json --html report.html
```

## CLI Reference

### `run <url>`

Run a load test against a target URL.

| Option | Description | Default |
|---|---|---|
| `-u, --users <n>` | Number of concurrent virtual users | `10` |
| `-d, --duration <s>` | Duration of the test in seconds | `10` |
| `--i-own-this` | Confirm you own a non-local/non-private target | `false` |
| `--config <path>` | Path to `loadcheck.config.js` for flow-based testing | — |
| `--output <path>` | Write JSON report to `<path>` | — |
| `--html <path>` | Write HTML report to `<path>` | — |
| `--ci` | Clean, non-interactive output for CI | `false` |
| `--p95-ms <n>` | p95 latency threshold (ms) | — |
| `--p99-ms <n>` | p99 latency threshold (ms) | — |
| `--error-rate <n>` | Max allowed error rate (%) | — |
| `--min-rps <n>` | Minimum requests per second | — |

### `init`

Generate a starter `loadcheck.config.js` based on your detected framework.

| Option | Description |
|---|---|
| `--force` | Overwrite existing config file |

### `doctor`

Run system diagnostic checks (Node version, CPUs, memory, load, ulimit).

### `report`

Generate or re-export JSON/HTML reports from a saved JSON report.

| Option | Description |
|---|---|
| `--input <path>` | Path to existing JSON report (required) |
| `--json <path>` | Write JSON report to `<path>` |
| `--html <path>` | Write HTML report to `<path>` |

## Configuration File (`loadcheck.config.js`)

LoadCheck supports ESM `.js` config files validated with Zod.

```js
export default {
  name: 'My Load Test',
  description: 'Load test for my application',

  users: 10,              // Concurrent virtual users
  duration: 30,           // Test duration in seconds
  iOwnThis: false,        // Set true for non-local/non-private targets

  // Multi-step flow: each virtual user executes steps in order
  steps: [
    {
      method: 'GET',
      url: 'http://localhost:3000/health',
    },
    {
      method: 'POST',
      url: 'http://localhost:3000/login',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'user', password: 'pass' }),
      extract: [
        {
          name: 'auth_token',
          source: 'json',
          selector: 'token',
        },
      ],
    },
    {
      method: 'GET',
      url: 'http://localhost:3000/profile',
      headers: { Authorization: 'Bearer {{auth_token}}' },
    },
  ],

  // Optional: ramp users up/down
  // stages: [
  //   { duration: 10, users: 5 },
  //   { duration: 20, users: 50 },
  //   { duration: 10, users: 10 },
  // ],

  // Optional: pass/fail thresholds
  // thresholds: {
  //   p95Ms: 200,
  //   p99Ms: 500,
  //   errorRatePercent: 1,
  //   minRequestsPerSecond: 10,
  // },
};
```

### Variable Extraction

Use `extract` to capture values from response headers or JSON bodies and interpolate them into later steps with `{{variable_name}}`:

- `source: 'header'` — reads a response header by name
- `source: 'json'` — reads a JSON path (supports dot notation, e.g. `user.id`)

## Exit Codes

| Code | Meaning |
|---|---|
| `0` | Success — all checks and thresholds passed |
| `1` | Threshold failed — performance thresholds breached |
| `2` | Configuration error — invalid config or CLI usage |
| `3` | Safety block — target not allowed without `--i-own-this`, or hard caps exceeded |

## Safety Model

LoadCheck is **safe by default**:

- Only `localhost`, `127.0.0.1`, `[::1]`, and private IP ranges (`10.x`, `192.168.x`, `172.16-31.x`) are allowed
- Public/external URLs require `--i-own-this` to confirm ownership
- Hard caps: max 500 concurrent users, max 300 seconds duration

These guardrails prevent accidental load generation against production or third-party services.

## Example Configs

See the `examples/` directory:

- `examples/loadcheck.config.basic.js` — simple single-endpoint test
- `examples/loadcheck.config.flow.js` — multi-step flow with token extraction

## Reports

LoadCheck generates two report formats:

- **JSON** (`--output report.json`) — machine-readable, ideal for CI/CD artifacts and dashboards
- **HTML** (`--html report.html`) — self-contained, interactive, shareable, screenshot-friendly

Reports include: total requests, requests/sec, p50/p95/p99 latency, error rate, generator health (event-loop lag, CPU), and threshold pass/fail status.

## CI/CD Integration

Add LoadCheck to your GitHub Actions or any CI pipeline:

```yaml
- run: npx loadcheck run --config loadcheck.config.js --ci --output report.json --html report.html
```

The `--ci` flag produces clean, single-line output. Exit code `1` will fail the step if thresholds are breached.

## License

MIT License
