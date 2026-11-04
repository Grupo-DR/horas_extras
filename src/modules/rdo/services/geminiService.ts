import { Schema, Type } from "@google/genai";
import { RDOData } from "../types";
import { generateUUID } from "../utils";
import { AI_MAX_FILE_BYTES, generateWithAi } from "@/services/aiGateway";

export const extractRDOData = async (base64Image: string, mimeType: string): Promise<RDOData> => {
  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      reportNumber: { type: Type.STRING, description: "The report number (Relatório nº)" },
      date: { type: Type.STRING, description: "Date of the report (DD/MM/YYYY)" },
      contractNumber: { type: Type.STRING, description: "Contract number" },
      weatherMorning: { type: Type.STRING, description: "Weather condition in the morning (e.g., Claro, Chuvoso)" },
      weatherAfternoon: { type: Type.STRING, description: "Weather condition in the afternoon" },
      rainIndexMm: { type: Type.NUMBER, description: "Rain index in mm, 0 if none" },
      workforce: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            role: { type: Type.STRING, description: "Job title/Role of the worker" },
            count: { type: Type.NUMBER, description: "Number of workers with this role" },
            totalHours: { type: Type.NUMBER, description: "Total hours worked by this group" },
          },
          required: ["role", "count", "totalHours"],
        },
      },
      equipment: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING, description: "Name of the equipment" },
            count: { type: Type.NUMBER, description: "Quantity of this equipment" },
            hoursOperated: { type: Type.NUMBER, description: "Hours operated (convert string time to decimal hours if needed)" },
          },
          required: ["name", "count", "hoursOperated"],
        },
      },
      activities: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            code: { type: Type.STRING, description: "The service code (e.g. 3000782). Extract ONLY the code here." },
            description: { type: Type.STRING, description: "Description of the activity (without the code)" },
            progress: { type: Type.NUMBER, description: "Percentage of progress (0-100)" },
            quantity: { type: Type.NUMBER, description: "Absolute quantity executed/produced this day (e.g. 50.5)." },
            status: { type: Type.STRING, description: "Status text (e.g., Em Andamento)" },
          },
          required: ["description", "progress", "status"],
        },
      },
      occurrences: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            description: { type: Type.STRING, description: "Description of the occurrence/issue" },
            impactTimeMinutes: { type: Type.NUMBER, description: "Time lost in minutes due to occurrence" },
          },
          required: ["description", "impactTimeMinutes"],
        },
      },
      comments: { type: Type.STRING, description: "General comments or observations" },
    },
    required: ["reportNumber", "date", "workforce", "equipment", "activities"],
  };

  const response = await generateWithAi({
    feature: "construction_rdo",
    contents: [
      { inlineData: { mimeType, data: base64Image } },
      {
        text: "Analyze this Construction Daily Report (RDO). Extract all data fields accurately. IMPORTANT: For activities, separate the 'code' (e.g. 3001234) from the 'description'. If the document shows '3001234 - Excavation', put '3001234' in code and 'Excavation' in description. Extract the 'quantity' executed.",
      },
    ],
    responseMimeType: "application/json",
    responseSchema: schema,
  });

  const text = response.text;
  if (!text) throw new Error("No data returned from Gemini");

  const parsedData = JSON.parse(text);

  // Enrich with metadata
  const rdoData: RDOData = {
    ...parsedData,
    id: generateUUID(),
    processedAt: new Date().toISOString(),
    tokenUsage: response.totalTokenCount || 0
  };

  return rdoData;
};

export const fileToBase64 = (file: File): Promise<string> => {
  if (file.size > AI_MAX_FILE_BYTES) {
    return Promise.reject(new Error(`O arquivo "${file.name}" passa de 7 MB. Reduza o tamanho e envie de novo.`));
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      if (typeof reader.result === "string") {
        // Remove the Data-URI prefix (e.g. "data:image/jpeg;base64,")
        const base64 = reader.result.split(",")[1];
        resolve(base64);
      } else {
        reject(new Error("Failed to convert file to base64"));
      }
    };
    reader.onerror = (error) => reject(error);
  });
};