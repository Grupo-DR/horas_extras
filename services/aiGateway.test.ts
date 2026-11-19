import { describe, expect, it } from 'vitest';
import { aiErrorMessage, parseAiJson, toAiContents } from './aiGateway';

describe('toAiContents', () => {
    it('transforma texto simples numa mensagem do usuário', () => {
        expect(toAiContents('olá')).toEqual([{ role: 'user', parts: [{ text: 'olá' }] }]);
    });

    it('mantém arquivos e texto como partes da mesma mensagem', () => {
        const parts = [{ inlineData: { mimeType: 'application/pdf', data: 'AAA' } }, { text: 'extraia' }];
        expect(toAiContents(parts)).toEqual([{ role: 'user', parts }]);
    });
});

describe('aiErrorMessage', () => {
    it('explica falta de permissão do perfil', () => {
        expect(aiErrorMessage({ code: 'functions/permission-denied' })).toBe('Seu perfil não tem acesso à IA deste módulo.');
    });

    it('avisa quando a função ainda não foi publicada', () => {
        expect(aiErrorMessage({ code: 'functions/not-found' })).toMatch(/não publicado/);
    });

    it('explica tempo esgotado, com ou sem mensagem do servidor', () => {
        expect(aiErrorMessage({ code: 'functions/deadline-exceeded', message: 'deadline-exceeded' }))
            .toBe('A IA não respondeu a tempo. Tente de novo em alguns minutos.');
        expect(aiErrorMessage({ code: 'functions/deadline-exceeded', message: 'A IA não respondeu a tempo (serviço sobrecarregado).' }))
            .toBe('A IA não respondeu a tempo (serviço sobrecarregado).');
    });

    it('usa a mensagem do servidor nos demais casos', () => {
        expect(aiErrorMessage({ code: 'functions/invalid-argument', message: 'Arquivo grande demais' })).toBe('Arquivo grande demais');
    });
});

describe('parseAiJson', () => {
    it('lê JSON puro ou dentro de bloco de código', () => {
        expect(parseAiJson('{"a":1}', 'o RDO')).toEqual({ a: 1 });
        expect(parseAiJson('```json\n{"a":1}\n```', 'o RDO')).toEqual({ a: 1 });
    });

    it('troca o erro técnico de resposta cortada por mensagem clara', () => {
        expect(() => parseAiJson('{"maoDeObra": [{"nome": "Técnico de Qualidade", "classificacao": "INDIRE', 'o RDO da Vale'))
            .toThrow('A IA devolveu uma resposta incompleta ao ler o RDO da Vale. Envie o arquivo de novo.');
    });
});
