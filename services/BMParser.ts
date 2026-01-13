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
    usedAI: boolean;
}

// --- UTILS ---
const safeText = (value: any): string => {
    return String(value ?? '')
        .normalize('NFD') // Remove accents
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
};

const parseNumber = (val: any): number => {
    if (val === null || val === undefined) return 0;
    if (typeof val === 'number') return val;

    const s = String(val).trim();
    if (!s) return 0;

    // PT-BR format check: 1.234,56
    if (s.includes(',') && s.includes('.')) {
        return parseFloat(s.replace(/\./g, '').replace(',', '.'));
    }
    if (s.includes(',')) return parseFloat(s.replace(',', '.'));
    return parseFloat(s) || 0;
};

// --- PATTERN-BASED PARSER CLASS ---
export class BMParser {

    /**
     * Checks if a row looks like a valid line item based on content pattern.
     * Criteria:
     * 1. Col 0 matches Item Code Regex (1.1, 1.2.3, etc)
     * 2. Col 1 has text length > 5 (Description)
     * 3. At least one valid number in typical value columns (optional but good for strictness)
     */
    static looksLikeItem(row: any[]): boolean {
        if (!Array.isArray(row)) return false;

        const valCode = safeText(row[0]);
        const valDesc = safeText(row[1]);

        // 1. Code Pattern
        if (!/^\d+(\.\d+)*$/.test(valCode)) return false;

        // 2. Description Pattern
        if (valDesc.length <= 5) return false;

        return true;
    }

    // Main Parse Function
    static async parse(grid: any[][]): Promise<ParsedBM> {
        let items: ParsedItem[] = [];
        let warnings: string[] = [];
        let confidence = 1.0;
        let usedAI = false;
        let tableStartIndex = -1;

        // 1. Detect Table Start via Pattern Streak
        // We look for 3 consecutive rows that satisfy looksLikeItem

        const limit = Math.min(grid.length || 0, 100);

        for (let r = 0; r < limit - 2; r++) {
            const r1 = grid[r];
            const r2 = grid[r + 1];
            const r3 = grid[r + 2];

            if (this.looksLikeItem(r1) && this.looksLikeItem(r2) && this.looksLikeItem(r3)) {
                tableStartIndex = r; // Found the first line of the table
                break;
            }
        }

        if (tableStartIndex !== -1) {
            // 2. Extract Items starting from detected index
            // Assuming fixed columns based on "Known Standard" since headers are unreliable
            const colCode = 0;
            const colDesc = 1;
            const colVal = 17;
            const colBal = 20;
            const colExec = 21;

            for (let r = tableStartIndex; r < grid.length; r++) {
                const row = grid[r];
                if (!Array.isArray(row)) continue;

                const valCode = row[colCode];
                const valDesc = row[colDesc];

                // Stop condition: Pattern Break
                // If a line completely deviates (e.g. empty code, short desc) it might be a subtotal or footer.
                // However, be tolerant of ONE odd line? No, user wants simple "Read until break".

                if (!this.looksLikeItem(row)) {
                    // Check if it's just a slight deviation or end of table
                    // Use loose check: if code is empty, break.
                    if (!safeText(valCode)) break;
                }

                const txtCode = safeText(valCode);
                const txtDesc = safeText(valDesc);

                if (/^\d+(\.\d+)*$/.test(txtCode)) {
                    // Safe Access for data
                    const getVal = (idx: number) => (idx < row.length ? row[idx] : 0);

                    items.push({
                        code: txtCode,
                        description: txtDesc || 'Sem Descrição',
                        monthValue: parseNumber(getVal(colVal)),
                        balance: parseNumber(getVal(colBal)),
                        executionPercentage: parseNumber(getVal(colExec))
                    });
                }
            }
        } else {
            confidence = 0.2;
            warnings.push("Tabela não identificada (Padrão visual de itens não encontrado).");
        }

        // 3. AI Fallback (ONLY if zero items)
        if (items.length === 0) {
            console.warn("BMParser: Zero items found. Attempting AI Fallback...");

            if (API_KEY) {
                try {
                    const aiResult = await this.parseWithAI(grid);
                    if (aiResult.items.length > 0) {
                        items = aiResult.items;
                        usedAI = true;
                        confidence = 0.7; // AI is fallback, so confidence is medium
                        warnings.push("Itens extraídos via IA (verificar precisão).");
                    } else {
                        warnings.push("IA não encontrou itens válidos.");
                        confidence = 0; // Fail
                    }
                } catch (e) {
                    // Catch 404/Quota/etc WITHOUT THROWING
                    const msg = (e as Error).message || 'Erro desconhecido';
                    warnings.push(`Falha na IA: ${msg}`);
                    confidence = 0;
                }
            } else {
                warnings.push("IA não configurada (API Key ausente).");
            }
        }

        return {
            entity: null,
            items,
            periodDate: null,
            warnings,
            confidence,
            usedAI
        };
    }

    // AI Helper
    static async parseWithAI(grid: any[][]): Promise<ParsedBM> {
        // Use 'gemini-pro' which is standard stable model, flash might be causing 404s for some keys
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });

        if (!Array.isArray(grid)) return { entity: null, items: [], periodDate: null, warnings: [], confidence: 0, usedAI: true };

        // Compact CSV
        const csvContent = grid.slice(0, 100).map(row => Array.isArray(row) ? row.join('|') : '').join('\n');

        const prompt = `
            Aja como um engenheiro analisando uma planilha de medição.
            Identifique a tabela de itens e extraia os dados.
            
            Colunas importantes (aproximadas):
            - Código (Ex: 1.1, 2.3.4)
            - Descrição
            - Valor Medido (Dinheiro)
            - Saldo (Dinheiro)
            - % Execução
            
            CSV:
            ${csvContent.substring(0, 25000)}

            Retorne APENAS JSON:
            {
                "items": [{ "code": "1.1", "description": "...", "monthValue": 0, "balance": 0, "executionPercentage": 0 }]
            }
        `;

        const result = await model.generateContent(prompt);
        const text = result.response.text();
        const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const data = JSON.parse(jsonStr);

        const items = (data.items || []).map((i: any) => ({
            code: safeText(i.code),
            description: safeText(i.description),
            monthValue: parseNumber(i.monthValue),
            balance: parseNumber(i.balance),
            executionPercentage: parseNumber(i.executionPercentage)
        })).filter((i: ParsedItem) => i.code && i.code !== 'null');

        return {
            entity: null,
            items,
            periodDate: null,
            warnings: [],
            confidence: 0.8,
            usedAI: true
        };
    }
}
