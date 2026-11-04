/**
 * Acesso do portal ao Gemini.
 * A chave da API fica só na Cloud Function aiGenerateContent (functions/src/aiGateway.ts);
 * o navegador nunca a recebe.
 */

export type AiFeature = 'construction_rdo' | 'human_capital';

export interface AiPart {
    text?: string;
    inlineData?: { mimeType: string; data: string };
}

export interface AiRequest {
    feature: AiFeature;
    /** Texto simples ou partes (texto e arquivos em base64). */
    contents: string | AiPart[];
    systemInstruction?: string;
    temperature?: number;
    responseMimeType?: 'application/json';
    responseSchema?: unknown;
}

export interface AiResponse {
    text: string;
    totalTokenCount: number;
}

/** Tamanho máximo de arquivo enviado à IA (o pedido inteiro vai em base64, limite de 10 MB). */
export const AI_MAX_FILE_BYTES = 7 * 1024 * 1024;

export const toAiContents = (contents: AiRequest['contents']) =>
    [{ role: 'user', parts: typeof contents === 'string' ? [{ text: contents }] : contents }];

/** Converte o erro da função numa mensagem para o usuário. */
export const aiErrorMessage = (error: unknown): string => {
    const err = (error || {}) as { code?: string; message?: string };
    switch (err.code) {
        case 'functions/unauthenticated':
            return 'Sua sessão expirou. Entre novamente.';
        case 'functions/permission-denied':
            return 'Seu perfil não tem acesso à IA deste módulo.';
        case 'functions/resource-exhausted':
            return 'Limite de uso da IA atingido. Tente em alguns minutos.';
        case 'functions/deadline-exceeded':
            return 'A IA demorou demais para responder. Tente com um arquivo menor.';
        case 'functions/not-found':
            return 'Serviço de IA ainda não publicado. Avise o administrador.';
        default:
            return err.message || 'Falha na comunicação com a IA.';
    }
};

export const generateWithAi = async (request: AiRequest): Promise<AiResponse> => {
    const [{ getFunctions, httpsCallable }, { app }] = await Promise.all([
        import('firebase/functions'),
        import('@/services/firebaseConfig'),
    ]);
    const callable = httpsCallable<unknown, AiResponse>(
        getFunctions(app, 'us-central1'),
        'aiGenerateContent',
        { timeout: 300_000 }
    );
    try {
        const result = await callable({ ...request, contents: toAiContents(request.contents) });
        return result.data;
    } catch (error) {
        throw new Error(aiErrorMessage(error));
    }
};
