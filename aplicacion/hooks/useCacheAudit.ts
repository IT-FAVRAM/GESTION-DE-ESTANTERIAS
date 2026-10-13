/**
 * useCacheAudit.ts — Hook para auditoría de caché offline
 * Gestor de Estanterías WMS v3.0
 */

import { useEffect, useState } from 'react';
import { generateCacheAuditReport, type CacheAuditReport } from '../lib/offline/cacheAudit';

export const useCacheAudit = (intervalMs: number = 30000) => {
  const [report, setReport] = useState<CacheAuditReport | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    const updateReport = () => {
      const newReport = generateCacheAuditReport();
      setReport(newReport);
      setLastUpdated(new Date());
    };

    updateReport();

    const interval = setInterval(updateReport, intervalMs);
    return () => clearInterval(interval);
  }, [intervalMs]);

  return { report, lastUpdated };
};


