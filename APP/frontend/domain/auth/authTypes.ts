export type AuthMethod = 'guest' | 'email';

export type SessionKind = 'kiosk' | 'authenticated' | 'none';

export interface SessionCapabilities {
  canViewReprocessCosts: boolean;
  canEditReprocesses: boolean;
  canBrowseAllShelves: boolean;
  canOperateShelf: boolean;
  canAccessShelf: (shelfCode: string) => boolean;
}


