import { describe, expect, it } from 'vitest';
import { abaDoPlano, DivergenciaMesError, lerPlanilhaPlano, mesDoNome, TIPOS_FORECAST } from './budgetForecast';
import { lerDimensoes } from './dimensoes';
import { abaDosGerenciais, lerValoresGerenciais } from './valoresGerenciais';

// Séries do Excel: 46023 = 01/01/2026, 46054 = 01/02/2026, 46266 = 01/09/2026
const JAN26 = 46023;
const FEV26 = 46054;
const SET26 = 46266;

const CAB_PLANO = ['Mês', 'CC DR', 'Grupo', 'Conta', 'Descrição', 'Tipo', 'Valor', 'Classe', 'Ano'];
const plano = (mes: string, data: unknown, valor: unknown = 100, conta = '4.1.2.02.000003') =>
  [mes, '1.0.0.1', 'Receita', conta, 'LOCACAO', 'Faturamento', valor, 'Receita', data];

describe('lerPlanilhaPlano (Budget/Forecast)', () => {
  it('usa a data da coluna "Ano" como competência e soma por mês', () => {
    const r = lerPlanilhaPlano([CAB_PLANO, plano('Janeiro', JAN26, 100), plano('Janeiro', JAN26, 50), plano('Fevereiro', FEV26, -30)]);
    expect(r.ano).toBe(2026);
    expect(r.linhas).toHaveLength(3);
    expect(r.porMes).toEqual({ '2026-01': 150, '2026-02': -30 });
    expect(r.total).toBe(120);
  });

  it('aceita o erro de digitação "Feveiro" (compara as 3 primeiras letras)', () => {
    expect(mesDoNome('Feveiro')).toBe(2);
    expect(mesDoNome('março')).toBe(3);
    expect(mesDoNome('xyz')).toBeNull();
    expect(lerPlanilhaPlano([CAB_PLANO, plano('Feveiro', FEV26)]).linhas).toHaveLength(1);
  });

  it('recusa o arquivo quando o nome do mês diverge da data, com total e até 20 exemplos', () => {
    const rows = [CAB_PLANO, plano('Janeiro', JAN26), ...Array.from({ length: 25 }, () => plano('Outubro', SET26))];
    try {
      lerPlanilhaPlano(rows);
      expect.fail('deveria recusar');
    } catch (e) {
      expect(e).toBeInstanceOf(DivergenciaMesError);
      const d = e as DivergenciaMesError;
      expect(d.total).toBe(25);
      expect(d.exemplos).toHaveLength(20);
      expect(d.exemplos[0]).toEqual({ linha: 3, mesInformado: 'Outubro', dataInformada: '2026-09-01' });
      expect(d.message).toContain('25 linha(s)');
      expect(d.message).toContain('linha 3 (Outubro × 01/09/2026)');
    }
  });

  it('ignora com aviso linhas de data inválida, valor não numérico ou sem conta', () => {
    const r = lerPlanilhaPlano([
      CAB_PLANO, plano('Janeiro', JAN26),
      plano('Maio', '01/05/01/05/2025'), plano('Janeiro', JAN26, 'abc'), plano('Janeiro', JAN26, 10, ''),
    ]);
    expect(r.linhas).toHaveLength(1);
    expect(r.avisos).toHaveLength(3);
    expect(r.avisos[0]).toContain('Linha 3');
  });

  it('recusa arquivo com mais de um ano', () => {
    expect(() => lerPlanilhaPlano([CAB_PLANO, plano('Janeiro', JAN26), plano('Janeiro', '01/01/2025')])).toThrow(/mais de um ano/);
  });

  it('acha a aba de dados e ignora tabelas dinâmicas', () => {
    expect(abaDoPlano({ Planilha1: [['Rótulos', 'Soma']], 'Budget 2026': [CAB_PLANO] })).toBe('Budget 2026');
  });

  it('aceita só os tipos de Forecast 3+9, 6+6 e 9+3', () => {
    expect(TIPOS_FORECAST).toEqual(['3+9', '6+6', '9+3']);
  });
});

describe('lerDimensoes', () => {
  const abaCC = [
    ['CC Totvs', 'Identificação', 'CC DR', 'Tipo CC', 'Status', 'Regional'],
    ['3.0.1.804', 'Obra X', '1.0.0.1', 'Obra', 'Ativo', 'Diego Teixeira'],
    ['3.0.1.804', 'Obra X (dup)', '1.0.0.1', 'Obra', 'Ativo', 'Diego Teixeira'],
  ];
  const abaContas = [
    ['Conta', 'Descrição', 'Grupo', 'Tipo Conta', 'Tipo Conta 2'],
    ['4.1.2.02.000003', 'LOCACAO', 'Receita', 'Faturamento', ''],
    ['3.1.1.01.000001', 'SALARIOS', 'Pessoal', 'Outro', ''],
  ];

  it('acha as abas pelo cabeçalho, mantém a primeira chave repetida e avisa tipos desconhecidos', () => {
    const r = lerDimensoes({ Contas: abaContas, 'Centro de Custo': abaCC });
    expect(r.centros).toHaveLength(1);
    expect(r.centros[0].identificacao).toBe('Obra X');
    expect(r.contas).toHaveLength(2);
    expect(r.avisos.some(a => a.includes('repetido'))).toBe(true);
    expect(r.avisos.some(a => a.includes('3.1.1.01.000001') && a.includes('"Outro"'))).toBe(true);
  });

  it('falha se faltar uma das abas', () => {
    expect(() => lerDimensoes({ Contas: abaContas })).toThrow(/centros de custo/);
  });
});

describe('lerValoresGerenciais', () => {
  const CAB = ['CUSTO', 'CONTA', 'DATA', 'HISTORICO', 'DEBITO', 'CREDITO'];

  it('não junta continuações: débito e crédito vazios valem 0', () => {
    const r = lerValoresGerenciais([
      CAB,
      ['3.0.1.804', '4.1.2.02.000003', JAN26, 'MEDICAO GERENCIAL', 1000, null],
      ['3.0.1.804', '4.1.2.02.000003', FEV26, 'AJUSTE', null, null],
    ]);
    expect(r.lancamentos).toHaveLength(2);
    expect(r.lancamentos[1]).toMatchObject({ debito: 0, credito: 0, historico: 'AJUSTE', competencia: '2026-02' });
    expect(r.competencias).toEqual(['2026-01', '2026-02']);
  });

  it('ignora com aviso linhas sem conta ou com data inválida', () => {
    const r = lerValoresGerenciais([CAB, ['3.0.1.804', '', JAN26, 'x', 1, 0], ['3.0.1.804', '4.1', 'abc', 'x', 1, 0], ['3.0.1.804', '4.1', JAN26, 'ok', 1, 0]]);
    expect(r.lancamentos).toHaveLength(1);
    expect(r.avisos).toHaveLength(2);
  });

  it('acha a aba "Fatos Fora Totvs"', () => {
    expect(abaDosGerenciais({ Planilha1: [['x']], 'Fatos Fora Totvs': [CAB] })).toBe('Fatos Fora Totvs');
  });
});
