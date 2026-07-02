import React, { useMemo, useState } from 'react';
import { MonthlyResourceFact } from '../../src/analytics/engines/resourcesMonthlyEngine';
import { DimensionGroup } from '../../src/analytics/types/analyticsTypes';

interface ResourcesMatrixTableProps {
  facts: MonthlyResourceFact[];
}

const formatValue = (v: number, isCurrency: boolean) => {
  if (v === 0) return isCurrency ? 'R$ 0,00' : '0,00';
  return v.toLocaleString('pt-BR', {
    style: isCurrency ? 'currency' : 'decimal',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const getMonthAbbr = (monthStr: string) => {
  const map: Record<string, string> = {
    '01': 'JAN', '02': 'FEV', '03': 'MAR', '04': 'ABR',
    '05': 'MAI', '06': 'JUN', '07': 'JUL', '08': 'AGO',
    '09': 'SET', '10': 'OUT', '11': 'NOV', '12': 'DEZ'
  };
  return map[monthStr] || monthStr;
};

export const ResourcesMatrixTable: React.FC<ResourcesMatrixTableProps> = ({ facts }) => {
  const [selectedGroup, setSelectedGroup] = useState<'ALL' | DimensionGroup>('ALL');

  const { allMonths, groupedData } = useMemo(() => {
    // Filter facts based on selected group
    const filteredFacts = selectedGroup === 'ALL' ? facts : facts.filter(f => f.group === selectedGroup);

    // Collect all unique monthKeys from the FILTERED facts
    const monthKeys = Array.from(new Set(filteredFacts.map(f => f.monthKey))).sort();
    
    // Group by Year -> Month
    const monthsByYear: Record<string, string[]> = {};
    monthKeys.forEach(mk => {
      const [year, month] = mk.split('-');
      if (!monthsByYear[year]) monthsByYear[year] = [];
      monthsByYear[year].push(month);
    });

    // Group facts by group -> itemStandard
    const dataByItem: Record<string, Record<string, any>> = {};
    
    filteredFacts.forEach(fact => {
      const g = fact.group || 'OTHER';
      const itemKey = fact.itemStandard || 'Desconhecido';
      
      if (!dataByItem[g]) dataByItem[g] = {};
      if (!dataByItem[g][itemKey]) {
        dataByItem[g][itemKey] = {
          displayName: fact.item || fact.itemStandard || 'Desconhecido',
          months: {},
          total: { plannedQty: 0, realizedQty: 0, plannedCost: 0, realizedCost: 0 }
        };
      }
      
      const itemData = dataByItem[g][itemKey];
      itemData.months[fact.monthKey] = {
        plannedQty: fact.plannedQty,
        realizedQty: fact.realizedAverageQty,
        plannedCost: fact.plannedCost,
        realizedCost: fact.realizedCost
      };
      
      itemData.total.plannedQty += fact.plannedQty;
      itemData.total.realizedQty += fact.realizedAverageQty;
      itemData.total.plannedCost += fact.plannedCost;
      itemData.total.realizedCost += fact.realizedCost;
    });

    return { allMonths: monthsByYear, groupedData: dataByItem };
  }, [facts, selectedGroup]);

  if (facts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400">
        <p>Nenhum dado encontrado para o período/filtros selecionados.</p>
      </div>
    );
  }

  const years = Object.keys(allMonths).sort();
  let totalColumnsCount = 0;
  years.forEach(y => totalColumnsCount += allMonths[y].length);

  return (
    <div className="flex flex-col gap-4">
      {/* Filtros */}
      <div className="flex items-center gap-4 p-4 bg-slate-900/50 border border-white/10 rounded-xl">
        <div className="flex flex-col">
          <label className="text-[10px] uppercase font-bold text-slate-500 mb-1">Filtrar por Grupo</label>
          <div className="flex gap-2">
            {[
              { id: 'ALL', label: 'Todos' },
              { id: 'MOD', label: 'MOD (Direta)' },
              { id: 'MOI', label: 'MOI (Indireta)' },
              { id: 'EQUIP', label: 'Equipamentos' }
            ].map(g => (
              <button
                key={g.id}
                onClick={() => setSelectedGroup(g.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border ${
                  selectedGroup === g.id
                    ? 'bg-blue-600/20 border-blue-500/50 text-blue-400'
                    : 'bg-slate-800/50 border-white/5 text-slate-400 hover:bg-slate-800 hover:text-slate-300'
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="w-full overflow-x-auto rounded-xl border border-white/10 bg-slate-900/50">
        <table className="w-full text-sm text-left border-collapse min-w-max">
          <thead className="bg-slate-800/80 sticky top-0 z-40 text-[10px] uppercase tracking-wider text-slate-300">
            <tr>
              <th rowSpan={2} className="px-4 py-3 font-bold border-b border-r border-white/10 bg-slate-800 sticky left-0 z-50 w-[150px] min-w-[150px] max-w-[150px] text-center shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)]">
                Item
              </th>
              <th rowSpan={2} className="px-4 py-3 font-bold border-b border-r border-white/10 bg-slate-800 sticky left-[150px] z-40 w-[180px] min-w-[180px] max-w-[180px] text-center shadow-[2px_0_5px_-2px_rgba(0,0,0,0.3)]">
                Condição
              </th>
            {years.map(year => (
              <th 
                key={year} 
                colSpan={allMonths[year].length} 
                className="px-4 py-2 font-bold border-b border-r border-white/10 text-center bg-slate-800/80 text-white"
              >
                {year}
              </th>
            ))}
            <th rowSpan={2} className="px-4 py-3 font-bold border-b border-white/10 text-center bg-slate-800/90 min-w-[140px] text-emerald-400">
              TOTAL
            </th>
          </tr>
          <tr>
            {years.map(year => 
              allMonths[year].map(month => (
                <th key={`${year}-${month}`} className="px-3 py-2 font-bold border-b border-r border-white/10 text-center bg-slate-800/60 min-w-[100px] text-slate-200">
                  {getMonthAbbr(month)}
                </th>
              ))
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5 text-[11px] font-medium">
          {Object.entries(groupedData).sort(([a], [b]) => a.localeCompare(b)).map(([group, itemsMap]) => (
            <React.Fragment key={group}>
              {Object.entries(itemsMap).sort(([a], [b]) => a.localeCompare(b)).map(([itemKey, itemData], itemIndex) => {
                const total = itemData.total;
                return (
                  <React.Fragment key={itemKey}>
                    {/* Linha 1: Previsto Contrato (Qtd) */}
                    <tr className="hover:bg-slate-800/40 transition-colors bg-slate-900/30">
                      <td rowSpan={4} className="px-4 py-3 border-r border-b border-white/10 font-bold text-slate-200 bg-slate-900 sticky left-0 z-30 w-[150px] min-w-[150px] max-w-[150px] break-words align-middle text-center shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)]">
                        {itemData.displayName}
                      </td>
                      <td className="px-4 py-2 border-r border-white/10 text-blue-300 uppercase tracking-wider bg-slate-900 sticky left-[150px] z-20 w-[180px] min-w-[180px] max-w-[180px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.3)] font-semibold">
                        Previsto Contrato
                      </td>
                      {years.map(year => 
                        allMonths[year].map(month => {
                          const mk = `${year}-${month}`;
                          const val = itemData.months[mk]?.plannedQty || 0;
                          return (
                            <td key={`p-${mk}`} className="px-3 py-2 border-r border-white/5 text-right font-semibold text-blue-300/80 tabular-nums">
                              {val > 0 ? formatValue(val, false) : '-'}
                            </td>
                          );
                        })
                      )}
                      <td className="px-4 py-2 text-right font-bold text-blue-300 border-white/10 bg-slate-800/30 tabular-nums">
                        {total.plannedQty > 0 ? formatValue(total.plannedQty, false) : '-'}
                      </td>
                    </tr>

                    {/* Linha 2: Realizado (Qtd) */}
                    <tr className="hover:bg-slate-800/40 transition-colors bg-slate-900/10">
                      <td className="px-4 py-2 border-r border-white/10 text-rose-400 uppercase tracking-wider bg-slate-900 sticky left-[150px] z-20 w-[180px] min-w-[180px] max-w-[180px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.3)] font-semibold">
                        Realizado
                      </td>
                      {years.map(year => 
                        allMonths[year].map(month => {
                          const mk = `${year}-${month}`;
                          const val = itemData.months[mk]?.realizedQty || 0;
                          return (
                            <td key={`r-${mk}`} className="px-3 py-2 border-r border-white/5 text-right font-semibold text-rose-400/80 tabular-nums">
                              {val > 0 ? formatValue(val, false) : '-'}
                            </td>
                          );
                        })
                      )}
                      <td className="px-4 py-2 text-right font-bold text-rose-400 border-white/10 bg-slate-800/30 tabular-nums">
                        {total.realizedQty > 0 ? formatValue(total.realizedQty, false) : '-'}
                      </td>
                    </tr>

                    {/* Linha 3: Previsto Contrato ($) */}
                    <tr className="hover:bg-slate-800/40 transition-colors bg-slate-900/30">
                      <td className="px-4 py-2 border-r border-white/10 text-slate-400 uppercase tracking-wider bg-slate-900 sticky left-[150px] z-20 w-[180px] min-w-[180px] max-w-[180px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.3)]">
                        Previsto Contrato ($)
                      </td>
                      {years.map(year => 
                        allMonths[year].map(month => {
                          const mk = `${year}-${month}`;
                          const val = itemData.months[mk]?.plannedCost || 0;
                          return (
                            <td key={`p$-${mk}`} className="px-3 py-2 border-r border-white/5 text-right font-medium text-slate-400/80 tabular-nums">
                              {val > 0 ? formatValue(val, true) : '-'}
                            </td>
                          );
                        })
                      )}
                      <td className="px-4 py-2 text-right font-bold text-slate-300 border-white/10 bg-slate-800/30 tabular-nums">
                        {total.plannedCost > 0 ? formatValue(total.plannedCost, true) : '-'}
                      </td>
                    </tr>

                    {/* Linha 4: Realizado ($) */}
                    <tr className="hover:bg-slate-800/40 transition-colors bg-slate-900/10 border-b border-white/10">
                      <td className="px-4 py-2 border-r border-white/10 text-slate-400 uppercase tracking-wider bg-slate-900 sticky left-[150px] z-20 w-[180px] min-w-[180px] max-w-[180px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.3)] italic">
                        Realizado ($)
                      </td>
                      {years.map(year => 
                        allMonths[year].map(month => {
                          const mk = `${year}-${month}`;
                          const val = itemData.months[mk]?.realizedCost || 0;
                          return (
                            <td key={`r$-${mk}`} className="px-3 py-2 border-r border-white/5 text-right font-medium text-slate-400/80 tabular-nums italic">
                              {val > 0 ? formatValue(val, true) : '-'}
                            </td>
                          );
                        })
                      )}
                      <td className="px-4 py-2 text-right font-bold text-slate-300 border-white/10 bg-slate-800/30 tabular-nums italic">
                        {total.realizedCost > 0 ? formatValue(total.realizedCost, true) : '-'}
                      </td>
                    </tr>
                  </React.Fragment>
                );
              })}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
    </div>
  );
};
