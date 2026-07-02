/**
 * ProductivityTable.tsx
 * Tabela de análise de produtividade (Aderência vs Composição)
 */

import React, { useState, useMemo } from 'react';
import { Search, Download, ChevronUp, ChevronDown } from 'lucide-react';
import { ProductivityFact, ProductivityStatus } from '../../src/analytics/types/analyticsTypes';

interface ProductivityTableProps {
  facts: ProductivityFact[];
  projectName?: string;
}

const STATUS_CONFIG: Record<ProductivityStatus, { label: string; color: string; bg: string }> = {
  ACIMA_COMPOSICAO:    { label: 'Acima da Comp.', color: '#4ade80', bg: '#052e16' },
  CONFORME_COMPOSICAO: { label: 'Conforme',       color: '#60a5fa', bg: '#1e3a8a' },
  ABAIXO_COMPOSICAO:   { label: 'Abaixo',         color: '#f87171', bg: '#450a0a' },
  SEM_PRODUCAO:        { label: 'Sem Produção',   color: '#fbbf24', bg: '#422006' },
  SEM_BASE:            { label: 'Sem Base',       color: '#94a3b8', bg: '#0f172a' },
};

const NUM = (v: number, dec = 2) => v.toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
const PCT = (v: number) => `${v > 0 ? '+' : ''}${NUM(v * 100, 1)}%`;

function KpiCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      flex: '1 1 200px', minWidth: 160,
      background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 12, padding: '16px', textAlign: 'center',
    }}>
      <div style={{ fontSize: 24, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>{label}</div>
    </div>
  );
}

export function ProductivityTable({ facts, projectName }: ProductivityTableProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | ProductivityStatus>('ALL');
  const [sortKey, setSortKey] = useState<keyof ProductivityFact>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const filtered = useMemo(() => {
    return facts.filter(f => {
      if (statusFilter !== 'ALL' && f.status !== statusFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        return (
          f.activityDescription.toLowerCase().includes(s) ||
          f.activityCode.toLowerCase().includes(s) ||
          f.date.includes(s)
        );
      }
      return true;
    });
  }, [facts, search, statusFilter]);

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

  const summary = useMemo(() => {
    const comBase = filtered.filter(f => f.status !== 'SEM_BASE');
    const aderencias = comBase.map(f => f.adherence).filter(a => a > 0);
    const mediaAd = aderencias.length > 0 ? aderencias.reduce((a, b) => a + b, 0) / aderencias.length : 0;
    const abaixo = comBase.filter(f => f.status === 'ABAIXO_COMPOSICAO').length;
    const acima = comBase.filter(f => f.status === 'ACIMA_COMPOSICAO').length;
    
    return { mediaAd, abaixo, acima, totalBase: comBase.length };
  }, [filtered]);

  const handleSort = (key: keyof ProductivityFact) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const SortIcon = ({ k }: { k: keyof ProductivityFact }) =>
    sortKey === k ? (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />) : null;

  const thStyle: React.CSSProperties = {
    padding: '10px 12px', textAlign: 'left', color: '#94a3b8', fontSize: 13,
    fontWeight: 600, cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.1)',
    userSelect: 'none', whiteSpace: 'nowrap',
  };
  const tdStyle: React.CSSProperties = {
    padding: '8px 12px', fontSize: 13, borderBottom: '1px solid rgba(255,255,255,0.05)',
    verticalAlign: 'middle', whiteSpace: 'nowrap',
  };

  const exportCsv = () => {
    const header = '"Data";"Cód";"Atividade";"Horas";"Prod Esperada";"Prod Real";"Unid";"Aderência %";"Prod/Hora";"Status"';
    const rows = sorted.map(f => [
      f.date, f.activityCode, `"${f.activityDescription.replace(/"/g, '""')}"`,
      String(f.workedHours).replace('.', ','),
      String(f.expectedProduction).replace('.', ','),
      String(f.actualProduction).replace('.', ','),
      f.unit,
      String(f.adherence).replace('.', ','),
      String(f.actualProductivityPerHour).replace('.', ','),
      STATUS_CONFIG[f.status].label
    ].join(';'));
    
    const blob = new Blob(['\uFEFF' + [header, ...rows].join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `produtividade_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
  };

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", color: '#e2e8f0' }}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#f1f5f9', margin: 0 }}>Produtividade Diária (Equipes)</h2>
        {projectName && <p style={{ color: '#94a3b8', margin: '4px 0 0', fontSize: 13 }}>Projeto: <strong>{projectName}</strong></p>}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
        <KpiCard label="Aderência Média" value={`${NUM(summary.mediaAd * 100, 1)}%`} color={summary.mediaAd >= 0.95 ? '#4ade80' : '#f87171'} />
        <KpiCard label="Itens com Base" value={String(summary.totalBase)} color="#60a5fa" />
        <KpiCard label="Abaixo da Base" value={String(summary.abaixo)} color="#f87171" />
        <KpiCard label="Acima da Base" value={String(summary.acima)} color="#4ade80" />
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 200px' }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
          <input
            type="text"
            placeholder="Buscar atividade..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', padding: '8px 12px 8px 32px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff', boxSizing: 'border-box' }}
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as any)}
          style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff' }}
        >
          <option value="ALL">Todos os status</option>
          {Object.entries(STATUS_CONFIG).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        <button onClick={exportCsv} style={{ padding: '8px 16px', background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.3)', borderRadius: 8, color: '#60a5fa', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Download size={14} /> Exportar CSV
        </button>
      </div>

      <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ background: 'rgba(255,255,255,0.03)' }}>
            <tr>
              <th style={thStyle} onClick={() => handleSort('date')}>Data <SortIcon k="date" /></th>
              <th style={thStyle} onClick={() => handleSort('activityDescription')}>Atividade <SortIcon k="activityDescription" /></th>
              <th style={{ ...thStyle, textAlign: 'right' }} onClick={() => handleSort('workedHours')}>Horas <SortIcon k="workedHours" /></th>
              <th style={{ ...thStyle, textAlign: 'right' }} onClick={() => handleSort('expectedProduction')}>Prod. Esperada <SortIcon k="expectedProduction" /></th>
              <th style={{ ...thStyle, textAlign: 'right' }} onClick={() => handleSort('actualProduction')}>Prod. Real <SortIcon k="actualProduction" /></th>
              <th style={{ ...thStyle, textAlign: 'right' }} onClick={() => handleSort('adherence')}>Aderência <SortIcon k="adherence" /></th>
              <th style={{ ...thStyle, textAlign: 'right' }} onClick={() => handleSort('actualProductivityPerHour')}>Real/Hr <SortIcon k="actualProductivityPerHour" /></th>
              <th style={thStyle} onClick={() => handleSort('status')}>Status <SortIcon k="status" /></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((f, i) => {
              const st = STATUS_CONFIG[f.status];
              return (
                <tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)' }}>
                  <td style={{ ...tdStyle, color: '#94a3b8' }}>{f.date}</td>
                  <td style={{ ...tdStyle, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    <div style={{ fontWeight: 600, color: '#e2e8f0' }}>{f.activityCode}</div>
                    <div style={{ color: '#94a3b8', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.activityDescription}</div>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right', color: '#64748b' }}>
                    {NUM(f.workedHours, 1)}h
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right', color: '#94a3b8', fontVariantNumeric: 'tabular-nums' }}>
                    {NUM(f.expectedProduction)} <span style={{ fontSize: 11 }}>{f.unit}</span>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right', color: '#e2e8f0', fontVariantNumeric: 'tabular-nums' }}>
                    {NUM(f.actualProduction)} <span style={{ fontSize: 11, color: '#64748b' }}>{f.unit}</span>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, color: f.adherence > 1.05 ? '#4ade80' : f.adherence >= 0.95 ? '#60a5fa' : f.status === 'SEM_BASE' ? '#64748b' : '#f87171', fontVariantNumeric: 'tabular-nums' }}>
                    {f.status === 'SEM_BASE' ? '—' : `${NUM(f.adherence * 100, 1)}%`}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right', color: '#94a3b8' }}>
                    {NUM(f.actualProductivityPerHour)} <span style={{ fontSize: 10 }}>/h</span>
                  </td>
                  <td style={tdStyle}>
                    <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 11, background: st.bg, color: st.color, border: `1px solid ${st.color}44` }}>
                      {st.label}
                    </span>
                  </td>
                </tr>
              );
            })}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={8} style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>Nenhum registro encontrado.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
