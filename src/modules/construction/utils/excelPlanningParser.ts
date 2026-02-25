import * as XLSX from 'xlsx';
import { PlanningAssignment, PlannedService, ServicePrice } from '../types';

export interface PlanningParseResult {
    assignments: PlanningAssignment[];
    warnings: string[];
    summary: {
        totalRows: number;
        totalAssignments: number;
        skippedRows: number;
    };
}

// ---------------------------------------------------------------------------
// Normalization & alias resolution
// ---------------------------------------------------------------------------

/** Strip accents, uppercase, collapse spaces */
function normalize(text: string): string {
    if (!text) return '';
    return String(text)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Maps normalized Excel equipment type names → normalized catalog type names.
 * Handles "RETRO ESCAVADEIRA" (two words) → "RETROESCAVADEIRA" (one word), etc.
 */
const EQUIP_ALIASES: Record<string, string> = {
    'RETRO ESCAVADEIRA': 'RETROESCAVADEIRA',
    'RETROESCAVADEIRA': 'RETROESCAVADEIRA',
    'RETROESCAVADEIRA LEVE': 'RETROESCAVADEIRA',
    'RETRO': 'RETROESCAVADEIRA',
    'REL': 'RETROESCAVADEIRA',

    'MINI ESCAVADEIRA': 'MINIESCAVADEIRA',
    'MINIESCAVADEIRA': 'MINIESCAVADEIRA',
    'MINI-ESCAVADEIRA': 'MINIESCAVADEIRA',
    'MEL': 'MINIESCAVADEIRA',

    'ESCAVADEIRA HIDRAULICA': 'ESCAVADEIRA HIDRAULICA',
    'ESCAVADEIRA': 'ESCAVADEIRA HIDRAULICA',
    'EH': 'ESCAVADEIRA HIDRAULICA',

    'CAMINHAO BASCULANTE': 'CAMINHAO BASCULANTE',
    'CAMINHAO': 'CAMINHAO BASCULANTE',
    'BASCULANTE': 'CAMINHAO BASCULANTE',
    'CBL': 'CAMINHAO BASCULANTE',

    'PA CARREGADEIRA': 'PA CARREGADEIRA',
    'CARREGADEIRA': 'PA CARREGADEIRA',

    'MOTONIVELADORA': 'MOTONIVELADORA',
    'MOTO NIVELADORA': 'MOTONIVELADORA',

    'CARRETA PRANCHA': 'CARRETA PRANCHA',
    'PRANCHA': 'CARRETA PRANCHA',

    'TRATOR ESTEIRA': 'TRATOR DE ESTEIRA',
    'TRATOR DE ESTEIRA': 'TRATOR DE ESTEIRA',

    'ROLO COMPACTADOR': 'ROLO COMPACTADOR',
    'ROLO': 'ROLO COMPACTADOR',

    'VEICULO LEVE': 'VEICULO LEVE',
    'VEICULO': 'VEICULO LEVE',
    'VLL': 'VEICULO LEVE',

    'CAMINHAO PIPA': 'CAMINHAO PIPA',
    'PIPA': 'CAMINHAO PIPA',

    'CAVALO MECANICO': 'CAVALO MECANICO',
    'CM': 'CAVALO MECANICO',
};

function resolveEquip(raw: string): string {
    const n = normalize(raw);
    return EQUIP_ALIASES[n] ?? n;
}

// ---------------------------------------------------------------------------
// Header-based column detection (keywords the parser recognises)
// ---------------------------------------------------------------------------

/** Keywords that identify each logical column (after normalization) */
const HEADER_KEYWORDS = {
    frota: ['FROTA', 'EQUIPAMENTO', 'VEICULO', 'PLACA'],
    equip: ['TIPO', 'TIPO EQUIP', 'TIPO DO EQUIPAMENTO', 'DESCRICAO', 'TIPO EQUIPAMENTO', 'MODELO'],
    km: ['KM', 'KM RODADO', 'QUILOMETRO', 'QUILOMETRAGEM', 'DISTANCIA'],
    hp: [
        'HP', 'H.P', 'H.P.', 'HP.',
        'HR PROD', 'HRS PROD', 'H PROD',
        'HORA PROD', 'HORAS PROD', 'HORA PRODUTIVA', 'HORAS PRODUTIVAS', 'HRS PRODUTIVAS',
        'PROD', 'PRODUTIVA', 'PRODUTIVO',
    ],
    hi: [
        'HI', 'H.I', 'H.I.', 'HI.',
        'HR IMPROD', 'HRS IMPROD', 'H IMPROD',
        'HORA IMPROD', 'HORAS IMPROD', 'HORA IMPRODUTIVA', 'HORAS IMPRODUTIVAS', 'HRS IMPRODUTIVAS',
        'IMPROD', 'IMPRODUTIVA', 'IMPRODUTIVO',
    ],
    date: ['DATA', 'DT', 'DATE', 'DIA'],
};

interface ColMap {
    frota: number;
    equip: number;
    km: number;
    hp: number;
    hi: number;
    date: number;
}

/**
 * Tries to detect column indices from a header row.
 * Returns null if mandatory columns (frota + date) are not found.
 * Any optional column not found in headers falls back to its DEFAULT_COLS position.
 */
function detectColumns(headerRow: any[]): ColMap | null {
    const map: Partial<ColMap> = {};

    headerRow.forEach((cell, idx) => {
        const n = normalize(String(cell ?? ''));
        if (n === '') return;

        for (const [key, keywords] of Object.entries(HEADER_KEYWORDS)) {
            if ((map as any)[key] !== undefined) continue; // already found
            if (keywords.some(kw => n.includes(kw))) {
                (map as any)[key] = idx;
            }
        }
    });

    // frota and date must be found; everything else falls back to default position
    if (map.frota === undefined || map.date === undefined) return null;

    return {
        frota: map.frota ?? DEFAULT_COLS.frota,
        equip: map.equip ?? DEFAULT_COLS.equip,
        km: map.km ?? DEFAULT_COLS.km,
        hp: map.hp ?? DEFAULT_COLS.hp,
        hi: map.hi ?? DEFAULT_COLS.hi,
        date: map.date ?? DEFAULT_COLS.date,
    };
}

/** Fallback fixed column mapping (A=frota, B=equip, C=km, D=hp, E=hi, F=date) */
const DEFAULT_COLS: ColMap = { frota: 0, equip: 1, km: 2, hp: 3, hi: 4, date: 5 };

// ---------------------------------------------------------------------------
// Date parsing
// ---------------------------------------------------------------------------

function parseDate(value: any, cycleYear: number): string | null {
    if (value === null || value === undefined || value === '') return null;

    if (typeof value === 'number') {
        const date = XLSX.SSF.parse_date_code(value);
        if (date) {
            const y = date.y || cycleYear;
            return `${y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
        }
        return null;
    }

    const str = String(value).trim();

    // DD/MM/YYYY
    const m1 = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m1) return `${m1[3]}-${m1[2].padStart(2, '0')}-${m1[1].padStart(2, '0')}`;

    // DD/MM
    const m2 = str.match(/^(\d{1,2})\/(\d{1,2})$/);
    if (m2) return `${cycleYear}-${m2[2].padStart(2, '0')}-${m2[1].padStart(2, '0')}`;

    // YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

    // native parse
    const dt = new Date(str);
    if (!isNaN(dt.getTime())) return dt.toISOString().split('T')[0];

    return null;
}

function parseQty(value: any): number {
    if (value === null || value === undefined || value === '') return 0;
    const n = typeof value === 'number' ? value : parseFloat(String(value).replace(',', '.'));
    return isNaN(n) ? 0 : n;
}

// ---------------------------------------------------------------------------
// Catalog lookup
// ---------------------------------------------------------------------------

/**
 * Build a fast lookup map from the servicePrices array.
 * Key: "RESOLVED_EQUIP|RESOLVED_SERVICE"
 * Value: ServicePrice
 * This is computed ONCE per parse call.
 */
function buildLookupMap(servicePrices: ServicePrice[]): Map<string, ServicePrice> {
    const map = new Map<string, ServicePrice>();
    for (const sp of servicePrices) {
        if (!sp.tipo_do_equipamento || !sp.tipo_do_servico) continue;
        const key = `${resolveEquip(sp.tipo_do_equipamento)}|${normalize(sp.tipo_do_servico)}`;
        if (!map.has(key)) map.set(key, sp); // keep first (RENTAL preferred since it sorts first)
    }
    return map;
}

function lookupItem(
    lookupMap: Map<string, ServicePrice>,
    equipType: string,
    serviceType: string
): ServicePrice | undefined {
    const key = `${resolveEquip(equipType)}|${normalize(serviceType)}`;
    return lookupMap.get(key);
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export async function parsePlanningExcel(
    file: File,
    cycleYear: number,
    servicePrices: ServicePrice[]
): Promise<PlanningParseResult> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target!.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array', cellDates: false });

                const sheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];

                const rows: any[][] = XLSX.utils.sheet_to_json(sheet, {
                    header: 1,
                    defval: '',
                    raw: true,
                });

                if (!rows || rows.length < 2) {
                    resolve({ assignments: [], warnings: ['Arquivo vazio ou sem dados.'], summary: { totalRows: 0, totalAssignments: 0, skippedRows: 0 } });
                    return;
                }

                const lookupMap = buildLookupMap(servicePrices);
                const warnings: string[] = [];

                // ── DIAGNOSTIC: catalog size ──────────────────────────────────
                const catalogEquipTypes = [...new Set(
                    servicePrices
                        .filter(sp => sp.tipo_do_equipamento)
                        .map(sp => sp.tipo_do_equipamento!)
                )].sort();

                warnings.push(
                    `[DIAGNÓSTICO] Catálogo carregado: ${servicePrices.length} itens, ` +
                    `${lookupMap.size} combinações equip+serviço. ` +
                    `Tipos disponíveis: ${catalogEquipTypes.join(' | ')}`
                );

                const headerRow = rows[0];
                const cols = detectColumns(headerRow) ?? DEFAULT_COLS;

                const colUsed = cols === DEFAULT_COLS ? 'POSIÇÃO FIXA (A=Frota,B=Tipo,C=KM,D=HP,E=HI,F=Data)' :
                    `cols detectadas: frota=${cols.frota} equip=${cols.equip} km=${cols.km} hp=${cols.hp} hi=${cols.hi} data=${cols.date}`;
                warnings.push(`[DIAGNÓSTICO] ${colUsed}`);

                // ── Parse data rows ───────────────────────────────────────────
                const assignmentsMap = new Map<string, PlanningAssignment>();
                const seenEquipTypes = new Set<string>();
                let totalRows = 0;
                let skippedRows = 0;

                for (let i = 1; i < rows.length; i++) {
                    const row = rows[i];
                    if (!row || row.every(cell => cell === '' || cell === null || cell === undefined)) continue;

                    totalRows++;

                    const frota = String(row[cols.frota] ?? '').trim().toUpperCase();
                    const equipType = String(row[cols.equip] ?? '').trim();
                    const qtyKm = cols.km !== undefined ? parseQty(row[cols.km]) : 0;
                    const qtyProd = cols.hp !== undefined ? parseQty(row[cols.hp]) : 0;
                    const qtyImprod = cols.hi !== undefined ? parseQty(row[cols.hi]) : 0;
                    const dateRaw = cols.date !== undefined ? row[cols.date] : '';

                    if (!frota) { skippedRows++; continue; }

                    if (!equipType) {
                        warnings.push(`Linha ${i + 1} (${frota}): Tipo de equipamento vazio — linha ignorada.`);
                        skippedRows++;
                        continue;
                    }

                    seenEquipTypes.add(equipType);

                    const dateStr = parseDate(dateRaw, cycleYear);
                    if (!dateStr) {
                        warnings.push(`Linha ${i + 1}: Data inválida para frota "${frota}" (valor: "${dateRaw}"). Linha ignorada.`);
                        skippedRows++;
                        continue;
                    }

                    const services: PlannedService[] = [];

                    if (qtyKm > 0) {
                        const sp = lookupItem(lookupMap, equipType, 'KM');
                        if (sp) services.push({ item: sp.item, producao: qtyKm });
                        else warnings.push(`Linha ${i + 1} (${frota}/${dateStr}): Sem item KM para tipo "${equipType}" [resolvido: "${resolveEquip(equipType)}"].`);
                    }
                    if (qtyProd > 0) {
                        const sp = lookupItem(lookupMap, equipType, 'Produtivo');
                        if (sp) services.push({ item: sp.item, producao: qtyProd });
                        else warnings.push(`Linha ${i + 1} (${frota}/${dateStr}): Sem item HP para tipo "${equipType}" [resolvido: "${resolveEquip(equipType)}"].`);
                    }
                    if (qtyImprod > 0) {
                        const sp = lookupItem(lookupMap, equipType, 'Improdutivo');
                        if (sp) services.push({ item: sp.item, producao: qtyImprod });
                        else warnings.push(`Linha ${i + 1} (${frota}/${dateStr}): Sem item HI para tipo "${equipType}" [resolvido: "${resolveEquip(equipType)}"].`);
                    }

                    if (services.length === 0) { skippedRows++; continue; }

                    const key = `${dateStr}-${frota}`;
                    if (assignmentsMap.has(key)) {
                        const existing = assignmentsMap.get(key)!;
                        services.forEach(s => {
                            const ex = existing.services.find(x => x.item === s.item);
                            if (ex) ex.producao += s.producao;
                            else existing.services.push(s);
                        });
                    } else {
                        assignmentsMap.set(key, {
                            id: `${key}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                            date: dateStr,
                            frota,
                            services,
                        });
                    }
                }

                // ── Post-parse diagnostic ─────────────────────────────────────
                const seenResolved = [...seenEquipTypes].map(t => `"${t}"→"${resolveEquip(t)}"`);
                warnings.push(
                    `[DIAGNÓSTICO] Tipos do Excel encontrados: ${seenResolved.join(' | ')}`
                );

                const assignments = Array.from(assignmentsMap.values());
                resolve({ assignments, warnings, summary: { totalRows, totalAssignments: assignments.length, skippedRows } });

            } catch (err) {
                reject(err);
            }
        };

        reader.onerror = () => reject(new Error('Erro ao ler o arquivo.'));
        reader.readAsArrayBuffer(file);
    });
}
