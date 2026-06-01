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

/**
 * Aviso fijado (urgencia) — `chat/general/pinned/{pinnedId}`.
 * Solo los 5 usuarios autorizados pueden crear/editar/eliminar.
 * Máximo uno por combinación (articleCode + orderId).
 */
export interface PinnedUrgency {
  id?: string;
  text: string;
  articleCode: string;    // código del artículo
  articleName?: string;   // nombre completo del artículo (opcional, para referencia)
  orderId: string;        // ID/número de la orden de fabricación
  orderNumber?: string;   // número legible de la OF (opcional)
  pinnedBy: string;       // uid del usuario que lo creó/modificó
  pinnedByName: string;   // displayName del usuario
  pinnedAt: Timestamp | null;
  updatedAt: Timestamp | null;
}
