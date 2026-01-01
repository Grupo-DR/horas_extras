import { Task } from "../types";

// Service put in standby due to API Key issues in browser environment.
// import { GoogleGenAI } from "@google/genai";

export const draftWelcomeEmail = async (task: Task, assigneeName: string): Promise<string> => {
  console.warn("Gemini Service is in standby. Email draft skipped.");
  return "Funcionalidade de e-mail temporariamente desativada. (Standby)";
};

export const draftEscalationEmail = async (task: Task, recipientRole: string): Promise<string> => {
  console.warn("Gemini Service is in standby. Email draft skipped.");
  return "Funcionalidade de e-mail temporariamente desativada. (Standby)";
};

export const summarizeObservations = async (observations: string): Promise<string> => {
  return observations;
}