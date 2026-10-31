import { describe, it, expect } from 'vitest';
import {
    mapClockinHeaders,
    normalizeHeader,
    parseCarolDateTime,
    parseClockinRows,
    parseCoordinates,
    parseFenceJson
} from './clockinParser';

const HEADER = [
    'Imagem', 'Endereço de IP', 'Nome', 'CPF', 'Nome do supervisor', 'Código do dispositivo', 'Descrição do dispositivo',
    'Modo de marcação', 'Descrição do local', 'Data', 'NSR', 'GMT Validação', 'GMT', 'Nível de GPS', 'Fuso Horário Automático',
    'Coordenadas', 'E-mail', 'Telefone', 'Código PIS', 'Geofence', 'Recibo enviado', 'IMEI', 'Nome do app',
    'Provedor de data / hora usado pelo dispositivo.', 'Precisão das coordenadas do Clock In em metros', 'Código do supervisor',
    'Modo de marcação', 'Auto marcação', 'Código da localização', 'Hash da imagem: usado para reconhecimento facial.',
    'Data e hora atualizados automaticamente', 'Diferença em ms da data / hora fornecida pelo GPS e a data / hora local.',
    'Data / hora local em que foi obtido o último sinal GPS com data / hora.', 'Código de histórico de sincronização',
    'Forma como o recibo foi enviado.', 'Read phone state habilitado', 'Coordenadas forjadas', 'Grupo do tipo de marcação.',
    'Código to tipo de marcação.', 'Descrição do tipo de marcação.', 'CNPJ', 'Score (ou precisão/confiança) do reconhecimento facial',
    'Define se a data / hora é diferente do GPS.', 'O código de status HTTP obtido quando o aplicativo chama o endpoint de serviço externo.',
    'Seção', 'Centro de custo', 'NSR Processado Data Hora', null, 'Coordenadas de dispositivos usadas para comparação de geocerca.',
    'Data/Hora com GMT', 'Diferença Minutos Ingestão e Marcação', 'Data/Hora Ingestão Carol', 'Data/Hora Primeira Sincronização',
    'Diferença Primeira Sincronização (min)', 'Recibo'
];

const FENCE_JSON = '{"company":[],"location":[{"geofence":{"x":-23.573748,"y":-47.055785},"deviceCoordinate":{"x":-23.9110551,"y":-46.6903542},"radius":35,"distance":52760.9,"transition":"exit"}],"employee":[]}';

const row = (overrides: Record<number, unknown> = {}): unknown[] => {
    const base: unknown[] = [
        'https://grupodr.carol.ai/grupodr/go/gftcfmulvk', null, 'Jose Ribamar Sena Filho', '06455761316', 'Ytalo Matheus',
        '1835ad613bab6673', 'YTALO MATHEUS', 'Reconhecimento Facial', 'São Roque', '20/10/2026 23:57', '5010', 'Não validado',
        '-03:00', 'Posição Disponível', 'Habilitado', '-23.9110551, -46.6903542', 'jose@gmail.com', '98992271842', '16196447948',
        '2', '21/10/2026 00:30', '', 'Clock In', 'ntp', 6, 'ytalo@gmail.com', '', 'Não', '01', '-0.05, 0.04, 0.02', 'Não', '0',
        '21/10/2026 00:01', '1792551472480', 'E-mail', 'Não', 'Não', null, null, null, '1', '10', 'Não', 0, '01.07.40', '301806',
        '21/10/2026 00:28', null, FENCE_JSON, '20/10/2026 23:57 -03:00', '1', '20/10/2026 23:58', '20/10/2026 23:57', '0', null
    ];
    Object.entries(overrides).forEach(([i, v]) => { base[Number(i)] = v; });
    return base;
};

describe('clockinParser', () => {
    it('normaliza cabeçalhos sem acento e sem ponto final', () => {
        expect(normalizeHeader('Descrição do local')).toBe('descricao do local');
        expect(normalizeHeader('Forma como o recibo foi enviado.')).toBe('forma como o recibo foi enviado');
    });

    it('usa a primeira ocorrência de cabeçalho repetido', () => {
        expect(mapClockinHeaders(HEADER).mode).toBe(7);
    });

    it('converte datas da Carol e seriais do Excel', () => {
        expect(parseCarolDateTime('20/10/2026 23:57')).toBe('2026-10-20T23:57');
        expect(parseCarolDateTime('5/1/2026 7:03')).toBe('2026-01-05T07:03');
        expect(parseCarolDateTime(46000.5)).toBe('2025-12-09T12:00');
        expect(parseCarolDateTime('Não validado')).toBeNull();
    });

    it('lê coordenadas e ignora "Não encontrada"', () => {
        expect(parseCoordinates('-23.9110551, -46.6903542')).toEqual([-23.9110551, -46.6903542]);
        expect(parseCoordinates('Não encontrada')).toBeNull();
    });

    it('lê o JSON da cerca (x = latitude, y = longitude)', () => {
        expect(parseFenceJson(FENCE_JSON)).toEqual({ centerLat: -23.573748, centerLon: -47.055785, radius: 35, distance: 52760.9 });
        expect(parseFenceJson('no coordinates')).toBeNull();
        expect(parseFenceJson('{quebrado')).toBeNull();
    });

    it('normaliza uma batida completa sem guardar o hash do rosto', () => {
        const result = parseClockinRows([HEADER, row()]);
        expect(result.issues).toEqual([]);
        expect(result.punches).toHaveLength(1);
        const p = result.punches[0];
        expect(p).toMatchObject({
            id: '1792551472480',
            cpf: '06455761316',
            mode: 'FACIAL',
            faceScore: 10,
            selfPunch: false,
            punchedAt: '2026-10-20T23:57',
            date: '2026-10-20',
            fenceStatus: 'OUTSIDE',
            lat: -23.9110551,
            costCenter: '301806',
            regional: 'Regional 02',
            receiptMethod: 'E-mail',
            firstSyncDelayMin: 0
        });
        expect(JSON.stringify(p)).not.toContain('-0.05, 0.04');
    });

    it('remove duplicatas pelo código de sincronização', () => {
        const result = parseClockinRows([HEADER, row(), row()]);
        expect(result.punches).toHaveLength(1);
        expect(result.duplicates).toBe(1);
    });

    it('normaliza CC com ponto e marca "Foto aprovada"', () => {
        const p = parseClockinRows([HEADER, row({ 7: 'Foto aprovada', 41: '0', 45: '3048.01', 33: '2' })]).punches[0];
        expect(p.mode).toBe('PHOTO_APPROVED');
        expect(p.costCenter).toBe('304801');
    });

    it('traduz CC da Carol para o TOTVS e guarda o original', () => {
        const p = parseClockinRows([HEADER, row({ 45: '1004' })]).punches[0];
        expect(p.costCenter).toBe('10401');
        expect(p.carolCostCenter).toBe('1004');
        expect(p.regional).toBe('Sede');
        const obra = parseClockinRows([HEADER, row({ 45: '2028' })]).punches[0];
        expect(obra.costCenter).toBe('302801');
        expect(obra.regional).toBe('Regional 01');
    });

    it('recupera CPF numérico sem o zero à esquerda', () => {
        expect(parseClockinRows([HEADER, row({ 3: 6455761316 })]).punches[0].cpf).toBe('06455761316');
    });

    it('acusa colunas obrigatórias ausentes', () => {
        const result = parseClockinRows([['Foo', 'Bar'], ['a', 'b']]);
        expect(result.punches).toHaveLength(0);
        expect(result.issues[0].message).toContain('Colunas obrigatórias');
    });

    it('registra linha com data inválida', () => {
        const result = parseClockinRows([HEADER, row({ 9: 'xx' })]);
        expect(result.punches).toHaveLength(0);
        expect(result.issues[0]).toEqual({ row: 2, message: 'Data da batida inválida.' });
    });
});
