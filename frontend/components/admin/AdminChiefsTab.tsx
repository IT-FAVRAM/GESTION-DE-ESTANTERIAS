import React from 'react';
import type { AppConfig } from '../../lib/firestoreSchema';
import { linesToArray } from './adminShared';

interface AdminChiefsTabProps {
  config: AppConfig;
  chiefDrafts: Record<string, string>;
  qualityDraft: string;
  setChiefDrafts: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setQualityDraft: React.Dispatch<React.SetStateAction<string>>;
  onSaveConfig: (updates: Partial<AppConfig>) => Promise<void>;
}

const AdminChiefsTab: React.FC<AdminChiefsTabProps> = ({ config, chiefDrafts, qualityDraft, setChiefDrafts, setQualityDraft, onSaveConfig }) => (
  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
    {Object.entries(config.chiefMapping).map(([section, emails]) => (
      <div key={section} className="rounded-3xl border border-slate-800 bg-slate-900 p-5">
        <h2 className="text-lg font-black text-white">{section}</h2>
        <textarea
          value={chiefDrafts[section] ?? emails.join('\n')}
          onChange={(event) => setChiefDrafts((current) => ({ ...current, [section]: event.target.value }))}
          className="mt-4 min-h-36 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-200 outline-none"
        />
        <button type="button" onClick={() => void onSaveConfig({ chiefMapping: { ...config.chiefMapping, [section]: linesToArray(chiefDrafts[section] ?? '') } })} className="mt-4 rounded-2xl bg-cyan-600 px-4 py-2 text-sm font-black text-white">Guardar {section}</button>
      </div>
    ))}

    <div className="rounded-3xl border border-slate-800 bg-slate-900 p-5">
      <h2 className="text-lg font-black text-white">Calidad</h2>
      <textarea value={qualityDraft} onChange={(event) => setQualityDraft(event.target.value)} className="mt-4 min-h-36 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-200 outline-none" />
      <button type="button" onClick={() => void onSaveConfig({ qualityEmails: linesToArray(qualityDraft) })} className="mt-4 rounded-2xl bg-cyan-600 px-4 py-2 text-sm font-black text-white">Guardar calidad</button>
    </div>
  </div>
);

export default AdminChiefsTab;


