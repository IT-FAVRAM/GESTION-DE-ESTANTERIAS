import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';
import { config } from './config';

let db: admin.firestore.Firestore;

export function initFirestore(): void {
  const serviceAccountPath = path.resolve(config.serviceAccountPath);
  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  db = admin.firestore();
  console.log('[firestore] Conectado al proyecto:', serviceAccount.project_id);
}

const SHELF_NAMES: Record<string, string> = {
  PRE: 'Prensas',
  MEC: 'Mecanizado',
  PLE: 'Plegado',
  SOL: 'Soldadura',
  RSO: 'Robot Soldadura',
  REP: 'Repasado',
  PIN: 'Pintura',
  SXP: 'Soldadura Puntos',
  COM: 'Comodin',
  RPL: 'Autoplegadora',
  CAL: 'Calidad',
  ZIN: 'Zincado',
  RSOL: 'Repuestos Soldadura',
  CSOL: 'Carro Soldadura',
  CSXP: 'Carro SXP',
  CRPL: 'Carro Autoplegadora',
};

export interface ArticleLocation {
  shelfCode: string;
  shelfName: string;
  position: number;
  locatedAt: string;
  locatedByName: string;
  tiempoTranscurrido: string;
  orderFab: string;
}

function formatDuration(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);

  if (days > 0) return `${days} día${days !== 1 ? 's' : ''} y ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}min`;
  return `${minutes} minutos`;
}

function parsePosition(locationId: string): number {
  // locationId format: "MEC-005" or "SOL-12"
  const parts = locationId.split('-');
  return parseInt(parts[parts.length - 1], 10) || 0;
}

export async function buscarArticulo(
  articleCode: string,
  orderFab?: string,
): Promise<ArticleLocation[]> {
  const code = articleCode.trim().toUpperCase();
  const of = orderFab?.trim().toUpperCase();

  const snapshot = await db.collection('items').where('articleCode', '==', code).get();

  const results: ArticleLocation[] = [];
  for (const doc of snapshot.docs) {
    const d = doc.data();
    if (!d.active) continue;
    if (of && d.orderFab?.toUpperCase() !== of) continue;

    const locationId: string = (d.locationIds as string[])?.[0] ?? '';
    const position = locationId ? parsePosition(locationId) : 0;

    results.push({
      shelfCode: d.shelfCode,
      shelfName: SHELF_NAMES[d.shelfCode as string] ?? d.shelfCode,
      position,
      orderFab: d.orderFab ?? '',
      locatedAt: d.locatedAt ?? '',
      locatedByName: d.locatedByName ?? 'desconocido',
      tiempoTranscurrido: d.locatedAt ? formatDuration(d.locatedAt) : 'desconocido',
    });
  }

  return results;
}
