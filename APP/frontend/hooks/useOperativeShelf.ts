/**
 * useOperativeShelf — Motor operativo único (el "cerebro").
 *
 * Máquina de estados unificada para UBICAR / RETIRAR / MOVER / REUBICAR /
 * ALMACÉN / AVISAR, parametrizada por `RoleOperativeConfig`. Sustituye la
 * lógica que antes estaba triplicada en KioskView / ShelfNavigator / CalidadView.
 *
 * El chrome de cada rol (header, sidebar, landing) es responsable de:
 *   - elegir la estantería activa (`shelfCode`) y, si scope='all', permitir
 *     cambiarla (`setShelfCode`).
 *   - llamar a `cancelAction()` cuando el usuario cambia de estantería a mano.
 * Todo lo demás (flujo, modales, grid) lo gestiona este hook + OperativeShelfArea.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../lib/firebase';
import { useShelf, type ShelfLocationState } from './useShelf';
import { usePickupQueue } from './usePickupQueue';
import {
  formatArticleDisplay,
  parseScanInput,
  type ScanParseResult,
} from '../lib/qrParser';
import { findArticleGlobal, type GlobalArticleLocation } from '../lib/findArticleGlobal';
import { inventoryApi } from '../lib/api/inventoryApi';
import { getOperationalSession } from '../lib/operationalSession';
import { parseCallableError } from '../lib/callableError';
import { isReprocesosLocation, getShelfDefinition } from '../lib/firestoreSchema';
import { validateContiguity } from '../lib/contiguityValidator';
import type { LocationItem } from '../lib/schema/locations';
import type { RoleOperativeConfig } from '../lib/operative/operativeConfig';
import type { AdditionalShelfPosition } from '../components/operative/AddShelfPositionModal';
import type { RetirarItem } from '../components/kiosk/RetirarArticleList';
import type { ScanMethod, ParsedScan } from '../lib/types/scan';

export type OperativeAction =
  | 'idle'
  | 'ubicar'
  | 'retirar'
  | 'mover'
  | 'reubicar'
  | 'almacen'
  | 'avisar';

// ScanData ahora usa ParsedScan del módulo centralizado
export type ScanData = ParsedScan;

export interface OperativeFeedback {
  type: 'success' | 'error' | 'info';
  message: string;
}

export interface ConfirmModalState {
  open: boolean;
  title: string;
  message: string;
  icon: string;
  variant: 'success' | 'danger' | 'warning' | 'info';
  confirmText?: string;
  onConfirm: () => void;
  extraButton?: { text: string; onClick: () => void; variant?: 'success' | 'danger' | 'warning' | 'info' };
  onClose?: () => void;
  /** Oculta el botón CANCELAR cuando confirm + extraButton ya son las dos únicas opciones. */
  hideCancel?: boolean;
}

export type SectionPickerPurpose = 'retirar' | 'reubicar-origen' | 'reubicar-destino';

export interface ReubicarCtx {
  fromShelf: string;
  needed: number;
}

export interface UseOperativeShelfParams {
  config: RoleOperativeConfig;
  /** Estantería activa (propiedad del chrome). */
  shelfCode: string;
  /** Cambia la estantería activa — necesario para scope='all' (retirar por sección). */
  setShelfCode?: (code: string) => void;
  operarioId: string;
  displayName: string;
  /**
   * Habilita la "bandeja de escaneo" (scan-first) en idle. Solo CARRETILLERO +
   * superadmins (lo decide el chrome con `canUseScanTray`). Ver PLAN_ESCANEO_ATAJOS.md §7.
   */
  enableScanTray?: boolean;
}

/**
 * Item de la bandeja de escaneo (scan-first). `located`/`locations` se resuelven
 * en segundo plano con `findArticleGlobal`; mientras tanto `resolving` es true.
 */
export interface ScanTrayItem {
  articleCode: string;
  orderFab: string;
  /** undefined mientras se resuelve; true/false una vez resuelto. */
  located?: boolean;
  locations?: GlobalArticleLocation[];
  resolving?: boolean;
}

const padPos = (p: string) => parseInt(p, 10);
const displayPos = (p: string) => { const n = parseInt(p, 10); return Number.isNaN(n) ? p : String(n); };

// Clave versionada para persistir un lote en curso (tolerancia a desconexión/recarga).
const BATCH_STORAGE_KEY = 'wms.batch.v1';
const BATCH_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 h

// Clave versionada para persistir la bandeja de escaneo (mismo patrón que el lote).
const SCAN_TRAY_STORAGE_KEY = 'wms.scantray.v1';

interface PersistedBatch {
  v: number;
  shelfCode: string;
  action: OperativeAction;
  batchArticles: ScanData[];
  batchMethod: ScanMethod | null;
  batchProcessedCount: number;
  ts: number;
}

const clearBatchStorage = () => {
  try { window.localStorage.removeItem(BATCH_STORAGE_KEY); } catch { /* ignore */ }
};

export function useOperativeShelf({
  config,
  shelfCode,
  setShelfCode,
  operarioId,
  displayName,
  enableScanTray = false,
}: UseOperativeShelfParams) {
  const shelf = useShelf(shelfCode);
  const { locations, loading, shelfDef, ubicar, ubicarMulti, retirar, retirarDeUbicacion, mover, findArticle, validateShelfAccess, totalArticles, totalOccupied, totalEmpty } = shelf;
  const { createPickupRequest, createDeliveryRequest } = usePickupQueue();

  // ── Estado de flujo ────────────────────────────────────────────────────────
  const [action, setAction] = useState<OperativeAction>('idle');
  const [scanData, setScanData] = useState<ScanData | null>(null);
  const [selectedPositions, setSelectedPositions] = useState<string[]>([]);
  const [scannerActive, setScannerActive] = useState(false);
  const [processing, setProcessing] = useState(false);
  const processingRef = useRef(false);
  const [feedback, setFeedback] = useState<OperativeFeedback | null>(null);
  const [selectedCell, setSelectedCell] = useState<ShelfLocationState | null>(null);
  const [highlightedSearch, setHighlightedSearch] = useState<string[]>([]);

  const [confirmModal, setConfirmModal] = useState<ConfirmModalState>({
    open: false, title: '', message: '', icon: '', variant: 'info', onConfirm: () => {},
  });

  // Captura de método de escaneo
  const [scanMethodPickerOpen, setScanMethodPickerOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<OperativeAction | null>(null);
  const [showCameraQR, setShowCameraQR] = useState(false);
  const [showCameraOCR, setShowCameraOCR] = useState(false);
  const [showBarcodeForm, setShowBarcodeForm] = useState(false);

  // Lote (varios artículos en la misma posición)
  const [batchMode, setBatchMode] = useState(false);
  const [batchArticles, setBatchArticles] = useState<ScanData[]>([]);
  // Método de escaneo recordado durante toda la sesión de lote.
  const [batchMethod, setBatchMethod] = useState<ScanMethod | null>(null);
  // Cuántos artículos del lote ya están escritos en Firestore (controla "Detener análisis").
  const [batchProcessedCount, setBatchProcessedCount] = useState(0);

  // Bandeja de escaneo (scan-first) — solo si enableScanTray.
  const [trayItems, setTrayItems] = useState<ScanTrayItem[]>([]);

  // Multi-sección (artículo grande)
  const [additionalShelfPositions, setAdditionalShelfPositions] = useState<AdditionalShelfPosition[]>([]);
  const [showAddShelfModal, setShowAddShelfModal] = useState(false);

  // Retirar
  const [showRetirarArticleList, setShowRetirarArticleList] = useState(false);
  const [showRetirarCellModal, setShowRetirarCellModal] = useState(false);
  const [retirarCellPosition, setRetirarCellPosition] = useState('');
  const [retirarCellItems, setRetirarCellItems] = useState<LocationItem[]>([]);
  const [pendingRetirarQueue, setPendingRetirarQueue] = useState<Array<{ position: string; items: LocationItem[] }>>([]);

  // Mover
  const [showMoverArticleList, setShowMoverArticleList] = useState(false);

  // Reprocesos (calidad)
  const [showReprocesosUbicacionModal, setShowReprocesosUbicacionModal] = useState(false);
  const [reprocesosCell, setReprocesosCell] = useState<ShelfLocationState | null>(null);

  // Reprocesos cellFirst: seleccionar celda antes de escanear, preguntar si tiene OF
  const [pendingCell, setPendingCell] = useState<ShelfLocationState | null>(null);
  const [showOFQuestion, setShowOFQuestion] = useState(false);
  const [scanArticleOnly, setScanArticleOnly] = useState(false);

  // Selector de sección (retirar por sección — carretillero/admin; reubicar — admin)
  const [sectionPicker, setSectionPicker] = useState<{ open: boolean; purpose: SectionPickerPurpose }>({ open: false, purpose: 'retirar' });
  // Reubicar (admin): contexto capturado en origen antes de cambiar a destino
  const [reubicarCtx, setReubicarCtx] = useState<ReubicarCtx | null>(null);

  // Avisar
  const [showRecogidaModal, setShowRecogidaModal] = useState(false);
  const [showTraerModal, setShowTraerModal] = useState(false);

  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finishTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cellFirstTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reprocesosEnabled = !!config.reprocesos;

  // Crear mapa de locaciones por position para búsquedas O(1) en lugar de O(n)
  const locationsByPosition = useMemo(() => {
    const map = new Map<string, ShelfLocationState>();
    for (const loc of locations) {
      map.set(loc.position, loc);
    }
    return map;
  }, [locations]);

  // Mantener `reprocesosCell` sincronizado con los datos en vivo
  useEffect(() => {
    if (!reprocesosCell) return;
    const updated = locationsByPosition.get(reprocesosCell.position);
    if (updated && updated !== reprocesosCell) setReprocesosCell(updated);
  }, [locationsByPosition, reprocesosCell]);

  // También sincronizar `pendingCell` con los datos en vivo (mantener ambas referencias consistentes)
  useEffect(() => {
    if (!pendingCell) return;
    const updated = locationsByPosition.get(pendingCell.position);
    if (updated && updated !== pendingCell) setPendingCell(updated);
  }, [locationsByPosition, pendingCell]);

  // ── Helpers ────────────────────────────────────────────────────────────────
  // Limpiar selectedPositions y scanData cuando CAMBIA la acción (todas las transiciones)
  // Previene acumulación de positions de la acción anterior
  useEffect(() => {
    setSelectedPositions([]);
    setScanData(null);
  }, [action]);

  const showToast = useCallback((type: OperativeFeedback['type'], message: string, ms = 2500) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setFeedback({ type, message });
    toastTimerRef.current = setTimeout(() => {
      setFeedback(null);
      toastTimerRef.current = null;
    }, ms);
  }, []);

  // BA6: Timeout para cellFirst — si el usuario no completa en 5 min, limpiar pendingCell
  useEffect(() => {
    if (!pendingCell) {
      if (cellFirstTimerRef.current) {
        clearTimeout(cellFirstTimerRef.current);
        cellFirstTimerRef.current = null;
      }
      return;
    }
    cellFirstTimerRef.current = setTimeout(() => {
      setPendingCell(null);
      setShowOFQuestion(false);
      setScanArticleOnly(false);
      showToast('info', '⏱️ Tiempo de espera agotado. Vuelve a seleccionar una celda.');
    }, 5 * 60 * 1000); // 5 minutos
    return () => {
      if (cellFirstTimerRef.current) {
        clearTimeout(cellFirstTimerRef.current);
        cellFirstTimerRef.current = null;
      }
    };
  }, [pendingCell, showToast]);

  useEffect(() => () => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    if (finishTimerRef.current) clearTimeout(finishTimerRef.current);
    if (cellFirstTimerRef.current) clearTimeout(cellFirstTimerRef.current);
  }, []);

  const resetFlow = useCallback(() => {
    processingRef.current = false;
    setProcessing(false);
    setAction('idle');
    setScanData(null);
    setSelectedCell(null);
    setSelectedPositions([]);
    setScannerActive(false);
    setConfirmModal((p) => ({ ...p, open: false }));
    setBatchMode(false);
    setBatchArticles([]);
    setBatchMethod(null);
    setBatchProcessedCount(0);
    setAdditionalShelfPositions([]);
    setShowAddShelfModal(false);
    setShowRetirarArticleList(false);
    setShowRetirarCellModal(false);
    setPendingRetirarQueue([]);
    setShowMoverArticleList(false);
    setShowReprocesosUbicacionModal(false);
    setPendingCell(null);
    setShowOFQuestion(false);
    setScanArticleOnly(false);
    setSectionPicker((p) => ({ ...p, open: false }));
    setReubicarCtx(null);
    setShowRecogidaModal(false);
    setShowTraerModal(false);
    setPendingAction(null);
    setScanMethodPickerOpen(false);
    setShowCameraQR(false);
    setShowCameraOCR(false);
    setShowBarcodeForm(false);
    clearBatchStorage();
  }, []);

  const cancelAction = useCallback(() => {
    if (finishTimerRef.current) clearTimeout(finishTimerRef.current);
    // ALTO FIX #1: Si hay lote en progreso, auto-cancelarlo al cambiar estantería
    if (batchMode && batchArticles.length > 0) {
      showToast('info', `⚠️ Lote de ${batchArticles.length} artículo(s) cancelado`);
    }
    // Avisar si se descarta una cola de retirada a medias (no perder trabajo en silencio)
    if (pendingRetirarQueue.length > 0) {
      const n = pendingRetirarQueue.reduce((sum, q) => sum + q.items.length, 0);
      showToast('info', `⚠️ Retirada cancelada — ${n} artículo(s) seleccionados descartados`);
    }
    resetFlow();
  }, [resetFlow, batchMode, batchArticles, pendingRetirarQueue, showToast]);

  const finishAction = useCallback((type: OperativeFeedback['type'], message: string) => {
    showToast(type, message, 2800);
    resetFlow();
  }, [showToast, resetFlow]);

  // ── Persistencia del lote (tolerancia a desconexión/recarga) ─────────────────
  // Guarda una instantánea del lote en curso en cada cambio relevante.
  useEffect(() => {
    if (!batchMode) return;
    try {
      const snap: PersistedBatch = {
        v: 1, shelfCode, action, batchArticles, batchMethod, batchProcessedCount, ts: Date.now(),
      };
      window.localStorage.setItem(BATCH_STORAGE_KEY, JSON.stringify(snap));
    } catch { /* cuota / modo privado: ignorar */ }
  }, [batchMode, shelfCode, action, batchArticles, batchMethod, batchProcessedCount]);

  // Ofrece reanudar un lote sin terminar (misma estantería, <24h). Sólo una vez.
  const batchRehydratedRef = useRef(false);
  useEffect(() => {
    if (batchRehydratedRef.current || batchMode || !shelfCode) return;
    let snap: PersistedBatch | null = null;
    try {
      const raw = window.localStorage.getItem(BATCH_STORAGE_KEY);
      if (raw) snap = JSON.parse(raw) as PersistedBatch;
    } catch { snap = null; }
    if (!snap) return;

    const fresh = !!snap.ts && (Date.now() - snap.ts < BATCH_MAX_AGE_MS);
    const applicable =
      fresh &&
      snap.action === 'ubicar' &&
      snap.shelfCode === shelfCode &&
      Array.isArray(snap.batchArticles) &&
      snap.batchArticles.length > 0;
    if (!applicable) {
      if (!fresh) clearBatchStorage();
      return;
    }
    batchRehydratedRef.current = true;
    const recovered = snap;
    setConfirmModal({
      open: true,
      title: '🔄 Lote recuperado',
      message: `Se encontró un lote sin terminar con ${recovered.batchArticles.length} artículo(s) en ${shelfCode}.\n¿Reanudar el lote?`,
      icon: '🔄',
      variant: 'info',
      confirmText: 'Sí, reanudar',
      onConfirm: () => {
        setConfirmModal((p) => ({ ...p, open: false }));
        setAction('ubicar');
        setBatchMode(true);
        setBatchArticles(recovered.batchArticles);
        setBatchMethod(recovered.batchMethod ?? null);
        setBatchProcessedCount(recovered.batchProcessedCount ?? 0);
        setSelectedPositions([]);
        showToast('info', `Lote recuperado: ${recovered.batchArticles.length} artículos`);
      },
      extraButton: {
        text: 'No, descartar',
        onClick: () => { clearBatchStorage(); setConfirmModal((p) => ({ ...p, open: false })); },
      },
      hideCancel: true,
    });
  }, [shelfCode, batchMode, showToast]);

  // ── Bandeja de escaneo (scan-first) ──────────────────────────────────────────
  // Ver PLAN_ESCANEO_ATAJOS.md §3–§6. La bandeja es una generalización del lote:
  // se llena en idle por escaneo y resuelve a UBICAR (siembra el lote existente)
  // o RETIRAR (subconjunto ubicado). No se duplica lógica de negocio.
  const clearScanTrayStorage = useCallback(() => {
    try { window.localStorage.removeItem(SCAN_TRAY_STORAGE_KEY); } catch { /* ignore */ }
  }, []);

  // Rehidratar la bandeja persistida (una vez). El estado `located` se vuelve a
  // resolver en segundo plano (no se confía en el valor persistido).
  const trayRehydratedRef = useRef(false);
  useEffect(() => {
    if (!enableScanTray || trayRehydratedRef.current) return;
    trayRehydratedRef.current = true;
    try {
      const raw = window.localStorage.getItem(SCAN_TRAY_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { items?: ScanTrayItem[] };
      if (Array.isArray(parsed.items) && parsed.items.length > 0) {
        setTrayItems(parsed.items.map((it) => ({ articleCode: it.articleCode, orderFab: it.orderFab })));
      }
    } catch { /* ignore */ }
  }, [enableScanTray]);

  // Persistir la bandeja en cada cambio (tolerancia a recarga/desconexión).
  useEffect(() => {
    if (!enableScanTray) return;
    try {
      if (trayItems.length === 0) {
        window.localStorage.removeItem(SCAN_TRAY_STORAGE_KEY);
      } else {
        const slim = trayItems.map((it) => ({ articleCode: it.articleCode, orderFab: it.orderFab, located: it.located }));
        window.localStorage.setItem(SCAN_TRAY_STORAGE_KEY, JSON.stringify({ v: 1, items: slim, ts: Date.now() }));
      }
    } catch { /* cuota / modo privado: ignorar */ }
  }, [enableScanTray, trayItems]);

  // Resolver el estado "ubicado" de los items pendientes (en segundo plano).
  useEffect(() => {
    if (!enableScanTray) return;
    const pending = trayItems.filter((it) => it.located === undefined && !it.resolving);
    if (pending.length === 0) return;
    // Marcar como "resolving" para no relanzar la misma consulta.
    setTrayItems((prev) => prev.map((it) =>
      it.located === undefined && !it.resolving ? { ...it, resolving: true } : it,
    ));
    pending.forEach(async (item) => {
      let locs: GlobalArticleLocation[] = [];
      try {
        locs = await findArticleGlobal(item.articleCode, item.orderFab);
      } catch { /* offline / error: se queda sin resolver */ }
      setTrayItems((prev) => prev.map((it) =>
        it.articleCode === item.articleCode && it.orderFab === item.orderFab
          ? { ...it, located: locs.length > 0, locations: locs, resolving: false }
          : it,
      ));
    });
  }, [enableScanTray, trayItems]);

  /** Añade un escaneo crudo a la bandeja (parsea, dedupe y avisa). */
  const addToTray = useCallback((raw: string) => {
    const result = parseScanInput(raw);
    if (!result.success) {
      showToast('error', 'error' in result ? result.error : 'Escaneo no reconocido');
      return;
    }
    const { articleCode, orderFab } = result.data;
    const dup = trayItems.some((it) => it.articleCode === articleCode && it.orderFab === orderFab);
    if (dup) {
      showToast('info', `${articleCode} ${orderFab} ya está en la bandeja`);
      return;
    }
    setTrayItems((prev) => [...prev, { articleCode, orderFab }]);
    showToast('success', `✅ ${articleCode} añadido (${trayItems.length + 1} en bandeja)`);
  }, [trayItems, showToast]);

  const removeFromTray = useCallback((index: number) => {
    setTrayItems((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const clearTray = useCallback(() => {
    setTrayItems([]);
    clearScanTrayStorage();
  }, [clearScanTrayStorage]);

  /**
   * UBICAR desde la bandeja: SIEMPRE disponible para todos los artículos (los ya
   * ubicados se ubican como parcial, con el aviso existente del flujo de lote).
   * Siembra el lote existente y deja al usuario seleccionar posiciones (contigüidad).
   */
  const ubicarTray = useCallback(() => {
    if (trayItems.length === 0) return;
    const articles: ScanData[] = trayItems.map((it) => ({ articleCode: it.articleCode, orderFab: it.orderFab }));
    setAction('ubicar');
    setScanData(null);
    setSelectedCell(null);
    setSelectedPositions([]);
    setBatchMode(true);
    setBatchArticles(articles);
    setBatchMethod('manual'); // "+ Escanear más" reactiva la entrada de pistola/teclado
    setBatchProcessedCount(0);
    setScannerActive(false);
    setTrayItems([]);
    clearScanTrayStorage();
    showToast('info', `📦 ${articles.length} artículo(s) en lote — selecciona posición`);
  }, [trayItems, clearScanTrayStorage, showToast]);

  /** Ejecuta la retirada por ubicación de cada (artículo × ubicación) de la bandeja. */
  const processTrayRetirar = useCallback(async (
    ops: Array<{ articleCode: string; orderFab: string; shelfCode: string; shelfName: string; position: string }>,
    retiredItems: ScanTrayItem[],
  ) => {
    if (processingRef.current) return;
    processingRef.current = true;
    setProcessing(true);
    setConfirmModal((p) => ({ ...p, open: false }));
    const session = getOperationalSession();
    let ok = 0;
    for (const op of ops) {
      try {
        const res = await inventoryApi.retirarDeUbicacion({
          shelfCode: op.shelfCode,
          articleCode: op.articleCode,
          orderFab: op.orderFab,
          position: op.position,
          operarioId,
          operarioName: displayName,
        }, session);
        if (res?.ok) ok++;
      } catch { /* contabilizar como fallo */ }
    }
    processingRef.current = false;
    setProcessing(false);
    // Quitar de la bandeja los artículos retirados (éxito total o parcial).
    const retiredKeys = new Set(retiredItems.map((it) => `${it.articleCode}|${it.orderFab}`));
    setTrayItems((prev) => prev.filter((it) => !retiredKeys.has(`${it.articleCode}|${it.orderFab}`)));
    if (ok === ops.length) {
      showToast('success', `✅ ${ops.length} artículo(s) retirado(s) correctamente`);
    } else {
      showToast('error', `Parcial: ${ok}/${ops.length} retirados`);
    }
  }, [operarioId, displayName, showToast]);

  /**
   * RETIRAR desde la bandeja: acción ADICIONAL, solo para el subconjunto que está
   * ubicado. Confirma la lista (artículo × ubicación) y retira de cada ubicación.
   */
  const retirarTray = useCallback(() => {
    const located = trayItems.filter((it) => it.located === true && (it.locations?.length ?? 0) > 0);
    if (located.length === 0) {
      showToast('info', 'No hay artículos ubicados en la bandeja para retirar');
      return;
    }
    const ops: Array<{ articleCode: string; orderFab: string; shelfCode: string; shelfName: string; position: string }> = [];
    for (const it of located) {
      for (const loc of it.locations || []) {
        ops.push({ articleCode: it.articleCode, orderFab: it.orderFab, shelfCode: loc.shelfCode, shelfName: loc.shelfName, position: loc.position });
      }
    }
    const summary = ops.map((o) => `• ${o.articleCode} — ${o.shelfName} pos. ${displayPos(o.position)}`).join('\n');
    setConfirmModal({
      open: true,
      title: '📤 Retirar de la bandeja',
      message: `Se retirarán ${ops.length} artículo(s) de estas ubicaciones:\n\n${summary}`,
      icon: '📤',
      variant: 'warning',
      confirmText: `Sí, retirar ${ops.length}`,
      onConfirm: () => { void processTrayRetirar(ops, located); },
      onClose: () => setConfirmModal((p) => ({ ...p, open: false })),
    });
  }, [trayItems, showToast, processTrayRetirar]);

  /**
   * §7bis — Solicitar "traer a sección" desde el buscador global. Reutiliza el
   * backend createDeliveryRequest (cola del carretillero, requestType TRAER).
   */
  const requestDeliveryToSection = useCallback(async (
    article: { articleCode: string; orderFab: string; shelfCode: string; positions: string[] },
    destShelfCode: string,
  ): Promise<boolean> => {
    const destDef = getShelfDefinition(destShelfCode);
    const articleShelfName = getShelfDefinition(article.shelfCode)?.name || article.shelfCode;
    setProcessing(true);
    const ok = await createDeliveryRequest(
      operarioId, displayName,
      destShelfCode, destDef?.name || destShelfCode,
      article.articleCode, article.orderFab,
      articleShelfName, article.positions,
    );
    setProcessing(false);
    if (ok) {
      showToast('success', `✅ Solicitado: el carretillero traerá ${article.articleCode} a ${destDef?.name || destShelfCode}`);
    } else {
      showToast('error', 'Error al enviar la solicitud');
    }
    return ok;
  }, [createDeliveryRequest, operarioId, displayName, showToast]);

  // ── Captura de método ────────────────────────────────────────────────────────
  /**
   * Activa UN método de escaneo de forma mutuamente excluyente: cierra cualquier
   * escáner/cámara abierto antes de abrir el nuevo (evita modales solapados y
   * MediaStreams huérfanos al cambiar de método a mitad de un lote).
   */
  const activateMethod = useCallback((method: ScanMethod) => {
    setScannerActive(false);
    setShowCameraQR(false);
    setShowCameraOCR(false);
    setShowBarcodeForm(false);
    if (method === 'manual') setScannerActive(true);
    else if (method === 'barcode') setShowBarcodeForm(true);
    else setShowCameraOCR(true);
  }, []);

  const applyScanMethod = useCallback((method: ScanMethod) => {
    setScanMethodPickerOpen(false);

    // Si hay pendingAction (primer escaneo del lote o acción normal), establecer la acción
    if (pendingAction) {
      setAction(pendingAction);
      setPendingAction(null);
    }

    // En lote, recordar el método para toda la sesión ("+ Escanear más" no re-pregunta)
    if (batchMode) setBatchMethod(method);

    activateMethod(method);
  }, [pendingAction, batchMode, activateMethod]);

  const beginBatchMode = useCallback((preservePositions = false) => {
    setScanMethodPickerOpen(false);
    // El lote es siempre de "ubicar"; usa pendingAction si existe.
    const act: OperativeAction = pendingAction ?? 'ubicar';
    setAction(act);
    setPendingAction(act); // lo consume applyScanMethod al elegir método
    setBatchMode(true);
    setBatchArticles([]);
    setBatchMethod(null);
    setBatchProcessedCount(0);
    if (!preservePositions) setSelectedPositions([]);
    // Abrir selector de método de escaneo (bloqueante hasta elegir).
    setScanMethodPickerOpen(true);
  }, [pendingAction]);

  /**
   * "Cambiar método" a mitad de lote: cierra el escáner vivo (detiene el
   * MediaStream al desmontar la cámara) y reabre el selector. No toca
   * `batchArticles`, así que los artículos ya escaneados se conservan.
   */
  const prepareChangeMethod = useCallback(() => {
    setScannerActive(false);
    setShowCameraQR(false);
    setShowCameraOCR(false);
    setShowBarcodeForm(false);
    setScanMethodPickerOpen(true);
  }, []);

  /** "+ Escanear más": reactiva el método recordado del lote sin re-preguntar. */
  const scanMore = useCallback(() => {
    if (batchMethod) activateMethod(batchMethod);
    else setScanMethodPickerOpen(true);
  }, [batchMethod, activateMethod]);

  /**
   * Cierre del selector de método.
   * - Lote sin método elegido: cerrar = abortar el lote (no dejar batchMode zombi).
   * - cellFirst con celda pendiente: volver a la fase de selección de celdas.
   * - Sin artículo escaneado: cerrar = cancelar la acción ENTERA. Antes solo se
   *   cerraba el picker y la acción quedaba viva, obligando a un segundo
   *   "Cancelar" en la barra de estado.
   */
  const handleScanMethodPickerClose = useCallback(() => {
    if (batchMode && !batchMethod) {
      cancelAction();
      return;
    }
    // cellFirst: cerrar el picker tras la pregunta OF → volver a esperar celda
    if (config.reprocesos?.cellFirst && pendingCell) {
      setPendingCell(null);
      setScanArticleOnly(false);
      setScanMethodPickerOpen(false);
      return;
    }
    if (!scanData) {
      cancelAction();
      return;
    }
    setScanMethodPickerOpen(false);
  }, [batchMode, batchMethod, cancelAction, config.reprocesos, pendingCell, scanData]);

  // Abre el selector de método para ubicar (tras decidir lote / no lote)
  const openScanPickerFor = (act: OperativeAction) => {
    setPendingAction(act);
    setScanMethodPickerOpen(true);
  };

  // cellFirst: confirmar posiciones seleccionadas → abre pregunta OF
  const handleCellFirstConfirmPositions = useCallback(() => {
    if (selectedPositions.length === 0) {
      showToast('error', 'Selecciona al menos una celda');
      return;
    }
    const firstLoc = locationsByPosition.get(selectedPositions[0]) || null;
    setPendingCell(firstLoc);
    setShowOFQuestion(true);
  }, [selectedPositions, locationsByPosition, showToast]);

  // cellFirst: respuesta a "¿Tiene OF?" → abrir selector de método.
  // El propio selector ofrece "Varios artículos (lote)", así que ya no hace
  // falta la pregunta intermedia "¿uno o varios?".
  const handleOFAnswer = useCallback((hasOF: boolean) => {
    setShowOFQuestion(false);
    if (!hasOF) setScanArticleOnly(true);
    setScanMethodPickerOpen(true);
  }, []);

  // cellFirst: cerrar el modal "¿Tiene OF?" sin elegir → volver a esperar celda
  const handleOFCancel = useCallback(() => {
    setShowOFQuestion(false);
    setPendingCell(null);
  }, []);

  // ── Avisar ─────────────────────────────────────────────────────────────────
  const startAvisar = () => {
    const mode = config.actions.avisar;
    if (mode === 'none') return;
    setAction('avisar');
    if (mode === 'recogida') {
      // Solo recogida: abrir directamente el modal de recogida
      setShowRecogidaModal(true);
      return;
    }
    // recogida + traer
    setConfirmModal({
      open: true,
      title: '¿Qué necesitas?',
      message: 'Selecciona el tipo de solicitud al carretillero',
      icon: '🚚',
      variant: 'warning',
      confirmText: 'LLEVAR — que se lleven un artículo',
      onConfirm: () => {
        setConfirmModal((p) => ({ ...p, open: false }));
        setShowRecogidaModal(true);
      },
      extraButton: {
        text: 'TRAER — que me traigan un artículo',
        onClick: () => {
          setConfirmModal((p) => ({ ...p, open: false }));
          setShowTraerModal(true);
        },
        variant: 'warning',
      },
      // Cerrar/cancelar = abortar AVISAR del todo (sin dejar la acción zombi)
      onClose: cancelAction,
    });
  };

  const handleRecogidaConfirm = useCallback(async (
    articleCode: string,
    articleOrderFab: string,
    destShelfCode: string,
    destShelfName: string,
  ) => {
    setProcessing(true);
    const ok = await createPickupRequest(
      operarioId, displayName, shelfCode,
      articleCode, articleOrderFab, destShelfCode, destShelfName,
    );
    setProcessing(false);
    if (ok) {
      setShowRecogidaModal(false);
      finishAction('success', `✅ Recogida solicitada: ${articleCode} → ${destShelfName}`);
    } else {
      showToast('error', 'Error al enviar la solicitud');
    }
  }, [createPickupRequest, operarioId, displayName, shelfCode, finishAction, showToast]);

  const handleTraerConfirm = useCallback(async (
    articleCode: string,
    articleOrderFab: string,
    articleShelfCode: string,
    articleShelfName: string,
    articlePositions: string[],
  ) => {
    setProcessing(true);
    const ok = await createDeliveryRequest(
      operarioId, displayName, shelfCode, shelfDef?.name || shelfCode,
      articleCode, articleOrderFab, articleShelfName, articlePositions,
    );
    setProcessing(false);
    if (ok) {
      setShowTraerModal(false);
      finishAction('success', `✅ Aviso enviado: el carretillero traerá ${articleCode}`);
    } else {
      showToast('error', 'Error al enviar la solicitud');
    }
  }, [createDeliveryRequest, operarioId, displayName, shelfCode, shelfDef, finishAction, showToast]);

  // ── start ─────────────────────────────────────────────────────────────────
  const startAction = (next: OperativeAction) => {
    setScanData(null);
    setSelectedCell(null);
    setSelectedPositions([]);
    setBatchMode(false);
    setBatchArticles([]);
    setBatchMethod(null);
    setBatchProcessedCount(0);
    setAdditionalShelfPositions([]);
    setFeedback(null);

    if (next === 'avisar') { startAvisar(); return; }

    if (next === 'retirar') {
      setAction('retirar');
      if (config.retirar.askSectionFirst && setShelfCode) {
        setSectionPicker({ open: true, purpose: 'retirar' });
      } else {
        setShowRetirarArticleList(true);
      }
      return;
    }

    if (next === 'mover') {
      setAction('mover');
      setShowMoverArticleList(true);
      return;
    }

    if (next === 'reubicar') {
      setAction('reubicar');
      setReubicarCtx(null);
      // Paso 1: elegir sección ORIGEN
      setSectionPicker({ open: true, purpose: 'reubicar-origen' });
      return;
    }

    if (next === 'ubicar') {
      // cellFirst (calidad reprocesos): no scanner al inicio, esperar que el usuario pulse celda
      if (config.reprocesos?.cellFirst) {
        setAction('ubicar');
        return;
      }
      // El selector de método ya ofrece "Varios artículos (lote)"; la pregunta
      // previa "¿uno o varios?" sobraba (un modal menos en cada UBICAR).
      openScanPickerFor('ubicar');
      return;
    }

    // ubicar/almacen/reubicar → selector de método
    openScanPickerFor(next);
  };

  // ── Sección (retirar por sección / reubicar) ─────────────────────────────────
  const handleSectionPicked = (code: string) => {
    const purpose = sectionPicker.purpose;
    setSectionPicker((p) => ({ ...p, open: false }));

    if (purpose === 'retirar') {
      if (code !== shelfCode) setShelfCode?.(code);
      setShowRetirarArticleList(true);
      return;
    }

    if (purpose === 'reubicar-origen') {
      // Cambia a la sección origen y muestra su lista de artículos
      if (code !== shelfCode) setShelfCode?.(code);
      setScanData(null);
      setSelectedPositions([]);
      setShowMoverArticleList(true);
      return;
    }

    if (purpose === 'reubicar-destino') {
      // Cambia a la sección destino; el usuario seleccionará posiciones en el grid
      if (code !== shelfCode) setShelfCode?.(code);
      setSelectedPositions([]);
      return;
    }
  };

  // ── Scan ──────────────────────────────────────────────────────────────────
  const handleScan = async (result: ScanParseResult) => {
    if (!result.success) {
      showToast('error', 'error' in result ? result.error : 'Error de escaneo');
      setScannerActive(true);
      return;
    }
    const { articleCode, orderFab } = result.data;

    // Lote: acumular artículos
    if (action === 'ubicar' && batchMode) {
      // Reactiva el método recordado para el siguiente escaneo. Las cámaras se
      // remontan tras un breve delay; la pistola/teclado se reactiva al instante.
      const reactivate = () => {
        const m = batchMethod ?? 'manual';
        if (m === 'manual') setScannerActive(true);
        else setTimeout(() => activateMethod(m), 300);
      };
      const duplicate = batchArticles.some((a) => a.articleCode === articleCode && a.orderFab === orderFab);
      if (duplicate) {
        showToast('error', `${articleCode} ${orderFab} ya está en el lote`);
        reactivate();
        return;
      }
      setBatchArticles((prev) => {
        const newLength = prev.length + 1;
        showToast('success', `✅ ${articleCode} añadido (${newLength} en lote)`);
        return [...prev, { articleCode, orderFab }];
      });
      reactivate();
      return;
    }

    // cellFirst sin OF: artículo capturado → ir directamente al modal de reprocesos
    // selectedPositions ya están establecidas por la selección múltiple de celdas
    if (scanArticleOnly && pendingCell) {
      setScanData({ articleCode, orderFab: orderFab || 'SIN-OF' });
      setScannerActive(false);
      setShowCameraQR(false);
      setShowCameraOCR(false);
      setShowReprocesosUbicacionModal(true);
      return;
    }

    setScanData({ articleCode, orderFab });
    setScannerActive(false);

    // UBICAR: aviso de artículo ya ubicado en el sistema (ghost)
    if (action === 'ubicar') {
      // cellFirst con OF: posiciones ya seleccionadas, ir directamente al modal de reprocesos
      if (config.reprocesos?.cellFirst && pendingCell) {
        setShowReprocesosUbicacionModal(true);
        return;
      }
      setProcessing(true);
      try {
        const globalLocs = await findArticleGlobal(articleCode, orderFab);
        if (globalLocs.length > 0) {
          const locationText = globalLocs.map((l) => `• ${l.shelfName} — pos. ${displayPos(l.position)}`).join('\n');
          // Descartar este escaneo y volver a esperar el siguiente
          const discardScan = () => {
            setScanData(null);
            setScannerActive(true);
            setConfirmModal((p) => ({ ...p, open: false }));
          };
          setConfirmModal({
            open: true,
            title: '⚠️ Artículo ya ubicado',
            message: `${formatArticleDisplay(articleCode, orderFab)} ya figura en el sistema:\n\n${locationText}\n\n¿Confirmas que ya NO se encuentra ahí y quieres ubicarlo en un nuevo sitio?`,
            icon: '⚠️',
            variant: 'warning',
            confirmText: 'Sí, ubicar de nuevo',
            onConfirm: () => {
              // PERMITE DUPLICADOS: Continuar sin reintentar verificación (usuario confirmó)
              setConfirmModal((p) => ({ ...p, open: false }));
              // Mantener scanData y permitir seleccionar posición
            },
            extraButton: { text: 'NO, descartar escaneo', onClick: discardScan },
            hideCancel: true,
            onClose: discardScan,
          });
        }
      } catch {
        showToast('error', 'No se pudo verificar ubicaciones previas');
      } finally {
        setProcessing(false);
      }
      return;
    }

    // ALMACÉN: buscar en TODA la app; si está ubicado → confirmar y retirar;
    // si no está ubicado → registrar igualmente la subida a almacén.
    if (action === 'almacen') {
      setProcessing(true);
      let globalLocs: Awaited<ReturnType<typeof findArticleGlobal>> = [];
      try {
        globalLocs = await findArticleGlobal(articleCode, orderFab);
      } catch {
        showToast('error', 'No se pudo verificar ubicaciones previas');
      } finally {
        setProcessing(false);
      }

      const sendToAlmacen = async () => {
        setProcessing(true);
        setConfirmModal((p) => ({ ...p, open: false }));
        try {
          const fn = httpsCallable(functions, 'shelfOperate');
          const res = await fn({
            op: 'enviarAlmacen',
            payload: { articleCode, orderFab, shelfCode },
            session: { operarioId, operarioName: displayName },
          });
          const data = res.data as { removedFrom?: number; wasLocated?: boolean };
          if (data.wasLocated === false || (data.removedFrom ?? 0) === 0) {
            finishAction('success', `✅ ${articleCode} registrado en almacén (no estaba ubicado)`);
          } else {
            finishAction('success', `✅ Enviado a almacén (retirado de ${data.removedFrom} ubicación(es))`);
          }
        } catch (err) {
          finishAction('error', parseCallableError(err));
        }
        setProcessing(false);
      };

      if (globalLocs.length > 0) {
        const locationText = globalLocs.map((l) => `• ${l.shelfName} — pos. ${padPos(l.position)}`).join('\n');
        setConfirmModal({
          open: true,
          title: '🏭 Enviar a Almacén',
          message: `${formatArticleDisplay(articleCode, orderFab)} está ubicado en:\n\n${locationText}\n\n¿Retirarlo de ahí y enviarlo a almacén?`,
          icon: '🏭',
          variant: 'warning',
          confirmText: 'SÍ, retirar y enviar',
          onConfirm: sendToAlmacen,
          // Cancelar = abortar ALMACÉN del todo (antes quedaba la acción viva
          // y había que pulsar un segundo "Cancelar" en la barra)
          onClose: cancelAction,
        });
      } else {
        setConfirmModal({
          open: true,
          title: '🏭 No está ubicado',
          message: `${formatArticleDisplay(articleCode, orderFab)} no figura ubicado en ninguna sección.\n\n¿Registrar igualmente su subida a almacén?`,
          icon: '🏭',
          variant: 'info',
          confirmText: 'SÍ, registrar en almacén',
          onConfirm: sendToAlmacen,
          onClose: cancelAction,
        });
      }
      return;
    }

    // MOVER: validar que el artículo existe en CUALQUIER estantería
    if (action === 'mover') {
      setProcessing(true);
      try {
        const globalLocs = await findArticleGlobal(articleCode, orderFab);
        if (globalLocs.length === 0) {
          showToast('error', `${articleCode} ${orderFab} no se encuentra en ninguna estantería`);
          setScanData(null);
          setScannerActive(true);
          setProcessing(false);
          return;
        }
        setSelectedPositions([]);
        showToast('info', `Artículo encontrado en ${globalLocs.length} ubicación(es). Selecciona destino.`);
      } catch (err) {
        showToast('error', `Error buscando artículo: ${err instanceof Error ? err.message : String(err)}`);
        setScanData(null);
      } finally {
        setProcessing(false);
      }
      return;
    }
  };

  // ── Cell press ──────────────────────────────────────────────────────────────
  const toggleSelected = (position: string) => {
    setSelectedPositions((cur) =>
      cur.includes(position) ? cur.filter((p) => p !== position) : [...cur, position],
    );
  };

  const handleCellPress = (loc: ShelfLocationState) => {
    // Editor de reprocesos (calidad) al tocar celda de reprocesos en idle
    if (action === 'idle' && reprocesosEnabled && isReprocesosLocation(shelfCode, padPos(loc.position))) {
      if (!config.reprocesos?.askImporteCantidad) {
        showToast('error', 'Tu sesión no puede editar reprocesos');
        return;
      }
      setReprocesosCell(loc);
      return;
    }

    // RETIRAR: tocar celda ocupada → seleccionar artículos a retirar
    if (action === 'retirar') {
      if (!loc.isEmpty && loc.items.length > 0) {
        setRetirarCellPosition(loc.position);
        setRetirarCellItems(loc.items);
        setShowRetirarCellModal(true);
      }
      return;
    }

    // UBICAR cellFirst (calidad reprocesos): fase 1 de selección múltiple de celdas
    // pendingCell=null significa "todavía eligiendo celdas"; pendingCell set = "en fase escaneo"
    if (action === 'ubicar' && config.reprocesos?.cellFirst && !scanData && !pendingCell) {
      // cellFirst solo aplica para ubicaciones de reprocesos (001-022)
      // Para otras ubicaciones (estantería 2+), permitir selección directa
      if (isReprocesosLocation(shelfCode, padPos(loc.position))) {
        if (!reprocesosEnabled) {
          showToast('error', 'No tienes permisos para editar reprocesos');
          return;
        }
      }
      // Permitir seleccionar cualquier ubicación (reprocesos o general)
      toggleSelected(loc.position);
      return;
    }

    // UBICAR lote: acumular posiciones con validación de contigüidad
    // (reprocesos: el modal de importe/cantidad se pide al confirmar, no al tocar la celda)
    if (action === 'ubicar' && batchMode && batchArticles.length > 0) {
      const position = loc.position;

      // Calcular nuevas posiciones si añadimos esta
      const newPositions = selectedPositions.includes(position)
        ? selectedPositions.filter(p => p !== position)
        : [...selectedPositions, position];

      // Validar contigüidad
      const validation = validateContiguity(newPositions, shelfDef);

      if (!validation.isContiguous && newPositions.length > 1) {
        showToast('error', `❌ ${validation.message}`);
        return;
      }

      if (!loc.isEmpty && loc.items.length > 0 && !selectedPositions.includes(position)) {
        showToast('info', `⚠️ Pos. ${displayPos(position)} ocupada — se añadirá igualmente`);
      }

      setSelectedPositions(newPositions);
      return;
    }

    // UBICAR individual: confirmar posición con modal
    if (action === 'ubicar' && !batchMode && scanData) {
      const position = loc.position;
      if (reprocesosEnabled && isReprocesosLocation(shelfCode, padPos(position))) {
        setSelectedPositions([position]);
        setShowReprocesosUbicacionModal(true);
        return;
      }

      // Mostrar confirmación: "¿Ubicar en posición X?"
      setConfirmModal({
        open: true,
        title: '¿Ubicar aquí?',
        message: `¿Ubicar ${scanData.articleCode} en ${shelfCode} pos. ${displayPos(position)}?`,
        icon: '📍',
        variant: 'info',
        confirmText: '✓ Sí',
        onConfirm: () => {
          const newPositions = selectedPositions.includes(position)
            ? selectedPositions.filter(p => p !== position)
            : [...selectedPositions, position];

          const validation = validateContiguity(newPositions, shelfDef);

          if (!validation.isContiguous && newPositions.length > 1) {
            showToast('error', `❌ ${validation.message}`);
            setConfirmModal((p) => ({ ...p, open: false }));
            return;
          }

          if (!loc.isEmpty && loc.items.length > 0 && !selectedPositions.includes(position)) {
            showToast('info', `⚠️ Pos. ${displayPos(position)} ya tiene ${loc.items.length} artículo(s) — se añadirá igualmente`);
          }

          setSelectedPositions(newPositions);
          setConfirmModal((p) => ({ ...p, open: false }));
        },
        extraButton: {
          text: '✕ No',
          onClick: () => setConfirmModal((p) => ({ ...p, open: false })),
        },
        hideCancel: true,
      });
      return;
    }

    // MOVER: confirmar destino con modal
    if (action === 'mover' && scanData) {
      const found = findArticle(scanData.articleCode, scanData.orderFab);
      const needed = found.length || 1;
      const position = loc.position;

      // Mostrar confirmación: "¿Mover a posición X?"
      setConfirmModal({
        open: true,
        title: '¿Mover aquí?',
        message: `¿Mover ${scanData.articleCode} a ${shelfCode} pos. ${displayPos(position)}? (${selectedPositions.length + 1}/${needed})`,
        icon: '🔄',
        variant: 'info',
        confirmText: '✓ Sí',
        onConfirm: () => {
          setSelectedPositions((cur) => {
            if (cur.includes(position)) return cur.filter((p) => p !== position);
            if (cur.length >= needed) return [...cur.slice(1), position];
            return [...cur, position];
          });
          setConfirmModal((p) => ({ ...p, open: false }));
        },
        extraButton: {
          text: '✕ No',
          onClick: () => setConfirmModal((p) => ({ ...p, open: false })),
        },
        hideCancel: true,
      });
      return;
    }

    // REUBICAR: seleccionar destinos en la sección destino (exactamente needed)
    if (action === 'reubicar' && scanData && reubicarCtx) {
      const needed = reubicarCtx.needed;
      const position = loc.position;
      setSelectedPositions((cur) => {
        if (cur.includes(position)) return cur.filter((p) => p !== position);
        if (cur.length >= needed) return [...cur.slice(1), position];
        return [...cur, position];
      });
      return;
    }

    // idle: inspeccionar celda ocupada
    if (action === 'idle' && !loc.isEmpty) {
      setSelectedCell(loc);
    }
  };

  // ── UBICAR confirm (individual, con bucle "¿otro?") ──────────────────────────
  const doUbicarCurrentShelf = async (articleCode: string, orderFab: string, positions: string[], importe?: number, cantidad?: number): Promise<boolean> => {
    if (positions.length === 1 && importe === undefined && cantidad === undefined) {
      return ubicar(articleCode, orderFab, positions[0], operarioId, displayName);
    }
    return ubicarMulti(articleCode, orderFab, positions, operarioId, displayName, importe, cantidad);
  };

  const ubicarAdditionalSections = async (articleCode: string, orderFab: string): Promise<string[]> => {
    if (additionalShelfPositions.length === 0) return [];
    const fn = httpsCallable(functions, 'shelfOperate');
    const failed: string[] = [];
    for (const extra of additionalShelfPositions) {
      try {
        const result = await fn({
          op: extra.positions.length === 1 ? 'ubicar' : 'ubicarMulti',
          payload: {
            articleCode, orderFab,
            shelfCode: extra.shelfCode,
            position: extra.positions[0],
            positions: extra.positions,
          },
          session: { operarioId, operarioName: displayName },
        });
        if (!(result.data as { ok?: boolean })?.ok) failed.push(extra.shelfName);
      } catch {
        failed.push(extra.shelfName);
      }
    }
    return failed;
  };

  const handleUbicarConfirm = async (importe?: number, cantidad?: number) => {
    if (!scanData || selectedPositions.length === 0 || processingRef.current) return;
    processingRef.current = true;
    setProcessing(true);
    setShowAddShelfModal(false);
    const { articleCode, orderFab } = scanData;
    const positions = [...selectedPositions];
    const extras = [...additionalShelfPositions];

    const ok = await doUbicarCurrentShelf(articleCode, orderFab, positions, importe, cantidad);
    const failedSections = ok ? await ubicarAdditionalSections(articleCode, orderFab) : [];
    processingRef.current = false;
    setProcessing(false);

    if (!ok) {
      finishAction('error', `Error al ubicar ${articleCode}`);
      return;
    }

    // ALTO FIX #23: Rollback multi-sección si falla cualquier sección adicional
    if (failedSections.length > 0) {
      try {
        // Rollback: retirar de sección principal si alguna sección adicional falló
        await retirar(articleCode, orderFab, operarioId, displayName);
        finishAction('error', `No se pudo ubicar en TODAS las secciones (fallaron: ${failedSections.join(', ')}). Operación anulada.`);
      } catch (rollbackErr) {
        finishAction('error', `Error crítico: no se pudo completar ni revertir. Contacta a admin. (Secciones fallidas: ${failedSections.join(', ')})`);
      }
      return;
    }

    const allText = [
      `${shelfCode}: pos. ${positions.map(displayPos).join(', ')}`,
      ...extras.map((e) => `${e.shelfName}: pos. ${e.positions.map(displayPos).join(', ')}`),
    ].join(' · ');
    setAdditionalShelfPositions([]);

    // Bucle "¿ubicar otro en las mismas posiciones?"
    // IMPORTANTE: cerrar este modal por cualquier vía que no sea "SÍ" debe
    // FINALIZAR la acción. Antes, cerrar con el fondo dejaba scanData y
    // selectedPositions vivos con el botón "✓ Ubicar" activo para un artículo
    // YA ubicado → riesgo de duplicarlo con un toque accidental.
    const finalizeUbicar = () => finishAction('success', `✅ ${articleCode} ubicado correctamente`);
    setConfirmModal({
      open: true,
      title: '✅ Artículo ubicado',
      message: `${articleCode} ubicado en ${allText}.\n¿Ubicar otro artículo en las mismas posiciones?`,
      icon: '📦',
      variant: 'success',
      confirmText: 'SÍ, ubicar otro',
      onConfirm: () => {
        setConfirmModal((p) => ({ ...p, open: false }));
        setScanData(null);
        setPendingCell(null);
        setScanArticleOnly(false);
        setScannerActive(false);
        setShowCameraQR(false);
        setShowCameraOCR(false);
        // cellFirst: volver al grid para seleccionar celda; de lo contrario abrir picker
        if (!config.reprocesos?.cellFirst) setScanMethodPickerOpen(true);
      },
      extraButton: { text: 'NO, finalizar', onClick: finalizeUbicar },
      hideCancel: true,
      onClose: finalizeUbicar,
    });
  };

  const handleUbicarBatchConfirm = async (importe?: number, cantidad?: number) => {
    if (selectedPositions.length === 0 || batchArticles.length === 0 || processingRef.current) return;
    processingRef.current = true;
    setScannerActive(false);
    setProcessing(true);

    // Commit incremental: cada artículo ubicado con éxito se cuenta como
    // "procesado" y se retira del lote. Si uno falla (p.ej. desconexión), se
    // detiene y los PENDIENTES se conservan en el lote (persistido en
    // localStorage), de modo que no se pierde nada y se puede reintentar.
    const pending = [...batchArticles];
    let successCount = 0;
    let failedAt = -1;
    for (let i = 0; i < pending.length; i++) {
      const article = pending[i];
      const ok = await doUbicarCurrentShelf(article.articleCode, article.orderFab, selectedPositions, importe, cantidad);
      if (ok) {
        successCount++;
        setBatchProcessedCount((c) => c + 1);
      } else {
        failedAt = i;
        break;
      }
    }
    processingRef.current = false;
    setProcessing(false);

    if (failedAt === -1) {
      finishAction('success', `✅ ${pending.length} artículo(s) ubicado(s) en ${selectedPositions.length} posición(es)`);
    } else {
      const remaining = pending.slice(failedAt);
      setBatchArticles(remaining);
      showToast('error', `Ubicados ${successCount}. Quedan ${remaining.length} pendiente(s) — reintenta o pulsa Detener.`, 4000);
    }
  };

  /**
   * Detener/cancelar el lote con mensaje explícito de qué se ubica y qué se
   * descarta (Punto 4 + "Detener análisis" del Punto 6). Si no hay artículos
   * pendientes, finaliza sin preguntar.
   */
  const handleStopBatch = () => {
    const pending = batchArticles.length;
    const processed = batchProcessedCount;
    if (pending === 0) {
      finishAction(processed > 0 ? 'success' : 'info',
        processed > 0 ? `✅ ${processed} artículo(s) ubicado(s)` : 'Lote cancelado');
      return;
    }
    setConfirmModal({
      open: true,
      title: processed > 0 ? '⏹ Detener lote' : '✕ Cancelar lote',
      message: processed > 0
        ? `Se han ubicado ${processed} artículo(s). Los ${pending} pendiente(s) NO se ubicarán y se descartan.\n¿Detener el lote?`
        : `Los ${pending} artículo(s) escaneados NO se ubicarán y se descartan.\n¿Cancelar el lote?`,
      icon: processed > 0 ? '⏹' : '⚠️',
      variant: 'warning',
      confirmText: processed > 0 ? `Sí, detener (descartar ${pending})` : `Sí, cancelar (descartar ${pending})`,
      onConfirm: () => finishAction(
        processed > 0 ? 'success' : 'info',
        processed > 0 ? `✅ ${processed} ubicado(s), ${pending} descartado(s)` : 'Lote cancelado',
      ),
      extraButton: {
        text: 'Volver al lote',
        onClick: () => setConfirmModal((p) => ({ ...p, open: false })),
      },
      hideCancel: true,
      // Cerrar con el fondo = volver al lote (no descartar nada sin confirmación)
      onClose: () => setConfirmModal((p) => ({ ...p, open: false })),
    });
  };

  // Reprocesos (calidad): importe/cantidad al ubicar
  const handleReprocesosUbicacionConfirm = (importe?: number, cantidad?: number) => {
    setShowReprocesosUbicacionModal(false);
    if (batchMode) handleUbicarBatchConfirm(importe, cantidad);
    else handleUbicarConfirm(importe, cantidad);
  };
  const handleReprocesosUbicacionSkip = () => {
    setShowReprocesosUbicacionModal(false);
    if (batchMode) handleUbicarBatchConfirm();
    else handleUbicarConfirm();
  };

  // Inicia el confirm del lote: pide importe/cantidad si hay posiciones de reprocesos
  const handleUbicarBatchStart = () => {
    if (selectedPositions.length === 0) {
      showToast('error', 'Selecciona al menos una posición');
      return;
    }
    if (batchArticles.length === 0) return;
    const needsReprocesos =
      reprocesosEnabled &&
      !!config.reprocesos?.askImporteCantidad &&
      selectedPositions.some(pos => isReprocesosLocation(shelfCode, padPos(pos)));
    if (needsReprocesos) {
      setShowReprocesosUbicacionModal(true);
    } else {
      handleUbicarBatchConfirm();
    }
  };

  // ── RETIRAR ─────────────────────────────────────────────────────────────────
  const handleRetirarArticleListConfirm = async (selectedItems: RetirarItem[]) => {
    if (processing) return;
    setShowRetirarArticleList(false);
    setProcessing(true);

    // ALTO FIX #22: Validar que artículos aún existen antes de procesar
    const missingItems: string[] = [];
    for (const item of selectedItems) {
      const itemPos = item.position;
      const cell = locations.find(
        (loc) => loc.position === itemPos
      );
      if (!cell) {
        missingItems.push(`${item.articleCode} de posición ${itemPos}`);
        continue;
      }
      const stillExists = cell.items.some(
        (it) => it.articleCode === item.articleCode && it.orderFab === item.orderFab && it.presenceId === item.presenceId
      );
      if (!stillExists) {
        missingItems.push(`${item.articleCode} ${item.orderFab}`);
      }
    }

    if (missingItems.length > 0) {
      setProcessing(false);
      showToast('error', `❌ Artículos ya no disponibles: ${missingItems.slice(0, 2).join(', ')}${missingItems.length > 2 ? '...' : ''}`);
      cancelAction();
      return;
    }

    let successCount = 0;
    for (const item of selectedItems) {
      const r = await retirarDeUbicacion(item.articleCode, item.orderFab, item.position, operarioId, displayName, item.presenceId);
      if (r.success) successCount++;
    }
    setProcessing(false);
    if (successCount === selectedItems.length) {
      finishAction('success', `✅ ${selectedItems.length} artículo(s) retirado(s) correctamente`);
    } else {
      finishAction('error', `Parcial: ${successCount}/${selectedItems.length} retirados`);
    }
  };

  /** Procesa toda la cola de retirada acumulada (valida y ejecuta). */
  const processRetirarQueue = async (queue: Array<{ position: string; items: LocationItem[] }>) => {
    setConfirmModal((p) => ({ ...p, open: false }));
    setProcessing(true);

    // ALTO FIX #22: Validar que posiciones aún existen antes de procesar lote
    const missingPositions: string[] = [];
    for (const queueItem of queue) {
      const queuePos = queueItem.position;
      const cell = locations.find(
        (loc) => loc.position === queuePos
      );
      if (!cell) {
        missingPositions.push(`posición ${queuePos}`);
        continue;
      }
      // Validar que los artículos seleccionados aún están en la posición
      for (const selectedItem of queueItem.items) {
        const stillExists = cell.items.some(
          (it) => it.articleCode === selectedItem.articleCode && it.orderFab === selectedItem.orderFab && it.presenceId === selectedItem.presenceId
        );
        if (!stillExists) {
          missingPositions.push(`${selectedItem.articleCode} de pos. ${queuePos}`);
        }
      }
    }

    if (missingPositions.length > 0) {
      setProcessing(false);
      showToast('error', `❌ Artículos ya no disponibles: ${missingPositions.slice(0, 3).join(', ')}${missingPositions.length > 3 ? '...' : ''}`);
      cancelAction();
      return;
    }

    let successCount = 0;
    for (const queueItem of queue) {
      for (const item of queueItem.items) {
        const r = await retirarDeUbicacion(item.articleCode, item.orderFab, queueItem.position, operarioId, displayName, item.presenceId);
        if (r.success) successCount++;
      }
    }
    setProcessing(false);
    const totalItems = queue.reduce((sum, q) => sum + q.items.length, 0);
    if (successCount === totalItems) {
      finishAction('success', `✅ ${totalItems} artículo(s) retirado(s) correctamente`);
    } else {
      finishAction('error', `Parcial: ${successCount}/${totalItems} artículos retirados`);
    }
    setPendingRetirarQueue([]);
  };

  const handleRetirarCellItemsConfirm = (selectedItems: LocationItem[]) => {
    setShowRetirarCellModal(false);
    const position = retirarCellPosition;
    if (selectedItems.length === 0) return;
    const updatedQueue = [...pendingRetirarQueue, { position, items: selectedItems }];
    setPendingRetirarQueue(updatedQueue);
    const totalQueued = updatedQueue.reduce((sum, q) => sum + q.items.length, 0);
    // Seguir seleccionando: cerrar el modal y conservar la cola (acción RETIRAR sigue viva)
    const continueSelecting = () => setConfirmModal((p) => ({ ...p, open: false }));
    // Bucle "¿retirar más?" — botón principal = CONTINUAR (igual que en ubicar/mover);
    // cerrar con el fondo conserva la cola (antes la descartaba en silencio).
    setConfirmModal({
      open: true,
      title: '¿Retirar algo más?',
      message: `${selectedItems.length} artículo(s) de posición ${displayPos(position)} añadido(s) a la cola (${totalQueued} en total)`,
      icon: '📤',
      variant: 'info',
      confirmText: 'SÍ, retirar más',
      onConfirm: continueSelecting,
      extraButton: {
        text: `NO, finalizar (retirar ${totalQueued})`,
        onClick: () => { void processRetirarQueue(updatedQueue); },
      },
      hideCancel: true,
      onClose: continueSelecting,
    });
  };

  // ── MOVER ─────────────────────────────────────────────────────────────────
  const handleMoverSelectArticle = (articleCode: string, orderFab: string) => {
    setShowMoverArticleList(false);
    setScanData({ articleCode, orderFab });
    setSelectedPositions([]);

    // En reubicar, capturamos cuántas presencias ocupa en ORIGEN antes de cambiar
    // a la sección destino (donde findArticle ya no lo encontraría).
    if (action === 'reubicar') {
      const needed = findArticle(articleCode, orderFab).length || 1;
      setReubicarCtx({ fromShelf: shelfCode, needed });
      // Paso 3: elegir sección DESTINO
      setSectionPicker({ open: true, purpose: 'reubicar-destino' });
    }
  };

  const handleReubicarConfirm = async () => {
    if (!scanData || !reubicarCtx || selectedPositions.length === 0 || processing) return;
    const { articleCode, orderFab } = scanData;
    const { fromShelf } = reubicarCtx;
    const toShelf = shelfCode;
    setProcessing(true);
    try {
      const access = await validateShelfAccess('operate');
      if (!access.ok) throw new Error('Sin permiso para operar en la estantería destino');
      const fn = httpsCallable(functions, 'shelfOperate');
      const result = await fn({
        op: 'reubicar',
        payload: { articleCode, orderFab, shelfCode: fromShelf, fromShelfCode: fromShelf, toShelfCode: toShelf, newPositions: selectedPositions },
        session: { operarioId, operarioName: displayName },
      });
      if (!(result.data as { ok?: boolean })?.ok) throw new Error('El servidor rechazó la operación de reubicación');
      finishAction('success', `✅ ${articleCode} reubicado a ${getShelfDefinition(toShelf)?.name || toShelf}`);
    } catch (err) {
      finishAction('error', parseCallableError(err));
    }
    setProcessing(false);
  };

  const handleMoverConfirm = async () => {
    if (!scanData || selectedPositions.length === 0 || processingRef.current) return;
    processingRef.current = true;
    setProcessing(true);
    const ok = await mover(scanData.articleCode, scanData.orderFab, selectedPositions, operarioId, displayName);
    processingRef.current = false;
    setProcessing(false);
    const { articleCode } = scanData;
    if (ok) {
      setSelectedPositions([]);
      if (config.mover.loop) {
        const finalizeMover = () => finishAction('success', `✅ ${articleCode} movido correctamente`);
        setConfirmModal({
          open: true,
          title: '✅ Movido correctamente',
          message: `${articleCode} movido. ¿Quieres mover algo más?`,
          icon: '🔄',
          variant: 'success',
          confirmText: 'SÍ, mover otro',
          onConfirm: () => {
            setConfirmModal((p) => ({ ...p, open: false }));
            setScanData(null);
            setShowMoverArticleList(true);
          },
          extraButton: { text: 'NO, finalizar', onClick: finalizeMover },
          hideCancel: true,
          onClose: finalizeMover,
        });
      } else {
        finishAction('success', `✅ ${articleCode} movido correctamente`);
      }
    } else {
      finishAction('error', 'Error al mover el artículo');
    }
  };

  /** Finaliza la retirada con la cola actual (botón "Finalizar" de la barra de estado). */
  const finalizeRetirarQueue = () => { void processRetirarQueue(pendingRetirarQueue); };

  // ── Multi-sección ────────────────────────────────────────────────────────────
  const addAdditionalShelf = (entry: AdditionalShelfPosition) => {
    setAdditionalShelfPositions((prev) => {
      const idx = prev.findIndex((e) => e.shelfCode === entry.shelfCode);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = entry;
        return next;
      }
      return [...prev, entry];
    });
    setShowAddShelfModal(false);
  };

  // ── Derivados ────────────────────────────────────────────────────────────────
  const moverNeeded = useMemo(() => {
    if (action !== 'mover' || !scanData) return 1;
    return findArticle(scanData.articleCode, scanData.orderFab).length || 1;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action, scanData, locations]);

  const reubicarNeeded = reubicarCtx?.needed ?? 1;

  const highlightedPositions = useMemo(() => ([
    ...highlightedSearch,
    ...(scanData ? findArticle(scanData.articleCode, scanData.orderFab).map((l) => l.position) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ]), [highlightedSearch, scanData, locations]);

  return {
    // datos de estantería
    locations, loading, shelfDef, shelfCode,
    totalArticles, totalOccupied, totalEmpty,
    // estado
    action, scanData, selectedPositions, scannerActive, processing, feedback,
    selectedCell, setSelectedCell,
    confirmModal, setConfirmModal,
    scanMethodPickerOpen, pendingAction,
    showCameraQR, setShowCameraQR,
    showCameraOCR, setShowCameraOCR,
    showBarcodeForm, setShowBarcodeForm,
    batchMode, batchArticles, batchMethod, batchProcessedCount,
    // bandeja de escaneo (scan-first)
    enableScanTray, trayItems,
    additionalShelfPositions, showAddShelfModal, setShowAddShelfModal,
    showRetirarArticleList, showRetirarCellModal, retirarCellPosition, retirarCellItems,
    pendingRetirarQueue, finalizeRetirarQueue,
    showMoverArticleList,
    showReprocesosUbicacionModal, reprocesosCell, setReprocesosCell,
    pendingCell,
    showOFQuestion, handleOFAnswer, handleOFCancel, handleCellFirstConfirmPositions,
    sectionPicker,
    reubicarCtx, reubicarNeeded,
    showRecogidaModal, setShowRecogidaModal,
    showTraerModal, setShowTraerModal,
    moverNeeded, highlightedPositions,
    // setters/handlers de búsqueda y escáner
    setScannerActive, setHighlightedSearch,
    // handlers de flujo
    startAction, cancelAction, finishAction, showToast,
    applyScanMethod, beginBatchMode,
    prepareChangeMethod, scanMore, handleScanMethodPickerClose,
    handleScan, handleCellPress,
    handleUbicarConfirm, handleUbicarBatchConfirm, handleUbicarBatchStart, handleStopBatch,
    handleReprocesosUbicacionConfirm, handleReprocesosUbicacionSkip,
    handleRetirarArticleListConfirm, handleRetirarCellItemsConfirm,
    handleMoverSelectArticle, handleMoverConfirm,
    handleReubicarConfirm,
    handleSectionPicked,
    handleRecogidaConfirm, handleTraerConfirm,
    addAdditionalShelf,
    // bandeja de escaneo (scan-first)
    addToTray, removeFromTray, clearTray, ubicarTray, retirarTray, requestDeliveryToSection,
    setShowRetirarArticleList, setShowRetirarCellModal, setShowMoverArticleList,
    setSectionPicker, setScanMethodPickerOpen, setPendingAction,
    setShowReprocesosUbicacionModal,
    scanArticleOnly,
    // utilidades
    getShelfDefinition,
  };
}

export type UseOperativeShelfReturn = ReturnType<typeof useOperativeShelf>;
