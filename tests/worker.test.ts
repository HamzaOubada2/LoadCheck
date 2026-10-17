import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Worker } from 'worker_threads';
import * as http from 'http';
import { AddressInfo } from 'net';
import path from 'path';

const WORKER_FILE = path.join(__dirname, '..', 'dist', 'worker.js');

describe('Worker coordination', () => {
  let server: ReturnType<typeof http.createServer>;
  let port: number;

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('OK');
    });
    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        const addr = server.address() as AddressInfo;
        port = addr.port;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  it('worker returns results for a local endpoint', () => {
    return new Promise<void>((resolve, reject) => {
      const w = new Worker(WORKER_FILE, {
        workerData: {
          url: `http://localhost:${port}/`,
          users: 2,
          durationMs: 1000,
          workerIndex: 0,
        },
      });
      w.on('message', (msg: { workerIndex: number; totalRequests: number; successfulRequests: number; failedRequests: number; durations: number[] }) => {
        expect(msg.workerIndex).toBe(0);
        expect(msg.totalRequests).toBeGreaterThan(0);
        expect(msg.successfulRequests + msg.failedRequests).toBe(msg.totalRequests);
        expect(Array.isArray(msg.durations)).toBe(true);
        expect(msg.durations.length).toBe(msg.totalRequests);
        resolve();
      });
      w.on('error', reject);
    });
  });
});
