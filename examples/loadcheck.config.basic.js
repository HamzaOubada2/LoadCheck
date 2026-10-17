// loadcheck.config.basic.js
// Basic single-endpoint load test configuration.
//
// Usage:
//   npx loadcheck run --config examples/loadcheck.config.basic.js
//
// Or with overrides:
//   npx loadcheck run --config examples/loadcheck.config.basic.js -u 50 -d 60

export default {
  // Human-readable name for this load test
  name: 'Basic API Load Test',

  // Optional description
  description: 'Simple load test against a single health endpoint',

  // Global settings applied when no stages are defined
  users: 10,
  duration: 30,

  // Safety: set to true if testing a non-local/non-private target
  iOwnThis: false,

  // Single-step flow: each virtual user hits this URL repeatedly
  steps: [
    {
      method: 'GET',
      url: 'http://localhost:3000/health',
    },
  ],

  // Optional: ramp users up/down over time
  // stages: [
  //   { duration: 10, users: 5 },
  //   { duration: 20, users: 50 },
  //   { duration: 10, users: 10 },
  // ],

  // Optional: pass/fail thresholds (exit code 1 if breached)
  // thresholds: {
  //   p95Ms: 200,
  //   p99Ms: 500,
  //   errorRatePercent: 1,
  //   minRequestsPerSecond: 10,
  // },
};
