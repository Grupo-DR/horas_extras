import { describe, expect, it } from 'vitest';
import { classificarHistorico, extrairAtivo } from './historicoClassifier';
import { dataExcel, lerRazaoProtheus } from './razaoProtheus';

const CABECALHO = ['Filial', 'Data Lancamento', 'Centro de Custo', 'Centro de Custo Masc', 'Codigo da Conta', 'Cod Conta Masc', 'Descricao da Conta', 'Historico', 'Debito', 'Credito'];
// 46029.5 = 07/01/2026 (série do Excel, meio-dia)
const lanc = (hist: string, deb: number, cred = 0, filial = '0101', data = 46029.5) =>
  [filial, data, '301804', '3.0.1.804', '41202000003', '4.1.2.02.000003', 'LOCACAO DE VEICULOS', hist, deb, cred];
const continuacao = (hist: string) => ['0101', 46029.5, '301804', null, '41202000003', null, null, hist, '', ''];

describe('lerRazaoProtheus', () => {
  it('junta as linhas de continuação ao histórico do lançamento anterior', () => {
    const r = lerRazaoProtheus([
      CABECALHO,
      lanc('NF. 000005923 /  - OURO MINAS LOGISTICA LTDA - COMPRA LOCACAO FIAT STRA', 6505.74),
      continuacao('DA - PED. 045755000'),
      lanc('CX 12 - PADARIA - LANCHE EQUIPE', 0, 50),
    ]);
    expect(r.lancamentos).toHaveLength(2);
    expect(r.linhasContinuacao).toBe(1);
    expect(r.lancamentos[0].historico).toBe('NF. 000005923 /  - OURO MINAS LOGISTICA LTDA - COMPRA LOCACAO FIAT STRADA - PED. 045755000');
    expect(r.lancamentos[0]).toMatchObject({
      linha: 2, filial: '0101', data: '2026-01-07', competencia: '2026-01',
      centroCusto: '3.0.1.804', conta: '4.1.2.02.000003', debito: 6505.74, credito: 0,
      padrao: 'Nota Fiscal', codigo: '000005923', empresaPessoa: 'OURO MINAS LOGISTICA LTDA',
      descricao: 'COMPRA LOCACAO FIAT STRADA', pedido: '045755000',
    });
    expect(r.lancamentos[1]).toMatchObject({ padrao: 'Caixinha', empresaPessoa: 'PADARIA', linha: 4 });
  });

  it('aplica a máscara quando o arquivo traz só os códigos crus e normaliza a filial', () => {
    const header = ['FL', 'DATA', 'CUSTO', 'CONTA', 'HISTORICO', 'DEBITO', 'CREDITO'];
    const r = lerRazaoProtheus([header, [101, '15/02/2026', '301502', '31101000001', 'DOC. 123', 0, 1000]]);
    expect(r.lancamentos[0]).toMatchObject({ filial: '0101', data: '2026-02-15', centroCusto: '3.0.1.502', conta: '3.1.1.01.000001', padrao: 'DOC' });
  });

  it('lista competências e filiais e avisa datas inválidas com a linha da planilha', () => {
    const r = lerRazaoProtheus([
      CABECALHO,
      lanc('ESTORNO X', 10, 0, '0201', 46060.5), // 07/02/2026
      lanc('ESTORNO Y', 10, 0, '0101', 'sem data' as unknown as number),
    ]);
    expect(r.competencias).toEqual(['2026-02']);
    expect(r.filiais).toEqual(['0201']);
    expect(r.avisos).toEqual(['Linha 3: data inválida (sem data); lançamento ignorado.']);
  });

  it('recusa arquivo sem as colunas obrigatórias', () => {
    expect(() => lerRazaoProtheus([['Filial', 'Historico'], ['0101', 'x']])).toThrow('Colunas obrigatórias ausentes');
    expect(() => lerRazaoProtheus([['A', 'B'], [1, 2]])).toThrow('Cabeçalho do razão não encontrado');
  });

  it('converte a data do Excel sem deslocar o dia', () => {
    expect(dataExcel(46029.5)).toBe('2026-01-07');
    expect(dataExcel(46029)).toBe('2026-01-07');
    expect(dataExcel('7/1/2026')).toBe('2026-01-07');
  });
});

describe('classificarHistorico (tradução do protheus_parserV5.py)', () => {
  it('classifica folha, provisões e reversões', () => {
    expect(classificarHistorico('1234 - FOLHA INSS 20% EMPRESA')).toMatchObject({ padrao: 'Folha INSS 20%', codigo: '1234' });
    expect(classificarHistorico('1234 - 13 SALARIO FGTS 8%')).toMatchObject({ padrao: '13º FGTS 8%' });
    expect(classificarHistorico('P123-SALARIO MENSAL')).toMatchObject({ padrao: 'Folha Pagamento Interna', codigo: 'P123', descricao: 'SALARIO MENSAL' });
    expect(classificarHistorico('PROVISAO FERIAS NOV')).toMatchObject({ padrao: 'Provisão Férias' });
    expect(classificarHistorico('REVERSAO PROVISAO BONUS 2025')).toMatchObject({ padrao: 'Reversão Provisão Bônus' });
  });

  it('só marca depreciação quando o texto diz "DEPREC NO MES"', () => {
    expect(classificarHistorico('BEM: EH-069-0001 DEPREC NO MES').padrao).toBe('Depreciação');
    expect(classificarHistorico('BEM: EH-069-0001 BAIXA').padrao).toBe('Outros');
  });

  it('extrai os bens do ativo citados', () => {
    expect(extrairAtivo('MANUTENCAO EH 069 E CM-12')).toBe('EH-069, CM-12');
    expect(classificarHistorico('RATEIO BEM: CAD123-2026 DEPREC NO MES').ativo).toBe('CAD123, CAD-123');
  });

  it('texto vazio ou não textual vira "Outros"', () => {
    expect(classificarHistorico('')).toMatchObject({ padrao: 'Outros', observacao: '' });
    expect(classificarHistorico(42)).toMatchObject({ padrao: 'Outros', observacao: '42' });
  });
});
