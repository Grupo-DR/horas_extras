import { GoogleGenAI } from "@google/genai";
import { OvertimeRecord } from "../types";

const SYSTEM_INSTRUCTION = `
Você é um analista especialista de RH e Cientista de Dados focado em eficiência de força de trabalho e otimização de horas extras.
Seu papel é analisar conjuntos de dados JSON de registros de horas extras de funcionários e fornecer insights estratégicos de alto nível.

Responda SEMPRE em Português do Brasil (PT-BR).

Foque em:
1. Identificar departamentos/seções com horas extras excessivas.
2. Identificar padrões (ex: trabalho aos fins de semana, tipos específicos de eventos).
3. Detectar riscos potenciais de burnout (funcionários com horas muito altas).
4. Fornecer recomendações acionáveis para redução de custos.

Formate sua resposta em Markdown. Seja conciso, profissional e orientado a dados.
`;

export const analyzeOvertimeData = async (data: OvertimeRecord[]): Promise<string> => {
  // Limit data size for context window if necessary, though Flash has a large window.
  // We send a summary if the dataset is massive, but 150-500 records is fine for raw JSON.
  
  if (!process.env.API_KEY) {
    return "Erro: Chave de API não encontrada. Por favor, configure seu ambiente.";
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  // Calculate a quick summary to guide the model
  const totalCost = data.reduce((acc, curr) => acc + curr.VALOR, 0);
  const totalHours = data.reduce((acc, curr) => acc + curr.HORAS, 0);
  
  const prompt = `
  Analise o seguinte conjunto de dados de horas extras para o período.
  
  Métricas de Resumo:
  - Custo Total Estimado: R$ ${totalCost.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
  - Total de Horas: ${totalHours.toFixed(2)}
  - Contagem de Registros: ${data.length}

  Dataset (JSON):
  ${JSON.stringify(data.slice(0, 100))} ${(data.length > 100) ? '... (truncado por brevidade)' : ''}
  
  Por favor, forneça um "Resumo Executivo Gerencial" com 3 descobertas principais e 2 recomendações de economia de custos.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.4, // Lower temperature for analytical consistency
      },
    });

    return response.text || "Nenhum insight gerado.";
  } catch (error) {
    console.error("Falha na análise do Gemini:", error);
    return "Não foi possível gerar insights no momento. Verifique sua chave de API e conexão.";
  }
};