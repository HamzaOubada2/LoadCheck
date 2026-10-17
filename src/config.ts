import { z, safeParse } from 'zod';

/**
 * Zod schema for loadcheck.config.js
 *
 * Supports:
 *  - Multi-step flows (sequential steps per virtual user)
 *  - Variable extraction from response headers/JSON body into {{var}} placeholders
 *  - Stages for ramping users up/down
 *  - Thresholds for pass/fail evaluation
 */

const StepVariableExtractionSchema = z.object({
  name: z.string().min(1, 'Variable name is required'),
  source: z.enum(['header', 'json']),
  selector: z.string().min(1, 'Selector is required'),
});

const StepSchema = z.object({
  method: z
    .enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'])
    .default('GET'),
  url: z.string().min(1, 'URL is required'),
  headers: z.record(z.string(), z.string()).optional(),
  body: z.string().optional(),
  extract: z.array(StepVariableExtractionSchema).optional(),
});

const StageSchema = z.object({
  duration: z.number().positive('Stage duration must be positive'),
  users: z.number().nonnegative('Stage users must be non-negative'),
});

const ThresholdSchema = z.object({
  p95Ms: z.number().positive().optional(),
  p99Ms: z.number().positive().optional(),
  errorRatePercent: z.number().min(0).max(100).optional(),
  minRequestsPerSecond: z.number().positive().optional(),
});

const ConfigSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  steps: z.array(StepSchema).min(1, 'At least one step is required'),
  stages: z.array(StageSchema).optional(),
  thresholds: ThresholdSchema.optional(),
  users: z.number().positive().default(10),
  duration: z.number().positive().default(10),
  iOwnThis: z.boolean().default(false),
});

export type LoadCheckConfig = z.infer<typeof ConfigSchema>;
export type ConfigStep = z.infer<typeof StepSchema>;
export type ConfigStage = z.infer<typeof StageSchema>;

/**
 * Validate a raw config object against the Zod schema.
 * Returns the parsed config on success, or throws a formatted error.
 */
export function validateConfig(raw: unknown): LoadCheckConfig {
  const result = safeParse(ConfigSchema, raw);
  if (!result.success) {
    const messages = result.error.issues.map((e) => {
      const path = e.path.length > 0 ? e.path.join('.') : 'root';
      return `  - ${path}: ${e.message}`;
    });
    throw new Error(`Invalid loadcheck.config.js:\n${messages.join('\n')}`);
  }
  return result.data;
}

/**
 * Load and validate a config file from disk.
 * Supports both ESM (.mjs) and CommonJS (.cjs / .js) formats.
 */
export async function loadConfig(configPath: string): Promise<LoadCheckConfig> {
  let raw: unknown;

  try {
    // Dynamic import handles both ESM and CJS
    const mod = await import(configPath);
    raw = mod.default ?? mod;
  } catch (err) {
    throw new Error(
      `Failed to load config file "${configPath}": ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  return validateConfig(raw);
}

/**
 * Format a Zod validation error into a human-friendly message.
 * Exported separately for use in tests and CLI.
 */
export function formatConfigError(err: unknown): string {
  if (err && typeof err === 'object' && 'issues' in err) {
    const issues = (err as { issues: Array<{ path: unknown[]; message: string }> }).issues;
    const messages = issues.map((e) => {
      const path = e.path.length > 0 ? e.path.join('.') : 'root';
      return `  - ${path}: ${e.message}`;
    });
    return `Invalid loadcheck.config.js:\n${messages.join('\n')}`;
  }
  return String(err);
}
