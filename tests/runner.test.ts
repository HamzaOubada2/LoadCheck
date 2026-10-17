import { describe, it, expect } from 'vitest';
import { validateSafety, SafetyError } from '../src/safety';
import { LatencyHistogram } from '../src/histogram';
import { RunOptions } from '../src/types';

describe('Safety layer', () => {
  it('allows localhost URLs', () => {
    expect(() =>
      validateSafety({ url: 'http://localhost:3000/', users: 1, duration: 1 }),
    ).not.toThrow();
  });

  it('allows 127.0.0.1 URLs', () => {
    expect(() =>
      validateSafety({ url: 'http://127.0.0.1:3000/', users: 1, duration: 1 }),
    ).not.toThrow();
  });

  it('allows IPv6 loopback [::1]', () => {
    expect(() =>
      validateSafety({ url: 'http://[::1]:3000/', users: 1, duration: 1 }),
    ).not.toThrow();
  });

  it('allows private 10.x.x.x URLs', () => {
    expect(() =>
      validateSafety({ url: 'http://10.0.0.1/', users: 1, duration: 1 }),
    ).not.toThrow();
  });

  it('allows private 192.168.x.x URLs', () => {
    expect(() =>
      validateSafety({ url: 'http://192.168.1.1/', users: 1, duration: 1 }),
    ).not.toThrow();
  });

  it('allows private 172.16-31.x.x URLs', () => {
    expect(() =>
      validateSafety({ url: 'http://172.20.0.1/', users: 1, duration: 1 }),
    ).not.toThrow();
  });

  it('blocks public URLs without iOwnThis', () => {
    expect(() =>
      validateSafety({ url: 'https://example.com/', users: 1, duration: 1 }),
    ).toThrow(SafetyError);
  });

  it('allows public URLs with iOwnThis', () => {
    expect(() =>
      validateSafety({
        url: 'https://example.com/',
        users: 1,
        duration: 1,
        iOwnThis: true,
      }),
    ).not.toThrow();
  });

  it('blocks users over the hard cap', () => {
    expect(() =>
      validateSafety({ url: 'http://localhost/', users: 501, duration: 1 }),
    ).toThrow(SafetyError);
  });

  it('blocks duration over the hard cap', () => {
    expect(() =>
      validateSafety({ url: 'http://localhost/', users: 1, duration: 301 }),
    ).toThrow(SafetyError);
  });

  it('uses exit code 3 for safety blocks', () => {
    try {
      validateSafety({ url: 'https://example.com/', users: 1, duration: 1 });
    } catch (err) {
      expect((err as SafetyError).exitCode).toBe(3);
    }
  });
});

describe('LatencyHistogram aggregation', () => {
  it('merges multiple worker histograms into accurate percentiles', () => {
    const aggregate = new LatencyHistogram();

    // Simulate 3 workers each recording latencies
    for (const worker of [1, 2, 3]) {
      const h = new LatencyHistogram();
      for (let i = 1; i <= 100; i++) {
        h.record(i * worker); // spread values across workers
      }
      aggregate.merge(h);
    }

    expect(aggregate.getCount()).toBe(300);
    const p50 = aggregate.getPercentile(50);
    expect(p50).toBeGreaterThan(0);
    const p99 = aggregate.getPercentile(99);
    expect(p99).toBeGreaterThan(p50);
  });

  it('handles empty aggregation', () => {
    const aggregate = new LatencyHistogram();
    expect(aggregate.getCount()).toBe(0);
    expect(aggregate.getPercentile(50)).toBe(0);
    expect(aggregate.getPercentile(95)).toBe(0);
    expect(aggregate.getPercentile(99)).toBe(0);
  });
});

describe('RunOptions type validation', () => {
  it('accepts valid options', () => {
    const opts: RunOptions = {
      url: 'http://localhost:3000/',
      users: 10,
      duration: 30,
      iOwnThis: false,
    };
    expect(opts.url).toBe('http://localhost:3000/');
    expect(opts.users).toBe(10);
    expect(opts.duration).toBe(30);
  });

  it('accepts options without iOwnThis', () => {
    const opts: RunOptions = {
      url: 'http://localhost:3000/',
      users: 1,
      duration: 1,
    };
    expect(opts.iOwnThis).toBeUndefined();
  });
});
