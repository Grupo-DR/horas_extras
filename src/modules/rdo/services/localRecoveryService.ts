/**
 * Recuperação de dados do RDO Online que ficaram só no navegador.
 *
 * Até a versão 1.4.2 o planejamento diário era gravado apenas no localStorage, e
 * contratos, dimensões, composições e histogramas tinham cópia local com falhas
 * do Firestore ignoradas. Quem salvou sem permissão (Visualizador), ou entre
 * 12/10 e 04/11/2026 (regras bloqueando as coleções), viu "Salvo" com o dado
 * apenas no próprio computador.
 *
 * Ao abrir o módulo, as cópias locais são comparadas com o banco:
 *  - o que só existe no navegador (ou é mais novo e diferente) é oferecido para envio;
 *  - cópias iguais ao banco são apagadas do navegador (eram só cache e ficavam
 *    visíveis para o próximo usuário do mesmo computador).
 * Histogramas não têm data de alteração: só são oferecidos quando o banco não tem
 * nenhum item da obra, para nunca sobrescrever um histograma mais novo.
 */
import { ContractData, DailyPlan, HistogramItem } from '../types';
import {
  CompositionAIExtractionResult,
  DimensionStoredRecord,
} from '../src/analytics/types/analyticsTypes';

export const LEGACY_DAILY_PLANS_KEY = 'daily_plans';
export const LEGACY_PREFIXES = {
  contract: 'contract_data_',
  dimensions: 'dimensions_',
  compositions: 'compositions_',
  histograms: 'histograms_',
} as const;

export interface LocalSnapshot {
  dailyPlans: DailyPlan[];
  contracts: Record<string, ContractData>;
  dimensions: Record<string, DimensionStoredRecord>;
  compositions: Record<string, CompositionAIExtractionResult>;
  histograms: Record<string, HistogramItem[]>;
}

export interface RemoteSnapshot {
  dailyPlans: DailyPlan[];
  contracts: Record<string, ContractData>;
  dimensions: Record<string, DimensionStoredRecord | null>;
  compositions: Record<string, CompositionAIExtractionResult | null>;
  histogramCounts: Record<string, number>;
}

export interface PendingLocalData {
  dailyPlans: DailyPlan[];
  contracts: ContractData[];
  dimensions: DimensionStoredRecord[];
  compositions: CompositionAIExtractionResult[];
  histograms: { projectId: string; items: HistogramItem[] }[];
}

export const countPending = (p: PendingLocalData): number =>
  p.dailyPlans.length + p.contracts.length + p.dimensions.length + p.compositions.length + p.histograms.length;

/** JSON com chaves ordenadas, para comparar documentos vindos do banco e do navegador. */
const stableStringify = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value as Record<string, unknown>)
      .filter((k) => (value as Record<string, unknown>)[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value ?? null);
};

const sameContent = (a: object, b: object, ignore: string[]): boolean => {
  const strip = (o: object) =>
    Object.fromEntries(Object.entries(o).filter(([k]) => !ignore.includes(k)));
  return stableStringify(strip(a)) === stableStringify(strip(b));
};

/** Local mais novo que o banco e com conteúdo diferente (ou ausente no banco). */
const isNewer = <T extends object>(local: T, remote: T | null | undefined, stamp: keyof T, ignore: string[]): boolean => {
  if (!remote) return true;
  if (sameContent(local, remote, ignore)) return false;
  return String(local[stamp] ?? '') > String(remote[stamp] ?? '');
};

export const findPendingLocalData = (
  local: LocalSnapshot,
  remote: RemoteSnapshot,
  existingProjectIds: Set<string>
): PendingLocalData => {
  const remotePlans = new Map(remote.dailyPlans.map((p) => [p.id, p]));
  const known = (projectId: string) => existingProjectIds.has(projectId);

  return {
    dailyPlans: local.dailyPlans.filter((p) => {
      if (!known(p.projectId)) return false;
      const r = remotePlans.get(p.id);
      if (!r) return p.value !== 0;
      return r.value !== p.value && String(p.updatedAt ?? '') > String(r.updatedAt ?? '');
    }),
    contracts: Object.values(local.contracts).filter((c) =>
      known(c.projectId) && isNewer(c, remote.contracts[c.projectId], 'updatedAt', ['updatedAt'])
    ),
    dimensions: Object.values(local.dimensions).filter((d) =>
      known(d.projectId) && isNewer(d, remote.dimensions[d.projectId], 'updatedAt', ['updatedAt'])
    ),
    compositions: Object.values(local.compositions).filter((c) =>
      known(c.projectId) && isNewer(c, remote.compositions[c.projectId], 'extractedAt', ['updatedAt', 'projectId'])
    ),
    histograms: Object.entries(local.histograms)
      .filter(([projectId, items]) => known(projectId) && items.length > 0 && !remote.histogramCounts[projectId])
      .map(([projectId, items]) => ({ projectId, items })),
  };
};

// ─── Leitura e limpeza do localStorage ────────────────────────────────────────

const readJson = <T>(key: string): T | null => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};

const legacyKeys = (): string[] => {
  const keys: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (key === LEGACY_DAILY_PLANS_KEY || Object.values(LEGACY_PREFIXES).some((p) => key.startsWith(p))) {
        keys.push(key);
      }
    }
  } catch {
    // localStorage indisponível (janela privada, bloqueio do navegador): nada a recuperar.
  }
  return keys;
};

export const hasLegacyLocalData = (): boolean => legacyKeys().length > 0;

export const readLocalSnapshot = (): LocalSnapshot => {
  const snapshot: LocalSnapshot = { dailyPlans: [], contracts: {}, dimensions: {}, compositions: {}, histograms: {} };
  for (const key of legacyKeys()) {
    if (key === LEGACY_DAILY_PLANS_KEY) {
      snapshot.dailyPlans = readJson<DailyPlan[]>(key) ?? [];
    } else if (key.startsWith(LEGACY_PREFIXES.contract)) {
      const projectId = key.slice(LEGACY_PREFIXES.contract.length);
      const value = readJson<ContractData>(key);
      if (value) snapshot.contracts[projectId] = { ...value, projectId };
    } else if (key.startsWith(LEGACY_PREFIXES.dimensions)) {
      const projectId = key.slice(LEGACY_PREFIXES.dimensions.length);
      const value = readJson<DimensionStoredRecord>(key);
      if (value) snapshot.dimensions[projectId] = { ...value, projectId };
    } else if (key.startsWith(LEGACY_PREFIXES.compositions)) {
      const projectId = key.slice(LEGACY_PREFIXES.compositions.length);
      const value = readJson<CompositionAIExtractionResult>(key);
      if (value) snapshot.compositions[projectId] = { ...value, projectId };
    } else if (key.startsWith(LEGACY_PREFIXES.histograms)) {
      const projectId = key.slice(LEGACY_PREFIXES.histograms.length);
      const value = readJson<HistogramItem[]>(key);
      if (Array.isArray(value)) snapshot.histograms[projectId] = value;
    }
  }
  return snapshot;
};

/** Apaga todas as cópias antigas do RDO Online neste navegador. */
export const clearLegacyLocalData = (): void => {
  for (const key of legacyKeys()) {
    try {
      localStorage.removeItem(key);
    } catch {
      // ignora: sem acesso ao localStorage não há o que limpar
    }
  }
};

/** Baixa as cópias locais em JSON (para entregar a quem pode gravar, ou guardar antes de descartar). */
export const downloadLocalSnapshot = (pending: PendingLocalData): void => {
  const blob = new Blob([JSON.stringify(pending, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `rdo-dados-locais-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
