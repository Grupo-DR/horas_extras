import { describe, expect, it } from 'vitest';
import { aiErrorMessage, toAiContents } from './aiGateway';

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

    it('usa a mensagem do servidor nos demais casos', () => {
        expect(aiErrorMessage({ code: 'functions/invalid-argument', message: 'Arquivo grande demais' })).toBe('Arquivo grande demais');
    });
});
