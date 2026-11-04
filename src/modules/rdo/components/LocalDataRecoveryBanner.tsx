import React, { useEffect, useState } from 'react';
import { AlertTriangle, CloudUpload, Download, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../../../contexts/AuthContext';
import { useProjectStore } from '../src/stores/projectStore';
import { usePlanningStore } from '../src/stores/planningStore';
import { applyDailyPlanChanges, getDailyPlans } from '../services/dailyPlanService';
import {
  getCompositions, getDimensions, getHistograms,
  saveCompositions, saveDimensionRecord, saveHistograms,
} from '../services/firestoreService';
import {
  PendingLocalData, RemoteSnapshot, clearLegacyLocalData, countPending,
  downloadLocalSnapshot, findPendingLocalData, hasLegacyLocalData, readLocalSnapshot,
} from '../services/localRecoveryService';

const WRITE_ROLES = ['CONSTRUCTION_ADMIN', 'CONSTRUCTION_MANAGER'];

/** Compara as cópias locais antigas com o banco. Sem pendências, limpa o navegador. */
const checkLocalData = async (): Promise<PendingLocalData | null> => {
  if (!hasLegacyLocalData()) return null;
  const local = readLocalSnapshot();
  const { projects } = useProjectStore.getState();
  const { dailyPlans, contractDataMap } = usePlanningStore.getState();

  const ids = (record: Record<string, unknown>) => Object.keys(record);
  const [dimensions, compositions, histograms] = await Promise.all([
    Promise.all(ids(local.dimensions).map(async (id) => [id, await getDimensions(id)] as const)),
    Promise.all(ids(local.compositions).map(async (id) => [id, await getCompositions(id)] as const)),
    Promise.all(ids(local.histograms).map(async (id) => [id, (await getHistograms(id)).length] as const)),
  ]);
  const remote: RemoteSnapshot = {
    dailyPlans,
    contracts: contractDataMap,
    dimensions: Object.fromEntries(dimensions),
    compositions: Object.fromEntries(compositions),
    histogramCounts: Object.fromEntries(histograms),
  };

  const pending = findPendingLocalData(local, remote, new Set(projects.map((p) => p.id)));
  if (countPending(pending) === 0) {
    clearLegacyLocalData();
    return null;
  }
  return pending;
};

const uploadPending = async (pending: PendingLocalData): Promise<void> => {
  const now = new Date().toISOString();
  if (pending.dailyPlans.length > 0) {
    await applyDailyPlanChanges({
      upserts: pending.dailyPlans.map((p) => ({ ...p, updatedAt: p.updatedAt || now })),
      deletes: [],
    });
    usePlanningStore.getState().actions.setDailyPlans(await getDailyPlans());
  }
  for (const contract of pending.contracts) {
    await usePlanningStore.getState().actions.saveContractData(contract);
  }
  for (const record of pending.dimensions) {
    await saveDimensionRecord(record);
  }
  for (const result of pending.compositions) {
    await saveCompositions(result.projectId, result);
  }
  for (const { projectId, items } of pending.histograms) {
    await saveHistograms(projectId, items);
  }
};

export const LocalDataRecoveryBanner: React.FC<{ ready: boolean }> = ({ ready }) => {
  const { profile } = useAuth();
  const [pending, setPending] = useState<PendingLocalData | null>(null);
  const [busy, setBusy] = useState(false);

  const rdoModule = profile?.modules?.construction_rdo;
  const canWrite = !!profile?.isSuperAdmin ||
    (!!rdoModule?.enabled && WRITE_ROLES.includes(rdoModule.role ?? ''));

  useEffect(() => {
    if (!ready) return;
    checkLocalData()
      .then(setPending)
      .catch((err) => console.error('[RDO] Falha ao comparar dados locais com o banco', err));
  }, [ready]);

  if (!pending) return null;

  const summary = [
    pending.dailyPlans.length && `${pending.dailyPlans.length} dia(s) de planejamento`,
    pending.contracts.length && `${pending.contracts.length} contrato(s)`,
    pending.dimensions.length && `${pending.dimensions.length} planilha(s) de dimensões`,
    pending.compositions.length && `${pending.compositions.length} conjunto(s) de composições`,
    pending.histograms.length && `${pending.histograms.length} histograma(s)`,
  ].filter(Boolean).join(', ');

  const handleUpload = async () => {
    setBusy(true);
    try {
      await uploadPending(pending);
      clearLegacyLocalData();
      setPending(null);
      toast.success('Dados enviados ao banco. Agora todos os usuários os veem.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível enviar os dados.');
    } finally {
      setBusy(false);
    }
  };

  const handleDiscard = () => {
    if (!confirm('Descartar as cópias deste navegador? Baixe o arquivo antes se ainda precisar delas.')) return;
    clearLegacyLocalData();
    setPending(null);
  };

  return (
    <div className="mb-8 p-6 bg-amber-500/10 border border-amber-500/25 rounded-3xl text-amber-200 text-sm animate-fade-in">
      <div className="flex items-start gap-4">
        <AlertTriangle className="w-6 h-6 shrink-0 text-amber-400" />
        <div className="flex-1 space-y-3">
          <p className="font-bold text-amber-100">Há dados salvos só neste navegador</p>
          <p>
            {summary}. Uma versão anterior do RDO Online guardava esses dados apenas neste computador;
            os outros usuários não os veem.
            {!canWrite && ' Seu perfil é só de leitura: baixe o arquivo e entregue a um Gerente do RDO Online para enviar.'}
          </p>
          <div className="flex flex-wrap gap-3">
            {canWrite && (
              <button
                onClick={handleUpload}
                disabled={busy}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold hover:bg-amber-400 disabled:opacity-50"
              >
                <CloudUpload className="w-4 h-4" /> {busy ? 'Enviando...' : 'Enviar para o banco'}
              </button>
            )}
            <button
              onClick={() => downloadLocalSnapshot(pending)}
              disabled={busy}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-amber-500/40 hover:bg-amber-500/10 disabled:opacity-50"
            >
              <Download className="w-4 h-4" /> Baixar arquivo
            </button>
            <button
              onClick={handleDiscard}
              disabled={busy}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-amber-300/80 hover:text-amber-200 disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" /> Descartar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
