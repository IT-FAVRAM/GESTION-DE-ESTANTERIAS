import React from 'react';
import { adminApi } from '../../lib/api/adminApi';
import type { UserDoc } from '../../lib/firestoreSchema';

interface AdminUsersTabProps {
  users: Array<UserDoc & { uid: string }>;
}

const AdminUsersTab: React.FC<AdminUsersTabProps> = ({ users }) => (
  <div className="space-y-4">
    <div>
      <h2 className="text-lg font-black text-white">Usuarios del Sistema</h2>
      <p className="mt-1 text-sm text-slate-400">Roles y secciones sincronizados contra Firestore.</p>
    </div>

    <div className="space-y-3">
      {users.map((user) => (
        <div key={user.uid} className="rounded-3xl border border-slate-800 bg-slate-900 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="font-bold text-white">{user.displayName || user.email}</p>
              <p className="mt-1 text-xs text-slate-400">{user.email}</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <select
                value={user.role}
                onChange={(event) => adminApi.updateUser(user.uid, { role: event.target.value, section: user.section || null })}
                className="rounded-2xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
              >
                <option value="OPERARIO">Operario</option>
                <option value="CARRETILLERO">Carretillero</option>
                <option value="JEFE_SECCION">Jefe Seccion</option>
                <option value="CALIDAD">Calidad</option>
                <option value="ADMIN">Admin</option>
                <option value="SUPERADMIN">SuperAdmin</option>
              </select>

              {user.role === 'JEFE_SECCION' && (
                <select
                  value={user.section || ''}
                  onChange={(event) => adminApi.updateUser(user.uid, { role: user.role, section: event.target.value || null })}
                  className="rounded-2xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
                >
                  <option value="">Sin seccion</option>
                  <option value="MECANIZADO">Mecanizado</option>
                  <option value="PLEGADORA">Plegadora</option>
                  <option value="SOLDADURA">Soldadura</option>
                  <option value="REPASADO">Repasado</option>
                  <option value="PINTURA">Pintura</option>
                  <option value="LASER">Laser</option>
                  <option value="AUTOPLEGADORA">Autoplegadora</option>
                </select>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

export default AdminUsersTab;
