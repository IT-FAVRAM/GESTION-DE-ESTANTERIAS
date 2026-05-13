import { describe, it, expect } from 'vitest';
import { DEFAULT_APP_CONFIG, type AppConfig } from './appConfig';

describe('DEFAULT_APP_CONFIG', () => {
  it('has no hardcoded email addresses (PII must live in Firestore only)', () => {
    expect(DEFAULT_APP_CONFIG.chiefMapping).toEqual({});
    expect(DEFAULT_APP_CONFIG.qualityEmails).toEqual([]);
  });

  it('provides sensible urgent location defaults', () => {
    expect(DEFAULT_APP_CONFIG.urgentLocations).toContain('CAL-031');
    expect(DEFAULT_APP_CONFIG.urgentLocations).toContain('CAL-034');
  });

  it('provides sensible tech-review location defaults', () => {
    expect(DEFAULT_APP_CONFIG.techReviewLocations).toContain('CAL-029');
    expect(DEFAULT_APP_CONFIG.techReviewLocations).toContain('CAL-032');
  });

  it('has a positive operarioRefreshInterval', () => {
    expect(DEFAULT_APP_CONFIG.operarioRefreshInterval).toBeGreaterThan(0);
  });

  it('all urgentLocations follow the locationId format (CODE-NNN)', () => {
    const locationIdRegex = /^[A-Z]+-\d+$/;
    DEFAULT_APP_CONFIG.urgentLocations.forEach((loc) => {
      expect(loc).toMatch(locationIdRegex);
    });
  });

  it('all techReviewLocations follow the locationId format (CODE-NNN)', () => {
    const locationIdRegex = /^[A-Z]+-\d+$/;
    DEFAULT_APP_CONFIG.techReviewLocations.forEach((loc) => {
      expect(loc).toMatch(locationIdRegex);
    });
  });
});

describe('AppConfig type completeness', () => {
  it('a full config object satisfies the AppConfig interface', () => {
    const full: AppConfig = {
      urgentLocations: ['CAL-031'],
      techReviewLocations: ['CAL-029'],
      chiefMapping: { MECANIZADO: ['jefe@test.com'] },
      qualityEmails: ['cal@test.com'],
      operarioRefreshInterval: 300000,
    };
    expect(full.chiefMapping.MECANIZADO).toHaveLength(1);
    expect(full.qualityEmails[0]).toBe('cal@test.com');
  });
});
