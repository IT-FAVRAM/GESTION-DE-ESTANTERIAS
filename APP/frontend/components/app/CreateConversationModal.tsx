import React, { useState, useEffect } from 'react';
import { X, Loader2, Users } from 'lucide-react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { COLLECTIONS, SELECTABLE_MEMBER_ROLES } from '../../lib/firestoreSchema';
import type { UserDoc } from '../../lib/firestoreSchema';
import type { UserRole } from '../../lib/firestoreSchema';

interface UserEntry {
  uid: string;
  displayName: string;
  role: UserRole;
}

const ROLE_LABEL: Partial<Record<UserRole, string>> = {
  JEFE_SECCION: 'Jefe',
  CALIDAD: 'Calidad',
  CARRETILLERO: 'Carretillero',
};

const ROLE_BADGE: Partial<Record<UserRole, string>> = {
  JEFE_SECCION: 'bg-emerald-100 text-emerald-700',
  CALIDAD: 'bg-violet-100 text-violet-700',
  CARRETILLERO: 'bg-amber-100 text-amber-700',
};

interface CreateConversationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (name: string, memberUids: string[]) => Promise<unknown>;
  currentUid: string | null;
}

/**
 * Modal para crear una sala de conversación privada.
 * Solo visible para ADMIN/SUPERADMIN. Carga la lista de usuarios elegibles.
 */
export const CreateConversationModal: React.FC<CreateConversationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  currentUid,
}) => {
  const [name, setName] = useState('');
  const [users, setUsers] = useState<UserEntry[]>([]);
  const [selectedUids, setSelectedUids] = useState<Set<string>>(new Set());
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    setLoadingUsers(true);
    setError(null);
    setSelectedUids(new Set());
    setName('');

    const fetchUsers = async () => {
      try {
        const results: UserEntry[] = [];
        await Promise.all(
          SELECTABLE_MEMBER_ROLES.map(async (role) => {
            const q = query(
              collection(db, COLLECTIONS.USERS),
              where('role', '==', role),
            );
            const snap = await getDocs(q);
            snap.forEach((d) => {
              const data = d.data() as UserDoc;
              if (d.id !== currentUid) {
                results.push({
                  uid: d.id,
                  displayName: data.displayName || data.email || d.id,
                  role: data.role,
                });
              }
            });
          }),
        );
        results.sort((a, b) => a.displayName.localeCompare(b.displayName));
        setUsers(results);
      } catch (e) {
        console.error('[CreateConversationModal] Error cargando usuarios:', e);
        setError('Error al cargar la lista de usuarios.');
      } finally {
        setLoadingUsers(false);
      }
    };

    void fetchUsers();
  }, [isOpen, currentUid]);

  const toggleUser = (uid: string) => {
    setSelectedUids((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) {
        next.delete(uid);
      } else {
        next.add(uid);
      }
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || selectedUids.size === 0) return;

    setError(null);
    setSubmitting(true);
    try {
      await onConfirm(name.trim(), [...selectedUids]);
      onClose();
    } catch (e: any) {
      setError(e.message || 'Error al crear la sala.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 rounded-xl shadow-2xl w-full max-w-md mx-4 border border-slate-700 flex flex-col max-h-[90dvh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700 shrink-0">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-cyan-400" />
            <h2 className="text-base font-bold text-white">Nueva sala de chat</h2>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            className="p-1 hover:bg-slate-800 rounded-md transition-colors disabled:opacity-50"
          >
            <X className="h-5 w-5 text-slate-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-4 space-y-4 overflow-y-auto flex-1">
            {error && (
              <div className="p-3 bg-red-900/30 border border-red-700 rounded-md">
                <p className="text-sm text-red-200">{error}</p>
              </div>
            )}

            {/* Nombre */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Nombre de la sala <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej: Coordinación Calidad-Jefes"
                maxLength={80}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 disabled:opacity-50"
                disabled={submitting}
                required
              />
            </div>

            {/* Selector de miembros */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Participantes <span className="text-red-400">*</span>
                {selectedUids.size > 0 && (
                  <span className="ml-2 text-cyan-400 font-normal">({selectedUids.size} seleccionados)</span>
                )}
              </label>

              {loadingUsers ? (
                <div className="flex items-center justify-center py-6 text-slate-400 gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="text-sm">Cargando usuarios…</span>
                </div>
              ) : users.length === 0 ? (
                <p className="text-sm text-slate-500 py-4 text-center">No hay usuarios disponibles.</p>
              ) : (
                <div className="space-y-1 max-h-48 overflow-y-auto rounded-lg border border-slate-700">
                  {users.map((u) => (
                    <label
                      key={u.uid}
                      className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-slate-800 transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={selectedUids.has(u.uid)}
                        onChange={() => toggleUser(u.uid)}
                        disabled={submitting}
                        className="h-4 w-4 rounded accent-cyan-500"
                      />
                      <span className="flex-1 text-sm text-slate-200">{u.displayName}</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${ROLE_BADGE[u.role] || 'bg-slate-600 text-slate-200'}`}>
                        {ROLE_LABEL[u.role] || u.role}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Botones */}
          <div className="flex gap-2 p-4 border-t border-slate-700 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 px-4 py-2 bg-rose-700 hover:bg-rose-600 rounded-lg text-white font-medium transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting || !name.trim() || selectedUids.size === 0}
              className="flex-1 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 rounded-lg text-white font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creando…
                </>
              ) : (
                'Crear sala'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
