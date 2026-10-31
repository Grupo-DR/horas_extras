import React, { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { ChevronDown, ChevronRight, Download } from 'lucide-react';
import { getClockinCCName } from '../domain/carolCostCenters';
import { ALERT_META, EXPECTED_CC_SOURCE_LABEL, SEVERITY_ORDER } from '../domain/clockinAudit';
import { AuditedPunch, ClockinAlertCode, ClockinCostCenterFences, ClockinFenceStatus, ClockinSeverity } from '../domain/clockinTypes';
import ClockinPunchDetail from './ClockinPunchDetail';
import {
    FENCE_BADGE,
    FENCE_LABEL,
    FENCE_SOURCE_LABEL,
    formatCpf,
    formatInt,
    formatMeters,
    formatPunchDateTime,
    rmChapaLabel,
    SEVERITY_BADGE,
    SEVERITY_LABEL
} from './clockinFormat';

const PAGE_SIZE = 50;

type SortKey = 'date' | 'severity' | 'score';

interface Props {
    audited: AuditedPunch[];
    siteFences: ClockinCostCenterFences[];
    alertCode: ClockinAlertCode | '';
    onAlertCodeChange: (code: ClockinAlertCode | '') => void;
    onSelectEmployee: (cpf: string) => void;
}

const selectClass = 'px-3 py-2 rounded-lg border border-gray-200 bg-white text-xs text-gray-700';

const exportToExcel = (rows: AuditedPunch[]) => {
    const data = rows.map(p => ({
        'Data/hora': formatPunchDateTime(p.punchedAt),
        Nome: p.name,
        CPF: formatCpf(p.cpf),
        'Chapa (RM)': rmChapaLabel(p),
        'Função (RM)': p.rm?.employee?.funcao ?? '',
        'Centro de custo': p.costCenter,
        'Nome do CC': getClockinCCName(p.costCenter),
        'CC na Carol': p.carolCostCenter,
        'CC esperado na data': p.expectedCostCenters
            ? p.expectedCostCenters.allocations.map(a => `${a.costCenter} (${Math.round(a.share * 100)}%)`).join(', ')
            : '',
        'Fonte do CC esperado': p.expectedCostCenters ? EXPECTED_CC_SOURCE_LABEL[p.expectedCostCenters.source] : '',
        'CC atual no RM': p.rm?.employee?.source === 'RM' ? p.rm.employee.costCenter : '',
        Regional: p.regional,
        'Local de cadastro': p.locationName,
        Supervisor: p.supervisorName,
        Aparelho: p.deviceDescription,
        'Próprio celular': p.selfPunch ? 'Sim' : 'Não',
        Modo: p.mode === 'FACIAL' ? 'Reconhecimento facial' : 'Foto aprovada',
        Score: p.faceScore,
        Latitude: p.lat ?? '',
        Longitude: p.lon ?? '',
        'Precisão GPS (m)': p.accuracyM ?? '',
        Cerca: FENCE_LABEL[p.effectiveFence],
        'Fonte da cerca': FENCE_SOURCE_LABEL[p.fenceSource],
        'Distância da cerca (m)': p.effectiveDistance !== null ? Math.round(p.effectiveDistance) : '',
        GMT: p.gmt,
        'Atraso sincronização (min)': p.firstSyncDelayMin ?? '',
        Gravidade: p.worstSeverity ? SEVERITY_LABEL[p.worstSeverity] : '',
        Alertas: p.alerts.map(a => `${ALERT_META[a.code].label}: ${a.detail}`).join(' | '),
        Foto: p.imageUrl
    }));
    const sheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, 'Auditoria');
    XLSX.writeFile(workbook, `auditoria-ponto-${new Date().toISOString().slice(0, 10)}.xlsx`);
};

const ClockinPunchTable: React.FC<Props> = ({ audited, siteFences, alertCode, onAlertCodeChange, onSelectEmployee }) => {
    const sitesByCc = useMemo(() => new Map(siteFences.map(f => [f.costCenter, f.sites])), [siteFences]);
    const [severity, setSeverity] = useState<ClockinSeverity | 'any' | 'none' | ''>('');
    const [fence, setFence] = useState<ClockinFenceStatus | ''>('');
    const [mode, setMode] = useState<'FACIAL' | 'PHOTO_APPROVED' | ''>('');
    const [sort, setSort] = useState<SortKey>('severity');
    const [page, setPage] = useState(0);
    const [expanded, setExpanded] = useState<string | null>(null);

    const rows = useMemo(() => {
        const filtered = audited.filter(p => {
            if (alertCode && !p.alerts.some(a => a.code === alertCode)) return false;
            if (severity === 'any' && !p.worstSeverity) return false;
            if (severity === 'none' && p.worstSeverity) return false;
            if ((severity === 'high' || severity === 'medium' || severity === 'low') && p.worstSeverity !== severity) return false;
            if (fence && p.effectiveFence !== fence) return false;
            if (mode && p.mode !== mode) return false;
            return true;
        });
        const sorted = [...filtered];
        if (sort === 'date') sorted.sort((a, b) => b.punchedAt.localeCompare(a.punchedAt));
        if (sort === 'severity') {
            sorted.sort((a, b) =>
                (b.worstSeverity ? SEVERITY_ORDER[b.worstSeverity] : 0) - (a.worstSeverity ? SEVERITY_ORDER[a.worstSeverity] : 0) ||
                b.alerts.length - a.alerts.length ||
                b.punchedAt.localeCompare(a.punchedAt)
            );
        }
        if (sort === 'score') sorted.sort((a, b) => a.faceScore - b.faceScore || b.punchedAt.localeCompare(a.punchedAt));
        return sorted;
    }, [audited, alertCode, severity, fence, mode, sort]);

    useEffect(() => { setPage(0); }, [audited, alertCode, severity, fence, mode, sort]);

    const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
    const pageRows = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex flex-wrap items-center gap-3">
                <select className={selectClass} value={alertCode} onChange={e => onAlertCodeChange(e.target.value as ClockinAlertCode | '')}>
                    <option value="">Todos os alertas</option>
                    {(Object.keys(ALERT_META) as ClockinAlertCode[]).map(code => (
                        <option key={code} value={code}>{ALERT_META[code].label}</option>
                    ))}
                </select>
                <select className={selectClass} value={severity} onChange={e => setSeverity(e.target.value as typeof severity)}>
                    <option value="">Qualquer gravidade</option>
                    <option value="any">Com alerta</option>
                    <option value="high">Alta</option>
                    <option value="medium">Média</option>
                    <option value="low">Baixa</option>
                    <option value="none">Sem alerta</option>
                </select>
                <select className={selectClass} value={fence} onChange={e => setFence(e.target.value as ClockinFenceStatus | '')}>
                    <option value="">Qualquer cerca</option>
                    <option value="INSIDE">Dentro</option>
                    <option value="OUTSIDE">Fora</option>
                    <option value="NOT_EVALUATED">Não avaliada</option>
                </select>
                <select className={selectClass} value={mode} onChange={e => setMode(e.target.value as typeof mode)}>
                    <option value="">Qualquer modo</option>
                    <option value="FACIAL">Reconhecimento facial</option>
                    <option value="PHOTO_APPROVED">Foto aprovada</option>
                </select>
                <select className={selectClass} value={sort} onChange={e => setSort(e.target.value as SortKey)}>
                    <option value="severity">Ordenar: gravidade</option>
                    <option value="date">Ordenar: mais recentes</option>
                    <option value="score">Ordenar: menor score facial</option>
                </select>
                <span className="text-xs text-gray-500 ml-auto">{formatInt(rows.length)} batida(s)</span>
                <button
                    onClick={() => exportToExcel(rows)}
                    disabled={rows.length === 0}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                    <Download size={14} /> Excel
                </button>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-xs">
                    <thead className="bg-gray-50 text-gray-500 uppercase text-[10px]">
                        <tr>
                            <th className="w-8" />
                            <th className="text-left px-3 py-2">Data/hora</th>
                            <th className="text-left px-3 py-2">Colaborador</th>
                            <th className="text-left px-3 py-2">CC</th>
                            <th className="text-left px-3 py-2">Modo</th>
                            <th className="text-left px-3 py-2">Cerca</th>
                            <th className="text-left px-3 py-2">Alertas</th>
                        </tr>
                    </thead>
                    <tbody>
                        {pageRows.map(p => {
                            const isOpen = expanded === p.id;
                            return (
                                <React.Fragment key={p.id}>
                                    <tr className={`border-t border-gray-50 cursor-pointer ${isOpen ? 'bg-blue-50/40' : 'hover:bg-gray-50'}`} onClick={() => setExpanded(isOpen ? null : p.id)}>
                                        <td className="pl-3 text-gray-400">{isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</td>
                                        <td className="px-3 py-2 whitespace-nowrap text-gray-700">{formatPunchDateTime(p.punchedAt)}</td>
                                        <td className="px-3 py-2">
                                            <button
                                                className="font-semibold text-gray-900 hover:text-blue-700 hover:underline text-left"
                                                onClick={e => { e.stopPropagation(); onSelectEmployee(p.cpf); }}
                                            >
                                                {p.name}
                                            </button>
                                            <div className="text-[10px] text-gray-400">
                                                {p.rm?.employee ? `Chapa ${p.rm.employee.chapa} · ` : ''}{p.supervisorName}{p.selfPunch ? '' : ' · aparelho de terceiro'}
                                            </div>
                                        </td>
                                        <td className="px-3 py-2 text-gray-600 whitespace-nowrap" title={getClockinCCName(p.costCenter)}>{p.costCenter}</td>
                                        <td className="px-3 py-2 whitespace-nowrap">
                                            {p.mode === 'FACIAL'
                                                ? <span className="text-gray-700">Facial · {p.faceScore}</span>
                                                : <span className="text-amber-700 font-semibold">Foto aprovada</span>}
                                        </td>
                                        <td className="px-3 py-2 whitespace-nowrap">
                                            <span className={`px-1.5 py-0.5 rounded border text-[10px] font-bold ${FENCE_BADGE[p.effectiveFence]}`}>{FENCE_LABEL[p.effectiveFence]}</span>
                                            {p.effectiveDistance !== null && p.effectiveFence === 'OUTSIDE' && (
                                                <span className="text-[10px] text-gray-500 ml-1">{formatMeters(p.effectiveDistance)}</span>
                                            )}
                                        </td>
                                        <td className="px-3 py-2">
                                            <div className="flex flex-wrap gap-1">
                                                {p.alerts.map((a, i) => (
                                                    <span key={i} className={`px-1.5 py-0.5 rounded border text-[10px] font-semibold ${SEVERITY_BADGE[a.severity]}`} title={a.detail}>
                                                        {ALERT_META[a.code].label}
                                                    </span>
                                                ))}
                                                {p.alerts.length === 0 && <span className="text-[10px] text-emerald-600 font-semibold">OK</span>}
                                            </div>
                                        </td>
                                    </tr>
                                    {isOpen && (
                                        <tr>
                                            <td colSpan={7} className="p-0"><ClockinPunchDetail punch={p} sites={sitesByCc.get(p.costCenter)} /></td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            );
                        })}
                        {pageRows.length === 0 && (
                            <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">Nenhuma batida com esses filtros.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {pageCount > 1 && (
                <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-600">
                    <button disabled={page === 0} onClick={() => setPage(p => p - 1)} className="px-3 py-1.5 rounded-lg border border-gray-200 disabled:opacity-40">Anterior</button>
                    <span>Página {page + 1} de {pageCount}</span>
                    <button disabled={page >= pageCount - 1} onClick={() => setPage(p => p + 1)} className="px-3 py-1.5 rounded-lg border border-gray-200 disabled:opacity-40">Próxima</button>
                </div>
            )}
        </div>
    );
};

export default ClockinPunchTable;
