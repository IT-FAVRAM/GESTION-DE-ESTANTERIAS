/**
 * AdminShelfBrowser — Visual operativa de estanterías para ADMIN/SUPERADMIN
 * Gestor de Estanterías WMS v3.0
 *
 * Permite ubicar, retirar y mover artículos manualmente mediante texto,
 * además de visualizar la saturación de todas las estanterías.
 */

import React, { useState, useCallback, useMemo } from 'react';
import { useShelf } from '../../hooks/useShelf';
import { useAuth } from '../../hooks/useAuth';
import { usePickupQueue } from '../../hooks/usePickupQueue';
import ShelfGrid from '../kiosk/ShelfGrid';
import KioskSearchBar from '../kiosk/KioskSearchBar';
import ConfirmationModal from '../common/ConfirmationModal';
import { SHELF_DEFINITIONS, ALL_SHELVES, CART_DEFINITIONS } from '../../lib/firestoreSchema';
import { formatArticleDisplay, parseScanInput, parseScanInputLenient } from '../../lib/qrParser';
import type { ShelfLocationState } from '../../hooks/useShelf';
import type { CellDragData } from '../kiosk/ShelfGridCell';
import CameraQRScanner from '../common/CameraQRScanner';
import CameraOCRScanner from '../common/CameraOCRScanner';
import ScanMethodPicker, { type ScanMethod } from '../common/ScanMethodPicker';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../lib/firebase';
import { findArticleGlobal } from '../../lib/findArticleGlobal';
import RetirarCellModal from '../kiosk/RetirarCellModal';
import RetirarArticleList, { type RetirarItem } from '../kiosk/RetirarArticleList';
import type { LocationItem } from '../../lib/schema/locations';

type AdminAction = 'idle' | 'ubicar' | 'retirar' | 'mover' | 'reubicar' | 'moverSeccion' | 'almacen' | 'avisar';

interface AdminShelfBrowserProps {
  onBack: () => void;
  onOpenCarros?: () => void;
}

const AdminShelfBrowser: React.FC<AdminShelfBrowserProps> = ({ onBack, onOpenCarros }) => {
  const [selectedShelf, setSelectedShelf] = useState(ALL_SHELVES[0]?.code || 'MEC');
  const [highlightedPositions, setHighlightedPositions] = useState<string[]>([]);
  const [action, setAction] = useState<AdminAction>('idle');
  const [articleInput, setArticleInput] = useState('');
  const [ofInput, setOfInput] = useState('');
  const [selectedPositions, setSelectedPositions] = useState<string[]>([]);
  const [processing, setProcessing] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; msg: string } | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 768);
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean; title: string; message: string; icon: string;
    variant: 'success' | 'danger' | 'warning' | 'info';
    onConfirm: () => void;
    extraButton?: { text: string; onClick: () => void };
    confirmText?: string;
  }>({ open: false, title: '', message: '', icon: '', variant: 'info', onConfirm: () => {} });
  
  // Camera scanning
  const [showCameraQR, setShowCameraQR] = useState(false);
  const [showCameraOCR, setShowCameraOCR] = useState(false);
  const [scanPickerOpen, setScanPickerOpen] = useState(false);
  // Manual entry modal (for non-batch mode when 'manual' is selected)
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualArticle, setManualArticle] = useState('');
  const [manualOf, setManualOf] = useState('');

  // Reubicar: clic-clic o arrastrar dentro de la misma estantería
  const [reubicarSource, setReubicarSource] = useState<{ articleCode: string; orderFab: string; position: string } | null>(null);

  // Drag & drop state
  const [draggedArticle, setDraggedArticle] = useState<{ articleCode: string; orderFab: string; position: string } | null>(null);
  const [dragOverPosition, setDragOverPosition] = useState<string | null>(null);

  // Mover a otra sección
  const [moverSeccionTargetShelf, setMoverSeccionTargetShelf] = useState<string | null>(null);
  const [moverSeccionTargetPos, setMoverSeccionTargetPos] = useState('');

  // Batch support
  const [batchMode, setBatchMode] = useState(false);
  const [batchArticles, setBatchArticles] = useState<Array<{ articleCode: string; orderFab: string }>>([]);
  const [batchRetiraPending, setBatchRetiraPending] = useState<Array<{ articleCode: string; orderFab: string; locations: ShelfLocationState[] }>>([]);
  const [currentBatchRetirarIndex, setCurrentBatchRetirarIndex] = useState(0);
  const [retirarCellPosition, setRetirarCellPosition] = useState('');
  const [retirarCellItems, setRetirarCellItems] = useState<LocationItem[]>([]);
  const [showRetirarCellModal, setShowRetirarCellModal] = useState(false);
  const [pendingRetirarQueue, setPendingRetirarQueue] = useState<Array<{ position: string; items: LocationItem[] }>>([]);
  const [showRetirarArticleList, setShowRetirarArticleList] = useState(false);

  const { locations, loading, shelfDef, ubicar, ubicarMulti, retirar, retirarDeUbicacion, mover, findArticle, emptyShelf, totalOccupied, totalEmpty, totalArticles } = useShelf(selectedShelf);
  const { operarioId, firebaseUser, displayName } = useAuth();

  const occupancyPct = totalOccupied + totalEmpty > 0
    ? Math.round((totalOccupied / (totalOccupied + totalEmpty)) * 100)
    : 0;

  const effectiveOperarioId = operarioId ?? firebaseUser?.uid ?? '';
  const { createPickupRequest } = usePickupQueue();

   const showFeedback = useCallback((type: 'success' | 'error' | 'info', msg: string) => {
     setFeedback({ type, msg });
     setTimeout(() => setFeedback(null), 3000);
   }, []);

  const handleCameraScan = useCallback((rawText: string, lenient = false) => {
    const result = lenient ? parseScanInputLenient(rawText) : parseScanInput(rawText);
    if (result.success) {
      setArticleInput(result.data.articleCode);
      setOfInput(result.data.orderFab);
      showFeedback('success', `✅ ${result.data.articleCode} ${result.data.orderFab}`);
    } else {
      showFeedback('error', 'error' in result ? result.error : 'No se reconoció el código');
    }
  }, [showFeedback]);

  const applyScanMethod = (method: ScanMethod) => {
    setScanPickerOpen(false);
    if (method === 'manual') {
      setManualArticle('');
      setManualOf('');
      setShowManualEntry(true);
      return;
    }
    if (method === 'barcode') setShowCameraQR(true);
    else setShowCameraOCR(true);
  };

  const confirmManualEntry = () => {
    const art = manualArticle.trim().toUpperCase();
    const of = manualOf.trim().toUpperCase();
    if (!art || !of) return;
    setArticleInput(art);
    setOfInput(of);
    setShowManualEntry(false);
    setManualArticle('');
    setManualOf('');
    showFeedback('success', `✅ ${art} · ${of}`);
  };

  const resetAction = useCallback(() => {
    setAction('idle');
    setSelectedPositions([]);
    setReubicarSource(null);
    setBatchMode(false);
    setBatchArticles([]);
    setBatchRetiraPending([]);
    setCurrentBatchRetirarIndex(0);
    setArticleInput('');
    setOfInput('');
    setMoverSeccionTargetShelf(null);
    setMoverSeccionTargetPos('');
    setDraggedArticle(null);
    setDragOverPosition(null);
    setPendingRetirarQueue([]);
    setShowRetirarArticleList(false);
  }, []);

  const handleAvisar = useCallback(async () => {
    setConfirmModal({
      open: true, title: 'Avisar al Carretillero', icon: '🚚', variant: 'warning',
      message: `Se enviará una solicitud de recogida en ${SHELF_DEFINITIONS.find(s => s.code === selectedShelf)?.name || selectedShelf}`,
      onConfirm: async () => {
        setConfirmModal(p => ({ ...p, open: false }));
        setProcessing(true);
        const ok = await createPickupRequest(effectiveOperarioId, displayName, selectedShelf);
        setProcessing(false);
        showFeedback(ok ? 'success' : 'error', ok ? '✅ Aviso enviado al carretillero' : 'Error al enviar el aviso');
      },
    });
  }, [selectedShelf, effectiveOperarioId, displayName, createPickupRequest, showFeedback]);

  const handleRetirarArticleListConfirm = useCallback(async (selectedItems: RetirarItem[]) => {
    setShowRetirarArticleList(false);
    setProcessing(true);
    let successCount = 0;
    for (const item of selectedItems) {
      const result = await retirarDeUbicacion(item.articleCode, item.orderFab, item.position, effectiveOperarioId, displayName);
      if (result.success) successCount++;
    }
    setProcessing(false);
    if (successCount === selectedItems.length)
      showFeedback('success', `✅ ${selectedItems.length} artículo${selectedItems.length !== 1 ? 's' : ''} retirado${selectedItems.length !== 1 ? 's' : ''} de ${selectedShelf}`);
    else
      showFeedback('error', `Parcial: ${successCount}/${selectedItems.length} retirados`);
    resetAction();
  }, [retirarDeUbicacion, effectiveOperarioId, displayName, showFeedback, selectedShelf, resetAction]);

  const startAction = useCallback(async (act: AdminAction) => {
    const article = articleInput.trim();
    const of = ofInput.trim();

    // Nueva lógica: si no hay artículo/OF, pedir escaneo o texto primero
    if (!article || !of) {
      setScanPickerOpen(true);
      setAction(act);
      return;
    }

    // Ghost article check before ubicar
    if (act === 'ubicar') {
      setProcessing(true);
      const globalLocs = await findArticleGlobal(article, of);
      setProcessing(false);
      if (globalLocs.length > 0) {
        const locationText = globalLocs
          .map((l) => `• ${l.shelfName} — pos. ${parseInt(l.position, 10)}`)
          .join('\n');
        setConfirmModal({
          open: true,
          title: '⚠️ Artículo ya ubicado',
          message: `${formatArticleDisplay(article, of)} ya figura en el sistema:\n\n${locationText}\n\n¿Confirmas que ya NO se encuentra ahí y quieres ubicarlo en un nuevo sitio?`,
          icon: '⚠️',
          variant: 'warning',
          onConfirm: () => {
            setConfirmModal((p) => ({ ...p, open: false }));
            // Proceed to ubicar flow
            setBatchMode(false);
            setAction('ubicar');
            setSelectedPositions([]);
            setFeedback(null);
          },
          extraButton: {
            text: 'Cancelar',
            onClick: () => setConfirmModal((p) => ({ ...p, open: false })),
          },
        });
        return;
      }
    }

    if (act === 'retirar') {
      setAction('retirar');
      setFeedback(null);
      setSelectedPositions([]);
      setShowRetirarArticleList(true);
      return;
    }

    if (act === 'ubicar') {
      setBatchMode(false);
      setAction('ubicar');
      setSelectedPositions([]);
      setFeedback(null);
      return;
    }

    if (act === 'almacen') {
      const articleCode = article;
      const orderFab = of;
      setConfirmModal({
        open: true, title: 'Enviar a Almacén', icon: '🏭', variant: 'warning',
        message: `¿Enviar ${formatArticleDisplay(articleCode, orderFab)} a almacén?\nSe retirará de TODAS las estanterías donde esté ubicado.`,
        onConfirm: async () => {
          setProcessing(true); setConfirmModal(p => ({ ...p, open: false }));
          try {
            const fn = httpsCallable(functions, 'shelfOperate');
            await fn({ op: 'enviarAlmacen', payload: { articleCode, orderFab, shelfCode: selectedShelf }, session: { operarioId: effectiveOperarioId, operarioName: displayName } });
            showFeedback('success', '✅ Enviado a almacén');
          } catch { showFeedback('error', 'Error al enviar a almacén'); }
          setProcessing(false); resetAction();
        },
      });
      return;
    }

    if (act === 'reubicar' || act === 'mover') {
      setAction(act);
      setSelectedPositions([]);
      setFeedback(null);
    }
  }, [articleInput, ofInput, findArticle, retirar, effectiveOperarioId, displayName, showFeedback, resetAction, selectedShelf]);

  // Función para reubicar: mover de origen a destino directamente
  const doReubicar = useCallback(async (source: { articleCode: string; orderFab: string; position: string }, newPosition: string) => {
    setProcessing(true);
    const ok = await mover(source.articleCode, source.orderFab, [newPosition], effectiveOperarioId, displayName);
    setProcessing(false);
    if (ok) {
      showFeedback('success', `✅ ${source.articleCode} movido de ${source.position} a ${newPosition}`);
      setReubicarSource(null);
      setAction('idle');
    } else {
      showFeedback('error', 'Error al reubicar el artículo');
    }
  }, [mover, effectiveOperarioId, displayName, showFeedback]);

  // ── Drag & drop handlers ──────────────────────────────────────────────────────
  const handleDragStart = useCallback((data: CellDragData) => {
    setDraggedArticle(data);
  }, []);

  const handleDragEnter = useCallback((position: string) => {
    setDragOverPosition(position);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverPosition(null);
  }, []);

  const handleDrop = useCallback((targetPosition: string) => {
    setDragOverPosition(null);
    if (!draggedArticle) return;
    if (draggedArticle.position === targetPosition) { setDraggedArticle(null); return; }
    const src = draggedArticle;
    setDraggedArticle(null);

    const allPos = findArticle(src.articleCode, src.orderFab);
    if (allPos.length > 1) {
      showFeedback('error', `El artículo ocupa ${allPos.length} posiciones. Usa MOVER para seleccionar ${allPos.length} destinos.`);
      return;
    }

    setConfirmModal({
      open: true,
      title: 'Mover artículo',
      message: `¿Mover ${formatArticleDisplay(src.articleCode, src.orderFab)} de pos. ${parseInt(src.position, 10)} a pos. ${parseInt(targetPosition, 10)}?`,
      icon: '🔁',
      variant: 'info',
      onConfirm: async () => {
        setConfirmModal((p) => ({ ...p, open: false }));
        await doReubicar(src, targetPosition);
      },
      extraButton: { text: 'Cancelar', onClick: () => setConfirmModal((p) => ({ ...p, open: false })) },
    });
  }, [draggedArticle, doReubicar, formatArticleDisplay, findArticle, showFeedback]);

  // ── Mover a otra sección ──────────────────────────────────────────────────────
  const startMoverSeccion = useCallback(() => {
    const article = articleInput.trim();
    const of = ofInput.trim();
    if (!article || !of) {
      showFeedback('error', 'Introduce código de artículo y OF antes de mover sección');
      return;
    }
    setAction('moverSeccion');
    setMoverSeccionTargetShelf(null);
    setMoverSeccionTargetPos('');
    setFeedback(null);
  }, [articleInput, ofInput, showFeedback]);

  const handleMoverSeccionConfirm = useCallback(async () => {
    if (!moverSeccionTargetShelf || !moverSeccionTargetPos) return;
    const article = articleInput.trim();
    const of = ofInput.trim();
    const destPos = parseInt(moverSeccionTargetPos, 10).toString().padStart(3, '0');
    const destShelfName = ALL_SHELVES.find((s) => s.code === moverSeccionTargetShelf)?.name || moverSeccionTargetShelf;

    setConfirmModal({
      open: true,
      title: 'Mover a otra sección',
      message: `¿Mover ${formatArticleDisplay(article, of)} de ${shelfDef?.name || selectedShelf} → ${destShelfName} pos. ${parseInt(destPos, 10)}?`,
      icon: '🚀',
      variant: 'warning',
      onConfirm: async () => {
        setProcessing(true);
        setConfirmModal((p) => ({ ...p, open: false }));
        try {
          const r = await retirar(article, of, effectiveOperarioId, displayName);
          if (!r.success) throw new Error('Error al retirar del origen');
          const fn = httpsCallable(functions, 'shelfOperate');
          await fn({
            op: 'ubicar',
            payload: { articleCode: article, orderFab: of, shelfCode: moverSeccionTargetShelf, position: destPos },
            session: { operarioId: effectiveOperarioId, operarioName: displayName },
          });
          showFeedback('success', `✅ Movido a ${destShelfName} pos. ${parseInt(destPos, 10)}`);
          resetAction();
        } catch (err: any) {
          showFeedback('error', err?.message || 'Error al mover entre secciones');
        }
        setProcessing(false);
      },
    });
  }, [moverSeccionTargetShelf, moverSeccionTargetPos, articleInput, ofInput, retirar, effectiveOperarioId, displayName, showFeedback, resetAction, selectedShelf, shelfDef]);

  const handleCellPress = useCallback((loc: ShelfLocationState) => {
    const article = articleInput.trim();
    const of = ofInput.trim();

    if (action === 'retirar') {
      if (!loc.isEmpty && loc.items.length > 0) {
        setRetirarCellPosition(loc.position);
        setRetirarCellItems(loc.items);
        setShowRetirarCellModal(true);
      }
      return;
    }

    if (action === 'ubicar' && batchMode) {
      const position = loc.position;
      setSelectedPositions((current) => {
        if (current.includes(position)) return current.filter((value) => value !== position);
        return [...current, position];
      });
      return;
    }

    if (action === 'ubicar' && !batchMode) {
      const position = loc.position;
      setSelectedPositions((current) => {
        if (current.includes(position)) return current.filter((value) => value !== position);
        return [...current, position];
      });
      return;
    }

    if (action === 'mover') {
      const found = findArticle(article, of);
      const needed = found.length || 1;
      setSelectedPositions((prev) => {
        if (prev.includes(loc.position)) return prev.filter((p) => p !== loc.position);
        if (prev.length >= needed) return [...prev.slice(1), loc.position];
        return [...prev, loc.position];
      });
    } else if (action === 'reubicar') {
      if (!reubicarSource) {
        if (loc.isEmpty) {
          showFeedback('error', 'Selecciona una celda con artículo');
          return;
        }
        const item = loc.items[0];
        const allPos = findArticle(item.articleCode, item.orderFab);
        setReubicarSource({
          articleCode: item.articleCode,
          orderFab: item.orderFab,
          position: loc.position,
        });
        const multiWarning = allPos.length > 1
          ? ` — ocupa ${allPos.length} posiciones, se moverán todas al destino`
          : '';
        showFeedback('info', `Origen: ${loc.position} (${item.articleCode})${multiWarning} — Elige destino`);
      } else {
        if (loc.position === reubicarSource.position) {
          showFeedback('info', 'Origen y destino iguales');
          return;
        }
        const allPos = findArticle(reubicarSource.articleCode, reubicarSource.orderFab);
        if (allPos.length > 1) {
          showFeedback('error', `El artículo ocupa ${allPos.length} posiciones. Debes seleccionar ${allPos.length} celdas de destino usando MOVER en su lugar.`);
          setReubicarSource(null);
          return;
        }
        if (!loc.isEmpty) {
          setConfirmModal({
            open: true,
            title: 'Sobrescribir',
            message: `La celda ${loc.position} tiene ${loc.items.length} artículo(s). ¿Sobrescribir?`,
            icon: '⚠️',
            variant: 'warning',
            onConfirm: async () => {
              setConfirmModal((p) => ({ ...p, open: false }));
              await doReubicar(reubicarSource, loc.position);
            },
            extraButton: { text: 'Elegir otra', onClick: () => setConfirmModal((p) => ({ ...p, open: false })) },
          });
          return;
        }
        doReubicar(reubicarSource, loc.position);
      }
    }
  }, [action, articleInput, ofInput, ubicar, findArticle, effectiveOperarioId, displayName, showFeedback, resetAction, reubicarSource, doReubicar]);

  const handleMoverConfirm = useCallback(async () => {
    if (selectedPositions.length === 0) return;
    const article = articleInput.trim();
    const of = ofInput.trim();
    setProcessing(true);
    const ok = await mover(article, of, selectedPositions, effectiveOperarioId, displayName);
    setProcessing(false);
    if (ok) showFeedback('success', '✅ Artículo movido');
    else showFeedback('error', 'Error al mover el artículo');
    resetAction();
  }, [selectedPositions, articleInput, ofInput, mover, effectiveOperarioId, displayName, showFeedback, resetAction]);

  const handleAddToBatch = useCallback(() => {
    const article = articleInput.trim();
    const of = ofInput.trim();

    if (!article || !of) {
      showFeedback('error', 'Introduce código y OF para añadir al batch');
      return;
    }

    if (action === 'ubicar') {
      const duplicate = batchArticles.some((a) => a.articleCode === article && a.orderFab === of);
      if (duplicate) {
        showFeedback('error', `${article} ${of} ya está en el batch`);
        return;
      }
      setBatchArticles((prev) => [...prev, { articleCode: article, orderFab: of }]);
      showFeedback('success', `✅ ${article} ${of} añadido al batch`);
      setArticleInput('');
      setOfInput('');
    } else if (action === 'retirar') {
      const found = findArticle(article, of);
      if (found.length === 0) {
        showFeedback('error', `${article} no encontrado en esta estantería`);
        return;
      }
      const duplicate = batchRetiraPending.some((a) => a.articleCode === article && a.orderFab === of);
      if (duplicate) {
        showFeedback('error', `Este artículo se ha escaneado dos veces. Solo se puede retirar una vez.`);
        return;
      }
      setBatchRetiraPending((prev) => [...prev, { articleCode: article, orderFab: of, locations: found }]);
      showFeedback('success', `✅ ${article} ${of} añadido al batch`);
      setArticleInput('');
      setOfInput('');
    }
  }, [action, articleInput, ofInput, batchArticles, batchRetiraPending, findArticle, showFeedback]);

  const handleUbicarBatchConfirm = useCallback(async () => {
    if (selectedPositions.length === 0) return;
    setProcessing(true);

    let successCount = 0;
    for (const article of batchArticles) {
      let success: boolean;
      if (selectedPositions.length === 1) {
        success = await ubicar(article.articleCode, article.orderFab, selectedPositions[0], effectiveOperarioId, displayName);
      } else {
        success = await ubicarMulti(article.articleCode, article.orderFab, selectedPositions, effectiveOperarioId, displayName);
      }
      if (success) successCount += selectedPositions.length;
    }

    setProcessing(false);
    if (successCount === batchArticles.length * selectedPositions.length) {
      showFeedback('success', `✅ ${batchArticles.length} artículos ubicados en ${selectedPositions.length} posición(es)`);
    } else {
      showFeedback('error', `Parcial: ${successCount}/${batchArticles.length * selectedPositions.length} ubicaciones completadas`);
    }
    resetAction();
  }, [batchArticles, selectedPositions, ubicar, ubicarMulti, effectiveOperarioId, displayName, showFeedback, resetAction]);

  const handleUbicarMultiPositionConfirm = useCallback(async () => {
    const article = articleInput.trim();
    const of = ofInput.trim();
    if (!article || !of || selectedPositions.length === 0) return;

    const doUbicar = async () => {
      setProcessing(true);
      let success: boolean;
      if (selectedPositions.length === 1) {
        success = await ubicar(article, of, selectedPositions[0], effectiveOperarioId, displayName);
      } else {
        success = await ubicarMulti(article, of, selectedPositions, effectiveOperarioId, displayName);
      }
      setProcessing(false);
      if (success) {
        const posText = selectedPositions.map(p => parseInt(p, 10)).join(', ');
        setConfirmModal({
          open: true,
          title: '✅ Artículo ubicado',
          message: `${article} ubicado en pos. ${posText}.\n¿Ubicar otro artículo en las mismas posiciones?`,
          icon: '📦',
          variant: 'success',
          confirmText: 'SÍ, ubicar otro',
          onConfirm: () => {
            setConfirmModal(p => ({ ...p, open: false }));
            setArticleInput('');
            setOfInput('');
          },
          extraButton: {
            text: 'NO, finalizar',
            onClick: () => {
              showFeedback('success', `✅ ${article} ubicado correctamente`);
              resetAction();
            },
          },
        });
      } else {
        showFeedback('error', `Error al ubicar ${article}`);
      }
    };

    const occupiedPositions = selectedPositions.filter((pos) => {
      const loc = locations.find((l) => l.position === pos);
      return loc && !loc.isEmpty && loc.items.length > 0;
    });

    if (occupiedPositions.length > 0) {
      const names = occupiedPositions.map((p) => parseInt(p, 10)).join(', ');
      setConfirmModal({
        open: true,
        title: '⚠️ Posiciones ocupadas',
        message: `La${occupiedPositions.length > 1 ? 's' : ''} posición${occupiedPositions.length > 1 ? 'es' : ''} ${names} ya tienen artículos.\n¿Añadir ${formatArticleDisplay(article, of)} igualmente?`,
        icon: '⚠️',
        variant: 'warning',
        onConfirm: () => { setConfirmModal((p) => ({ ...p, open: false })); doUbicar(); },
        extraButton: { text: 'Elegir otras', onClick: () => setConfirmModal((p) => ({ ...p, open: false })) },
      });
      return;
    }

    await doUbicar();
  }, [articleInput, ofInput, selectedPositions, locations, ubicar, ubicarMulti, effectiveOperarioId, displayName, showFeedback, resetAction]);

  const handleRetirarBatchNext = useCallback(async () => {
    const processNext = async (index: number) => {
      if (index >= batchRetiraPending.length) {
        showFeedback('success', '✅ Batch de retirada completado');
        resetAction();
        return;
      }

      const item = batchRetiraPending[index];
      if (item.locations.length === 1) {
        const r = await retirar(item.articleCode, item.orderFab, effectiveOperarioId, displayName);
        if (!r.success) {
          showFeedback('error', 'Error al retirar artículo');
          resetAction();
          return;
        }
        setCurrentBatchRetirarIndex(index + 1);
        setTimeout(() => processNext(index + 1), 500);
      } else {
        setConfirmModal({
          open: true,
          title: 'Selecciona de dónde retirar',
          message: `${formatArticleDisplay(item.articleCode, item.orderFab)} está en ${item.locations.length} ubicaciones`,
          icon: '📤',
          variant: 'warning',
          onConfirm: async () => {
            const r = await retirar(item.articleCode, item.orderFab, effectiveOperarioId, displayName);
            if (r.success) {
              setCurrentBatchRetirarIndex(index + 1);
              setConfirmModal((p) => ({ ...p, open: false }));
              setTimeout(() => processNext(index + 1), 500);
            }
          },
        });
      }
    };

    processNext(currentBatchRetirarIndex);
  }, [batchRetiraPending, currentBatchRetirarIndex, retirar, effectiveOperarioId, displayName, showFeedback, resetAction]);

  const handleRetirarCellItemsConfirm = (selectedItems: LocationItem[]) => {
    setShowRetirarCellModal(false);
    const position = retirarCellPosition;
    if (selectedItems.length === 0) return;

    const updatedQueue = [...pendingRetirarQueue, { position, items: selectedItems }];
    setPendingRetirarQueue(updatedQueue);
    setConfirmModal({
      open: true,
      title: '¿Retirar algo más?',
      message: `${selectedItems.length} artículo(s) de posición ${parseInt(position, 10)} añadido(s) a la cola`,
      icon: '📤',
      variant: 'info',
      confirmText: 'NO, finalizar retirada',
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, open: false }));
        let successCount = 0;
        setProcessing(true);
        for (const queueItem of updatedQueue) {
          for (const item of queueItem.items) {
            const result = await retirarDeUbicacion(item.articleCode, item.orderFab, queueItem.position, effectiveOperarioId, displayName);
            if (result.success) successCount++;
          }
        }
        setProcessing(false);
        const totalItems = updatedQueue.reduce((sum, q) => sum + q.items.length, 0);
        if (successCount === totalItems) {
          showFeedback('success', `✅ ${totalItems} artículo(s) retirado(s) correctamente`);
        } else {
          showFeedback('error', `Parcial: ${successCount}/${totalItems} artículos retirados`);
        }
        setPendingRetirarQueue([]);
        resetAction();
      },
      extraButton: {
        text: 'SÍ, retirar más',
        onClick: () => setConfirmModal((prev) => ({ ...prev, open: false })),
      },
    });
  };

  const handleEmptyShelf = useCallback(() => {
    setConfirmModal({
      open: true,
      title: '⚠️ Vaciar estantería',
      message: `¿Seguro que quieres vaciar TODA la estantería "${shelfDef?.name || selectedShelf}"?\n\nEsta acción eliminará todas las ubicaciones registradas y no se puede deshacer.`,
      icon: '🗑️',
      variant: 'danger',
      confirmText: 'Sí, vaciar todo',
      onConfirm: async () => {
        setConfirmModal((p) => ({ ...p, open: false }));
        setProcessing(true);
        const ok = await emptyShelf(effectiveOperarioId, displayName);
        setProcessing(false);
        if (ok) {
          showFeedback('success', `✅ Estantería ${selectedShelf} vaciada correctamente`);
        } else {
          showFeedback('error', 'Error al vaciar la estantería');
        }
      },
      extraButton: {
        text: 'Cancelar',
        onClick: () => setConfirmModal((p) => ({ ...p, open: false })),
      },
    });
  }, [selectedShelf, shelfDef, emptyShelf, effectiveOperarioId, displayName, showFeedback]);

  const foundPositions = (action !== 'idle' && articleInput.trim() && ofInput.trim())
    ? findArticle(articleInput.trim(), ofInput.trim()).map((l) => l.position)
    : [];

  // How many destination positions are needed for MOVER (= number of source positions)
  const moverNeeded = useMemo(() => {
    if (action !== 'mover' || !articleInput.trim() || !ofInput.trim()) return 1;
    return findArticle(articleInput.trim(), ofInput.trim()).length || 1;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action, articleInput, ofInput, locations]);

  // Grid focus mode: active when action requires cell selection
  const gridFocused = action !== 'idle' && action !== 'moverSeccion' && articleInput.trim() !== '' && ofInput.trim() !== '';

  return (
    <div className="h-dvh w-screen max-w-full bg-sky-50 flex flex-col overflow-hidden">
      {/* Header — compact in grid-focus mode */}
      <header className={`bg-white border-b border-slate-200 shadow-sm w-full transition-all ${gridFocused ? 'px-3 py-2' : 'px-4 py-2'}`}>
        {gridFocused ? (
          /* Compact bar: action type + article + cancel */
          <div className="flex items-center gap-2">
            <button onClick={onBack} className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">←</button>
            <span className={`text-xs font-black px-2 py-1 rounded-lg shrink-0
              ${action === 'ubicar' ? 'bg-emerald-100 text-emerald-700' :
                action === 'retirar' ? 'bg-red-100 text-red-700' :
                action === 'mover' ? 'bg-blue-100 text-blue-700' :
                'bg-amber-100 text-amber-700'}`}>
              {action.toUpperCase()}
            </span>
            <span className="text-sm font-bold text-slate-800 truncate flex-1 font-mono">
              {articleInput.trim()} <span className="text-slate-400 font-normal">· OF {ofInput.trim()}</span>
            </span>
            <span className="text-xs text-slate-400 hidden sm:block">{shelfDef?.name || selectedShelf}</span>
            <button onClick={resetAction} className="px-3 py-1.5 bg-slate-100 text-slate-600 text-xs font-bold rounded-lg hover:bg-red-100 hover:text-red-600 transition-colors shrink-0">
              ✕ Cancelar
            </button>
          </div>
        ) : (
          <>
            {/* Row 1: navigation + title */}
            <div className="flex items-center gap-3 mb-1.5">
              <button onClick={onBack} className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center hover:bg-slate-200 shrink-0">←</button>
              <div className="min-w-0">
                <h1 className="text-lg font-black text-slate-900 leading-tight">🏭 Estanterías</h1>
                <p className="text-xs text-slate-500 truncate">
                  {action === 'idle' ? 'Operativa manual' : `Acción activa: ${action.toUpperCase()}`}
                </p>
              </div>
            </div>
            {/* Row 2: stats + action buttons */}
            <div className="flex items-center gap-1.5 flex-wrap text-xs">
              <span className="hidden sm:inline-flex bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-1 rounded-lg font-bold whitespace-nowrap">{totalOccupied} ocup.</span>
              <span className="hidden sm:inline-flex bg-slate-100 text-slate-600 border border-slate-200 px-2 py-1 rounded-lg font-bold whitespace-nowrap">{totalEmpty} vacías</span>
              <span className="hidden sm:inline-flex bg-sky-50 text-sky-700 border border-sky-200 px-2 py-1 rounded-lg font-bold whitespace-nowrap">{totalArticles} art.</span>
              {onOpenCarros && (
                <button onClick={onOpenCarros} title="Ir a Carros"
                  className="hidden sm:inline-flex px-2 py-1 bg-emerald-100 text-emerald-700 border border-emerald-300 rounded-lg font-bold hover:bg-emerald-200 transition-colors whitespace-nowrap">
                  🛒 Carros
                </button>
              )}
              <button onClick={handleEmptyShelf} disabled={action !== 'idle' || processing} title={`Vaciar estantería ${selectedShelf}`}
                className="px-2 py-1 bg-red-50 text-red-600 border border-red-200 rounded-lg font-bold hover:bg-red-100 disabled:opacity-40 transition-colors whitespace-nowrap">
                🗑️ Vaciar
              </button>
              {action === 'idle' && (
                <>
                  <button onClick={() => startAction('ubicar')} className="px-2 py-1 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-500 transition-colors whitespace-nowrap">📦 Ubicar</button>
                  <button onClick={() => startAction('retirar')} className="px-2 py-1 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-500 transition-colors whitespace-nowrap">📤 Retirar</button>
                  <button onClick={() => startAction('reubicar')} className="px-2 py-1 bg-amber-600 text-white rounded-lg text-xs font-bold hover:bg-amber-500 transition-colors whitespace-nowrap">🔁 Reubic.</button>
                  <button onClick={startMoverSeccion} className="px-2 py-1 bg-violet-600 text-white rounded-lg text-xs font-bold hover:bg-violet-500 transition-colors whitespace-nowrap hidden sm:flex">🚀 Mover§</button>
                  <button onClick={() => startAction('almacen')} className="px-2 py-1 bg-purple-600 text-white rounded-lg text-xs font-bold hover:bg-purple-500 transition-colors whitespace-nowrap">🏭 Almacén</button>
                  <button onClick={handleAvisar} className="px-2 py-1 bg-orange-500 text-white rounded-lg text-xs font-bold hover:bg-orange-400 transition-colors whitespace-nowrap">🔔 Avisar</button>
                </>
              )}
            </div>
          </>
        )}
      </header>

      {/* Row-level wrapper: sidebar + main content */}
      <div className="flex flex-row flex-1 min-h-0 overflow-hidden">
        {/* SIDEBAR */}
        {!gridFocused && (
          <aside className={`flex-shrink-0 bg-slate-100 border-r border-slate-200 flex flex-col overflow-hidden transition-all duration-200 ${sidebarOpen ? 'w-44 sm:w-48' : 'w-10'}`}>
            {/* Toggle button */}
            <button onClick={() => setSidebarOpen(o => !o)}
              className="flex-shrink-0 h-10 w-full flex items-center justify-center border-b border-slate-200 bg-slate-100 hover:bg-slate-200 transition-colors text-slate-500 font-bold text-lg">
              {sidebarOpen ? '‹' : '›'}
            </button>

            {/* Shelf list — only when open */}
            {sidebarOpen && (
              <div className="flex-1 overflow-y-auto [scrollbar-width:thin]">
                <p className="px-3 pt-3 pb-1 text-[9px] font-black uppercase tracking-widest text-slate-400">Estanterías</p>
                {SHELF_DEFINITIONS.map(shelf => (
                  <button key={shelf.code} onClick={() => { setSelectedShelf(shelf.code); setHighlightedPositions([]); resetAction(); }}
                    className={`w-full text-left px-3 py-2 text-xs font-semibold transition-colors truncate ${selectedShelf === shelf.code ? 'bg-sky-500 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
                    {shelf.name}
                  </button>
                ))}
                <p className="px-3 pt-3 pb-1 text-[9px] font-black uppercase tracking-widest text-slate-400">Carros</p>
                {CART_DEFINITIONS.map(shelf => (
                  <button key={shelf.code} onClick={() => { setSelectedShelf(shelf.code); setHighlightedPositions([]); resetAction(); }}
                    className={`w-full text-left px-3 py-2 text-xs font-semibold transition-colors truncate ${selectedShelf === shelf.code ? 'bg-emerald-500 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
                    🛒 {shelf.name}
                  </button>
                ))}
              </div>
            )}
          </aside>
        )}

        {/* MAIN CONTENT AREA */}
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          {/* Barra de búsqueda */}
          {action === 'idle' && !gridFocused && (
            <div className="flex-shrink-0">
              <KioskSearchBar locations={locations} onHighlight={setHighlightedPositions} />
            </div>
          )}
          {/* Manual operations panel — hidden in grid focus mode */}
      <div className={`px-4 pt-3 pb-2 ${gridFocused ? 'hidden' : ''} ${action === 'idle' ? 'hidden sm:block' : ''}`}>
        <div className="bg-white border border-slate-200 rounded-2xl p-3 space-y-2.5 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
            Operativa — {displayName}
          </p>

          {action === 'moverSeccion' ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold px-2 py-1 rounded-lg bg-violet-500/20 text-violet-300">
                  🚀 MOVER SECCIÓN
                </span>
                <span className="text-xs text-slate-400 font-mono">{articleInput} · {ofInput}</span>
              </div>
              {!moverSeccionTargetShelf ? (
                <>
                  <p className="text-xs text-slate-500">Selecciona sección destino:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {ALL_SHELVES.filter((s) => s.code !== selectedShelf).map((s) => (
                      <button
                        key={s.code}
                        onClick={() => setMoverSeccionTargetShelf(s.code)}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-violet-100 border border-slate-300 hover:border-violet-400 text-slate-800 text-xs font-bold rounded-lg transition-colors"
                      >
                        {s.name}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-slate-500">
                      Destino: <span className="text-violet-600 font-bold">{SHELF_DEFINITIONS.find((s) => s.code === moverSeccionTargetShelf)?.name}</span>
                    </p>
                    <button
                      onClick={() => setMoverSeccionTargetShelf(null)}
                      className="text-xs text-slate-400 hover:text-slate-700 underline"
                    >
                      ← Cambiar
                    </button>
                  </div>
                  <div className="flex gap-2 items-center">
                    <input
                      type="number"
                      min={1}
                      placeholder="Nº posición destino (ej: 5)"
                      value={moverSeccionTargetPos}
                      onChange={(e) => setMoverSeccionTargetPos(e.target.value)}
                      className="flex-1 bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-violet-400"
                    />
                  </div>
                  {moverSeccionTargetPos && (
                    <button
                      onClick={handleMoverSeccionConfirm}
                      disabled={processing}
                      className="w-full py-2 bg-violet-600 hover:bg-violet-500 text-white font-bold text-sm rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      ✓ Mover a {SHELF_DEFINITIONS.find((s) => s.code === moverSeccionTargetShelf)?.name} pos. {moverSeccionTargetPos}
                    </button>
                  )}
                </>
              )}
              <button onClick={resetAction} className="text-xs text-slate-400 hover:text-red-500 text-right transition-colors">
                ✕ Cancelar
              </button>
            </div>
          ) : batchMode && (action === 'ubicar' || action === 'retirar') ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className={`text-xs font-bold px-2 py-1 rounded-lg
                    ${action === 'ubicar' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'}`}>
                    {action === 'ubicar' ? '📦 BATCH UBICAR' : '📤 BATCH RETIRAR'} ({action === 'ubicar' ? batchArticles.length : batchRetiraPending.length} artículos)
                  </span>
                </div>
              </div>
              {action === 'ubicar' && batchArticles.length > 0 && (
                <div className="text-xs text-slate-300 max-h-12 overflow-y-auto bg-slate-900/30 p-2 rounded">
                  {batchArticles.map((a, i) => (
                    <div key={i}>{a.articleCode} ({a.orderFab})</div>
                  ))}
                </div>
              )}
              {action === 'retirar' && batchRetiraPending.length > 0 && (
                <div className="text-xs text-slate-300 max-h-12 overflow-y-auto bg-slate-900/30 p-2 rounded">
                  {batchRetiraPending.map((a, i) => (
                    <div key={i}>{a.articleCode} ({a.orderFab}) - {a.locations.length} ubicación(es)</div>
                  ))}
                </div>
              )}
              {action === 'ubicar' && selectedPositions.length > 0 && (
                <div className="text-xs text-slate-300 bg-cyan-500/20 p-2 rounded border border-cyan-500/30">
                  Posiciones seleccionadas: {selectedPositions.map(p => parseInt(p, 10)).join(', ')}
                </div>
              )}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={articleInput}
                  onChange={(e) => setArticleInput(e.target.value)}
                  placeholder="Código artículo"
                  className="flex-1 bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-sky-400"
                />
                <input
                  type="text"
                  value={ofInput}
                  onChange={(e) => setOfInput(e.target.value)}
                  placeholder="OF"
                  className="w-20 bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-sky-400"
                />
                <button
                  onClick={handleAddToBatch}
                  className="px-3 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded-lg"
                >
                  + Añadir
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    if (action === 'ubicar') {
                      if (selectedPositions.length > 0) {
                        handleUbicarBatchConfirm();
                      } else {
                        showFeedback('error', 'Selecciona al menos una posición');
                      }
                    } else {
                      handleRetirarBatchNext();
                    }
                  }}
                  disabled={action === 'ubicar' && selectedPositions.length === 0}
                  className="flex-1 px-3 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  ✓ Finalizar {action === 'ubicar' ? 'ubicación' : 'retirada'}
                </button>
                <button
                  onClick={resetAction}
                  className="px-3 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 text-xs font-bold rounded-lg"
                >
                  ✕ Cancelar
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-xs font-bold px-2 py-1 rounded-lg
                  ${action === 'ubicar' ? 'bg-emerald-500/20 text-emerald-300' :
                    action === 'retirar' ? 'bg-red-500/20 text-red-300' :
                    action === 'reubicar' ? 'bg-amber-500/20 text-amber-300' :
                    'bg-blue-500/20 text-blue-300'}`}>
                  {action.toUpperCase()} activo
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  {articleInput} · {ofInput}
                </span>
                {action === 'ubicar' && selectedPositions.length === 0 && (
                  <span className="text-xs text-slate-500">Pulsa celdas del grid para seleccionar ubicaciones</span>
                )}
                {action === 'ubicar' && selectedPositions.length > 0 && (
                  <button
                    onClick={handleUbicarMultiPositionConfirm}
                    disabled={processing}
                    className="px-4 py-2 min-h-[44px] bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold rounded-xl shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    ✓ Confirmar ubicación en {selectedPositions.map((p) => parseInt(p, 10)).join(', ')}
                  </button>
                )}
                {action === 'reubicar' && reubicarSource && (
                  <span className="text-xs text-amber-400">Origen: {reubicarSource.position} → Elige destino</span>
                )}
                {action === 'mover' && (
                  <span className={`text-xs font-bold px-3 py-2 rounded-xl border
                    ${selectedPositions.length === moverNeeded ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                      selectedPositions.length > 0 ? 'bg-amber-100 text-amber-700 border-amber-200' :
                      'bg-slate-100 text-slate-500 border-slate-200'}`}>
                    {selectedPositions.length}/{moverNeeded} destinos
                    {selectedPositions.length === 0 && ' — pulsa celdas'}
                  </span>
                )}
                {action === 'mover' && selectedPositions.length === moverNeeded && (
                  <button
                    onClick={handleMoverConfirm}
                    disabled={processing}
                    className="px-4 py-2 min-h-[44px] bg-blue-600 hover:bg-blue-500 active:scale-95 text-white text-xs font-bold rounded-xl shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    🔄 Confirmar mover → {selectedPositions.map((p) => parseInt(p, 10)).join(', ')}
                  </button>
                )}
              </div>
              <button
                onClick={resetAction}
                className="text-xs text-slate-400 hover:text-white shrink-0"
              >
                Cancelar
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Feedback */}
       {feedback && (
         <div className={`mx-4 mb-1 p-3 rounded-xl text-center font-bold text-sm
           ${feedback.type === 'success' ? 'bg-emerald-500/20 text-emerald-400' :
             feedback.type === 'error' ? 'bg-red-500/20 text-red-400' :
             'bg-blue-500/20 text-blue-400'}`}>
           {feedback.msg}
         </div>
         )}

         {/* Occupancy bar — hidden in grid focus mode */}
      {!gridFocused && (
        <div className="px-4 py-1">
          <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-full transition-all duration-500"
              style={{ width: `${occupancyPct}%` }}
            />
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5 text-right">{occupancyPct}% ocupado</p>
        </div>
      )}

      {/* Banner de selección de celda */}
      {action !== 'idle' && action !== 'moverSeccion' && (
        <div className={`mx-3 mb-2 px-4 rounded-2xl flex items-center gap-3 transition-all
          ${gridFocused ? 'py-4 border-2 shadow-lg' : 'py-3 border animate-pulse'}
          ${action === 'ubicar' ? 'bg-emerald-500/20 border-emerald-500/60' :
            action === 'retirar' ? 'bg-red-500/20 border-red-500/60' :
            action === 'mover' ? 'bg-blue-500/20 border-blue-500/60' :
            'bg-amber-500/20 border-amber-500/60'}`}>
          <span className={`shrink-0 ${gridFocused ? 'text-3xl' : 'text-2xl'}`}>
            {action === 'ubicar' ? '📦' :
             action === 'retirar' ? '📤' :
             action === 'mover' ? '🔄' : '🔁'}
          </span>
          <div className="flex-1 min-w-0">
            <p className={`font-black leading-tight
              ${gridFocused ? 'text-base' : 'text-sm'}
              ${action === 'ubicar' ? 'text-emerald-700' :
                action === 'retirar' ? 'text-red-700' :
                action === 'mover' ? 'text-blue-700' :
                'text-amber-700'}`}>
              {action === 'ubicar' && selectedPositions.length === 0 && '👇 Toca una celda para seleccionar dónde ubicar'}
              {action === 'ubicar' && selectedPositions.length > 0 && `✅ ${selectedPositions.length} celda${selectedPositions.length > 1 ? 's' : ''} seleccionada${selectedPositions.length > 1 ? 's' : ''} — confirma arriba o añade más`}
              {action === 'retirar' && '👇 Toca la celda de donde quieres retirar'}
              {action === 'mover' && selectedPositions.length < moverNeeded && `👇 Selecciona ${moverNeeded - selectedPositions.length} celda${moverNeeded - selectedPositions.length > 1 ? 's' : ''} de destino (${selectedPositions.length}/${moverNeeded})`}
              {action === 'mover' && selectedPositions.length === moverNeeded && '✅ Celdas de destino listas — confirma arriba'}
              {action === 'reubicar' && !reubicarSource && '👇 Toca la celda con el artículo a reubicar'}
              {action === 'reubicar' && reubicarSource && '👇 Ahora toca la celda de destino'}
            </p>
            {gridFocused && action === 'ubicar' && selectedPositions.length > 0 && (
              <button
                onClick={handleUbicarMultiPositionConfirm}
                disabled={processing}
                className="mt-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold rounded-xl disabled:opacity-50 transition-colors active:scale-95"
              >
                ✓ Confirmar en {selectedPositions.map((p) => parseInt(p, 10)).join(', ')}
              </button>
            )}
            {gridFocused && action === 'mover' && selectedPositions.length === moverNeeded && (
              <button
                onClick={handleMoverConfirm}
                disabled={processing}
                className="mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-xl disabled:opacity-50 transition-colors active:scale-95"
              >
                🔄 Confirmar mover → {selectedPositions.map((p) => parseInt(p, 10)).join(', ')}
              </button>
            )}
          </div>
        </div>
      )}

          {/* Grid — scroll vertical; cada bloque gestiona su scroll horizontal */}
          <div className="flex-1 min-h-0 min-w-0 w-full overflow-y-auto overscroll-contain p-2 sm:p-4 pt-0 [scrollbar-width:thin] [scrollbar-color:rgba(30,41,59,0.8)_transparent]">
            {loading ? (
              <div className="flex items-center justify-center h-40">
                <div className="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <ShelfGrid
                locations={locations}
                shelfDef={shelfDef}
                onCellPress={action !== 'idle' && action !== 'moverSeccion' ? handleCellPress : undefined}
                selectedPositions={selectedPositions}
                highlightedPositions={[...highlightedPositions, ...foundPositions]}
                dragOverPosition={dragOverPosition}
                compact={false}
                fullscreenMode={true}
                onCellDragStart={handleDragStart}
                onCellDragEnter={handleDragEnter}
                onCellDragLeave={handleDragLeave}
                onCellDrop={handleDrop}
              />
            )}
          </div>
        </div>
      </div>

      <ConfirmationModal
        open={confirmModal.open}
        onClose={() => setConfirmModal((p) => ({ ...p, open: false }))}
        title={confirmModal.title}
        message={confirmModal.message}
        icon={confirmModal.icon}
        variant={confirmModal.variant}
        onConfirm={confirmModal.onConfirm}
        extraButton={confirmModal.extraButton}
        loading={processing}
      />

      <RetirarCellModal
        open={showRetirarCellModal}
        position={retirarCellPosition}
        items={retirarCellItems}
        onConfirm={handleRetirarCellItemsConfirm}
        onClose={() => setShowRetirarCellModal(false)}
        loading={processing}
      />

      {showRetirarArticleList && (
        <RetirarArticleList
          locations={locations}
          shelfCode={selectedShelf}
          onConfirm={handleRetirarArticleListConfirm}
          onClose={() => { setShowRetirarArticleList(false); resetAction(); }}
        />
      )}

      <ScanMethodPicker
        open={scanPickerOpen}
        actionLabel="Capturar artículo y OF"
        onSelect={applyScanMethod}
        onClose={() => setScanPickerOpen(false)}
      />

      {showCameraQR && (
        <CameraQRScanner
          onScan={(text) => { setShowCameraQR(false); handleCameraScan(text, false); }}
          onClose={() => setShowCameraQR(false)}
        />
      )}
      {showCameraOCR && (
        <CameraOCRScanner
          onResult={(text) => { setShowCameraOCR(false); handleCameraScan(text, true); }}
          onClose={() => setShowCameraOCR(false)}
        />
      )}

      {/* Manual entry modal */}
      {showManualEntry && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-lg font-black text-slate-900 mb-1">Introducir manualmente</h3>
            <p className="text-xs text-slate-500 mb-4">Escribe el código de artículo y la OF</p>
            <input
              autoFocus
              type="text"
              value={manualArticle}
              onChange={(e) => setManualArticle(e.target.value.toUpperCase())}
              onKeyDown={(e) => { if (e.key === 'Enter') (document.querySelector('#manual-of-input') as HTMLInputElement)?.focus(); }}
              placeholder="Código artículo (ej: 12345)"
              className="w-full border-2 border-slate-200 focus:border-sky-400 rounded-xl px-4 py-3 mb-3 text-slate-900 font-mono text-sm outline-none transition-colors"
            />
            <input
              id="manual-of-input"
              type="text"
              value={manualOf}
              onChange={(e) => setManualOf(e.target.value.toUpperCase())}
              onKeyDown={(e) => { if (e.key === 'Enter') confirmManualEntry(); }}
              placeholder="OF (ej: OF26-00657)"
              className="w-full border-2 border-slate-200 focus:border-sky-400 rounded-xl px-4 py-3 mb-5 text-slate-900 font-mono text-sm outline-none transition-colors"
            />
            <div className="flex gap-3">
              <button
                onClick={() => { setShowManualEntry(false); setManualArticle(''); setManualOf(''); }}
                className="flex-1 py-3 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmManualEntry}
                disabled={!manualArticle.trim() || !manualOf.trim()}
                className="flex-[2] py-3 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-xl disabled:opacity-40 transition-colors active:scale-[0.98]"
              >
                ✓ Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminShelfBrowser;


