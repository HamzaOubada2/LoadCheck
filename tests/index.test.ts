import { describe, it, expect } from 'vitest';
import { getVersion, initLoadCheck } from '../src/index';

describe('getVersion', () => {
  it('returns the current version', () => {
    expect(getVersion()).toBe('0.0.1');
  });
});

describe('initLoadCheck', () => {
  it('returns the initialization message', () => {
    expect(initLoadCheck()).toBe('LoadCheck initialized successfully.');
  });
});
