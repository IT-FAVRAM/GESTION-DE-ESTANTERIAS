import * as functions from 'firebase-functions';
import { admin } from './firebaseAdmin';
import { requireAllowedRoles, getUserContext } from './authz';
import { sendPushToUsers } from './push';

const ADMIN_ROLES = ['ADMIN', 'SUPERADMIN'];
const MAX_MESSAGES = 200;
const MAX_TEXT_LENGTH = 2000;
const MAX_MEMBERS = 30;

/**
 * chatCreateConversation — crea una sala de conversación privada.
 * Solo ADMIN/SUPERADMIN pueden crear salas. Resuelve nombres y roles de cada uid.
 */
export const chatCreateConversation = functions.https.onCall(
  async (data: { name: string; memberUids: string[] }, context) => {
    const creator = await requireAllowedRoles(context, ADMIN_ROLES);

    const name = String(data?.name || '').trim();
    if (!name || name.length > 80) {
      throw new functions.https.HttpsError('invalid-argument', 'El nombre de la sala es obligatorio (máx 80 chars).');
    }

    const rawMemberUids: string[] = Array.isArray(data?.memberUids) ? data.memberUids : [];
    const uniqueUids = [...new Set([creator.uid, ...rawMemberUids.filter((u) => typeof u === 'string' && u.trim())])];

    if (uniqueUids.length > MAX_MEMBERS) {
      throw new functions.https.HttpsError('invalid-argument', `Máximo ${MAX_MEMBERS} participantes por sala.`);
    }

    const db = admin.firestore();

    // Resolver displayName y role de cada miembro desde `usuarios`
    const userDocs = await Promise.all(
      uniqueUids.map((uid) => db.collection('usuarios').doc(uid).get()),
    );

    const memberNames: Record<string, string> = {};
    const memberRoles: Record<string, string> = {};

    userDocs.forEach((docSnap) => {
      if (!docSnap.exists) return;
      const d = docSnap.data() as { displayName?: string; role?: string };
      memberNames[docSnap.id] = d.displayName || docSnap.id;
      memberRoles[docSnap.id] = d.role || '';
    });

    // Roles distintos presentes entre los miembros (para consultas y UI)
    const rolesAllowed = [...new Set(Object.values(memberRoles).filter(Boolean))];

    // Resolver el nombre del creador para el campo `createdByName`
    let creatorName = creator.email || creator.uid;
    try {
      const creatorDoc = await db.collection('usuarios').doc(creator.uid).get();
      const dn = creatorDoc.exists ? (creatorDoc.data() as any)?.displayName : null;
      if (dn) creatorName = String(dn);
    } catch {
      /* fallback a email */
    }

    const conversationRef = db.collection('conversations').doc();
    await conversationRef.set({
      name,
      createdBy: creator.uid,
      createdByName: creatorName,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      memberUids: uniqueUids,
      memberNames,
      memberRoles,
      rolesAllowed,
      lastMessage: '',
      lastMessageAt: null,
    });

    return { ok: true, conversationId: conversationRef.id };
  },
);

/**
 * chatSendConversationMessage — escribe un mensaje en una sala privada.
 * Solo los miembros de la sala pueden enviar mensajes.
 */
export const chatSendConversationMessage = functions.https.onCall(
  async (data: { conversationId: string; text: string }, context) => {
    const user = await getUserContext(context);

    const conversationId = String(data?.conversationId || '').trim();
    if (!conversationId) {
      throw new functions.https.HttpsError('invalid-argument', 'conversationId es obligatorio.');
    }

    const text = String(data?.text || '').trim();
    if (!text) {
      throw new functions.https.HttpsError('invalid-argument', 'El mensaje no puede estar vacío.');
    }
    if (text.length > MAX_TEXT_LENGTH) {
      throw new functions.https.HttpsError('invalid-argument', 'El mensaje es demasiado largo.');
    }

    const db = admin.firestore();
    const convRef = db.collection('conversations').doc(conversationId);
    const convSnap = await convRef.get();

    if (!convSnap.exists) {
      throw new functions.https.HttpsError('not-found', 'Sala de conversación no encontrada.');
    }

    const convData = convSnap.data() as { memberUids?: string[]; memberNames?: Record<string, string> };
    const memberUids: string[] = convData.memberUids || [];

    if (!memberUids.includes(user.uid)) {
      throw new functions.https.HttpsError('permission-denied', 'No eres miembro de esta sala.');
    }

    // Resolver displayName del emisor
    let senderName = user.email || user.uid;
    try {
      const userDoc = await db.collection('usuarios').doc(user.uid).get();
      const dn = userDoc.exists ? (userDoc.data() as any)?.displayName : null;
      if (dn) senderName = String(dn);
    } catch {
      /* fallback */
    }

    const messagesRef = convRef.collection('messages');

    const messageRef = await messagesRef.add({
      text,
      senderId: user.uid,
      senderName,
      senderRole: user.role,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      readBy: [user.uid],
    });

    // Actualizar lastMessage / lastMessageAt en el documento padre
    await convRef.update({
      lastMessage: text.slice(0, 100),
      lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Push a los demás miembros de la sala
    try {
      const otherUids = memberUids.filter((uid) => uid !== user.uid);
      if (otherUids.length > 0) {
        const recipientDocs = await Promise.all(
          otherUids.map((uid) => db.collection('usuarios').doc(uid).get()),
        );
        const recipients = recipientDocs.filter((d) => d.exists) as FirebaseFirestore.QueryDocumentSnapshot[];
        if (recipients.length > 0) {
          await sendPushToUsers(recipients, {
            title: senderName,
            body: text.slice(0, 80),
            data: { type: 'CONVERSATION_MESSAGE', conversationId, messageId: messageRef.id },
          });
        }
      }
    } catch (err) {
      console.warn('[chatSendConversationMessage] Error enviando push:', err);
    }

    // Recortar la subcolección a los últimos MAX_MESSAGES mensajes
    try {
      const overflow = await messagesRef
        .orderBy('timestamp', 'desc')
        .offset(MAX_MESSAGES)
        .limit(100)
        .get();
      if (!overflow.empty) {
        const batch = db.batch();
        overflow.docs.forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
    } catch (err) {
      console.warn('[chatSendConversationMessage] Error en limpieza:', err);
    }

    return { ok: true, messageId: messageRef.id };
  },
);
