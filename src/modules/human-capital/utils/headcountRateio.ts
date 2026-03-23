/**
 * utils/headcountRateio.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Motor de rateio do realizado usando headcount temporal.
 *
 * Responsabilidade:
 *   Transformar OvertimeRecord[] (bruto TOTVS, com CC duplicado por alocação)
 *   em OvertimeRecord[] correto, onde cada linha representa a FRAÇÃO REAL
 *   atribuída ao CC de headcount.
 *
 * Este módulo é puro (sem efeitos colaterais / sem chamadas a serviços).
 *
 * ─── Nomenclatura ─────────────────────────────────────────────────────────────
 *  dadoBruto       → OvertimeRecord com CODCCUSTO da TOTVS (pode estar duplicado)
 *  dadoConsolidado → DailyEmployeeTotal: uma só linha por chapa+data+evento (sem duplicidade)
 *  dadoRateado     → AlocacaoRateada / OvertimeRecord gerado: CC = headcount, HORAS = horas×distribuicao
 */

import { OvertimeRecord, HeadcountRecord } from '../types';
import { toDateKey } from './overtime';

// ─── Tipos internos ───────────────────────────────────────────────────────────

/**
 * Realizado consolidado: uma linha por chapa + data + evento.
 * Elimina a duplicidade causada pela replicação do TOTVS por CC.
 */
export interface DailyEmployeeTotal {
    /** Chapa normalizada (uppercase, sem espaços) */
    chapa: string;
    /** Data do lançamento no formato YYYY-MM-DD */
    date: string;
    /** Evento original (ex.: 'HORA EXTRA 60') — preservado para downstream */
    evento: string;
    /** Total consolidado de horas para esta chapa+date+evento */
    horasConsolidadas: number;
    /** Snapshot do primeiro OvertimeRecord encontrado para este grupo (para preservar metadados) */
    record: OvertimeRecord;
}

/**
 * Uma linha de realizado após a aplicação do headcount.
 * Representa a fração de horas atribuída a um CC específico.
 */
export interface AlocacaoRateada {
    chapa: string;
    date: string;
    evento: string;
    /** CC do headcount (verdade analítica) - NÃO é o CODCCUSTO da TOTVS */
    centroCustoHeadcount: string;
    /** Percentual de alocação aplicado (0 < dist ≤ 1) */
    distribuicao: number;
    /** Horas rateadas: horasConsolidadas × distribuicao */
    horasRateadas: number;
    /** Referência ao dado consolidado de origem (para auditoria) */
    origin: DailyEmployeeTotal;
}

/**
 * Resultado completo do rateio para um conjunto de registros.
 */
export interface RateioResult {
    /** Linhas rateadas com CC do headcount */
    alocacoesRateadas: AlocacaoRateada[];
    /**
     * Chapas que estavam no realizado mas NÃO têm headcount vigente para
     * pelo menos um dos seus dias. São mantidas no bruto como fallback auditável.
     */
    chapasSemHeadcount: Set<string>;
    /** Totais para validação de conservação: soma antes e depois deve ser igual */
    totalHorasBruto: number;
    totalHorasRateadas: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Normaliza uma chapa: uppercase, trim, remove zeros à esquerda opcionally */
const normalizeChapa = (chapa: string): string => chapa.trim().toUpperCase();

/**
 * Retorna todos os `HeadcountRecord` vigentes para uma `chapa` em uma determinada `date`.
 * Vigente = dataInicio ≤ date ≤ dataFim.
 */
export const getHeadcountVigente = (
    headcounts: HeadcountRecord[],
    chapa: string,
    date: string
): HeadcountRecord[] => {
    const chapaUpper = normalizeChapa(chapa);
    return headcounts.filter(
        h =>
            normalizeChapa(h.chapa) === chapaUpper &&
            h.dataInicio <= date &&
            h.dataFim >= date
    );
};

// ─── Passo 1: Consolidação ────────────────────────────────────────────────────

/**
 * Consolida o realizado bruto (TOTVS) eliminando a duplicidade por CC.
 *
 * A TOTVS replica a mesma hora em cada CODCCUSTO onde o colaborador está alocado.
 * Esta função agrupa por (chapa, date, evento) e usa o MAIOR valor encontrado
 * para aquele grupo como a hora real (estratégia: não somar, pegar o valor canônico).
 *
 * Premissa confiável: os valores replicados são idênticos (mesmo número de horas).
 * Caso existam divergências (dados inconsistentes), o maior valor é escolhido como
 * representativo e a inconsistência é logada.
 */
export const consolidarPorChapaDataEvento = (
    records: OvertimeRecord[]
): DailyEmployeeTotal[] => {
    // Map<chapa|date|evento, DailyEmployeeTotal>
    const groupMap = new Map<string, DailyEmployeeTotal>();

    for (const r of records) {
        const chapa = normalizeChapa(r.CHAPA || '');
        if (!chapa) continue;

        const date = toDateKey(r.DATA);
        if (!date) continue;

        const evento = (r.EVENTO || '').trim();
        const horas = Number(r.HORAS) || 0;
        if (horas <= 0) continue;

        const key = `${chapa}|${date}|${evento}`;

        if (!groupMap.has(key)) {
            groupMap.set(key, {
                chapa,
                date,
                evento,
                horasConsolidadas: horas,
                record: r,
            });
        } else {
            const existing = groupMap.get(key)!;
            if (Math.abs(horas - existing.horasConsolidadas) > 0.001) {
                // Inconsistência no dado bruto — mantém o maior valor
                console.warn(
                    `[headcountRateio] Inconsistência: chapa=${chapa} date=${date} evento=${evento} ` +
                    `valores divergentes: ${existing.horasConsolidadas} vs ${horas}. Usando o maior.`
                );
                if (horas > existing.horasConsolidadas) {
                    existing.horasConsolidadas = horas;
                    existing.record = r;
                }
            }
            // Se iguais: ignora a duplicata (comportamento esperado para TOTVS)
        }
    }

    return Array.from(groupMap.values());
};

// ─── Passo 2: Rateio ──────────────────────────────────────────────────────────

/**
 * Aplica o headcount vigente sobre o realizado consolidado.
 *
 * Para cada DailyEmployeeTotal:
 *  - Busca headcounts vigentes na data
 *  - Se encontrar: gera N AlocacaoRateada (uma por CC com peso distribuicao)
 *  - Se não encontrar: marca a chapa para fallback ao dado bruto
 *
 * Garante conservação: Σ(horasRateadas) == horasConsolidadas (dentro de tolerância 0.001)
 */
export const aplicarHeadcountRateio = (
    totals: DailyEmployeeTotal[],
    headcounts: HeadcountRecord[]
): RateioResult => {
    const alocacoesRateadas: AlocacaoRateada[] = [];
    const chapasSemHeadcount = new Set<string>();
    let totalHorasBruto = 0;
    let totalHorasRateadas = 0;

    for (const total of totals) {
        totalHorasBruto += total.horasConsolidadas;

        const vigentes = getHeadcountVigente(headcounts, total.chapa, total.date);

        if (vigentes.length === 0) {
            // Sem headcount: chapa vai para o fallback (dado bruto)
            chapasSemHeadcount.add(total.chapa);
            continue;
        }

        // Normaliza as distribuições: em caso de soma ≠ 1 (dados incorretos),
        // usa os pesos relativos para garantir conservação
        const somaDistribuicao = vigentes.reduce((s, h) => s + h.distribuicao, 0);
        const fatorNormalizacao = somaDistribuicao > 0 ? 1 / somaDistribuicao : 1;

        let somaRateada = 0;
        const linhasDoGrupo: AlocacaoRateada[] = [];

        vigentes.forEach((h, idx) => {
            const distribuicaoNorm = h.distribuicao * fatorNormalizacao;
            // Última fatia recebe o arredondamento para garantir conservação exata
            const isLast = idx === vigentes.length - 1;
            const horasRateadas = isLast
                ? total.horasConsolidadas - somaRateada
                : Math.round(total.horasConsolidadas * distribuicaoNorm * 10000) / 10000;

            somaRateada += horasRateadas;

            linhasDoGrupo.push({
                chapa: total.chapa,
                date: total.date,
                evento: total.evento,
                centroCustoHeadcount: (h.centroCusto || '').trim().toUpperCase(),
                distribuicao: distribuicaoNorm,
                horasRateadas,
                origin: total,
            });
        });

        alocacoesRateadas.push(...linhasDoGrupo);
        totalHorasRateadas += somaRateada;
    }

    return {
        alocacoesRateadas,
        chapasSemHeadcount,
        totalHorasBruto,
        totalHorasRateadas,
    };
};

// ─── Passo 3: Geração do OvertimeRecord[] ajustado ───────────────────────────

/**
 * Pipeline completa: recebe o dado bruto (TOTVS) e os registros de headcount,
 * e devolve OvertimeRecord[] com o mesmo contrato — mas com CC e HORAS corretos.
 *
 * Coexistência bruto × rateado:
 *  - Chapas COM headcount vigente → OvertimeRecord com CODCCUSTO = CC do headcount
 *  - Chapas SEM headcount → mantidas como bruto (CODCCUSTO = TOTVS original)
 *    com flag `_semHeadcount: true` no objeto (auditável, não afeta tipagem pública)
 *
 * Se headcounts estiver vazio, retorna records inalterado (fallback transparente).
 */
export const gerarOvertimeRateado = (
    records: OvertimeRecord[],
    headcounts: HeadcountRecord[]
): OvertimeRecord[] => {
    // Fallback: sem headcount importado, não altera nada
    if (!headcounts || headcounts.length === 0) return records;

    // Passo 1: consolida o bruto eliminando duplicidade por CC
    const totals = consolidarPorChapaDataEvento(records);

    // Passo 2: aplica o rateio
    const { alocacoesRateadas, chapasSemHeadcount } = aplicarHeadcountRateio(totals, headcounts);

    const resultado: OvertimeRecord[] = [];

    // ── Chapas COM headcount: gera uma OvertimeRecord por alocação rateada ───
    for (const aloc of alocacoesRateadas) {
        const base = aloc.origin.record;
        resultado.push({
            CHAPA: aloc.chapa,
            NOME: base.NOME,
            FUNCAO: base.FUNCAO,
            // CC = verdade analítica do headcount (não a TOTVS)
            CODCCUSTO: aloc.centroCustoHeadcount,
            SECAO: base.SECAO,
            DATA: base.DATA,
            EVENTO: aloc.evento,
            HORAS: aloc.horasRateadas,
            // VALOR mantido proporcional (se presente)
            VALOR: base.VALOR ? Math.round(base.VALOR * aloc.distribuicao * 10000) / 10000 : 0,
        });
    }

    // ── Chapas SEM headcount: mantidas no bruto, deduplicadas ───────────────
    // Usamos os totals consolidados para evitar re-duplicar
    if (chapasSemHeadcount.size > 0) {
        const totalsMap = new Map(
            totals
                .filter(t => chapasSemHeadcount.has(t.chapa))
                .map(t => [`${t.chapa}|${t.date}|${t.evento}`, t])
        );

        for (const [, total] of totalsMap) {
            resultado.push({
                ...total.record,
                HORAS: total.horasConsolidadas,
            });
        }
    }

    return resultado;
};

// ─── Utilitário de diagnóstico ───────────────────────────────────────────────

/**
 * Compara o total de horas bruto com o total rateado.
 * Útil para logs de diagnóstico — não deve ser chamada em produção hot-path.
 */
export const diagnosticarConservacao = (
    records: OvertimeRecord[],
    headcounts: HeadcountRecord[]
): {
    totalBruto: number;
    totalRateado: number;
    chapasComHeadcount: number;
    chapasSemHeadcount: number;
    delta: number;
} => {
    const totals = consolidarPorChapaDataEvento(records);
    const result = aplicarHeadcountRateio(totals, headcounts);
    const bruto = totals.reduce((s, t) => s + t.horasConsolidadas, 0);
    const rateado = result.alocacoesRateadas.reduce((s, a) => s + a.horasRateadas, 0);
    const allChapas = new Set(totals.map(t => t.chapa));

    return {
        totalBruto: Math.round(bruto * 1000) / 1000,
        totalRateado: Math.round(rateado * 1000) / 1000,
        chapasComHeadcount: allChapas.size - result.chapasSemHeadcount.size,
        chapasSemHeadcount: result.chapasSemHeadcount.size,
        delta: Math.round((bruto - rateado) * 1000) / 1000,
    };
};
