import { normalizeCC } from '../../data/ccMaster';
import { GlobalEmployee, HeadcountRecord } from '../../types';

/**
 * Cruzamento das batidas da Carol com o cadastro do RM.
 * 1º por CPF, no cadastro de funcionários do RM (consulta "DADOS SOLIDES");
 * 2º pelo nome, no headcount e no cadastro global que o Capital Humano já carrega.
 */

/** Como chega da Cloud Function hcFetchEmployees (só os campos necessários). */
export interface RmEmployeeRecord {
    chapa: string;
    nome: string;
    cpf: string;
    funcao: string;
    codCCusto: string;
    dataAdmissao: string | null;
    dataDemissao: string | null;
}

export type RmEmployeeSource = 'RM' | 'HEADCOUNT' | 'CADASTRO';

export interface RmEmployee {
    chapa: string;
    nome: string;
    funcao?: string;
    /** Normalizado (sem pontos). */
    costCenter: string;
    source: RmEmployeeSource;
    /** YYYY-MM-DD, só na fonte RM. */
    dataDemissao?: string | null;
}

export type RmMatchStatus = 'MATCHED' | 'AMBIGUOUS' | 'NOT_FOUND';

export interface RmMatch {
    status: RmMatchStatus;
    /** CPF = exato; NOME = pelo nome normalizado. */
    by?: 'CPF' | 'NOME';
    employee?: RmEmployee;
    /** Nº de chapas com o mesmo nome (homônimos). */
    candidates: number;
}

const NAME_PARTICLES = new Set(['de', 'da', 'do', 'das', 'dos', 'e']);

/** "José da Silva  Júnior" → "jose silva junior" */
export const normalizePersonName = (name: string): string =>
    name
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z\s]/g, ' ')
        .split(/\s+/)
        .filter(part => part && !NAME_PARTICLES.has(part))
        .join(' ');

export interface RmDirectory {
    byCpf: Map<string, RmEmployee>;
    byName: Map<string, RmEmployee[]>;
    /** Alocações do headcount por chapa, para achar o CC de cada data. */
    headcountByChapa: Map<string, HeadcountRecord[]>;
    /** O cadastro do RM (com CPF) foi carregado. */
    hasRmRegistry: boolean;
}

/**
 * Monta o diretório (quem é a pessoa). No RM, um CPF pode ter várias chapas
 * (readmissões): vale a chapa ativa, ou a de demissão mais recente. O CC
 * guardado aqui é só de referência — o CC de cada batida sai de
 * expectedCostCentersOn(), pelo headcount vigente na data.
 */
export const buildRmDirectory = (
    headcount: HeadcountRecord[],
    globals: GlobalEmployee[],
    refDate: string,
    rmEmployees: RmEmployeeRecord[] = []
): RmDirectory => {
    const byCpf = new Map<string, RmEmployee>();
    const cpfRank = (e: RmEmployeeRecord) => (e.dataDemissao ? e.dataDemissao : '9999-99-99');
    const bestByCpf = new Map<string, RmEmployeeRecord>();
    rmEmployees.forEach(e => {
        if (!e.cpf) return;
        const current = bestByCpf.get(e.cpf);
        if (!current || cpfRank(e) > cpfRank(current)) bestByCpf.set(e.cpf, e);
    });
    bestByCpf.forEach((e, cpf) => byCpf.set(cpf, {
        chapa: e.chapa,
        nome: e.nome,
        funcao: e.funcao || undefined,
        costCenter: normalizeCC(e.codCCusto || ''),
        source: 'RM',
        dataDemissao: e.dataDemissao
    }));

    const byChapa = new Map<string, RmEmployee>();
    const globalByChapa = new Map(globals.map(g => [g.chapa, g]));

    const headcountByChapa = new Map<string, HeadcountRecord[]>();
    headcount.forEach(r => {
        if (!r.chapa) return;
        const list = headcountByChapa.get(r.chapa);
        if (list) list.push(r);
        else headcountByChapa.set(r.chapa, [r]);
    });
    // Identidade pelo nome: a alocação na data de referência só define o CC "de referência".
    headcountByChapa.forEach((records, chapa) => {
        const vigentes = records.filter(r => r.dataInicio <= refDate && r.dataFim >= refDate);
        const pool = vigentes.length ? vigentes : records;
        const best = [...pool].sort((a, b) => b.distribuicao - a.distribuicao || b.dataFim.localeCompare(a.dataFim))[0];
        const nome = best.nome || globalByChapa.get(chapa)?.nome || '';
        if (!nome) return;
        byChapa.set(chapa, {
            chapa,
            nome,
            funcao: best.funcao || globalByChapa.get(chapa)?.funcao,
            costCenter: normalizeCC(best.centroCusto || ''),
            source: 'HEADCOUNT'
        });
    });

    globals.forEach(g => {
        if (!g.chapa || !g.nome || byChapa.has(g.chapa)) return;
        byChapa.set(g.chapa, { chapa: g.chapa, nome: g.nome, funcao: g.funcao, costCenter: normalizeCC(g.costCenter || ''), source: 'CADASTRO' });
    });

    const byName = new Map<string, RmEmployee[]>();
    byChapa.forEach(employee => {
        const key = normalizePersonName(employee.nome);
        if (!key) return;
        const list = byName.get(key);
        if (list) list.push(employee);
        else byName.set(key, [employee]);
    });

    return { byCpf, byName, headcountByChapa, hasRmRegistry: byCpf.size > 0 };
};

export type ExpectedCostCenterSource = 'HEADCOUNT' | 'RM_ATUAL' | 'CADASTRO';

export interface ExpectedCostCenters {
    /** CCs normalizados com a fatia do rateio (headcount) — 1 quando não há rateio. */
    allocations: Array<{ costCenter: string; share: number }>;
    source: ExpectedCostCenterSource;
}

/**
 * Onde a pessoa deveria estar na data da batida. A pessoa muda de CC ao longo
 * do ano e pode estar rateada entre obras, então vale o headcount vigente na
 * data (todos os CCs do rateio). Sem headcount na data, cai no CC atual do RM
 * (foto de hoje) ou no cadastro do portal.
 */
export const expectedCostCentersOn = (
    directory: RmDirectory,
    employee: RmEmployee,
    date: string
): ExpectedCostCenters | null => {
    const vigentes = (directory.headcountByChapa.get(employee.chapa) || [])
        .filter(r => r.dataInicio <= date && r.dataFim >= date && r.centroCusto);
    if (vigentes.length > 0) {
        const byCc = new Map<string, number>();
        vigentes.forEach(r => {
            const cc = normalizeCC(r.centroCusto);
            byCc.set(cc, (byCc.get(cc) || 0) + (r.distribuicao || 0));
        });
        return {
            allocations: Array.from(byCc.entries())
                .map(([costCenter, share]) => ({ costCenter, share }))
                .sort((a, b) => b.share - a.share),
            source: 'HEADCOUNT'
        };
    }
    if (!employee.costCenter) return null;
    return {
        allocations: [{ costCenter: employee.costCenter, share: 1 }],
        source: employee.source === 'RM' ? 'RM_ATUAL' : 'CADASTRO'
    };
};

export const matchRmEmployee = (person: { cpf: string; name: string }, directory: RmDirectory): RmMatch => {
    const byCpf = directory.byCpf.get(person.cpf);
    if (byCpf) return { status: 'MATCHED', by: 'CPF', employee: byCpf, candidates: 1 };

    const found = directory.byName.get(normalizePersonName(person.name)) || [];
    if (found.length === 1) return { status: 'MATCHED', by: 'NOME', employee: found[0], candidates: 1 };
    if (found.length > 1) return { status: 'AMBIGUOUS', candidates: found.length };
    return { status: 'NOT_FOUND', candidates: 0 };
};
