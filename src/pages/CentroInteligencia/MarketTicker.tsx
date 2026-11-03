import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { IndicatorResult, formatChange, formatIndicatorValue } from '../../modules/market/marketIndicators';
import { loadMarketIndicators } from '../../modules/market/loadMarketIndicators';
import { toLocalIsoDate } from '../../../utils/dateUtils';

const TickerItem: React.FC<{ result: IndicatorResult }> = ({ result }) => {
    const { meta, latest, change } = result;
    const Icon = !change || change.value === 0 ? Minus : change.value > 0 ? ArrowUpRight : ArrowDownRight;
    return (
        <span className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap px-6">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{meta.name}</span>
            <span className="text-sm font-bold tabular-nums text-slate-900">{formatIndicatorValue(latest.value, meta.format)}</span>
            {change && (
                <span className="inline-flex items-center text-[11px] font-semibold tabular-nums text-blue-700">
                    <Icon className="h-3 w-3" aria-hidden="true" />
                    {formatChange(change.value, meta.format === 'currency' ? '%' : 'pp')}
                </span>
            )}
            <span className="ml-4 h-3 w-px bg-slate-200" aria-hidden="true" />
        </span>
    );
};

/**
 * Faixa rolante com os indicadores de mercado (mesmos dados e cache da página /indicadores).
 * Pausa no hover; parada para quem prefere menos movimento. Some se nenhuma fonte responder.
 */
export const MarketTicker: React.FC = () => {
    const navigate = useNavigate();
    const [results, setResults] = useState<IndicatorResult[] | null>(null);

    useEffect(() => {
        let active = true;
        loadMarketIndicators(toLocalIsoDate(new Date()))
            .then(snapshot => {
                if (active) setResults(snapshot.entries.map(e => e.result).filter((r): r is IndicatorResult => !!r));
            })
            .catch(() => active && setResults([]));
        return () => { active = false; };
    }, []);

    if (results && results.length === 0) return null;

    return (
        <button
            type="button"
            onClick={() => navigate('/indicadores')}
            className="market-ticker group relative flex h-10 w-full shrink-0 items-center overflow-hidden border-b border-slate-200 bg-white text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500/40"
            aria-label="Abrir Indicadores de Mercado"
        >
            {results === null ? (
                <span className="px-6 text-xs text-slate-400">Carregando indicadores de mercado...</span>
            ) : (
                // shrink-0: o botão é flex e, sem isso, comprime a faixa e as cópias se sobrepõem.
                <span className="market-ticker-track flex w-max shrink-0">
                    {[0, 1].map(copy => (
                        // Duas cópias seguidas: a animação desloca 50% e emenda sem salto.
                        <span key={copy} className="flex shrink-0" aria-hidden={copy === 1}>
                            {results.map(result => <TickerItem key={`${copy}-${result.meta.id}`} result={result} />)}
                        </span>
                    ))}
                </span>
            )}
            <span className="pointer-events-none absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-white to-transparent" aria-hidden="true" />
            <span className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-white to-transparent" aria-hidden="true" />
        </button>
    );
};
