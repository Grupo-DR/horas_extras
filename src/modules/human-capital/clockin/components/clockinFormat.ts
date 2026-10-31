import { AuditedPunch, ClockinFenceSource, ClockinFenceStatus, ClockinSeverity } from '../domain/clockinTypes';

/** "2026-10-20T23:57" → "20/10/2026 23:57" */
export const formatPunchDateTime = (value: string | null | undefined): string => {
    if (!value) return '-';
    const [date, time] = value.split('T');
    return `${date.split('-').reverse().join('/')}${time ? ` ${time}` : ''}`;
};

/** "2026-10-20" → "20/10/2026" */
export const formatPunchDate = (value: string): string => value.split('-').reverse().join('/');

export const formatCpf = (cpf: string): string =>
    cpf.length === 11 ? `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}` : cpf;

export const formatMeters = (meters: number | null | undefined): string => {
    if (meters === null || meters === undefined) return '-';
    if (meters >= 1e9) return 'ilimitado';
    return meters >= 1_000
        ? `${(meters / 1_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km`
        : `${Math.round(meters)} m`;
};

export const formatPercent = (value: number): string =>
    `${(value * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;

export const formatInt = (value: number): string => value.toLocaleString('pt-BR');

export const MAP_COLORS = {
    punch: { high: '#e11d48', medium: '#f59e0b', low: '#64748b', none: '#10b981' },
    accuracy: '#64748b',
    carolFence: '#2563eb',
    siteFence: '#059669'
};

export const mapsUrl =(lat: number, lon: number): string => `https://www.google.com/maps?q=${lat},${lon}`;

/** Chapa do RM ou o motivo de não ter achado ("homônimos", "não encontrado"). */
export const rmChapaLabel = (p: AuditedPunch): string => {
    if (!p.rm) return '-';
    if (p.rm.status === 'MATCHED') return p.rm.employee!.chapa;
    if (p.rm.status === 'AMBIGUOUS') return `Homônimos (${p.rm.candidates} chapas)`;
    return 'Não encontrado no RM';
};

export const SEVERITY_LABEL: Record<ClockinSeverity, string> = { high: 'Alta', medium: 'Média', low: 'Baixa' };

export const SEVERITY_BADGE: Record<ClockinSeverity, string> = {
    high: 'bg-rose-100 text-rose-700 border-rose-200',
    medium: 'bg-amber-100 text-amber-700 border-amber-200',
    low: 'bg-slate-100 text-slate-600 border-slate-200'
};

export const FENCE_LABEL: Record<ClockinFenceStatus, string> = {
    INSIDE: 'Dentro',
    OUTSIDE: 'Fora',
    NOT_EVALUATED: 'Não avaliada'
};

export const FENCE_BADGE: Record<ClockinFenceStatus, string> = {
    INSIDE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    OUTSIDE: 'bg-rose-50 text-rose-700 border-rose-200',
    NOT_EVALUATED: 'bg-slate-50 text-slate-500 border-slate-200'
};

export const FENCE_SOURCE_LABEL: Record<ClockinFenceSource, string> = {
    SITE: 'Cerca da obra (portal)',
    CAROL: 'Cerca da Carol',
    CAROL_MISCONFIGURED: 'Cerca da Carol com problema — não avaliada',
    NONE: 'Sem avaliação'
};
