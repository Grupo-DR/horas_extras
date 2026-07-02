import React, { useState, useRef, useCallback } from 'react';
import { Upload, CheckCircle, AlertTriangle, XCircle, FileText, Save, Trash2, RefreshCw, ChevronDown, ChevronUp, Bot, Loader2 } from 'lucide-react';
import { Project } from '../../types';
import { CompositionAIExtractionResult, CompositionItem, CompositionType } from '../../src/analytics/types/analyticsTypes';
import { extractCompositionsFromPDF } from '../../src/services/compositionAIService';
import { saveCompositions, getCompositions, deleteCompositions } from '../../services/firestoreService';

interface CompositionsUploadProps {
  selectedProject: Project;
  onCompositionsSaved?: () => void;
}

const TYPE_COLORS: Record<CompositionType, string> = {
  SERVICO_PRODUTIVO: '#4ade80',
  MOBILIZACAO: '#60a5fa',
  ADMINISTRACAO_LOCAL: '#facc15',
  DESMOBILIZACAO: '#f97316',
  IMPRODUTIVIDADE_MO: '#ef4444',
  IMPRODUTIVIDADE_EQUIPAMENTO: '#b91c1c',
  TRANSPORTE: '#c084fc',
  OUTRO: '#94a3b8'
};

function Badge({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700,
      background: color + '22', color: color, border: `1px solid ${color}44`, whiteSpace: 'nowrap'
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

export function CompositionsUpload({ selectedProject, onCompositionsSaved }: CompositionsUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<CompositionAIExtractionResult | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [saveMessage, setSaveMessage] = useState('');

  // ── Processamento de arquivo (IA) ────────────────────────────────────────

  const processFile = useCallback(async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'pdf') {
      setSaveMessage('Apenas arquivos .pdf são aceitos para extração por IA.');
      setSaveStatus('error');
      return;
    }

    setIsProcessing(true);
    setResult(null);
    setSaveStatus('idle');
    setSaveMessage('');

    try {
      const extracted = await extractCompositionsFromPDF(file, selectedProject.id);
      setResult(extracted);
    } catch (err: any) {
      setSaveStatus('error');
      setSaveMessage(err.message || 'Erro desconhecido ao processar PDF.');
    } finally {
      setIsProcessing(false);
    }
  }, [selectedProject.id]);

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
      await saveCompositions(selectedProject.id, result);
      setSaveStatus('success');
      setSaveMessage('Composições salvas com sucesso!');
      onCompositionsSaved?.();
    } catch (err: any) {
      setSaveStatus('error');
      setSaveMessage(`Erro ao salvar: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // ── Carregar ─────────────────────────────────────────────────────────────

  const handleLoad = async () => {
    setIsLoading(true);
    setSaveStatus('idle');
    try {
      const stored = await getCompositions(selectedProject.id);
      if (stored) {
        setResult(stored);
        setSaveMessage(`Composições carregadas (salvas em ${new Date(stored.extractedAt).toLocaleString('pt-BR')}).`);
        setSaveStatus('success');
      } else {
        setSaveMessage('Nenhuma composição salva para este projeto.');
        setSaveStatus('error');
      }
    } catch (err: any) {
      setSaveStatus('error');
      setSaveMessage(`Erro ao carregar: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Excluir as composições salvas para este projeto?')) return;
    try {
      await deleteCompositions(selectedProject.id);
      setResult(null);
      setSaveStatus('success');
      setSaveMessage('Composições excluídas com sucesso.');
      onCompositionsSaved?.(); // Atualizar estado pai
    } catch (err: any) {
      setSaveStatus('error');
      setSaveMessage(`Erro ao excluir: ${err.message}`);
    }
  };

  // ── KPIs Computados ──────────────────────────────────────────────────────

  const kpis = result ? {
    total: result.compositions.length,
    produtivas: result.compositions.filter(c => c.tipoComposicao === 'SERVICO_PRODUTIVO').length,
    improdutivas: result.compositions.filter(c => c.tipoComposicao === 'IMPRODUTIVIDADE_MO' || c.tipoComposicao === 'IMPRODUTIVIDADE_EQUIPAMENTO').length,
    blackout: result.compositions.filter(c => c.hasBlackoutInOriginal).length,
    semPreco: result.compositions.filter(c => c.precoUnitarioTotal === undefined || c.precoUnitarioTotal === null).length,
    semProducao: result.compositions.filter(c => c.tipoComposicao === 'SERVICO_PRODUTIVO' && !c.producaoEquipe).length
  } : null;

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", color: '#e2e8f0', maxWidth: 1000, margin: '0 auto' }}>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        <button onClick={handleLoad} disabled={isLoading} style={btnStyle('#334155')}>
          <RefreshCw size={15} /> {isLoading ? 'Carregando...' : 'Carregar DB'}
        </button>
        <button onClick={handleDelete} style={btnStyle('#7f1d1d')}>
          <Trash2 size={15} /> Excluir do DB
        </button>
      </div>

      <div
        onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => !isProcessing && fileInputRef.current?.click()}
        style={{
          border: `2px dashed ${isDragging ? '#8b5cf6' : '#334155'}`,
          borderRadius: 16, padding: '36px 24px', textAlign: 'center',
          cursor: isProcessing ? 'default' : 'pointer', marginBottom: 24, transition: 'all 0.2s',
          background: isDragging ? 'rgba(139,92,246,0.06)' : 'rgba(255,255,255,0.02)',
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
        {isProcessing ? (
          <Bot size={40} color="#8b5cf6" className="animate-pulse" style={{ margin: '0 auto 12px' }} />
        ) : (
          <FileText size={40} color={isDragging ? '#8b5cf6' : '#475569'} style={{ margin: '0 auto 12px' }} />
        )}
        <p style={{ color: '#94a3b8', margin: 0, fontSize: 15, fontWeight: isProcessing ? 600 : 400 }}>
          {isProcessing
            ? <><Loader2 size={16} className="inline animate-spin mr-2" /> IA extraindo dados do PDF... (pode levar 30-60s)</>
            : 'Arraste o PDF de Composições aqui ou clique para extrair via IA'}
        </p>
      </div>

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

      {result && kpis && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, marginBottom: 20 }}>
            <KpiBox label="Composições Extraídas" value={kpis.total} color="#8b5cf6" />
            <KpiBox label="Serviços Produtivos" value={kpis.produtivas} color="#4ade80" />
            <KpiBox label="Improdutividades" value={kpis.improdutivas} color="#f87171" />
            <KpiBox label="Tags BLACKOUT" value={kpis.blackout} color="#facc15" />
            <KpiBox label="Sem Preço" value={kpis.semPreco} color="#fb923c" />
            <KpiBox label="Sem Prod. Equipe" value={kpis.semProducao} color="#94a3b8" />
          </div>

          {(result.errors.length > 0 || result.warnings.length > 0) && (
            <SectionCard title={`⚠️ Ocorrências Analíticas (${result.errors.length + result.warnings.length})`}>
              {result.errors.map((e, i) => <div key={'e'+i} className="text-red-400 text-sm mb-1">• {e}</div>)}
              {result.warnings.map((w, i) => <div key={'w'+i} className="text-amber-400 text-sm mb-1">• {w}</div>)}
            </SectionCard>
          )}

          <SectionCard title={`📋 Validação de Composições (${result.compositions.length})`}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#64748b' }}>
                    <th style={{ padding: '8px', textAlign: 'left' }}>Código</th>
                    <th style={{ padding: '8px', textAlign: 'left' }}>Serviço Tratado</th>
                    <th style={{ padding: '8px', textAlign: 'left' }}>Unid</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Prod. Eqp</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Custo Unit</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Preço Unit</th>
                    <th style={{ padding: '8px', textAlign: 'center' }}>Tipo (IA)</th>
                    <th style={{ padding: '8px', textAlign: 'center' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {result.compositions.map((comp) => (
                    <tr key={comp.id} style={{
                      borderBottom: '1px solid rgba(255,255,255,0.05)',
                      background: comp.isPreferredForCalculation ? 'transparent' : 'rgba(255,0,0,0.05)',
                      opacity: comp.isPreferredForCalculation ? 1 : 0.6
                    }}>
                      <td style={{ padding: '8px', fontWeight: 600 }}>{comp.codigoComposicao}</td>
                      <td style={{ padding: '8px', maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={comp.servicoTratado}>
                        {comp.servicoTratado}
                        {comp.hasBlackoutInOriginal && <span className="text-[9px] ml-2 text-amber-500 font-bold bg-amber-500/10 px-1 rounded">BLACKOUT</span>}
                      </td>
                      <td style={{ padding: '8px' }}>{comp.unidade}</td>
                      <td style={{ padding: '8px', textAlign: 'right' }}>{comp.producaoEquipe || '-'}</td>
                      <td style={{ padding: '8px', textAlign: 'right', color: '#94a3b8' }}>
                        {comp.custoUnitarioTotal ? comp.custoUnitarioTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-'}
                      </td>
                      <td style={{ padding: '8px', textAlign: 'right', fontWeight: 600, color: '#4ade80' }}>
                        {comp.precoUnitarioTotal ? comp.precoUnitarioTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'ERRO'}
                      </td>
                      <td style={{ padding: '8px', textAlign: 'center' }}>
                        <Badge color={TYPE_COLORS[comp.tipoComposicao] || '#94a3b8'}>{comp.tipoComposicao}</Badge>
                      </td>
                      <td style={{ padding: '8px', textAlign: 'center' }}>
                        {comp.isPreferredForCalculation ? (
                          <CheckCircle size={14} color="#4ade80" />
                        ) : (
                          <span title="Ignorada na medição por duplicidade"><AlertTriangle size={14} color="#f87171" /></span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
            <button
              onClick={handleSave}
              disabled={isSaving}
              style={{ ...btnStyle('#8b5cf6'), padding: '10px 24px', fontSize: 15, fontWeight: 700 }}
            >
              <Save size={16} />
              {isSaving ? 'Salvando...' : `Aprovar e Salvar no DB`}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function KpiBox({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '12px 16px', textAlign: 'center' }}>
      <div style={{ fontSize: 24, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 11, color: '#64748b', marginTop: 2, fontWeight: 600 }}>{label}</div>
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
