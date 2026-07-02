import { GoogleGenAI, Schema, Type } from "@google/genai";
import { CompactSummary } from "../analytics/types/analyticsTypes";

const getAIClient = () => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || (process as any).env?.GEMINI_API_KEY || (process as any).env?.API_KEY;
  if (!apiKey || apiKey === 'undefined' || apiKey === 'null') {
    throw new Error("API Key do Gemini não encontrada ou inválida. Verifique o seu arquivo .env.");
  }
  return new GoogleGenAI({ apiKey });
};

/**
 * Solicita ao Gemini a geração de uma Análise Executiva baseada nos dados enviados.
 */
export const generateExecutiveAnalysis = async (summary: CompactSummary): Promise<string> => {
  const ai = getAIClient();

  const prompt = `
Você é um engenheiro de software sênior especialista em análise de custos e inteligência contratual de obras civis.
Seu objetivo é gerar um RELATÓRIO DE ANÁLISE EXECUTIVA para a diretoria, baseado ÚNICA E EXCLUSIVAMENTE nos dados em JSON abaixo.

REGRAS ESTABELECIDAS:
1. NÃO invente dados, números ou fatos. Use estritamente o JSON fornecido.
2. Não realize cálculos financeiros complexos que não estejam no JSON. Apenas cite as margens e desvios informados.
3. Use tom formal, objetivo e técnico.
4. Estruture a resposta em Markdown com seções claras: 
   - Visão Geral do Período
   - Desempenho Financeiro e Margens
   - Produtividade Operacional
   - Riscos e Alertas (Se houver Validation Warnings)
5. Separe claramente o que é "risco e ineficiência da contratada" do que é "potencial pleito/desvio externo".
6. Se algum dado for 0 ou vazio, não tente deduzir, apenas informe que não houve registro.

DADOS CONSOLIDADOS (JSON):
${JSON.stringify(summary, null, 2)}
`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }]
        }
      ],
      config: {
        temperature: 0.1, // Baixa criatividade para garantir precisão
      }
    });

    if (!response.text) {
      throw new Error("O modelo retornou uma resposta vazia.");
    }

    return response.text;
  } catch (err: any) {
    console.error("Erro ao gerar análise executiva:", err);
    throw new Error(err.message || "Falha na comunicação com a API do Gemini.");
  }
};

/**
 * Solicita ao Gemini a geração de um Dossiê Preliminar de Pleito.
 */
export const generateClaimNarrative = async (summary: CompactSummary): Promise<string> => {
  const ai = getAIClient();

  const prompt = `
Você é um especialista em pleitos (claims) de contratos de engenharia.
Seu objetivo é gerar um DOSSIÊ PRELIMINAR DE PLEITO, focado exclusivamente nas ocorrências e improdutividades registradas na obra.

REGRAS ESTABELECIDAS:
1. NÃO invente dados. Use estritamente o JSON fornecido.
2. Foque nos itens de "occurrencesByType", "totalOccurrences", "impactedHours", e "potentialClaimValue".
3. Use tom técnico, formal e argumentativo, como se estivesse preparando a base para um documento de pleito extrajudicial.
4. Estruture a resposta em Markdown com seções:
   - Resumo dos Impactos
   - Natureza das Ocorrências
   - Quantificação Preliminar (Horas e Valores)
   - Conclusões / Recomendações Preliminares
5. Deixe claro que os valores são estimativas preliminares com base nos RDOs diários.

DADOS CONSOLIDADOS (JSON):
${JSON.stringify(summary, null, 2)}
`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }]
        }
      ],
      config: {
        temperature: 0.2, // Tom ligeiramente flexível para estruturação de argumento, mas sem alucinar
      }
    });

    if (!response.text) {
      throw new Error("O modelo retornou uma resposta vazia.");
    }

    return response.text;
  } catch (err: any) {
    console.error("Erro ao gerar dossiê de pleito:", err);
    throw new Error(err.message || "Falha na comunicação com a API do Gemini.");
  }
};
