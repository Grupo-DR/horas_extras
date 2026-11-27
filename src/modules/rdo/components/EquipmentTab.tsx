import React, { useMemo, useState } from 'react';
import { Pencil, Plus, Trash2, Truck, X } from 'lucide-react';
import { toast } from 'sonner';
import { EquipmentValueBasis, Project, ProjectEquipment, RDOData, Team } from '../types';
import { formatMoney, generateUUID } from '../utils';
import { equipmentMonths, equipmentStatus, equipmentTotal, summarizeEquipment } from '../utils/projectEquipment';
import { useCanWriteRdo } from '../hooks/useCanWriteRdo';
import { Badge, Button, EmptyState, PageHeader, RowMenu, SearchInput, TableCard, Td, Th } from './ui';

interface EquipmentTabProps {
  project: Project;
  teams: Team[];
  rdos: RDOData[];
  onSave: (list: ProjectEquipment[]) => Promise<void>;
}

const STATUS = {
  NA_OBRA: { label: 'Na obra', tone: 'success' },
  A_MOBILIZAR: { label: 'A mobilizar', tone: 'info' },
  DESMOBILIZADO: { label: 'Desmobilizado', tone: 'neutral' },
} as const;

const isoToBr = (iso?: string) => (iso ? iso.split('-').reverse().join('/') : '');
const int = (n: number) => n.toLocaleString('pt-BR');
const meses = (n: number) => `${n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} ${n === 1 ? 'mês' : 'meses'}`;

interface Form {
  type: string;
  code: string;
  startDate: string;
  endDate: string;
  value: string;
  valueBasis: EquipmentValueBasis;
  notes: string;
}

const EMPTY: Form = { type: '', code: '', startDate: '', endDate: '', value: '', valueBasis: 'MENSAL', notes: '' };

/** Aceita "1.234,56", "1234,56" ou "1234.56". */
const parseNum = (s: string): number => {
  const t = s.trim();
  if (!t) return 0;
  const n = Number(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t);
  return Number.isFinite(n) ? n : NaN;
};

const toForm = (e: ProjectEquipment): Form => ({
  type: e.type, code: e.code, startDate: e.startDate, endDate: e.endDate ?? '',
  value: e.value ? String(e.value).replace('.', ',') : '', valueBasis: e.valueBasis, notes: e.notes ?? '',
});

const inputCls = 'mt-1 block h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-[#0b1d4f] focus:outline-none';
const labelCls = 'block text-xs font-medium text-slate-700';

export const EquipmentTab: React.FC<EquipmentTabProps> = ({ project, teams, rdos, onSave }) => {
  const canWrite = useCanWriteRdo();
  const list = useMemo(() => project.equipmentAssets ?? [], [project.equipmentAssets]);
  const resumo = useMemo(() => summarizeEquipment(list), [list]);
  const [editing, setEditing] = useState<{ id: string | null; form: Form } | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  /** Sugestões de tipo: os já cadastrados e os nomes de equipamento que aparecem nos RDOs da obra. */
  const sugestoes = useMemo(() => {
    const ids = new Set(teams.filter(t => t.projectId === project.id).map(t => t.id));
    const nomes = new Map<string, string>();
    const add = (n?: string) => { const v = n?.trim(); if (v && !nomes.has(v.toUpperCase())) nomes.set(v.toUpperCase(), v); };
    list.forEach(e => add(e.type));
    rdos.filter(r => ids.has(r.teamId)).forEach(r => r.equipment?.forEach(e => add(e.name)));
    return [...nomes.values()].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [list, rdos, teams, project.id]);

  const visiveis = useMemo(() => {
    const termo = search.trim().toLowerCase();
    return [...list]
      .filter(e => !termo || `${e.type} ${e.code}`.toLowerCase().includes(termo))
      .sort((a, b) => a.type.localeCompare(b.type, 'pt-BR') || a.code.localeCompare(b.code, 'pt-BR', { numeric: true }));
  }, [list, search]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setEditing(e => (e ? { ...e, form: { ...e.form, [k]: v } } : e));

  const salvar = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!editing) return;
    const f = editing.form;
    const value = parseNum(f.value);
    if (!f.type.trim()) return toast.error('Informe o tipo do equipamento.');
    if (!f.code.trim()) return toast.error('Informe o código do equipamento (placa, patrimônio ou frota).');
    if (!f.startDate) return toast.error('Informe o início do período.');
    if (f.endDate && f.endDate < f.startDate) return toast.error('O fim do período é anterior ao início.');
    if (Number.isNaN(value)) return toast.error('Confira o valor: use só algarismos, vírgula para centavos.');
    const repetido = list.find(e => e.id !== editing.id && e.code.trim().toUpperCase() === f.code.trim().toUpperCase()
      && e.startDate === f.startDate);
    if (repetido) return toast.error(`O código ${f.code.trim()} já está cadastrado com esse início.`);

    const agora = new Date().toISOString();
    const anterior = editing.id ? list.find(e => e.id === editing.id) : undefined;
    const item: ProjectEquipment = {
      id: editing.id ?? generateUUID(),
      type: f.type.trim(),
      code: f.code.trim(),
      startDate: f.startDate,
      endDate: f.endDate || undefined,
      value,
      valueBasis: f.valueBasis,
      notes: f.notes.trim() || undefined,
      createdAt: anterior?.createdAt ?? agora,
      updatedAt: agora,
    };
    setSaving(true);
    try {
      await onSave(editing.id ? list.map(e => (e.id === editing.id ? item : e)) : [...list, item]);
      toast.success(editing.id ? 'Equipamento atualizado.' : 'Equipamento cadastrado.');
      setEditing(null);
    } catch (err) {
      toast.error(err instanceof Error ? `Não foi possível salvar: ${err.message}` : 'Não foi possível salvar.');
    } finally {
      setSaving(false);
    }
  };

  const excluir = async (e: ProjectEquipment) => {
    if (!confirm(`Excluir ${e.type} ${e.code}?`)) return;
    try {
      await onSave(list.filter(x => x.id !== e.id));
      toast.success('Equipamento excluído.');
    } catch (err) {
      toast.error(err instanceof Error ? `Não foi possível excluir: ${err.message}` : 'Não foi possível excluir.');
    }
  };

  const addButton = canWrite
    ? <Button variant="primary" icon={Plus} onClick={() => setEditing({ id: null, form: { ...EMPTY } })}>Novo equipamento</Button>
    : undefined;

  const f = editing?.form;
  const previaItem: ProjectEquipment | null = f ? {
    id: '', type: '', code: '', startDate: f.startDate, endDate: f.endDate || undefined,
    value: parseNum(f.value) || 0, valueBasis: f.valueBasis, createdAt: '', updatedAt: '',
  } : null;
  const previaMeses = previaItem?.startDate ? equipmentMonths(previaItem) : null;

  return (
    <>
      {list.length === 0 ? (
        <EmptyState
          icon={Truck}
          title="Nenhum equipamento cadastrado"
          description="Cadastre os equipamentos da obra com tipo, código (placa, patrimônio ou frota), período e valor."
          action={addButton}
        />
      ) : (
        <>
          <PageHeader
            title="Equipamentos"
            subtitle={`${int(resumo.count)} cadastrados · ${int(resumo.onSite)} na obra hoje (${formatMoney(resumo.monthlyOnSite)}/mês) · valor total ${formatMoney(resumo.total)}`}
            actions={addButton}
          />
          <div className="mb-3">
            <SearchInput value={search} onChange={setSearch} placeholder="Buscar por tipo ou código" />
          </div>
          <TableCard footer={visiveis.length !== list.length ? `Mostrando ${visiveis.length} de ${list.length} equipamentos` : undefined}>
            <thead>
              <tr>
                <Th>Tipo</Th>
                <Th>Código</Th>
                <Th>Período</Th>
                <Th>Situação</Th>
                <Th align="right">Valor</Th>
                <Th align="right">Total</Th>
                <Th align="right"><span className="sr-only">Ações</span></Th>
              </tr>
            </thead>
            <tbody>
              {visiveis.map(e => {
                const status = STATUS[equipmentStatus(e)];
                const m = equipmentMonths(e);
                return (
                  <tr key={e.id} className="hover:bg-slate-50">
                    <Td className="font-medium text-slate-900">
                      {e.type}
                      {e.notes && <div className="text-xs font-normal text-slate-500">{e.notes}</div>}
                    </Td>
                    <Td className="whitespace-nowrap font-mono text-xs text-slate-700">{e.code}</Td>
                    <Td className="whitespace-nowrap text-slate-600">
                      {isoToBr(e.startDate)} a {e.endDate ? isoToBr(e.endDate) : <span className="text-slate-400">em aberto</span>}
                      {m !== null && <span className="ml-1.5 text-xs text-slate-400">({meses(m)}{e.endDate ? '' : ' até hoje'})</span>}
                    </Td>
                    <Td><Badge tone={status.tone}>{status.label}</Badge></Td>
                    <Td align="right" className="whitespace-nowrap tabular-nums text-slate-700">
                      {formatMoney(e.value)}{e.valueBasis === 'MENSAL' ? '/mês' : ' fechado'}
                    </Td>
                    <Td align="right" className="whitespace-nowrap font-medium tabular-nums text-slate-900">{formatMoney(equipmentTotal(e))}</Td>
                    <Td align="right" className="w-10">
                      {canWrite && (
                        <RowMenu
                          label={`Ações de ${e.type} ${e.code}`}
                          actions={[
                            { label: 'Editar', icon: Pencil, onSelect: () => setEditing({ id: e.id, form: toForm(e) }) },
                            { label: 'Excluir', icon: Trash2, tone: 'danger', onSelect: () => excluir(e) },
                          ]}
                        />
                      )}
                    </Td>
                  </tr>
                );
              })}
              {visiveis.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-500">Nenhum equipamento encontrado.</td></tr>
              )}
            </tbody>
          </TableCard>
        </>
      )}

      {editing && f && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="dialog" aria-modal="true" aria-labelledby="equip-titulo">
          <form onSubmit={salvar} className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
              <h3 id="equip-titulo" className="text-sm font-semibold text-slate-900">{editing.id ? 'Editar equipamento' : 'Novo equipamento'}</h3>
              <button type="button" onClick={() => setEditing(null)} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Fechar">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 px-5 py-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_180px]">
                <label className={labelCls}>
                  Tipo do equipamento
                  <input value={f.type} onChange={e => set('type', e.target.value)} list="equip-tipos" className={inputCls} maxLength={80}
                    placeholder="Ex.: Caminhão munck" autoFocus />
                  <datalist id="equip-tipos">{sugestoes.map(s => <option key={s} value={s} />)}</datalist>
                </label>
                <label className={labelCls}>
                  Código
                  <input value={f.code} onChange={e => set('code', e.target.value)} className={inputCls} maxLength={40} placeholder="Placa, patrimônio ou frota" />
                </label>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className={labelCls}>Início<input type="date" value={f.startDate} onChange={e => set('startDate', e.target.value)} className={inputCls} /></label>
                <label className={labelCls}>
                  Fim <span className="font-normal text-slate-400">(vazio = ainda na obra)</span>
                  <input type="date" value={f.endDate} onChange={e => set('endDate', e.target.value)} className={inputCls} />
                </label>
              </div>

              <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2">
                <label className={labelCls}>
                  Valor (R$)
                  <input value={f.value} onChange={e => set('value', e.target.value)} inputMode="decimal" className={inputCls} placeholder="0,00" />
                </label>
                <div className="inline-flex h-9 rounded-lg bg-slate-100 p-1">
                  {([['MENSAL', 'Por mês'], ['TOTAL', 'Fechado no período']] as const).map(([b, label]) => (
                    <button key={b} type="button" onClick={() => set('valueBasis', b)}
                      className={`flex-1 rounded-md px-2.5 text-sm transition ${f.valueBasis === b ? 'bg-white font-medium text-[#0b1d4f] shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <label className={labelCls}>
                Observações <span className="font-normal text-slate-400">(opcional)</span>
                <input value={f.notes} onChange={e => set('notes', e.target.value)} className={inputCls} maxLength={200} placeholder="Ex.: locado da empresa X, com operador" />
              </label>

              <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                Valor total: <strong className="text-slate-900">{formatMoney(previaItem ? equipmentTotal(previaItem) : 0)}</strong>
                <span className="ml-1 text-xs text-slate-500">
                  {f.valueBasis === 'TOTAL'
                    ? '(valor fechado do período)'
                    : previaMeses !== null ? `(${meses(previaMeses)}${f.endDate ? '' : ' até hoje'} × valor mensal)` : '(informe o início)'}
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
