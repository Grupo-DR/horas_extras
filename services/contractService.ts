import { db } from './firebaseConfig';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, where, orderBy, Timestamp, arrayUnion } from 'firebase/firestore';
import { Contract, ContractMeasurement, ContractStatus } from '../types';
import { GoogleGenerativeAI } from '@google/generative-ai';

// GEMINI CONFIG
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(API_KEY || '');

// COLLECTION REF
const COLLECTION_NAME = 'contracts';

// HELPER: Sanitization Shield
const n = (v: any) => (typeof v === 'number' && !isNaN(v) ? v : 0);
const s = (v: any) => (typeof v === 'string' ? v : '');
const d = (v: any) => {
    if (!v) return null;
    if (v instanceof Timestamp) return v.toDate();
    if (v && typeof v.toDate === 'function') return v.toDate();
    if (v instanceof Date) return v;
    if (typeof v === 'string') {
        const parsed = new Date(v);
        return isNaN(parsed.getTime()) ? null : parsed;
    }
    return null;
};

// AI PARSER SERVICE
export const parseBMWithAI = async (csvContent: string) => {
    if (!API_KEY) throw new Error("Chave da API Gemini não configurada (VITE_GEMINI_API_KEY).");

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `
        Você é um assistente de engenharia civil da DR Construtora. Sua tarefa é ler o conteúdo de um CSV de medição e extrair dados estruturados em JSON.
        
        CSV BRUTO:
        ${csvContent.substring(0, 30000)} // Limit context if needed

        Retorne APENAS um objeto JSON com esta estrutura (sem markdown):
        {
            "entity": "RENTAL" | "CONSTRUTORA" (Identifique no texto),
            "period": "DD/MM/YYYY" (Data final do período identificado),
            "items": [
                {
                    "code": "string",
                    "description": "string",
                    "monthValue": number (Valor medido neste boletim/mês. Ignore colunas vazias. Se zero, use 0),
                    "balance": number (Saldo a medir),
                    "executionPercentage": number
                }
            ]
        }
        
        Regras:
        1. Ignore linhas de cabeçalho irrelevantes.
        2. O valor medido costuma estar próximo à descrição.
        3. Se encontrar 'DR RENTAL', entity = 'RENTAL'.
        4. Se encontrar 'DR CONSTRUTORA', entity = 'CONSTRUTORA'.
    `;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        // Clean markdown code blocks if present
        const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const data = JSON.parse(jsonStr);

        // Validate Date
        let periodDate: Date | null = null;
        if (data.period) {
            const [day, month, year] = data.period.split('/');
            periodDate = new Date(`${year}-${month}-${day}`);
        }

        return { ...data, periodDate };

    } catch (error: any) {
        console.error("AI Parse Error:", error);
        throw new Error("Falha no processamento inteligente: " + error.message);
    }
};

// LEGACY PARSER (Kept for fallback/reference if needed, but AI is primary now)
export const parseGoldenTemplateLegacy = (data: any[][]) => {
    // ... (Old logic can be kept or removed. Overwriting "parseGoldenTemplate" name or creating new export)
    // For now, I will rename the exported AI function to be used intentionally.
    return {};
};


// PARSER: Golden Template
export const parseGoldenTemplate = (data: any[][]) => {
    // 1. Anchor Search: Find "Contratada" in Col G (Index 6)
    // Scan first 30 rows
    let anchorRowIndex = -1;
    const searchLimit = Math.min(data.length, 30);

    for (let r = 0; r < searchLimit; r++) {
        const cell = String(data[r]?.[6] || '').trim(); // Col G -> Index 6
        if (cell === 'Contratada') {
            anchorRowIndex = r;
            break;
        }
    }

    if (anchorRowIndex === -1) {
        throw new Error("Erro: Arquivo fora do padrão DR Construtora. Palavra chave 'Contratada' não encontrada na Coluna G.");
    }

    // 2. Metadata: Found on Anchor Row + 1 (The line below "Contratada")
    const metaRowIndex = anchorRowIndex + 1;
    const metaRow = data[metaRowIndex];

    if (!metaRow) throw new Error("Erro: Arquivo incompleto (Linha de metadados não existe).");

    // Entity: Col G (Index 6) on Meta Row
    const entityCell = String(metaRow[6] || '').toUpperCase().trim();
    let entity: 'RENTAL' | 'CONSTRUTORA' | null = null;

    if (entityCell.includes('RENTAL')) entity = 'RENTAL';
    else if (entityCell.includes('CONSTRUTORA')) entity = 'CONSTRUTORA';
    else {
        throw new Error(`Entidade não identificada na célula G${metaRowIndex + 1}. Valor: "${entityCell}".`);
    }

    // Period: Col S (Index 18) on Meta Row
    const periodCell = metaRow[18];
    let periodDate: Date | null = null;

    if (periodCell && typeof periodCell === 'string') {
        const parts = periodCell.split(' a ');
        if (parts.length > 1) {
            const dateStr = parts[1].trim();
            const [day, month, year] = dateStr.split('/');
            if (day && month && year) {
                // Adjust year if 2 digits? usually 4 in system. Assuming YYYY from previous context.
                // System uses generic 'new Date' parsing usually but manual is safer here.
                periodDate = new Date(`${year}-${month}-${day}`);
                if (isNaN(periodDate.getTime())) periodDate = null;
            }
        }
    }

    // 3. Map Items: Start Anchor Row + 3
    const startDataRow = anchorRowIndex + 3;
    const items: any[] = [];

    for (let i = startDataRow; i < data.length; i++) {
        const row = data[i];

        // Validation: Ignore if Code (Col E -> Index 4) is empty
        if (!row || !row[4]) continue;

        const code = String(row[4]).trim();
        const description = String(row[6] || '').trim(); // Col G -> Index 6

        // Values
        const monthValue = typeof row[17] === 'number' ? row[17] : 0; // Col R -> Index 17
        const balance = typeof row[20] === 'number' ? row[20] : 0;    // Col U -> Index 20
        const executionPercentage = typeof row[21] === 'number' ? row[21] : 0; // Col V -> Index 21

        items.push({
            code,
            description,
            monthValue,
            balance,
            executionPercentage,
            period: periodCell
        });
    }

    return { entity, items, periodDate };
};

export const ContractService = {
    // GET ALL REAL-TIME
    getAll: async (): Promise<Contract[]> => {
        // This is a placeholder for direct fetch if needed, but we usually use onSnapshot in the component
        // Integrating the same logic here for reference or future use
        return [];
    },

    // SUBSCRIBE (Standard Pattern for this App)
    subscribe: (callback: (contracts: Contract[]) => void) => {
        const q = query(collection(db, COLLECTION_NAME), orderBy('startDate', 'desc'));

        return onSnapshot(q, (snapshot) => {
            const contracts = snapshot.docs.map(doc => {
                const data = doc.data();

                // CHECKLIST: Robust Sanitization & Timestamp Conversion
                return {
                    id: doc.id,
                    name: s(data.name),
                    siteName: s(data.siteName),
                    clientName: s(data.clientName),
                    totalValue: n(data.totalValue),
                    startDate: d(data.startDate),
                    endDate: d(data.endDate),
                    status: data.status || ContractStatus.ACTIVE,

                    // CHECKLIST: Handle Empty Arrays & Measurement Sanitization
                    measurements: Array.isArray(data.measurements)
                        ? data.measurements.map((m: any) => ({
                            id: s(m.id),
                            date: d(m.date),
                            value: n(m.value),
                            description: s(m.description),
                            entity: m.entity || undefined
                        }))
                        : [],

                    scopeItems: Array.isArray(data.scopeItems) ? data.scopeItems : [], // Map Scope Items

                    createdAt: d(data.createdAt),
                    updatedAt: d(data.updatedAt)
                } as Contract;
            });

            callback(contracts);
        });
    },

    // CREATE
    create: async (contract: Omit<Contract, 'id'>) => {
        const cleanData = {
            ...contract,
            // Ensure specific fields are primitives/Timestamps for Firestore
            startDate: Timestamp.fromDate(contract.startDate),
            endDate: Timestamp.fromDate(contract.endDate),
            measurements: [], // Start empty
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now()
        };

        // Remove undefined
        const validData = JSON.parse(JSON.stringify(cleanData));

        return await addDoc(collection(db, COLLECTION_NAME), validData);
    },

    // UPDATE
    update: async (id: string, updates: Partial<Contract>) => {
        const cleanUpdates: any = { ...updates, updatedAt: Timestamp.now() };

        if (updates.startDate) cleanUpdates.startDate = Timestamp.fromDate(updates.startDate);
        if (updates.endDate) cleanUpdates.endDate = Timestamp.fromDate(updates.endDate);

        // If updating measurements, ensure they are clean too (though usually handled by specific methods)
        if (updates.measurements) {
            cleanUpdates.measurements = updates.measurements.map(m => ({
                ...m,
                date: m.date instanceof Date ? Timestamp.fromDate(m.date) : m.date
            }));
        }

        const docRef = doc(db, COLLECTION_NAME, id);
        await updateDoc(docRef, cleanUpdates);
    },

    // DELETE
    delete: async (id: string) => {
        await deleteDoc(doc(db, COLLECTION_NAME, id));
    },

    // ADD MEASUREMENT (ATOMIC)
    addMeasurement: async (contractId: string, measurement: Omit<ContractMeasurement, 'id'>) => {
        const docRef = doc(db, COLLECTION_NAME, contractId);

        // Generate simple ID
        const newId = Math.random().toString(36).substr(2, 9);

        const newMeasurement = {
            id: newId,
            date: Timestamp.fromDate(measurement.date), // Store as Timestamp
            value: Number(measurement.value),
            description: String(measurement.description)
        };

        // ATOMIC UPDATE using arrayUnion
        await updateDoc(docRef, {
            measurements: arrayUnion(newMeasurement),
            updatedAt: Timestamp.now()
        });
    },

    // REMOVE MEASUREMENT
    removeMeasurement: async (contractId: string, measurementId: string) => {
        const docRef = doc(db, COLLECTION_NAME, contractId);

        // 1. Get current doc
        const snap = await import('firebase/firestore').then(mod => mod.getDoc(docRef));
        if (!snap.exists()) throw new Error("Contrato não encontrado");

        const data = snap.data();
        const measurements = Array.isArray(data.measurements) ? data.measurements : [];

        // 2. Filter out the specific measurement
        const updatedMeasurements = measurements.filter((m: any) => m.id !== measurementId);

        // 3. Update doc
        await updateDoc(docRef, {
            measurements: updatedMeasurements,
            updatedAt: Timestamp.now()
        });
    }
};
