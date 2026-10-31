import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Database, Eye, Loader2, RefreshCw, XCircle } from 'lucide-react';
import { GlobalEmployee, HeadcountRecord, UserProfile } from '../../types';
import { getGlobalEmployeesAsync, getGlobalEmployeesSync } from '../../services/planning';
import { buildRmDirectory, RmEmployeeRecord } from '../domain/rmEmployees';
import { fetchRmEmployees } from '../services/rmEmployeeService';

export type RmRegistryStatus = 'loading' | 'ok' | 'unavailable';
import { getClockinCCName } from '../domain/carolCostCenters';
import { isCostCenterInHumanCapitalScope } from '../../utils/scopeFilters';
import { formatCompetencyLabel, getCompetencyRange, getPlanningCompetency } from '../../utils/planningWorkflow';
import { auditPunches, buildCarolFenceHealth, summarizeAudit } from '../domain/clockinAudit';
import { ClockinAlertCode, ClockinCostCenterFences, ClockinParseResult, ClockinPunch } from '../domain/clockinTypes';
import { getClockinImports, getClockinPunches, getSiteFences } from '../services/clockinStore';
import ClockinOverview from './ClockinOverview';
import ClockinPunchTable from './ClockinPunchTable';
import ClockinEmployeeTimeline from './ClockinEmployeeTimeline';
import ClockinFences from './ClockinFences';
import ClockinImport from './ClockinImport';
import { formatInt, formatPunchDate } from './clockinFormat';

type View = 'overview' | 'punches' | 'employee' | 'fences' | 'import';

const VIEWS: Array<{ key: View; label: string }> = [
    { key: 'overview', label: 'Visão geral' },
    { key: 'punches', label: 'Batidas' },
    { key: 'employee', label: 'Por colaborador' },
    { key: 'fences', label: 'Cercas' },
    { key: 'import', label: 'Importar' }
];

const todayKey = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

const shiftCompetency = (competency: string, delta: number): string => {
    const [y, m] = competency.split('-').map(Number);
    const index = y * 12 + (m - 1) + delta;
    return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;
};

const selectClass = 'px-3 py-2 rounded-lg border border-gray-200 bg-white text-xs text-gray-700';

interface Props {
    user: UserProfile;
    /** Headcount já carregado pelo Capital Humano (chapa, nome, CC por vigência). */
    headcountRecords: HeadcountRecord[];
}

const ClockinAuditView: React.FC<Props> = ({ user, headcountRecords }) => {
    // Importação, cercas e CPF seguem a mesma liberação da aba (ver firestore.rules e hcFetchEmployees).
    const canAdmin = !!user.canAuditClockin;
    // Mesmo cadastro global lido pela Visão Geral e pelo Planejamento (somente leitura).
    const [globalEmployees, setGlobalEmployees] = useState<GlobalEmployee[]>(() => getGlobalEmployeesSync());
    useEffect(() => {
        getGlobalEmployeesAsync(user).then(setGlobalEmployees).catch(console.error);
    }, [user]);

    // Cadastro de funcionários do RM (com CPF). Sem a função publicada, o
    // cruzamento continua pelo nome.
    const canReadRm = canAdmin;
    const [rmEmployees, setRmEmployees] = useState<RmEmployeeRecord[]>([]);
    const [rmStatus, setRmStatus] = useState<RmRegistryStatus>(canReadRm ? 'loading' : 'unavailable');
    useEffect(() => {
        if (!canReadRm) return;
        let active = true;
        fetchRmEmployees()
            .then(list => {
                if (!active) return;
                setRmEmployees(list);
                setRmStatus(list.length ? 'ok' : 'unavailable');
            })
            .catch(error => {
                console.warn('Cadastro de funcionários do RM indisponível; cruzamento pelo nome.', error);
                if (active) setRmStatus('unavailable');
            });
        return () => { active = false; };
    }, [canReadRm]);

    const [view, setView] = useState<View>('overview');
    const [competency, setCompetency] = useState(() => getPlanningCompetency(todayKey()));
    const [portalPunches, setPortalPunches] = useState<ClockinPunch[]>([]);
    const [siteFences, setSiteFences] = useState<ClockinCostCenterFences[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [preview, setPreview] = useState<{ result: ClockinParseResult; fileName: string } | null>(null);
    const [reloadToken, setReloadToken] = useState(0);

    const [regional, setRegional] = useState('');
    const [costCenter, setCostCenter] = useState('');
    const [search, setSearch] = useState('');
    const [alertCode, setAlertCode] = useState<ClockinAlertCode | ''>('');
    const [employeeCpf, setEmployeeCpf] = useState('');

    const range = useMemo(() => getCompetencyRange(competency), [competency]);

    const loadPortal = useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        try {
            const [punches, fences] = await Promise.all([
                getClockinPunches(range.start, range.end, user.scope),
                getSiteFences(user.scope)
            ]);
            setPortalPunches(punches);
            setSiteFences(fences);
        } catch (e) {
            console.error('Falha ao carregar auditoria de ponto', e);
            setPortalPunches([]);
            setLoadError('Não foi possível carregar as batidas salvas no portal. Você ainda pode importar um arquivo e ver a auditoria sem salvar.');
        } finally {
            setLoading(false);
        }
    }, [range.start, range.end, user.scope]);

    useEffect(() => { if (!preview) void loadPortal(); }, [loadPortal, preview, reloadToken]);

    // Abre na competência da última importação quando a atual ainda não tem batidas.
    useEffect(() => {
        getClockinImports(1)
            .then(([latest]) => {
                if (latest && latest.periodEnd < getCompetencyRange(getPlanningCompetency(todayKey())).start) {
                    setCompetency(getPlanningCompetency(latest.periodEnd));
                }
            })
            .catch(() => undefined);
    }, []);

    const basePunches = useMemo(() => {
        const source = preview ? preview.result.punches : portalPunches;
        return source.filter(p => isCostCenterInHumanCapitalScope(user.scope, p.costCenter));
    }, [preview, portalPunches, user.scope]);

    // A auditoria roda sobre todo o escopo (fuso por local e jornadas dependem do conjunto); os filtros vêm depois.
    const fenceHealth = useMemo(() => buildCarolFenceHealth(basePunches), [basePunches]);
    const rmDirectory = useMemo(() => {
        if (headcountRecords.length === 0 && globalEmployees.length === 0 && rmEmployees.length === 0) return undefined;
        const refDate = basePunches.length ? basePunches[basePunches.length - 1].date : todayKey();
        return buildRmDirectory(headcountRecords, globalEmployees, refDate, rmEmployees);
    }, [headcountRecords, globalEmployees, basePunches, rmEmployees]);
    const audited = useMemo(
        () => auditPunches(basePunches, { siteFences, fenceHealth, rmDirectory }),
        [basePunches, siteFences, fenceHealth, rmDirectory]
    );

    const options = useMemo(() => ({
        regionals: Array.from(new Set(audited.map(p => p.regional))).sort(),
        costCenters: Array.from(new Set(audited.filter(p => !regional || p.regional === regional).map(p => p.costCenter))).sort()
    }), [audited, regional]);

    const filtered = useMemo(() => {
        const term = search.trim().toLowerCase();
        const digits = term.replace(/\D/g, '');
        return audited.filter(p =>
            (!regional || p.regional === regional) &&
            (!costCenter || p.costCenter === costCenter) &&
            (!term ||
                p.name.toLowerCase().includes(term) ||
                p.supervisorName.toLowerCase().includes(term) ||
                (digits.length >= 3 && p.cpf.includes(digits)) ||
                (!!digits && p.rm?.employee?.chapa === digits))
        );
    }, [audited, regional, costCenter, search]);

    const summary = useMemo(() => summarizeAudit(filtered), [filtered]);

    const openEmployee = (cpf: string) => {
        setEmployeeCpf(cpf);
        setView('employee');
    };

    const sourceLabel = preview
        ? `Pré-visualização de ${preview.fileName} · ${formatPunchDate(preview.result.periodStart!)} a ${formatPunchDate(preview.result.periodEnd!)} (não salvo)`
        : `Batidas salvas no portal · competência ${formatCompetencyLabel(competency)} (${formatPunchDate(range.start)} a ${formatPunchDate(range.end)})`;

    const showFilters = view !== 'import';
    const empty = !loading && basePunches.length === 0;

    return (
        <div className="space-y-4">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-col xl:flex-row xl:items-center gap-3">
                <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1 overflow-x-auto">
                    {VIEWS.map(v => (
                        <button
                            key={v.key}
                            onClick={() => setView(v.key)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap ${view === v.key ? 'bg-white text-[#1e3a8a] shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
                        >
                            {v.label}
                        </button>
                    ))}
                </div>

                <div className="flex items-center gap-2 text-xs text-gray-600 xl:ml-auto">
                    {preview ? (
                        <>
                            <Eye size={14} className="text-amber-600" />
                            <span className="text-amber-700 font-semibold">{sourceLabel}</span>
                            <button onClick={() => setPreview(null)} className="px-2 py-1 rounded-lg border border-gray-200 hover:bg-gray-50 font-bold">Voltar ao portal</button>
                        </>
                    ) : (
                        <>
                            <Database size={14} className="text-blue-600" />
                            <button onClick={() => setCompetency(c => shiftCompetency(c, -1))} className="p-1 rounded-lg border border-gray-200 hover:bg-gray-50" title="Competência anterior"><ChevronLeft size={14} /></button>
                            <span className="font-semibold">{sourceLabel}</span>
                            <button onClick={() => setCompetency(c => shiftCompetency(c, 1))} className="p-1 rounded-lg border border-gray-200 hover:bg-gray-50" title="Próxima competência"><ChevronRight size={14} /></button>
                            <button onClick={() => void loadPortal()} className="p-1 rounded-lg border border-gray-200 hover:bg-gray-50" title="Recarregar"><RefreshCw size={14} /></button>
                        </>
                    )}
                </div>
            </div>

            {showFilters && (
                <div className="flex flex-wrap items-center gap-3">
                    <select className={selectClass} value={regional} onChange={e => { setRegional(e.target.value); setCostCenter(''); }}>
                        <option value="">Todas as regionais</option>
                        {options.regionals.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                    <select className={selectClass} value={costCenter} onChange={e => setCostCenter(e.target.value)}>
                        <option value="">Todos os centros de custo</option>
                        {options.costCenters.map(cc => <option key={cc} value={cc}>{cc} · {getClockinCCName(cc)}</option>)}
                    </select>
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Colaborador, supervisor, CPF ou chapa"
                        className="px-3 py-2 rounded-lg border border-gray-200 bg-white text-xs w-64"
                    />
                    {(regional || costCenter || search) && (
                        <button onClick={() => { setRegional(''); setCostCenter(''); setSearch(''); }} className="text-xs text-blue-700 font-semibold hover:underline">Limpar filtros</button>
                    )}
                    <span className="text-xs text-gray-500 ml-auto">{formatInt(filtered.length)} de {formatInt(audited.length)} batidas</span>
                </div>
            )}

            {loadError && !preview && view !== 'import' && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 flex items-start gap-2">
                    <XCircle size={18} className="shrink-0 mt-0.5" /> {loadError}
                </div>
            )}

            {view === 'import' ? (
                <ClockinImport
                    user={user}
                    canSave={canAdmin}
                    onPreview={(result, fileName) => {
                        setPreview({ result, fileName });
                        setView('overview');
                    }}
                    onSaved={meta => {
                        setPreview(null);
                        setCompetency(getPlanningCompetency(meta.periodEnd));
                        setReloadToken(t => t + 1);
                    }}
                />
            ) : loading && !preview ? (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 flex items-center justify-center gap-3 text-blue-700">
                    <Loader2 size={22} className="animate-spin" /> Carregando batidas...
                </div>
            ) : empty ? (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 text-center">
                    <p className="text-base font-bold text-slate-800">Nenhuma batida nesta competência</p>
                    <p className="text-sm text-slate-500 mt-2">Importe a exportação "Marcações" do Carol Clock In para começar a auditoria.</p>
                    <button onClick={() => setView('import')} className="mt-4 px-4 py-2 rounded-lg bg-[#1e3a8a] text-white text-sm font-bold">Importar arquivo</button>
                </div>
            ) : (
                <>
                    {view === 'overview' && (
                        <ClockinOverview
                            audited={filtered}
                            summary={summary}
                            rmStatus={rmStatus}
                            onSelectAlert={code => { setAlertCode(code); setView('punches'); }}
                            onSelectEmployee={openEmployee}
                            onGoToFences={() => setView('fences')}
                        />
                    )}
                    {view === 'punches' && (
                        <ClockinPunchTable audited={filtered} siteFences={siteFences} alertCode={alertCode} onAlertCodeChange={setAlertCode} onSelectEmployee={openEmployee} />
                    )}
                    {view === 'employee' && <ClockinEmployeeTimeline audited={filtered} siteFences={siteFences} cpf={employeeCpf} onCpfChange={setEmployeeCpf} />}
                    {view === 'fences' && (
                        <ClockinFences
                            user={user}
                            canEdit={canAdmin}
                            audited={filtered}
                            fenceHealth={fenceHealth}
                            siteFences={siteFences}
                            onFencesChange={setSiteFences}
                        />
                    )}
                </>
            )}
        </div>
    );
};

export default ClockinAuditView;
