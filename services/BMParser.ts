import { GoogleGenerativeAI } from '@google/generative-ai';
import { ContractMeasurement } from '../types';

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);

export const BMParser = {
    async parsePDF(file: File): Promise<Partial<ContractMeasurement>> {
        // 1. Converte PDF para Base64
        const base64Data = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
            reader.readAsDataURL(file);
        });

        // 2. Modelo 1.5 Flash (Foco em velocidade e extração de tabelas)
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const prompt = `
      Aja como um auditor de engenharia. Extraia os dados deste PDF de medição.
      Retorne estritamente um JSON (sem markdown) com os seguintes campos:
      - header: { date (ISO), contractNo, contractor, period, value (number), contractTotalValue (number), contractBalance (number) }
      - matrix: Array de { codeVLI, description, prevAccumulated, currentMonth, totalAccumulated, plannedContract, balance }
      
      Regra de Negócio: Se contractor contiver "RENTAL", entityType é "RENTAL", senão "CONSTRUTORA".
    `;

        try {
            const result = await model.generateContent([
                prompt,
                { inlineData: { data: base64Data, mimeType: "application/pdf" } }
            ]);

            const text = result.response.text().replace(/```json|```/g, "").trim();
            const parsed = JSON.parse(text);

            return {
                ...parsed.header,
                date: new Date(parsed.header.date),
                entityType: parsed.header.contractor.toUpperCase().includes('RENTAL') ? 'RENTAL' : 'CONSTRUTORA',
                auditMatrix: parsed.matrix,
                importedAt: new Date(),
                status: 'PROCESSADO'
            };
        } catch (error) {
            console.error("Erro Crítico no Gemini:", error);
            throw new Error("Falha na extração por IA. Verifique a qualidade do PDF.");
        }
    }
};
