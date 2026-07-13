/**
 * ValidationCenter.tsx
 * Painel para exibição de alertas e inconsistências encontradas pelos motores analíticos.
 */

import React, { useMemo } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle, Info } from 'lucide-react';

export interface ValidationItem {
  id: string;
  type: 'error' | 'warning' | 'info' | 'success';
  title: string;
  description: string;
  module: 'RECURSOS' | 'MEDICAO' | 'PRODUTIVIDADE' | 'OCORRENCIAS' | 'IMPRODUTIVIDADE' | 'GERAL';
}

import { DimensionItem } from '../../src/analytics/types/analyticsTypes';

interface ValidationCenterProps {
  issues: ValidationItem[];
  dimensions?: DimensionItem[];
}

const TYPE_CONFIG = {
  error: { color: '#f87171', bg: '#450a0a', border: '#7f1d1d', icon: AlertCircle, label: 'Erro Crítico' },
  warning: { color: '#fbbf24', bg: '#422006', border: '#a16207', icon: AlertTriangle, label: 'Aviso' },
  info: { color: '#60a5fa', bg: '#1e3a8a', border: '#1e40af', icon: Info, label: 'Informativo' },
  success: { color: '#4ade80', bg: '#052e16', border: '#14532d', icon: CheckCircle, label: 'Validado' }
};

export function ValidationCenter({ issues, dimensions = [] }: ValidationCenterProps) {
  const summary = useMemo(() => {
    return {
      errors: issues.filter(i => i.type === 'error').length,
      warnings: issues.filter(i => i.type === 'warning').length,
      infos: issues.filter(i => i.type === 'info').length,
      successes: issues.filter(i => i.type === 'success').length,
      total: issues.length
    };
  }, [issues]);

  if (issues.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 24px', background: 'rgba(255,255,255,0.02)', borderRadius: 16, border: '1px dashed rgba(255,255,255,0.1)' }}>
        <CheckCircle size={48} color="#4ade80" style={{ margin: '0 auto 16px' }} />
        <h3 style={{ color: '#f1f5f9', fontSize: 18, marginBottom: 8 }}>Tudo Certo!</h3>
        <p style={{ color: '#94a3b8', maxWidth: 400, margin: '0 auto' }}>Não foram detectadas inconsistências nos dados de entrada ou nas parametrizações contratuais desta obra.</p>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "'Inter', sans-serif" }}>
      <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 200px', background: 'rgba(255,255,255,0.03)', padding: 16, borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ fontSize: 24, fontWeight: 'bold', color: '#f87171' }}>{summary.errors}</div>
          <div style={{ color: '#94a3b8', fontSize: 13, marginTop: 4 }}>Erros Críticos</div>
        </div>
        <div style={{ flex: '1 1 200px', background: 'rgba(255,255,255,0.03)', padding: 16, borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ fontSize: 24, fontWeight: 'bold', color: '#fbbf24' }}>{summary.warnings}</div>
          <div style={{ color: '#94a3b8', fontSize: 13, marginTop: 4 }}>Avisos e Inconsistências</div>
        </div>
        <div style={{ flex: '1 1 200px', background: 'rgba(255,255,255,0.03)', padding: 16, borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ fontSize: 24, fontWeight: 'bold', color: '#60a5fa' }}>{summary.infos}</div>
          <div style={{ color: '#94a3b8', fontSize: 13, marginTop: 4 }}>Informativos</div>
        </div>
        <div style={{ flex: '1 1 200px', background: 'rgba(255,255,255,0.03)', padding: 16, borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ fontSize: 24, fontWeight: 'bold', color: '#4ade80' }}>{summary.successes}</div>
          <div style={{ color: '#94a3b8', fontSize: 13, marginTop: 4 }}>Validados com Sucesso</div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {issues.map(issue => {
          const cfg = TYPE_CONFIG[issue.type];
          const Icon = cfg.icon;
          return (
            <div key={issue.id} style={{
              display: 'flex', gap: 16, background: cfg.bg, border: `1px solid ${cfg.border}`,
              padding: 16, borderRadius: 12, alignItems: 'flex-start'
            }}>
              <div style={{ marginTop: 2 }}>
                <Icon size={20} color={cfg.color} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
                  <h4 style={{ margin: 0, color: cfg.color, fontSize: 15, fontWeight: 600 }}>{issue.title}</h4>
                  <span style={{ fontSize: 11, background: 'rgba(0,0,0,0.3)', padding: '2px 8px', borderRadius: 10, color: 'rgba(255,255,255,0.7)' }}>
                    Módulo: {issue.module}
                  </span>
                </div>
                <p style={{ margin: 0, color: '#e2e8f0', fontSize: 14, lineHeight: 1.5 }}>{issue.description}</p>
              </div>
            </div>
          );
        })}
      </div>

      {dimensions.length > 0 && (
        <div style={{ marginTop: 40 }}>
          <h3 style={{ fontSize: 18, fontWeight: 600, color: '#f1f5f9', marginBottom: 16 }}>Equivalências Validadas (Recursos)</h3>
          <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead style={{ background: 'rgba(255,255,255,0.03)' }}>
                <tr>
                  <th style={{ padding: '10px 16px', textAlign: 'left', color: '#64748b', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Item Padrão</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left', color: '#64748b', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Equivalência (RDO)</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left', color: '#64748b', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Grupo</th>
                  <th style={{ padding: '10px 16px', textAlign: 'center', color: '#64748b', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Vigência</th>
                  <th style={{ padding: '10px 16px', textAlign: 'right', color: '#64748b', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Custo Unitário Mensal</th>
                </tr>
              </thead>
              <tbody>
                {dimensions.map((dim, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '10px 16px', color: '#e2e8f0', fontWeight: 500 }}>{dim.name}</td>
                    <td style={{ padding: '10px 16px', color: dim.rdoEquivalent ? '#4ade80' : '#94a3b8' }}>{dim.rdoEquivalent || '—'}</td>
                    <td style={{ padding: '10px 16px', color: '#94a3b8' }}>{dim.group}</td>
                    <td style={{ padding: '10px 16px', color: '#94a3b8', textAlign: 'center', fontSize: 12 }}>
                      {dim.iStart ? dim.iStart.split('-').reverse().join('/') : 'Início'} 
                      <span style={{ margin: '0 4px', color: '#475569' }}>até</span> 
                      {dim.iEnd ? dim.iEnd.split('-').reverse().join('/') : 'Fim'}
                    </td>
                    <td style={{ padding: '10px 16px', color: '#93c5fd', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {dim.monthlyUnitCost > 0 ? dim.monthlyUnitCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'R$ 0,00'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
