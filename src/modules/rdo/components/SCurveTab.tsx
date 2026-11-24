import React, { useEffect, useMemo, useState } from 'react';
import {
  Bar, CartesianGrid, ComposedChart, Legend, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { CopyPlus, LineChart, Save, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { Project, SCurveDoc, SCurveSeries } from '../types';
import { formatMoney } from '../utils';
import { getSCurve, saveSCurve } from '../services/sCurveService';
import { useCanWriteRdo } from '../hooks/useCanWriteRdo';
import {
  SCurveKind, SCurveWeek, addBaselineRevision, buildSCurve, buildWeeks, mondayOf, newSCurveDoc,
  parseCellNumber, parsePastedColumn, setWeeklyValues,
} from '../utils/sCurve';
import { Button, EmptyState, PageHeader, TableCard, Td, Th } from './ui';

const NAVY = '#0b1d4f';
const LB0_GRAY = '#94a3b8';
const REAL_GREEN = '#059669';
const TREND_AMBER = '#d97706';

const pct = (n: number | null | undefined, digits = 2) =>
  n === null || n === undefined ? '—' : `${n.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`;
const signed = (n: number | null) =>
  n === null ? '—' : `${n > 0 ? '+' : ''}${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const deviationTone = (n: number | null) => (n === null ? '' : n < 0 ? 'text-rose-600' : 'text-emerald-700');
const weekTag = (w: SCurveWeek | null) => (w ? `S${w.week}/${String(w.year).slice(2)} (${w.label})` : '—');
const todayIso = () => new Date().toISOString().slice(0, 10);

type Field = 'previsto' | 'realizado' | 'tendencia';

/** Célula numérica: digita livre e grava ao sair; colar várias linhas do Excel preenche as semanas seguintes. */
const NumberCell: React.FC<{
  value: number | null;
  display: (v: number) => string;
  disabled?: boolean;
  label: string;
  onCommit: (value: number | null) => void;
  onPasteColumn: (text: string) => void;
}> = ({ value, display, disabled, label, onCommit, onPasteColumn }) => {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <input
      type="text"
      inputMode="decimal"
      aria-label={label}
      disabled={disabled}
      value={draft ?? (value === null ? '' : display(value))}
      onFocus={() => setDraft(value === null ? '' : display(value))}
      onChange={e => setDraft(e.target.value)}
      onBlur={() => {
        if (draft !== null) onCommit(parseCellNumber(draft));
        setDraft(null);
      }}
      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
      onPaste={e => {
        const text = e.clipboardData.getData('text');
        if (!/[\r\n]/.test(text.trim())) return; // um valor só: colagem normal
        e.preventDefault();
        setDraft(null);
        onPasteColumn(text);
      }}
      className="h-7 w-full rounded border border-transparent bg-transparent px-1.5 text-right text-[13px] tabular-nums text-slate-900 hover:border-slate-300 focus:border-[#0b1d4f] focus:bg-white focus:outline-none disabled:cursor-not-allowed disabled:text-slate-400 disabled:hover:border-transparent"
    />
  );
};

/** Formulário para criar a Curva S da obra: semana inicial e quantidade de semanas. */
const CreateCurve: React.FC<{ onCreate: (startWeek: string, weekCount: number) => void; disabled: boolean }> = ({ onCreate, disabled }) => {
  const [start, setStart] = useState(todayIso());
  const [count, setCount] = useState(52);
  return (
    <EmptyState
      icon={LineChart}
      title="Curva S ainda não criada para esta obra"
      description={disabled
        ? 'Peça a um Gerente ou Administrador do RDO Online para criar a Curva S.'
        : 'Informe a semana de início (linha de base) e quantas semanas o cronograma tem. Depois é só digitar ou colar os valores semanais.'}
      action={!disabled && (
        <div className="flex flex-wrap items-end justify-center gap-2 text-left">
          <label className="text-xs text-slate-500">
            Início (qualquer dia da semana)
            <input type="date" value={start} onChange={e => setStart(e.target.value)} className="mt-1 block h-9 rounded-lg border border-slate-300 px-2 text-sm text-slate-900" />
          </label>
          <label className="text-xs text-slate-500">
            Semanas
            <input type="number" min={1} max={260} value={count} onChange={e => setCount(Number(e.target.value))} className="mt-1 block h-9 w-24 rounded-lg border border-slate-300 px-2 text-sm text-slate-900" />
          </label>
          <Button variant="primary" disabled={!start || count < 1} onClick={() => onCreate(start, count)}>Criar Curva S</Button>
        </div>
      )}
    />
  );
};

export const SCurveTab: React.FC<{ project: Project | null }> = ({ project }) => {
  const canWrite = useCanWriteRdo();
  const [saved, setSaved] = useState<SCurveDoc | null>(null);
  const [draft, setDraft] = useState<SCurveDoc | null>(null);
  const [kind, setKind] = useState<SCurveKind>('fisico');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!project) return;
    let active = true;
    setLoading(true);
    getSCurve(project.id)
      .then(curve => { if (active) { setSaved(curve); setDraft(curve); } })
      .catch(err => toast.error(err instanceof Error ? err.message : 'Não foi possível carregar a Curva S.'))
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [project?.id]);

  const weeks = useMemo(() => (draft ? buildWeeks(draft.startWeek, draft.weekCount) : []), [draft?.startWeek, draft?.weekCount]);
  const result = useMemo(() => (draft ? buildSCurve(draft, kind) : null), [draft, kind]);
  const dirty = draft !== saved;
  const vigente = draft?.baselines[draft.baselines.length - 1];
  const isMoney = kind === 'financeiro';
  const formatValue = (v: number) => (isMoney
    ? v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : v.toLocaleString('pt-BR', { maximumFractionDigits: 4 }));

  if (!project) return <EmptyState icon={LineChart} title="Selecione uma obra" description="A Curva S é registrada por obra." />;
  if (loading) return <p className="py-10 text-center text-sm text-slate-500">Carregando Curva S…</p>;
  if (!draft || !result || !vigente) {
    return <CreateCurve disabled={!canWrite} onCreate={(start, count) => setDraft(newSCurveDoc(project.id, start, count))} />;
  }

  // ─── Edição ────────────────────────────────────────────────────────────────
  const updateSeries = (field: Field, fn: (series: SCurveSeries) => SCurveSeries) => {
    setDraft(d => {
      if (!d) return d;
      if (field === 'previsto') {
        const baselines = d.baselines.map((b, i) => (i === d.baselines.length - 1 ? { ...b, ...fn(b) } : b));
        return { ...d, baselines };
      }
      return { ...d, [field]: fn(d[field]) };
    });
  };
  const writeValues = (field: Field, fromIndex: number, values: (number | null)[]) =>
    updateSeries(field, series => ({ ...series, [kind]: setWeeklyValues(series[kind], weeks, fromIndex, values) }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const stored = await saveSCurve(draft);
      setSaved(stored);
      setDraft(stored);
      toast.success('Curva S salva.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível salvar a Curva S.');
    } finally {
      setSaving(false);
    }
  };

  const changePeriod = (startWeek: string, weekCount: number) => {
    if (!startWeek || weekCount < 1) return;
    setDraft(d => (d ? { ...d, startWeek: mondayOf(startWeek), weekCount } : d));
  };

  const hasRevision = draft.baselines.length > 1;
  const statusIdx = result.statusWeek ? weeks.findIndex(w => w.key === result.statusWeek!.key) : -1;
  const chartData = result.rows.map(r => ({
    semana: `S${r.week.week}/${String(r.week.year).slice(2)}`,
    periodo: r.week.label,
    previsto: r.previsto,
    realizado: r.realizado,
    previstoAcum: r.previstoAcum,
    lb0Acum: hasRevision ? r.previstoLB0Acum : undefined,
    realizadoAcum: r.realizadoAcum,
    tendenciaAcum: r.tendenciaAcum,
  }));

  const kpis = [
    { label: `Previsto acumulado (${vigente.name})`, value: pct(result.previstoNoStatus) },
    { label: 'Realizado acumulado', value: pct(result.realizadoNoStatus) },
    {
      label: hasRevision ? `Desvio × ${vigente.name} (LB0)` : 'Desvio',
      value: result.desvioNoStatus === null ? '—'
        : `${signed(result.desvioNoStatus)} p.p.${hasRevision ? ` (${signed(result.desvioLB0NoStatus)})` : ''}`,
      tone: deviationTone(result.desvioNoStatus),
    },
    { label: 'Semana de status', value: weekTag(result.statusWeek) },
    { label: `Término ${vigente.name}`, value: weekTag(result.terminoLB) },
    { label: 'Término pela tendência', value: weekTag(result.terminoTendencia) },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title={`Curva S ${isMoney ? 'financeira' : 'física'}`}
        subtitle={isMoney
          ? `Valores em R$ por semana; 100% = total da ${vigente.name} (${formatMoney(result.baselineTotal)}).`
          : 'Valores em % por semana. Cole colunas inteiras do Excel numa célula para preencher as semanas seguintes.'}
        actions={<>
          <div className="flex rounded-lg border border-slate-300 bg-white p-0.5" role="tablist">
            {(['fisico', 'financeiro'] as SCurveKind[]).map(k => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={kind === k}
                onClick={() => setKind(k)}
                className={`rounded-md px-3 py-1.5 text-sm transition ${kind === k ? 'bg-[#0b1d4f] font-medium text-white' : 'text-slate-600 hover:text-slate-900'}`}
              >
                {k === 'fisico' ? 'Física' : 'Financeira'}
              </button>
            ))}
          </div>
          {canWrite && (
            <>
              <Button icon={CopyPlus} onClick={() => setDraft(d => (d ? addBaselineRevision(d) : d))} title="Copia a linha de base vigente para uma nova revisão">
                Nova revisão
              </Button>
              {dirty && saved && <Button icon={Undo2} onClick={() => setDraft(saved)}>Descartar</Button>}
              <Button variant="primary" icon={Save} disabled={!dirty || saving} onClick={handleSave}>
                {saving ? 'Salvando…' : 'Salvar'}
              </Button>
            </>
          )}
        </>}
      />

      {/* Indicadores */}
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 md:grid-cols-3 xl:grid-cols-6">
        {kpis.map(k => (
          <div key={k.label} className="bg-white px-4 py-3">
            <div className="text-xs text-slate-500">{k.label}</div>
            <div className={`mt-1 text-sm font-semibold tabular-nums text-slate-900 ${k.tone ?? ''}`}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Gráfico */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="h-[340px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="semana" tick={{ fontSize: 11, fill: '#64748b' }} interval="preserveStartEnd" minTickGap={24} />
              <YAxis yAxisId="acum" domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 11, fill: '#64748b' }} width={44} />
              <YAxis yAxisId="sem" orientation="right" tickFormatter={v => `${v}%`} tick={{ fontSize: 11, fill: '#94a3b8' }} width={40} />
              <Tooltip
                formatter={(value: number, name: string) => [pct(value), name]}
                labelFormatter={(label, payload) => `${label} · ${payload?.[0]?.payload?.periodo ?? ''}`}
                contentStyle={{ borderRadius: 8, borderColor: '#e2e8f0', fontSize: 12 }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar yAxisId="sem" dataKey="previsto" name={`Previsto semanal (${vigente.name})`} fill="#cbd5e1" barSize={6} />
              <Bar yAxisId="sem" dataKey="realizado" name="Realizado semanal" fill="#86efac" barSize={6} />
              {hasRevision && (
                <Line yAxisId="acum" dataKey="lb0Acum" name="Previsto acumulado (LB0)" stroke={LB0_GRAY} strokeDasharray="4 3" dot={false} strokeWidth={1.5} />
              )}
              <Line yAxisId="acum" dataKey="previstoAcum" name={`Previsto acumulado (${vigente.name})`} stroke={NAVY} dot={false} strokeWidth={2} />
              <Line yAxisId="acum" dataKey="realizadoAcum" name="Realizado acumulado" stroke={REAL_GREEN} dot={false} strokeWidth={2} connectNulls={false} />
              <Line yAxisId="acum" dataKey="tendenciaAcum" name="Tendência acumulada" stroke={TREND_AMBER} strokeDasharray="6 4" dot={false} strokeWidth={2} connectNulls={false} />
              {result.statusWeek && (
                <ReferenceLine yAxisId="acum" x={`S${result.statusWeek.week}/${String(result.statusWeek.year).slice(2)}`} stroke="#475569" strokeDasharray="2 2" label={{ value: 'Status', position: 'top', fontSize: 11, fill: '#475569' }} />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Período e linha de base */}
      <div className="flex flex-wrap items-end gap-3 text-xs text-slate-500">
        <label>
          Início
          <input
            type="date"
            disabled={!canWrite}
            value={draft.startWeek}
            onChange={e => changePeriod(e.target.value, draft.weekCount)}
            className="mt-1 block h-8 rounded-lg border border-slate-300 bg-white px-2 text-sm text-slate-900 disabled:bg-slate-50"
          />
        </label>
        <label>
          Semanas
          <input
            type="number"
            min={1}
            max={260}
            disabled={!canWrite}
            value={draft.weekCount}
            onChange={e => changePeriod(draft.startWeek, Number(e.target.value))}
            className="mt-1 block h-8 w-20 rounded-lg border border-slate-300 bg-white px-2 text-sm text-slate-900 disabled:bg-slate-50"
          />
        </label>
        <p className="pb-2">
          Linhas de base: {draft.baselines.map(b => `${b.name} (${new Date(b.createdAt).toLocaleDateString('pt-BR')})`).join(' · ')}.
          {' '}A coluna "Previsto" edita a {vigente.name}, a vigente; as anteriores ficam guardadas para comparação.
        </p>
      </div>

      {/* Tabela semanal */}
      <TableCard footer="Tendência: digite a partir da semana seguinte ao último realizado; o acumulado parte do realizado da semana de status.">
        <thead>
          <tr>
            <Th>Semana</Th>
            <Th>Período</Th>
            <Th align="right">Previsto {isMoney ? '(R$)' : '(%)'}</Th>
            <Th align="right">Prev. acum.</Th>
            <Th align="right">Realizado {isMoney ? '(R$)' : '(%)'}</Th>
            <Th align="right">Real. acum.</Th>
            <Th align="right">Tendência {isMoney ? '(R$)' : '(%)'}</Th>
            <Th align="right">Tend. acum.</Th>
            <Th align="right">Desvio{hasRevision ? ` × ${vigente.name}` : ''}</Th>
            {hasRevision && <Th align="right">Desvio × LB0</Th>}
          </tr>
        </thead>
        <tbody>
          {result.rows.map((r, i) => {
            const isStatus = i === statusIdx;
            return (
              <tr key={r.week.key} className={isStatus ? 'bg-slate-50' : 'hover:bg-slate-50'}>
                <Td className="whitespace-nowrap font-medium text-slate-900">
                  S{r.week.week}/{String(r.week.year).slice(2)}
                  {isStatus && <span className="ml-2 text-xs font-normal text-slate-500">status</span>}
                </Td>
                <Td className="whitespace-nowrap text-slate-500">{r.week.label}</Td>
                <Td align="right" className="w-36 py-1">
                  <NumberCell
                    label={`Previsto ${r.week.label}`}
                    value={vigente[kind][r.week.key] ?? null}
                    display={formatValue}
                    disabled={!canWrite}
                    onCommit={v => writeValues('previsto', i, [v])}
                    onPasteColumn={text => writeValues('previsto', i, parsePastedColumn(text, kind))}
                  />
                </Td>
                <Td align="right">{pct(r.previstoAcum)}</Td>
                <Td align="right" className="w-36 py-1">
                  <NumberCell
                    label={`Realizado ${r.week.label}`}
                    value={draft.realizado[kind][r.week.key] ?? null}
                    display={formatValue}
                    disabled={!canWrite}
                    onCommit={v => writeValues('realizado', i, [v])}
                    onPasteColumn={text => writeValues('realizado', i, parsePastedColumn(text, kind))}
                  />
                </Td>
                <Td align="right">{pct(r.realizadoAcum)}</Td>
                <Td align="right" className="w-36 py-1">
                  <NumberCell
                    label={`Tendência ${r.week.label}`}
                    value={draft.tendencia[kind][r.week.key] ?? null}
                    display={formatValue}
                    disabled={!canWrite || i <= statusIdx}
                    onCommit={v => writeValues('tendencia', i, [v])}
                    onPasteColumn={text => writeValues('tendencia', i, parsePastedColumn(text, kind))}
                  />
                </Td>
                <Td align="right">{pct(r.tendenciaAcum)}</Td>
                <Td align="right" className={deviationTone(r.desvio)}>{signed(r.desvio)}</Td>
                {hasRevision && <Td align="right" className={deviationTone(r.desvioLB0)}>{signed(r.desvioLB0)}</Td>}
              </tr>
            );
          })}
        </tbody>
      </TableCard>
    </div>
  );
};
