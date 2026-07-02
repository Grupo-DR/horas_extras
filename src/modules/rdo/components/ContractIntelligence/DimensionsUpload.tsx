import React, { useState, useRef, useCallback } from 'react';
import { Upload, CheckCircle, AlertTriangle, XCircle, Calendar, Tag, DollarSign, Save, Trash2, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { Project } from '../../types';
import { DimensionImportResult, DimensionGroup } from '../../src/analytics/types/analyticsTypes';
import { parseDimensionsExcel } from '../../src/analytics/parsers/dimensionsParser';
import { saveDimensions, getDimensions, deleteDimensions } from '../../services/firestoreService';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface DimensionsUploadProps {
  selectedProject: Project;
  onDimensionsSaved?: () => void;
}

// ---------------------------------------------------------------------------
// Helpers de UI
// ---------------------------------------------------------------------------

const GROUP_LABELS: Record<DimensionGroup, string> = {
  MOD:      'Mão-de-Obra Direta',
  MOI:      'Mão-de-Obra Indireta',
  EQUIP:    'Equipamentos',
  MATERIAL: 'Materiais',
  OTHER:    'Outros / Não identificado',
};

const GROUP_COLORS: Record<DimensionGroup, string> = {
  MOD:      '#4ade80',
  MOI:      '#60a5fa',
  EQUIP:    '#f59e0b',
  MATERIAL: '#a78bfa',
  OTHER:    '#94a3b8',
};

function Badge({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 999, fontSize: 12, fontWeight: 600,
      background: color + '22', color: color, border: `1px solid ${color}44`,
    }}>
      {children}
    </span>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 12, overflow: 'hidden', marginBottom: 16,
    }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '12px 16px', background: 'transparent', border: 'none', cursor: 'pointer',
          color: '#e2e8f0', fontSize: 14, fontWeight: 600,
        }}
      >
        {title}
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      {open && <div style={{ padding: '0 16px 16px' }}>{children}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

export function DimensionsUpload({ selectedProject, onDimensionsSaved }: DimensionsUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<DimensionImportResult | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [saveMessage, setSaveMessage] = useState('');

  // ── Processamento de arquivo ──────────────────────────────────────────────

  const processFile = useCallback(async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['xlsx', 'xls'].includes(ext ?? '')) {
      setSaveMessage('Apenas arquivos .xlsx e .xls são aceitos.');
      setSaveStatus('error');
      return;
    }

    setIsProcessing(true);
    setResult(null);
    setSaveStatus('idle');
    setSaveMessage('');

    try {
      const parsed = await parseDimensionsExcel(file, selectedProject.id);
      setResult(parsed);
    } catch (err) {
      setSaveStatus('error');
      setSaveMessage(`Erro ao processar arquivo: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsProcessing(false);
    }
  }, [selectedProject.id]);

  // ── Drag & Drop ───────────────────────────────────────────────────────────

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = '';
  };

  // ── Salvar ────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!result) return;
    setIsSaving(true);
    setSaveStatus('idle');
    try {
      await saveDimensions(selectedProject.id, result);
      setSaveStatus('success');
      setSaveMessage('Dimensões salvas com sucesso!');
      onDimensionsSaved?.();
    } catch (err) {
      setSaveStatus('error');
      setSaveMessage(`Erro ao salvar: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsSaving(false);
    }
  };

  // ── Carregar dados existentes ─────────────────────────────────────────────

  const handleLoad = async () => {
    setIsLoading(true);
    setSaveStatus('idle');
    try {
      const stored = await getDimensions(selectedProject.id);
      if (stored) {
        // Reconstrói um DimensionImportResult mínimo a partir do stored record
        setResult({
          items:         stored.items,
          holidays:      stored.holidays,
          metadata:      stored.metadata,
          months:        Array.from(
            new Map(
              stored.items.flatMap(i => i.monthlyPlan.map(mp => [mp.monthKey, mp.monthLabel]))
            ).entries()
          )
            .sort(([a], [b]) => String(a).localeCompare(String(b)))
            .map(([monthKey, monthLabel]) => ({ monthKey, monthLabel })),
          totalRows:     stored.items.length,
          successCount:  stored.items.length,
          errorCount:    0,
          errors:        [],
          warnings:      [],
          importedAt:    stored.updatedAt,
        });
        setSaveMessage(`Dimensões carregadas (salvas em ${new Date(stored.updatedAt).toLocaleString('pt-BR')}).`);
        setSaveStatus('success');
      } else {
        setSaveMessage('Nenhuma dimensão salva para este projeto.');
        setSaveStatus('error');
      }
    } catch (err) {
      setSaveStatus('error');
      setSaveMessage(`Erro ao carregar: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsLoading(false);
    }
  };

  // ── Excluir ───────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!confirm('Excluir as dimensões salvas para este projeto?')) return;
    try {
      await deleteDimensions(selectedProject.id);
      setResult(null);
      setSaveStatus('success');
      setSaveMessage('Dimensões excluídas com sucesso.');
    } catch (err) {
      setSaveStatus('error');
      setSaveMessage(`Erro ao excluir: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // ── Agrupamento de itens ──────────────────────────────────────────────────

  const itemsByGroup = result
    ? result.items.reduce<Partial<Record<DimensionGroup, number>>>((acc, item) => {
        acc[item.group] = (acc[item.group] ?? 0) + 1;
        return acc;
      }, {})
    : null;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", color: '#e2e8f0', maxWidth: 860, margin: '0 auto' }}>

      {/* Cabeçalho */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: '#f1f5f9', margin: 0 }}>
          Importar Dimensões
        </h2>
        <p style={{ color: '#94a3b8', marginTop: 4, fontSize: 14 }}>
          Projeto: <strong style={{ color: '#60a5fa' }}>{selectedProject.name}</strong>
        </p>
      </div>

      {/* Ações de gerenciamento */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        <button
          onClick={handleLoad}
          disabled={isLoading}
          id="btn-load-dimensions"
          style={btnStyle('#334155')}
        >
          <RefreshCw size={15} /> {isLoading ? 'Carregando...' : 'Carregar dados salvos'}
        </button>
        <button
          onClick={handleDelete}
          id="btn-delete-dimensions"
          style={btnStyle('#7f1d1d')}
        >
          <Trash2 size={15} /> Excluir dimensões
        </button>
      </div>

      {/* Zona de upload */}
      <div
        id="dimensions-dropzone"
        onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        style={{
          border: `2px dashed ${isDragging ? '#60a5fa' : '#334155'}`,
          borderRadius: 16, padding: '36px 24px', textAlign: 'center',
          cursor: 'pointer', marginBottom: 24, transition: 'all 0.2s',
          background: isDragging ? 'rgba(96,165,250,0.06)' : 'rgba(255,255,255,0.02)',
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          style={{ display: 'none' }}
          onChange={handleFileChange}
          id="input-dimensions-file"
        />
        <Upload size={40} color={isDragging ? '#60a5fa' : '#475569'} style={{ marginBottom: 12 }} />
        <p style={{ color: '#94a3b8', margin: 0, fontSize: 15 }}>
          {isProcessing
            ? '⏳ Processando planilha...'
            : 'Arraste a planilha de dimensões aqui ou clique para selecionar'}
        </p>
        <p style={{ color: '#475569', margin: '6px 0 0', fontSize: 12 }}>
          Formatos aceitos: .xlsx · .xls
        </p>
      </div>

      {/* Mensagem de status */}
      {saveStatus !== 'idle' && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px',
          borderRadius: 8, marginBottom: 16, fontSize: 14,
          background: saveStatus === 'success' ? '#052e16' : '#450a0a',
          border: `1px solid ${saveStatus === 'success' ? '#166534' : '#7f1d1d'}`,
          color: saveStatus === 'success' ? '#4ade80' : '#f87171',
        }}>
          {saveStatus === 'success' ? <CheckCircle size={16} /> : <XCircle size={16} />}
          {saveMessage}
        </div>
      )}

      {/* Resultado da importação */}
      {result && (
        <>
          {/* KPIs rápidos */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'Itens importados', value: result.successCount, color: '#4ade80' },
              { label: 'Meses detectados', value: result.months.length, color: '#60a5fa' },
              { label: 'Feriados',         value: result.holidays.length, color: '#f59e0b' },
              { label: 'Erros',            value: result.errors.length,   color: '#f87171' },
              { label: 'Avisos',           value: result.warnings.length, color: '#fb923c' },
            ].map(k => (
              <div key={k.label} style={{
                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 12, padding: '12px 16px', textAlign: 'center',
              }}>
                <div style={{ fontSize: 26, fontWeight: 700, color: k.color }}>{k.value}</div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{k.label}</div>
              </div>
            ))}
          </div>

          {/* Resumo por grupo */}
          {itemsByGroup && Object.keys(itemsByGroup).length > 0 && (
            <SectionCard title="📊 Itens por Grupo">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {(Object.entries(itemsByGroup) as [DimensionGroup, number][]).map(([group, count]) => (
                  <Badge key={group} color={GROUP_COLORS[group]}>
                    {GROUP_LABELS[group]}: {count}
                  </Badge>
                ))}
              </div>
            </SectionCard>
          )}

          {/* Meses detectados */}
          {result.months.length > 0 && (
            <SectionCard title="📅 Meses Detectados no Plano">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {result.months.map(m => (
                  <div key={m.monthKey} style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '4px 12px', borderRadius: 999, fontSize: 13,
                    background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.25)',
                    color: '#93c5fd',
                  }}>
                    <Calendar size={13} />
                    {m.monthLabel}
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          {/* Feriados */}
          {result.holidays.length > 0 && (
            <SectionCard title={`🗓️ Feriados Detectados (${result.holidays.length})`}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {result.holidays.map(h => (
                  <Badge key={h} color="#f59e0b">{h}</Badge>
                ))}
              </div>
            </SectionCard>
          )}

          {/* Metadados */}
          {Object.keys(result.metadata).length > 0 && (
            <SectionCard title="🏗️ Metadados da Obra">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
                {result.metadata.nomeObra && (
                  <MetaField label="Obra" value={result.metadata.nomeObra} />
                )}
                {result.metadata.contrato && (
                  <MetaField label="Contrato" value={result.metadata.contrato} />
                )}
                {result.metadata.cliente && (
                  <MetaField label="Cliente" value={result.metadata.cliente} />
                )}
                {result.metadata.centroCusto && (
                  <MetaField label="Centro de Custo" value={result.metadata.centroCusto} />
                )}
                {result.metadata.valorContratual !== undefined && (
                  <MetaField
                    label="Valor Contratual"
                    value={result.metadata.valorContratual.toLocaleString('pt-BR', {
                      style: 'currency', currency: 'BRL',
                    })}
                  />
                )}
                {result.metadata.iStart && (
                  <MetaField label="Início (i_start)" value={result.metadata.iStart} />
                )}
                {result.metadata.iEnd && (
                  <MetaField label="Fim (i_end)" value={result.metadata.iEnd} />
                )}
              </div>
            </SectionCard>
          )}

          {/* Erros */}
          {result.errors.length > 0 && (
            <SectionCard title={`❌ Erros (${result.errors.length})`}>
              <ul style={{ margin: 0, padding: '0 0 0 20px', color: '#f87171', fontSize: 13 }}>
                {result.errors.map((e, i) => <li key={i} style={{ marginBottom: 4 }}>{e}</li>)}
              </ul>
            </SectionCard>
          )}

          {/* Warnings */}
          {result.warnings.length > 0 && (
            <SectionCard title={`⚠️ Avisos (${result.warnings.length})`}>
              <ul style={{ margin: 0, padding: '0 0 0 20px', color: '#fb923c', fontSize: 13 }}>
                {result.warnings.map((w, i) => <li key={i} style={{ marginBottom: 4 }}>{w}</li>)}
              </ul>
            </SectionCard>
          )}

          {/* Pré-visualização dos primeiros itens */}
          {result.items.length > 0 && (
            <SectionCard title={`📋 Pré-visualização (${Math.min(10, result.items.length)} de ${result.items.length} itens)`}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                      {['Item', 'Grupo', 'Item RDO', 'Custo Mensal', 'Meses'].map(h => (
                        <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: '#64748b', fontWeight: 600, whiteSpace: 'nowrap' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.items.slice(0, 10).map((item, i) => (
                      <tr key={i} style={{
                        borderBottom: '1px solid rgba(255,255,255,0.05)',
                        background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)',
                      }}>
                        <td style={{ padding: '8px 12px', color: '#e2e8f0' }}>
                          {item.name}
                          {item.hasMissingCost && <AlertTriangle size={12} color="#f59e0b" style={{ marginLeft: 4, verticalAlign: 'middle' }} />}
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          <Badge color={GROUP_COLORS[item.group]}>{item.group}</Badge>
                        </td>
                        <td style={{ padding: '8px 12px', color: '#94a3b8' }}>
                          {item.rdoEquivalent ?? '—'}
                        </td>
                        <td style={{ padding: '8px 12px', color: item.hasMissingCost ? '#f59e0b' : '#4ade80', fontVariantNumeric: 'tabular-nums' }}>
                          {item.hasMissingCost
                            ? 'Sem custo'
                            : item.monthlyUnitCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                          }
                        </td>
                        <td style={{ padding: '8px 12px', color: '#94a3b8' }}>
                          {item.monthlyPlan.length}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          )}

          {/* Botão Salvar */}
          {result.items.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
              <button
                id="btn-save-dimensions"
                onClick={handleSave}
                disabled={isSaving}
                style={{
                  ...btnStyle('#1d4ed8'),
                  padding: '10px 24px',
                  fontSize: 15,
                  fontWeight: 700,
                }}
              >
                <Save size={16} />
                {isSaving ? 'Salvando...' : `Salvar ${result.items.length} itens`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-componentes auxiliares
// ---------------------------------------------------------------------------

function MetaField({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)', borderRadius: 8,
      padding: '8px 12px', border: '1px solid rgba(255,255,255,0.06)',
    }}>
      <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>
        {label}
      </div>
      <div style={{ fontSize: 14, color: '#e2e8f0', fontWeight: 500 }}>{value}</div>
    </div>
  );
}

function btnStyle(bg: string): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '8px 16px', borderRadius: 8, border: 'none',
    background: bg, color: '#f1f5f9', cursor: 'pointer',
    fontSize: 13, fontWeight: 600, transition: 'opacity 0.15s',
  };
}

export default DimensionsUpload;
