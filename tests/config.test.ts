import { describe, it, expect } from 'vitest';
import { validateConfig, loadConfig, formatConfigError } from '../src/config';

describe('validateConfig', () => {
  it('accepts a valid minimal config', () => {
    const config = validateConfig({
      steps: [
        { method: 'GET', url: 'http://localhost:3000/' },
      ],
    });
    expect(config.steps).toHaveLength(1);
    expect(config.users).toBe(10);
    expect(config.duration).toBe(10);
    expect(config.iOwnThis).toBe(false);
  });

  it('accepts a full config with stages and thresholds', () => {
    const config = validateConfig({
      name: 'Test',
      description: 'A test config',
      users: 50,
      duration: 60,
      iOwnThis: true,
      steps: [
        { method: 'POST', url: 'http://localhost:3000/login', body: JSON.stringify({ a: 1 }) },
        { method: 'GET', url: 'http://localhost:3000/profile', extract: [{ name: 'token', source: 'json', selector: 'token' }] },
      ],
      stages: [{ duration: 30, users: 25 }, { duration: 30, users: 50 }],
      thresholds: { p95Ms: 200, errorRatePercent: 1 },
    });
    expect(config.name).toBe('Test');
    expect(config.users).toBe(50);
    expect(config.stages).toHaveLength(2);
    expect(config.thresholds?.p95Ms).toBe(200);
  });

  it('rejects missing steps', () => {
    expect(() => validateConfig({ steps: [] })).toThrow();
  });

  it('rejects missing URL in step', () => {
    expect(() => validateConfig({ steps: [{ method: 'GET' }] as unknown as never })).toThrow();
  });

  it('rejects invalid method', () => {
    expect(() =>
      validateConfig({ steps: [{ method: 'INVALID', url: 'http://localhost/' }] as unknown as never }),
    ).toThrow();
  });

  it('rejects negative users', () => {
    expect(() =>
      validateConfig({ steps: [{ url: 'http://localhost/' }], users: -1 } as unknown as never),
    ).toThrow();
  });

  it('rejects invalid threshold values', () => {
    expect(() =>
      validateConfig({
        steps: [{ url: 'http://localhost/' }],
        thresholds: { errorRatePercent: 150 },
      } as unknown as never),
    ).toThrow();
  });

  it('formats validation errors into human-friendly messages', () => {
    try {
      validateConfig({ steps: [] } as unknown as never);
    } catch (err) {
      const msg = formatConfigError(err);
      expect(msg).toContain('Invalid loadcheck.config.js');
      expect(msg).toContain('steps');
    }
  });

  it('formats non-Zod errors as string', () => {
    const msg = formatConfigError(new Error('Something broke'));
    expect(msg).toContain('Something broke');
  });
});

describe('loadConfig', () => {
  it('rejects a missing config file', async () => {
    await expect(loadConfig('./nonexistent.config.js')).rejects.toThrow();
  });
});
