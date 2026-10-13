import * as functions from 'firebase-functions';
import { admin } from './firebaseAdmin';
import { requireAllowedRoles } from './authz';
import { getUsersByRole, sendPushToUsers } from './push';

// Roles con acceso al chat interno (OPERARIO y CALIDAD quedan fuera).
const CHAT_ROLES = ['ADMIN', 'SUPERADMIN', 'JEFE_SECCION', 'CARRETILLERO'];
const CHAT_ROOM_ID = 'general';
const MAX_MESSAGES = 200;
const MAX_TEXT_LENGTH = 2000;

/**
 * chatSendMessage — escribe un mensaje en `chat/general/messages` con serverTimestamp
 * y notifica por push a todos los participantes excepto al emisor. Mantiene la
 * subcolección recortada a los últimos MAX_MESSAGES mensajes.
 */
export const chatSendMessage = functions.https.onCall(async (data: any, context: any) => {
  const user = await requireAllowedRoles(context, CHAT_ROLES);

  const text = String(data?.text || '').trim();
  if (!text) {
    throw new functions.https.HttpsError('invalid-argument', 'El mensaje no puede estar vacío.');
  }
  if (text.length > MAX_TEXT_LENGTH) {
    throw new functions.https.HttpsError('invalid-argument', 'El mensaje es demasiado largo.');
  }

  const db = admin.firestore();

  // Resolver displayName del emisor desde su documento de usuario.
  let senderName = user.email || 'Usuario';
  try {
    const userDoc = await db.collection('usuarios').doc(user.uid).get();
    const displayName = userDoc.exists ? (userDoc.data() as any)?.displayName : null;
    if (displayName) senderName = String(displayName);
  } catch {
    /* no crítico: usamos email/uid como fallback */
  }

  const roomRef = db.collection('chat').doc(CHAT_ROOM_ID);
  const messagesRef = roomRef.collection('messages');

  // Asegurar que la sala existe (idempotente).
  await roomRef.set({ createdAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });

  const messageRef = await messagesRef.add({
    text,
    senderId: user.uid,
    senderName,
    senderRole: user.role,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
    readBy: [user.uid], // el emisor ya lo ha "leído"
  });

  // Push a los participantes del chat, excepto el emisor.
  try {
    const roleDocs = await Promise.all(CHAT_ROLES.map((role) => getUsersByRole(role)));
    const seen = new Set<string>();
    const recipients = roleDocs.flat().filter((doc) => {
      if (doc.id === user.uid || seen.has(doc.id)) return false;
      seen.add(doc.id);
      return true;
    });
    if (recipients.length > 0) {
      await sendPushToUsers(recipients, {
        title: senderName,
        body: text.slice(0, 80),
        data: { type: 'CHAT_MESSAGE', messageId: messageRef.id },
      });
    }
  } catch (err) {
    console.warn('[chatSendMessage] Error enviando push:', err);
  }

  // Limpieza: conservar únicamente los últimos MAX_MESSAGES mensajes.
  try {
    const overflow = await messagesRef
      .orderBy('timestamp', 'desc')
      .offset(MAX_MESSAGES)
      .limit(100)
      .get();
    if (!overflow.empty) {
      const batch = db.batch();
      overflow.docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
    }
  } catch (err) {
    console.warn('[chatSendMessage] Error en limpieza de mensajes:', err);
  }

  return { ok: true, messageId: messageRef.id };
});
