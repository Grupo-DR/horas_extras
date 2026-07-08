import {
    ApiConfig,
    OvertimeRecord,
    TotvsErrorCode,
    TotvsQueryMeta,
    TotvsQueryResult,
} from '../types';

type TotvsRawValue = string | number | boolean | null | undefined;
export type TotvsRawRecord = Record<string, TotvsRawValue>;

const ALLOWED_EVENTS = [
    'HORA_EXTRA_60',
    'HORA_EXTRA_100',
    'INTER_JORNADA60',
    'ADICIONAL_NOTURNO_20',
    'DESCONTO_ATRASOS',
    'DESCONTO_FALTAS',
];

export class TotvsIntegrationError extends Error {
    readonly code: TotvsErrorCode;
    readonly userMessage: string;
    readonly meta: TotvsQueryMeta;
    readonly httpStatus?: number;
    readonly cause?: unknown;

    constructor(params: {
        code: TotvsErrorCode;
        technicalMessage: string;
        userMessage: string;
        meta: TotvsQueryMeta;
        httpStatus?: number;
        cause?: unknown;
    }) {
        super(params.technicalMessage);
        this.name = 'TotvsIntegrationError';
        this.code = params.code;
        this.userMessage = params.userMessage;
        this.meta = params.meta;
        this.httpStatus = params.httpStatus;
        this.cause = params.cause;
    }
}

const createMeta = (
    config: ApiConfig,
    status: TotvsQueryMeta['status'],
    recordCount: number,
    parsedRecordCount: number,
    error?: { code: TotvsErrorCode; message: string }
): TotvsQueryMeta => ({
    source: 'TOTVS_API',
    queriedAt: new Date().toISOString(),
    period: {
        startDate: config.startDate,
        endDate: config.endDate,
    },
    status,
    recordCount,
    parsedRecordCount,
    ...(error ? { errorCode: error.code, errorMessage: error.message } : {}),
});

const buildError = (
    config: ApiConfig,
    code: TotvsErrorCode,
    technicalMessage: string,
    userMessage: string,
    options?: { httpStatus?: number; cause?: unknown }
) => new TotvsIntegrationError({
    code,
    technicalMessage,
    userMessage,
    httpStatus: options?.httpStatus,
    cause: options?.cause,
    meta: createMeta(config, 'ERROR', 0, 0, { code, message: userMessage }),
});

const logTotvsError = (error: TotvsIntegrationError) => {
    console.error('[TOTVS] Falha na consulta de horas extras.', {
        code: error.code,
        httpStatus: error.httpStatus,
        message: error.message,
    });
};

const isRecord = (value: unknown): value is TotvsRawRecord =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const isRecordArray = (value: unknown): value is TotvsRawRecord[] =>
    Array.isArray(value) && value.every(isRecord);

const extractRawItems = (payload: unknown): unknown => {
    if (Array.isArray(payload)) return payload;
    if (isRecord(payload) && 'Items' in payload) return payload.Items;
    if (isRecord(payload) && 'items' in payload) return payload.items;
    return payload;
};

const getString = (item: TotvsRawRecord, key: string, fallback = ''): string => {
    const value = item[key];
    if (value === null || value === undefined || value === '') return fallback;
    return String(value);
};

const parseNumericHour = (value: TotvsRawValue): number | string | null => {
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : null;
    }

    if (typeof value === 'string') {
        const normalized = value.trim().replace(',', '.');
        if (!normalized) return null;
        return Number.isFinite(Number(normalized)) ? normalized : null;
    }

    return null;
};

export const convertTotvsHourToDecimal = (value: number | string): number => {
    const normalized = String(value).trim().replace(',', '.');
    const sign = normalized.startsWith('-') ? -1 : 1;
    const unsigned = normalized.replace(/^-/, '');
    const [hourPart, minutePart] = unsigned.split('.');

    const hours = Number.parseInt(hourPart || '0', 10);
    if (!Number.isFinite(hours)) return 0;
    if (!minutePart) return sign * hours;

    const minutes = Number.parseInt(minutePart, 10);
    if (!Number.isFinite(minutes)) return sign * hours;
    return sign * (hours + minutes / 60);
};

export const parseTotvsResponse = (data: TotvsRawRecord[]): OvertimeRecord[] => {
    const records: OvertimeRecord[] = [];

    data.forEach((item) => {
        const baseRecord = {
            CHAPA: getString(item, 'CHAPA'),
            NOME: getString(item, 'NOME', 'Desconhecido'),
            FUNCAO: getString(item, 'FUNCAO'),
            CODCCUSTO: getString(item, 'CODCCUSTO'),
            SECAO: getString(item, 'DESCRICAO', getString(item, 'SECAO', 'Sem Secao')),
            DATA: getString(item, 'DATA', new Date().toISOString()),
        };

        Object.keys(item).forEach((key) => {
            const upperKey = key.toUpperCase();
            const rawHour = parseNumericHour(item[key]);
            const numericHour = rawHour === null ? 0 : Number(String(rawHour).replace(',', '.'));

            if (
                ALLOWED_EVENTS.includes(upperKey) &&
                rawHour !== null &&
                numericHour !== 0
            ) {
                records.push({
                    ...baseRecord,
                    EVENTO: key.replace(/_/g, ' '),
                    HORAS: convertTotvsHourToDecimal(rawHour),
                    VALOR: 0,
                });
            }
        });
    });

    return records;
};

const buildFetchUrl = (config: ApiConfig): string => {
    let fetchUrl = config.url;
    if (!fetchUrl.includes('parameters=') && config.startDate && config.endDate) {
        const joinChar = fetchUrl.includes('?') ? '&' : '?';
        const params = `PLN_B1_D=${config.startDate};PLN_B2_D=${config.endDate}`;
        fetchUrl = `${fetchUrl}${joinChar}parameters=${params}`;
    }
    return fetchUrl;
};

const getHttpError = (status: number): { code: TotvsErrorCode; userMessage: string } => {
    if (status === 401) {
        return {
            code: 'HTTP_UNAUTHORIZED',
            userMessage: 'Credenciais invalidas ou acesso negado na integracao TOTVS.',
        };
    }

    if (status === 403) {
        return {
            code: 'HTTP_FORBIDDEN',
            userMessage: 'Acesso negado pela API TOTVS para as credenciais configuradas.',
        };
    }

    return {
        code: 'HTTP_ERROR',
        userMessage: `API TOTVS retornou status ${status}.`,
    };
};

export const fetchOvertimeDataWithMeta = async (config: ApiConfig): Promise<TotvsQueryResult> => {
    try {
        const authString = globalThis.btoa(`${config.username}:${config.password || ''}`);
        const response = await fetch(buildFetchUrl(config), {
            method: 'GET',
            headers: {
                Authorization: `Basic ${authString}`,
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
        });

        if (!response.ok) {
            const httpError = getHttpError(response.status);
            throw buildError(
                config,
                httpError.code,
                `API TOTVS retornou status ${response.status}.`,
                httpError.userMessage,
                { httpStatus: response.status }
            );
        }

        let payload: unknown;
        try {
            payload = await response.json();
        } catch (cause) {
            throw buildError(
                config,
                'UNEXPECTED_FORMAT',
                'Resposta da API TOTVS nao pode ser interpretada como JSON.',
                'Formato inesperado retornado pela TOTVS.',
                { cause }
            );
        }

        const rawItems = extractRawItems(payload);
        if (!isRecordArray(rawItems)) {
            throw buildError(
                config,
                'UNEXPECTED_FORMAT',
                'Formato inesperado na resposta da API TOTVS.',
                'Formato inesperado retornado pela TOTVS.'
            );
        }

        const parsed = parseTotvsResponse(rawItems);
        const status = rawItems.length === 0 ? 'EMPTY' : 'SUCCESS';

        return {
            data: parsed,
            meta: createMeta(config, status, rawItems.length, parsed.length),
        };
    } catch (error) {
        if (error instanceof TotvsIntegrationError) {
            logTotvsError(error);
            throw error;
        }

        const networkError = buildError(
            config,
            'NETWORK_ERROR',
            'Falha de conexao ao consultar a API TOTVS.',
            'Falha de conexao com a API TOTVS. Verifique a integracao ou tente novamente.',
            { cause: error }
        );
        logTotvsError(networkError);
        throw networkError;
    }
};

export const fetchOvertimeData = async (config: ApiConfig): Promise<OvertimeRecord[]> => {
    const result = await fetchOvertimeDataWithMeta(config);
    return result.data;
};
