import { Task } from "../types";

/**
 * SERVIÇO EM STANDBY
 * A inicialização do GoogleGenAI foi removida para evitar erros de API Key no browser.
 * As funções abaixo retornam mensagens padrão sem acionar a IA.
 */

export const draftWelcomeEmail = async (task: Task, assigneeName: string): Promise<string> => {
  console.log("Draft de e-mail (Welcome) ignorado - Serviço em Standby.");
  return "Funcionalidade de rascunho de e-mail desativada.";
};

export const draftEscalationEmail = async (task: Task, recipientRole: string): Promise<string> => {
  console.log("Draft de e-mail (Escalation) ignorado - Serviço em Standby.");
  return "Funcionalidade de rascunho de e-mail desativada.";
};

export const summarizeObservations = async (observations: string): Promise<string> => {
  return observations; // Retorna o texto original sem processamento de IA
};