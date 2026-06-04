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
  type ScanParseResult,
} from '../lib/qrParser';
import { findArticleGlobal } from '../lib/findArticleGlobal';
import { parseCallableError } from '../lib/callableError';
import { isReprocesosLocation, getShelfDefinition } from '../lib/firestoreSchema';
import { validateContiguity } from '../lib/contiguityValidator';
import type { LocationItem } from '../lib/schema/locations';
import type { RoleOperativeConfig } from '../lib/operative/operativeConfig';
import type { AdditionalShelfPosition } from '../components/operative/AddShelfPositionModal';
import type { RetirarItem } from '../components/kiosk/RetirarArticleList';

export type OperativeAction =
  | 'idle'
  | 'ubicar'
  | 'retirar'
  | 'mover'
  | 'reubicar'
  | 'almacen'
  | 'avisar';

export interface ScanData {
  articleCode: string;
  orderFab: string;
}

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
  extraButton?: { text: string; onClick: () => void };
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
}

const padPos = (p: string) => parseInt(p, 10);

export function useOperativeShelf({
  config,
  shelfCode,
  setShelfCode,
  operarioId,
  displayName,
}: UseOperativeShelfParams) {
  const shelf = useShelf(shelfCode);
  const { locations, loading, shelfDef, ubicar, ubicarMulti, retirar, retirarDeUbicacion, mover, findArticle, totalArticles, totalOccupied, totalEmpty } = shelf;
  const { createPickupRequest, createDeliveryRequest } = usePickupQueue();

  // ── Estado de flujo ────────────────────────────────────────────────────────
  const [action, setAction] = useState<OperativeAction>('idle');
  const [scanData, setScanData] = useState<ScanData | null>(null);
  const [selectedPositions, setSelectedPositions] = useState<string[]>([]);
  const [scannerActive, setScannerActive] = useState(false);
  const [processing, setProcessing] = useState(false);
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

  // Lote (varios artículos en la misma posición)
  const [batchMode, setBatchMode] = useState(false);
  const [batchArticles, setBatchArticles] = useState<ScanData[]>([]);

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

  // Selector de sección (retirar por sección — carretillero/admin; reubicar — admin)
  const [sectionPicker, setSectionPicker] = useState<{ open: boolean; purpose: SectionPickerPurpose }>({ open: false, purpose: 'retirar' });
  // Reubicar (admin): contexto capturado en origen antes de cambiar a destino
  const [reubicarCtx, setReubicarCtx] = useState<ReubicarCtx | null>(null);

  // Avisar
  const [showRecogidaModal, setShowRecogidaModal] = useState(false);
  const [showTraerModal, setShowTraerModal] = useState(false);

  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finishTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reprocesosEnabled = !!config.reprocesos;

  // Mantener `reprocesosCell` sincronizado con los datos en vivo
  useEffect(() => {
    if (!reprocesosCell) return;
    const updated = locations.find((l) => l.position === reprocesosCell.position);
    if (updated && updated !== reprocesosCell) setReprocesosCell(updated);
  }, [locations, reprocesosCell]);

  useEffect(() => () => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    if (finishTimerRef.current) clearTimeout(finishTimerRef.current);
  }, []);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const showToast = useCallback((type: OperativeFeedback['type'], message: string, ms = 2500) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setFeedback({ type, message });
    toastTimerRef.current = setTimeout(() => {
      setFeedback(null);
      toastTimerRef.current = null;
    }, ms);
  }, []);

  const resetFlow = useCallback(() => {
    setAction('idle');
    setScanData(null);
    setSelectedCell(null);
    setSelectedPositions([]);
    setScannerActive(false);
    setConfirmModal((p) => ({ ...p, open: false }));
    setBatchMode(false);
    setBatchArticles([]);
    setAdditionalShelfPositions([]);
    setShowAddShelfModal(false);
    setShowRetirarArticleList(false);
    setShowRetirarCellModal(false);
    setPendingRetirarQueue([]);
    setShowMoverArticleList(false);
    setShowReprocesosUbicacionModal(false);
    setSectionPicker((p) => ({ ...p, open: false }));
    setReubicarCtx(null);
    setShowRecogidaModal(false);
    setShowTraerModal(false);
    setPendingAction(null);
    setScanMethodPickerOpen(false);
    setShowCameraQR(false);
    setShowCameraOCR(false);
  }, []);

  const cancelAction = useCallback(() => {
    if (finishTimerRef.current) clearTimeout(finishTimerRef.current);
    resetFlow();
  }, [resetFlow]);

  const finishAction = useCallback((type: OperativeFeedback['type'], message: string) => {
    showToast(type, message, 2800);
    resetFlow();
  }, [showToast, resetFlow]);

  // ── Captura de método ────────────────────────────────────────────────────────
  const applyScanMethod = useCallback((method: 'manual' | 'barcode' | 'ocr') => {
    setScanMethodPickerOpen(false);
    
    // Si hay pendingAction (primer escaneo del lote o acción normal), establecer la acción
    if (pendingAction) {
      setAction(pendingAction);
      setPendingAction(null);
    }
    
    // Activar el método seleccionado
    if (method === 'manual') setScannerActive(true);
    else if (method === 'barcode') setShowCameraQR(true);
    else setShowCameraOCR(true);
  }, [pendingAction]);

  const beginBatchMode = useCallback(() => {
    setScanMethodPickerOpen(false);
    if (!pendingAction) return;
    setAction(pendingAction);
    setBatchMode(true);
    setBatchArticles([]);
    setSelectedPositions([]);
    setPendingAction(null);
    // Abrir selector de método de escaneo en lugar de activar scanner directamente
    setScanMethodPickerOpen(true);
  }, [pendingAction]);

  // Abre el selector de método para ubicar (tras decidir lote / no lote)
  const openScanPickerFor = (act: OperativeAction) => {
    setPendingAction(act);
    setScanMethodPickerOpen(true);
  };

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
      },
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
      if (config.ubicar.askMultiArticle) {
        // Pregunta previa: ¿uno o varios artículos en la misma posición?
        setAction('ubicar');
        setConfirmModal({
          open: true,
          title: '¿Cuántos artículos vas a ubicar?',
          message: '¿Vas a ubicar varios artículos en la MISMA posición?',
          icon: '📦',
          variant: 'info',
          confirmText: 'Solo UNO',
          onConfirm: () => {
            setConfirmModal((p) => ({ ...p, open: false }));
            openScanPickerFor('ubicar');
          },
          extraButton: {
            text: 'VARIOS (lote)',
            onClick: () => {
              setConfirmModal((p) => ({ ...p, open: false }));
              setAction('ubicar');
              setBatchMode(true);
              setBatchArticles([]);
              setSelectedPositions([]);
              setScannerActive(true);
            },
          },
        });
        return;
      }
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
      const duplicate = batchArticles.some((a) => a.articleCode === articleCode && a.orderFab === orderFab);
      if (duplicate) {
        showToast('error', `${articleCode} ${orderFab} ya está en el lote`);
        // Mantener scanner activo para siguiente intento
        if (showCameraQR || showCameraOCR) {
          // Para cámaras, reabrir después de un breve delay
          setTimeout(() => {
            if (showCameraQR) setShowCameraQR(true);
            else if (showCameraOCR) setShowCameraOCR(true);
          }, 300);
        } else {
          setScannerActive(true);
        }
        return;
      }
      setBatchArticles((prev) => [...prev, { articleCode, orderFab }]);
      showToast('success', `✅ ${articleCode} añadido (${batchArticles.length + 1} en lote)`);
      
      // Mantener scanner activo para siguiente escaneo
      if (showCameraQR || showCameraOCR) {
        // Para cámaras, reabrir después de un breve delay
        setTimeout(() => {
          if (showCameraQR) setShowCameraQR(true);
          else if (showCameraOCR) setShowCameraOCR(true);
        }, 300);
      } else {
        // Para pistola USB, mantener input activo
        setScannerActive(true);
      }
      return;
    }

    setScanData({ articleCode, orderFab });
    setScannerActive(false);

    // UBICAR: aviso de artículo ya ubicado en el sistema (ghost)
    if (action === 'ubicar') {
      setProcessing(true);
      const globalLocs = await findArticleGlobal(articleCode, orderFab);
      setProcessing(false);
      if (globalLocs.length > 0) {
        const locationText = globalLocs.map((l) => `• ${l.shelfName} — pos. ${padPos(l.position)}`).join('\n');
        setConfirmModal({
          open: true,
          title: '⚠️ Artículo ya ubicado',
          message: `${formatArticleDisplay(articleCode, orderFab)} ya figura en el sistema:\n\n${locationText}\n\n¿Confirmas que ya NO se encuentra ahí y quieres ubicarlo en un nuevo sitio?`,
          icon: '⚠️',
          variant: 'warning',
          confirmText: 'Sí, ubicar de nuevo',
          onConfirm: () => setConfirmModal((p) => ({ ...p, open: false })),
          extraButton: {
            text: 'Cancelar',
            onClick: () => {
              setScanData(null);
              setScannerActive(true);
              setConfirmModal((p) => ({ ...p, open: false }));
            },
          },
        });
      }
      return;
    }

    // ALMACÉN: buscar en TODA la app; si está ubicado → confirmar y retirar;
    // si no está ubicado → registrar igualmente la subida a almacén.
    if (action === 'almacen') {
      setProcessing(true);
      const globalLocs = await findArticleGlobal(articleCode, orderFab);
      setProcessing(false);

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
        });
      }
      return;
    }

    // MOVER: validar que el artículo existe en la sección actual
    if (action === 'mover') {
      const found = findArticle(articleCode, orderFab);
      if (found.length === 0) {
        showToast('error', `${articleCode} no encontrado en esta sección`);
        setScanData(null);
        setScannerActive(true);
        return;
      }
      setSelectedPositions([]);
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

    // UBICAR lote: acumular posiciones con validación de contigüidad
    if (action === 'ubicar' && batchMode && batchArticles.length > 0) {
      const position = loc.position;
      if (reprocesosEnabled && isReprocesosLocation(shelfCode, padPos(position))) {
        setSelectedPositions((cur) => (cur.includes(position) ? cur : [...cur, position]));
        setShowReprocesosUbicacionModal(true);
        return;
      }
      
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
        showToast('info', `⚠️ Pos. ${padPos(position)} ocupada — se añadirá igualmente`);
      }
      
      setSelectedPositions(newPositions);
      return;
    }

    // UBICAR individual: acumular posiciones con validación de contigüidad
    if (action === 'ubicar' && !batchMode && scanData) {
      const position = loc.position;
      if (reprocesosEnabled && isReprocesosLocation(shelfCode, padPos(position))) {
        setSelectedPositions([position]);
        setShowReprocesosUbicacionModal(true);
        return;
      }
      
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
        showToast('info', `⚠️ Pos. ${padPos(position)} ya tiene ${loc.items.length} artículo(s) — se añadirá igualmente`);
      }
      
      setSelectedPositions(newPositions);
      return;
    }

    // MOVER: seleccionar destinos (exactamente moverNeeded)
    if (action === 'mover' && scanData) {
      const found = findArticle(scanData.articleCode, scanData.orderFab);
      const needed = found.length || 1;
      const position = loc.position;
      setSelectedPositions((cur) => {
        if (cur.includes(position)) return cur.filter((p) => p !== position);
        if (cur.length >= needed) return [...cur.slice(1), position];
        return [...cur, position];
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

  const ubicarAdditionalSections = async (articleCode: string, orderFab: string) => {
    if (additionalShelfPositions.length === 0) return;
    const fn = httpsCallable(functions, 'shelfOperate');
    for (const extra of additionalShelfPositions) {
      try {
        await fn({
          op: extra.positions.length === 1 ? 'ubicar' : 'ubicarMulti',
          payload: {
            articleCode, orderFab,
            shelfCode: extra.shelfCode,
            position: extra.positions[0],
            positions: extra.positions,
          },
          session: { operarioId, operarioName: displayName },
        });
      } catch { /* error por sección — continúa con las demás */ }
    }
  };

  const handleUbicarConfirm = async (importe?: number, cantidad?: number) => {
    if (!scanData || selectedPositions.length === 0) return;
    setProcessing(true);
    setShowAddShelfModal(false);
    const { articleCode, orderFab } = scanData;
    const positions = [...selectedPositions];
    const extras = [...additionalShelfPositions];

    const ok = await doUbicarCurrentShelf(articleCode, orderFab, positions, importe, cantidad);
    if (ok) await ubicarAdditionalSections(articleCode, orderFab);
    setProcessing(false);

    if (!ok) {
      finishAction('error', `Error al ubicar ${articleCode}`);
      return;
    }

    const allText = [
      `${shelfCode}: pos. ${positions.map(padPos).join(', ')}`,
      ...extras.map((e) => `${e.shelfName}: pos. ${e.positions.map(padPos).join(', ')}`),
    ].join(' · ');
    setAdditionalShelfPositions([]);

    // Bucle "¿ubicar otro en las mismas posiciones?"
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
        setScannerActive(true);
      },
      extraButton: {
        text: 'NO, finalizar',
        onClick: () => finishAction('success', `✅ ${articleCode} ubicado correctamente`),
      },
    });
  };

  const handleUbicarBatchConfirm = async () => {
    if (selectedPositions.length === 0 || batchArticles.length === 0) return;
    setScannerActive(false);
    setProcessing(true);
    let successCount = 0;
    for (const article of batchArticles) {
      const ok = await doUbicarCurrentShelf(article.articleCode, article.orderFab, selectedPositions);
      if (ok) successCount++;
    }
    setProcessing(false);
    if (successCount === batchArticles.length) {
      finishAction('success', `✅ ${batchArticles.length} artículo(s) ubicado(s) en ${selectedPositions.length} posición(es)`);
    } else {
      finishAction('error', `Parcial: ${successCount}/${batchArticles.length} artículos ubicados`);
    }
  };

  // Reprocesos (calidad): importe/cantidad al ubicar
  const handleReprocesosUbicacionConfirm = (importe?: number, cantidad?: number) => {
    setShowReprocesosUbicacionModal(false);
    if (batchMode) handleUbicarBatchConfirm();
    else handleUbicarConfirm(importe, cantidad);
  };
  const handleReprocesosUbicacionSkip = () => {
    setShowReprocesosUbicacionModal(false);
    if (batchMode) handleUbicarBatchConfirm();
    else handleUbicarConfirm();
  };

  // ── RETIRAR ─────────────────────────────────────────────────────────────────
  const handleRetirarArticleListConfirm = async (selectedItems: RetirarItem[]) => {
    setShowRetirarArticleList(false);
    setProcessing(true);
    let successCount = 0;
    for (const item of selectedItems) {
      const r = await retirarDeUbicacion(item.articleCode, item.orderFab, item.position, operarioId, displayName);
      if (r.success) successCount++;
    }
    setProcessing(false);
    if (successCount === selectedItems.length) {
      finishAction('success', `✅ ${selectedItems.length} artículo(s) retirado(s) correctamente`);
    } else {
      finishAction('error', `Parcial: ${successCount}/${selectedItems.length} retirados`);
    }
  };

  const handleRetirarCellItemsConfirm = (selectedItems: LocationItem[]) => {
    setShowRetirarCellModal(false);
    const position = retirarCellPosition;
    if (selectedItems.length === 0) return;
    const updatedQueue = [...pendingRetirarQueue, { position, items: selectedItems }];
    setPendingRetirarQueue(updatedQueue);
    // Bucle "¿retirar más?"
    setConfirmModal({
      open: true,
      title: '¿Retirar algo más?',
      message: `${selectedItems.length} artículo(s) de posición ${padPos(position)} añadido(s) a la cola`,
      icon: '📤',
      variant: 'info',
      confirmText: 'NO, finalizar retirada',
      onConfirm: async () => {
        setConfirmModal((p) => ({ ...p, open: false }));
        setProcessing(true);
        let successCount = 0;
        for (const queueItem of updatedQueue) {
          for (const item of queueItem.items) {
            const r = await retirarDeUbicacion(item.articleCode, item.orderFab, queueItem.position, operarioId, displayName);
            if (r.success) successCount++;
          }
        }
        setProcessing(false);
        const totalItems = updatedQueue.reduce((sum, q) => sum + q.items.length, 0);
        if (successCount === totalItems) {
          finishAction('success', `✅ ${totalItems} artículo(s) retirado(s) correctamente`);
        } else {
          finishAction('error', `Parcial: ${successCount}/${totalItems} artículos retirados`);
        }
        setPendingRetirarQueue([]);
      },
      extraButton: {
        text: 'SÍ, retirar más',
        onClick: () => setConfirmModal((p) => ({ ...p, open: false })),
      },
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
    if (!scanData || !reubicarCtx || selectedPositions.length === 0) return;
    const { articleCode, orderFab } = scanData;
    const { fromShelf } = reubicarCtx;
    const toShelf = shelfCode;
    setProcessing(true);
    try {
      const fn = httpsCallable(functions, 'shelfOperate');
      await fn({
        op: 'reubicar',
        payload: { articleCode, orderFab, shelfCode: fromShelf, fromShelfCode: fromShelf, toShelfCode: toShelf, newPositions: selectedPositions },
        session: { operarioId, operarioName: displayName },
      });
      finishAction('success', `✅ ${articleCode} reubicado a ${getShelfDefinition(toShelf)?.name || toShelf}`);
    } catch (err) {
      finishAction('error', parseCallableError(err));
    }
    setProcessing(false);
  };

  const handleMoverConfirm = async () => {
    if (!scanData || selectedPositions.length === 0) return;
    setProcessing(true);
    const ok = await mover(scanData.articleCode, scanData.orderFab, selectedPositions, operarioId, displayName);
    setProcessing(false);
    const { articleCode } = scanData;
    if (ok) {
      setSelectedPositions([]);
      if (config.mover.loop) {
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
          extraButton: {
            text: 'NO, finalizar',
            onClick: () => finishAction('success', `✅ ${articleCode} movido correctamente`),
          },
        });
      } else {
        finishAction('success', `✅ ${articleCode} movido correctamente`);
      }
    } else {
      finishAction('error', 'Error al mover el artículo');
    }
  };

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
    batchMode, batchArticles,
    additionalShelfPositions, showAddShelfModal, setShowAddShelfModal,
    showRetirarArticleList, showRetirarCellModal, retirarCellPosition, retirarCellItems,
    showMoverArticleList,
    showReprocesosUbicacionModal, reprocesosCell, setReprocesosCell,
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
    handleScan, handleCellPress,
    handleUbicarConfirm, handleUbicarBatchConfirm,
    handleReprocesosUbicacionConfirm, handleReprocesosUbicacionSkip,
    handleRetirarArticleListConfirm, handleRetirarCellItemsConfirm,
    handleMoverSelectArticle, handleMoverConfirm,
    handleReubicarConfirm,
    handleSectionPicked,
    handleRecogidaConfirm, handleTraerConfirm,
    addAdditionalShelf,
    setShowRetirarArticleList, setShowRetirarCellModal, setShowMoverArticleList,
    setSectionPicker, setScanMethodPickerOpen, setPendingAction,
    setShowReprocesosUbicacionModal,
    // utilidades
    getShelfDefinition,
  };
}

export type UseOperativeShelfReturn = ReturnType<typeof useOperativeShelf>;
