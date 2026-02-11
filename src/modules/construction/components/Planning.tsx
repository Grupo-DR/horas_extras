
import React, { useState, useMemo } from 'react';
import { ConstructionRecord, PlanningAssignment, ServicePrice, PlannedService, Equipment } from '../types';
import {
  ChevronLeft, ChevronRight, Truck, Calendar as CalendarIcon,
  Plus, X, GripVertical, Trash2, Calculator, Settings2, Edit3,
  DollarSign, Target, TrendingUp
} from 'lucide-react';
import {
  getEquipmentCategory, getUnifiedServiceInfo, formatCurrencyWithZero,
  isServiceRelevantForEquipment, calculateAssignmentTotal, getPeriodInfo,
  getCycleKey, getPeriodFromCycle
} from '../utils/calculations';
import budgetData from '../data/budgets.json';

interface PlanningProps {
  data: ConstructionRecord[];
  assignments: PlanningAssignment[];
  servicePrices: ServicePrice[];
  equipments: Equipment[];
  onAddAssignment: (assignment: PlanningAssignment) => void;
  onRemoveAssignment: (id: string) => void;
  onUpdateAssignment: (assignment: PlanningAssignment) => void;
}

const Planning: React.FC<PlanningProps> = ({
  data, assignments, servicePrices, equipments, onAddAssignment, onRemoveAssignment, onUpdateAssignment
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [activeAssignmentId, setActiveAssignmentId] = useState<string | null>(null);
  const [draggedFrota, setDraggedFrota] = useState<string | null>(null);

  // Informações do ciclo baseadas na data atual selecionada (21 a 20)
  const period = useMemo(() => getPeriodInfo(currentDate, data), [currentDate, data]);

  // Filter available equipment based on the VALID PERIOD for each equipment vs Current Planning Period
  const availableEquipment = useMemo(() => {
    // If no equipments are registered or passed, fallback to 'data' extraction (legacy support or ease of use?)
    // Requirement says: "os equipamentos cadastrados aparecem".
    if (equipments && equipments.length > 0) {
      return equipments.filter(eq => {
        if (!eq.active) return false;
        // Check date overlap
        // Equipment Start <= Period End AND (Equipment End >= Period Start OR Equipment End is null)
        const eqStart = new Date(eq.startDate);
        const eqEnd = eq.endDate ? new Date(eq.endDate) : new Date('9999-12-31');

        return eqStart <= period.end && eqEnd >= period.start;
      }).map(eq => ({
        id: eq.frota,
        category: eq.type // Use 'type' from registry as category
      })).sort((a, b) => a.id.localeCompare(b.id));
    }

    // Fallback: extract from RDO data if registry is empty
    const frotas = Array.from(new Set(data.map(r => r.frota))).filter(f => f && f !== 'null') as string[];
    return frotas.map(f => ({
      id: f,
      category: getEquipmentCategory(f)
    })).sort((a, b) => a.id.localeCompare(b.id));
  }, [data, equipments, period]);

  const allCatalogItems = useMemo(() => {
    const items = (Array.from(new Set(servicePrices.map(p => p.item))) as string[]).sort((a, b) => a.localeCompare(b));
    return items.map(item => getUnifiedServiceInfo(item, servicePrices));
  }, [servicePrices]);

  const activeAssignment = assignments.find(a => a.id === activeAssignmentId);

  const filteredCatalogItems = useMemo(() => {
    if (!activeAssignment) return allCatalogItems;
    return allCatalogItems.filter(item =>
      isServiceRelevantForEquipment(activeAssignment.frota, item.descricao)
    );
  }, [activeAssignment, allCatalogItems]);

  // Lógica do Calendário Travado no Ciclo (Exatamente 21 a 20)
  // Baseado na data atualmente selecionada.
  const periodDates = useMemo(() => {
    // 1. Obter a string YYYY-MM-DD segura
    const dateStr = currentDate.toISOString().split('T')[0];

    // 2. Chamar getCycleKey para saber onde estamos (ex: '05-2024')
    const cycle = getCycleKey(dateStr);

    // 3. Chamar a função CANÔNICA para obter range (21/04 a 20/05)
    return getPeriodFromCycle(cycle);
  }, [currentDate]);

  const calendarDays = useMemo(() => {
    const days = [];
    const start = periodDates.start;
    const end = periodDates.end;

    // Alinhamento com o dia da semana (Dom a Sáb) para manter o grid visual
    const firstDayWeekday = start.getDay();
    for (let i = 0; i < firstDayWeekday; i++) days.push(null);

    let current = new Date(start);
    // Loop dia a dia até chegar no end
    while (current <= end) {
      days.push(current.toISOString().split('T')[0]);
      current.setDate(current.getDate() + 1);
    }

    return days;
  }, [periodDates]);

  const monthLabel = period.end.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });

  // Calculate budget for the planning period
  // Budget logic: planning period uses NEXT month's budget
  const budgetInfo = useMemo(() => {
    // Get the cycle end date (e.g., if planning Jan 21 - Feb 20, end is Feb 20)
    const cycleEndDate = period.end;

    // Budget month is the NEXT month after cycle end
    const budgetMonth = cycleEndDate.getMonth() + 2; // +1 for next month, +1 because getMonth() is 0-indexed
    const budgetYear = budgetMonth > 12 ? cycleEndDate.getFullYear() + 1 : cycleEndDate.getFullYear();
    const normalizedBudgetMonth = budgetMonth > 12 ? 1 : budgetMonth;

    // Find budgets for this month/year
    const monthBudgets = budgetData.budgets.filter(
      b => b.month === normalizedBudgetMonth && b.year === budgetYear
    );

    // Sum all budgets for this month (Construtora + Rental)
    const totalBudget = monthBudgets.reduce((sum, b) => sum + b.value, 0);

    return {
      month: normalizedBudgetMonth,
      year: budgetYear,
      totalBudget,
      budgets: monthBudgets
    };
  }, [period]);

  // Calculate planning metrics
  const planningMetrics = useMemo(() => {
    let totalPlanned = 0;

    // Filter assignments to only include those in the current calendar period
    const periodAssignments = assignments.filter(assignment =>
      calendarDays.includes(assignment.date)
    );

    periodAssignments.forEach(assignment => {
      assignment.services.forEach(service => {
        const info = getUnifiedServiceInfo(service.item, servicePrices);
        const value = (service.producao || 0) * info.precoTotal;
        totalPlanned += value;
      });
    });

    // Calculate adherence percentage
    const adherence = budgetInfo.totalBudget > 0
      ? (totalPlanned / budgetInfo.totalBudget) * 100
      : 0;

    return {
      totalPlanned,
      adherence,
      difference: totalPlanned - budgetInfo.totalBudget
    };
  }, [assignments, servicePrices, budgetInfo, calendarDays]);

  const handlePrevMonth = () => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() - 1);
    setCurrentDate(newDate);
  };

  const handleNextMonth = () => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + 1);
    setCurrentDate(newDate);
  };

  const onDragStart = (frota: string) => setDraggedFrota(frota);
  const onDrop = (date: string) => {
    if (draggedFrota) {
      const exists = assignments.some(a => a.date === date && a.frota === draggedFrota);
      if (!exists) {
        onAddAssignment({
          id: `${date}-${draggedFrota}-${Date.now()}`,
          date,
          frota: draggedFrota,
          services: []
        });
      }
      setDraggedFrota(null);
    }
  };

  const getDayAssignments = (date: string) => assignments.filter(a => a.date === date);

  const handleUpdateService = (index: number, field: keyof PlannedService, value: any) => {
    if (!activeAssignment) return;
    const newServices = [...activeAssignment.services];
    newServices[index] = { ...newServices[index], [field]: value };
    onUpdateAssignment({ ...activeAssignment, services: newServices });
  };

  const handleRemoveService = (index: number) => {
    if (!activeAssignment) return;
    const newServices = activeAssignment.services.filter((_, i) => i !== index);
    onUpdateAssignment({ ...activeAssignment, services: newServices });
  };

  return (
    <div className="flex flex-col gap-3 h-[calc(100vh-100px)]">
      {/* Cycle Header - Top of Screen */}
      <div className="flex items-center justify-between bg-white p-3 rounded-xl shadow-sm border border-slate-100">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-black text-slate-800 uppercase tracking-tighter flex items-center gap-2">
            <CalendarIcon className="w-4 h-4 text-indigo-500" /> Ciclo Operacional: {monthLabel}
          </h2>
          <div className="text-[9px] bg-indigo-50 text-indigo-600 px-2 py-1 rounded-full font-black uppercase tracking-widest">
            {period.start.toLocaleDateString('pt-BR')} à {period.end.toLocaleDateString('pt-BR')}
          </div>
        </div>
        <div className="flex gap-1">
          <button onClick={handlePrevMonth} className="p-1 hover:bg-slate-100 rounded-full transition-colors text-slate-400"><ChevronLeft className="w-3.5 h-3.5" /></button>
          <button onClick={handleNextMonth} className="p-1 hover:bg-slate-100 rounded-full transition-colors text-slate-400"><ChevronRight className="w-3.5 h-3.5" /></button>
        </div>
      </div>

      {/* Main Content: Equipment Sidebar + Calendar with Cards */}
      <div className="flex flex-col lg:flex-row gap-3 flex-1 overflow-hidden">
        {/* Barra Lateral: Equipamentos Disponíveis */}
        <div className="w-full lg:w-56 bg-white rounded-xl shadow-sm border border-slate-100 flex flex-col overflow-hidden">
          <div className="p-3 border-b border-slate-100 bg-slate-50/50">
            <h3 className="font-black text-slate-800 flex items-center gap-2 uppercase text-xs tracking-widest">
              <Truck className="w-4 h-4 text-amber-500" /> Equipamentos
            </h3>
            <p className="text-[9px] text-slate-400 mt-0.5 font-bold uppercase">Arraste p/ calendário</p>
          </div>
          <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5">
            {availableEquipment.map(equip => (
              <div
                key={equip.id}
                draggable
                onDragStart={() => onDragStart(equip.id)}
                className="p-2 bg-white border border-slate-100 rounded-lg cursor-grab active:cursor-grabbing hover:border-amber-300 hover:shadow-md transition-all group flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <GripVertical className="w-3 h-3 text-slate-300 group-hover:text-amber-400" />
                  <div>
                    <div className="text-xs font-black text-slate-800">{equip.id}</div>
                    <div className="text-[9px] text-slate-400 font-bold uppercase">{equip.category}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Calendar Section with Cards */}
        <div className="flex-1 flex flex-col gap-3 overflow-hidden">
          {/* Summary Cards - Compact */}
          <div className="grid grid-cols-3 gap-3">
            {/* Budget Card */}
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-sm p-3 text-white">
              <div className="flex items-center justify-between mb-1">
                <div className="bg-white/20 p-1.5 rounded-lg">
                  <DollarSign className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-wider opacity-90">Budget</span>
              </div>
              <div className="text-xl font-black font-mono">{formatCurrencyWithZero(budgetInfo.totalBudget)}</div>
              <div className="text-[9px] font-bold uppercase tracking-widest opacity-75 mt-0.5">
                {new Date(budgetInfo.year, budgetInfo.month - 1).toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}
              </div>
            </div>

            {/* Total Planejado */}
            <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl shadow-sm p-3 text-white">
              <div className="flex items-center justify-between mb-1">
                <div className="bg-white/20 p-1.5 rounded-lg">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-wider opacity-90">Planejado</span>
              </div>
              <div className="text-xl font-black font-mono">{formatCurrencyWithZero(planningMetrics.totalPlanned)}</div>
              <div className="text-[9px] font-bold uppercase tracking-widest opacity-75 mt-0.5">
                {planningMetrics.difference >= 0 ? '+' : ''}{formatCurrencyWithZero(planningMetrics.difference)}
              </div>
            </div>

            {/* Aderência ao Budget */}
            <div className={`bg-gradient-to-br rounded-xl shadow-sm p-3 text-white ${planningMetrics.adherence <= 100 ? 'from-emerald-500 to-emerald-600' : 'from-red-500 to-red-600'
              }`}>
              <div className="flex items-center justify-between mb-1">
                <div className="bg-white/20 p-1.5 rounded-lg">
                  <Target className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-wider opacity-90">Aderência</span>
              </div>
              <div className="text-xl font-black font-mono">{planningMetrics.adherence.toFixed(1)}%</div>
              <div className="text-[9px] font-bold uppercase tracking-widest opacity-75 mt-0.5">
                {planningMetrics.adherence <= 100 ? 'Dentro do Budget' : 'Acima do Budget'}
              </div>
            </div>
          </div>

          {/* Calendário de Período Completo 21 a 20 */}
          <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
            <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-100">
              {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
                <div key={d} className="py-1.5 text-center text-[9px] font-black text-slate-400 uppercase tracking-widest">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 flex-1">
              {calendarDays.map((day, idx) => {
                if (!day) return <div key={`empty-${idx}`} className="border-b border-r border-slate-50 bg-slate-50/20" />;

                const dayAssignments = getDayAssignments(day);
                const dayTotal = dayAssignments.reduce((acc, a) => acc + calculateAssignmentTotal(a, servicePrices), 0);
                const isToday = day === new Date().toISOString().split('T')[0];

                return (
                  <div
                    key={day}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => onDrop(day)}
                    onClick={() => setSelectedDay(day)}
                    className={`border-b border-r border-slate-100 p-1 min-h-[60px] transition-all cursor-pointer relative group
                    ${selectedDay === day ? 'bg-indigo-50/50 ring-2 ring-inset ring-indigo-500/20' : 'hover:bg-slate-50/80'}
                    ${isToday ? 'bg-amber-50/30' : ''}
                  `}
                  >
                    <div className="flex justify-between items-start">
                      <span className={`text-[9px] font-black ${dayAssignments.length > 0 ? 'text-indigo-600' : 'text-slate-400'}`}>
                        {parseInt(day.split('-')[2])}/{parseInt(day.split('-')[1])}
                      </span>
                      {dayTotal > 0 && (
                        <span className="text-[7px] font-black text-emerald-600 bg-emerald-50 px-0.5 rounded">
                          {formatCurrencyWithZero(dayTotal)}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 space-y-0.5">
                      {dayAssignments.slice(0, 2).map(a => (
                        <div key={a.id} className="text-[7px] font-black bg-indigo-100 text-indigo-700 px-1 py-0.5 rounded truncate uppercase">
                          <span>{a.frota}</span>
                        </div>
                      ))}
                      {dayAssignments.length > 2 && (
                        <div className="text-[7px] font-bold text-slate-400 px-1">+{dayAssignments.length - 2}</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* MODAL COMPACTO: Detalhes do Dia */}
      {selectedDay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in zoom-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
              <div className="flex items-center gap-3">
                <div className="bg-indigo-100 p-2 rounded-xl text-indigo-600"><CalendarIcon className="w-5 h-5" /></div>
                <div>
                  <h4 className="text-sm font-black text-slate-900 uppercase">Resumo do Dia</h4>
                  <p className="text-[10px] text-slate-500 font-bold uppercase">{new Date(selectedDay + 'T12:00:00').toLocaleDateString('pt-BR')}</p>
                </div>
              </div>
              <button onClick={() => setSelectedDay(null)} className="p-2 hover:bg-white rounded-full transition-colors text-slate-400 shadow-sm"><X className="w-5 h-5" /></button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[60vh] space-y-3">
              {getDayAssignments(selectedDay).length === 0 ? (
                <div className="py-12 text-center text-slate-400 italic text-xs uppercase tracking-widest font-bold">Sem planejamento p/ este dia</div>
              ) : (
                getDayAssignments(selectedDay).map(a => {
                  const total = calculateAssignmentTotal(a, servicePrices);
                  return (
                    <div key={a.id} className="p-4 bg-white border border-slate-100 rounded-2xl hover:border-indigo-200 transition-all flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-slate-50 text-slate-500"><Truck className="w-4 h-4" /></div>
                        <div>
                          <span className="text-xs font-black text-slate-900 uppercase">{a.frota}</span>
                          <p className="text-[9px] text-slate-400 font-bold uppercase">{getEquipmentCategory(a.frota)}</p>
                          <p className="text-[10px] font-black text-emerald-600 mt-0.5">{formatCurrencyWithZero(total)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => { setActiveAssignmentId(a.id); setSelectedDay(null); }} className="p-2 text-indigo-500 hover:bg-indigo-50 rounded-lg transition-all" title="Editar"><Edit3 className="w-4 h-4" /></button>
                        <button onClick={() => onRemoveAssignment(a.id)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all" title="Remover"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-center">
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Gerencie os lançamentos do dia selecionado</p>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE EDIÇÃO DE PLANEJAMENTO */}
      {activeAssignment && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-md">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-4">
                <div className="bg-amber-500 p-3 rounded-2xl text-slate-900"><Calculator className="w-6 h-6" /></div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 uppercase tracking-tighter">Lançamento de Planejamento</h3>
                  <p className="text-xs text-slate-500 font-bold uppercase">Frota: {activeAssignment.frota} | {new Date(activeAssignment.date + 'T12:00:00').toLocaleDateString('pt-BR')}</p>
                </div>
              </div>
              <button onClick={() => setActiveAssignmentId(null)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400"><X className="w-6 h-6" /></button>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              {filteredCatalogItems.length === 0 ? (
                <div className="py-20 text-center flex flex-col items-center gap-4"><Settings2 className="w-12 h-12 text-slate-200" /><p className="text-sm font-bold text-slate-400 uppercase">Sem serviços compatíveis no catálogo.</p></div>
              ) : (
                <table className="w-full text-left">
                  <thead className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                    <tr><th className="pb-4 font-bold">Item / Serviço</th><th className="pb-4 font-bold text-center">Unid.</th><th className="pb-4 font-bold text-right">Preço Total</th><th className="pb-4 font-bold text-center w-32">Produção</th><th className="pb-4 font-bold text-right">Total</th><th className="pb-4 w-10"></th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {activeAssignment.services.map((service, idx) => {
                      const info = getUnifiedServiceInfo(service.item, servicePrices);
                      const total = (service.producao || 0) * info.precoTotal;
                      return (
                        <tr key={idx} className="group hover:bg-slate-50/50 transition-colors">
                          <td className="py-4"><select value={service.item} onChange={(e) => handleUpdateService(idx, 'item', e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-amber-500/20">{filteredCatalogItems.map(item => (<option key={item.item} value={item.item}>{item.item} - {item.descricao}</option>))}</select></td>
                          <td className="py-4 text-center"><span className="text-[10px] font-black bg-slate-100 px-2 py-1 rounded text-slate-500 uppercase">{info.unidade}</span></td>
                          <td className="py-4 text-right text-[11px] font-mono font-bold text-slate-600">{formatCurrencyWithZero(info.precoTotal)}</td>
                          <td className="py-4 px-4"><input type="number" value={service.producao || ''} onChange={(e) => handleUpdateService(idx, 'producao', parseFloat(e.target.value) || 0)} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-black text-center focus:ring-2 focus:ring-amber-500/20 outline-none" placeholder="0" /></td>
                          <td className="py-4 text-right text-sm font-black text-slate-900 font-mono">{formatCurrencyWithZero(total)}</td>
                          <td className="py-4 text-right"><button onClick={() => handleRemoveService(idx)} className="p-2 text-slate-300 hover:text-red-500 rounded-lg opacity-0 group-hover:opacity-100 transition-all"><Trash2 className="w-4 h-4" /></button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
            <div className="p-6 bg-slate-900 text-white flex flex-col sm:flex-row items-center justify-between gap-6">
              <button onClick={() => { if (!activeAssignment || filteredCatalogItems.length === 0) return; const firstItem = filteredCatalogItems[0].item; const newServices = [...activeAssignment.services, { item: firstItem, producao: 0 }]; onUpdateAssignment({ ...activeAssignment, services: newServices }); }} disabled={filteredCatalogItems.length === 0} className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all disabled:opacity-20"><Plus className="w-4 h-4" /> Adicionar Serviço</button>
              <div className="flex items-center gap-8">
                <div className="text-right"><p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Subtotal Frota</p><p className="text-3xl font-black text-amber-500 font-mono leading-none mt-1">{formatCurrencyWithZero(calculateAssignmentTotal(activeAssignment, servicePrices))}</p></div>
                <button onClick={() => setActiveAssignmentId(null)} className="bg-amber-500 text-slate-900 px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-amber-400 transition-all shadow-lg">Finalizar Lançamento</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Planning;
