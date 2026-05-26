import type { UserRole } from './roles';
import type { WarehouseSection } from './sections';

export interface UserDoc {
  email: string;
  displayName: string;
  role: UserRole;
  section?: WarehouseSection;
  additionalSections?: WarehouseSection[];
  fcmTokens: string[];
  lastLoginAt?: string;
}


