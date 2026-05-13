export interface AppConfig {
  urgentLocations: string[];
  techReviewLocations: string[];
  chiefMapping: Record<string, string[]>;
  qualityEmails: string[];
  operarioRefreshInterval: number;
}

export const DEFAULT_APP_CONFIG: AppConfig = {
  urgentLocations: ['CAL-031', 'CAL-034'],
  techReviewLocations: ['CAL-029', 'CAL-032'],
  chiefMapping: {
    MECANIZADO: ['h.juvera@favram.com'],
    PRENSAS: ['i.hernandez@favram.com'],
    PLEGADORA: ['v.torbellino@favram.com'],
    SOLDADURA: ['a.aguado@favram.com'],
    PINTURA: ['s.raboso@favram.com'],
    REPASADO: ['jc.rodriguez@favram.com'],
    LASER: ['d.fernandez@favram.com'],
  },
  qualityEmails: ['calidad@favram.com'],
  operarioRefreshInterval: 5 * 60 * 1000,
};
