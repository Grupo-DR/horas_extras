import React from 'react';
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { INDICATOR_GROUP_LABELS, formatChange, formatIndicatorValue } from '../../modules/market/marketIndicators';
import { IndicatorEntry } from '../../modules/market/loadMarketIndicators';
import { Sparkline } from './Sparkline';

const ChangeChip: React.FC<{ value: number; label: string; unit: 'pp' | '%' }> = ({ value, label, unit }) => {
    const Icon = value > 0 ? ArrowUpRight : value < 0 ? ArrowDownRight : Minus;
    return (
        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
            <Icon className="h-3 w-3" aria-hidden="true" />
            {formatChange(value, unit)}
            <span className="font-normal text-slate-500">{label}</span>
        </span>
    );
};

/** Card de um indicador: valor, variação, minigráfico e fonte. */
export const IndicatorCard: React.FC<{ entry: IndicatorEntry }> = ({ entry }) => {
    const { meta, result, staleSince, error } = entry;

    return (
        <article className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-blue-600">{INDICATOR_GROUP_LABELS[meta.group]}</p>
                    <h3 className="mt-0.5 font-semibold text-slate-900">{meta.name}</h3>
                </div>
                <span className="shrink-0 rounded-md border border-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">{meta.frequency}</span>
            </div>

            {result ? (
                <>
                    <p className="mt-3 text-3xl font-bold tabular-nums tracking-tight text-slate-900">
                        {formatIndicatorValue(result.latest.value, meta.format)}
                    </p>
                    {result.detail && <p className="mt-0.5 text-xs text-slate-500">{result.detail}</p>}
                    {result.change && (
                        <div className="mt-2">
                            <ChangeChip value={result.change.value} label={result.change.label} unit={meta.format === 'currency' ? '%' : 'pp'} />
                        </div>
                    )}
                    <div className="mt-3">
                        <Sparkline points={result.history} />
                    </div>
                </>
            ) : (
                <div className="mt-4 flex flex-1 items-center gap-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
                    <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
                    Fonte indisponível no momento{error ? ` (${error})` : ''}. Tente atualizar em alguns minutos.
                </div>
            )}

            {staleSince && result && (
                <p className="mt-2 flex items-center gap-1 text-[11px] text-amber-700">
                    <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                    Fonte fora do ar; mostrando dado obtido em {new Date(staleSince).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}.
                </p>
            )}

            <p className="mt-auto pt-3 text-[11px] leading-relaxed text-slate-500">{meta.description}</p>
            <a href={meta.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-1 text-[11px] font-semibold text-blue-700 hover:underline">
                Fonte: {meta.source}
            </a>
        </article>
    );
};
