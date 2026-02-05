import React, { useState } from 'react';
import { OvertimeRecord } from '../types';
import { analyzeOvertimeData } from '../services/gemini';
import { Sparkles, RefreshCw, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface GeminiPanelProps {
  data: OvertimeRecord[];
  onClose?: () => void;
}

const GeminiPanel: React.FC<GeminiPanelProps> = ({ data, onClose }) => {
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleAnalyze = async () => {
    setLoading(true);
    const result = await analyzeOvertimeData(data);
    setAnalysis(result);
    setLoading(false);
  };

  return (
    <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl shadow-lg border border-indigo-100 overflow-hidden flex flex-col h-full">
      <div className="p-5 border-b border-indigo-100 bg-white/50 backdrop-blur-sm flex justify-between items-center">
        <div className="flex items-center space-x-2">
            <Sparkles className="text-indigo-600" size={20} />
            <h3 className="font-bold text-indigo-900">Insights IA Gemini</h3>
        </div>
        {onClose && (
            <button onClick={onClose} className="p-1 hover:bg-indigo-100 rounded-full text-indigo-400">
                <X size={20} />
            </button>
        )}
      </div>
      
      <div className="flex-1 p-6 overflow-y-auto">
        {!analysis && !loading && (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
                <p className="text-indigo-800 max-w-sm">
                    Clique no botão abaixo para o Gemini analisar seus dados de horas extras em busca de anomalias de custo e padrões de eficiência.
                </p>
                <button 
                    onClick={handleAnalyze}
                    className="flex items-center space-x-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-3 rounded-full shadow-md hover:shadow-lg transition-all hover:scale-105 font-medium"
                >
                    <Sparkles size={18} />
                    <span>Gerar Relatório com IA</span>
                </button>
            </div>
        )}

        {loading && (
            <div className="flex flex-col items-center justify-center h-full space-y-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                <p className="text-indigo-600 animate-pulse">Analisando padrões da força de trabalho...</p>
            </div>
        )}

        {analysis && !loading && (
            <div className="prose prose-sm prose-indigo max-w-none text-gray-700">
                <ReactMarkdown>{analysis}</ReactMarkdown>
                <div className="mt-8 flex justify-center">
                    <button 
                        onClick={handleAnalyze}
                        className="flex items-center space-x-2 text-indigo-600 hover:bg-indigo-50 px-4 py-2 rounded-lg transition-colors text-sm font-medium"
                    >
                        <RefreshCw size={16} />
                        <span>Gerar Nova Análise</span>
                    </button>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default GeminiPanel;