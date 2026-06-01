import type { Timestamp } from 'firebase/firestore';
import type { UserRole } from './roles';

/** Sala única del chat interno (estilo Telegram). */
export const CHAT_ROOM_ID = 'general';

/** Roles con acceso al chat interno. OPERARIO y CALIDAD quedan fuera. */
export const CHAT_ROLES: UserRole[] = ['ADMIN', 'SUPERADMIN', 'JEFE_SECCION', 'CARRETILLERO'];

/**
 * Mensaje del chat — `chat/general/messages/{messageId}`.
 * Escrito siempre por la Cloud Function `chatSendMessage` (serverTimestamp).
 */
export interface ChatMessage {
  id?: string;
  text: string;
  senderId: string;       // uid Firebase del emisor
  senderName: string;     // displayName del emisor
  senderRole: UserRole;
  timestamp: Timestamp | null;
  readBy: string[];       // uids que han leído el mensaje
}
