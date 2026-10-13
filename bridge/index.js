/**
 * ERP Bridge — puente entre Firestore (nube) y el ERP (LAN).
 *
 * ── El problema que resuelve ────────────────────────────────────────────────
 * El ERP escucha en http://10.0.0.19:8000, una IP privada. Las Cloud Functions
 * están en la nube y no ven la LAN; el navegador tampoco puede llamarla porque
 * la app es HTTPS (Mixed Content). El intento anterior (herramientas/scripts/proxy-server.js)
 * exigía un proxy en localhost de CADA tablet y kiosko.
 *
 * ── Cómo funciona ───────────────────────────────────────────────────────────
 * Este proceso corre en un PC fijo de la nave y solo hace conexiones SALIENTES
 * (HTTPS a Google + HTTP a la LAN). No abre ni un puerto al exterior.
 *
 *   App ──{status:'pending'}──> erp_lookups/{OF} <──resultado── Bridge ──> ERP
 *
 * Escucha en tiempo real las peticiones pendientes, consulta el ERP y escribe
 * la respuesta en el mismo documento. Al arrancar recoge automáticamente las
 * peticiones que quedaron pendientes mientras estuvo caído.
 */

'use strict';

const admin = require('firebase-admin');

// ── Configuración ───────────────────────────────────────────────────────────

const ERP_BASE_URL = process.env.ERP_BASE_URL || 'http://10.0.0.19:8000';

/**
 * ⚠️ GARANTÍA DE SOLO-LECTURA SOBRE EL ERP ⚠️
 *
 * Este bridge SOLO usa este endpoint y SOLO con el método GET. Es una consulta
 * de lectura: no crea, no modifica y no borra absolutamente nada en el ERP.
 *
 * La API del ERP sí expone endpoints de escritura (`insertarFichaje`,
 * `updateFichaje`, `updateCalendaOperario`), pero este código NO los invoca en
 * ningún punto — y no debe hacerlo nunca. Si algún día hiciera falta escribir en
 * el ERP, tiene que ser una decisión consciente y revisada, no un efecto
 * colateral de tocar este fichero.
 *
 * No se hace configurable por .env a propósito: así nadie puede apuntar el
 * bridge a un endpoint de escritura cambiando una variable de entorno.
 */
const ERP_ENDPOINT = '/fichajes/getControlOfProduccion';
const ERP_METHOD = 'GET';
const ERP_TIMEOUT_MS = Number(process.env.ERP_TIMEOUT_MS || 15000);
const COLLECTION = 'erp_lookups';
const HEARTBEAT_MS = 60 * 1000;

/** Se borran las consultas más antiguas que esto para que la colección no crezca sin fin. */
const RETENTION_DAYS = Number(process.env.RETENTION_DAYS || 30);
const CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000; // cada 6 h

/**
 * Formato exacto que exige el ERP: `OFyy-nnnnn`, 5 dígitos con ceros.
 * Verificado contra el ERP real: `OF26-5315` devuelve 0 filas, `OF26-05315` → 10.
 * Debe mantenerse en sintonía con aplicacion/lib/erp/ofNormalize.ts
 */
const OF_CANONICAL = /^OF\d{2}-\d{5}$/;

// ── Inicialización de Firebase ──────────────────────────────────────────────

function initFirebase() {
  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!credentialsPath) {
    console.error(
      '[bridge] Falta GOOGLE_APPLICATION_CREDENTIALS. Apunta a la clave JSON de la\n' +
        '         service account del bridge (ver README.md).',
    );
    process.exit(1);
  }

  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: process.env.FIREBASE_PROJECT_ID || undefined,
  });

  return admin.firestore();
}

const db = initFirebase();

// ── Consulta al ERP ─────────────────────────────────────────────────────────

/**
 * Pregunta al ERP por una OF y devuelve los artículos distintos que aparecen.
 *
 * El ERP devuelve una fila por operación (secuencia), así que una OF con 10
 * operaciones da 10 filas — casi siempre todas del mismo artículo. Deduplicamos
 * por IDArticulo y dejamos que la app decida si hay ambigüedad.
 */
async function fetchArticlesForOf(of) {
  const url = `${ERP_BASE_URL}${ERP_ENDPOINT}?n_orden=${encodeURIComponent(of)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ERP_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: ERP_METHOD, // explícito: solo lectura, nunca escritura
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });

    if (!res.ok) {
      throw new Error(`ERP respondió ${res.status} ${res.statusText}`);
    }

    // Decodificamos UTF-8 explícitamente: el ERP devuelve acentos y "ó"/"Ó" se
    // corrompen si se interpreta como latin-1.
    const buffer = await res.arrayBuffer();
    const text = new TextDecoder('utf-8').decode(buffer);
    const rows = JSON.parse(text);

    if (!Array.isArray(rows)) {
      throw new Error('El ERP no devolvió un array');
    }

    const byCode = new Map();
    for (const row of rows) {
      const code = String(row?.IDArticulo ?? '').trim();
      if (!code) continue;
      if (!byCode.has(code)) {
        byCode.set(code, {
          code,
          qFabricar: typeof row.QFabricar === 'number' ? row.QFabricar : null,
          estado: row.Estado != null ? String(row.Estado) : null,
          descOperacion: row.DescOperacion ? String(row.DescOperacion) : null,
        });
      }
    }

    return { articles: [...byCode.values()], rowCount: rows.length };
  } finally {
    clearTimeout(timer);
  }
}

// ── Procesamiento de peticiones ─────────────────────────────────────────────

/** IDs que ya se están resolviendo, para no duplicar trabajo entre snapshots. */
const inFlight = new Set();

async function processRequest(docSnap) {
  const of = docSnap.id;
  if (inFlight.has(of)) return;
  inFlight.add(of);

  const started = Date.now();

  try {
    // Defensa: el cliente ya normaliza, pero nunca consultamos algo con formato
    // raro (evita llamadas inútiles y ruido en el ERP).
    if (!OF_CANONICAL.test(of)) {
      await docSnap.ref.set(
        {
          status: 'error',
          error: `Formato de OF no válido: ${of}`,
          resolvedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      console.warn(`[bridge] OF con formato inválido, descartada: ${of}`);
      return;
    }

    const { articles, rowCount } = await fetchArticlesForOf(of);

    await docSnap.ref.set(
      {
        status: articles.length > 0 ? 'done' : 'not_found',
        articles,
        rowCount,
        error: admin.firestore.FieldValue.delete(),
        resolvedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    const ms = Date.now() - started;
    if (articles.length === 0) {
      console.log(`[bridge] ${of}: sin datos en el ERP (${ms} ms)`);
    } else {
      const codes = articles.map((a) => a.code).join(', ');
      console.log(`[bridge] ${of}: ${codes} — ${rowCount} filas (${ms} ms)`);
    }
  } catch (err) {
    const message =
      err.name === 'AbortError'
        ? `El ERP no respondió en ${ERP_TIMEOUT_MS} ms`
        : err.message || String(err);

    await docSnap.ref
      .set(
        {
          status: 'error',
          error: message,
          resolvedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      )
      .catch((writeErr) => console.error('[bridge] No se pudo escribir el error:', writeErr.message));

    console.error(`[bridge] ${of}: ${message}`);
  } finally {
    inFlight.delete(of);
  }
}

// ── Listener principal ──────────────────────────────────────────────────────

function startListener() {
  console.log(`[bridge] Escuchando ${COLLECTION} con status='pending'…`);

  return db
    .collection(COLLECTION)
    .where('status', '==', 'pending')
    .onSnapshot(
      (snapshot) => {
        // Al arrancar, el primer snapshot trae todo lo que quedó pendiente
        // mientras el bridge estuvo caído. Se recupera solo.
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added' || change.type === 'modified') {
            processRequest(change.doc);
          }
        });
      },
      (err) => {
        console.error('[bridge] Listener caído:', err.message);
        // Salimos con error: el servicio de Windows lo reinicia y vuelve a
        // engancharse. Es más robusto que intentar recuperar el listener aquí.
        process.exit(1);
      },
    );
}

// ── Latido y limpieza ───────────────────────────────────────────────────────

/** Deja constancia de que el bridge está vivo (útil para diagnosticar). */
async function heartbeat() {
  try {
    await db.collection('erp_bridge').doc('status').set(
      {
        online: true,
        host: require('os').hostname(),
        erpBaseUrl: ERP_BASE_URL,
        lastSeen: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  } catch (err) {
    console.warn('[bridge] Heartbeat falló:', err.message);
  }
}

/** Borra consultas antiguas para que la colección no crezca indefinidamente. */
async function cleanupOldLookups() {
  try {
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
    const old = await db
      .collection(COLLECTION)
      .where('resolvedAt', '<', cutoff)
      .limit(400)
      .get();

    if (old.empty) return;

    const batch = db.batch();
    old.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    console.log(`[bridge] Limpieza: ${old.size} consultas antiguas borradas`);
  } catch (err) {
    console.warn('[bridge] Limpieza falló:', err.message);
  }
}

// ── Arranque ────────────────────────────────────────────────────────────────

async function main() {
  console.log('─'.repeat(60));
  console.log('[bridge] ERP Bridge iniciando');
  console.log(`[bridge] ERP: ${ERP_BASE_URL}${ERP_ENDPOINT}`);
  console.log('─'.repeat(60));

  // Comprobación temprana: si el ERP no responde al arrancar, que se vea en el
  // log en vez de descubrirlo con la primera consulta de un operario.
  try {
    await fetchArticlesForOf('OF26-05315');
    console.log('[bridge] Conexión con el ERP verificada ✓');
  } catch (err) {
    console.warn(`[bridge] AVISO: el ERP no responde (${err.message}). Se reintentará por consulta.`);
  }

  await heartbeat();
  setInterval(heartbeat, HEARTBEAT_MS);

  cleanupOldLookups();
  setInterval(cleanupOldLookups, CLEANUP_INTERVAL_MS);

  const unsubscribe = startListener();

  const shutdown = async (signal) => {
    console.log(`\n[bridge] ${signal} recibido, cerrando…`);
    unsubscribe();
    await db
      .collection('erp_bridge')
      .doc('status')
      .set({ online: false, lastSeen: admin.firestore.FieldValue.serverTimestamp() }, { merge: true })
      .catch(() => {});
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('[bridge] Fallo fatal:', err);
  process.exit(1);
});
