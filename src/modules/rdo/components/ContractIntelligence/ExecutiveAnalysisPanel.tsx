import React, { useState } from 'react';
import { CompactSummary } from '../../src/analytics/types/analyticsTypes';
import { generateExecutiveAnalysis, generateClaimNarrative } from '../../src/services/analysisNarrativeService';
import { BrainCircuit, Loader2, AlertTriangle, FileText, Download, CheckCircle2 } from 'lucide-react';
// I will use a simple custom markdown renderer to avoid dependencies issues.

export interface ExecutiveAnalysisPanelProps {
  summary: CompactSummary;
}

export const ExecutiveAnalysisPanel: React.FC<ExecutiveAnalysisPanelProps> = ({ summary }) => {
  const [loadingType, setLoadingType] = useState<'NONE' | 'EXECUTIVE' | 'CLAIM'>('NONE');
  const [resultText, setResultText] = useState<string | null>(null);
  const [resultType, setResultType] = useState<'EXECUTIVE' | 'CLAIM' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerateExecutive = async () => {
    setLoadingType('EXECUTIVE');
    setError(null);
    setResultText(null);
    try {
      const text = await generateExecutiveAnalysis(summary);
      setResultText(text);
      setResultType('EXECUTIVE');
    } catch (err: any) {
      setError(err.message || 'Erro desconhecido');
    } finally {
      setLoadingType('NONE');
    }
  };

  const handleGenerateClaim = async () => {
    setLoadingType('CLAIM');
    setError(null);
    setResultText(null);
    try {
      const text = await generateClaimNarrative(summary);
      setResultText(text);
      setResultType('CLAIM');
    } catch (err: any) {
      setError(err.message || 'Erro desconhecido');
    } finally {
      setLoadingType('NONE');
    }
  };

  // Simple Markdown to HTML parser for basic formatting without external dependencies
  const renderMarkdownText = (text: string) => {
    return text.split('\n').map((line, i) => {
      // Headers
      if (line.startsWith('### ')) return <h4 key={i} className="text-lg font-bold text-white mt-4 mb-2">{line.replace('### ', '')}</h4>;
      if (line.startsWith('## ')) return <h3 key={i} className="text-xl font-bold text-white mt-6 mb-3">{line.replace('## ', '')}</h3>;
      if (line.startsWith('# ')) return <h2 key={i} className="text-2xl font-bold text-blue-400 mt-6 mb-4">{line.replace('# ', '')}</h2>;
      
      // List items
      if (line.trim().startsWith('- ')) return (
        <div key={i} className="flex gap-2 mb-1 ml-4 text-slate-300">
          <span className="text-blue-500">•</span>
          <span dangerouslySetInnerHTML={{ __html: formatBoldAndItalic(line.substring(2)) }} />
        </div>
      );
      
      // Empty lines
      if (line.trim() === '') return <div key={i} className="h-3" />;
      
      // Normal text
      return <p key={i} className="text-slate-300 mb-2 leading-relaxed" dangerouslySetInnerHTML={{ __html: formatBoldAndItalic(line) }} />;
    });
  };

  const formatBoldAndItalic = (text: string) => {
    let formatted = text.replace(/\*\*(.*?)\*\*/g, '<strong class="text-white">$1</strong>');
    formatted = formatted.replace(/\*(.*?)\*/g, '<em class="text-slate-400">$1</em>');
    return formatted;
  };

  const handleDownload = () => {
    if (!resultText) return;
    const blob = new Blob([resultText], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Relatorio_${resultType}_${summary.projectName.replace(/\s+/g, '_')}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      <div className="flex flex-col md:flex-row gap-6 justify-between items-start">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <div className="bg-purple-500/20 p-2.5 rounded-xl border border-purple-500/30">
              <BrainCircuit className="w-6 h-6 text-purple-400" />
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight">IA Analista Executiva</h2>
          </div>
          <p className="text-slate-400 text-sm max-w-2xl">
            Geração de narrativas textuais inteligentes baseadas exclusivamente nas métricas calculadas na inteligência contratual.
          </p>
        </div>
      </div>

      {/* Cards de Ação */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card Análise Executiva */}
        <div className="glass-panel p-6 rounded-3xl border border-white/5 flex flex-col justify-between hover:border-purple-500/30 transition-all group shadow-xl">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="bg-blue-500/10 p-3 rounded-2xl">
                <FileText className="w-6 h-6 text-blue-400" />
              </div>
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Análise Executiva</h3>
            <p className="text-sm text-slate-400 mb-6 leading-relaxed">
              Gera um texto gerencial objetivo com a visão geral do período, desempenho financeiro, margens contratuais e alertas identificados. Ideal para apresentar à diretoria.
            </p>
          </div>
          <button 
            onClick={handleGenerateExecutive}
            disabled={loadingType !== 'NONE' || summary.totalRdosProcessed === 0}
            className="w-full py-3.5 bg-gradient-premium rounded-xl font-bold text-sm text-white hover:scale-[1.02] active:scale-95 transition-all shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loadingType === 'EXECUTIVE' ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> Processando com IA...</>
            ) : (
              <><BrainCircuit className="w-5 h-5" /> Gerar Análise</>
            )}
          </button>
        </div>

        {/* Card Pleito */}
        <div className="glass-panel p-6 rounded-3xl border border-white/5 flex flex-col justify-between hover:border-amber-500/30 transition-all group shadow-xl">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="bg-amber-500/10 p-3 rounded-2xl">
                <AlertTriangle className="w-6 h-6 text-amber-400" />
              </div>
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Dossiê de Pleito</h3>
            <p className="text-sm text-slate-400 mb-6 leading-relaxed">
              Compila os dados de ocorrências, impactos e desvios produtivos em uma narrativa argumentativa preliminar para compor documentos de *claim* extrajudicial.
            </p>
          </div>
          <button 
            onClick={handleGenerateClaim}
            disabled={loadingType !== 'NONE' || summary.totalRdosProcessed === 0}
            className="w-full py-3.5 bg-slate-800 hover:bg-slate-700 border border-white/10 rounded-xl font-bold text-sm text-white hover:scale-[1.02] active:scale-95 transition-all shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loadingType === 'CLAIM' ? (
              <><Loader2 className="w-5 h-5 animate-spin text-amber-400" /> Processando...</>
            ) : (
              <><FileText className="w-5 h-5 text-amber-400" /> Gerar Dossiê de Pleito</>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm font-bold flex items-center gap-3 animate-shake">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          {error}
        </div>
      )}

      {/* Resultados Renderizados */}
      {resultText && (
        <div className="mt-8 animate-slide-up">
          <div className="glass-panel rounded-3xl border border-white/10 overflow-hidden shadow-2xl relative">
            
            {/* Cabecalho de Resultado */}
            <div className="bg-slate-900/80 px-6 py-4 border-b border-white/5 flex items-center justify-between sticky top-0 backdrop-blur-md z-10">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-white">
                  {resultType === 'EXECUTIVE' ? 'Relatório Executivo Gerado' : 'Dossiê de Pleito Gerado'}
                </h3>
              </div>
              <button 
                onClick={handleDownload}
                className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all text-slate-300 hover:text-white flex gap-2 items-center text-xs font-bold"
              >
                <Download className="w-4 h-4" /> Exportar Markdown
              </button>
            </div>

            {/* Corpo de Texto */}
            <div className="p-8 lg:px-12 prose prose-invert max-w-none text-slate-300">
              {renderMarkdownText(resultText)}
            </div>

            <div className="bg-purple-500/5 px-8 py-3 text-[10px] text-purple-400/60 uppercase tracking-widest font-bold border-t border-purple-500/10 text-center">
              Gerado por IA Generativa. Sempre revise os números com os relatórios das demais abas.
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
