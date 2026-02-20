import { OvertimeRecord, ApiConfig } from '../types';

// Mock Data (Mantido para fallback)
export const generateMockData = (): OvertimeRecord[] => {
    // ... mesmo mock data anterior ...
    const rawMock = [
        {
            "CHAPA": "2337",
            "NOME": "CLAYTON DE SOUZA CHAMONE",
            "FUNCAO": "Supervisor de Obras",
            "CODCCUSTO": "303702",
            "DESCRICAO": "SERV CORRECAO GEOMETRICA SOCADORA - RUMO",
            "DATA": "2025-08-01T00:00:00-03:00",
            "HORAS_TRABALHADAS_PERIODO_PONTO": 8.0,
            "HORA_EXTRA_60": 0.45
        },
        {
            "CHAPA": "1846",
            "NOME": "ALEXANDRE AYUSSO",
            "FUNCAO": "Motorista III",
            "CODCCUSTO": "301903",
            "DESCRICAO": "MANUT. INFRA NORTE ZAR – TMI",
            "DATA": "2025-12-25T00:00:00-03:00",
            "HORA_EXTRA_100": 4.8,
            "INTER_JORNADA60": 4.8,
            "ADICIONAL_NOTURNO_20": 4.43
        },
        {
            "CHAPA": "9999",
            "NOME": "MARIA SILVA",
            "FUNCAO": "Analista RH",
            "CODCCUSTO": "101010",
            "DESCRICAO": "ADMINISTRATIVO SEDE",
            "DATA": "2025-08-15T00:00:00-03:00",
            "HORA_EXTRA_100": 2.15,
            "INTER_JORNADA60": 0.30
        }
    ];
    return parseTotvsResponse(rawMock);
};


const convertTotvsHourToDecimal = (value: number): number => {
    const sign = value < 0 ? -1 : 1;
    const absValue = Math.abs(value);
    const str = absValue.toString();
    const parts = str.split('.');

    const hours = parseInt(parts[0], 10);
    if (parts.length === 1) return hours * sign;
    const minutes = parseInt(parts[1], 10);
    return sign * (hours + (minutes / 60));
};

const parseTotvsResponse = (data: any[]): OvertimeRecord[] => {
    const records: OvertimeRecord[] = [];
    if (!Array.isArray(data)) return [];

    if (data.length > 0) {
        console.log("================ TOTVS API DEBUG ================");
        console.log("RAW ITEM KEYS:", Object.keys(data[0]));
        console.log("FIRST ITEM:", data[0]);
        console.log("=================================================");
    }

    data.forEach((item) => {
        // Campos Básicos (Extração Direta)
        const baseRecord = {
            CHAPA: String(item.CHAPA || ''),
            NOME: String(item.NOME || 'Desconhecido'),
            FUNCAO: String(item.FUNCAO || ''),
            CODCCUSTO: String(item.CODCCUSTO || ''),
            SECAO: String(item.DESCRICAO || item.SECAO || 'Sem Seção'),
            DATA: String(item.DATA || new Date().toISOString()),
        };

        // Extração Dinâmica de Eventos de Hora (Evita problemas com hardcoded whitelists)
        Object.keys(item).forEach((key) => {
            const upperKey = key.toUpperCase();
            // Identifica se a chave se trata de um evento de hora extra, adicional ou interjornada
            if (upperKey.includes('EXTRA') || upperKey.includes('NOTURNO') || upperKey.includes('INTER') || upperKey.includes('HORAS_TRABALHADAS')) {
                const value = item[key];

                // Verifica se a chave existe e tem valor numérico diferente de zero
                if (value !== undefined && value !== null && typeof value === 'number' && value !== 0) {
                    records.push({
                        ...baseRecord,
                        EVENTO: key.replace(/_/g, ' '),
                        HORAS: convertTotvsHourToDecimal(value),
                        VALOR: 0
                    });
                }
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
