import { describe, it, expect } from 'vitest';
import { LatencyHistogram } from '../src/histogram';

describe('LatencyHistogram', () => {
  it('records values and returns correct count', () => {
    const h = new LatencyHistogram();
    h.record(10);
    h.record(20);
    h.record(30);
    expect(h.getCount()).toBe(3);
  });

  it('returns percentiles for recorded values', () => {
    const h = new LatencyHistogram();
    for (let i = 1; i <= 100; i++) {
      h.record(i); // 1ms to 100ms
    }
    // p50 of 1..100 should be around 50
    const p50 = h.getPercentile(50);
    expect(p50).toBeGreaterThanOrEqual(40);
    expect(p50).toBeLessThanOrEqual(60);
    // p99 should be near 99
    const p99 = h.getPercentile(99);
    expect(p99).toBeGreaterThanOrEqual(90);
    expect(p99).toBeLessThanOrEqual(100);
  });

  it('returns 0 for empty histogram', () => {
    const h = new LatencyHistogram();
    expect(h.getPercentile(50)).toBe(0);
    expect(h.getCount()).toBe(0);
  });

  it('merges another histogram correctly', () => {
    const h1 = new LatencyHistogram();
    h1.record(10);
    h1.record(20);

    const h2 = new LatencyHistogram();
    h2.record(30);
    h2.record(40);

    h1.merge(h2);
    expect(h1.getCount()).toBe(4);
    const p50 = h1.getPercentile(50);
    expect(p50).toBeGreaterThanOrEqual(20);
    expect(p50).toBeLessThanOrEqual(30);
  });
});
