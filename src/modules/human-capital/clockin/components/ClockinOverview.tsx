import React, { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertTriangle, MapPinOff, ScanFace, ShieldAlert, Users, Fingerprint, MapPin, IdCard } from 'lucide-react';
import { getClockinCCName } from '../domain/carolCostCenters';
import { ALERT_META, ClockinGroupRow, ClockinSummary, groupAudit } from '../domain/clockinAudit';
import { AuditedPunch, ClockinAlertCode } from '../domain/clockinTypes';
import { formatInt, formatPercent, formatPunchDate, SEVERITY_BADGE, SEVERITY_LABEL } from './clockinFormat';

interface Props {
    audited: AuditedPunch[];
    summary: ClockinSummary;
    rmStatus: 'loading' | 'ok' | 'unavailable';
    onSelectAlert: (code: ClockinAlertCode) => void;
    onSelectEmployee: (cpf: string) => void;
    onGoToFences: () => void;
}

const SEVERITY_COLORS = { high: '#e11d48', medium: '#f59e0b', low: '#94a3b8' };

const KpiCard: React.FC<{ icon: React.ReactNode; label: string; value: string; hint?: string; tone?: string }> = ({ icon, label, value, hint, tone = 'text-gray-900' }) => (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
        <div className="flex items-center gap-2 text-[10px] text-gray-500 font-bold uppercase tracking-wider">{icon}{label}</div>
        <div className={`text-2xl font-black mt-2 ${tone}`}>{value}</div>
        {hint && <div className="text-[11px] text-gray-500 mt-1">{hint}</div>}
    </div>
);

const RankingTable: React.FC<{ title: string; rows: ClockinGroupRow[]; onSelect?: (key: string) => void }> = ({ title, rows, onSelect }) => (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="text-sm font-bold text-[#1e3a8a] uppercase">{title}</h3>
            <p className="text-[11px] text-gray-500">Batidas por maior gravidade de alerta</p>
        </div>
        <div className="max-h-96 overflow-y-auto">
            <table className="w-full text-xs">
                <thead className="sticky top-0 bg-gray-50 text-gray-500 uppercase text-[10px]">
                    <tr>
                        <th className="text-left px-4 py-2">Nome</th>
                        <th className="text-right px-2 py-2">Batidas</th>
                        <th className="text-right px-2 py-2 text-rose-600">Alta</th>
                        <th className="text-right px-2 py-2 text-amber-600">Média</th>
                        <th className="text-right px-4 py-2">Baixa</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.slice(0, 30).map(row => (
                        <tr
                            key={row.key}
                            onClick={onSelect ? () => onSelect(row.key) : undefined}
                            className={`border-t border-gray-50 ${onSelect ? 'cursor-pointer hover:bg-blue-50/40' : ''}`}
                        >
                            <td className="px-4 py-2 text-gray-800 font-medium truncate max-w-[220px]" title={row.label}>
                                {row.label}
                                <span className="text-gray-400 font-normal"> · {row.employeeCount} pess.</span>
                            </td>
                            <td className="px-2 py-2 text-right text-gray-600">{formatInt(row.punchCount)}</td>
                            <td className="px-2 py-2 text-right font-bold text-rose-600">{row.high || '-'}</td>
                            <td className="px-2 py-2 text-right font-bold text-amber-600">{row.medium || '-'}</td>
                            <td className="px-4 py-2 text-right text-gray-500">{row.low || '-'}</td>
                        </tr>
                    ))}
                    {rows.length === 0 && (
                        <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">Sem dados</td></tr>
                    )}
                </tbody>
            </table>
        </div>
    </div>
);

const ClockinOverview: React.FC<Props> = ({ audited, summary, rmStatus, onSelectAlert, onSelectEmployee, onGoToFences }) => {
    const byCostCenter = useMemo(() => groupAudit(audited, p => p.costCenter, p => `${p.costCenter} · ${getClockinCCName(p.costCenter)}`), [audited]);
    const bySupervisor = useMemo(() => groupAudit(audited, p => p.supervisorCode || p.supervisorName, p => p.supervisorName || p.supervisorCode), [audited]);
    const byEmployee = useMemo(() => groupAudit(audited, p => p.cpf, p => p.name), [audited]);

    const daily = useMemo(() => {
        const map = new Map<string, { date: string; high: number; medium: number; low: number; clean: number }>();
        audited.forEach(p => {
            let row = map.get(p.date);
            if (!row) {
                row = { date: p.date, high: 0, medium: 0, low: 0, clean: 0 };
                map.set(p.date, row);
            }
            if (p.worstSeverity) row[p.worstSeverity]++;
            else row.clean++;
        });
        return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date)).map(r => ({ ...r, label: formatPunchDate(r.date).slice(0, 5) }));
    }, [audited]);

    const misconfiguredCount = useMemo(() => audited.filter(p => p.fenceSource === 'CAROL_MISCONFIGURED').length, [audited]);

    const alertCodes = (Object.keys(ALERT_META) as ClockinAlertCode[])
        .filter(code => summary.byCode[code] > 0)
        .sort((a, b) => summary.byCode[b] - summary.byCode[a]);

    const rm = summary.rmCoverage;

    return (
        <div className="space-y-6">
            <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                    <IdCard size={20} className="text-blue-600 shrink-0 mt-0.5" />
                    {rm ? (
                        <div>
                            <p className="text-sm font-bold text-gray-800">
                                {formatInt(rm.matched)} de {formatInt(summary.employeeCount)} colaboradores encontrados no RM
                                {rm.matchedByCpf > 0 && ` (${formatInt(rm.matchedByCpf)} pelo CPF)`}
                                {rm.mismatched > 0 && <span className="text-amber-700"> · {formatInt(rm.mismatched)} com CC diferente da Carol</span>}
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5">
                                {rmStatus === 'ok'
                                    ? 'Cruzamento pelo CPF no cadastro de funcionários do RM; quem não casar, pelo nome no headcount e no cadastro do portal.'
                                    : rmStatus === 'loading'
                                        ? 'Carregando o cadastro de funcionários do RM… por enquanto, cruzamento pelo nome.'
                                        : 'Cadastro de funcionários do RM indisponível: cruzamento pelo nome no headcount e no cadastro do portal.'}
                                {rm.ambiguous > 0 && ` ${formatInt(rm.ambiguous)} com homônimos (não ligados).`}
                                {rm.notFound > 0 && ` ${formatInt(rm.notFound)} não encontrados.`}
                            </p>
                        </div>
                    ) : (
                        <div>
                            <p className="text-sm font-bold text-gray-800">Sem cruzamento com o RM</p>
                            <p className="text-xs text-gray-500 mt-0.5">Headcount e cadastro de colaboradores ainda não carregados nesta sessão.</p>
                        </div>
                    )}
                </div>
                {rm && rm.mismatched > 0 && (
                    <button onClick={() => onSelectAlert('COST_CENTER_MISMATCH')} className="shrink-0 px-3 py-2 rounded-lg bg-white border border-gray-200 text-gray-700 text-xs font-bold hover:bg-gray-50">
                        Ver CC divergentes
                    </button>
                )}
            </div>

            {misconfiguredCount > 0 && (
                <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                        <MapPinOff size={20} className="text-orange-600 shrink-0 mt-0.5" />
                        <div>
                            <p className="text-sm font-bold text-orange-800">
                                {formatInt(misconfiguredCount)} batidas ({formatPercent(misconfiguredCount / Math.max(1, audited.length))}) sem cerca confiável
                            </p>
                            <p className="text-xs text-orange-700 mt-0.5">
                                A cerca da Carol é a do local de cadastro do colaborador, não a da obra, e várias estão mal configuradas.
                                Essas batidas não geram alerta de "fora da cerca" até a cerca da obra ser cadastrada.
                            </p>
                        </div>
                    </div>
                    <button onClick={onGoToFences} className="shrink-0 px-3 py-2 rounded-lg bg-white border border-orange-300 text-orange-800 text-xs font-bold hover:bg-orange-100">
                        Cadastrar cercas das obras
                    </button>
                </div>
            )}

            <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
                <KpiCard icon={<Fingerprint size={14} />} label="Batidas" value={formatInt(summary.punchCount)} hint={`${formatInt(summary.shiftCount)} jornadas`} />
                <KpiCard icon={<Users size={14} />} label="Colaboradores" value={formatInt(summary.employeeCount)} />
                <KpiCard icon={<AlertTriangle size={14} />} label="Com alerta" value={formatPercent(summary.punchesWithAlert / Math.max(1, summary.punchCount))} hint={`${formatInt(summary.punchesWithAlert)} batidas`} />
                <KpiCard icon={<ShieldAlert size={14} />} label="Gravidade alta" value={formatInt(summary.bySeverity.high)} tone="text-rose-600" />
                <KpiCard icon={<ShieldAlert size={14} />} label="Gravidade média" value={formatInt(summary.bySeverity.medium)} tone="text-amber-600" />
                <KpiCard icon={<ScanFace size={14} />} label="Reconhec. facial" value={formatPercent(summary.facialRate)} hint={`Score médio ${summary.avgFaceScore.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}`} />
                <KpiCard icon={<MapPin size={14} />} label="Dentro da cerca" value={formatPercent(summary.insideRate)} hint="das batidas avaliadas" />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                    <h3 className="text-sm font-bold text-[#1e3a8a] uppercase mb-1">Alertas encontrados</h3>
                    <p className="text-[11px] text-gray-500 mb-4">Clique para ver as batidas</p>
                    <div className="space-y-2">
                        {alertCodes.map(code => (
                            <button
                                key={code}
                                onClick={() => onSelectAlert(code)}
                                className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-gray-100 hover:bg-blue-50/40 text-left"
                                title={ALERT_META[code].description}
                            >
                                <span className="flex items-center gap-2 min-w-0">
                                    <span className={`shrink-0 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border ${SEVERITY_BADGE[ALERT_META[code].severity]}`}>
                                        {SEVERITY_LABEL[ALERT_META[code].severity]}
                                    </span>
                                    <span className="text-sm text-gray-800 truncate">{ALERT_META[code].label}</span>
                                </span>
                                <span className="text-sm font-bold text-gray-900">{formatInt(summary.byCode[code])}</span>
                            </button>
                        ))}
                        {alertCodes.length === 0 && <p className="text-sm text-gray-400">Nenhum alerta no período.</p>}
                    </div>
                </div>

                <div className="xl:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                    <h3 className="text-sm font-bold text-[#1e3a8a] uppercase mb-1">Batidas por dia</h3>
                    <p className="text-[11px] text-gray-500 mb-4">Pela maior gravidade de alerta de cada batida</p>
                    <div className="h-72 min-w-0">
                        {/* Tamanho inicial evita o aviso de largura -1 antes da primeira medição. */}
                        <ResponsiveContainer width="100%" height={288} minWidth={0} initialDimension={{ width: 600, height: 288 }}>
                            <BarChart data={daily}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                                <YAxis tick={{ fontSize: 10 }} />
                                <Tooltip />
                                <Legend wrapperStyle={{ fontSize: 11 }} />
                                <Bar dataKey="high" name="Alta" stackId="a" fill={SEVERITY_COLORS.high} />
                                <Bar dataKey="medium" name="Média" stackId="a" fill={SEVERITY_COLORS.medium} />
                                <Bar dataKey="low" name="Baixa" stackId="a" fill={SEVERITY_COLORS.low} />
                                <Bar dataKey="clean" name="Sem alerta" stackId="a" fill="#10b981" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <RankingTable title="Por centro de custo" rows={byCostCenter} />
                <RankingTable title="Por supervisor / aparelho" rows={bySupervisor} />
                <RankingTable title="Por colaborador" rows={byEmployee} onSelect={onSelectEmployee} />
            </div>
        </div>
    );
};

export default ClockinOverview;
