import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { initCommand, detectFramework } from '../src/commands/init';

describe('detectFramework', () => {
  it('detects Next.js', () => {
    expect(detectFramework({ dependencies: { next: '14.0.0' } })).toBe('nextjs');
  });

  it('detects NestJS', () => {
    expect(detectFramework({ dependencies: { '@nestjs/core': '10.0.0' } })).toBe('nestjs');
  });

  it('detects Express', () => {
    expect(detectFramework({ dependencies: { express: '4.18.0' } })).toBe('express');
  });

  it('detects Fastify', () => {
    expect(detectFramework({ dependencies: { fastify: '4.0.0' } })).toBe('fastify');
  });

  it('returns generic for unknown', () => {
    expect(detectFramework({ dependencies: { foo: '1.0.0' } })).toBe('generic');
  });

  it('checks devDependencies too', () => {
    expect(detectFramework({ devDependencies: { express: '4.18.0' } })).toBe('express');
  });
});

describe('initCommand', () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'loadcheck-init-'));
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates a loadcheck.config.js file', () => {
    const configPath = initCommand({ cwd: tmpDir });
    expect(configPath).toBe(path.join(tmpDir, 'loadcheck.config.js'));
    expect(fs.existsSync(configPath)).toBe(true);

    const content = fs.readFileSync(configPath, 'utf-8');
    expect(content).toContain('loadcheck.config.js');
    expect(content).toContain('steps');
    expect(content).toContain('auth_token');
    expect(content).toContain('{{auth_token}}');
  });

  it('throws if config already exists without --force', () => {
    expect(() => initCommand({ cwd: tmpDir })).toThrow(/already exists/);
  });

  it('overwrites with --force', () => {
    const configPath = path.join(tmpDir, 'loadcheck.config.js');
    initCommand({ cwd: tmpDir, force: true });
    expect(fs.existsSync(configPath)).toBe(true);
  });

  it('detects framework from package.json', () => {
    const pkgDir = fs.mkdtempSync(path.join(os.tmpdir(), 'loadcheck-pkg-'));
    fs.writeFileSync(path.join(pkgDir, 'package.json'), JSON.stringify({ dependencies: { next: '14.0.0' } }));
    const configPath = initCommand({ cwd: pkgDir });
    const content = fs.readFileSync(configPath, 'utf-8');
    expect(content).toContain('nextjs');
    fs.rmSync(pkgDir, { recursive: true, force: true });
  });
});
