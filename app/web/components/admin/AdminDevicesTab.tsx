import React from 'react';
import { adminApi } from '../../lib/api/adminApi';
import { SHELF_DEFINITIONS, type DeviceDoc } from '../../lib/firestoreSchema';
import type { CurrentDeviceDraft } from './adminShared';

interface AdminDevicesTabProps {
  devices: Array<DeviceDoc & { id: string }>;
  currentDeviceId?: string;
  currentDeviceDraft: CurrentDeviceDraft;
  onCurrentDeviceDraftChange: React.Dispatch<React.SetStateAction<CurrentDeviceDraft>>;
}

const AdminDevicesTab: React.FC<AdminDevicesTabProps> = ({ devices, currentDeviceId, currentDeviceDraft, onCurrentDeviceDraftChange }) => (
  <div className="space-y-4">
    <div>
      <h2 className="text-lg font-black text-white">Dispositivos Registrados</h2>
      <p className="mt-1 text-sm text-slate-400">Gestion de kioskos y tablets de carretillero vinculadas al nuevo WMS.</p>
    </div>

    {currentDeviceId && (
      <div className="rounded-3xl border border-cyan-500/20 bg-cyan-500/10 p-5">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="font-black text-white">Configurar este navegador como dispositivo virtual</h3>
            <p className="mt-1 text-xs text-cyan-100/80">Sin hardware fisico: usa este mismo navegador como kiosko o tablet de carretillero.</p>
            <p className="mt-2 text-xs text-cyan-300">ID actual: <span className="font-mono">{currentDeviceId}</span></p>
          </div>
          <button
            type="button"
            onClick={() => navigator.clipboard?.writeText(currentDeviceId).catch(() => undefined)}
            className="rounded-2xl border border-cyan-400/20 bg-slate-950 px-4 py-2 text-xs font-bold text-cyan-300 transition hover:bg-slate-900"
          >
            Copiar ID
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-4">
          <input
            value={currentDeviceDraft.name}
            onChange={(event) => onCurrentDeviceDraftChange((current) => ({ ...current, name: event.target.value }))}
            placeholder="Nombre del dispositivo"
            className="rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
          />
          <select
            value={currentDeviceDraft.type}
            onChange={(event) => onCurrentDeviceDraftChange((current) => ({ ...current, type: event.target.value as DeviceDoc['type'] }))}
            className="rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
          >
            <option value="KIOSK">Kiosko</option>
            <option value="CARRETILLERO">Carretillero</option>
          </select>
          <select
            value={currentDeviceDraft.type === 'KIOSK' ? currentDeviceDraft.shelf : ''}
            onChange={(event) => onCurrentDeviceDraftChange((current) => ({ ...current, shelf: event.target.value || 'MEC' }))}
            disabled={currentDeviceDraft.type !== 'KIOSK'}
            className="rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-50"
          >
            {SHELF_DEFINITIONS.map((shelf) => (
              <option key={shelf.code} value={shelf.code}>{shelf.name}</option>
            ))}
          </select>
          <label className="flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white">
            <input
              type="checkbox"
              checked={currentDeviceDraft.active}
              onChange={(event) => onCurrentDeviceDraftChange((current) => ({ ...current, active: event.target.checked }))}
            />
            Activo
          </label>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => adminApi.upsertDevice(currentDeviceId, {
              name: currentDeviceDraft.name.trim() || 'Navegador actual',
              type: currentDeviceDraft.type,
              assignedShelf: currentDeviceDraft.type === 'KIOSK' ? currentDeviceDraft.shelf : null,
              active: currentDeviceDraft.active,
              lastSeen: new Date().toISOString(),
            })}
            className="rounded-2xl bg-cyan-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-cyan-500"
          >
            Guardar en este navegador
          </button>
          <button
            type="button"
            onClick={async () => {
              await adminApi.upsertDevice(currentDeviceId, {
                name: 'Tablet Carretillero Virtual',
                type: 'CARRETILLERO',
                assignedShelf: null,
                active: true,
                lastSeen: new Date().toISOString(),
              });
              onCurrentDeviceDraftChange({ name: 'Tablet Carretillero Virtual', type: 'CARRETILLERO', shelf: 'MEC', active: true });
            }}
            className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-bold text-emerald-300 transition hover:bg-emerald-500/20"
          >
            Modo carretillero virtual
          </button>
        </div>
      </div>
    )}

    {devices.length === 0 ? (
      <div className="rounded-3xl border border-slate-800 bg-slate-900 p-8 text-center text-slate-500">Aun no hay dispositivos registrados.</div>
    ) : (
      <div className="space-y-3">
        {devices.map((device) => (
          <div key={device.id} className="flex flex-col gap-3 rounded-3xl border border-slate-800 bg-slate-900 p-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="font-bold text-white">{device.name || device.id}</p>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${device.active !== false ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' : 'bg-slate-700 text-slate-400'}`}>
                  {device.active !== false ? 'ACTIVO' : 'INACTIVO'}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-400">{device.type} · {device.assignedShelf || 'Sin estanteria'}</p>
              <p className="mt-1 text-xs text-slate-600">Ultimo acceso: {device.lastSeen ? new Date(device.lastSeen).toLocaleString('es-ES') : 'N/D'}</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => adminApi.updateDevice(device.id, { active: device.active === false })}
                className={`rounded-2xl border px-3 py-2 text-sm font-bold transition ${device.active === false ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20' : 'border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20'}`}
              >
                {device.active === false ? 'Activar' : 'Desactivar'}
              </button>

              <select
                value={device.assignedShelf || ''}
                onChange={(event) => adminApi.updateDevice(device.id, { assignedShelf: event.target.value || null })}
                className="rounded-2xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
              >
                <option value="">Sin asignar</option>
                {SHELF_DEFINITIONS.map((shelf) => (
                  <option key={shelf.code} value={shelf.code}>{shelf.name}</option>
                ))}
              </select>

              <select
                value={device.type || 'KIOSK'}
                onChange={(event) => adminApi.updateDevice(device.id, { type: event.target.value as DeviceDoc['type'] })}
                className="rounded-2xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
              >
                <option value="KIOSK">Kiosko</option>
                <option value="CARRETILLERO">Carretillero</option>
              </select>
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
);

export default AdminDevicesTab;
