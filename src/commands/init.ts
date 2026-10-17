import * as fs from 'fs';
import * as path from 'path';

/**
 * Detect the project framework from package.json dependencies.
 */
export function detectFramework(pkg: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> }): string {
  const allDeps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };

  if (allDeps['next']) return 'nextjs';
  if (allDeps['@nestjs/core']) return 'nestjs';
  if (allDeps['express']) return 'express';
  if (allDeps['fastify']) return 'fastify';

  return 'generic';
}

/**
 * Generate a starter loadcheck.config.js content for the given framework.
 */
function generateConfig(framework: string): string {
  const base = `// loadcheck.config.js
// LoadCheck configuration file
// See docs for full schema reference

export default {
  // Human-readable name for this load test
  name: 'My Load Test',

  // Optional description
  description: 'Load test for {{framework}} application',

  // Global settings applied when no stages are defined
  users: 10,
  duration: 30,

  // Safety: set to true if testing a non-local/non-private target
  iOwnThis: false,

  // Multi-step flow: each virtual user executes steps in order
  steps: [
    {
      // Step 1: Health check
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
`;

  return base.replace(/{{framework}}/g, framework);
}

/**
 * Write a starter loadcheck.config.js based on the detected framework.
 * Returns the path to the written file.
 */
export function initCommand(options: { cwd?: string; force?: boolean } = {}): string {
  const cwd = options.cwd ?? process.cwd();
  const configPath = path.join(cwd, 'loadcheck.config.js');
  const pkgPath = path.join(cwd, 'package.json');

  let framework = 'generic';
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      framework = detectFramework(pkg);
    } catch {
      // Ignore malformed package.json, default to generic
    }
  }

  if (fs.existsSync(configPath) && !options.force) {
    throw new Error(
      `loadcheck.config.js already exists at ${configPath}. Use --force to overwrite.`,
    );
  }

  const content = generateConfig(framework);
  fs.writeFileSync(configPath, content, 'utf-8');

  return configPath;
}
