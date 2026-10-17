import { describe, it, expect } from 'vitest';
import { doctorCommand, printDoctorReport } from '../src/commands/doctor';

describe('doctorCommand', () => {
  it('returns a valid report', () => {
    const report = doctorCommand();
    expect(report).toHaveProperty('nodeVersion');
    expect(report).toHaveProperty('nodeMajor');
    expect(report).toHaveProperty('nodeMeetsRequirement');
    expect(report).toHaveProperty('platform');
    expect(report).toHaveProperty('arch');
    expect(report).toHaveProperty('cpus');
    expect(report).toHaveProperty('totalMemoryGB');
    expect(report).toHaveProperty('freeMemoryGB');
    expect(report).toHaveProperty('loadAverage');
    expect(report).toHaveProperty('ulimit');
    expect(report).toHaveProperty('ulimitOk');
    expect(report).toHaveProperty('warnings');

    expect(typeof report.nodeVersion).toBe('string');
    expect(typeof report.nodeMajor).toBe('number');
    expect(typeof report.nodeMeetsRequirement).toBe('boolean');
    expect(typeof report.cpus).toBe('number');
    expect(report.cpus).toBeGreaterThan(0);
    expect(Array.isArray(report.loadAverage)).toBe(true);
    expect(report.loadAverage.length).toBe(3);
    expect(Array.isArray(report.warnings)).toBe(true);
  });

  it('meets Node.js requirement on this machine', () => {
    const report = doctorCommand();
    // Node >= 20 is required per engines field
    expect(report.nodeMajor).toBeGreaterThanOrEqual(20);
    expect(report.nodeMeetsRequirement).toBe(true);
  });

  it('prints a report without throwing', () => {
    expect(() => printDoctorReport(doctorCommand())).not.toThrow();
  });

  it('has valid ulimitOk type', () => {
    const report = doctorCommand();
    if (report.ulimit === null) {
      expect(report.ulimitOk).toBe(true);
    } else {
      expect(typeof report.ulimitOk).toBe('boolean');
    }
  });
});
