import { ContractData } from '../types';
import { generateUUID } from '../utils';

const STORAGE_PREFIX = 'contract_data_';

/**
 * Recupera os dados do contrato de uma obra do localStorage.
 */
export const getContractData = (projectId: string): ContractData | null => {
  const raw = localStorage.getItem(`${STORAGE_PREFIX}${projectId}`);
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as ContractData;
    let needsMigration = false;
    
    if (data.monthlyEntries) {
      data.monthlyEntries = data.monthlyEntries.map((e: any) => {
        if (!e.id) {
          needsMigration = true;
          const [y, m] = (e.monthKey || '').split('-');
          let dtStart = '';
          let dtEnd = '';
          let dtName = '';
          if (y && m) {
            const dt = new Date(Number(y), Number(m) - 1, 1);
            dtName = dt.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
            const lastDay = new Date(Number(y), Number(m), 0).getDate();
            dtStart = `${y}-${m}-01`;
            dtEnd = `${y}-${m}-${String(lastDay).padStart(2, '0')}`;
          }
          return {
            id: generateUUID(),
            name: dtName || 'Período Legado',
            startDate: dtStart,
            endDate: dtEnd,
            monthKey: e.monthKey,
            budget: e.budget ?? 0,
            forecast: e.forecast ?? 0,
            measured: e.measured ?? 0
          };
        }
        return e;
      });
    }

    if (needsMigration) {
      saveContractData(data);
    }
    
    return data;
  } catch {
    return null;
  }
};

/**
 * Persiste os dados do contrato de uma obra no localStorage.
 */
export const saveContractData = (data: ContractData): void => {
  localStorage.setItem(
    `${STORAGE_PREFIX}${data.projectId}`,
    JSON.stringify({ ...data, updatedAt: new Date().toISOString() })
  );
};

/**
 * Remove os dados do contrato de uma obra do localStorage.
 */
export const deleteContractData = (projectId: string): void => {
  localStorage.removeItem(`${STORAGE_PREFIX}${projectId}`);
};

/**
 * Retorna um ContractData vazio para um projeto (estado inicial).
 */
export const emptyContractData = (projectId: string): ContractData => ({
  projectId,
  contractValue: 0,
  contractStartDate: '',
  contractEndDate: '',
  monthlyEntries: [],
  addenda: [],
  updatedAt: new Date().toISOString(),
});
