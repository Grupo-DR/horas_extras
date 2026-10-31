import React, { useMemo, useState } from 'react';
import { UserSearch } from 'lucide-react';
import { getClockinCCName } from '../domain/carolCostCenters';
import { ALERT_META, groupShifts, summarizeAudit } from '../domain/clockinAudit';
import { AuditedPunch, ClockinCostCenterFences } from '../domain/clockinTypes';
import ClockinPunchDetail from './ClockinPunchDetail';
import { formatCpf, formatInt, formatPercent, formatPunchDate, rmChapaLabel, SEVERITY_BADGE } from './clockinFormat';

interface Props {
    audited: AuditedPunch[];
    siteFences: ClockinCostCenterFences[];
    cpf: string;
    onCpfChange: (cpf: string) => void;
}

const WEEKDAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

const weekday = (date: string) => {
    const [y, m, d] = date.split('-').map(Number);
    return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
};

const dotClass = (p: AuditedPunch) =>
    p.worstSeverity === 'high' ? 'bg-rose-500' : p.worstSeverity === 'medium' ? 'bg-amber-400' : p.worstSeverity === 'low' ? 'bg-slate-400' : 'bg-emerald-500';

const ClockinEmployeeTimeline: React.FC<Props> = ({ audited, siteFences, cpf, onCpfChange }) => {
    const sitesByCc = useMemo(() => new Map(siteFences.map(f => [f.costCenter, f.sites])), [siteFences]);
    const [search, setSearch] = useState('');
    const [openPunch, setOpenPunch] = useState<string | null>(null);

    const employees = useMemo(() => {
        const map = new Map<string, { cpf: string; name: string; alerts: number; punches: number }>();
        audited.forEach(p => {
            const e = map.get(p.cpf) || { cpf: p.cpf, name: p.name, alerts: 0, punches: 0 };
            e.punches++;
            if (p.worstSeverity === 'high' || p.worstSeverity === 'medium') e.alerts++;
            map.set(p.cpf, e);
        });
        return Array.from(map.values()).sort((a, b) => b.alerts - a.alerts || a.name.localeCompare(b.name));
    }, [audited]);

    const visibleEmployees = useMemo(() => {
        const term = search.trim().toLowerCase();
        const digits = term.replace(/\D/g, '');
        return employees.filter(e => !term || e.name.toLowerCase().includes(term) || (digits && e.cpf.includes(digits)));
    }, [employees, search]);

    const punches = useMemo(() => audited.filter(p => p.cpf === cpf), [audited, cpf]);
    const shifts = useMemo(() => groupShifts(punches).sort((a, b) => b.date.localeCompare(a.date)), [punches]);
    const summary = useMemo(() => (punches.length ? summarizeAudit(punches) : null), [punches]);
    const first = punches[0];

    return (
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden xl:col-span-1">
                <div className="p-4 border-b border-gray-100">
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Buscar nome ou CPF"
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                    />
                    <p className="text-[11px] text-gray-500 mt-2">Ordenado por batidas com alerta alto/médio</p>
                </div>
                <div className="max-h-[640px] overflow-y-auto">
                    {visibleEmployees.map(e => (
                        <button
                            key={e.cpf}
                            onClick={() => { onCpfChange(e.cpf); setOpenPunch(null); }}
                            className={`w-full text-left px-4 py-2 border-b border-gray-50 flex items-center justify-between gap-2 ${e.cpf === cpf ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                        >
                            <span className="text-sm text-gray-800 truncate">{e.name}</span>
                            <span className={`text-[10px] font-bold shrink-0 ${e.alerts ? 'text-rose-600' : 'text-gray-400'}`}>{e.alerts}/{e.punches}</span>
                        </button>
                    ))}
                </div>
            </div>

            <div className="xl:col-span-3 space-y-4">
                {!first || !summary ? (
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 text-center text-gray-400 flex flex-col items-center gap-2">
                        <UserSearch size={32} />
                        Escolha um colaborador para ver a linha do tempo das batidas.
                    </div>
                ) : (
                    <>
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                            <div className="flex flex-wrap items-start justify-between gap-4">
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900">{first.name}</h3>
                                    <p className="text-xs text-gray-500">
                                        CPF {formatCpf(first.cpf)} · {first.costCenter} {getClockinCCName(first.costCenter)} · {first.regional} · cadastro em {first.locationName || '-'}
                                    </p>
                                    <p className="text-xs text-gray-500 mt-0.5">
                                        RM: chapa {rmChapaLabel(first)}
                                        {first.rm?.employee?.funcao ? ` · ${first.rm.employee.funcao}` : ''}
                                        {first.rm?.employee?.source === 'RM' && first.rm.employee.costCenter
                                            ? ` · CC atual no RM ${first.rm.employee.costCenter} ${getClockinCCName(first.rm.employee.costCenter)}`
                                            : ''}
                                        {' · o CC esperado de cada batida segue o headcount da data (abra a batida)'}
                                    </p>
                                </div>
                                <div className="flex gap-6 text-right">
                                    {[
                                        ['Batidas', formatInt(summary.punchCount)],
                                        ['Jornadas', formatInt(summary.shiftCount)],
                                        ['Com alerta', formatPercent(summary.punchesWithAlert / summary.punchCount)],
                                        ['Facial', formatPercent(summary.facialRate)],
                                        ['Score médio', summary.avgFaceScore.toLocaleString('pt-BR', { maximumFractionDigits: 1 })]
                                    ].map(([label, value]) => (
                                        <div key={label}>
                                            <div className="text-[10px] text-gray-500 font-bold uppercase">{label}</div>
                                            <div className="text-lg font-black text-gray-900">{value}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                            {shifts.map(shift => (
                                <div key={`${shift.date}_${shift.punches[0].id}`} className="border-b border-gray-50">
                                    <div className="px-5 py-3 flex flex-wrap items-center gap-3">
                                        <div className="w-28 shrink-0">
                                            <div className="text-sm font-bold text-gray-800">{formatPunchDate(shift.date)}</div>
                                            <div className="text-[10px] text-gray-400 uppercase">{weekday(shift.date)} · {shift.punches.length} batida(s)</div>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {shift.punches.map(p => (
                                                <button
                                                    key={p.id}
                                                    onClick={() => setOpenPunch(openPunch === p.id ? null : p.id)}
                                                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs ${openPunch === p.id ? 'border-blue-300 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}
                                                    title={p.alerts.map(a => `${ALERT_META[a.code].label}: ${a.detail}`).join('\n') || 'Sem alerta'}
                                                >
                                                    <span className={`w-2 h-2 rounded-full ${dotClass(p)}`} />
                                                    <span className="font-semibold text-gray-800">{p.punchedAt.slice(11)}</span>
                                                    {p.date !== shift.date && <span className="text-[10px] text-gray-400">+1d</span>}
                                                </button>
                                            ))}
                                        </div>
                                        <div className="flex flex-wrap gap-1 ml-auto">
                                            {Array.from(new Set(shift.punches.flatMap(p => p.alerts.map(a => a.code)))).map(code => (
                                                <span key={code} className={`px-1.5 py-0.5 rounded border text-[10px] font-semibold ${SEVERITY_BADGE[ALERT_META[code].severity]}`}>
                                                    {ALERT_META[code].label}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                    {shift.punches.filter(p => p.id === openPunch).map(p => <ClockinPunchDetail key={p.id} punch={p} sites={sitesByCc.get(p.costCenter)} />)}
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default ClockinEmployeeTimeline;
