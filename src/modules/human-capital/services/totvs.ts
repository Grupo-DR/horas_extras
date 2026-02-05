import { OvertimeRecord, ApiConfig } from '../types';

// Mock Data matching your specific JSON structure
export const generateMockData = (): OvertimeRecord[] => {
    // Use the exact structure provided in the prompt for the mock
    const rawMock = [
        {
            "CHAPA": "2337",
            "NOME": "CLAYTON DE SOUZA CHAMONE",
            "FUNCAO": "Supervisor de Obras",
            "CODCCUSTO": "303702",
            "DESCRICAO": "SERV CORRECAO GEOMETRICA SOCADORA - RUMO",
            "DATA": "2025-08-01T00:00:00-03:00",
            "HORAS_TRABALHADAS_PERIODO_PONTO": 8.0, // 8h 00m
            "HORA_EXTRA_60": 0.45 // 0h 45m
        },
        {
            "CHAPA": "1846",
            "NOME": "ALEXANDRE AYUSSO",
            "FUNCAO": "Motorista III",
            "CODCCUSTO": "301903",
            "DESCRICAO": "MANUT. INFRA NORTE ZAR – TMI",
            "DATA": "2025-12-25T00:00:00-03:00",
            "HORA_EXTRA_100": 4.8, // 4h 08m (TOTVS Format)
            "INTER_JORNADA60": 4.8, // 4h 08m
            "ADICIONAL_NOTURNO_20": 4.43 // 4h 43m
        },
        {
            "CHAPA": "9999",
            "NOME": "MARIA SILVA",
            "FUNCAO": "Analista RH",
            "CODCCUSTO": "101010",
            "DESCRICAO": "ADMINISTRATIVO SEDE",
            "DATA": "2025-08-15T00:00:00-03:00",
            "HORA_EXTRA_100": 2.15, // 2h 15m
            "INTER_JORNADA60": 0.30 // 0h 30m
        }
    ];

    return parseTotvsResponse(rawMock);
};

// Helper to identify if a JSON key represents hours
const isHourKey = (key: string): boolean => {
    const upper = key.toUpperCase();
    return (
        (upper.includes('HORA') || upper.includes('JORNADA') || upper.includes('ADICIONAL')) &&
        !upper.includes('DATA') // Exclude fields like DATA_PAGAMENTO if they exist
    );
};

// Helper to convert TOTVS "Float" format to Standard Decimal Hours
// Rule: "X.X" is "X:0X" and "X.XX" is "X:XX"
// Example: 4.8 -> 4:08 -> 4 + 8/60 hours
// Example: 4.43 -> 4:43 -> 4 + 43/60 hours
const convertTotvsHourToDecimal = (value: number): number => {
    const sign = value < 0 ? -1 : 1;
    const absValue = Math.abs(value);
    const str = absValue.toString();
    const parts = str.split('.');

    const hours = parseInt(parts[0], 10);

    // If no decimal part, it's just integer hours
    if (parts.length === 1) return hours * sign;

    // The decimal part represents the minutes integer directly
    // "4.8" -> parts[1] is "8" -> 8 minutes
    // "4.43" -> parts[1] is "43" -> 43 minutes
    const minutes = parseInt(parts[1], 10);

    return sign * (hours + (minutes / 60));
};

// Logic to transform the specific JSON structure into our UI model
const parseTotvsResponse = (data: any[]): OvertimeRecord[] => {
    const records: OvertimeRecord[] = [];

    if (!Array.isArray(data)) return [];

    data.forEach((item) => {
        // Basic fields
        const baseRecord = {
            CHAPA: String(item.CHAPA || ''),
            NOME: String(item.NOME || 'Desconhecido'),
            FUNCAO: String(item.FUNCAO || ''),
            CODCCUSTO: String(item.CODCCUSTO || ''),
            SECAO: String(item.DESCRICAO || item.SECAO || 'Sem Seção'), // Map DESCRICAO to SECAO
            DATA: String(item.DATA || new Date().toISOString()),
        };

        // Iterate over all keys to find hour fields (Dynamic Parsing)
        Object.keys(item).forEach((key) => {
            const value = item[key];

            // If the key looks like an hour field and has a numeric value > 0
            if (isHourKey(key) && typeof value === 'number' && value !== 0) {
                records.push({
                    ...baseRecord,
                    EVENTO: key.replace(/_/g, ' '), // Prettify: HORA_EXTRA_60 -> HORA EXTRA 60
                    HORAS: convertTotvsHourToDecimal(value), // Convert TOTVS format to Decimal
                    // Since VALOR is missing in JSON, we can estimate it or leave as 0. 
                    // Setting 0 avoids "undefined" errors.
                    VALOR: 0
                });
            }
        });
    });

    return records;
};

export const fetchOvertimeData = async (config: ApiConfig): Promise<OvertimeRecord[]> => {
    try {
        const authString = btoa(`${config.username}:${config.password || ''}`);
        const headers = {
            'Authorization': `Basic ${authString}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };

        let fetchUrl = config.url;
        // Ensure parameters are attached if the user didn't include them in the base URL input
        if (!fetchUrl.includes('parameters=') && config.startDate && config.endDate) {
            const joinChar = fetchUrl.includes('?') ? '&' : '?';
            const params = `PLN_B1_D=${config.startDate};PLN_B2_D=${config.endDate}`;
            fetchUrl = `${fetchUrl}${joinChar}parameters=${params}`;
        }

        const response = await fetch(fetchUrl, {
            method: 'GET',
            headers: headers,
        });

        if (!response.ok) {
            throw new Error(`API retornou ${response.status}`);
        }

        const json = await response.json();

        // Handle wrapped responses (e.g. { items: [...] })
        let rawData = json;
        if (!Array.isArray(json) && json.Items) {
            rawData = json.Items;
        } else if (!Array.isArray(json) && json.items) {
            rawData = json.items;
        }

        if (!Array.isArray(rawData)) {
            console.warn("Formato de API inesperado, usando mock.", rawData);
            return generateMockData();
        }

        return parseTotvsResponse(rawData);

    } catch (error) {
        console.warn("Falha na busca, alternando para Dados Simulados.", error);
        return new Promise((resolve) => {
            setTimeout(() => resolve(generateMockData()), 800);
        });
    }
};
