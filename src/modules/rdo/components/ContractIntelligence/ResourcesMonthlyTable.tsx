/**
 * ResourcesMonthlyTable.tsx
 * Tabela filtrável de fatos mensais MOI / MOD / EQUIP.
 *
 * Recursos:
 * - Filtro por grupo (MOD, MOI, EQUIP, ALL)
 * - Filtro por mês
 * - Filtro por status
 * - Busca por item (nome)
 * - KPI cards no topo
 * - Indicador de desvio colorido
 * - Exportação CSV simples
 */

import React, { useState, useMemo } from 'react';
import { Search, Download, ChevronUp, ChevronDown, Info } from 'lucide-react';
import {
  MonthlyResourceFact,
  MonthlyResourceStatus,
  splitResourceFactsByGroup,
  getFactsSummary,
} from '../../src/analytics/engines/resourcesMonthlyEngine';
import { DimensionGroup } from '../../src/analytics/types/analyticsTypes';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ResourcesMonthlyTableProps {
  facts: MonthlyResourceFact[];
  projectName?: string;
}

// ---------------------------------------------------------------------------
// Constantes de UI
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<MonthlyResourceStatus, { label: string; color: string; bg: string }> = {
  PLANEJADO_E_REALIZADO: { label: 'Plan. e Real.', color: '#4ade80', bg: '#052e16' },
  PLANEJADO_SEM_REALIZADO: { label: 'Pl. Sem Real.', color: '#60a5fa', bg: '#1e3a8a' },
  REALIZADO_FORA_DO_PLANEJAMENTO: { label: 'Fora do Plan.', color: '#fb923c', bg: '#431407' },
  SEM_EQUIVALENCIA: { label: 'Sem Equivalência', color: '#a78bfa', bg: '#2e1065' },
  SEM_CUSTO_CADASTRADO: { label: 'Sem Custo', color: '#94a3b8', bg: '#0f172a' },
};

const GROUP_CONFIG: Record<DimensionGroup, { label: string; color: string }> = {
  MOD: { label: 'MOD — M.O. Direta', color: '#4ade80' },
  MOI: { label: 'MOI — M.O. Indireta', color: '#60a5fa' },
  EQUIP: { label: 'EQUIP — Equipamentos', color: '#f59e0b' },
  MATERIAL: { label: 'Material', color: '#a78bfa' },
  OTHER: { label: 'Outros', color: '#94a3b8' },
};

const ALL_GROUPS: Array<'ALL' | DimensionGroup> = ['ALL', 'MOD', 'MOI', 'EQUIP', 'MATERIAL', 'OTHER'];
const ALL_STATUSES: Array<'ALL' | MonthlyResourceStatus> = [
  'ALL',
  'PLANEJADO_E_REALIZADO',
  'PLANEJADO_SEM_REALIZADO',
  'REALIZADO_FORA_DO_PLANEJAMENTO',
  'SEM_EQUIVALENCIA',
  'SEM_CUSTO_CADASTRADO',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const NUM = (v: number, dec = 2) => v.toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
const PCT = (v: number) => `${v >= 0 ? '+' : ''}${NUM(v * 100, 1)}%`;

function DeviationCell({ value, isCurrency }: { value: number; isCurrency?: boolean }) {
  // Positivo (gasto/quantidade extra) = RUIM (Vermelho)
  // Negativo (economia) = BOM (Verde)
  const color = value > 0 ? '#f87171' : value < 0 ? '#4ade80' : '#64748b';
  const label = isCurrency ? BRL(value) : NUM(value);
  return <span style={{ color, fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{value > 0 ? '+' : ''}{label}</span>;
}

function StatusBadge({ status }: { status: MonthlyResourceStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span style={{
      padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700,
      background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}44`,
      whiteSpace: 'nowrap',
    }}>
      {cfg.label}
    </span>
  );
}

function KpiCard({ label, value, color, sub }: { label: string; value: string; color: string; sub?: string }) {
  return (
    <div style={{
      flex: '1 1 140px', minWidth: 120,
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 12, padding: '12px 16px', textAlign: 'center',
    }}>
      <div style={{ fontSize: 16, fontWeight: 700, color, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</div>
      <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// Exporta CSV simples
function exportCsv(facts: MonthlyResourceFact[], filename: string) {
  const cols: Array<{ key: keyof MonthlyResourceFact; header: string }> = [
    { key: 'monthKey', header: 'Mês' },
    { key: 'group', header: 'Grupo' },
    { key: 'item', header: 'Item Padrão' },
    { key: 'itemRdo', header: 'Item RDO' },
    { key: 'validBusinessDays', header: 'Dias Úteis' },
    { key: 'plannedQty', header: 'Qtd Plan.' },
    { key: 'realizedAverageQty', header: 'Qtd Real.' },
    { key: 'quantityDeviation', header: 'Desvio Qtd' },
    { key: 'plannedHH', header: 'HH Plan.' },
    { key: 'realHH', header: 'HH Real' },
    { key: 'monthlyUnitCost', header: 'Custo Unit. Mensal' },
    { key: 'plannedCost', header: 'Custo Plan.' },
    { key: 'realizedCost', header: 'Custo Real.' },
    { key: 'financialDeviation', header: 'Desvio Fin.' },
    { key: 'status', header: 'Status' },
    { key: 'observation', header: 'Observação' },
  ];

  const header = cols.map(c => `"${c.header}"`).join(';');
  const rows = facts.map(f =>
    cols.map(c => {
      const v = f[c.key];
      if (typeof v === 'number') return String(v).replace('.', ',');
      return `"${String(v ?? '').replace(/"/g, '""')}"`;
    }).join(';')
  );

  const csv = [header, ...rows].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Tipo de ordenação
// ---------------------------------------------------------------------------

type SortKey = keyof MonthlyResourceFact;
type SortDir = 'asc' | 'desc';

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

export function ResourcesMonthlyTable({ facts, projectName }: ResourcesMonthlyTableProps) {
  const [groupFilter, setGroupFilter] = useState<'ALL' | DimensionGroup>('ALL');
  const [monthFilter, setMonthFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | MonthlyResourceStatus>('ALL');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('monthKey');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [activeTab, setActiveTab] = useState<'ALL' | 'MOD' | 'MOI' | 'EQUIP'>('ALL');

  // Meses disponíveis
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    facts.forEach(f => set.add(f.monthKey));
    return ['ALL', ...Array.from(set).sort()];
  }, [facts]);

  // Filtra por aba
  const tabFacts = useMemo(() => {
    if (activeTab === 'ALL') return facts;
    return facts.filter(f => f.group === activeTab);
  }, [facts, activeTab]);

  // Aplica filtros
  const filtered = useMemo(() => {
    let result = tabFacts;
    if (groupFilter !== 'ALL') result = result.filter(f => f.group === groupFilter);
    if (monthFilter !== 'ALL') result = result.filter(f => f.monthKey === monthFilter);
    if (statusFilter !== 'ALL') result = result.filter(f => f.status === statusFilter);
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(f =>
        f.item.toLowerCase().includes(s) ||
        f.itemRdo.toLowerCase().includes(s) ||
        f.itemStandard.toLowerCase().includes(s)
      );
    }
    return result;
  }, [tabFacts, groupFilter, monthFilter, statusFilter, search]);

  // Ordenação
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortDir === 'asc' ? av - bv : bv - av;
      }
      const as = String(av ?? '');
      const bs = String(bv ?? '');
      return sortDir === 'asc' ? as.localeCompare(bs) : bs.localeCompare(as);
    });
  }, [filtered, sortKey, sortDir]);

  // KPIs
  const summary = useMemo(() => getFactsSummary(filtered), [filtered]);
  const splitGroups = useMemo(() => splitResourceFactsByGroup(facts), [facts]);
  const tabCounts = useMemo(() => ({
    ALL: facts.length,
    MOD: splitGroups.mod.length,
    MOI: splitGroups.moi.length,
    EQUIP: splitGroups.equip.length,
  }), [facts, splitGroups]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const SortIcon = ({ k }: { k: SortKey }) =>
    sortKey === k
      ? (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)
      : null;

  const thStyle: React.CSSProperties = {
    padding: '8px 12px', textAlign: 'left', color: '#64748b', fontSize: 12,
    fontWeight: 600, whiteSpace: 'nowrap', cursor: 'pointer',
    borderBottom: '1px solid rgba(255,255,255,0.1)', userSelect: 'none',
  };
  const tdStyle: React.CSSProperties = {
    padding: '7px 12px', fontSize: 13, borderBottom: '1px solid rgba(255,255,255,0.05)',
    whiteSpace: 'nowrap', verticalAlign: 'middle',
  };

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", color: '#e2e8f0' }}>

      {/* Título */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#f1f5f9', margin: 0 }}>
          Análise Mensal de Recursos
        </h2>
        {projectName && (
          <p style={{ color: '#94a3b8', margin: '4px 0 0', fontSize: 13 }}>
            Projeto: <strong style={{ color: '#60a5fa' }}>{projectName}</strong>
          </p>
        )}
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
        <KpiCard label="Total de Registros" value={String(summary.totalFacts)} color="#e2e8f0" />
        <KpiCard label="Custo Planejado" value={BRL(summary.totalPlannedCost)} color="#60a5fa" />
        <KpiCard label="Custo Realizado" value={BRL(summary.totalRealizedCost)} color="#4ade80" />
        <KpiCard
          label="Desvio Financeiro"
          value={BRL(summary.financialDeviation)}
          color={summary.financialDeviation > 0 ? '#f87171' : summary.financialDeviation < 0 ? '#4ade80' : '#e2e8f0'}
        />
        <KpiCard label="HH Planejado" value={NUM(summary.totalPlannedHH)} color="#60a5fa" sub="horas" />
        <KpiCard label="HH Real" value={NUM(summary.totalRealHH)} color="#4ade80" sub="horas" />
        <KpiCard
          label="Plan. e Realizado"
          value={String(summary.countByStatus['PLANEJADO_E_REALIZADO'] ?? 0)}
          color="#4ade80"
        />
        <KpiCard
          label="Pl. Sem Realizado"
          value={String(summary.countByStatus['PLANEJADO_SEM_REALIZADO'] ?? 0)}
          color="#60a5fa"
        />
      </div>

      {/* Abas por grupo */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 0 }}>
        {(['ALL', 'MOD', 'MOI', 'EQUIP'] as const).map(tab => (
          <button
            key={tab}
            id={`tab-resources-${tab.toLowerCase()}`}
            onClick={() => { setActiveTab(tab); setGroupFilter('ALL'); }}
            style={{
              padding: '8px 16px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              borderRadius: '8px 8px 0 0',
              background: activeTab === tab ? 'rgba(96,165,250,0.15)' : 'transparent',
              color: activeTab === tab ? '#60a5fa' : '#64748b',
              borderBottom: activeTab === tab ? '2px solid #60a5fa' : '2px solid transparent',
            }}
          >
            {tab === 'ALL' ? 'Todos' : tab} ({tabCounts[tab]})
          </button>
        ))}
      </div>

      {/* Barra de filtros */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16, alignItems: 'center' }}>
        {/* Busca */}
        <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 160 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
          <input
            id="input-resources-search"
            type="text"
            placeholder="Buscar item..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%', padding: '7px 10px 7px 30px',
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8, color: '#e2e8f0', fontSize: 13, boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Mês */}
        <select
          id="select-resources-month"
          value={monthFilter}
          onChange={e => setMonthFilter(e.target.value)}
          style={selectStyle}
        >
          {availableMonths.map(m => (
            <option key={m} value={m}>{m === 'ALL' ? 'Todos os meses' : m}</option>
          ))}
        </select>

        {/* Status */}
        <select
          id="select-resources-status"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as 'ALL' | MonthlyResourceStatus)}
          style={selectStyle}
        >
          {ALL_STATUSES.map(s => (
            <option key={s} value={s}>
              {s === 'ALL' ? 'Todos os status' : STATUS_CONFIG[s].label}
            </option>
          ))}
        </select>

        {/* Export CSV */}
        <button
          id="btn-export-resources-csv"
          onClick={() => exportCsv(sorted, `recursos_mensais_${new Date().toISOString().slice(0, 10)}.csv`)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
            background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.3)',
            borderRadius: 8, color: '#60a5fa', cursor: 'pointer', fontSize: 13, fontWeight: 600,
          }}
        >
          <Download size={14} /> CSV
        </button>

        <span style={{ color: '#475569', fontSize: 12, marginLeft: 4 }}>
          {sorted.length} registro{sorted.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Tabela */}
      {sorted.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '40px 20px',
          color: '#475569', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: 12,
        }}>
          Nenhum registro encontrado para os filtros selecionados.
        </div>
      ) : (
        <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead style={{ background: 'rgba(255,255,255,0.03)' }}>
              <tr>
                <th style={thStyle} onClick={() => handleSort('monthKey')}>
                  Mês <SortIcon k="monthKey" />
                </th>
                <th style={thStyle} onClick={() => handleSort('group')}>
                  Grupo <SortIcon k="group" />
                </th>
                <th style={{ ...thStyle, minWidth: 160 }} onClick={() => handleSort('item')}>
                  Item Padrão <SortIcon k="item" />
                </th>
                <th style={{ ...thStyle, minWidth: 140 }}>Item RDO</th>
                <th style={{ ...thStyle, textAlign: 'right' }} onClick={() => handleSort('validBusinessDays')}>
                  D.Úteis <SortIcon k="validBusinessDays" />
                </th>
                <th style={{ ...thStyle, textAlign: 'right' }} onClick={() => handleSort('plannedQty')}>
                  Qtd Plan. <SortIcon k="plannedQty" />
                </th>
                <th style={{ ...thStyle, textAlign: 'right' }} onClick={() => handleSort('realizedAverageQty')}>
                  Qtd Real. <SortIcon k="realizedAverageQty" />
                </th>
                <th style={{ ...thStyle, textAlign: 'right' }} onClick={() => handleSort('quantityDeviation')}>
                  Δ Qtd <SortIcon k="quantityDeviation" />
                </th>
                <th style={{ ...thStyle, textAlign: 'right' }} onClick={() => handleSort('realHH')}>
                  HH Real <SortIcon k="realHH" />
                </th>
                <th style={{ ...thStyle, textAlign: 'right' }} onClick={() => handleSort('plannedCost')}>
                  Custo Plan. <SortIcon k="plannedCost" />
                </th>
                <th style={{ ...thStyle, textAlign: 'right' }} onClick={() => handleSort('realizedCost')}>
                  Custo Real. <SortIcon k="realizedCost" />
                </th>
                <th style={{ ...thStyle, textAlign: 'right' }} onClick={() => handleSort('financialDeviation')}>
                  Δ Fin. <SortIcon k="financialDeviation" />
                </th>
                <th style={thStyle} onClick={() => handleSort('status')}>
                  Status <SortIcon k="status" />
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((f, i) => {
                const grpColor = GROUP_CONFIG[f.group]?.color ?? '#94a3b8';
                return (
                  <tr
                    key={`${f.projectId}-${f.group}-${f.itemStandard}-${f.monthKey}-${i}`}
                    style={{
                      background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(96,165,250,0.06)')}
                    onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)')}
                  >
                    <td style={tdStyle}>{f.monthKey}</td>
                    <td style={tdStyle}>
                      <span style={{ color: grpColor, fontWeight: 600 }}>{f.group}</span>
                    </td>
                    <td style={{ ...tdStyle, color: '#e2e8f0', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {f.item}
                      {f.observation && (
                        <span title={f.observation} style={{ marginLeft: 4, cursor: 'help', opacity: 0.5 }}>
                          <Info size={11} style={{ verticalAlign: 'middle' }} />
                        </span>
                      )}
                    </td>
                    <td style={{ ...tdStyle, color: '#94a3b8' }}>{f.itemRdo || '—'}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', color: '#64748b' }}>{f.validBusinessDays}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', color: '#93c5fd', fontVariantNumeric: 'tabular-nums' }}>
                      {NUM(f.plannedQty)}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right', color: '#6ee7b7', fontVariantNumeric: 'tabular-nums' }}>
                      {NUM(f.realizedAverageQty)}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      <DeviationCell value={f.quantityDeviation} />
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right', color: '#94a3b8', fontVariantNumeric: 'tabular-nums' }}>
                      {NUM(f.realHH, 1)}h
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right', color: '#93c5fd', fontVariantNumeric: 'tabular-nums' }}>
                      {BRL(f.plannedCost)}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right', color: '#6ee7b7', fontVariantNumeric: 'tabular-nums' }}>
                      {BRL(f.realizedCost)}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      <DeviationCell value={f.financialDeviation} isCurrency />
                    </td>
                    <td style={tdStyle}>
                      <StatusBadge status={f.status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  padding: '7px 10px',
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8, color: '#e2e8f0', fontSize: 13,
};

export default ResourcesMonthlyTable;
