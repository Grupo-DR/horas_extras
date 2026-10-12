import React, { useEffect, useMemo, useState } from 'react';
import { format, addDays, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { BarChart2, Database, Clock, Plus, X, Pencil, Trash2, RefreshCw, History, Eye, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../../contexts/AuthContext';
import { PowerBiReport } from '../../data/powerbiReports';
import {
    BiStatusService,
    BiReportSchedule,
    BiDataSource,
    BiDataSourceKind,
    BiDataSourceUpdate,
    DEFAULT_SCHEDULE_DAYS
} from './biStatusService';

const DAY_LABELS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const DAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

// Limites de idade das bases atuais (horas)
const FRESH_MAX_HOURS = 6;
const WARNING_MAX_HOURS = 12;

const formatDays = (days: number[]): string => {
    const sorted = [...days].sort();
    if (sorted.length === 7) return 'Todos os dias';
    if (sorted.join() === '1,2,3,4,5') return 'Seg–Sex';
    if (sorted.length === 0) return '—';
    return sorted.map((d) => DAY_NAMES[d]).join(', ');
};

const toMinutes = (time: string) => {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
};

const nextRun = (schedule: BiReportSchedule | undefined, now: Date): Date | null => {
    if (!schedule || schedule.days.length === 0 || schedule.times.length === 0) return null;
    for (let offset = 0; offset <= 7; offset++) {
        const day = addDays(now, offset);
        if (!schedule.days.includes(day.getDay())) continue;
        for (const time of schedule.times) {
            const [h, m] = time.split(':').map(Number);
            const candidate = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m);
            if (candidate > now) return candidate;
        }
    }
    return null;
};

const formatNextRun = (date: Date | null, now: Date): string => {
    if (!date) return '—';
    if (isSameDay(date, now)) return `hoje às ${format(date, 'HH:mm')}`;
    if (isSameDay(date, addDays(now, 1))) return `amanhã às ${format(date, 'HH:mm')}`;
    return format(date, "EEE dd/MM 'às' HH:mm", { locale: ptBR });
};

const formatUpdatedAt = (date: Date | null): string =>
    date ? format(date, "dd/MM/yyyy 'às' HH:mm") : 'Ainda não registrada';

const formatElapsed = (from: Date, now: Date): string => {
    const totalMin = Math.max(0, Math.floor((now.getTime() - from.getTime()) / 60_000));
    const mins = totalMin % 60;
    if (totalMin < 60) return `${totalMin}min`;
    if (totalMin < 48 * 60) return `${Math.floor(totalMin / 60)}h ${String(mins).padStart(2, '0')}min`;
    return `${Math.floor(totalMin / 1440)} dias e ${Math.floor((totalMin % 1440) / 60)}h`;
};

/* ─────────────── Cores: horários do dia e idade das bases ─────────────── */

type ChipState = 'done' | 'next' | 'pending' | 'off';

const CHIP_CLASSES: Record<ChipState, string> = {
    done: 'bg-emerald-100 text-emerald-700',
    next: 'bg-white text-blue-700 ring-2 ring-blue-500',
    pending: 'bg-slate-100 text-slate-500',
    off: 'bg-slate-50 text-slate-300'
};

const chipStates = (schedule: BiReportSchedule, now: Date): Record<string, ChipState> => {
    const result: Record<string, ChipState> = {};
    if (!schedule.days.includes(now.getDay())) {
        schedule.times.forEach((t) => { result[t] = 'off'; });
        return result;
    }
    const nowMin = now.getHours() * 60 + now.getMinutes();
    let nextMarked = false;
    schedule.times.forEach((t) => {
        if (toMinutes(t) <= nowMin) result[t] = 'done';
        else if (!nextMarked) { result[t] = 'next'; nextMarked = true; }
        else result[t] = 'pending';
    });
    return result;
};

type Freshness = 'historical' | 'never' | 'fresh' | 'warning' | 'stale';

const getFreshness = (source: BiDataSource, now: Date): Freshness => {
    if (source.kind === 'historical') return 'historical';
    if (!source.lastUpdatedAt) return 'never';
    const hours = (now.getTime() - source.lastUpdatedAt.getTime()) / 3_600_000;
    if (hours <= FRESH_MAX_HOURS) return 'fresh';
    if (hours <= WARNING_MAX_HOURS) return 'warning';
    return 'stale';
};

const FRESHNESS_STYLES: Record<Freshness, { border: string; badge: string; dot: string }> = {
    historical: { border: 'border-l-blue-500', badge: 'bg-blue-50 text-blue-700', dot: 'bg-blue-500' },
    never: { border: 'border-l-slate-300', badge: 'bg-slate-100 text-slate-500', dot: 'bg-slate-300' },
    fresh: { border: 'border-l-emerald-500', badge: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' },
    warning: { border: 'border-l-amber-400', badge: 'bg-amber-50 text-amber-700', dot: 'bg-amber-400' },
    stale: { border: 'border-l-red-500', badge: 'bg-red-50 text-red-700', dot: 'bg-red-500' }
};

const AgeBadge: React.FC<{ source: BiDataSource; now: Date }> = ({ source, now }) => {
    if (!source.lastUpdatedAt) return null;
    const style = FRESHNESS_STYLES[getFreshness(source, now)];
    return (
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-semibold ${style.badge}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
            {formatElapsed(source.lastUpdatedAt, now)} desde a última atualização
        </span>
    );
};

const Legend: React.FC<{ items: { className: string; label: string }[] }> = ({ items }) => (
    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
        {items.map((item) => (
            <span key={item.label} className="inline-flex items-center gap-1.5">
                <span className={`w-2.5 h-2.5 rounded-sm ${item.className}`} /> {item.label}
            </span>
        ))}
    </div>
);

const SCHEDULE_LEGEND = [
    { className: 'bg-emerald-200', label: 'Horário já executado' },
    { className: 'bg-white ring-2 ring-blue-500', label: 'Próxima' },
    { className: 'bg-slate-200', label: 'Ainda hoje' }
];

const SOURCE_LEGEND = [
    { className: 'bg-emerald-500', label: `Até ${FRESH_MAX_HOURS}h` },
    { className: 'bg-amber-400', label: `${FRESH_MAX_HOURS}h a ${WARNING_MAX_HOURS}h` },
    { className: 'bg-red-500', label: `Acima de ${WARNING_MAX_HOURS}h` },
    { className: 'bg-blue-500', label: 'Base histórica' }
];

const SectionTitle: React.FC<{ icon: React.ElementType; title: string; action?: React.ReactNode }> = ({ icon: Icon, title, action }) => (
    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-500">
            <Icon size={16} /> {title}
        </h3>
        {action}
    </div>
);

const KindToggle: React.FC<{ value: BiDataSourceKind; onChange: (kind: BiDataSourceKind) => void }> = ({ value, onChange }) => (
    <div className="inline-flex rounded-md border border-slate-300 overflow-hidden text-xs font-semibold shrink-0">
        {([['current', 'Atual'], ['historical', 'Histórica']] as const).map(([kind, label]) => (
            <button
                key={kind}
                type="button"
                onClick={() => onChange(kind)}
                className={`px-2.5 py-1.5 transition-colors ${value === kind
                    ? kind === 'historical' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-white'
                    : 'bg-white text-slate-500 hover:bg-slate-50'}`}
            >
                {label}
            </button>
        ))}
    </div>
);

/* ─────────────────────────── Visão do usuário ─────────────────────────── */

const ReadOnlyView: React.FC<{
    reports: PowerBiReport[];
    schedules: Record<string, BiReportSchedule>;
    sources: BiDataSource[];
    now: Date;
}> = ({ reports, schedules, sources, now }) => (
    <div className="space-y-8">
        <section>
            <SectionTitle icon={BarChart2} title="Atualizações agendadas dos relatórios" action={<Legend items={SCHEDULE_LEGEND} />} />
            <div className="rounded-xl border border-slate-200 overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                        <tr>
                            <th className="text-left px-4 py-2 font-semibold">Relatório</th>
                            <th className="text-left px-4 py-2 font-semibold">Dias</th>
                            <th className="text-left px-4 py-2 font-semibold">Horários</th>
                            <th className="text-left px-4 py-2 font-semibold">Próxima atualização</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {reports.map((report) => {
                            const schedule = schedules[report.id];
                            if (!schedule || schedule.times.length === 0) {
                                return (
                                    <tr key={report.id}>
                                        <td className="px-4 py-3 font-medium text-slate-800">{report.title}</td>
                                        <td colSpan={3} className="px-4 py-3 text-slate-400 italic">Sem agenda cadastrada</td>
                                    </tr>
                                );
                            }
                            const states = chipStates(schedule, now);
                            const runsToday = schedule.days.includes(now.getDay());
                            return (
                                <tr key={report.id}>
                                    <td className="px-4 py-3 font-medium text-slate-800">{report.title}</td>
                                    <td className="px-4 py-3 text-slate-600">
                                        {formatDays(schedule.days)}
                                        {!runsToday && <span className="block text-xs text-slate-400">Sem atualização hoje</span>}
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex flex-wrap gap-1.5">
                                            {schedule.times.map((t) => (
                                                <span key={t} className={`px-2 py-0.5 rounded-md text-xs font-semibold transition-colors ${CHIP_CLASSES[states[t]]}`}>{t}</span>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-slate-600">{formatNextRun(nextRun(schedule, now), now)}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </section>

        <section>
            <SectionTitle icon={Database} title="Bases de dados" action={<Legend items={SOURCE_LEGEND} />} />
            {sources.length === 0 ? (
                <p className="text-sm text-slate-400 italic">Nenhuma base cadastrada.</p>
            ) : (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {sources.map((source) => {
                        const freshness = getFreshness(source, now);
                        return (
                            <div key={source.id} className={`rounded-xl border border-slate-200 border-l-4 ${FRESHNESS_STYLES[freshness].border} p-4`}>
                                <div className="flex items-start justify-between gap-2">
                                    <p className="font-semibold text-slate-800">{source.name}</p>
                                    <div className="flex shrink-0 gap-1">
                                        {source.kind === 'historical' && (
                                            <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-xs font-semibold">Histórica</span>
                                        )}
                                        {source.version && (
                                            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-xs font-semibold">{source.version}</span>
                                        )}
                                    </div>
                                </div>
                                <p className="mt-2 text-sm text-slate-600 flex items-center gap-1.5">
                                    <Clock size={14} className="text-slate-400" />
                                    {source.lastUpdatedAt ? `Atualizada em ${formatUpdatedAt(source.lastUpdatedAt)}` : 'Ainda não registrada'}
                                </p>
                                <div className="mt-2">
                                    <AgeBadge source={source} now={now} />
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </section>
    </div>
);

/* ─────────────────────────── Modo de edição (master) ─────────────────────────── */

const ScheduleEditorRow: React.FC<{
    report: PowerBiReport;
    schedule: BiReportSchedule | undefined;
    onSave: (days: number[], times: string[]) => void;
}> = ({ report, schedule, onSave }) => {
    const days = schedule?.days ?? DEFAULT_SCHEDULE_DAYS;
    const times = schedule?.times ?? [];
    const [newTime, setNewTime] = useState('');

    const toggleDay = (day: number) =>
        onSave(days.includes(day) ? days.filter((d) => d !== day) : [...days, day], times);

    const addTime = () => {
        if (!newTime) return;
        if (times.includes(newTime)) {
            toast.info('Este horário já está cadastrado.');
            return;
        }
        onSave(days, [...times, newTime]);
        setNewTime('');
    };

    return (
        <tr>
            <td className="px-4 py-3 font-medium text-slate-800">{report.title}</td>
            <td className="px-4 py-3">
                <div className="flex gap-1">
                    {DAY_LABELS.map((label, day) => (
                        <button
                            key={day}
                            type="button"
                            title={DAY_NAMES[day]}
                            onClick={() => toggleDay(day)}
                            className={`w-7 h-7 rounded-md text-xs font-bold transition-colors ${days.includes(day)
                                ? 'bg-blue-600 text-white'
                                : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </td>
            <td className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-1.5">
                    {times.map((t) => (
                        <span key={t} className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-md bg-blue-50 text-blue-700 text-xs font-semibold">
                            {t}
                            <button type="button" title="Remover horário" onClick={() => onSave(days, times.filter((x) => x !== t))} className="p-0.5 rounded hover:bg-blue-100">
                                <X size={12} />
                            </button>
                        </span>
                    ))}
                    <input
                        type="time"
                        value={newTime}
                        onChange={(e) => setNewTime(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && addTime()}
                        className="px-2 py-1 border border-slate-200 rounded-md text-xs text-slate-700"
                    />
                    <button
                        type="button"
                        onClick={addTime}
                        disabled={!newTime}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold text-blue-600 hover:bg-blue-50 disabled:opacity-40"
                    >
                        <Plus size={12} /> Horário
                    </button>
                </div>
            </td>
        </tr>
    );
};

const toInputDateTime = (date: Date) => format(date, "yyyy-MM-dd'T'HH:mm");

/**
 * Converte o campo de data manual. null = usar o horário do servidor (campo não alterado);
 * undefined = valor inválido (já notificado).
 */
const parseManualDate = (value: string, touched: boolean): Date | null | undefined => {
    if (!touched || !value) return null;
    const at = new Date(value);
    if (Number.isNaN(at.getTime())) { toast.error('Data inválida.'); return undefined; }
    if (at > new Date()) { toast.error('A data da atualização não pode estar no futuro.'); return undefined; }
    return at;
};

const DateTimeField: React.FC<{
    label: string;
    value: string;
    onChange: (value: string) => void;
    onKeyDown?: (e: React.KeyboardEvent) => void;
    hint?: React.ReactNode;
}> = ({ label, value, onChange, onKeyDown, hint }) => (
    <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
        {label}
        <input
            type="datetime-local"
            value={value}
            max={toInputDateTime(new Date())}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={onKeyDown}
            className="px-2 py-1.5 border border-slate-300 rounded-md text-sm font-normal text-slate-700 bg-white"
        />
        {hint && <span className="font-normal text-slate-400">{hint}</span>}
    </label>
);

const DataSourceEditorRow: React.FC<{
    source: BiDataSource;
    now: Date;
    onRegister: (version: string, at: Date | null) => Promise<void>;
    onEdit: (name: string, version: string, kind: BiDataSourceKind) => Promise<void>;
    onDelete: () => Promise<void>;
}> = ({ source, now, onRegister, onEdit, onDelete }) => {
    const [mode, setMode] = useState<'idle' | 'register' | 'edit'>('idle');
    const [name, setName] = useState(source.name);
    const [version, setVersion] = useState(source.version);
    const [kind, setKind] = useState<BiDataSourceKind>(source.kind);
    // Pré-preenchido com o horário atual; se não for alterado, grava o horário do servidor
    const [manualAt, setManualAt] = useState('');
    const [dateTouched, setDateTouched] = useState(false);
    const [busy, setBusy] = useState(false);
    const [history, setHistory] = useState<BiDataSourceUpdate[] | null>(null);
    const [showHistory, setShowHistory] = useState(false);

    const startRegister = () => {
        setVersion(source.version);
        setManualAt(toInputDateTime(new Date()));
        setDateTouched(false);
        setMode('register');
    };
    const startEdit = () => { setName(source.name); setVersion(source.version); setKind(source.kind); setMode('edit'); };

    const run = async (action: () => Promise<void>) => {
        setBusy(true);
        try {
            await action();
            setMode('idle');
            if (showHistory) setHistory(await BiStatusService.getHistory(source.id));
        } catch {
            // erro já notificado por quem executou a ação
        } finally {
            setBusy(false);
        }
    };

    const submitRegister = () => {
        const at = parseManualDate(manualAt, dateTouched);
        if (at === undefined) return;
        run(() => onRegister(version, at));
    };

    const submitEdit = () => { if (name.trim()) run(() => onEdit(name, version, kind)); };

    const toggleHistory = async () => {
        const next = !showHistory;
        setShowHistory(next);
        if (next) {
            try {
                setHistory(await BiStatusService.getHistory(source.id));
            } catch (e) {
                console.error(e);
                toast.error('Não foi possível carregar o histórico.');
            }
        }
    };

    const keys = (action: () => void) => (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') action();
        if (e.key === 'Escape') setMode('idle');
    };

    const freshness = getFreshness(source, now);

    return (
        <div className={`rounded-xl border border-slate-200 border-l-4 ${FRESHNESS_STYLES[freshness].border} p-4`}>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <div className="flex-1 min-w-[200px]">
                    {mode === 'edit' ? (
                        <div className="flex flex-wrap items-center gap-2">
                            <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={keys(submitEdit)} placeholder="Nome da base" autoFocus className="px-2 py-1 border border-slate-300 rounded-md text-sm flex-1 min-w-[160px]" />
                            <input value={version} onChange={(e) => setVersion(e.target.value)} onKeyDown={keys(submitEdit)} placeholder="Versão" className="px-2 py-1 border border-slate-300 rounded-md text-sm w-32" />
                            <KindToggle value={kind} onChange={setKind} />
                        </div>
                    ) : (
                        <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-slate-800">{source.name}</p>
                            {source.kind === 'historical' && <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-xs font-semibold">Histórica</span>}
                            {source.version && <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-xs font-semibold">{source.version}</span>}
                        </div>
                    )}
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                        <p className="text-xs text-slate-500">
                            {source.lastUpdatedAt
                                ? <>Atualizada em {formatUpdatedAt(source.lastUpdatedAt)}{source.lastUpdatedByName && <> por {source.lastUpdatedByName}</>}</>
                                : 'Ainda não registrada'}
                        </p>
                        <AgeBadge source={source} now={now} />
                    </div>
                </div>

                {mode === 'register' ? null : mode === 'edit' ? (
                    <div className="flex items-center gap-2">
                        <button type="button" disabled={busy || !name.trim()} onClick={submitEdit} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold disabled:opacity-50">
                            <Check size={14} /> Salvar
                        </button>
                        <button type="button" onClick={() => setMode('idle')} className="px-2 py-1.5 rounded-lg text-sm text-slate-500 hover:bg-slate-100">Cancelar</button>
                    </div>
                ) : (
                    <div className="flex items-center gap-1">
                        <button type="button" onClick={startRegister} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold">
                            <RefreshCw size={14} /> Registrar atualização
                        </button>
                        <button type="button" title="Histórico" onClick={toggleHistory} className={`p-2 rounded-lg hover:bg-slate-100 ${showHistory ? 'text-blue-600' : 'text-slate-400'}`}><History size={16} /></button>
                        <button type="button" title="Editar cadastro" onClick={startEdit} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"><Pencil size={16} /></button>
                        <button type="button" title="Excluir base" disabled={busy} onClick={() => window.confirm(`Excluir a base "${source.name}"?`) && run(onDelete)} className="p-2 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500"><Trash2 size={16} /></button>
                    </div>
                )}
            </div>

            {mode === 'register' && (
                <div className="mt-3 p-3 rounded-lg bg-emerald-50/60 border border-emerald-200 flex flex-wrap items-end gap-3">
                    <DateTimeField
                        label="Data e hora da atualização"
                        value={manualAt}
                        onChange={(v) => { setManualAt(v); setDateTouched(true); }}
                        onKeyDown={keys(submitRegister)}
                        hint={dateTouched
                            ? <button type="button" onClick={startRegister} className="text-blue-600 hover:underline">usar agora</button>
                            : 'Agora — altere para registrar uma data anterior'}
                    />
                    <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600 self-start">
                        Versão
                        <input value={version} onChange={(e) => setVersion(e.target.value)} onKeyDown={keys(submitRegister)} autoFocus placeholder="Opcional" className="px-2 py-1.5 border border-slate-300 rounded-md text-sm font-normal text-slate-700 w-36 bg-white" />
                    </label>
                    <div className="flex items-center gap-2 pb-5">
                        <button type="button" disabled={busy} onClick={submitRegister} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold disabled:opacity-50">
                            <Check size={14} /> Confirmar
                        </button>
                        <button type="button" onClick={() => setMode('idle')} className="px-2 py-1.5 rounded-lg text-sm text-slate-500 hover:bg-slate-100">Cancelar</button>
                    </div>
                </div>
            )}

            {showHistory && (
                <div className="mt-3 pt-3 border-t border-slate-100">
                    {history === null ? (
                        <p className="text-xs text-slate-400">Carregando…</p>
                    ) : history.length === 0 ? (
                        <p className="text-xs text-slate-400 italic">Nenhuma atualização registrada.</p>
                    ) : (
                        <ul className="space-y-1">
                            {history.map((h) => {
                                const isRetroactive = !!h.at && !!h.registeredAt && h.registeredAt.getTime() - h.at.getTime() > 5 * 60_000;
                                return (
                                    <li key={h.id} className="text-xs text-slate-600 flex flex-wrap gap-x-3">
                                        <span className="font-mono text-slate-500">{formatUpdatedAt(h.at)}</span>
                                        {h.version && <span className="font-semibold">{h.version}</span>}
                                        <span className="text-slate-400">{h.byName}</span>
                                        {isRetroactive && h.registeredAt && (
                                            <span className="text-slate-400 italic">registrado em {format(h.registeredAt, 'dd/MM HH:mm')}</span>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
            )}
        </div>
    );
};

const EditView: React.FC<{
    area: string;
    reports: PowerBiReport[];
    schedules: Record<string, BiReportSchedule>;
    sources: BiDataSource[];
    currentUser: { uid: string; name: string };
    now: Date;
}> = ({ area, reports, schedules, sources, currentUser, now }) => {
    const [creating, setCreating] = useState(false);
    const [newName, setNewName] = useState('');
    const [newVersion, setNewVersion] = useState('');
    const [newKind, setNewKind] = useState<BiDataSourceKind>('current');
    const [newUpdatedAt, setNewUpdatedAt] = useState('');

    const notifyError = (e: unknown) => {
        console.error(e);
        toast.error('Não foi possível salvar. Verifique sua conexão e permissões.');
    };

    const withToast = async (action: () => Promise<void>, success: string) => {
        try {
            await action();
            toast.success(success);
        } catch (e) {
            notifyError(e);
            throw e;
        }
    };

    const saveSchedule = (reportId: string) => (days: number[], times: string[]) =>
        withToast(() => BiStatusService.saveSchedule(reportId, area, days, times, currentUser.uid), 'Agenda salva.').catch(() => undefined);

    const registerUpdate = (source: BiDataSource) => async (version: string, at: Date | null) => {
        try {
            const isLatest = await BiStatusService.registerUpdate(source, version, currentUser, at);
            toast.success(isLatest ? 'Atualização registrada.' : 'Registro adicionado ao histórico (anterior à última atualização).');
        } catch (e) {
            notifyError(e);
            throw e;
        }
    };

    const resetCreate = () => {
        setNewName('');
        setNewVersion('');
        setNewKind('current');
        setNewUpdatedAt('');
        setCreating(false);
    };

    const createSource = async () => {
        if (!newName.trim()) return;
        // Data opcional: já cria a base com a última atualização registrada no histórico
        const at = parseManualDate(newUpdatedAt, true);
        if (at === undefined) return;
        try {
            const created = await BiStatusService.createDataSource(area, newName, newVersion, newKind, currentUser.uid);
            if (at) await BiStatusService.registerUpdate(created, newVersion, currentUser, at);
            toast.success('Base cadastrada.');
            resetCreate();
        } catch (e) {
            notifyError(e);
        }
    };

    return (
        <div className="space-y-8">
            <section>
                <SectionTitle icon={BarChart2} title="Agenda de atualização dos relatórios" />
                <div className="rounded-xl border border-slate-200 overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                            <tr>
                                <th className="text-left px-4 py-2 font-semibold">Relatório</th>
                                <th className="text-left px-4 py-2 font-semibold">Dias</th>
                                <th className="text-left px-4 py-2 font-semibold">Horários</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {reports.map((report) => (
                                <ScheduleEditorRow key={report.id} report={report} schedule={schedules[report.id]} onSave={saveSchedule(report.id)} />
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            <section>
                <SectionTitle
                    icon={Database}
                    title="Bases de dados"
                    action={!creating && (
                        <button type="button" onClick={() => setCreating(true)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-semibold text-blue-600 hover:bg-blue-50">
                            <Plus size={14} /> Nova base
                        </button>
                    )}
                />
                <div className="space-y-3">
                    {creating && (
                        <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-4 flex flex-wrap items-end gap-3">
                            <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600 flex-1 min-w-[200px]">
                                Nome da base
                                <input value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && createSource()} autoFocus className="px-2 py-1.5 border border-slate-300 rounded-md text-sm font-normal text-slate-700 bg-white" />
                            </label>
                            <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
                                Versão
                                <input value={newVersion} onChange={(e) => setNewVersion(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && createSource()} placeholder="Opcional" className="px-2 py-1.5 border border-slate-300 rounded-md text-sm font-normal text-slate-700 w-36 bg-white" />
                            </label>
                            <DateTimeField label="Última atualização em (opcional)" value={newUpdatedAt} onChange={setNewUpdatedAt} />
                            <div className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
                                Tipo
                                <KindToggle value={newKind} onChange={setNewKind} />
                            </div>
                            <div className="flex items-center gap-2">
                                <button type="button" onClick={createSource} disabled={!newName.trim()} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold disabled:opacity-50">
                                    <Check size={14} /> Cadastrar
                                </button>
                                <button type="button" onClick={resetCreate} className="px-2 py-1.5 rounded-lg text-sm text-slate-500 hover:bg-slate-100">Cancelar</button>
                            </div>
                        </div>
                    )}
                    {sources.length === 0 && !creating && <p className="text-sm text-slate-400 italic">Nenhuma base cadastrada.</p>}
                    {sources.map((source) => (
                        <DataSourceEditorRow
                            key={source.id}
                            source={source}
                            now={now}
                            onRegister={registerUpdate(source)}
                            onEdit={(name, version, kind) => withToast(() => BiStatusService.updateDataSource(source.id, name, version, kind), 'Base atualizada.')}
                            onDelete={() => withToast(() => BiStatusService.deleteDataSource(source.id), 'Base excluída.')}
                        />
                    ))}
                </div>
            </section>
        </div>
    );
};

/* ─────────────────────────── Painel ─────────────────────────── */

export const BiStatusPanel: React.FC<{ area: string; reports: PowerBiReport[] }> = ({ area, reports }) => {
    const { profile, user } = useAuth();
    const isMaster = !!profile?.isSuperAdmin;

    const [schedules, setSchedules] = useState<Record<string, BiReportSchedule>>({});
    const [sources, setSources] = useState<BiDataSource[]>([]);
    const [previewAsUser, setPreviewAsUser] = useState(false);
    const [now, setNow] = useState(() => new Date());

    useEffect(() => {
        const onError = (e: Error) => {
            console.error('[BiStatusPanel]', e);
            toast.error('Não foi possível carregar o status das bases.');
        };
        const unsubSchedules = BiStatusService.subscribeSchedules(area, setSchedules, onError);
        const unsubSources = BiStatusService.subscribeDataSources(area, setSources, onError);
        return () => { unsubSchedules(); unsubSources(); };
    }, [area]);

    // Relógio da tela: repinta horários e contadores a cada minuto, alinhado à virada do minuto
    useEffect(() => {
        let interval: ReturnType<typeof setInterval> | undefined;
        const tick = () => setNow(new Date());
        const timeout = setTimeout(() => {
            tick();
            interval = setInterval(tick, 60_000);
        }, 60_000 - (Date.now() % 60_000));
        return () => { clearTimeout(timeout); if (interval) clearInterval(interval); };
    }, []);

    const currentUser = useMemo(
        () => ({ uid: profile?.uid ?? '', name: profile?.displayName || user?.name || profile?.email || 'Master' }),
        [profile, user]
    );

    const editing = isMaster && !previewAsUser;

    return (
        <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-white flex-shrink-0">
                <div>
                    <h2 className="text-lg font-bold text-slate-800">Status das Bases</h2>
                    <p className="text-xs text-slate-500">
                        {editing ? 'Modo de edição: cadastre agendas e registre as atualizações das bases.' : 'Horários de atualização dos relatórios e das bases de dados.'}
                    </p>
                </div>
                {isMaster && (
                    <button
                        type="button"
                        onClick={() => setPreviewAsUser((v) => !v)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50"
                    >
                        {previewAsUser ? <><Pencil size={14} /> Voltar à edição</> : <><Eye size={14} /> Ver como usuário</>}
                    </button>
                )}
            </div>
            <div className="flex-1 overflow-y-auto p-4 lg:p-6">
                {editing ? (
                    <EditView area={area} reports={reports} schedules={schedules} sources={sources} currentUser={currentUser} now={now} />
                ) : (
                    <ReadOnlyView reports={reports} schedules={schedules} sources={sources} now={now} />
                )}
            </div>
        </div>
    );
};
