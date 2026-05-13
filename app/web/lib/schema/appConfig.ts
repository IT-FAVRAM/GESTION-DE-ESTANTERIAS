export interface AppConfig {
  urgentLocations: string[];
  techReviewLocations: string[];
  chiefMapping: Record<string, string[]>;
  qualityEmails: string[];
  operarioRefreshInterval: number;
}

// Defaults used as fallback when the Firestore config document is unavailable.
// Email addresses are intentionally omitted — they live exclusively in Firestore
// and are never bundled into the client JS.
export const DEFAULT_APP_CONFIG: AppConfig = {
  urgentLocations: ['CAL-031', 'CAL-034'],
  techReviewLocations: ['CAL-029', 'CAL-032'],
  chiefMapping: {},
  qualityEmails: [],
  operarioRefreshInterval: 5 * 60 * 1000,
};
