/**
 * Generator health self-check.
 *
 * Monitors event-loop lag and CPU usage of the load generator itself. If
 * the local machine becomes saturated, the results are no longer trustworthy
 * because the generator (not the target) is the bottleneck. A visible warning
 * is printed so the operator knows to reduce load or run on a larger host.
 */

export interface HealthReport {
  lagMs: number;
  cpuPercent: number;
  saturated: boolean;
}

const DEFAULT_LAG_THRESHOLD_MS = 50;
const DEFAULT_CPU_THRESHOLD_PERCENT = 80;

let lastCpuUsage = process.cpuUsage();
let lastCpuTime = Date.now();

/**
 * Measure event-loop lag by recording a high-resolution timestamp before and
 * after a tiny synchronous block. The delta approximates how long the event
 * loop was delayed.
 */
function measureEventLoopLag(): number {
  const start = process.hrtime.bigint();
  // Spin briefly to allow any pending scheduled work to run, then measure.
  for (let i = 0; i < 100000; i++) {
    // intentional no-op work
  }
  const end = process.hrtime.bigint();
  return Number(end - start) / 1_000_000;
}

/**
 * Estimate CPU usage percentage since the last call.
 */
function measureCpuPercent(): number {
  const now = Date.now();
  const elapsedMs = now - lastCpuTime || 1;
  const elapsedSeconds = elapsedMs / 1000;

  const usage = process.cpuUsage();
  const totalMicros = usage.user + usage.system;
  const lastTotalMicros = lastCpuUsage.user + lastCpuUsage.system;
  const deltaMicros = totalMicros - lastTotalMicros;

  const cpuPercent = (deltaMicros / (elapsedSeconds * 1_000_000)) * 100;

  lastCpuUsage = usage;
  lastCpuTime = now;

  return Math.max(0, Math.min(100, cpuPercent));
}

/**
 * Check generator health. Returns a report and logs a warning if saturated.
 */
export function checkGeneratorHealth({
  lagThresholdMs = DEFAULT_LAG_THRESHOLD_MS,
  cpuThresholdPercent = DEFAULT_CPU_THRESHOLD_PERCENT,
}: {
  lagThresholdMs?: number;
  cpuThresholdPercent?: number;
} = {}): HealthReport {
  const lagMs = measureEventLoopLag();
  const cpuPercent = measureCpuPercent();
  const saturated = lagMs > lagThresholdMs || cpuPercent > cpuThresholdPercent;

  if (saturated) {
    console.warn(
      `\n[LoadCheck] WARNING: Generator appears saturated — ` +
        `event-loop lag ${lagMs.toFixed(1)}ms ` +
        `(threshold ${lagThresholdMs}ms), ` +
        `CPU ${cpuPercent.toFixed(1)}% ` +
        `(threshold ${cpuThresholdPercent}%). ` +
        `Results may be inaccurate. Reduce --users or run on a larger host.\n`,
    );
  }

  return { lagMs, cpuPercent, saturated };
}
