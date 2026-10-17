// loadcheck.config.flow.js
// Multi-step flow example with variable extraction.
//
// This demonstrates a realistic authenticated API flow:
//   1. GET /health  - warm up / health check
//   2. POST /login  - authenticate, extract JWT token from JSON body
//   3. GET /profile - use the extracted token in an Authorization header
//
// The {{token}} variable extracted in step 2 is interpolated into step 3.
//
// Usage:
//   npx loadcheck run --config examples/loadcheck.config.flow.js

export default {
  name: 'Authenticated API Flow Test',

  description:
    'Multi-step flow: login, extract token, access protected resource',

  users: 10,
  duration: 30,

  iOwnThis: false,

  steps: [
    {
      // Step 1: Health check (warm-up)
      method: 'GET',
      url: 'http://localhost:3000/health',
    },
    {
      // Step 2: Authenticate and extract a token for later steps
      method: 'POST',
      url: 'http://localhost:3000/login',
      headers: {
        'Content-Type': 'application/json',
      },
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
      // Step 3: Use the extracted token in a protected request
      method: 'GET',
      url: 'http://localhost:3000/profile',
      headers: {
        Authorization: 'Bearer {{auth_token}}',
      },
    },
  ],

  // Optional: ramp users up/down over time
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
