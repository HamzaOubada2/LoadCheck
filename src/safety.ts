import { RunOptions } from './types';

const MAX_USERS = 500;
const MAX_DURATION_SECONDS = 300;
const SAFETY_BLOCK_EXIT_CODE = 3;

export class SafetyError extends Error {
  public readonly exitCode: number;

  constructor(message: string, exitCode: number = SAFETY_BLOCK_EXIT_CODE) {
    super(message);
    this.name = 'SafetyError';
    this.exitCode = exitCode;
  }
}

function normalizeHostname(hostname: string): string {
  return hostname.replace(/\[/g, '').replace(/\]/g, '');
}

function isLocalhost(hostname: string): boolean {
  const host = normalizeHostname(hostname);
  return host === 'localhost' || host === '127.0.0.1' || host === '::1';
}

function isPrivateIP(hostname: string): boolean {
  const host = normalizeHostname(hostname);

  // 10.x.x.x
  if (/^10\./.test(host)) return true;
  // 192.168.x.x
  if (/^192\.168\./.test(host)) return true;
  // 172.16.x.x - 172.31.x.x
  if (/^172\.(1[6-9]|2[0-9]|3[01])\./.test(host)) return true;

  return false;
}

function isAllowedTarget(hostname: string): boolean {
  return isLocalhost(hostname) || isPrivateIP(hostname);
}

export function validateSafety(options: RunOptions): void {
  const { url, users, duration, iOwnThis } = options;

  if (users > MAX_USERS) {
    throw new SafetyError(
      `Safety block: users ${users} exceeds maximum of ${MAX_USERS}`,
    );
  }

  if (duration > MAX_DURATION_SECONDS) {
    throw new SafetyError(
      `Safety block: duration ${duration}s exceeds maximum of ${MAX_DURATION_SECONDS}s`,
    );
  }

  let hostname: string;
  try {
    hostname = new URL(url).hostname;
  } catch {
    throw new SafetyError(`Safety block: invalid URL: ${url}`);
  }

  const allowed = isAllowedTarget(hostname);

  if (!allowed && !iOwnThis) {
    throw new SafetyError(
      `Safety block: ${url} is not a local or private network address. ` +
        'Use --i-own-this to confirm you own this target.',
    );
  }
}

export { MAX_USERS, MAX_DURATION_SECONDS, SAFETY_BLOCK_EXIT_CODE };
