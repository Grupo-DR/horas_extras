import React, { useMemo, useState } from 'react';
import { BedDouble, Building2, Home, Pencil, Plus, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Accommodation, AccommodationBilling, AccommodationType, Project } from '../types';
import { formatMoney, generateUUID } from '../utils';
import { accommodationStatus, accommodationTotal, contractMonths, summarizeAccommodations } from '../utils/accommodation';
import { useCanWriteRdo } from '../hooks/useCanWriteRdo';
import { Badge, Button, EmptyState, PageHeader, RowMenu, TableCard, Td, Th } from './ui';

interface AccommodationsTabProps {
  project: Project;
  onSave: (list: Accommodation[]) => Promise<void>;
}

const TIPO: Record<AccommodationType, { label: string; icon: typeof Home }> = {
  HOTEL: { label: 'Hotel', icon: Building2 },
  CASA: { label: 'Casa', icon: Home },
};

const STATUS = {
  VIGENTE: { label: 'Vigente', tone: 'success' },
  A_INICIAR: { label: 'A iniciar', tone: 'info' },
  ENCERRADO: { label: 'Encerrado', tone: 'neutral' },
  SEM_PERIODO: null,
} as const;

const isoToBr = (iso?: string) => (iso ? iso.split('-').reverse().join('/') : '');
const int = (n: number) => n.toLocaleString('pt-BR');
const meses = (n: number) => `${n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} ${n === 1 ? 'mês' : 'meses'}`;

interface Form {
  type: AccommodationType;
  name: string;
  address: string;
  people: string;
  billing: AccommodationBilling;
  startDate: string;
  endDate: string;
  monthlyValue: string;
  stays: string;
  dailyValue: string;
  notes: string;
}

const EMPTY: Form = {
  type: 'HOTEL', name: '', address: '', people: '', billing: 'DIARIAS',
  startDate: '', endDate: '', monthlyValue: '', stays: '', dailyValue: '', notes: '',
};

/** Aceita "1.234,56", "1234,56" ou "1234.56". */
const parseNum = (s: string): number => {
  const t = s.trim();
  if (!t) return 0;
  const n = Number(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t);
  return Number.isFinite(n) ? n : NaN;
};

const toForm = (a: Accommodation): Form => ({
  type: a.type, name: a.name, address: a.address, people: String(a.people || ''), billing: a.billing,
  startDate: a.startDate ?? '', endDate: a.endDate ?? '',
  monthlyValue: a.monthlyValue ? String(a.monthlyValue).replace('.', ',') : '',
  stays: a.stays ? String(a.stays) : '',
  dailyValue: a.dailyValue ? String(a.dailyValue).replace('.', ',') : '',
  notes: a.notes ?? '',
});

const inputCls = 'mt-1 block h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-[#0b1d4f] focus:outline-none';
const labelCls = 'block text-xs font-medium text-slate-700';

export const AccommodationsTab: React.FC<AccommodationsTabProps> = ({ project, onSave }) => {
  const canWrite = useCanWriteRdo();
  const list = useMemo(() => project.accommodations ?? [], [project.accommodations]);
  const resumo = useMemo(() => summarizeAccommodations(list), [list]);
  const [editing, setEditing] = useState<{ id: string | null; form: Form } | null>(null);
  const [saving, setSaving] = useState(false);

  const sorted = useMemo(() => [...list].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')), [list]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setEditing(e => (e ? { ...e, form: { ...e.form, [k]: v } } : e));

  const novo = () => setEditing({ id: null, form: { ...EMPTY } });

  const salvar = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!editing) return;
    const f = editing.form;
    const people = parseNum(f.people);
    const monthlyValue = parseNum(f.monthlyValue);
    const stays = parseNum(f.stays);
    const dailyValue = parseNum(f.dailyValue);
    if (!f.name.trim()) return toast.error(f.type === 'HOTEL' ? 'Informe o nome do hotel.' : 'Dê um nome ao alojamento.');
    if ([people, monthlyValue, stays, dailyValue].some(Number.isNaN)) return toast.error('Confira os números: use só algarismos, vírgula para centavos.');
    if (f.billing === 'CONTRATO' && f.startDate && f.endDate && f.endDate < f.startDate) return toast.error('O término do contrato é anterior ao início.');

    const agora = new Date().toISOString();
    const anterior = editing.id ? list.find(a => a.id === editing.id) : undefined;
    const item: Accommodation = {
      id: editing.id ?? generateUUID(),
      type: f.type,
      name: f.name.trim(),
      address: f.address.trim(),
      people: Math.round(people),
      billing: f.billing,
      ...(f.billing === 'CONTRATO'
        ? { startDate: f.startDate || undefined, endDate: f.endDate || undefined, monthlyValue }
        : { stays: Math.round(stays), dailyValue }),
      notes: f.notes.trim() || undefined,
      createdAt: anterior?.createdAt ?? agora,
      updatedAt: agora,
    };
    const next = editing.id ? list.map(a => (a.id === editing.id ? item : a)) : [...list, item];
    setSaving(true);
    try {
      await onSave(next);
      toast.success(editing.id ? 'Alojamento atualizado.' : 'Alojamento cadastrado.');
      setEditing(null);
    } catch (err) {
      toast.error(err instanceof Error ? `Não foi possível salvar: ${err.message}` : 'Não foi possível salvar.');
    } finally {
      setSaving(false);
    }
  };

  const excluir = async (a: Accommodation) => {
    if (!confirm(`Excluir "${a.name}"?`)) return;
    try {
      await onSave(list.filter(x => x.id !== a.id));
      toast.success('Alojamento excluído.');
    } catch (err) {
      toast.error(err instanceof Error ? `Não foi possível excluir: ${err.message}` : 'Não foi possível excluir.');
    }
  };

  const addButton = canWrite ? <Button variant="primary" icon={Plus} onClick={novo}>Novo alojamento</Button> : undefined;

  const f = editing?.form;
  const previa = f ? accommodationTotal({
    id: '', createdAt: '', updatedAt: '', type: f.type, name: '', address: '', people: 0, billing: f.billing,
    startDate: f.startDate, endDate: f.endDate, monthlyValue: parseNum(f.monthlyValue) || 0,
    stays: parseNum(f.stays) || 0, dailyValue: parseNum(f.dailyValue) || 0,
  }) : 0;
  const mesesPrevia = f?.billing === 'CONTRATO' ? contractMonths(f.startDate, f.endDate) : null;

  return (
    <>
      {list.length === 0 ? (
        <EmptyState
          icon={BedDouble}
          title="Nenhum alojamento cadastrado"
          description="Cadastre os hotéis e as casas que a obra usa para alojar a equipe: endereço, quantas pessoas estão no local e o valor do contrato ou das diárias."
          action={addButton}
        />
      ) : (
        <>
          <PageHeader
            title="Alojamentos"
            subtitle={`${int(resumo.count)} ${resumo.count === 1 ? 'local' : 'locais'} · ${int(resumo.people)} pessoas alojadas · valor total ${formatMoney(resumo.total)}`}
            actions={addButton}
          />
          <TableCard>
            <thead>
              <tr>
                <Th>Nome</Th>
                <Th>Tipo</Th>
                <Th>Endereço</Th>
                <Th align="right">Pessoas</Th>
                <Th>Contrato / diárias</Th>
                <Th align="right">Valor</Th>
                <Th align="right">Total</Th>
                <Th align="right"><span className="sr-only">Ações</span></Th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(a => {
                const Icon = TIPO[a.type].icon;
                const status = STATUS[accommodationStatus(a)];
                const m = contractMonths(a.startDate, a.endDate);
                return (
                  <tr key={a.id} className="hover:bg-slate-50">
                    <Td className="font-medium text-slate-900">
                      {a.name}
                      {a.notes && <div className="text-xs font-normal text-slate-500">{a.notes}</div>}
                    </Td>
                    <Td><span className="inline-flex items-center gap-1.5 text-slate-700"><Icon className="h-4 w-4 text-slate-400" strokeWidth={1.75} />{TIPO[a.type].label}</span></Td>
                    <Td className="max-w-[260px] text-slate-600">{a.address || <span className="text-slate-400">—</span>}</Td>
                    <Td align="right" className="tabular-nums">{int(a.people)}</Td>
                    <Td className="whitespace-nowrap text-slate-600">
                      {a.billing === 'DIARIAS' ? (
                        `${int(a.stays ?? 0)} diárias`
                      ) : (
                        <span className="inline-flex items-center gap-2">
                          {a.startDate || a.endDate ? `${isoToBr(a.startDate) || '?'} a ${isoToBr(a.endDate) || '?'}` : 'Sem período'}
                          {m !== null && <span className="text-xs text-slate-400">({meses(m)})</span>}
                          {status && <Badge tone={status.tone}>{status.label}</Badge>}
                        </span>
                      )}
                    </Td>
                    <Td align="right" className="whitespace-nowrap tabular-nums text-slate-700">
                      {a.billing === 'DIARIAS' ? `${formatMoney(a.dailyValue ?? 0)}/diária` : `${formatMoney(a.monthlyValue ?? 0)}/mês`}
                    </Td>
                    <Td align="right" className="whitespace-nowrap font-medium tabular-nums text-slate-900">{formatMoney(accommodationTotal(a))}</Td>
                    <Td align="right" className="w-10">
                      {canWrite && (
                        <RowMenu
                          label={`Ações de ${a.name}`}
                          actions={[
                            { label: 'Editar', icon: Pencil, onSelect: () => setEditing({ id: a.id, form: toForm(a) }) },
                            { label: 'Excluir', icon: Trash2, tone: 'danger', onSelect: () => excluir(a) },
                          ]}
                        />
                      )}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </TableCard>
        </>
      )}

      {editing && f && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="dialog" aria-modal="true" aria-labelledby="aloj-titulo">
          <form onSubmit={salvar} className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
              <h3 id="aloj-titulo" className="text-sm font-semibold text-slate-900">{editing.id ? 'Editar alojamento' : 'Novo alojamento'}</h3>
              <button type="button" onClick={() => setEditing(null)} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Fechar">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 px-5 py-4">
              <div>
                <span className={labelCls}>Tipo</span>
                <div className="mt-1 grid grid-cols-2 gap-2">
                  {(Object.keys(TIPO) as AccommodationType[]).map(t => {
                    const Icon = TIPO[t].icon;
                    const ativo = f.type === t;
                    return (
                      <button key={t} type="button"
                        onClick={() => setEditing(e => e && { ...e, form: { ...e.form, type: t, billing: e.id ? e.form.billing : t === 'HOTEL' ? 'DIARIAS' : 'CONTRATO' } })}
                        className={`flex h-10 items-center justify-center gap-2 rounded-lg border text-sm transition ${ativo ? 'border-[#0b1d4f] bg-[#0b1d4f]/5 font-medium text-[#0b1d4f]' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`}>
                        <Icon className="h-4 w-4" strokeWidth={1.75} /> {TIPO[t].label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <label className={labelCls}>
                {f.type === 'HOTEL' ? 'Nome do hotel' : 'Nome do alojamento'}
                <input value={f.name} onChange={e => set('name', e.target.value)} className={inputCls} maxLength={80}
                  placeholder={f.type === 'HOTEL' ? 'Ex.: Hotel Central' : 'Ex.: Casa 1 — Rua das Flores'} autoFocus />
              </label>

              <label className={labelCls}>
                Endereço
                <input value={f.address} onChange={e => set('address', e.target.value)} className={inputCls} maxLength={200} placeholder="Rua, número, bairro, cidade" />
              </label>

              <label className={labelCls}>
                Pessoas no local
                <input value={f.people} onChange={e => set('people', e.target.value)} inputMode="numeric" className={`${inputCls} max-w-[140px]`} placeholder="0" />
              </label>

              <div>
                <span className={labelCls}>Cobrança</span>
                <div className="mt-1 inline-flex rounded-lg bg-slate-100 p-1">
                  {([['CONTRATO', 'Contrato por período'], ['DIARIAS', 'Diárias']] as const).map(([b, label]) => (
                    <button key={b} type="button" onClick={() => set('billing', b)}
                      className={`rounded-md px-3 py-1.5 text-sm transition ${f.billing === b ? 'bg-white font-medium text-[#0b1d4f] shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {f.billing === 'CONTRATO' ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <label className={labelCls}>Início<input type="date" value={f.startDate} onChange={e => set('startDate', e.target.value)} className={inputCls} /></label>
                  <label className={labelCls}>Término<input type="date" value={f.endDate} onChange={e => set('endDate', e.target.value)} className={inputCls} /></label>
                  <label className={labelCls}>Valor mensal (R$)<input value={f.monthlyValue} onChange={e => set('monthlyValue', e.target.value)} inputMode="decimal" className={inputCls} placeholder="0,00" /></label>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className={labelCls}>Quantidade de diárias<input value={f.stays} onChange={e => set('stays', e.target.value)} inputMode="numeric" className={inputCls} placeholder="0" /></label>
                  <label className={labelCls}>Valor da diária (R$)<input value={f.dailyValue} onChange={e => set('dailyValue', e.target.value)} inputMode="decimal" className={inputCls} placeholder="0,00" /></label>
                </div>
              )}

              <label className={labelCls}>
                Observações <span className="font-normal text-slate-400">(opcional)</span>
                <input value={f.notes} onChange={e => set('notes', e.target.value)} className={inputCls} maxLength={200} placeholder="Ex.: inclui café da manhã" />
              </label>

              <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                Valor total: <strong className="text-slate-900">{formatMoney(previa)}</strong>
                <span className="ml-1 text-xs text-slate-500">
                  {f.billing === 'DIARIAS'
                    ? '(diárias × valor da diária)'
                    : mesesPrevia !== null ? `(${meses(mesesPrevia)} × valor mensal)` : '(informe início e término)'}
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3">
              <Button onClick={() => setEditing(null)} disabled={saving}>Cancelar</Button>
              <Button type="submit" variant="primary" disabled={saving}>{saving ? 'Salvando…' : 'Salvar'}</Button>
            </div>
          </form>
        </div>
      )}
    </>
  );
};
