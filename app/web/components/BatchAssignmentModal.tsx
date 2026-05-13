
import React, { useState, useMemo } from 'react';
import { Assignments, LocationId } from '../lib/warehouseData';
import { WarehouseConfig } from '../hooks/useWarehouseConfig';
import { CloseIcon, ErrorIcon, CheckIcon, MapIcon } from './Icons';
import { BatchItem } from '../types/batch';

interface BatchAssignmentModalProps {
  items: BatchItem[];
  onAssignBatch: (mappedItems: { item: BatchItem; location: LocationId }[]) => void;
  onClose: () => void;
  assignments: Assignments;
  config: WarehouseConfig;
}

const BatchAssignmentModal: React.FC<BatchAssignmentModalProps> = ({ items, onAssignBatch, onClose, assignments, config }) => {
  const [mode, setMode] = useState<'single' | 'sequential'>('single');
  
  // Generate all potential locations based on current config
  const allLocations: LocationId[] = useMemo(() => {
    return config.warehouses.flatMap(wh =>
      config.shelves.flatMap(shelf =>
        config.racks.flatMap(rack =>
          config.positions.map(pos => `${wh.code}-E${shelf}-B${rack}-${pos}` as LocationId)
        )
      )
    );
  }, [config]);

  const [startLocation, setStartLocation] = useState<LocationId>(allLocations[0] || 'MEC-E1-B1-IZQ');

  const occupiedLocations = useMemo(() => {
    const occupied = new Set<LocationId>();
    Object.keys(assignments).forEach(loc => occupied.add(loc as LocationId));
    return occupied;
  }, [assignments]);

  const assignmentPreview = useMemo(() => {
    const mappedResult: { item: BatchItem; location: LocationId }[] = [];
    const errors: string[] = [];

    if (mode === 'single') {
        // All items to ONE location
        for (const item of items) {
            mappedResult.push({ item, location: startLocation });
        }
    } else {
        // Sequential distribution
        let currentLocationIndex = allLocations.indexOf(startLocation);
        if (currentLocationIndex === -1) {
            errors.push("Ubicación inicial inválida o no encontrada.");
            return { mappedResult: [], errors };
        }

        // Strategy: Fill sequential empty slots
        for (const item of items) {
            let foundSpot = false;
            // Search for next empty spot
            while (currentLocationIndex < allLocations.length) {
                const potentialLocation = allLocations[currentLocationIndex];
                if (!occupiedLocations.has(potentialLocation)) {
                    mappedResult.push({ item, location: potentialLocation });
                    foundSpot = true;
                    currentLocationIndex++; // Move to next for next item
                    break;
                }
                currentLocationIndex++;
            }
            if (!foundSpot) {
                errors.push(`No hay suficiente espacio secuencial (vacío) desde el punto de partida.`);
                break;
            }
        }
    }
    
    return { mappedResult, errors };
  }, [startLocation, items, occupiedLocations, mode, allLocations]);
  
  const handleAssign = () => {
    if (assignmentPreview.errors.length === 0) {
      onAssignBatch(assignmentPreview.mappedResult);
    }
  };

  // Helper logic for dropdowns
  const handleLocationChange = (part: 'wh' | 'shelf' | 'rack' | 'pos', value: string) => {
    const parts = startLocation.split('-');
    let wh = parts[0] || config.warehouses[0]?.code;
    let shelf = parts[1]?.substring(1) || String(config.shelves[0]);
    let rack = parts[2]?.substring(1) || String(config.racks[0]);
    let pos = parts[3] || config.positions[0];
    
    switch(part) {
        case 'wh': wh = value; break;
        case 'shelf': shelf = value; break;
        case 'rack': rack = value; break;
        case 'pos': pos = value; break;
    }
    setStartLocation(`${wh}-E${shelf}-B${rack}-${pos}` as LocationId);
  };

  const startLocationParts = useMemo(() => {
    const parts = startLocation.split('-');
    return {
        wh: parts[0] || '',
        shelf: parts[1]?.substring(1) || '',
        rack: parts[2]?.substring(1) || '',
        pos: parts[3] || ''
    };
  }, [startLocation]);


  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="relative w-full max-w-3xl bg-slate-900 rounded-2xl shadow-xl border border-slate-800 flex flex-col max-h-[90vh]">
        <header className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-900 rounded-t-2xl">
          <div>
              <h2 className="text-xl font-bold text-white">Asignación de Lote</h2>
              <p className="text-sm text-slate-400">Distribuyendo <span className="text-cyan-400 font-bold">{items.length}</span> artículos</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white bg-slate-800 rounded-full hover:bg-slate-700 transition-colors">
            <CloseIcon className="h-6 w-6" />
          </button>
        </header>
        
        <div className="overflow-y-auto p-6 flex-grow space-y-6">
          
          {/* Mode Selector */}
          <div className="grid grid-cols-2 gap-4">
              <button 
                onClick={() => setMode('single')}
                className={`p-4 rounded-xl border-2 transition-all text-left flex flex-col gap-2 ${mode === 'single' ? 'bg-cyan-900/20 border-cyan-500 ring-1 ring-cyan-500' : 'bg-slate-800 border-slate-700 hover:border-slate-500'}`}
              >
                  <div className="flex justify-between items-center w-full">
                      <span className={`font-bold ${mode === 'single' ? 'text-cyan-400' : 'text-slate-300'}`}>Ubicación Única</span>
                      {mode === 'single' && <CheckIcon className="h-5 w-5 text-cyan-400"/>}
                  </div>
                  <p className="text-xs text-slate-400">Todos los artículos van al mismo hueco (Palet completo).</p>
              </button>
              <button 
                onClick={() => setMode('sequential')}
                className={`p-4 rounded-xl border-2 transition-all text-left flex flex-col gap-2 ${mode === 'sequential' ? 'bg-purple-900/20 border-purple-500 ring-1 ring-purple-500' : 'bg-slate-800 border-slate-700 hover:border-slate-500'}`}
              >
                  <div className="flex justify-between items-center w-full">
                      <span className={`font-bold ${mode === 'sequential' ? 'text-purple-400' : 'text-slate-300'}`}>Distribución Secuencial</span>
                      {mode === 'sequential' && <CheckIcon className="h-5 w-5 text-purple-400"/>}
                  </div>
                  <p className="text-xs text-slate-400">Rellena huecos vacíos uno a uno desde el punto de partida.</p>
              </button>
          </div>

          <div className="bg-slate-800/50 p-5 rounded-xl border border-slate-700">
            <h3 className="font-bold text-sm text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <MapIcon className="h-4 w-4" />
                {mode === 'single' ? 'Ubicación Destino' : 'Punto de Partida'}
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <select value={startLocationParts.wh} onChange={e => handleLocationChange('wh', e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white focus:border-cyan-500 outline-none">
                {config.warehouses.map(wh => <option key={wh.code} value={wh.code}>{wh.name}</option>)}
              </select>
              <select value={startLocationParts.shelf} onChange={e => handleLocationChange('shelf', e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white focus:border-cyan-500 outline-none">
                {config.shelves.map(s => <option key={s} value={s}>Estantería {s}</option>)}
              </select>
              <select value={startLocationParts.rack} onChange={e => handleLocationChange('rack', e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white focus:border-cyan-500 outline-none">
                {config.racks.map(r => <option key={r} value={r}>Rack {r}</option>)}
              </select>
              <select value={startLocationParts.pos} onChange={e => handleLocationChange('pos', e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white focus:border-cyan-500 outline-none">
                {config.positions.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
          
          <div className="flex-grow flex flex-col min-h-0">
            <h3 className="font-bold text-sm text-slate-400 uppercase tracking-wider mb-3">Previsualización de Asignación</h3>
            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden flex flex-col">
              <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                      <thead className="bg-slate-900 text-slate-400 font-bold uppercase text-xs border-b border-slate-700">
                          <tr>
                              <th className="p-3 w-1/3">Artículo</th>
                              <th className="p-3 w-1/4">OF</th>
                              <th className="p-3 text-right">Destino</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-700">
                          {assignmentPreview.mappedResult.map((entry, idx) => (
                              <tr key={idx} className="hover:bg-slate-700/30 transition-colors">
                                  <td className="p-3 font-bold text-white">{entry.item.article}</td>
                                  <td className="p-3 font-mono text-purple-400">{entry.item.order}</td>
                                  <td className="p-3 text-right font-mono text-cyan-400">
                                      {entry.location}
                                      {entry.location.includes('URGENTE') && <span className="ml-2 text-[10px] bg-red-900 text-red-200 px-1 rounded">URG</span>}
                                  </td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
              
              {assignmentPreview.mappedResult.length === 0 && !assignmentPreview.errors.length && (
                  <div className="p-8 text-center text-slate-500">
                      No hay asignaciones pendientes.
                  </div>
              )}

              {assignmentPreview.errors.length > 0 && (
                <div className="p-4 bg-red-900/20 text-red-400 border-t border-red-900/50 flex items-center gap-3">
                   <ErrorIcon className="h-5 w-5 flex-shrink-0"/>
                   <p className="font-bold">{assignmentPreview.errors[0]}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <footer className="p-5 border-t border-slate-800 bg-slate-900 rounded-b-2xl flex justify-end gap-3">
          <button onClick={onClose} className="px-6 py-3 bg-slate-800 text-slate-300 font-bold rounded-xl hover:bg-slate-700 transition-colors border border-slate-700">
            Cancelar
          </button>
          <button
            onClick={handleAssign}
            disabled={assignmentPreview.errors.length > 0 || items.length === 0}
            className="px-8 py-3 bg-cyan-600 text-white font-bold rounded-xl hover:bg-cyan-500 shadow-lg shadow-cyan-900/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all active:scale-[0.98]"
          >
            <CheckIcon className="h-5 w-5" />
            Confirmar Asignación
          </button>
        </footer>
      </div>
    </div>
  );
};

export default BatchAssignmentModal;
