import React, { useMemo, useState } from 'react';
import { Building, HardHat, Pencil, Plus, Signpost, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { CostItemCategory, EquipmentValueBasis, Project, ProjectCostItem } from '../types';
import { formatMoney, generateUUID } from '../utils';
import { periodMonths, periodStatus, periodTotal, summarizePeriodCosts } from '../utils/projectEquipment';
import { useCanWriteRdo } from '../hooks/useCanWriteRdo';
import { Badge, Button, EmptyState, PageHeader, RowMenu, SearchInput, TableCard, Td, Th } from './ui';

/** Abas de custos da obra: mesma lógica, cada uma com seu grupo de itens. */
export const COST_CATEGORIES: Record<CostItemCategory, { label: string; icon: React.ElementType; description: string }> = {
  ADM_LOCAL: {
    label: 'Adm Local',
    icon: Building,
    description: 'Tudo o que mantém o escritório da obra funcionando: aluguel de container escritório, rádios digitais, internet, telefonia, impressora...',
  },
  CANTEIRO: {
    label: 'Canteiro de Obras',
    icon: HardHat,
    description: 'Estrutura do canteiro: ar-condicionado, geladeira, computadores, banheiros químicos, containers de vivência...',
  },
  FRENTE_AVANCADA: {
    label: 'Frente Avançada',
    icon: Signpost,
    description: 'Estrutura de apoio nas frentes de trabalho afastadas do canteiro: tendas, banheiros químicos, iluminação, água...',
  },
};

interface CostItemsTabProps {
  project: Project;
  category: CostItemCategory;
  onSave: (all: ProjectCostItem[]) => Promise<void>;
}

const STATUS = {
  ATIVO: { label: 'Ativo', tone: 'success' },
  A_INICIAR: { label: 'A iniciar', tone: 'info' },
  ENCERRADO: { label: 'Encerrado', tone: 'neutral' },
} as const;

const isoToBr = (iso?: string) => (iso ? iso.split('-').reverse().join('/') : '');
const int = (n: number) => n.toLocaleString('pt-BR');
const meses = (n: number) => `${n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} ${n === 1 ? 'mês' : 'meses'}`;

interface Form {
  item: string;
  supplier: string;
  startDate: string;
  endDate: string;
  value: string;
  valueBasis: EquipmentValueBasis;
  notes: string;
}

const EMPTY: Form = { item: '', supplier: '', startDate: '', endDate: '', value: '', valueBasis: 'MENSAL', notes: '' };

/** Aceita "1.234,56", "1234,56" ou "1234.56". */
const parseNum = (s: string): number => {
  const t = s.trim();
  if (!t) return 0;
  const n = Number(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t);
  return Number.isFinite(n) ? n : NaN;
};

const toForm = (c: ProjectCostItem): Form => ({
  item: c.item, supplier: c.supplier, startDate: c.startDate, endDate: c.endDate ?? '',
  value: c.value ? String(c.value).replace('.', ',') : '', valueBasis: c.valueBasis, notes: c.notes ?? '',
});

const inputCls = 'mt-1 block h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-[#0b1d4f] focus:outline-none';
const labelCls = 'block text-xs font-medium text-slate-700';

export const CostItemsTab: React.FC<CostItemsTabProps> = ({ project, category, onSave }) => {
  const config = COST_CATEGORIES[category];
  const canWrite = useCanWriteRdo();
  const all = useMemo(() => project.costItems ?? [], [project.costItems]);
  const list = useMemo(() => all.filter(c => c.category === category), [all, category]);
  const resumo = useMemo(() => summarizePeriodCosts(list), [list]);
  const [editing, setEditing] = useState<{ id: string | null; form: Form } | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  // Sugere só os itens que o próprio usuário já cadastrou nesta aba.
  const sugestoesItem = useMemo(() => {
    const nomes = new Map<string, string>();
    list.forEach(c => { if (!nomes.has(c.item.toUpperCase())) nomes.set(c.item.toUpperCase(), c.item); });
    return [...nomes.values()].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [list]);
  // Fornecedores já usados em qualquer aba de custos da obra.
  const sugestoesFornecedor = useMemo(
    () => [...new Set(all.map(c => c.supplier).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [all]);

  const visiveis = useMemo(() => {
    const termo = search.trim().toLowerCase();
    return [...list]
      .filter(c => !termo || `${c.item} ${c.supplier}`.toLowerCase().includes(termo))
      .sort((a, b) => a.item.localeCompare(b.item, 'pt-BR') || a.startDate.localeCompare(b.startDate));
  }, [list, search]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setEditing(e => (e ? { ...e, form: { ...e.form, [k]: v } } : e));

  const salvar = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!editing) return;
    const f = editing.form;
    const value = parseNum(f.value);
    if (!f.item.trim()) return toast.error('Informe o item.');
    if (!f.startDate) return toast.error('Informe o início do prazo.');
    if (f.endDate && f.endDate < f.startDate) return toast.error('O fim do prazo é anterior ao início.');
    if (Number.isNaN(value)) return toast.error('Confira o valor: use só algarismos, vírgula para centavos.');

    const agora = new Date().toISOString();
    const anterior = editing.id ? all.find(c => c.id === editing.id) : undefined;
    const item: ProjectCostItem = {
      id: editing.id ?? generateUUID(),
      category,
      item: f.item.trim(),
      supplier: f.supplier.trim(),
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
      await onSave(editing.id ? all.map(c => (c.id === editing.id ? item : c)) : [...all, item]);
      toast.success(editing.id ? 'Item atualizado.' : `Item cadastrado em ${config.label}.`);
      setEditing(null);
    } catch (err) {
      toast.error(err instanceof Error ? `Não foi possível salvar: ${err.message}` : 'Não foi possível salvar.');
    } finally {
      setSaving(false);
    }
  };

  const excluir = async (c: ProjectCostItem) => {
    if (!confirm(`Excluir "${c.item}"${c.supplier ? ` (${c.supplier})` : ''}?`)) return;
    try {
      await onSave(all.filter(x => x.id !== c.id));
      toast.success('Item excluído.');
    } catch (err) {
      toast.error(err instanceof Error ? `Não foi possível excluir: ${err.message}` : 'Não foi possível excluir.');
    }
  };

  const addButton = canWrite
    ? <Button variant="primary" icon={Plus} onClick={() => setEditing({ id: null, form: { ...EMPTY } })}>Novo item</Button>
    : undefined;

  const f = editing?.form;
  const previa = f ? { startDate: f.startDate, endDate: f.endDate || undefined, value: parseNum(f.value) || 0, valueBasis: f.valueBasis } : null;
  const previaMeses = previa?.startDate ? periodMonths(previa) : null;

  return (
    <>
      {list.length === 0 ? (
        <EmptyState
          icon={config.icon}
          title={`Nenhum item em ${config.label}`}
          description={config.description}
          action={addButton}
        />
      ) : (
        <>
          <PageHeader
            title={config.label}
            subtitle={`${int(resumo.count)} ${resumo.count === 1 ? 'item' : 'itens'} · ${int(resumo.active)} ativos (${formatMoney(resumo.monthlyActive)}/mês) · valor total ${formatMoney(resumo.total)}`}
            actions={addButton}
          />
          <div className="mb-3">
            <SearchInput value={search} onChange={setSearch} placeholder="Buscar por item ou fornecedor" />
          </div>
          <TableCard footer={visiveis.length !== list.length ? `Mostrando ${visiveis.length} de ${list.length} itens` : undefined}>
            <thead>
              <tr>
                <Th>Item</Th>
                <Th>Fornecedor</Th>
                <Th>Prazo</Th>
                <Th>Situação</Th>
                <Th align="right">Valor</Th>
                <Th align="right">Total</Th>
                <Th align="right"><span className="sr-only">Ações</span></Th>
              </tr>
            </thead>
            <tbody>
              {visiveis.map(c => {
                const status = STATUS[periodStatus(c)];
                const m = periodMonths(c);
                return (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <Td className="font-medium text-slate-900">
                      {c.item}
                      {c.notes && <div className="text-xs font-normal text-slate-500">{c.notes}</div>}
                    </Td>
                    <Td className="text-slate-700">{c.supplier || <span className="text-slate-400">—</span>}</Td>
                    <Td className="whitespace-nowrap text-slate-600">
                      {isoToBr(c.startDate)} a {c.endDate ? isoToBr(c.endDate) : <span className="text-slate-400">em aberto</span>}
                      {m !== null && <span className="ml-1.5 text-xs text-slate-400">({meses(m)}{c.endDate ? '' : ' até hoje'})</span>}
                    </Td>
                    <Td><Badge tone={status.tone}>{status.label}</Badge></Td>
                    <Td align="right" className="whitespace-nowrap tabular-nums text-slate-700">
                      {formatMoney(c.value)}{c.valueBasis === 'MENSAL' ? '/mês' : ' fechado'}
                    </Td>
                    <Td align="right" className="whitespace-nowrap font-medium tabular-nums text-slate-900">{formatMoney(periodTotal(c))}</Td>
                    <Td align="right" className="w-10">
                      {canWrite && (
                        <RowMenu
                          label={`Ações de ${c.item}`}
                          actions={[
                            { label: 'Editar', icon: Pencil, onSelect: () => setEditing({ id: c.id, form: toForm(c) }) },
                            { label: 'Excluir', icon: Trash2, tone: 'danger', onSelect: () => excluir(c) },
                          ]}
                        />
                      )}
                    </Td>
                  </tr>
                );
              })}
              {visiveis.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-500">Nenhum item encontrado.</td></tr>
              )}
            </tbody>
          </TableCard>
        </>
      )}

      {editing && f && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="dialog" aria-modal="true" aria-labelledby="custo-titulo">
          <form onSubmit={salvar} className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
              <h3 id="custo-titulo" className="text-sm font-semibold text-slate-900">
                {editing.id ? 'Editar item' : 'Novo item'} · {config.label}
              </h3>
              <button type="button" onClick={() => setEditing(null)} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Fechar">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 px-5 py-4">
              <label className={labelCls}>
                Item
                <input value={f.item} onChange={e => set('item', e.target.value)} list={`custo-itens-${category}`} className={inputCls} maxLength={100}
                  placeholder="Descreva o item" autoFocus />
                <datalist id={`custo-itens-${category}`}>{sugestoesItem.map(s => <option key={s} value={s} />)}</datalist>
              </label>

              <label className={labelCls}>
                Fornecedor
                <input value={f.supplier} onChange={e => set('supplier', e.target.value)} list="custo-fornecedores" className={inputCls} maxLength={100} placeholder="Nome do fornecedor" />
                <datalist id="custo-fornecedores">{sugestoesFornecedor.map(s => <option key={s} value={s} />)}</datalist>
              </label>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className={labelCls}>Início do prazo<input type="date" value={f.startDate} onChange={e => set('startDate', e.target.value)} className={inputCls} /></label>
                <label className={labelCls}>
                  Fim do prazo <span className="font-normal text-slate-400">(vazio = em andamento)</span>
                  <input type="date" value={f.endDate} onChange={e => set('endDate', e.target.value)} className={inputCls} />
                </label>
              </div>

              <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2">
                <label className={labelCls}>
                  Valor (R$)
                  <input value={f.value} onChange={e => set('value', e.target.value)} inputMode="decimal" className={inputCls} placeholder="0,00" />
                </label>
                <div className="inline-flex h-9 rounded-lg bg-slate-100 p-1">
                  {([['MENSAL', 'Por mês'], ['TOTAL', 'Fechado no prazo']] as const).map(([b, label]) => (
                    <button key={b} type="button" onClick={() => set('valueBasis', b)}
                      className={`flex-1 rounded-md px-2.5 text-sm transition ${f.valueBasis === b ? 'bg-white font-medium text-[#0b1d4f] shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <label className={labelCls}>
                Observações <span className="font-normal text-slate-400">(opcional)</span>
                <input value={f.notes} onChange={e => set('notes', e.target.value)} className={inputCls} maxLength={200} placeholder="Ex.: contrato nº, quantidade, local" />
              </label>

              <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                Valor total: <strong className="text-slate-900">{formatMoney(previa ? periodTotal(previa) : 0)}</strong>
                <span className="ml-1 text-xs text-slate-500">
                  {f.valueBasis === 'TOTAL'
                    ? '(valor fechado do prazo)'
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
