import type { Timestamp } from 'firebase/firestore';
import type { UserRole } from './roles';

/** Sala única del chat interno (estilo Telegram). */
export const CHAT_ROOM_ID = 'general';

/** Roles con acceso al chat interno. OPERARIO y CALIDAD quedan fuera. */
export const CHAT_ROLES: UserRole[] = ['ADMIN', 'SUPERADMIN', 'JEFE_SECCION', 'CARRETILLERO'];

/** Roles seleccionables como participantes al crear una sala privada. */
export const SELECTABLE_MEMBER_ROLES: UserRole[] = ['JEFE_SECCION', 'CALIDAD', 'CARRETILLERO'];

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

/**
 * Sala de conversación privada — `conversations/{conversationId}`.
 * Creada exclusivamente por ADMIN/SUPERADMIN via Cloud Function `chatCreateConversation`.
 *
 * Seguridad Firestore:
 *  - Solo lectura: usuarios cuyo uid esté en `memberUids` (+ ADMIN/SUPERADMIN).
 *  - Escritura del documento raíz: denegada desde cliente (solo Cloud Functions).
 *  - Mensajes: solo miembros pueden crear/leer; update restringido al campo `readBy`.
 */
export interface Conversation {
  id?: string;
  name: string;
  createdBy: string;         // uid del ADMIN creador
  createdByName: string;
  createdAt: Timestamp | null;
  memberUids: string[];      // uids de todos los participantes (array-contains queries)
  memberRoles: Record<string, UserRole>;  // uid → role (para badges de UI)
  memberNames: Record<string, string>;    // uid → displayName (para cabeceras de UI)
  rolesAllowed: UserRole[];  // roles distintos presentes entre los miembros
  lastMessage?: string;      // preview del último mensaje (≤ 100 chars)
  lastMessageAt?: Timestamp | null;
}

/**
 * Mensaje en una sala privada — `conversations/{convId}/messages/{msgId}`.
 * Comparte estructura con ChatMessage; el tipo explícito documenta el contrato
 * de la subcolección y facilita refactorizaciones futuras.
 *
 * Restricciones de seguridad aplicadas en `firestore.rules`:
 *  - `senderId` debe coincidir con `request.auth.uid`.
 *  - `text`: 1–2000 caracteres.
 *  - `senderRole`: valor en la lista de roles válidos.
 *  - `readBy`: al crear, solo puede contener el uid del emisor.
 */
export type ConversationMessage = ChatMessage;

/** Estado posible de una alerta de urgencia. */
export type UrgentAlertStatus = 'active' | 'resolved';

/**
 * Alerta de urgencia independiente — `urgent_alerts/{alertId}`.
 * Solo ADMIN/SUPERADMIN pueden crear y resolver (vía Cloud Functions).
 * Lectura: todos los usuarios registrados y dispositivos validados.
 *
 * El campo `resolved` es la fuente de verdad del estado:
 *   false → activa (aparece en UrgentAlertsBar)
 *   true  → resuelta (filtrada; solo visible en histórico de admin)
 */
export interface UrgentAlert {
  id?: string;
  text: string;
  articleCode: string;
  articleName?: string;
  orderId: string;
  orderNumber?: string;
  createdBy: string;         // uid del ADMIN que la creó
  createdByName: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
  resolved: boolean;         // false = activa | true = resuelta
  resolvedAt: Timestamp | null;
  resolvedBy: string | null;
  resolvedByName: string | null;
}
