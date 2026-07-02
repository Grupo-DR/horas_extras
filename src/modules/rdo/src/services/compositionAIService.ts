import { GoogleGenAI, Schema, Type } from "@google/genai";
import { 
  CompositionAIExtractionResult, 
  AICompositionItem, 
  CompositionResourceItem,
  CompositionType
} from "../analytics/types/analyticsTypes";
import { generateUUID } from "../../utils";

// Reusing fileToBase64 from geminiService or implementing it locally for PDF
export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      if (typeof reader.result === "string") {
        const base64 = reader.result.split(",")[1];
        resolve(base64);
      } else {
        reject(new Error("Failed to convert file to base64"));
      }
    };
    reader.onerror = (error) => reject(error);
  });
};

const getAIClient = () => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || (process as any).env?.GEMINI_API_KEY || (process as any).env?.API_KEY;
  if (!apiKey || apiKey === 'undefined' || apiKey === 'null') {
    throw new Error("API Key do Gemini não encontrada ou inválida. Verifique o seu arquivo .env.");
  }
  return new GoogleGenAI({ apiKey });
};

// --- Schema Definitions ---

const compositionSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    compositions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          codigoComposicao: { type: Type.STRING, description: "Código da composição" },
          servicoOriginal: { type: Type.STRING, description: "Nome original do serviço como aparece no PDF" },
          unidade: { type: Type.STRING, description: "Unidade de medida (ex: m, m2, m3, h)" },
          producaoEquipe: { type: Type.NUMBER, description: "Produção da equipe, se houver", nullable: true },
          custoHorarioEquipamentos: { type: Type.NUMBER, description: "Custo horário equipamentos, se houver", nullable: true },
          custoHorarioMaoObra: { type: Type.NUMBER, description: "Custo horário mão de obra, se houver", nullable: true },
          custoHorarioTotal: { type: Type.NUMBER, description: "Custo horário total, se houver", nullable: true },
          custoUnitarioExecucao: { type: Type.NUMBER, description: "Custo unitário de execução, se houver", nullable: true },
          custoMateriais: { type: Type.NUMBER, description: "Custo materiais, se houver", nullable: true },
          custoTransporte: { type: Type.NUMBER, description: "Custo transporte, se houver", nullable: true },
          custoUnitarioTotal: { type: Type.NUMBER, description: "Custo unitário total, se houver", nullable: true },
          bonificacaoPercentual: { type: Type.NUMBER, description: "Bonificação (BDI) em formato decimal, ex: 0.4557 para 45,57%", nullable: true },
          bonificacaoValor: { type: Type.NUMBER, description: "Bonificação (BDI) em valor monetário", nullable: true },
          precoUnitarioTotal: { type: Type.NUMBER, description: "Preço unitário total final da composição", nullable: true },
          tipoComposicao: { type: Type.STRING, description: "Classificação: SERVICO_PRODUTIVO, MOBILIZACAO, ADMINISTRACAO_LOCAL, DESMOBILIZACAO, IMPRODUTIVIDADE_MO, IMPRODUTIVIDADE_EQUIPAMENTO, TRANSPORTE ou OUTRO" },
          paginaOrigem: { type: Type.NUMBER, description: "Página do PDF onde esta composição se encontra", nullable: true },
          confiancaExtracao: { type: Type.STRING, description: "ALTA, MEDIA ou BAIXA" },
          observacao: { type: Type.STRING, description: "Observação livre", nullable: true },
        },
        required: ["codigoComposicao", "servicoOriginal", "unidade", "tipoComposicao", "confiancaExtracao"]
      }
    },
    resources: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          codigoComposicao: { type: Type.STRING, description: "Código da composição a qual este recurso pertence" },
          tipoRecurso: { type: Type.STRING, description: "EQUIPAMENTO, MAO_OBRA, MATERIAL, TRANSPORTE, ou OUTRO" },
          recurso: { type: Type.STRING, description: "Nome do recurso" },
          unidade: { type: Type.STRING, description: "Unidade", nullable: true },
          quantidade: { type: Type.NUMBER, description: "Quantidade (índice)", nullable: true },
          utilizacaoProdutiva: { type: Type.NUMBER, description: "Utilização produtiva", nullable: true },
          utilizacaoImprodutiva: { type: Type.NUMBER, description: "Utilização improdutiva", nullable: true },
          custoOperacionalProdutivo: { type: Type.NUMBER, description: "Custo produtivo", nullable: true },
          custoOperacionalImprodutivo: { type: Type.NUMBER, description: "Custo improdutivo", nullable: true },
          custoUnitario: { type: Type.NUMBER, description: "Custo unitário material", nullable: true },
          custoHorario: { type: Type.NUMBER, description: "Custo horário", nullable: true },
          custoTotal: { type: Type.NUMBER, description: "Custo total", nullable: true },
        },
        required: ["codigoComposicao", "tipoRecurso", "recurso"]
      }
    },
    rawModelNotes: { type: Type.STRING, description: "Notas gerais da extração", nullable: true }
  },
  required: ["compositions"]
};

const SYSTEM_PROMPT = `Você é um especialista em engenharia de custos, orçamento de obras ferroviárias, composições unitárias, produtividade de equipes e improdutividade contratual.
Analise o PDF de composições com preço enviado.
Sua tarefa é extrair todas as composições presentes no documento e devolver somente JSON válido no schema solicitado.

Regras obrigatórias:
1. Não invente composições.
2. Não invente valores.
3. Não estime campos ausentes.
4. Se um campo não estiver claro, retorne null.
5. Preserve o código da composição exatamente como aparece.
6. Preserve o nome original do serviço exatamente como aparece, quando possível.
7. Se o nome contiver BLACKOUT, preserve BLACKOUT no nome original.
8. Converta números brasileiros para número decimal:
   - "1.599,67" deve virar 1599.67
   - "358,25" deve virar 358.25
9. Converta percentuais para decimal:
   - "45,57%" deve virar 0.4557
10. Extraia a unidade da composição.
11. Extraia a produção da equipe, se aparecer.
12. Extraia custos se aparecerem.
13. Classifique o tipo da composição rigorosamente:
    - Se for executável/produtivo: SERVICO_PRODUTIVO
    - Se for mobilização: MOBILIZACAO
    - Se for administração local: ADMINISTRACAO_LOCAL
    - Se for desmobilização: DESMOBILIZACAO
    - Se for homem-hora improdutiva: IMPRODUTIVIDADE_MO
    - Se for hora improdutiva de equipamento: IMPRODUTIVIDADE_EQUIPAMENTO
    - Se for transporte, km rodoviário ou prancha: TRANSPORTE
    - Se não for possível classificar: OUTRO
14. Extraia os recursos internos quando possível.
15. Use confiança ALTA, MEDIA ou BAIXA conforme clareza da leitura.

Retorne somente JSON válido.`;

export const extractCompositionsFromPDF = async (
  file: File,
  projectId: string
): Promise<CompositionAIExtractionResult> => {
  const ai = getAIClient();
  const base64Data = await fileToBase64(file);

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          parts: [
            { inlineData: { mimeType: "application/pdf", data: base64Data } },
            { text: SYSTEM_PROMPT }
          ]
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: compositionSchema,
        temperature: 0.1,
      }
    });

    const text = response.text;
    if (!text) throw new Error("No data returned from Gemini");

    const parsedData = JSON.parse(text);
    return postProcessCompositionExtraction(parsedData, projectId, file.name);

  } catch (err: any) {
    console.error("Erro ao extrair composições via IA:", err);
    throw new Error(err.message || "Falha na comunicação com a API do Gemini ao processar PDF.");
  }
};

// --- Post Processing ---

function postProcessCompositionExtraction(data: any, projectId: string, fileName: string): CompositionAIExtractionResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const rawCompositions = data.compositions || [];
  const rawResources = data.resources || [];

  const compositions: AICompositionItem[] = [];
  const resources: CompositionResourceItem[] = [];

  rawCompositions.forEach((rawComp: any, idx: number) => {
    try {
      const compId = generateUUID();
      const originalName = rawComp.servicoOriginal || "";
      let treatedName = originalName.trim();
      let hasBlackoutInOriginal = false;
      
      // Regra BLACKOUT
      if (/BLACKOUT/i.test(treatedName)) {
        hasBlackoutInOriginal = true;
        // Remove a palavra BLACKOUT (case insensitive) e espaços extras
        treatedName = treatedName.replace(/BLACKOUT/gi, "").replace(/\s+/g, " ").trim();
      }

      // Classificação fallback se a IA falhar ou mandar vazio
      let tipoComposicao = (rawComp.tipoComposicao as CompositionType) || 'OUTRO';
      if (!tipoComposicao || tipoComposicao === 'OUTRO') {
        const testName = originalName.toLowerCase();
        if (testName.includes('improdutiva') || testName.includes('improdutivo') || testName.includes('homem-hora')) {
          tipoComposicao = 'IMPRODUTIVIDADE_MO';
        } else if (testName.includes('mobiliza')) {
          tipoComposicao = 'MOBILIZACAO';
        } else if (testName.includes('transporte') || testName.includes('km')) {
          tipoComposicao = 'TRANSPORTE';
        }
      }

      // Validações
      if (!rawComp.codigoComposicao) warnings.push(`Composição #${idx+1} importada sem código.`);
      if (!rawComp.unidade) warnings.push(`Composição ${rawComp.codigoComposicao} importada sem unidade.`);
      if (tipoComposicao === 'SERVICO_PRODUTIVO' && !rawComp.producaoEquipe) {
        warnings.push(`Composição produtiva ${rawComp.codigoComposicao} sem produção de equipe.`);
      }

      const comp: AICompositionItem = {
        id: compId,
        projectId,
        codigoComposicao: rawComp.codigoComposicao || `S-COD-${idx}`,
        servicoOriginal: originalName,
        servicoTratado: treatedName,
        unidade: rawComp.unidade || "un",
        producaoEquipe: rawComp.producaoEquipe ?? undefined,
        custoHorarioEquipamentos: rawComp.custoHorarioEquipamentos ?? undefined,
        custoHorarioMaoObra: rawComp.custoHorarioMaoObra ?? undefined,
        custoHorarioTotal: rawComp.custoHorarioTotal ?? undefined,
        custoUnitarioExecucao: rawComp.custoUnitarioExecucao ?? undefined,
        custoMateriais: rawComp.custoMateriais ?? undefined,
        custoTransporte: rawComp.custoTransporte ?? undefined,
        custoUnitarioTotal: rawComp.custoUnitarioTotal ?? undefined,
        bonificacaoPercentual: rawComp.bonificacaoPercentual ?? undefined,
        bonificacaoValor: rawComp.bonificacaoValor ?? undefined,
        precoUnitarioTotal: rawComp.precoUnitarioTotal ?? undefined,
        tipoComposicao,
        hasBlackoutInOriginal,
        isPreferredForCalculation: true, // Will resolve duplication below
        paginaOrigem: rawComp.paginaOrigem ?? undefined,
        confiancaExtracao: rawComp.confiancaExtracao || 'BAIXA',
        observacao: rawComp.observacao ?? undefined
      };

      compositions.push(comp);
    } catch (err: any) {
      errors.push(`Falha crítica ao processar composição índice ${idx}: ${err.message}`);
    }
  });

  // Resolução de Duplicidades e isPreferredForCalculation
  const treatedNamesMap = new Map<string, AICompositionItem[]>();
  compositions.forEach(c => {
    if (!treatedNamesMap.has(c.servicoTratado)) {
      treatedNamesMap.set(c.servicoTratado, []);
    }
    treatedNamesMap.get(c.servicoTratado)!.push(c);
  });

  treatedNamesMap.forEach((group, treatedName) => {
    if (group.length > 1) {
      // Tem duplicidade para o mesmo nome tratado
      warnings.push(`Identificada duplicidade de Serviço Tratado: "${treatedName}".`);
      
      const normal = group.find(c => !c.hasBlackoutInOriginal);
      const blackout = group.find(c => c.hasBlackoutInOriginal);

      if (normal && blackout) {
        normal.isPreferredForCalculation = true;
        blackout.isPreferredForCalculation = false;
        blackout.observacao = (blackout.observacao ? blackout.observacao + " | " : "") + "Ignorada por possuir versão sem BLACKOUT.";
      } else {
        // Se ambos forem blackout, ou ambos normais, prioriza o primeiro
        group.forEach((c, idx) => c.isPreferredForCalculation = idx === 0);
      }
    } else {
      if (group[0].hasBlackoutInOriginal) {
        warnings.push(`Composição "${treatedName}" possui BLACKOUT e é a única opção. Será usada para cálculos.`);
      }
    }
  });

  // Recursos
  rawResources.forEach((rawRes: any) => {
    // Tenta achar a composição correspondente pelo código
    const parentComp = compositions.find(c => c.codigoComposicao === rawRes.codigoComposicao);
    const compId = parentComp ? parentComp.id : `ORPHAN-${generateUUID()}`;
    const srvTratado = parentComp ? parentComp.servicoTratado : "DESCONHECIDO";

    resources.push({
      id: generateUUID(),
      projectId,
      compositionId: compId,
      codigoComposicao: rawRes.codigoComposicao || "S-COD",
      servicoTratado: srvTratado,
      tipoRecurso: rawRes.tipoRecurso || 'OUTRO',
      recurso: rawRes.recurso || "N/A",
      unidade: rawRes.unidade ?? undefined,
      quantidade: rawRes.quantidade ?? undefined,
      utilizacaoProdutiva: rawRes.utilizacaoProdutiva ?? undefined,
      utilizacaoImprodutiva: rawRes.utilizacaoImprodutiva ?? undefined,
      custoOperacionalProdutivo: rawRes.custoOperacionalProdutivo ?? undefined,
      custoOperacionalImprodutivo: rawRes.custoOperacionalImprodutivo ?? undefined,
      custoUnitario: rawRes.custoUnitario ?? undefined,
      custoHorario: rawRes.custoHorario ?? undefined,
      custoTotal: rawRes.custoTotal ?? undefined,
    });
  });

  return {
    projectId,
    sourceFileName: fileName,
    extractedAt: new Date().toISOString(),
    compositions,
    resources,
    errors,
    warnings,
    rawModelNotes: data.rawModelNotes || ""
  };
}
