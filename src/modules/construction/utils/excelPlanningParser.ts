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

/** Normalize text: remove accents, uppercase, trim, collapse internal spaces */
function normalize(text: string): string {
    return text
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Aliases: maps any variant name that might appear in the Excel file
 * (after normalization) to the canonical catalog `tipo_do_equipamento`
 * value (also normalized).
 *
 * Normalizedform → canonical catalog value (normalized)
 */
const EQUIPMENT_ALIASES: Record<string, string> = {
    // Retroescavadeira variants
    'RETRO ESCAVADEIRA': 'RETROESCAVADEIRA',
    'RETROESCAVADEIRA': 'RETROESCAVADEIRA',
    'RETROESCAVADEIRA LEVE': 'RETROESCAVADEIRA',
    'RETRO': 'RETROESCAVADEIRA',

    // Mini escavadeira variants
    'MINI ESCAVADEIRA': 'MINIESCAVADEIRA',
    'MINIESCAVADEIRA': 'MINIESCAVADEIRA',
    'MINI-ESCAVADEIRA': 'MINIESCAVADEIRA',

    // Escavadeira hidráulica variants
    'ESCAVADEIRA HIDRAULICA': 'ESCAVADEIRA HIDRAULICA',
    'ESCAVADEIRA': 'ESCAVADEIRA HIDRAULICA',
    'EH': 'ESCAVADEIRA HIDRAULICA',

    // Caminhão basculante variants
    'CAMINHAO BASCULANTE': 'CAMINHAO BASCULANTE',
    'CAMINHAO': 'CAMINHAO BASCULANTE',
    'BASCULANTE': 'CAMINHAO BASCULANTE',

    // Pá carregadeira variants
    'PA CARREGADEIRA': 'PA CARREGADEIRA',
    'CARREGADEIRA': 'PA CARREGADEIRA',

    // Motoniveladora variants
    'MOTONIVELADORA': 'MOTONIVELADORA',
    'MOTO NIVELADORA': 'MOTONIVELADORA',

    // Carreta prancha variants
    'CARRETA PRANCHA': 'CARRETA PRANCHA',
    'PRANCHA': 'CARRETA PRANCHA',

    // Trator de esteira variants
    'TRATOR ESTEIRA': 'TRATOR DE ESTEIRA',
    'TRATOR DE ESTEIRA': 'TRATOR DE ESTEIRA',

    // Rolo compactador variants
    'ROLO COMPACTADOR': 'ROLO COMPACTADOR',
    'ROLO': 'ROLO COMPACTADOR',

    // Veículo leve variants
    'VEICULO LEVE': 'VEICULO LEVE',
    'VEICULO': 'VEICULO LEVE',

    // Caminhão pipa variants
    'CAMINHAO PIPA': 'CAMINHAO PIPA',
    'PIPA': 'CAMINHAO PIPA',
};

/**
 * Resolve the Excel equipment type string to a canonical normalized form,
 * using the alias dictionary when available.
 */
function resolveEquipType(rawEquipType: string): string {
    const norm = normalize(rawEquipType);
    return EQUIPMENT_ALIASES[norm] ?? norm;
}

/**
 * Find a catalog item by tipo_do_equipamento + tipo_do_servico.
 * Applies alias resolution before comparing so Excel variants map correctly.
 */
function findCatalogItem(
    servicePrices: ServicePrice[],
    equipType: string,
    serviceType: 'Produtivo' | 'Improdutivo' | 'KM'
): ServicePrice | undefined {
    const resolvedEquip = resolveEquipType(equipType);
    const normType = normalize(serviceType);

    const foundItem = servicePrices.find(sp =>
        resolveEquipType(sp.tipo_do_equipamento ?? '') === resolvedEquip &&
        normalize(sp.tipo_do_servico ?? '') === normType
    );

    if (!foundItem) {
        console.debug(`Catalog mismatch: Could not find service for equipType="${equipType}" (resolved to "${resolvedEquip}") and serviceType="${serviceType}" (normalized to "${normType}")`);
    }

    return foundItem;
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
    if (str.match(/^(\d{4})-(\d{2})-(\d{2})$/)) return str;

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
 * Main parser — Excel structure:
 *   Row 1:  Header (ignored)
 *   Row 2+: Data rows:
 *     Col A (0): Frota name
 *     Col B (1): Equipment type (must match tipo_do_equipamento in catalog)
 *     Col C (2): KM production
 *     Col D (3): Productive hours
 *     Col E (4): Unproductive hours
 *     Col F (5): Date of service
 *     Col G (6): Day of week (optional, ignored)
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

                const sheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];

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

                    if (!equipType) {
                        warnings.push(`Linha ${i + 1} (${frota}): Tipo de equipamento vazio — impossível mapear serviços. Linha ignorada.`);
                        skippedRows++;
                        continue;
                    }

                    const dateStr = parseDate(dateRaw, cycleYear);
                    if (!dateStr) {
                        warnings.push(`Linha ${i + 1}: Data inválida para frota "${frota}" (valor: "${dateRaw}"). Linha ignorada.`);
                        skippedRows++;
                        continue;
                    }

                    // Build services for this row using EXACT lookup by tipo_do_equipamento + tipo_do_servico
                    const services: PlannedService[] = [];

                    if (qtyKm > 0) {
                        const catItem = findCatalogItem(servicePrices, equipType, 'KM');
                        if (catItem) {
                            services.push({ item: catItem.item, producao: qtyKm });
                        } else {
                            warnings.push(`Linha ${i + 1} (${frota} / ${dateStr}): Sem item KM no catálogo para tipo "${equipType}".`);
                        }
                    }

                    if (qtyProd > 0) {
                        const catItem = findCatalogItem(servicePrices, equipType, 'Produtivo');
                        if (catItem) {
                            services.push({ item: catItem.item, producao: qtyProd });
                        } else {
                            warnings.push(`Linha ${i + 1} (${frota} / ${dateStr}): Sem item Hora Produtiva no catálogo para tipo "${equipType}".`);
                        }
                    }

                    if (qtyImprod > 0) {
                        const catItem = findCatalogItem(servicePrices, equipType, 'Improdutivo');
                        if (catItem) {
                            services.push({ item: catItem.item, producao: qtyImprod });
                        } else {
                            warnings.push(`Linha ${i + 1} (${frota} / ${dateStr}): Sem item Hora Improdutiva no catálogo para tipo "${equipType}".`);
                        }
                    }

                    if (services.length === 0) {
                        if (qtyKm > 0 || qtyProd > 0 || qtyImprod > 0) {
                            warnings.push(`Linha ${i + 1} (${frota} / ${dateStr}): Quantidades presentes mas nenhum serviço mapeado para "${equipType}".`);
                        }
                        skippedRows++;
                        continue;
                    }

                    // Group by frota+date (merge if same combo appears multiple times)
                    const key = `${dateStr}-${frota}`;
                    if (assignmentsMap.has(key)) {
                        const existing = assignmentsMap.get(key)!;
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
