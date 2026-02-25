import * as XLSX from 'xlsx';
import { PlanningAssignment, PlannedService, ServicePrice } from '../types';

/**
 * Mapping from equipment type keyword → service item codes by unit role.
 * This allows finding the correct catalog item for each equipment+unit combination.
 *
 * Strategy: search servicePrices for items that:
 *   - Match the equipment type keyword in their description
 *   - Have a specific unit (KM, H) and contain PRODUTIVA / IMPRODUTIVA in description
 */

export interface PlanningParseResult {
    assignments: PlanningAssignment[];
    warnings: string[];
    summary: {
        totalRows: number;
        totalAssignments: number;
        skippedRows: number;
    };
}

/**
 * Maps an equipment type keyword (from col B) to keywords used in service descriptions.
 * This lets us search the catalog by equipment type.
 */
const EQUIP_TYPE_KEYWORDS: Record<string, string[]> = {
    'RETROESCAVADEIRA': ['RETROESCAVADEIRA'],
    'RETROESCAVADEIRA LEVE': ['RETROESCAVADEIRA'],
    'PA CARREGADEIRA': ['PA CARREGADEIRA', 'PA CARREGAD'],
    'CAMINHÃO BASCULANTE': ['CAMINHÃO BASCULANTE', 'CAMINHAO BASCULANTE'],
    'CAMINHAO BASCULANTE': ['CAMINHÃO BASCULANTE', 'CAMINHAO BASCULANTE'],
    'CAMINHÃO PIPA': ['CAMINHÃO PIPA', 'CAMINHAO PIPA'],
    'CAMINHAO PIPA': ['CAMINHÃO PIPA', 'CAMINHAO PIPA'],
    'MOTONIVELADORA': ['MOTONIVELADORA'],
    'TRATOR ESTEIRA': ['TRATOR ESTEIRA'],
    'CARRETA PRANCHA': ['CARRETA PRANCHA'],
    'MINIESCAVADEIRA': ['MINIESCAVADEIRA'],
    'ESCAVADEIRA HIDRAULICA': ['ESCAVADEIRA HIDRAULICA'],
    'ESCAVADEIRA HIDRÁULICA': ['ESCAVADEIRA HIDRAULICA'],
    'ROLO COMPACTADOR': ['ROLO COMPACTADOR'],
};

/** Normalize text: remove accents, uppercase, trim */
function normalize(text: string): string {
    return text
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .trim();
}

/** Find catalog items matching an equipment type and unit role */
function findCatalogItem(
    servicePrices: ServicePrice[],
    equipTypeRaw: string,
    role: 'KM' | 'PRODUTIVA' | 'IMPRODUTIVA'
): ServicePrice | undefined {
    const equipNorm = normalize(equipTypeRaw);

    // Find matching keyword list
    const keywordList = EQUIP_TYPE_KEYWORDS[equipNorm] ?? [equipNorm];

    return servicePrices.find(sp => {
        const descNorm = normalize(sp.descricao);
        const unidadeNorm = normalize(sp.unidade);

        // Equipment type must match
        const typeMatches = keywordList.some(kw => descNorm.includes(normalize(kw)));
        if (!typeMatches) return false;

        if (role === 'KM') {
            return unidadeNorm === 'KM';
        }
        if (role === 'PRODUTIVA') {
            return unidadeNorm === 'H' && descNorm.includes('PRODUTIVA') && !descNorm.includes('IMPRODUTIVA');
        }
        if (role === 'IMPRODUTIVA') {
            return unidadeNorm === 'H' && descNorm.includes('IMPRODUTIVA');
        }
        return false;
    });
}

/**
 * Parse a date value from Excel.
 * Handles:
 *  - Excel serial numbers (numeric)
 *  - Strings like "21/01", "21/01/2026", "2026-01-21"
 * Returns ISO string "YYYY-MM-DD" or null if unparseable.
 */
function parseDate(value: any, cycleYear: number): string | null {
    if (value === null || value === undefined || value === '') return null;

    // Excel serial date number
    if (typeof value === 'number') {
        const date = XLSX.SSF.parse_date_code(value);
        if (date) {
            const y = date.y || cycleYear;
            const m = String(date.m).padStart(2, '0');
            const d = String(date.d).padStart(2, '0');
            return `${y}-${m}-${d}`;
        }
        return null;
    }

    const str = String(value).trim();

    // Format DD/MM/YYYY
    const ddmmyyyy = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (ddmmyyyy) {
        const [, d, m, y] = ddmmyyyy;
        return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }

    // Format DD/MM (uses cycleYear as reference)
    const ddmm = str.match(/^(\d{1,2})\/(\d{1,2})$/);
    if (ddmm) {
        const [, d, m] = ddmm;
        return `${cycleYear}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }

    // Format YYYY-MM-DD
    const iso = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (iso) return str;

    // Try native Date parse as last resort
    const dt = new Date(str);
    if (!isNaN(dt.getTime())) {
        return dt.toISOString().split('T')[0];
    }

    return null;
}

/** Parse quantity value, returning 0 if invalid/empty */
function parseQty(value: any): number {
    if (value === null || value === undefined || value === '') return 0;
    const n = typeof value === 'number' ? value : parseFloat(String(value).replace(',', '.'));
    return isNaN(n) ? 0 : n;
}

/**
 * Main parser.
 *
 * Excel structure expected:
 *   Row 1: Header (ignored or used for validation)
 *   Row 2+: Data rows with:
 *     Col A (0): Frota name
 *     Col B (1): Equipment type
 *     Col C (2): KM production
 *     Col D (3): Productive hours
 *     Col E (4): Unproductive hours
 *     Col F (5): Date of service
 *     Col G (6): Day of week (optional, ignored)
 *
 * @param file       - The uploaded File object
 * @param cycleYear  - Year to use when dates have no year (e.g., "21/02")
 * @param servicePrices - Catalog of service prices to match items
 */
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

                // Use first sheet
                const sheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];

                // Convert to array of arrays
                const rows: any[][] = XLSX.utils.sheet_to_json(sheet, {
                    header: 1,
                    defval: '',
                    raw: true,
                });

                const warnings: string[] = [];
                const assignmentsMap = new Map<string, PlanningAssignment>();

                let totalRows = 0;
                let skippedRows = 0;

                // Skip header row (index 0)
                for (let i = 1; i < rows.length; i++) {
                    const row = rows[i];

                    // Skip completely empty rows
                    if (!row || row.every(cell => cell === '' || cell === null || cell === undefined)) {
                        continue;
                    }

                    totalRows++;

                    const frota = String(row[0] ?? '').trim().toUpperCase();
                    const equipType = String(row[1] ?? '').trim();
                    const qtyKm = parseQty(row[2]);
                    const qtyProd = parseQty(row[3]);
                    const qtyImprod = parseQty(row[4]);
                    const dateRaw = row[5];

                    if (!frota) {
                        warnings.push(`Linha ${i + 1}: Frota vazia, linha ignorada.`);
                        skippedRows++;
                        continue;
                    }

                    const dateStr = parseDate(dateRaw, cycleYear);
                    if (!dateStr) {
                        warnings.push(`Linha ${i + 1}: Data inválida para frota "${frota}" (valor: "${dateRaw}"). Linha ignorada.`);
                        skippedRows++;
                        continue;
                    }

                    // Build services for this row
                    const services: PlannedService[] = [];

                    if (qtyKm > 0) {
                        const catItem = findCatalogItem(servicePrices, equipType, 'KM');
                        if (catItem) {
                            services.push({ item: catItem.item, producao: qtyKm });
                        } else {
                            warnings.push(`Linha ${i + 1} (${frota} / ${dateStr}): Nenhum item KM encontrado no catálogo para tipo "${equipType}".`);
                        }
                    }

                    if (qtyProd > 0) {
                        const catItem = findCatalogItem(servicePrices, equipType, 'PRODUTIVA');
                        if (catItem) {
                            services.push({ item: catItem.item, producao: qtyProd });
                        } else {
                            warnings.push(`Linha ${i + 1} (${frota} / ${dateStr}): Nenhum item de Hora Produtiva encontrado para tipo "${equipType}".`);
                        }
                    }

                    if (qtyImprod > 0) {
                        const catItem = findCatalogItem(servicePrices, equipType, 'IMPRODUTIVA');
                        if (catItem) {
                            services.push({ item: catItem.item, producao: qtyImprod });
                        } else {
                            warnings.push(`Linha ${i + 1} (${frota} / ${dateStr}): Nenhum item de Hora Improdutiva encontrado para tipo "${equipType}".`);
                        }
                    }

                    // Skip rows where nothing was produced
                    if (services.length === 0) {
                        // Only warn if there was some quantity in the row
                        if (qtyKm > 0 || qtyProd > 0 || qtyImprod > 0) {
                            warnings.push(`Linha ${i + 1} (${frota} / ${dateStr}): Quantidades presentes mas nenhum serviço foi mapeado. Verifique o tipo "${equipType}".`);
                        }
                        skippedRows++;
                        continue;
                    }

                    // Group by frota+date (merge services if same frota+date appears in multiple rows)
                    const key = `${dateStr}-${frota}`;
                    if (assignmentsMap.has(key)) {
                        const existing = assignmentsMap.get(key)!;
                        // Merge services: accumulate production for same item
                        services.forEach(newSvc => {
                            const existingSvc = existing.services.find(s => s.item === newSvc.item);
                            if (existingSvc) {
                                existingSvc.producao += newSvc.producao;
                            } else {
                                existing.services.push(newSvc);
                            }
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

                const assignments = Array.from(assignmentsMap.values());

                resolve({
                    assignments,
                    warnings,
                    summary: {
                        totalRows,
                        totalAssignments: assignments.length,
                        skippedRows,
                    },
                });
            } catch (err) {
                reject(err);
            }
        };

        reader.onerror = () => reject(new Error('Erro ao ler o arquivo.'));
        reader.readAsArrayBuffer(file);
    });
}
