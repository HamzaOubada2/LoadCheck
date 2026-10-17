# ADR 001: Load Model and Coordinated Omission

## Status
Accepted

## Context
LoadCheck needs to simulate concurrent virtual users generating load against a target URL. The core design decisions are:

1. **Closed vs. open load model** — how virtual users issue requests.
2. **Concurrency mechanism** — whether to use worker_threads for true parallelism.
3. **Latency recording** — how to capture request latencies without coordinated omission bias.

## Decision

### Closed load model (fixed concurrency)
LoadCheck uses a **closed load model**: a fixed number of virtual users (`--users`) each continuously loops, issuing GET requests back-to-back for the duration of the test. The next request from a user starts only after the previous one completes. This means:

- Concurrency is bounded by `--users`.
- Throughput emerges from the target's response time: `requests/sec ≈ users / avg_response_time`.
- The load naturally adapts to the target: slower responses reduce throughput, preventing runaway load on a struggling target.

An open model (fixed requests-per-second regardless of response time) was rejected because it can overwhelm an already-slow target and obscures the relationship between concurrency and latency.

### Multi-threading via `worker_threads`
Each virtual user runs inside a Worker thread (`worker_threads`). This provides:

- True parallelism across CPU cores for request issuance.
- Isolation so a slow event loop in one worker does not block others.
- The main thread coordinates workers, aggregates metrics, runs self-checks, and evaluates thresholds.

Workers report back raw results (durations, statuses, errors) to the main thread via `parentPort.postMessage`. The main thread merges per-worker HDR histograms into a single aggregate.

### HDR Histograms to prevent coordinated omission
Coordinated omission occurs when a load generator records only the latency of completed requests, ignoring the fact that slow responses delay subsequent requests. The recorded distribution then under-represents high latencies because "missing" requests are never sampled.

LoadCheck prevents this with **HDR histograms** (`hdr-histogram-js`):

- Each worker records every completed request latency into an HDR histogram.
- To correct coordinated omission, each user also tracks the *expected* interval between requests. If actual time exceeds the expected interval (because the target was slow), implicit samples at the expected interval are recorded for the omitted slots.
- HDR histograms provide high-fidelity percentiles (p50, p95, p99) with bounded memory, unlike sorting large arrays of raw durations.
- Per-worker histograms are merged on the main thread using `histogram.add(other)`.

## Consequences

### Positive
- Latency percentiles are accurate and not biased by coordinated omission.
- Worker threads scale request issuance across cores.
- Closed loop provides self-throttling load.

### Negative
- Worker threads add overhead; for very short tests, setup time may be noticeable.
- HDR histogram requires an external dependency (`hdr-histogram-js`).
- Cross-thread histogram merging requires serialization/deserialization of histogram state.

## References
- Gil Tene, "How NOT to measure latency" (coordinated omission)
- HDR Histogram: https://hdrhistogram.github.io/HdrHistogram/
