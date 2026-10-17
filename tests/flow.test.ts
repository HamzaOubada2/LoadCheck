import { describe, it, expect } from 'vitest';
import { interpolate, extractVariable } from '../src/flow-runner';

describe('interpolate', () => {
  it('replaces {{variable}} placeholders', () => {
    expect(interpolate('Bearer {{token}}', { token: 'abc123' })).toBe('Bearer abc123');
  });

  it('replaces multiple placeholders', () => {
    expect(interpolate('{{a}} and {{b}}', { a: '1', b: '2' })).toBe('1 and 2');
  });

  it('leaves unknown variables unchanged', () => {
    expect(interpolate('{{missing}}', {})).toBe('{{missing}}');
  });

  it('handles no placeholders', () => {
    expect(interpolate('plain string', {})).toBe('plain string');
  });

  it('handles empty template', () => {
    expect(interpolate('', {})).toBe('');
  });
});

describe('extractVariable', () => {
  it('extracts from a header', async () => {
    const response = new Response('body', {
      headers: { 'x-token': 'my-secret-token' },
    });
    const value = await extractVariable(response, { source: 'header', selector: 'x-token' });
    expect(value).toBe('my-secret-token');
  });

  it('returns null for missing header', async () => {
    const response = new Response('body', { headers: {} });
    const value = await extractVariable(response, { source: 'header', selector: 'x-missing' });
    expect(value).toBe(null);
  });

  it('extracts from JSON body', async () => {
    const response = new Response(JSON.stringify({ token: 'abc123', user: { id: 42 } }));
    const value = await extractVariable(response, { source: 'json', selector: 'token' });
    expect(value).toBe('abc123');
  });

  it('extracts nested JSON value', async () => {
    const response = new Response(JSON.stringify({ user: { id: 42 } }));
    const value = await extractVariable(response, { source: 'json', selector: 'user.id' });
    expect(value).toBe('42');
  });

  it('returns null for invalid JSON', async () => {
    const response = new Response('not json');
    const value = await extractVariable(response, { source: 'json', selector: 'token' });
    expect(value).toBe(null);
  });

  it('returns null for missing JSON path', async () => {
    const response = new Response(JSON.stringify({ other: 'value' }));
    const value = await extractVariable(response, { source: 'json', selector: 'missing' });
    expect(value).toBe(null);
  });
});
