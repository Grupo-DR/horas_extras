
import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { OvertimeRecord } from '../types';
import { analyzeOvertimeData } from '../services/gemini';
import { Sparkles, BrainCircuit, RefreshCw, MessageSquare, X } from 'lucide-react';

interface GeminiPanelProps {
    data: OvertimeRecord[];
    isVisible: boolean;
    onClose: () => void;
}

const GeminiPanel: React.FC<GeminiPanelProps> = ({ data, isVisible, onClose }) => {
    const [analysis, setAnalysis] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    const handleAnalyze = async () => {
        setLoading(true);
        setAnalysis('');
        try {
            const result = await analyzeOvertimeData(data);
            setAnalysis(result);
            setLastUpdated(new Date());
        } catch (error) {
            setAnalysis("Erro ao gerar análise. Tente novamente.");
        } finally {
            setLoading(false);
        }
    };

    if (!isVisible) return null;

    return (
        <div className="bg-gradient-to-br from-indigo-900 to-purple-900 rounded-2xl shadow-xl overflow-hidden text-white border border-indigo-700/50 h-full flex flex-col">
            <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5 backdrop-blur-sm shrink-0">
                <div className="flex items-center gap-3">
                    <div className="bg-white/20 p-2 rounded-lg">
                        <BrainCircuit size={20} className="text-purple-200" />
                    </div>
                    <div>
                        <h3 className="font-bold text-lg tracking-tight">Análise IA <span className="text-purple-300 font-normal">Gemini 3.0 Flash</span></h3>
                        <p className="text-xs text-purple-200/70">Insights automatizados sobre horas extras.</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={handleAnalyze}
                        disabled={loading}
                        className="px-3 py-1.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg text-xs font-bold transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed group"
                    >
                        <RefreshCw size={14} className={`transition-transform ${loading ? 'animate-spin' : 'group-hover:rotate-180'}`} />
                        {loading ? 'Analisando...' : 'Gerar'}
                    </button>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/10 rounded-lg text-white/70 hover:text-white transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>
            </div>

            <div className="p-8 min-h-[200px] flex-1 overflow-y-auto scroll-smooth">
                {loading ? (
                    <div className="flex flex-col items-center justify-center h-full py-12 gap-4 animate-pulse">
                        <Sparkles size={48} className="text-purple-400 animate-bounce" />
                        <p className="text-purple-200 font-medium">Processando dados e gerando insights...</p>
                    </div>
                ) : analysis ? (
                    <div className="prose prose-invert prose-sm max-w-none">
                        <div className="flex items-center justify-between mb-4">
                            <div className="text-[10px] uppercase font-bold text-purple-300/60 bg-purple-900/50 px-3 py-1 rounded-full border border-purple-500/20">
                                Gerado em: {lastUpdated?.toLocaleTimeString()}
                            </div>
                        </div>
                        <ReactMarkdown>{analysis}</ReactMarkdown>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full py-12 gap-4 text-center opacity-80">
                        <div className="bg-white/10 p-4 rounded-full">
                            <MessageSquare size={32} className="text-purple-300" />
                        </div>
                        <div>
                            <p className="text-lg font-bold text-white">Pronto para analisar</p>
                            <p className="text-sm text-purple-200 max-w-md mt-1">
                                A IA irá processar os {data.length} registros listados para encontrar padrões, anomalias e oportunidades de economia.
                            </p>
                        </div>
                        <button onClick={handleAnalyze} className="mt-4 text-purple-300 hover:text-white underline text-sm">
                            Iniciar análise agora
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default GeminiPanel;
