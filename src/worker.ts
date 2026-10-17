import { parentPort, workerData } from 'worker_threads';
import { fetch } from 'undici';

export interface WorkerData {
  url: string;
  users: number;
  durationMs: number;
  workerIndex: number;
}

export interface WorkerResult {
  workerIndex: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  durations: number[];
}

const port = parentPort;
if (!port) {
  throw new Error('This module must be run inside a Worker thread.');
}

const { url, users, durationMs, workerIndex } = workerData as WorkerData;
const endTime = Date.now() + durationMs;

const durations: number[] = [];
let totalRequests = 0;
let successfulRequests = 0;
let failedRequests = 0;

async function runUser(): Promise<void> {
  while (Date.now() < endTime) {
    const start = Date.now();
    try {
      const response = await fetch(url);
      const status = response.status;
      const durationMs = Date.now() - start;
      durations.push(durationMs);

      totalRequests++;
      if (status >= 200 && status < 400) {
        successfulRequests++;
      } else {
        failedRequests++;
      }
    } catch (err) {
      const durationMs = Date.now() - start;
      durations.push(durationMs);
      totalRequests++;
      failedRequests++;
    }
  }
}

async function main(): Promise<void> {
  await Promise.all(Array.from({ length: users }, () => runUser()));

  const result: WorkerResult = {
    workerIndex,
    totalRequests,
    successfulRequests,
    failedRequests,
    durations,
  };

  port!.postMessage(result);
}

main().catch((err) => {
  port!.postMessage({ error: err instanceof Error ? err.message : String(err) });
});
