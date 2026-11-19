import { describe, expect, it } from 'vitest';
import { utils } from 'xlsx';
import { ServiceItem } from '../types';
import { mapValeExtraction, normalizeAreaCondition, normalizeWeather, spanHours, valeWorkHours } from './valeRdoModel';
import { isValePQ, parseValePQ } from './valePQParser';
import { rdoDuplicateKey } from '../src/stores/rdoStore';

const services: ServiceItem[] = [
  { code: 'C.99.02.01.002', scope: '1.3.2.1.1 · Roçada', unit: 'm²', value: 3 },
  { code: 'C.99.01.01.007', scope: '1.3.1.1.5 · Limpeza de valeta até 0,8 x 0,6 m', unit: 'm', value: 30 },
];

const shifts = (manha: number, tarde: number) => ({
  contratado: 0, manhaOperacao: manha, manhaFiscalizado: manha,
  tardeOperacao: tarde, tardeFiscalizado: tarde, noiteOperacao: 0, noiteFiscalizado: 0,
});

/** Resposta da IA no formato do schema Vale (dados fictícios). */
const raw = {
  numeroRdo: '16',
  dataRdo: '08/10/2026', // quinta-feira
  numeroPedido: '48000000000',
  status: 'Em Aprovação pela Vale',
  horasTrabalhadas: { segundaAQuinta: '07:00 - 17:00', sexta: '07:00 - 16:00', sabado: '', domingo: '' },
  condicaoArea: 'PARCIAL',
  clima: { manha: 'ENSOLARADO', tarde: 'CHUVOSO', noite: '' },
  pluviometria: { manha: 0, tarde: 12.5, noite: 0 },
  prazos: { contratualDias: 350, decorridoDias: 75, faltanteDias: 275, prorrogadoDias: 0, inicioPrevisto: '07/08/2026', terminoPrevisto: '22/07/2027' },
  atividades: [
    { descricao: 'Roçada LE - km 38+730 ao 38+861 - total: 131 m²', servico: 'Roçada', lado: 'le', kmInicial: '38+730', kmFinal: '38+861', quantidade: 131, unidade: 'm²', codigoServico: 'C.99.02.01.002', confiancaCodigo: 'ALTA' },
    { descricao: 'Limpeza de valeta LD - total: 50 metros', servico: 'Limpeza de valeta', lado: 'LD', quantidade: 50, unidade: 'm', codigoServico: 'C.99.01.01.007', confiancaCodigo: 'MEDIA' },
    { descricao: 'Serviço inventado - total: 10 m', servico: 'X', quantidade: 10, unidade: 'm', codigoServico: 'C.00.00.00.999', confiancaCodigo: 'ALTA' },
  ],
  maoDeObra: [
    { nome: 'Servente', frenteObra: 'PACOTE 02', classificacao: 'Direto', ...shifts(13, 12) },
    { nome: 'Mecânico', frenteObra: 'PACOTE 02', classificacao: 'Indireto', ...shifts(0, 0) },
  ],
  equipamentos: [
    { nome: 'Retroescavadeira', frenteObra: 'PACOTE 02', classificacao: 'Direto', ...shifts(3, 3) },
  ],
  comentarios: [{ data: '19/10/2026', area: 'Contratada', usuario: 'fulano', comentario: 'Medição pela topografia.' }],
  assinaturas: [{ area: 'Fiscal', usuario: 'Fiscal Vale', data: '22/10/2026' }],
};

describe('horas da jornada Vale', () => {
  it('converte a faixa de horário em horas', () => {
    expect(spanHours('07:00 - 17:00')).toBe(10);
    expect(spanHours('22:00 - 06:00')).toBe(8);
    expect(spanHours('')).toBe(0);
  });

  it('usa a jornada do dia da semana menos 1 h de intervalo', () => {
    const horas = raw.horasTrabalhadas;
    expect(valeWorkHours('08/10/2026', horas)).toBe(9); // quinta
    expect(valeWorkHours('09/10/2026', horas)).toBe(8); // sexta
    expect(valeWorkHours('10/10/2026', horas)).toBe(0); // sábado sem jornada
  });
});

describe('mapValeExtraction', () => {
  const rdo = mapValeExtraction(raw, services);

  it('preenche o cabeçalho do RDO', () => {
    expect(rdo.reportNumber).toBe('16');
    expect(rdo.date).toBe('08/10/2026');
    expect(rdo.contractNumber).toBe('48000000000');
    expect(rdo.weatherAfternoon).toBe('Chuvoso');
    expect(rdo.rainIndexMm).toBe(12.5);
    expect(rdo.rdoModel).toBe('VALE_NOVAS_FERROVIAS');
  });

  it('aceita só códigos que existem na PQ e marca o que precisa de revisão', () => {
    const [rocada, valeta, inventado] = rdo.vale!.atividades;
    expect(rocada).toMatchObject({ codigoServico: 'C.99.02.01.002', lado: 'LE', revisar: false });
    expect(valeta).toMatchObject({ codigoServico: 'C.99.01.01.007', revisar: true });
    expect(inventado.codigoServico).toBeUndefined();
    expect(inventado.revisar).toBe(true);
    expect(rdo.activities.map((a) => a.code)).toEqual(['C.99.02.01.002', 'C.99.01.01.007', undefined]);
    expect(rdo.activities[0].quantity).toBe(131);
  });

  it('conta o maior efetivo em operação e calcula as horas pela jornada', () => {
    expect(rdo.workforce).toEqual([{ role: 'Servente', count: 13, totalHours: 117 }]);
    expect(rdo.equipment).toEqual([{ name: 'Retroescavadeira', count: 3, hoursOperated: 27 }]);
    expect(rdo.vale!.maoDeObra).toHaveLength(2); // a linha zerada fica no detalhe
  });

  it('registra área parcialmente operável como ocorrência', () => {
    expect(rdo.occurrences).toHaveLength(1);
    expect(rdo.occurrences[0].category).toBe('CONDICAO_AREA');
  });
});

describe('condição da área e clima escritos de outro jeito pela IA', () => {
  it('reconhece o texto do documento além do código pedido', () => {
    expect(normalizeAreaCondition('PARCIAL')).toBe('PARCIAL');
    expect(normalizeAreaCondition('OPERAVEL PARCIALMENTE')).toBe('PARCIAL');
    expect(normalizeAreaCondition('Operável Parcialmente')).toBe('PARCIAL');
    expect(normalizeAreaCondition('Inoperável')).toBe('INOPERAVEL');
    expect(normalizeAreaCondition('')).toBe('OPERAVEL');
    expect(normalizeWeather('Chuva')).toBe('CHUVOSO');
    expect(normalizeWeather('nublado')).toBe('NUBLADO');
    expect(normalizeWeather('Sol')).toBe('ENSOLARADO');
    expect(normalizeWeather('')).toBe('');
  });

  it('área "Operável Parcialmente" vira ocorrência', () => {
    const rdo = mapValeExtraction({ ...raw, condicaoArea: 'OPERAVEL PARCIALMENTE', clima: { manha: 'Chuva', tarde: 'Nublado', noite: '' } }, services);
    expect(rdo.occurrences).toHaveLength(1);
    expect(rdo.weatherMorning).toBe('Chuvoso');
  });
});

describe('parseValePQ', () => {
  const workbook = () => {
    const wb = utils.book_new();
    utils.book_append_sheet(wb, utils.aoa_to_sheet([['CAPA']]), 'F. Rosto');
    utils.book_append_sheet(wb, utils.aoa_to_sheet([
      ['PLANILHA DE QUANTIDADES E PREÇOS'],
      ['ITEM', 'EAP', '', 'Nº do Ativo', 'CÓD. ATIVIDADE', '', '', '', '', 'DESCRIÇÃO DAS ATIVIDADES', 'UNID.', 'CRITÉRIO DE MEDIÇÃO', '', '', '', '', 'QUANTIDADE', 'PREÇO'],
      ['', 'Área', 'SubÁrea', '', 'K', 'TT', 'UU', 'VVV', 'WWW', '', '', 'CMS', 'K', 'TT', 'UU', 'Seq', '', 'UNITÁRIO (R$)', 'TOTAL (R$)'],
      ['1.3', '', '', '', 'C', 99, '00', '00', '000', 'SERVIÇOS DE MANUTENÇÃO'],
      ['1.3.2.1.1', '', '', '', 'C', 99, '02', '01', '002', 'Roçada', 'm²', 'CMS', 'C', 99, 8, '000', 1000, 3.33, 3330],
      ['1.3.3.1.1', '', '', '', 'C', 99, '03', '01', '001', 'Reconstrução de cerca', 'm', 'CMS', 'C', 99, 13, '000', 10, 54.77, 547.7],
      ['1.3.3.1.1', '', '', '', 'C', 99, '03', '01', '002', 'Construção de cerca', 'm', 'CMS', 'C', 99, 14, '000', 10, 117.82, 1178.2],
    ]), 'Planilha de Quantidades');
    return wb;
  };

  it('reconhece a PQ da Vale pela aba', () => {
    expect(isValePQ(workbook())).toBe(true);
    expect(isValePQ(utils.book_new())).toBe(false);
  });

  it('lê só os itens pagáveis, com o CÓD. ATIVIDADE como código', () => {
    const items = parseValePQ(workbook());
    expect(items).toEqual([
      { code: 'C.99.02.01.002', scope: '1.3.2.1.1 · Roçada', unit: 'm²', value: 3.33 },
      { code: 'C.99.03.01.001', scope: '1.3.3.1.1 · Reconstrução de cerca', unit: 'm', value: 54.77 },
      { code: 'C.99.03.01.002', scope: '1.3.3.1.1 · Construção de cerca', unit: 'm', value: 117.82 },
    ]);
  });
});

describe('rdoDuplicateKey', () => {
  it('considera iguais RDOs da mesma turma, data e número (ignorando zeros à esquerda)', () => {
    expect(rdoDuplicateKey({ teamId: 't', date: '08/10/2026', reportNumber: '016' }))
      .toBe(rdoDuplicateKey({ teamId: 't', date: '08/10/2026', reportNumber: '16' }));
    expect(rdoDuplicateKey({ teamId: 't', date: '08/10/2026', reportNumber: '16' }))
      .not.toBe(rdoDuplicateKey({ teamId: 'outra', date: '08/10/2026', reportNumber: '16' }));
  });
});
