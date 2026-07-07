import React, { useMemo } from 'react';
import { OvertimeRecord, UserProfile, HeadcountRecord } from '../types';
import { getCCRegional } from '../data/ccMaster';
import { formatDecimalHours } from '../utils/formatters';
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid, Cell, LabelList } from 'recharts';
import { getPayrollCompetencyMonthKey, getPayrollMonthKey } from '../utils/overtime';

interface AbsenteeismDashboardProps {
  data: OvertimeRecord[];
  regional?: string;
  budgetMonthKeys: string[];
  dateMode: 'PAYROLL' | 'ANNUAL' | 'CUSTOM';
  selectedMonth: string;
  user: UserProfile | null;
  periodStart: Date;
  periodEnd: Date;
  headcountRecords: HeadcountRecord[];
}

export const isAtrasoEvent = (evento?: string): boolean => {
  const ev = (evento || '').trim().toUpperCase();
  return ev === 'DESCONTO_ATRASOS' || ev === 'DESCONTO ATRASOS';
};

export const isFaltaEvent = (evento?: string): boolean => {
  const ev = (evento || '').trim().toUpperCase();
  return ev === 'DESCONTO_FALTAS' || ev === 'DESCONTO FALTAS';
};

const formatPercent = (value: number) => {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
};

const AbsenteeismDashboard: React.FC<AbsenteeismDashboardProps> = ({ data, regional, headcountRecords }) => {
  
  const filteredData = useMemo(() => {
    return data.filter(record => isAtrasoEvent(record.EVENTO) || isFaltaEvent(record.EVENTO));
  }, [data]);

  const metrics = useMemo(() => {
    let horasAtrasos = 0;
    let horasFaltas = 0;

    filteredData.forEach(r => {
      const horas = Number(r.HORAS) || 0;
      if (isAtrasoEvent(r.EVENTO)) {
        horasAtrasos += horas;
      } else if (isFaltaEvent(r.EVENTO)) {
        horasFaltas += horas;
      }
    });

    const totalHoras = horasAtrasos + horasFaltas;
    const diasEquivalentes = totalHoras / 8;

    const uniqueChapas = new Set(headcountRecords.map(h => h.chapa)).size;
    const headcountReal = uniqueChapas > 0 ? uniqueChapas : 1;
    const horasPrevistas = headcountReal * 176;

    const taxaGeral = totalHoras / horasPrevistas;
    const taxaFaltas = horasFaltas / horasPrevistas;
    const taxaAtrasos = horasAtrasos / horasPrevistas;

    return {
      horasAtrasos,
      horasFaltas,
      totalHoras,
      diasEquivalentes,
      taxaGeral,
      taxaFaltas,
      taxaAtrasos,
      horasPrevistas,
      headcountReal
    };
  }, [filteredData, headcountRecords]);

  // Tabela por Regional
  const regionalMetrics = useMemo(() => {
    const regionalMap: Record<string, any> = {};
    
    // Precisamos do headcount por regional para calcular horas previstas e taxas
    const headcountPorRegional: Record<string, Set<string>> = {};
    headcountRecords.forEach(h => {
      const reg = getCCRegional(h.centroCusto || '') || 'Sede';
      if (!headcountPorRegional[reg]) headcountPorRegional[reg] = new Set();
      headcountPorRegional[reg].add(h.chapa);
    });

    filteredData.forEach(r => {
      const reg = getCCRegional(r.CODCCUSTO) || 'Sede';
      if (!regionalMap[reg]) {
        regionalMap[reg] = { atrasos: 0, faltas: 0, total: 0 };
      }
      const horas = Number(r.HORAS) || 0;
      if (isAtrasoEvent(r.EVENTO)) {
        regionalMap[reg].atrasos += horas;
        regionalMap[reg].total += horas;
      } else if (isFaltaEvent(r.EVENTO)) {
        regionalMap[reg].faltas += horas;
        regionalMap[reg].total += horas;
      }
    });
    
    // Complementar com as taxas calculadas
    Object.keys(regionalMap).forEach(reg => {
       const hCount = headcountPorRegional[reg] ? headcountPorRegional[reg].size : 1;
       const hPrev = hCount > 0 ? hCount * 176 : 176;
       regionalMap[reg].horasPrevistas = hPrev;
       regionalMap[reg].taxaGeral = regionalMap[reg].total / hPrev;
       regionalMap[reg].taxaFaltas = regionalMap[reg].faltas / hPrev;
       regionalMap[reg].taxaAtrasos = regionalMap[reg].atrasos / hPrev;
    });

    return regionalMap;
  }, [filteredData, headcountRecords]);

  const regionals = Object.keys(regionalMetrics).sort();

  // Funções para resultados da Tabela
  const getTaxaResultado = (executado: number, meta: number) => {
    return 1 - executado;
  };
  const getHorasResultado = (executado: number, previsto: number) => {
    if (previsto === 0) return 1;
    return 1 - (executado / previsto);
  };

  const renderBadge = (resultado: number) => {
    const pct = resultado * 100;
    let color = 'bg-red-100 text-red-700'; // < 95%
    if (pct >= 97) color = 'bg-emerald-100 text-emerald-700';
    else if (pct >= 95) color = 'bg-amber-100 text-amber-700';

    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${color}`}>
        {formatPercent(pct)}
      </span>
    );
  };

  // Evolução Mensal
  const chartData = useMemo(() => {
    const monthlyData: Record<string, { monthLabel: string, atrasos: number, faltas: number }> = {};
    const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    
    filteredData.forEach(r => {
      const monthKey = getPayrollMonthKey(r.DATA) || 'Unknown';
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { monthLabel: monthKey, atrasos: 0, faltas: 0 };
      }
      
      const horas = Number(r.HORAS) || 0;
      if (isAtrasoEvent(r.EVENTO)) {
        monthlyData[monthKey].atrasos += horas;
      } else if (isFaltaEvent(r.EVENTO)) {
        monthlyData[monthKey].faltas += horas;
      }
    });

    return Object.values(monthlyData).sort((a, b) => a.monthLabel.localeCompare(b.monthLabel)).map(item => {
      const total = item.atrasos + item.faltas;
      const hCount = new Set(headcountRecords.map(h => h.chapa)).size || 1; 
      const hPrev = hCount * 176;
      let displayLabel = item.monthLabel;
      if (displayLabel !== 'Unknown') {
        const clean = displayLabel.replace(/-Payroll$/i, '');
        const parts = clean.split('-');
        if (parts.length >= 2) {
          const m = parseInt(parts[1], 10);
          if (m >= 1 && m <= 12) {
            displayLabel = `${monthNames[m - 1]}/${parts[0].slice(-2)}`;
          }
        }
      }

      return {
        ...item,
        displayLabel,
        total,
        taxaAbsenteismo: Number(((total / hPrev) * 100).toFixed(2))
      };
    });
  }, [filteredData, headcountRecords]);

  // formatters
  const pctTotal = (part: number, total: number) => total > 0 ? (part / total) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Cards Superiores */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        
        {/* Card: Taxa Absenteísmo */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start mb-1">
              <h3 className="text-lg font-bold text-[#1e3a8a]">TAXA ABSENTEÍSMO</h3>
              <span className="bg-orange-500 text-white text-[10px] font-bold px-2 py-1 rounded-full uppercase">Atenção</span>
            </div>
            <p className="text-xs text-gray-500 mb-6">Jornada mensal de 176h | Headcount rateado</p>
            
            <div className="flex justify-between items-end mb-4">
              <div>
                <div className="text-4xl font-bold text-gray-900 leading-none mb-1">
                  {formatPercent(metrics.taxaGeral * 100)}
                </div>
                <div className="text-xs text-gray-500 font-medium">Taxa geral</div>
              </div>
              
              <div className="flex gap-8 text-right">
                <div className="border-l border-gray-200 pl-4">
                  <div className="text-xs text-gray-500 font-medium mb-1">Taxa Faltas</div>
                  <div className="text-xl font-bold text-gray-900">{formatPercent(metrics.taxaFaltas * 100)}</div>
                  <div className="text-[10px] text-gray-400">{formatPercent(pctTotal(metrics.horasFaltas, metrics.totalHoras))}% do total</div>
                </div>
                <div className="border-l border-gray-200 pl-4">
                  <div className="text-xs text-gray-500 font-medium mb-1">Taxa Atrasos</div>
                  <div className="text-xl font-bold text-gray-900">{formatPercent(metrics.taxaAtrasos * 100)}</div>
                  <div className="text-[10px] text-gray-400">{formatPercent(pctTotal(metrics.horasAtrasos, metrics.totalHoras))}% do total</div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex h-2.5 rounded-full overflow-hidden">
            <div style={{ width: `${pctTotal(metrics.horasFaltas, metrics.totalHoras)}%` }} className="bg-[#1e3a8a]" title="Faltas"></div>
            <div style={{ width: `${pctTotal(metrics.horasAtrasos, metrics.totalHoras)}%` }} className="bg-orange-500" title="Atrasos"></div>
          </div>
        </div>

        {/* Card: Horas de Absenteísmo */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start mb-1">
              <h3 className="text-lg font-bold text-[#1e3a8a] uppercase">Horas de Absenteísmo</h3>
              <div className="text-right">
                <div className="text-2xl font-bold text-gray-900">{formatDecimalHours(metrics.totalHoras)} h</div>
                <div className="text-[10px] text-gray-500">Total de horas</div>
              </div>
            </div>
            <p className="text-xs text-gray-500 mb-6">Volume de horas perdidas no período</p>
            
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <div className="text-xs text-gray-500 font-medium mb-1">Faltas</div>
                <div className="text-xl font-bold text-[#1e3a8a]">{formatDecimalHours(metrics.horasFaltas)} h</div>
                <div className="text-[10px] text-gray-400">{formatPercent(pctTotal(metrics.horasFaltas, metrics.totalHoras))}% do total</div>
              </div>
              <div className="border-l border-gray-200 pl-4">
                <div className="text-xs text-gray-500 font-medium mb-1">Atrasos</div>
                <div className="text-xl font-bold text-[#3b82f6]">{formatDecimalHours(metrics.horasAtrasos)} h</div>
                <div className="text-[10px] text-gray-400">{formatPercent(pctTotal(metrics.horasAtrasos, metrics.totalHoras))}% do total</div>
              </div>
              <div className="border-l border-gray-200 pl-4">
                <div className="text-xs text-gray-500 font-medium mb-1">Dias equivalentes</div>
                <div className="text-xl font-bold text-gray-900">{metrics.diasEquivalentes.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}</div>
                <div className="text-[10px] text-gray-400">base 8h/dia</div>
              </div>
            </div>
          </div>
          
          <div className="flex h-2.5 rounded-full overflow-hidden">
            <div style={{ width: `${pctTotal(metrics.horasFaltas, metrics.totalHoras)}%` }} className="bg-[#1e3a8a]" title="Faltas"></div>
            <div style={{ width: `${pctTotal(metrics.horasAtrasos, metrics.totalHoras)}%` }} className="bg-[#3b82f6]" title="Atrasos"></div>
          </div>
        </div>

      </div>

      {/* Tabela de Absenteísmo por Regional */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 overflow-hidden">
        <h3 className="text-base font-bold text-[#1e3a8a] mb-1">Absenteísmo por Regional</h3>
        <p className="text-xs text-gray-500 mb-6">Visão executiva dos indicadores de absenteísmo por regional e total</p>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr>
                <th className="px-4 py-3 bg-gray-50 text-gray-700 font-bold border-b border-gray-200">KPIs de Absenteísmo</th>
                {regionals.map(reg => (
                  <th key={reg} colSpan={3} className="px-4 py-3 bg-gray-50 text-gray-700 font-bold border-b border-gray-200 text-center border-l border-gray-200">
                    {reg}
                  </th>
                ))}
                <th colSpan={3} className="px-4 py-3 bg-gray-50 text-gray-700 font-bold border-b border-gray-200 text-center border-l border-gray-200">
                  Total
                </th>
              </tr>
              <tr>
                <th className="px-4 py-2 bg-gray-50 border-b border-gray-200"></th>
                {regionals.map(reg => (
                  <React.Fragment key={`sub-${reg}`}>
                    <th className="px-2 py-2 bg-gray-50 text-xs font-semibold text-gray-500 border-b border-gray-200 text-center border-l border-gray-200">Meta</th>
                    <th className="px-2 py-2 bg-gray-50 text-xs font-semibold text-gray-500 border-b border-gray-200 text-center">Executado</th>
                    <th className="px-2 py-2 bg-gray-50 text-xs font-semibold text-gray-500 border-b border-gray-200 text-center">Resultado</th>
                  </React.Fragment>
                ))}
                <th className="px-2 py-2 bg-gray-50 text-xs font-semibold text-gray-500 border-b border-gray-200 text-center border-l border-gray-200">Meta</th>
                <th className="px-2 py-2 bg-gray-50 text-xs font-semibold text-gray-500 border-b border-gray-200 text-center">Executado</th>
                <th className="px-2 py-2 bg-gray-50 text-xs font-semibold text-gray-500 border-b border-gray-200 text-center">Resultado</th>
              </tr>
            </thead>
            <tbody>
              {/* Row 1: Taxa de Absenteísmo */}
              <tr className="border-b border-gray-100 hover:bg-gray-50/50">
                <td className="px-4 py-3 font-medium text-gray-700">Taxa de Absenteísmo</td>
                {regionals.map(reg => {
                  const exec = regionalMetrics[reg].taxaGeral;
                  const res = getTaxaResultado(exec, 0.03);
                  return (
                    <React.Fragment key={`taxa-geral-${reg}`}>
                      <td className="px-2 py-3 text-center text-gray-500 border-l border-gray-100">3,00%</td>
                      <td className="px-2 py-3 text-center font-medium">{formatPercent(exec * 100)}</td>
                      <td className="px-2 py-3 text-center">{renderBadge(res)}</td>
                    </React.Fragment>
                  );
                })}
                <td className="px-2 py-3 text-center text-gray-500 border-l border-gray-100">3,00%</td>
                <td className="px-2 py-3 text-center font-medium">{formatPercent(metrics.taxaGeral * 100)}</td>
                <td className="px-2 py-3 text-center">{renderBadge(getTaxaResultado(metrics.taxaGeral, 0.03))}</td>
              </tr>
              
              {/* Row 2: Taxa de Atrasos */}
              <tr className="border-b border-gray-100 hover:bg-gray-50/50">
                <td className="px-4 py-3 font-medium text-gray-700 pl-8 text-gray-500">Taxa de Atrasos</td>
                {regionals.map(reg => {
                  const exec = regionalMetrics[reg].taxaAtrasos;
                  const res = getTaxaResultado(exec, 0.02);
                  return (
                    <React.Fragment key={`taxa-atrasos-${reg}`}>
                      <td className="px-2 py-3 text-center text-gray-500 border-l border-gray-100">2,00%</td>
                      <td className="px-2 py-3 text-center font-medium">{formatPercent(exec * 100)}</td>
                      <td className="px-2 py-3 text-center">{renderBadge(res)}</td>
                    </React.Fragment>
                  );
                })}
                <td className="px-2 py-3 text-center text-gray-500 border-l border-gray-100">2,00%</td>
                <td className="px-2 py-3 text-center font-medium">{formatPercent(metrics.taxaAtrasos * 100)}</td>
                <td className="px-2 py-3 text-center">{renderBadge(getTaxaResultado(metrics.taxaAtrasos, 0.02))}</td>
              </tr>

              {/* Row 3: Taxa de Faltas */}
              <tr className="border-b border-gray-100 hover:bg-gray-50/50">
                <td className="px-4 py-3 font-medium text-gray-700 pl-8 text-gray-500">Taxa de Faltas</td>
                {regionals.map(reg => {
                  const exec = regionalMetrics[reg].taxaFaltas;
                  const res = getTaxaResultado(exec, 0.01);
                  return (
                    <React.Fragment key={`taxa-faltas-${reg}`}>
                      <td className="px-2 py-3 text-center text-gray-500 border-l border-gray-100">1,00%</td>
                      <td className="px-2 py-3 text-center font-medium">{formatPercent(exec * 100)}</td>
                      <td className="px-2 py-3 text-center">{renderBadge(res)}</td>
                    </React.Fragment>
                  );
                })}
                <td className="px-2 py-3 text-center text-gray-500 border-l border-gray-100">1,00%</td>
                <td className="px-2 py-3 text-center font-medium">{formatPercent(metrics.taxaFaltas * 100)}</td>
                <td className="px-2 py-3 text-center">{renderBadge(getTaxaResultado(metrics.taxaFaltas, 0.01))}</td>
              </tr>

              {/* Row 4: Horas de Absenteísmo */}
              <tr className="border-b border-gray-100 hover:bg-gray-50/50 bg-gray-50/30">
                <td className="px-4 py-3 font-medium text-gray-700">Horas de Absenteísmo</td>
                {regionals.map(reg => {
                  const exec = regionalMetrics[reg].total;
                  const prev = regionalMetrics[reg].horasPrevistas;
                  const meta = prev * 0.03;
                  const res = getHorasResultado(exec, prev);
                  return (
                    <React.Fragment key={`horas-geral-${reg}`}>
                      <td className="px-2 py-3 text-center text-gray-500 border-l border-gray-100">{formatDecimalHours(meta)}</td>
                      <td className="px-2 py-3 text-center font-medium">{formatDecimalHours(exec)}</td>
                      <td className="px-2 py-3 text-center">{renderBadge(res)}</td>
                    </React.Fragment>
                  );
                })}
                <td className="px-2 py-3 text-center text-gray-500 border-l border-gray-100">{formatDecimalHours(metrics.horasPrevistas * 0.03)}</td>
                <td className="px-2 py-3 text-center font-medium">{formatDecimalHours(metrics.totalHoras)}</td>
                <td className="px-2 py-3 text-center">{renderBadge(getHorasResultado(metrics.totalHoras, metrics.horasPrevistas))}</td>
              </tr>

              {/* Row 5: Horas de Atrasos */}
              <tr className="border-b border-gray-100 hover:bg-gray-50/50 bg-gray-50/30">
                <td className="px-4 py-3 font-medium text-gray-700 pl-8 text-gray-500">Horas de Atrasos</td>
                {regionals.map(reg => {
                  const exec = regionalMetrics[reg].atrasos;
                  const prev = regionalMetrics[reg].horasPrevistas;
                  const meta = prev * 0.02;
                  const res = getHorasResultado(exec, prev);
                  return (
                    <React.Fragment key={`horas-atrasos-${reg}`}>
                      <td className="px-2 py-3 text-center text-gray-500 border-l border-gray-100">{formatDecimalHours(meta)}</td>
                      <td className="px-2 py-3 text-center font-medium">{formatDecimalHours(exec)}</td>
                      <td className="px-2 py-3 text-center">{renderBadge(res)}</td>
                    </React.Fragment>
                  );
                })}
                <td className="px-2 py-3 text-center text-gray-500 border-l border-gray-100">{formatDecimalHours(metrics.horasPrevistas * 0.02)}</td>
                <td className="px-2 py-3 text-center font-medium">{formatDecimalHours(metrics.horasAtrasos)}</td>
                <td className="px-2 py-3 text-center">{renderBadge(getHorasResultado(metrics.horasAtrasos, metrics.horasPrevistas))}</td>
              </tr>

              {/* Row 6: Horas de Faltas */}
              <tr className="hover:bg-gray-50/50 bg-gray-50/30">
                <td className="px-4 py-3 font-medium text-gray-700 pl-8 text-gray-500">Horas de Faltas</td>
                {regionals.map(reg => {
                  const exec = regionalMetrics[reg].faltas;
                  const prev = regionalMetrics[reg].horasPrevistas;
                  const meta = prev * 0.01;
                  const res = getHorasResultado(exec, prev);
                  return (
                    <React.Fragment key={`horas-faltas-${reg}`}>
                      <td className="px-2 py-3 text-center text-gray-500 border-l border-gray-100">{formatDecimalHours(meta)}</td>
                      <td className="px-2 py-3 text-center font-medium">{formatDecimalHours(exec)}</td>
                      <td className="px-2 py-3 text-center">{renderBadge(res)}</td>
                    </React.Fragment>
                  );
                })}
                <td className="px-2 py-3 text-center text-gray-500 border-l border-gray-100">{formatDecimalHours(metrics.horasPrevistas * 0.01)}</td>
                <td className="px-2 py-3 text-center font-medium">{formatDecimalHours(metrics.horasFaltas)}</td>
                <td className="px-2 py-3 text-center">{renderBadge(getHorasResultado(metrics.horasFaltas, metrics.horasPrevistas))}</td>
              </tr>
            </tbody>
          </table>
        </div>
      
      {/* Gráfico */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-base font-bold text-[#1e3a8a] mb-6">Evolução Mensal - Taxa de Absenteísmo</h3>
        <div className="h-[350px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="displayLabel" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="left" tickFormatter={(v) => `${v / 1000} Mil`} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} label={{ value: 'Horas Atrasos e Horas Faltas', angle: -90, position: 'insideLeft', style: { fontSize: 11, fill: '#64748b' } }} />
              <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} label={{ value: 'Taxa Absenteísmo', angle: 90, position: 'insideRight', style: { fontSize: 11, fill: '#64748b' } }} />
              <Tooltip 
                 formatter={(value: any, name: any) => {
                    if (name === 'Taxa Absenteísmo') return [`${value}%`, name];
                    return [value.toLocaleString('pt-BR'), name];
                 }}
              />
              <Legend verticalAlign="top" align="left" iconType="circle" wrapperStyle={{ paddingBottom: '20px', fontSize: '12px' }} />
              
              <Bar yAxisId="left" dataKey="atrasos" stackId="a" name="Horas Atrasos" fill="#3b82f6" barSize={35} />
              <Bar yAxisId="left" dataKey="faltas" stackId="a" name="Horas Faltas" fill="#1e3a8a" barSize={35}>
                <LabelList dataKey="total" position="top" formatter={(v: any) => Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} style={{ fontSize: '10px', fill: '#64748b' }} />
              </Bar>
              <Line yAxisId="right" type="monotone" dataKey="taxaAbsenteismo" name="Taxa Absenteísmo" stroke="#f97316" strokeWidth={2} dot={{ r: 4, fill: '#f97316', strokeWidth: 0 }} strokeDasharray="3 3" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
    </div>
  );
};

export default AbsenteeismDashboard;

