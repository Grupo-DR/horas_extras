import { GoogleGenerativeAI } from '@google/generative-ai';

// --- CONFIG ---
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(API_KEY || '');

// --- TYPES ---
export interface ParsedItem {
    code: string;
    description: string;
    monthValue: number;
    balance: number;
    executionPercentage: number;
    period?: string;
}

export interface ParsedBM {
    entity: 'RENTAL' | 'CONSTRUTORA' | null;
    items: ParsedItem[];
    periodDate: Date | null;
    warnings: string[];
    confidence: number;
}

interface GridCell {
    r: number;
    c: number;
    value: any;
}

// --- UTILS ---
const normalize = (str: any) => String(str || '').toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const parseNumber = (val: any): number => {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    const s = String(val).trim();
    // PT-BR format check: 1.234,56
    if (s.includes(',') && s.includes('.')) {
        // Assume dot is thousand, comma is decimal
        return parseFloat(s.replace(/\./g, '').replace(',', '.'));
    }
    if (s.includes(',')) return parseFloat(s.replace(',', '.'));
    return parseFloat(s) || 0;
};

// --- CLASS ---
export class BMParser {

    // 1. Generic Finder
    static findLabelInGrid(grid: any[][], labels: string[]): GridCell | null {
        const normalizedLabels = labels.map(l => normalize(l));

        // Scan limited range for performance (e.g. first 50 rows)
        const maxR = Math.min(grid.length, 50);

        for (let r = 0; r < maxR; r++) {
            const row = grid[r];
            if (!row) continue;
            for (let c = 0; c < row.length; c++) {
                const cellVal = normalize(row[c]);
                if (normalizedLabels.some(l => cellVal.includes(l))) {
                    return { r, c, value: row[c] };
                }
            }
        }
        return null;
    }

    // 2. Main Parse Function
    static async parse(grid: any[][]): Promise<ParsedBM> {
        const warnings: string[] = [];
        let items: ParsedItem[] = [];
        let confidence = 1.0;
        let entity: ParsedBM['entity'] = null;
        let periodDate: Date | null = null;

        try {
            // STEP A: Detect Entity (Robust)
            const entityCell = this.findLabelInGrid(grid, ['contratada', 'fornecedor', 'prestador']);
            if (entityCell) {
                // Usually the entity name is adjacent (below or right)
                // Let's look at neighboring cells (R+1, C) or (R, C+1)
                const candidates = [
                    grid[entityCell.r + 1]?.[entityCell.c], // Below (common)
                    grid[entityCell.r]?.[entityCell.c + 1], // Right
                    grid[entityCell.r + 1]?.[6] // Fixed legacy spot?
                ];

                const foundText = candidates.map(c => String(c || '').toUpperCase()).join(' ');

                if (foundText.includes('RENTAL')) entity = 'RENTAL';
                else if (foundText.includes('CONSTRUTORA')) entity = 'CONSTRUTORA';
                else warnings.push("Entidade não identificada com certeza (assumindo visualização atual).");
            } else {
                warnings.push("Campo 'Contratada' não encontrado explicitamente.");
                confidence -= 0.1;
            }

            // STEP B: Detect Period
            const periodCell = this.findLabelInGrid(grid, ['periodo', 'competencia', 'data', 'medicao']);
            if (periodCell) {
                // Try to extract date from that row
                const rowText = grid[periodCell.r].join(' ');
                // Simple regex for DD/MM/AAAA
                const dateMatch = rowText.match(/(\d{2})\/(\d{2})\/(\d{4})/);
                if (dateMatch) {
                    periodDate = new Date(`${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`);
                }
            }

            // STEP C: Locate Table Headers
            // We look for a row containing "ITEM" AND "DESCRIÇÃO"
            let headerRowIndex = -1;
            let colMap = { item: -1, desc: -1, val: -1, bal: -1, exec: -1 };

            for (let r = 0; r < Math.min(grid.length, 50); r++) {
                const row = grid[r]?.map(c => normalize(c)) || [];

                const itemIdx = row.findIndex(c => c === 'item' || c === 'codigo' || c === 'item nº');
                const descIdx = row.findIndex(c => c.includes('descricao') || c.includes('discriminacao'));

                if (itemIdx !== -1 && descIdx !== -1) {
                    headerRowIndex = r;
                    colMap.item = itemIdx;
                    colMap.desc = descIdx;

                    // Find values relative to this
                    colMap.val = row.findIndex(c => c.includes('valor medido') || c.includes('medicao') || c === 'total');
                    colMap.bal = row.findIndex(c => c.includes('saldo'));
                    colMap.exec = row.findIndex(c => c.includes('%') || c.includes('exec'));
                    break;
                }
            }

            if (headerRowIndex === -1) {
                warnings.push("Cabeçalho da tabela não detectado via heurística.");
                confidence -= 0.5;
            } else {
                // EXTRACT ITEMS
                for (let r = headerRowIndex + 1; r < grid.length; r++) {
                    const row = grid[r];
                    if (!row) continue;

                    const code = String(row[colMap.item] || '').trim();
                    const desc = String(row[colMap.desc] || '').trim();

                    // Valid item usually has a code like 1.1 or 3.0
                    if (code && desc && /^\d+(\.\d+)*$/.test(code)) {

                        // Heuristic for values if columns not found
                        // Often values are at the end. index 17, 20, 21 in Legacy.
                        // We rely on map if found, else fallback to legacy indices if they look like numbers

                        const valIdx = colMap.val !== -1 ? colMap.val : 17;
                        const balIdx = colMap.bal !== -1 ? colMap.bal : 20;
                        const execIdx = colMap.exec !== -1 ? colMap.exec : 21;

                        items.push({
                            code,
                            description: desc,
                            monthValue: parseNumber(row[valIdx]),
                            balance: parseNumber(row[balIdx]),
                            executionPercentage: parseNumber(row[execIdx])
                        });
                    }
                }
            }

            // STEP D: AI FALLBACK check
            if (items.length === 0 || confidence < 0.6) {
                console.warn("Confidence low, attempting AI fallback...");
                if (API_KEY) {
                    try {
                        const aiResult = await this.parseWithAI(grid);
                        if (aiResult.items.length > 0) {
                            items = aiResult.items;
                            if (aiResult.entity) entity = aiResult.entity;
                            if (aiResult.periodDate) periodDate = aiResult.periodDate;
                            warnings.push("Dados extraídos via IA (verificar precisão).");
                            // Clear critical warnings since we have data
                            confidence = 0.8;
                        }
                    } catch (e) {
                        warnings.push("Falha no fallback de IA: " + (e as Error).message);
                    }
                } else {
                    warnings.push("IA não configurada para fallback.");
                }
            }

        } catch (error) {
            warnings.push("Erro interno no parser: " + (error as Error).message);
            confidence = 0;
        }

        return {
            entity,
            items,
            periodDate,
            warnings,
            confidence
        };
    }

    // 3. AI Helper (Converted from contractService)
    static async parseWithAI(grid: any[][]): Promise<ParsedBM> {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        // Compact Grid to CSV
        const csvContent = grid.slice(0, 100).map(row => row.join('|')).join('\n'); // Limit to 100 rows

        const prompt = `
            Atue como especialista em Engenharia. Analise este CSV de medição de obras.
            Extraia:
            1. Entidade ('RENTAL' ou 'CONSTRUTORA')
            2. Data/Periodo
            3. Itens (Codigo, Descricao, Valor Medido Mês, Saldo, Percentual Execucao)
            
            CSV:
            ${csvContent.substring(0, 30000)}

            Responda JSON puro:
            {
                "entity": "RENTAL" | "CONSTRUTORA",
                "period": "DD/MM/YYYY",
                "items": [{ "code": "", "description": "", "monthValue": 0, "balance": 0, "executionPercentage": 0 }]
            }
        `;

        const result = await model.generateContent(prompt);
        const text = result.response.text();
        const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const data = JSON.parse(jsonStr);

        // Map to Types
        const items = (data.items || []).map((i: any) => ({
            code: String(i.code),
            description: String(i.description),
            monthValue: parseNumber(i.monthValue),
            balance: parseNumber(i.balance),
            executionPercentage: parseNumber(i.executionPercentage)
        }));

        let periodDate = null;
        if (data.period) {
            const parts = data.period.split('/');
            if (parts.length === 3) periodDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
        }

        return {
            entity: data.entity,
            items,
            periodDate,
            warnings: [],
            confidence: 0.9
        };
    }
}
