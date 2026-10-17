import { build, Histogram } from 'hdr-histogram-js';

/**
 * LatencyHistogram wraps hdr-histogram-js to record request latencies
 * without coordinated omission bias.
 *
 * Coordinated omission occurs when a load generator only records the
 * latency of completed requests, ignoring the fact that slow responses
 * delay subsequent requests. To correct this, each virtual user tracks
 * the expected interval between requests; when actual time exceeds that
 * interval, implicit samples at the expected interval are recorded for
 * the omitted slots via `recordValueWithExpectedInterval`.
 *
 * Per-worker histograms are merged on the main thread using `add()`,
 * which applies post-recording coordinated omission correction.
 */
export class LatencyHistogram {
  private histogram: Histogram;

  constructor() {
    // Min 1 ms, max ~1 hour, 3 significant figures for percentile precision
    this.histogram = build();
  }

  /** Record a completed request latency. */
  record(valueMs: number): void {
    this.histogram.recordValue(valueMs);
  }

  /**
   * Record a value with coordinated-omission correction using the expected
   * interval between samples.
   */
  recordWithExpectedInterval(valueMs: number, expectedIntervalMs: number): void {
    this.histogram.recordValueWithExpectedInterval(valueMs, expectedIntervalMs);
  }

  /** Merge another LatencyHistogram into this one. */
  merge(other: LatencyHistogram): void {
    this.histogram.add(other.histogram);
  }

  /** Get the value at the given percentile (0-100). */
  getPercentile(p: number): number {
    return this.histogram.getValueAtPercentile(p);
  }

  /** Total number of recorded values. */
  getCount(): number {
    return this.histogram.totalCount;
  }
}
