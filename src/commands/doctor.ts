import * as os from 'os';
import * as fs from 'fs';
import { execSync } from 'child_process';

/**
 * System diagnostic report for LoadCheck.
 * Checks Node.js version, file descriptor limits, and system load/memory.
 */

export interface DoctorReport {
  nodeVersion: string;
  nodeMajor: number;
  nodeMeetsRequirement: boolean;
  platform: string;
  arch: string;
  cpus: number;
  totalMemoryGB: number;
  freeMemoryGB: number;
  loadAverage: number[];
  ulimit: number | null;
  ulimitOk: boolean;
  warnings: string[];
}

const MIN_NODE_MAJOR = 20;
const ULIMIT_WARNING_THRESHOLD = 1024;
const LOAD_WARNING_RATIO = 0.8; // warn if load > 80% of CPU count

/**
 * Attempt to read the file descriptor limit (ulimit -n).
 * Returns null if unavailable.
 */
function getUlimit(): number | null {
  try {
    // Soft limit via process.resourceUsage is not directly available for fds.
    // Try reading /proc/self/limits on Linux.
    if (process.platform === 'linux') {
      try {
        const limits = fs.readFileSync('/proc/self/limits', 'utf-8');
        const match = limits.match(/Max open files\s+(\d+)\s+\d+/);
        if (match) return parseInt(match[1], 10);
      } catch {
        // fall through
      }
    }

    // Fallback: try node:child_process `ulimit -n`
    try {
      const output = execSync('ulimit -n', { encoding: 'utf-8', timeout: 2000 });
      const val = parseInt(output.trim(), 10);
      if (!isNaN(val)) return val;
    } catch {
      // fall through
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * Run the doctor diagnostic and return a report.
 */
export function doctorCommand(): DoctorReport {
  const warnings: string[] = [];
  const nodeVersion = process.version;
  const nodeMajor = parseInt(process.version.replace(/^v/, '').split('.')[0], 10);
  const nodeMeetsRequirement = nodeMajor >= MIN_NODE_MAJOR;

  if (!nodeMeetsRequirement) {
    warnings.push(
      `Node.js ${nodeVersion} is below the recommended v${MIN_NODE_MAJOR}.x`,
    );
  }

  const cpus = os.cpus().length;
  const totalMemoryGB = (os.totalmem() / (1024 ** 3));
  const freeMemoryGB = (os.freemem() / (1024 ** 3));
  const loadAverage = os.loadavg();

  const ulimit = getUlimit();
  const ulimitOk = ulimit === null || ulimit >= ULIMIT_WARNING_THRESHOLD;

  if (ulimit === null) {
    warnings.push('Could not determine file descriptor limit (ulimit -n)');
  } else if (!ulimitOk) {
    warnings.push(
      `File descriptor limit (${ulimit}) is below ${ULIMIT_WARNING_THRESHOLD}; ` +
        'consider increasing it for high-concurrency tests.',
    );
  }

  const loadRatio = loadAverage[0] / cpus;
  if (loadRatio > LOAD_WARNING_RATIO) {
    warnings.push(
      `System load average (${loadAverage[0].toFixed(2)}) is high relative to CPU count (${cpus}); ` +
        'results may be affected by generator saturation.',
    );
  }

  if (freeMemoryGB < 0.5) {
    warnings.push(
      `Low free memory (${freeMemoryGB.toFixed(2)} GB); ` +
        'consider reducing concurrent users.',
    );
  }

  return {
    nodeVersion,
    nodeMajor,
    nodeMeetsRequirement,
    platform: process.platform,
    arch: process.arch,
    cpus,
    totalMemoryGB,
    freeMemoryGB,
    loadAverage,
    ulimit,
    ulimitOk,
    warnings,
  };
}

/**
 * Print a clean diagnostic report to the console.
 */
export function printDoctorReport(report: DoctorReport): void {
  console.log('\nLoadCheck Doctor');
  console.log('================\n');

  console.log(`Node.js:      ${report.nodeVersion} ${report.nodeMeetsRequirement ? '(ok)' : `(below v${MIN_NODE_MAJOR})`}`);
  console.log(`Platform:     ${report.platform} ${report.arch}`);
  console.log(`CPUs:         ${report.cpus}`);
  console.log(`Memory:       ${report.freeMemoryGB.toFixed(2)} GB free / ${report.totalMemoryGB.toFixed(2)} GB total`);
  console.log(`Load avg:     ${report.loadAverage.map((l) => l.toFixed(2)).join(', ')}`);
  console.log(`ULimit -n:    ${report.ulimit === null ? 'unknown' : report.ulimit} ${report.ulimitOk ? '(ok)' : '(low)'}`);

  if (report.warnings.length > 0) {
    console.log('\nWarnings:');
    for (const w of report.warnings) {
      console.log(`  - ${w}`);
    }
  } else {
    console.log('\nAll checks passed. System looks good for load testing.');
  }
  console.log('');
}
