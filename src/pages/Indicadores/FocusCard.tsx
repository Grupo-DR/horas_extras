import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { FocusExpectation, formatReference } from '../../modules/market/marketIndicators';
import { FOCUS_INDICATORS } from '../../modules/market/marketSources';

const LABELS: Record<(typeof FOCUS_INDICATORS)[number], string> = {
    Selic: 'Selic (fim do ano)',
    IPCA: 'IPCA',
    'Câmbio': 'Dólar (fim do ano)',
    'PIB Total': 'PIB'
};

const formatMedian = (indicator: string, value: number) =>
    indicator === 'Câmbio'
        ? `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : `${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;

/** Expectativas do mercado (mediana do Boletim Focus) para o ano atual e o seguinte. */
export const FocusCard: React.FC<{ rows: FocusExpectation[]; error?: string }> = ({ rows, error }) => {
    const years = Array.from(new Set(rows.map(r => r.year))).sort();
    const bulletin = rows.reduce((latest, r) => (r.date > latest ? r.date : latest), '');
    const median = (indicator: string, year: string) => rows.find(r => r.indicator === indicator && r.year === year)?.median;

    return (
        <article className="flex flex-col rounded-2xl p-5 text-white" style={{ backgroundColor: '#0b1d4f' }}>
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-blue-300">Macroeconomia</p>
                    <h3 className="mt-0.5 font-semibold">Boletim Focus</h3>
                </div>
                <span className="shrink-0 rounded-md border border-white/20 px-1.5 py-0.5 text-[10px] font-medium text-blue-100">Semanal</span>
            </div>

            {rows.length > 0 ? (
                <table className="mt-4 w-full text-sm">
                    <thead>
                        <tr className="text-[11px] text-blue-200/80">
                            <th className="pb-2 text-left font-medium">Expectativa</th>
                            {years.map(y => <th key={y} className="pb-2 text-right font-medium">{y}</th>)}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                        {FOCUS_INDICATORS.map(indicator => (
                            <tr key={indicator}>
                                <td className="py-2 text-blue-100">{LABELS[indicator]}</td>
                                {years.map(y => {
                                    const value = median(indicator, y);
                                    return (
                                        <td key={y} className="py-2 text-right font-semibold tabular-nums">
                                            {value === undefined ? '—' : formatMedian(indicator, value)}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            ) : (
                <p className="mt-4 flex items-center gap-2 text-xs text-amber-200">
                    <AlertTriangle className="h-4 w-4" aria-hidden="true" /> Focus indisponível no momento{error ? ` (${error})` : ''}.
                </p>
            )}

            <p className="mt-auto pt-3 text-[11px] leading-relaxed text-blue-100/70">
                Mediana das projeções do mercado{bulletin ? `, boletim de ${formatReference(bulletin, 'day')}` : ''}.
            </p>
            <a
                href="https://www.bcb.gov.br/publicacoes/focus"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 text-[11px] font-semibold text-blue-200 hover:underline"
            >
                Fonte: Banco Central
            </a>
        </article>
    );
};
