/**
 * OccurrencesTable.tsx
 * Tabela de análise e classificação de ocorrências do RDO.
 */

import React, { useState, useMemo } from 'react';
import { Search, Download, ChevronUp, ChevronDown } from 'lucide-react';
import * as XLSX from 'xlsx';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { OccurrenceFact, OccurrenceEligibility, OccurrenceCategory } from '../../src/analytics/types/analyticsTypes';
import { Team } from '../../types';

interface OccurrencesTableProps {
  facts: OccurrenceFact[];
  projectName?: string;
  teams?: Team[];
  onNavigateToRDO?: (rdoId: string, teamId: string) => void;
  onCategoryChange?: (rdoId: string, occurrenceIndex: number, newCategory: string) => void;
  onEligibilityChange?: (rdoId: string, occurrenceIndex: number, newEligibility: string) => void;
}

const ELIGIBILITY_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  'Contratante':   { label: 'Contratante',   color: '#60a5fa', bg: '#1e3a8a' },
  'Contratada':   { label: 'Contratada',   color: '#fbbf24', bg: '#422006' },
  'Força maior':     { label: 'Força maior',     color: '#f87171', bg: '#450a0a' },
  'Não Classificado':       { label: 'Não Classificado',       color: '#94a3b8', bg: '#0f172a' },
  'POTENCIAL_PLEITO':   { label: 'Potencial Pleito',   color: '#60a5fa', bg: '#1e3a8a' },
  'RISCO_CONTRATADA':   { label: 'Risco Contratada',   color: '#fbbf24', bg: '#422006' },
  'REQUER_ANALISE':     { label: 'Requer Análise',     color: '#94a3b8', bg: '#0f172a' },
  'NAO_ELEGIVEL':       { label: 'Não Elegível',       color: '#94a3b8', bg: '#0f172a' },
};

const CATEGORY_CONFIG: Record<OccurrenceCategory, string> = {
  CIRCULACAO_TRENS: 'Circulação Trens',
  FALTA_MAO_OBRA: 'Falta Mão de Obra',
  EQUIPAMENTO_FERRAMENTA: 'Equip/Ferramenta',
  CLIMA: 'Clima',
  CALENDARIO: 'Calendário',
  OUTRA: 'Outra',
};

const NUM = (v: number, dec = 1) => v.toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec });

function KpiCard({ label, value, color }: { label: string; value: string | number; color: string }) {
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

export function OccurrencesTable({ facts, projectName, teams = [], onNavigateToRDO, onCategoryChange, onEligibilityChange }: OccurrencesTableProps) {
  const [eligibilityFilter, setEligibilityFilter] = useState<'ALL' | OccurrenceEligibility>('ALL');
  const [sortKey, setSortKey] = useState<keyof OccurrenceFact>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const filtered = useMemo(() => {
    return facts.filter(f => {
      if (eligibilityFilter !== 'ALL' && f.eligibility !== eligibilityFilter) return false;
      return true;
    });
  }, [facts, eligibilityFilter]);

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
    const totalHours = filtered.reduce((s, f) => s + f.impactHours, 0);
    const pleitos = filtered.filter(f => f.eligibility === 'POTENCIAL_PLEITO' || f.eligibility === 'Contratante').length;
    const riscos = filtered.filter(f => f.eligibility === 'RISCO_CONTRATADA' || f.eligibility === 'Contratada').length;
    
    return { totalHours, pleitos, riscos, total: filtered.length };
  }, [filtered]);

  const handleSort = (key: keyof OccurrenceFact) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const chartData = useMemo(() => {
    const dataMap: Record<string, number> = {};
    filtered.forEach(f => {
      const cat = f.category || 'Sem Categoria';
      if (!dataMap[cat]) dataMap[cat] = 0;
      dataMap[cat] += f.impactHours;
    });
    return Object.keys(dataMap).map(key => ({
      name: key,
      hours: Number(dataMap[key].toFixed(2))
    })).sort((a, b) => b.hours - a.hours);
  }, [filtered]);

  const SortIcon = ({ k }: { k: keyof OccurrenceFact }) =>
    sortKey === k ? (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />) : null;

  const thStyle: React.CSSProperties = {
    padding: '10px 12px', textAlign: 'left', color: '#94a3b8', fontSize: 13,
    fontWeight: 600, cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.1)',
    userSelect: 'none', whiteSpace: 'nowrap',
  };
  const tdStyle: React.CSSProperties = {
    padding: '8px 12px', fontSize: 13, borderBottom: '1px solid rgba(255,255,255,0.05)',
    verticalAlign: 'middle'
  };

  const handleExportExcel = () => {
    const dataToExport = sorted.map(f => ({
      Data: f.date,
      Descrição: f.description,
      Categoria: f.category || 'Não categorizada',
      Turma: teams.find(t => t.id === f.teamId)?.name || f.teamId,
      'Impacto (h)': f.status === 'SEM_DURACAO_EXPLICITA' ? '—' : f.impactHours,
      Elegibilidade: ELIGIBILITY_CONFIG[f.eligibility]?.label || f.eligibility
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Ocorrências");
    XLSX.writeFile(wb, `Ocorrencias_${projectName || 'Projeto'}.xlsx`);
  };

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", color: '#e2e8f0' }}>
      <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#f1f5f9', margin: 0 }}>Classificação de Ocorrências</h2>
          {projectName && <p style={{ color: '#94a3b8', margin: '4px 0 0', fontSize: 13 }}>Projeto: <strong>{projectName}</strong></p>}
        </div>
        <button 
          onClick={handleExportExcel}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', background: '#10b981', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', transition: 'background 0.2s' }}
          onMouseOver={e => e.currentTarget.style.background = '#059669'}
          onMouseOut={e => e.currentTarget.style.background = '#10b981'}
        >
          <Download size={16} /> Exportar Excel
        </button>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
        <KpiCard label="Ocorrências" value={summary.total} color="#60a5fa" />
        <KpiCard label="Horas Impactadas" value={NUM(summary.totalHours)} color="#fbbf24" />
        <KpiCard label="Potencial Pleito / Contratante" value={summary.pleitos} color="#f87171" />
        <KpiCard label="Risco Contratada" value={summary.riscos} color="#f59e0b" />
      </div>

      {chartData.length > 0 && (
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 12, padding: '20px', marginBottom: 24, height: 350 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: '#e2e8f0', margin: '0 0 16px 0' }}>Impacto por Categoria de Ocorrência</h3>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
              <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `${val}h`} />
              <Tooltip 
                cursor={{ fill: 'rgba(255,255,255,0.05)' }} 
                contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#f1f5f9' }}
                itemStyle={{ color: '#60a5fa' }}
                formatter={(value: number) => [`${value}h`, 'Impacto']}
              />
              <Bar dataKey="hours" fill="#60a5fa" radius={[4, 4, 0, 0]} barSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <select
          value={eligibilityFilter}
          onChange={e => setEligibilityFilter(e.target.value as any)}
          style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff' }}
        >
          <option value="ALL">Todas as Elegibilidades</option>
          {Object.entries(ELIGIBILITY_CONFIG).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>

      <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ background: 'rgba(255,255,255,0.03)' }}>
            <tr>
              <th style={thStyle} onClick={() => handleSort('date')}>Data <SortIcon k="date" /></th>
              <th style={thStyle} onClick={() => handleSort('description')}>Descrição <SortIcon k="description" /></th>
              <th style={thStyle} onClick={() => handleSort('category')}>Categoria <SortIcon k="category" /></th>
              <th style={thStyle}>Turma</th>
              <th style={{ ...thStyle, textAlign: 'right' }} onClick={() => handleSort('impactHours')}>Impacto (h) <SortIcon k="impactHours" /></th>
              <th style={thStyle} onClick={() => handleSort('eligibility')}>Elegibilidade <SortIcon k="eligibility" /></th>
              <th style={{ ...thStyle, textAlign: 'center' }}>Ação</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((f, i) => {
              const st = ELIGIBILITY_CONFIG[f.eligibility || 'Não Classificado'] || ELIGIBILITY_CONFIG['Não Classificado'];
              return (
                <tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)' }}>
                  <td style={{ ...tdStyle, color: '#94a3b8', whiteSpace: 'nowrap' }}>{f.date}</td>
                  <td style={{ ...tdStyle, color: '#e2e8f0', maxWidth: 200, whiteSpace: 'normal' }}>{f.description}</td>
                  <td style={{ ...tdStyle, color: '#cbd5e1', maxWidth: 160, whiteSpace: 'normal' }}>
                    <input 
                      type="text" 
                      defaultValue={f.category || ''} 
                      placeholder="Ex: Falta de Material"
                      onBlur={(e) => {
                         if (e.target.value !== f.category && onCategoryChange) {
                           onCategoryChange(f.rdoId, f.occurrenceIndex, e.target.value);
                         }
                      }}
                      onKeyDown={(e) => {
                         if (e.key === 'Enter') {
                           e.currentTarget.blur();
                         }
                      }}
                      style={{
                         width: '100%', padding: '6px 8px', borderRadius: '6px',
                         background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                         color: '#fff', fontSize: '13px'
                      }}
                    />
                  </td>
                  <td style={{ ...tdStyle, color: '#94a3b8' }}>{teams.find(t => t.id === f.teamId)?.name || f.teamId}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: f.impactHours > 0 ? '#fbbf24' : '#64748b' }}>
                    {f.status === 'SEM_DURACAO_EXPLICITA' ? '—' : NUM(f.impactHours)}
                  </td>
                  <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                    <select
                      value={f.eligibility || 'Não Classificado'}
                      onChange={(e) => onEligibilityChange && onEligibilityChange(f.rdoId, f.occurrenceIndex, e.target.value)}
                      style={{
                        padding: '4px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: 500,
                        background: st.bg, color: st.color, border: `1px solid ${st.color}44`,
                        cursor: 'pointer', outline: 'none'
                      }}
                    >
                      <option value="Contratante">Contratante</option>
                      <option value="Contratada">Contratada</option>
                      <option value="Força maior">Força maior</option>
                      <option value="Não Classificado">Não Classificado</option>
                      {!['Contratante', 'Contratada', 'Força maior', 'Não Classificado'].includes(f.eligibility || '') && (
                         <option value={f.eligibility}>{st.label}</option>
                      )}
                    </select>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    <button 
                      onClick={() => onNavigateToRDO && onNavigateToRDO(f.rdoId, f.teamId)}
                      style={{ padding: '4px 12px', background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.2)', borderRadius: 6, color: '#60a5fa', fontSize: 11, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}
                    >
                      Ir para RDO
                    </button>
                  </td>
                </tr>
              );
            })}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={7} style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>Nenhum registro encontrado.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
