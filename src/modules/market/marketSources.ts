/**
 * Busca dos indicadores nas fontes oficiais (APIs públicas com CORS liberado):
 * - Banco Central SGS: séries mensais e diárias (Selic, IPCA, IGP-M, INCC);
 * - Banco Central Olinda: PTAX e Boletim Focus;
 * - IBGE SIDRA: PIB da construção (tabela 5932).
 */
import {
    FocusExpectation,
    IndicatorMeta,
    IndicatorResult,
    SeriesPoint,
    accumulateRates,
    formatReference,
    lastPointPerMonth,
    parseBrDate,
    pointOnOrBefore,
    shiftIsoDate
} from './marketIndicators';

const TIMEOUT_MS = 20000;

const getJson = async <T>(url: string): Promise<T> => {
    const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!response.ok) throw new Error(`Fonte respondeu ${response.status}`);
    return response.json() as Promise<T>;
};

const toBrDate = (iso: string) => {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
};

/** Série do SGS no intervalo [desde, hoje]. */
const fetchSgs = async (code: number, sinceIso: string, todayIso: string): Promise<SeriesPoint[]> => {
    const rows = await getJson<Array<{ data: string; valor: string }>>(
        `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${code}/dados?formato=json&dataInicial=${toBrDate(sinceIso)}&dataFinal=${toBrDate(todayIso)}`
    );
    return rows.map(r => ({ date: parseBrDate(r.data), value: Number(r.valor) })).filter(p => Number.isFinite(p.value));
};

const requireData = (points: SeriesPoint[]): SeriesPoint[] => {
    if (points.length === 0) throw new Error('Fonte sem dados no período');
    return points;
};

// ─── Construtores por tipo de indicador ──────────────────────────────────────

/** Índices de preço mensais (%): último mês, acumulado 12 meses e variação vs mês anterior. */
const monthlyRate = (meta: IndicatorMeta, sgsCode: number) =>
    async (todayIso: string): Promise<IndicatorResult> => {
        const points = requireData(await fetchSgs(sgsCode, shiftIsoDate(todayIso, -500), todayIso));
        const latest = points[points.length - 1];
        const previous = points[points.length - 2];
        const last12 = points.slice(-12).map(p => p.value);
        return {
            meta,
            latest,
            detail: `${formatReference(latest.date, 'month')} · acumulado 12 meses: ${accumulateRates(last12).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`,
            change: previous ? { value: latest.value - previous.value, label: 'vs mês anterior' } : undefined,
            history: points.slice(-13)
        };
    };

const META: Record<string, IndicatorMeta> = {
    inccM: {
        id: 'incc-m', name: 'INCC-M', group: 'custos', format: 'percent', frequency: 'Mensal',
        description: 'Inflação dos custos da construção; base de reajuste de contratos e orçamentos.',
        source: 'FGV Ibre (via Banco Central)', sourceUrl: 'https://portalibre.fgv.br'
    },
    inccDi: {
        id: 'incc-di', name: 'INCC-DI', group: 'custos', format: 'percent', frequency: 'Mensal',
        description: 'Custo da construção no mês cheio; usado em reajustes de contratos.',
        source: 'FGV Ibre (via Banco Central)', sourceUrl: 'https://portalibre.fgv.br'
    },
    selic: {
        id: 'selic', name: 'Selic (meta)', group: 'macro', format: 'percentYear', frequency: 'A cada reunião do Copom',
        description: 'Custo do crédito, que afeta financiamento imobiliário e de obras.',
        source: 'Banco Central', sourceUrl: 'https://www.bcb.gov.br/controleinflacao/taxaselic'
    },
    ipca: {
        id: 'ipca', name: 'IPCA', group: 'macro', format: 'percent', frequency: 'Mensal',
        description: 'Inflação oficial do país.',
        source: 'IBGE (via Banco Central)', sourceUrl: 'https://www.ibge.gov.br/explica/inflacao.php'
    },
    igpm: {
        id: 'igp-m', name: 'IGP-M', group: 'macro', format: 'percent', frequency: 'Mensal',
        description: 'Usado em reajustes de contratos e aluguéis.',
        source: 'FGV Ibre (via Banco Central)', sourceUrl: 'https://portalibre.fgv.br'
    },
    dolar: {
        id: 'dolar', name: 'Dólar (PTAX venda)', group: 'macro', format: 'currency', frequency: 'Diária',
        description: 'Afeta equipamentos e insumos importados.',
        source: 'Banco Central', sourceUrl: 'https://www.bcb.gov.br/estabilidadefinanceira/historicocotacoes'
    },
    pibConstrucao: {
        id: 'pib-construcao', name: 'PIB da construção', group: 'atividade', format: 'percent', frequency: 'Trimestral',
        description: 'Crescimento ou retração do setor (vs mesmo trimestre do ano anterior).',
        source: 'IBGE', sourceUrl: 'https://sidra.ibge.gov.br/tabela/5932'
    }
};

const selic = async (todayIso: string): Promise<IndicatorResult> => {
    const points = requireData(await fetchSgs(432, shiftIsoDate(todayIso, -760), todayIso));
    const latest = points[points.length - 1];
    const yearAgo = pointOnOrBefore(points, shiftIsoDate(latest.date, -365));
    return {
        meta: META.selic,
        latest,
        detail: `Vigente em ${formatReference(latest.date, 'day')}`,
        change: yearAgo ? { value: latest.value - yearAgo.value, label: 'em 12 meses' } : undefined,
        history: lastPointPerMonth(points).slice(-24)
    };
};

const dolar = async (todayIso: string): Promise<IndicatorResult> => {
    const since = shiftIsoDate(todayIso, -400);
    const [ys, ms, ds] = since.split('-');
    const [yt, mt, dt] = todayIso.split('-');
    const data = await getJson<{ value: Array<{ cotacaoVenda: number; dataHoraCotacao: string }> }>(
        'https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoDolarPeriodo(dataInicial=@i,dataFinalCotacao=@f)' +
        `?@i='${ms}-${ds}-${ys}'&@f='${mt}-${dt}-${yt}'&$format=json&$select=cotacaoVenda,dataHoraCotacao`
    );
    const points = requireData(data.value.map(r => ({ date: r.dataHoraCotacao.slice(0, 10), value: r.cotacaoVenda })))
        .sort((a, b) => a.date.localeCompare(b.date));
    const latest = points[points.length - 1];
    const monthAgo = pointOnOrBefore(points, shiftIsoDate(latest.date, -30));
    return {
        meta: META.dolar,
        latest,
        detail: `Cotação de ${formatReference(latest.date, 'day')}`,
        change: monthAgo ? { value: (latest.value / monthAgo.value - 1) * 100, label: 'em 30 dias' } : undefined,
        history: lastPointPerMonth(points).slice(-13)
    };
};

/** Código de trimestre do SIDRA → primeiro dia do trimestre: "202602" → "2026-04-01". */
export const sidraQuarterToIso = (code: string): string => {
    const year = code.slice(0, 4);
    const quarter = Number(code.slice(4));
    return `${year}-${String((quarter - 1) * 3 + 1).padStart(2, '0')}-01`;
};

const pibConstrucao = async (): Promise<IndicatorResult> => {
    // 6561: vs mesmo trimestre do ano anterior; 6562: acumulado em 4 trimestres. 90694 = Construção.
    const rows = await getJson<Array<Record<string, string>>>(
        'https://apisidra.ibge.gov.br/values/t/5932/n1/all/v/6561,6562/p/last%208/c11255/90694'
    );
    const data = rows.slice(1).filter(r => Number.isFinite(Number(r.V)));
    const series = (variable: string) => data
        .filter(r => r.D2C === variable)
        .map(r => ({ date: sidraQuarterToIso(r.D3C), value: Number(r.V) }))
        .sort((a, b) => a.date.localeCompare(b.date));
    const quarterly = requireData(series('6561'));
    const accumulated = series('6562');
    const latest = quarterly[quarterly.length - 1];
    const previous = quarterly[quarterly.length - 2];
    const acc = accumulated[accumulated.length - 1];
    return {
        meta: META.pibConstrucao,
        latest,
        detail: `${formatReference(latest.date, 'quarter')}${acc ? ` · acumulado 4 trimestres: ${acc.value.toLocaleString('pt-BR')}%` : ''}`,
        change: previous ? { value: latest.value - previous.value, label: 'vs trimestre anterior' } : undefined,
        history: quarterly
    };
};

/** Indicadores automáticos, na ordem de exibição. */
export const INDICATOR_LOADERS: Array<{ meta: IndicatorMeta; load: (todayIso: string) => Promise<IndicatorResult> }> = [
    { meta: META.inccM, load: monthlyRate(META.inccM, 7456) },
    { meta: META.inccDi, load: monthlyRate(META.inccDi, 192) },
    { meta: META.selic, load: selic },
    { meta: META.ipca, load: monthlyRate(META.ipca, 433) },
    { meta: META.igpm, load: monthlyRate(META.igpm, 189) },
    { meta: META.dolar, load: dolar },
    { meta: META.pibConstrucao, load: () => pibConstrucao() }
];

/** Boletim Focus: mediana mais recente (base 30 dias) para o ano atual e o seguinte. */
export const FOCUS_INDICATORS = ['Selic', 'IPCA', 'Câmbio', 'PIB Total'] as const;

export const fetchFocus = async (todayIso: string): Promise<FocusExpectation[]> => {
    const year = Number(todayIso.slice(0, 4));
    const indicators = FOCUS_INDICATORS.map(i => `Indicador eq '${i}'`).join(' or ');
    const filter = `(${indicators}) and (DataReferencia eq '${year}' or DataReferencia eq '${year + 1}') and baseCalculo eq 0`;
    const data = await getJson<{ value: Array<{ Indicador: string; DataReferencia: string; Mediana: number; Data: string }> }>(
        'https://olinda.bcb.gov.br/olinda/servico/Expectativas/versao/v1/odata/ExpectativasMercadoAnuais' +
        `?$top=40&$orderby=Data desc&$format=json&$select=Indicador,DataReferencia,Mediana,Data&$filter=${encodeURIComponent(filter)}`
    );
    return data.value.map(r => ({ indicator: r.Indicador, year: r.DataReferencia, median: r.Mediana, date: r.Data }));
};
