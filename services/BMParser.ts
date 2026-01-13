import { GoogleGenerativeAI } from '@google/generative-ai';
import { ContractMeasurement } from '../types';

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);

// Fallback list of models to try in case of 404/Quota errors
const MODEL_CANDIDATES = [
    "gemini-2.5-flash",
    "gemini-2.5-pro",
    "gemini-2.0-flash",
    "gemini-2.0-flash-001",
    "gemini-flash-latest"
];

async function getGenerativeModelWithFallback(genAI: GoogleGenerativeAI) {
    let lastErr: any = null;
    for (const modelName of MODEL_CANDIDATES) {
        try {
            const model = genAI.getGenerativeModel({ model: modelName });
            // Lightweight check to ensure model exists (optional, but good for fail-fast)
            // For now, we trust the generateContent call will fail if model is 404
            return { model, modelName };
        } catch (e) {
            lastErr = e;
            console.warn(`Model ${modelName} failed initialization:`, e);
        }
    }
    throw lastErr || new Error("Nenhum modelo Gemini disponível.");
}

export const BMParser = {
    async parsePDF(file: File): Promise<Partial<ContractMeasurement>> {
        // 1. Converte PDF para Base64
        const base64Data = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
            reader.readAsDataURL(file);
        });

        // 2. Modelo com Fallback Strategy
        let model;
        let activeModelName;

        // Loop manual de tentativa de execução (Fallbacks on execution)
        let lastError;

        for (const modelName of MODEL_CANDIDATES) {
            try {
                console.log(`Tentando modelo: ${modelName}`);
                const currentModel = genAI.getGenerativeModel({ model: modelName });

                const prompt = `
                  Aja como um auditor de engenharia. Extraia os dados deste PDF de medição.
                  Retorne estritamente um JSON (sem markdown) com os seguintes campos:
                  - header: { date (ISO), contractNo, contractor, period, value (number), contractTotalValue (number), contractBalance (number) }
                  - matrix: Array de { codeVLI, description, prevAccumulated, currentMonth, totalAccumulated, plannedContract, balance }
                  
                  Regra de Negócio: Se contractor contiver "RENTAL", entityType é "RENTAL", senão "CONSTRUTORA".
                `;

                const result = await currentModel.generateContent([
                    prompt,
                    { inlineData: { data: base64Data, mimeType: "application/pdf" } }
                ]);

                const text = result.response.text().replace(/```json|```/g, "").trim();
                const parsed = JSON.parse(text);

                return {
                    ...parsed.header,
                    date: new Date(parsed.header.date),
                    entityType: parsed.header.contractor && parsed.header.contractor.toUpperCase().includes('RENTAL') ? 'RENTAL' : 'CONSTRUTORA',
                    auditMatrix: parsed.matrix,
                    importedAt: new Date(),
                    status: 'PROCESSADO'
                };

            } catch (error: any) {
                console.warn(`Falha no modelo ${modelName}:`, error.message);
                const msg = error.message || "";
                // If it's a 404 or Not Found, strictly continue. 
                // If it's a content error (parsing), maybe we should stop? 
                // Let's assume robustness: try next model.
                lastError = error;
                if (msg.includes("404") || msg.includes("not found")) {
                    continue;
                }
                // For other errors (like Quota), we might also want to try others if different tiers apply, 
                // bu usually Quota is per project. Let's try anyway.
            }
        }

        console.error("Todas as tentativas de modelo falharam.", lastError);
        throw new Error("Falha na extração por IA após tentativas com múltiplos modelos. Verifique API Key.");
    }
};
