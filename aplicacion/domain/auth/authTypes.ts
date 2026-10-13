export type AuthMethod = 'guest' | 'email';

export type SessionKind = 'kiosk' | 'authenticated' | 'none';

export interface SessionCapabilities {
  canViewReprocessCosts: boolean;
  canEditReprocesses: boolean;
  canBrowseAllShelves: boolean;
  canOperateShelf: boolean;
  canAccessShelf: (shelfCode: string) => boolean;
  /** Puede gestionar fotos de ubicación (sección SOLDADURA). Gate grueso de sesión;
   *  la restricción fina por shelf/sección se aplica en la vista operativa. */
  canManagePhotos: boolean;
}


