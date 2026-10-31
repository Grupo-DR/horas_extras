import { CC_MAP, normalizeCC } from '../../data/ccMaster';

/**
 * Códigos de centro de custo que a Carol usa e que não batem com o TOTVS RM.
 * Só a Auditoria de Ponto traduz — o CC_MASTER (horas extras, headcount) não muda.
 *
 * Carol (normalizado) → TOTVS (ccNorm do CC_MASTER). Padrão das obras: 20xx → 30xx.01.
 * Conferido contra a base salarial do RM (jan/2026): nº de pessoas por CC compatível.
 */
export const CAROL_CC_ALIASES: Record<string, string> = {
    '1002': '300001', // 3000.01 Gestão de Ativos
    '1003': '10301',  // 103.01 Comercial
    '1004': '10401',  // 104.01 Capital Humano
    '1005': '10501',  // 105.01 SSMA (Saúde e Segurança)
    '2028': '302801', // 3028.01 Obras Civis Regional 01
    // Inferidos pelo padrão + RM, não confirmados pelo RH:
    '2027': '302701', // 3027.01 VLI TC IBAMA — 1 pessoa na Carol e 1 chapa no RM (afastada em 2024)
    '2045': '304501'  // 3045.01 Rumo Pátio Catanduva - Catiguá
};

/** Nome exibido na auditoria quando o do CC_MASTER não descreve o que a Carol agrupa. */
const CLOCKIN_CC_LABELS: Record<string, string> = {
    // A Carol junta 101.01 (Adm. Financeiro) e 106.01 (Suprimentos) no 1001.
    '1001': 'ADMINISTRATIVO (CONTÁBIL / FINANCEIRO / SUPRIMENTOS)'
};

export interface ResolvedCostCenter {
    /** CC usado no portal (TOTVS quando há equivalência). */
    costCenter: string;
    /** CC como veio da Carol, normalizado. */
    carolCostCenter: string;
    /** Existe no CC_MASTER. */
    known: boolean;
}

export const resolveCarolCostCenter = (raw: string): ResolvedCostCenter => {
    const carolCostCenter = normalizeCC(raw.trim());
    const costCenter = CAROL_CC_ALIASES[carolCostCenter] ?? carolCostCenter;
    return { costCenter, carolCostCenter, known: !!CC_MAP[costCenter] };
};

/** CCs da Carol que agrupam vários CCs do RM: qualquer um deles conta como o mesmo. */
const CAROL_CC_GROUPS: Record<string, string[]> = {
    '1001': ['1001', '10101', '10104', '10601'] // Adm. Financeiro, TI, Suprimentos
};

/** O CC do RM é o mesmo da batida (considerando os agrupamentos da Carol)? */
export const costCentersMatch = (
    punch: { costCenter: string; carolCostCenter: string },
    rmCostCenter: string
): boolean => {
    const rm = normalizeCC(rmCostCenter);
    if (!rm) return true;
    const resolvedRm = CAROL_CC_ALIASES[rm] ?? rm;
    if (rm === punch.costCenter || resolvedRm === punch.costCenter || rm === punch.carolCostCenter) return true;
    const group = CAROL_CC_GROUPS[punch.carolCostCenter] || CAROL_CC_GROUPS[punch.costCenter];
    if (group && (group.includes(rm) || group.includes(resolvedRm))) return true;
    return sameObraOldCode(rm, punch.costCenter) || sameObraOldCode(rm, punch.carolCostCenter);
};

/**
 * O cadastro de funcionários do RM usa o código antigo da obra ("2019"), sem a
 * subdivisão; no CC_MASTER a obra é "3019.01", "3019.03"... Mesma obra = mesmo "19".
 */
const sameObraOldCode = (oldCode: string, costCenter: string): boolean => {
    const match = /^20(\d{2})$/.exec(oldCode);
    return !!match && costCenter.startsWith(`30${match[1]}`);
};

export const isKnownCostCenter =(costCenter: string): boolean => !!CC_MAP[costCenter];

/** Nome do CC na auditoria, com aviso quando não existe no cadastro TOTVS. */
export const getClockinCCName = (costCenter: string): string => {
    if (CLOCKIN_CC_LABELS[costCenter]) return CLOCKIN_CC_LABELS[costCenter];
    if (CC_MAP[costCenter]) return CC_MAP[costCenter].name;
    // Código antigo do RM ("2019"): nome da obra 3019.xx correspondente.
    const oldCode = /^20(\d{2})$/.exec(costCenter);
    if (oldCode) {
        const obra = Object.values(CC_MAP).find(c => c.ccNorm.startsWith(`30${oldCode[1]}`));
        if (obra) return `${obra.name} (código antigo do RM)`;
    }
    return costCenter ? 'CC não cadastrado no TOTVS' : 'Sem CC';
};
