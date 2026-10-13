import React, { useState } from 'react';
import AdminUsersTab from './AdminUsersTab';
import AdminDevicesTab from './AdminDevicesTab';
import type { UserDoc, DeviceDoc } from '../../lib/firestoreSchema';
import type { CurrentDeviceDraft } from './adminShared';

interface AdminUsersAndDevicesTabProps {
  users: Array<UserDoc & { uid: string }>;
  devices: Array<DeviceDoc & { id: string }>;
  currentDeviceId?: string;
  currentDeviceDraft: CurrentDeviceDraft;
  onCurrentDeviceDraftChange: React.Dispatch<React.SetStateAction<CurrentDeviceDraft>>;
}

type InnerTab = 'users' | 'devices';

const AdminUsersAndDevicesTab: React.FC<AdminUsersAndDevicesTabProps> = ({
  users,
  devices,
  currentDeviceId,
  currentDeviceDraft,
  onCurrentDeviceDraftChange,
}) => {
  const [inner, setInner] = useState<InnerTab>('users');

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setInner('users')}
          className={`rounded-full border px-4 py-2 text-sm font-bold transition ${
            inner === 'users'
              ? 'border-cyan-400/30 bg-cyan-500/15 text-cyan-300'
              : 'border-slate-800 bg-slate-900 text-slate-500 hover:text-slate-300'
          }`}
        >
          Usuarios
        </button>
        <button
          type="button"
          onClick={() => setInner('devices')}
          className={`rounded-full border px-4 py-2 text-sm font-bold transition ${
            inner === 'devices'
              ? 'border-cyan-400/30 bg-cyan-500/15 text-cyan-300'
              : 'border-slate-800 bg-slate-900 text-slate-500 hover:text-slate-300'
          }`}
        >
          Dispositivos
        </button>
      </div>

      {inner === 'users' && <AdminUsersTab users={users} />}
      {inner === 'devices' && (
        <AdminDevicesTab
          devices={devices}
          currentDeviceId={currentDeviceId}
          currentDeviceDraft={currentDeviceDraft}
          onCurrentDeviceDraftChange={onCurrentDeviceDraftChange}
        />
      )}
    </div>
  );
};

export default AdminUsersAndDevicesTab;
