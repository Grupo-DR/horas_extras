import { describe, expect, it } from 'vitest';
import {
  addBaselineRevision, buildSCurve, buildWeeks, isoWeek, mondayOf, newSCurveDoc,
  parseCellNumber, parsePastedColumn, setWeeklyValues,
} from './sCurve';

describe('semanas', () => {
  it('segue a numeração da planilha: semana 21/2025 = 19/05 a 25/05', () => {
    const [first, second] = buildWeeks('2025-05-21', 2); // quarta-feira: volta para a segunda
    expect(first).toEqual({ key: '2025-05-19', label: '19/05 a 25/05', week: 21, year: 2025 });
    expect(second.label).toBe('26/05 a 01/06');
  });

  it('vira o ano pela regra ISO (29/12/2025 é semana 1 de 2026)', () => {
    expect(isoWeek('2025-12-29')).toEqual({ week: 1, year: 2026 });
    expect(mondayOf('2026-01-04')).toBe('2025-12-29');
  });
});

describe('buildSCurve', () => {
  const base = () => {
    const doc = newSCurveDoc('p1', '2025-05-19', 6);
    const weeks = buildWeeks(doc.startWeek, doc.weekCount);
    const keys = weeks.map(w => w.key);
    return { doc, keys };
  };

  it('acumula previsto e realizado físico e calcula o desvio até a semana de status', () => {
    const { doc, keys } = base();
    doc.baselines[0].fisico = { [keys[0]]: 10, [keys[1]]: 20, [keys[2]]: 30, [keys[3]]: 40 };
    doc.realizado.fisico = { [keys[0]]: 8, [keys[1]]: 15 };
    const r = buildSCurve(doc, 'fisico');

    expect(r.rows.map(x => x.previstoAcum)).toEqual([10, 30, 60, 100, 100, 100]);
    expect(r.rows.map(x => x.realizadoAcum)).toEqual([8, 23, null, null, null, null]);
    expect(r.statusWeek?.key).toBe(keys[1]);
    expect(r.desvioNoStatus).toBe(-7);
    expect(r.terminoLB?.key).toBe(keys[3]);
  });

  it('tendência começa no realizado da semana de status e soma a tendência semanal (regra da planilha)', () => {
    const { doc, keys } = base();
    doc.baselines[0].fisico = { [keys[0]]: 25, [keys[1]]: 25, [keys[2]]: 25, [keys[3]]: 25 };
    doc.realizado.fisico = { [keys[0]]: 20, [keys[1]]: 20 };
    doc.tendencia.fisico = { [keys[2]]: 30, [keys[3]]: 25, [keys[4]]: 5, [keys[0]]: 99 }; // antes do status é ignorada
    const r = buildSCurve(doc, 'fisico');

    expect(r.rows.map(x => x.tendenciaAcum)).toEqual([null, 40, 70, 95, 100, 100]);
    expect(r.terminoTendencia?.key).toBe(keys[4]);
    expect(r.tendenciaFinal).toBe(100);
  });

  it('financeiro em R$ vira % sobre o total da linha de base vigente', () => {
    const { doc, keys } = base();
    doc.baselines[0].financeiro = { [keys[0]]: 250_000, [keys[1]]: 750_000 };
    doc.realizado.financeiro = { [keys[0]]: 100_000 };
    const r = buildSCurve(doc, 'financeiro');

    expect(r.baselineTotal).toBe(1_000_000);
    expect(r.rows[0].previsto).toBe(25);
    expect(r.rows[1].previstoAcum).toBe(100);
    expect(r.rows[0].realizado).toBe(10);
    expect(r.desvioNoStatus).toBe(-15);
  });

  it('revisão da linha de base copia a vigente e passa a ser a referência; a LB0 continua no gráfico', () => {
    const { doc, keys } = base();
    doc.baselines[0].fisico = { [keys[0]]: 50, [keys[1]]: 50 };
    const revised = addBaselineRevision(doc);
    revised.baselines[1].fisico = { ...revised.baselines[1].fisico, [keys[0]]: 30, [keys[1]]: 30, [keys[2]]: 40 };
    const r = buildSCurve(revised, 'fisico');

    expect(revised.baselines.map(b => b.name)).toEqual(['LB0', 'LB1']);
    expect(doc.baselines[0].fisico[keys[0]]).toBe(50); // a LB0 não foi alterada
    expect(r.rows[1].previstoAcum).toBe(60);
    expect(r.rows[1].previstoLB0Acum).toBe(100);

    revised.realizado.fisico = { [keys[0]]: 20, [keys[1]]: 30 };
    const withReal = buildSCurve(revised, 'fisico');
    expect(withReal.desvioNoStatus).toBe(-10);     // 50% realizado × 60% da LB1
    expect(withReal.desvioLB0NoStatus).toBe(-50);  // × 100% da LB0 (como a linha "Desvio a reportar")
  });

  it('sem realizado não há semana de status nem tendência', () => {
    const { doc } = base();
    const r = buildSCurve(doc, 'fisico');
    expect(r.statusWeek).toBeNull();
    expect(r.rows.every(x => x.tendenciaAcum === null && x.realizadoAcum === null)).toBe(true);
  });
});

describe('digitação e colagem', () => {
  it('lê números no formato brasileiro, com % ou R$', () => {
    expect(parseCellNumber('2,45')).toBe(2.45);
    expect(parseCellNumber('2,45%')).toBe(2.45);
    expect(parseCellNumber('R$ 458.427,48')).toBe(458427.48);
    expect(parseCellNumber('1.200.000')).toBe(1200000);
    expect(parseCellNumber('458427.48')).toBe(458427.48);
    expect(parseCellNumber('')).toBeNull();
    expect(parseCellNumber('-')).toBeNull();
  });

  it('coluna física colada como fração (0,0245) vira pontos percentuais', () => {
    expect(parsePastedColumn('0\n0,0005\n0,001\n', 'fisico')).toEqual([0, 0.05, 0.1]);
    expect(parsePastedColumn('0,05%\n0,10%', 'fisico')).toEqual([0.05, 0.1]);
    expect(parsePastedColumn('2,5\n3', 'fisico')).toEqual([2.5, 3]);
  });

  it('coluna financeira colada mantém os R$ e lê só a primeira coluna', () => {
    expect(parsePastedColumn('R$ 458.427,48\tx\n573.034,35\r\n', 'financeiro')).toEqual([458427.48, 573034.35]);
  });

  it('grava a partir da semana escolhida e apaga com célula vazia', () => {
    const weeks = buildWeeks('2025-05-19', 3);
    const series = setWeeklyValues({ [weeks[2].key]: 9 }, weeks, 1, [5, null, 7]);
    expect(series).toEqual({ [weeks[1].key]: 5 }); // a 3ª apagada; o valor além do fim é ignorado
  });
});
