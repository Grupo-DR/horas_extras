import { GoogleGenerativeAI } from '@google/generative-ai';
import { ContractMeasurement, ScopeAuditItem } from '../types';

// --- CONFIG ---
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(API_KEY || '');

// --- TYPES ---
interface AIResponse {
    data: string; // ISO Date YYYY-MM-DD
    contrato_no: string;
    contratada: string;
    periodo: string; // "01/01/2024 a 31/01/2024"
    valor_medicao: number;
    valor_contratual: number;
    saldo_contratual: number;
    items: {
        codigo_vli: string;
        descricao: string;
        acumulado_anterior: number;
        do_mes: number;
        total_acumulado: number;
        previsto_contrato: number;
        saldo_item: number;
        warning?: string; // AI generated warning
    }[];
}

export class BMParser {

    /**
     * Converts a File object to a Base64 string for the Gemini API.
     */
    private static async fileToGenerativePart(file: File): Promise<{ inlineData: { data: string; mimeType: string } }> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const result = reader.result as string;
                const base64Data = result.split(',')[1];
                resolve({
                    inlineData: {
                        data: base64Data,
                        mimeType: file.type,
                    },
                });
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    /**
     * Parses a PDF measurement file using Gemini 1.5 Flash with strict Auditor Guardrails.
     */
    static async parse(file: File): Promise<Partial<ContractMeasurement>> {
        if (!API_KEY) {
            throw new Error("API Key do Gemini não configurada.");
        }

        try {
            const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
            const pdfPart = await this.fileToGenerativePart(file);

            // --- 1. THE BRAIN: SYSTEM PROMPT ---
            const prompt = `
                Aja como um Auditor de Medições com 20 anos de experiência em contratos de infraestrutura (VLI/Logística).
                Sua tarefa é extrair dados de um Boletim de Medição (PDF) com precisão absoluta.

                DIRETRIZES DE AUDITORIA:
                1. **Precisão Numérica**: Ignore símbolos de moeda (R$, $, BRL). Use ponto decimal (.). JAMAIS arredonde valores. Extraia exatamente o que está escrito.
                2. **Regra de Ouro Matemática**: Para cada item, verifique se 'total_acumulado' == 'acumulado_anterior' + 'do_mes'. Se o PDF apresentar um valor diferente, extraia o valor do PDF mas adicione uma flag no campo 'warning': "Inconsistência matemática detectada pelo Auditor".
                3. **Datas**: Padronize todas as datas para ISO 8601 (YYYY-MM-DD).
                4. **Códigos**: O 'codigo_vli' é crítico. Extraia com exatidão (ex: '2.1.3'). Se não houver, tente inferir pelo contexto ou deixe null.

                CLASSIFICAÇÃO DE ENTIDADE:
                Não tente inventar. Extraia o nome exato da Contratada.

                FORMATO DE SAÍDA (JSON ESTRITO):
                {
                    "data": "YYYY-MM-DD",
                    "contrato_no": "string",
                    "contratada": "string",
                    "periodo": "string",
                    "valor_medicao": number, // Valor TOTAL Líquido/Bruto desta medição
                    "valor_contratual": number,
                    "saldo_contratual": number,
                    "items": [
                        {
                            "codigo_vli": "string",
                            "descricao": "string",
                            "acumulado_anterior": number,
                            "do_mes": number,
                            "total_acumulado": number,
                            "previsto_contrato": number,
                            "saldo_item": number,
                            "warning": "string | null"
                        }
                    ]
                }
            `;

            console.time("Gemini Execution");
            const result = await model.generateContent([prompt, pdfPart]);
            console.timeEnd("Gemini Execution");

            const response = result.response;
            const text = response.text();

            // Log Token Usage for Cost Monitoring
            if (response.usageMetadata) {
                console.log(`[BMParser] Token Usage - Prompt: ${response.usageMetadata.promptTokenCount}, Response: ${response.usageMetadata.candidatesTokenCount}`);
            }

            // --- 2. SANITIZATION ---
            const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();

            let data: AIResponse;
            try {
                data = JSON.parse(cleanJson);
            } catch (jsonError) {
                console.error("Failed to parse Gemini JSON. Raw text:", text);
                throw new Error("A IA retornou um formato inválido. O documento pode estar ilegível ou corrompido.");
            }

            // --- 3. ENTITY CLASSIFICATION GUARDRAILS ---
            let entityType: 'RENTAL' | 'CONSTRUTORA' | undefined = undefined; // Default strict undefined
            const contratadaUpper = (data.contratada || '').toUpperCase();

            if (contratadaUpper.match(/RENTAL|LOCAÇÃO|LOCACAO|EQUIPAMENTOS/)) {
                entityType = 'RENTAL';
            } else if (contratadaUpper.match(/CONSTRUTORA|ENGENHARIA|OBRAS|CIVIL/)) {
                entityType = 'CONSTRUTORA';
            }
            // If ambiguous, it remains undefined (consumer can default to CONSTRUTORA or ask user)
            if (!entityType) entityType = 'CONSTRUTORA'; // Fallback per requirements, but logged

            // --- 4. DATA MAPPING & LOGIC ---
            const auditMatrix: ScopeAuditItem[] = [];
            let totalItemsCurrentMonth = 0;
            const warnings: string[] = [];

            // Process Items
            (data.items || []).forEach(item => {
                // Parse Numbers Safely
                const doMes = Number(item.do_mes) || 0;

                // Accumulate Checksum
                totalItemsCurrentMonth += doMes;

                // Push to Matrix
                auditMatrix.push({
                    codeVLI: item.codigo_vli || 'N/A',
                    description: item.descricao || 'Item sem descrição',
                    prevAccumulated: Number(item.acumulado_anterior) || 0,
                    currentMonth: doMes,
                    totalAccumulated: Number(item.total_acumulado) || 0,
                    plannedContract: Number(item.previsto_contrato) || 0,
                    balance: Number(item.saldo_item) || 0
                });

                // Capture AI warnings (Math inconsistencies found by LLM)
                if (item.warning) {
                    warnings.push(`Item ${item.codigo_vli}: ${item.warning}`);
                }
            });

            // --- 5. FINANCIAL CHECKSUM (POST-PROCESSING) ---
            const headerValue = Number(data.valor_medicao) || 0;
            const drift = Math.abs(headerValue - totalItemsCurrentMonth);

            // Tolerance of 0.01 (1 cent)
            if (drift > 0.01) {
                const msg = `Divergência Financeira Crítica: Soma dos itens (R$ ${totalItemsCurrentMonth.toFixed(2)}) difere do total do cabeçalho (R$ ${headerValue.toFixed(2)}).`;
                warnings.push(msg);
                console.warn(`[BMParser] ${msg}`);
            }

            // --- 6. FINAL OBJECT CONSTRUCTION ---
            const resultObj: Partial<ContractMeasurement> = {
                period: data.periodo || new Date().toISOString().substring(0, 7),
                date: data.data ? new Date(data.data) : new Date(),
                contractorName: data.contratada,
                contractNo: data.contrato_no,
                entityType: entityType,

                contractTotalValue: Number(data.valor_contratual) || 0,
                measurementValue: headerValue, // Trust header, but warnings exist if mismatches
                contractBalance: Number(data.saldo_contratual) || 0,

                accumulatedValue: (Number(data.valor_contratual) - Number(data.saldo_contratual)) || 0, // Infer extracted accumulated

                description: `Medição ${data.periodo || ''}`,
                sourceFileName: file.name,
                importedAt: new Date(),
                confidence: warnings.length > 0 ? 0.8 : 1.0, // Downgrade confidence on warnings
                warnings: warnings,
                auditMatrix: auditMatrix
            };

            return resultObj;

        } catch (error: any) {
            console.error("BMParser Critical Error:", error);
            // Enhance error message for UI
            if (error.message.includes("SAFETY")) {
                throw new Error("O documento foi bloqueado pelos filtros de segurança da IA.");
            }
            throw new Error(`Erro na extração: ${error.message}`);
        }
    }
}
