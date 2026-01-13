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

// --- SIMPLIFIED PARSER CLASS ---
export class BMParser {

    // Helper: Detect Header Row
    static looksLikeHeader(row: any[]): boolean {
        if (!Array.isArray(row)) return false;

        // Convert to safe simple text array
        const textRow = row.map(c => safeText(c));

        // Must contain "item" AND "descri..."
        // This is the anchor.
        const hasItem = textRow.some(t => t === 'item' || t.includes('item') || t === 'codigo' || t === 'cod');
        const hasDesc = textRow.some(t => t.includes('descr') || t.includes('discrim'));

        return hasItem && hasDesc;
    }

    // Main Parse Function
    static async parse(grid: any[][]): Promise<ParsedBM> {
        let items: ParsedItem[] = [];
        let warnings: string[] = [];
        let confidence = 1.0;
        let usedAI = false;
        let foundHeader = -1;

        // 1. Scan for Header (Limit to first 50 rows)
        const limit = Math.min(grid.length || 0, 50);

        for (let r = 0; r < limit; r++) {
            if (this.looksLikeHeader(grid[r])) {
                foundHeader = r;
                break;
            }
        }

        if (foundHeader !== -1) {
            // 2. Extract Items directly below header
            // "Pragmatic" Mapping:
            // Assuming standard layout based on user feedback
            // Code usually @ 0 or first non-empty
            // Desc usually @ 1 or second non-empty

            // Let's refine the indices based on the HEADER row if possible, else fallback to fixed
            const headerRow = grid[foundHeader].map(c => safeText(c));

            // Dynamic check, but default to known indices if confusing
            let colCode = headerRow.findIndex(t => t === 'item' || t === 'codigo');
            let colDesc = headerRow.findIndex(t => t.includes('descr'));

            // Fallbacks if detection slightly off but header was "found" due to loose match
            if (colCode === -1) colCode = 0; // Default
            if (colDesc === -1) colDesc = 1; // Default

            // Values are trickier. User said: 17, 20, 21. Let's try to map, else use those.
            let colVal = headerRow.findIndex(t => t.includes('valor medido') || t.includes('medicao'));
            let colBal = headerRow.findIndex(t => t.includes('saldo'));
            let colExec = headerRow.findIndex(t => t.includes('%') || t.includes('exec'));

            // Fallback to "Standard" Legacy indices if not clear
            if (colVal === -1) colVal = 17;
            if (colBal === -1) colBal = 20;
            if (colExec === -1) colExec = 21;

            // Iterate Rows
            for (let r = foundHeader + 1; r < grid.length; r++) {
                const row = grid[r];
                if (!Array.isArray(row)) continue;

                // Stop condition: Empty Code AND Description usually means end of table or page break
                // But we should tolerate a few empty lines. Let's strictly check valid items.

                const valCode = row[colCode]; // Raw value
                const valDesc = row[colDesc]; // Raw value

                // Skip completely empty lines
                if (!valCode && !valDesc) continue;

                const txtCode = safeText(valCode);
                const txtDesc = safeText(valDesc);

                // Check "Is this a line item?" 
                // Regex: Starts with digit, dots allowed (1.1, 1.2.3, 10)
                if (/^\d+(\.\d+)*$/.test(txtCode)) {

                    // Safe Access for data
                    const rawVal = Array.isArray(row) && colVal < row.length ? row[colVal] : 0;
                    const rawBal = Array.isArray(row) && colBal < row.length ? row[colBal] : 0;
                    const rawExec = Array.isArray(row) && colExec < row.length ? row[colExec] : 0;

                    items.push({
                        code: txtCode,
                        description: txtDesc || 'Sem Descrição',
                        monthValue: parseNumber(rawVal),
                        balance: parseNumber(rawBal),
                        executionPercentage: parseNumber(rawExec)
                    });
                }
            }
        } else {
            confidence = 0.4;
            warnings.push("Tabela não identificada (Cabeçalho 'Item/Descrição' não encontrado).");
        }

        // 3. AI Fallback (ONLY if extraction failed)
        if (items.length === 0) {
            console.warn("BMParser: Extraction failed. Attempting AI Fallback...");
            if (API_KEY) {
                try {
                    const aiResult = await this.parseWithAI(grid);
                    if (aiResult.items.length > 0) {
                        items = aiResult.items;
                        usedAI = true;
                        confidence = 0.8;
                        warnings.push("Itens extraídos via IA.");
                    } else {
                        warnings.push("IA não encontrou itens.");
                        confidence = 0;
                    }
                } catch (e) {
                    warnings.push("IA Falhou: " + (e as Error).message);
                }
            } else {
                warnings.push("IA não configurada.");
            }
        }

        return {
            entity: null, // Keep simple, UI can handle generic
            items,
            periodDate: null, // Keep simple
            warnings,
            confidence,
            usedAI
        };
    }

    // AI Helper (Kept for fallback)
    static async parseWithAI(grid: any[][]): Promise<ParsedBM> {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        if (!Array.isArray(grid)) return { entity: null, items: [], periodDate: null, warnings: [], confidence: 0, usedAI: true };

        // Compact CSV
        const csvContent = grid.slice(0, 100).map(row => Array.isArray(row) ? row.join('|') : '').join('\n');

        const prompt = `
            Você é um leitor de tabelas. Extraia os itens desta medição de obra.
            Colunas típicas: Item, Descrição, Valor Medido, Saldo, %.
            
            CSV:
            ${csvContent.substring(0, 20000)}

            Responda JSON:
            {
                "items": [{ "code": "1.1", "description": "Example", "monthValue": 100.00, "balance": 500.00, "executionPercentage": 10 }]
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
        }));

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
