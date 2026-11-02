import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, Loader2, RefreshCw } from 'lucide-react';
import { PortalTopBar } from '../CentroInteligencia/PortalTopBar';
import { MarketSnapshot, loadMarketIndicators } from '../../modules/market/loadMarketIndicators';
import { toLocalIsoDate } from '../../../utils/dateUtils';
import { IndicatorCard } from './IndicatorCard';
import { FocusCard } from './FocusCard';

/** Indicadores das próximas fases (fonte em planilha ou atualização manual). */
const NEXT_PHASES: Array<{ name: string; source: string }> = [
    { name: 'Diesel', source: 'ANP' },
    { name: 'Preço do aço', source: 'manual' },
    { name: 'Emprego na construção', source: 'Novo Caged' },
    { name: 'Confiança da Construção (ICST)', source: 'FGV Ibre' },
    { name: 'Sondagem da Indústria da Construção', source: 'CNI / CBIC' },
    { name: 'Produção ferroviária (TU e TKU)', source: 'ANTT' },
    { name: 'Investimento em infraestrutura ferroviária', source: 'manual' },
    { name: 'Leilões e concessões ferroviárias', source: 'manual' }
];

export const MarketIndicatorsView: React.FC = () => {
    const navigate = useNavigate();
    const [snapshot, setSnapshot] = useState<MarketSnapshot | null>(null);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async (force: boolean) => {
        setLoading(true);
        try {
            setSnapshot(await loadMarketIndicators(toLocalIsoDate(new Date()), { force }));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void load(false); }, [load]);

    const entry = (id: string) => snapshot?.entries.find(e => e.meta.id === id);
    // Ordem pensada para caber em duas linhas no desktop: custos e atividade + Focus; depois macro.
    const firstRow = ['incc-m', 'incc-di', 'pib-construcao'];
    const secondRow = ['selic', 'ipca', 'igp-m', 'dolar'];

    return (
        <div className="flex min-h-screen flex-col bg-[#f3f5f9]">
            <PortalTopBar />

            <main className="flex-1 p-5 lg:p-6">
                <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
                    <div>
                        <button
                            type="button"
                            onClick={() => navigate('/')}
                            className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800"
                        >
                            <ArrowLeft className="h-3.5 w-3.5" /> Início
                        </button>
                        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Indicadores de Mercado</h1>
                        <p className="mt-1 text-sm text-slate-500">Custos, juros, inflação, câmbio e atividade da construção, direto das fontes oficiais.</p>
                    </div>
                    <div className="flex items-center gap-3">
                        {snapshot && (
                            <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                                <Clock className="h-3.5 w-3.5" />
                                Atualizado em {new Date(snapshot.fetchedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                            </span>
                        )}
                        <button
                            type="button"
                            onClick={() => load(true)}
                            disabled={loading}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 disabled:opacity-60"
                        >
                            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                            Atualizar
                        </button>
                    </div>
                </div>

                {!snapshot ? (
                    <div className="flex h-64 items-center justify-center gap-2 text-sm text-slate-500">
                        <Loader2 className="h-4 w-4 animate-spin" /> Consultando Banco Central e IBGE...
                    </div>
                ) : (
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        {firstRow.map(id => {
                            const e = entry(id);
                            return e ? <IndicatorCard key={id} entry={e} /> : null;
                        })}
                        <FocusCard rows={snapshot.focus} error={snapshot.focusError} />
                        {secondRow.map(id => {
                            const e = entry(id);
                            return e ? <IndicatorCard key={id} entry={e} /> : null;
                        })}
                    </div>
                )}

                <section className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-white/60 p-5" aria-labelledby="proximas-fases">
                    <h2 id="proximas-fases" className="text-sm font-semibold text-slate-800">Em implantação</h2>
                    <p className="mt-0.5 text-xs text-slate-500">Próximos indicadores, que dependem de planilhas públicas ou de atualização manual.</p>
                    <ul className="mt-3 flex flex-wrap gap-2">
                        {NEXT_PHASES.map(item => (
                            <li key={item.name} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600">
                                {item.name} <span className="text-slate-400">· {item.source}</span>
                            </li>
                        ))}
                    </ul>
                </section>
            </main>
        </div>
    );
};
