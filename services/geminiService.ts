import { GoogleGenAI } from "@google/genai";
import { Task } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const draftWelcomeEmail = async (task: Task, assigneeName: string): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const model = "gemini-3-flash-preview";

    const prompt = `
      Você é um assistente executivo sênior da DR Construtora.
      Escreva um rascunho de e-mail formal de abertura de ação/projeto.
      
      Destinatário: ${assigneeName}
      Projeto/Concorrência: ${task.title}
      Prazo Final: ${task.endDate.toLocaleDateString()}
      Prioridade: ${task.priority}
      
      Diretrizes:
      - Use um tom profissional, direto e encorajador.
      - Mencione a importância estratégica deste projeto para a empresa.
      - Se o cliente for "Rumo" ou "Vale", enfatize a necessidade de rigor técnico e compliance.
      - Reforce que o prazo é improrrogável.
      - Assine como "Diretoria Comercial".
    `;

    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
    });

    return response.text || "Não foi possível gerar o rascunho de e-mail.";
  } catch (error) {
    console.error("Gemini Error (Welcome Email):", error);
    return "Erro ao gerar rascunho de e-mail.";
  }
};

export const draftEscalationEmail = async (task: Task, recipientRole: string): Promise<string> => {
  try {
    const model = "gemini-3-flash-preview";

    const prompt = `
      Você é um assistente de IA para uma construtora comercial.
      Escreva um e-mail profissional e direto (em Português do Brasil).
      
      Destinatário: ${recipientRole}
      Assunto: Alerta de Prazo - Concorrência: ${task.title}
      
      Contexto:
      A tarefa "${task.title}" está atrasada ou próxima do prazo.
      Data de Início: ${task.startDate.toLocaleDateString()}
      Data de Entrega: ${task.endDate.toLocaleDateString()}
      Observações atuais: ${task.observations}
      
      Objetivo: Solicitar apoio imediato ou desbloqueio de pendências para garantir a entrega da proposta a tempo.
      Mantenha um tom corporativo, mas urgente.
    `;

    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
    });

    return response.text || "Não foi possível gerar o email.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Erro ao conectar com o assistente inteligente.";
  }
};

export const summarizeObservations = async (observations: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Resuma os seguintes pontos de atenção desta obra em tópicos curtos (bullet points) para um relatório executivo em PT-BR:\n\n${observations}`,
    });
    return response.text || "";
  } catch (e) {
    return "Erro ao resumir.";
  }
}