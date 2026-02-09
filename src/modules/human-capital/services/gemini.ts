import { GoogleGenAI } from "@google/genai";
import { OvertimeRecord } from "../types";

const SYSTEM_INSTRUCTION = `
Contexto e objetivo
Você é um analista sênior de RH/Operações com foco financeiro.
Sua tarefa é analisar horas extras e interjornada para identificar concentração, padrões e outliers que elevam custos e geram risco operacional.
Baseie-se somente nas informações fornecidas; quando algo não estiver presente no dataset, indique como “não disponível”.

Definições e campos
Considere os seguintes tipos de hora (quando existir no dataset):
“HE_60” / “60%” = horas com adicional 60%
“HE_100” / “100%” = horas com adicional 100%
“INTERJORNADA” = horas de interjornada

Identifique quais campos do JSON representam: centro de custo, função/cargo, colaborador, tipo de hora (60/100/interjornada), quantidade de horas, custo/valor e data/competência.
Se algum desses campos não existir, diga explicitamente o que faltou e adapte a análise ao que houver.

Restrições de qualidade
Não invente números.
Se precisar inferir algo, diga claramente “hipótese” e explique por quê.
Seja conciso (ideal: até ~700–900 palavras), mas completo nos itens obrigatórios.
`;

export const analyzeOvertimeData = async (data: OvertimeRecord[]): Promise<string> => {
    // Check for API key in multiple possible environment variables
    if (!process.env.API_KEY && !process.env.VITE_GEMINI_API_KEY && !process.env.REACT_APP_GEMINI_API_KEY) {
        // Fallback for typesafety
    }

    // Retrieve API Key from environment
    const apiKey = process.env.API_KEY || process.env.VITE_GEMINI_API_KEY || process.env.REACT_APP_GEMINI_API_KEY || '';

    if (!apiKey) {
        return "Erro: Chave de API não encontrada. Por favor, verifique a configuração (API_KEY, VITE_GEMINI_API_KEY).";
    }

    const ai = new GoogleGenAI({ apiKey });

    // Calculate a quick summary to guide the model
    const totalCost = data.reduce((acc, curr) => acc + curr.VALOR, 0);
    const totalHours = data.reduce((acc, curr) => acc + curr.HORAS, 0);

    // Calculate Period
    const sortedDates = data.map(d => new Date(d.DATA).getTime()).filter(t => !isNaN(t)).sort((a, b) => a - b);
    let periodo = "Indefinido";
    if (sortedDates.length > 0) {
        const min = new Date(sortedDates[0]);
        const max = new Date(sortedDates[sortedDates.length - 1]);
        const fmt = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' });
        periodo = `${fmt.format(min)} a ${fmt.format(max)}`;
    }

    const prompt = `
Contexto e objetivo
Você é um analista sênior de RH/Operações com foco financeiro.
Sua tarefa é analisar horas extras e interjornada para identificar concentração, padrões e outliers que elevam custos e geram risco operacional.

Métricas de resumo (fornecidas pelo sistema)
Custo Total Estimado: R$ ${totalCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
Total de Horas: ${totalHours.toFixed(2)}
Contagem de Registros: ${data.length}
Período analisado: ${periodo}

Dataset (amostra)
${JSON.stringify(data.slice(0, 100))}
(Se houver truncamento, assuma que a amostra representa padrões, mas declare a limitação.)

Entregáveis obrigatórios (formato e conteúdo)

Forneça um relatório em português, objetivo e executivo, com as seções abaixo nesta ordem:

1. Distribuição das Horas por Tipo (obrigatório)
Quantidade total de horas 60%, 100% e interjornada (em horas e em % do total).
Se o dataset permitir, inclua também o custo estimado por tipo e a participação no custo total.
Se algum tipo não existir no dataset, declare “não identificado no dataset”.

2. Padrões por Centro de Custo (obrigatório)
Liste os 5 centros de custo com maior volume de:
- horas 100%
- horas de interjornada
Para cada centro de custo citado, explique em 1–2 frases o padrão observado (ex.: concentração em poucos colaboradores, recorrência temporal, alta dispersão etc.).

3. Principais Funções e Pessoas que Distorcem 100% (obrigatório)
Apresente:
- Top 5 funções/cargos por horas 100%.
- Top 5 pessoas/colaboradores por horas 100% (com centro de custo e função).
Explique se a distorção é: “concentrada” (poucos responsáveis) ou “espalhada” (muitos com pequenas parcelas).
Se não houver identificação de pessoa no dataset, faça apenas por função e centro de custo.

4. Principais Funções e Pessoas que Distorcem Interjornada (obrigatório)
Mesmo formato do item anterior, agora para interjornada.
Além de custo, destaque risco operacional (fadiga, segurança, compliance e continuidade do turno), sempre conectando ao padrão observado.

5. Impactos Operacionais e Financeiros (obrigatório)
Operacional: como os padrões de 100% e interjornada sugerem problemas de escala, cobertura, pico de demanda, falhas de planejamento, ausência, etc.
Financeiro: explique impacto em:
- custo direto (folha/adicional)
- risco indireto (turnover, afastamento, passivo trabalhista, improdutividade, acidentes)
Evite “achismos”: conecte cada impacto a um sinal do dataset (ex.: concentração, recorrência, centros de custo específicos).

6. Recomendações (obrigatório) — 6 ações acionáveis
Traga 6 recomendações, divididas em:
- 2 de Política (regras, limites, aprovações, critérios)
- 2 de Processo (escala, planejamento, controle, workflow)
- 2 de Gestão (rotina de acompanhamento, responsabilização, metas, liderança)

Regras:
Cada recomendação deve citar qual tipo de hora ela reduz (60/100/interjornada) e onde (centro de custo/função/padrão).
Dê horizonte: curto prazo (até 30 dias) ou médio prazo (30–90 dias).
Não traga recomendações genéricas (ex.: “monitorar melhor”). Seja específico.

7. Limitações e Próximos Dados Necessários (obrigatório)
Liste o que faltou no dataset para uma análise mais robusta (ex.: jornada contratual, escala, headcount por centro de custo, tipo de ocorrência, motivo da HE, etc.).
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: {
                systemInstruction: SYSTEM_INSTRUCTION,
                temperature: 0.2, // Reduced temperature for more structured/analytical output as requested
            },
        });

        return response.text || "Nenhum insight gerado.";
    } catch (error) {
        console.error("Falha na análise do Gemini:", error);
        return "Não foi possível gerar insights no momento. Verifique sua chave de API e conexão.";
    }
};