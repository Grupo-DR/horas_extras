/**
 * Calendário mensal dos RDOs de uma obra (tela da obra, ao lado da lista de turmas).
 * Cada dia soma os RDOs das turmas filtradas: produção em R$, efetivo MOD/MOI, equipamentos,
 * clima e ocorrências. Funções puras; a tela só formata.
 */
import { Project, RDOData } from '../types';
import { calculateRDOTotal, parseDate } from '../utils';
import { normalizeWeather } from '../services/valeRdoModel';
import type { DimensionItem } from '../src/analytics/types/analyticsTypes';

export type Clima = 'ENSOLARADO' | 'NUBLADO' | 'CHUVOSO' | '';

export interface DiaCalendario {
  /** "AAAA-MM-DD" */
  iso: string;
  dia: number;
  doMes: boolean;
  rdos: RDOData[];
  producao: number;
  mod: number;
  moi: number;
  equip: number;
  ocorrencias: number;
  clima: Clima;
}

export interface MesCalendario {
  ano: number;
  /** 1..12 */
  mes: number;
  /** Semanas de segunda a domingo. */
  semanas: DiaCalendario[][];
  totais: { rdos: number; dias: number; producao: number; diasComOcorrencia: number };
}

const norm = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();

/** Funções de apoio e supervisão (mão de obra indireta) quando a obra não tem a tabela de dimensões. */
const INDIRETA = /ENCARREGAD|SUPERVISOR|ENGENHEIR|TECNIC|ADMINISTRAT|ALMOXARIF|APONTADOR|GERENTE|COORDENAD|MESTRE|PLANEJ|ASSISTENTE|ESTAGIARI|ENFERMEIR|SEGURANCA|\bTST\b|\bSSMA\b|\bSMS\b/;

/**
 * MOD ou MOI de uma função do RDO. Usa a tabela de dimensões da obra (Inteligência Contratual) quando
 * a função está lá; senão, classifica pelo nome (supervisão e apoio = MOI; o resto = MOD).
 */
export const classificarFuncao = (funcao: string, dimensoes: DimensionItem[] = []): 'MOD' | 'MOI' => {
  const n = norm(funcao);
  const item = dimensoes.find(d => d.rdoEquivalentNormalized === n) ?? dimensoes.find(d => d.normalizedName === n);
  if (item?.group === 'MOD' || item?.group === 'MOI') return item.group;
  return INDIRETA.test(n) ? 'MOI' : 'MOD';
};

const PESO_CLIMA: Record<Clima, number> = { '': 0, ENSOLARADO: 1, NUBLADO: 2, CHUVOSO: 3 };

/** Pior clima do dia entre os turnos e os RDOs (chuva > nublado > sol). */
const climaDoDia = (rdos: RDOData[]): Clima => {
  let pior: Clima = '';
  for (const r of rdos) {
    for (const v of [r.weather, r.weatherMorning, r.weatherAfternoon, r.vale?.clima?.manha, r.vale?.clima?.tarde, r.vale?.clima?.noite]) {
      const c = normalizeWeather(v) as Clima;
      if (c in PESO_CLIMA && PESO_CLIMA[c] > PESO_CLIMA[pior]) pior = c;
    }
  }
  return pior;
};

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Data do RDO ("DD/MM/AAAA") em "AAAA-MM-DD"; null se inválida. */
export const isoDoRdo = (rdo: RDOData): string | null => {
  const d = parseDate(rdo.date ?? '');
  return Number.isFinite(d.getTime()) ? iso(d) : null;
};

/** Mês (ano, 1..12) do RDO mais recente; o mês atual se não houver RDO. */
export const mesMaisRecente = (rdos: RDOData[], hoje: Date = new Date()): { ano: number; mes: number } => {
  const ultimo = rdos.map(isoDoRdo).filter((d): d is string => !!d).sort().pop();
  return ultimo ? { ano: Number(ultimo.slice(0, 4)), mes: Number(ultimo.slice(5, 7)) } : { ano: hoje.getFullYear(), mes: hoje.getMonth() + 1 };
};

export const montarMes = (
  ano: number,
  mes: number,
  rdos: RDOData[],
  project: Project | null,
  dimensoes: DimensionItem[] = []
): MesCalendario => {
  const porDia = new Map<string, RDOData[]>();
  for (const r of rdos) {
    const d = isoDoRdo(r);
    if (!d) continue;
    porDia.set(d, [...(porDia.get(d) ?? []), r]);
  }

  const primeiro = new Date(ano, mes - 1, 1);
  const inicio = new Date(primeiro);
  inicio.setDate(1 - ((primeiro.getDay() + 6) % 7)); // volta até a segunda-feira
  const ultimo = new Date(ano, mes, 0);

  const semanas: DiaCalendario[][] = [];
  const totais = { rdos: 0, dias: 0, producao: 0, diasComOcorrencia: 0 };
  for (const cursor = new Date(inicio); cursor <= ultimo || semanas[semanas.length - 1]?.length !== 7;) {
    if (!semanas.length || semanas[semanas.length - 1].length === 7) semanas.push([]);
    const chave = iso(cursor);
    const doMes = cursor.getMonth() === mes - 1;
    const doDia = doMes ? porDia.get(chave) ?? [] : [];
    const dia: DiaCalendario = {
      iso: chave, dia: cursor.getDate(), doMes, rdos: doDia,
      producao: 0, mod: 0, moi: 0, equip: 0, ocorrencias: 0, clima: climaDoDia(doDia),
    };
    for (const r of doDia) {
      dia.producao += calculateRDOTotal(r, project ?? undefined);
      for (const w of r.workforce ?? []) dia[classificarFuncao(w.role ?? '', dimensoes) === 'MOI' ? 'moi' : 'mod'] += w.count || 0;
      dia.equip += (r.equipment ?? []).reduce((s, e) => s + (e.count || 0), 0);
      dia.ocorrencias += r.occurrences?.length ?? 0;
    }
    if (doDia.length) {
      totais.rdos += doDia.length;
      totais.dias++;
      totais.producao += dia.producao;
      if (dia.ocorrencias) totais.diasComOcorrencia++;
    }
    semanas[semanas.length - 1].push(dia);
    cursor.setDate(cursor.getDate() + 1);
  }
  return { ano, mes, semanas, totais };
};
