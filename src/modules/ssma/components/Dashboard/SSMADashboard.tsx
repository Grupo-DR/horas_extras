import React from 'react';
import { useSSMADashboard } from '../../hooks/useSSMADashboard';
import { DashboardFilters } from './SSMADashboardFilters';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
  PieChart,
  Pie,
} from 'recharts';
import { AlertTriangle, CheckCircle, Award, Users, Percent, ShieldCheck, Briefcase, Building2, UserCheck, HardHat } from 'lucide-react';

export const SSMADashboard: React.FC = () => {
    // Ano padrão: ano atual
    const now = new Date();
    const defaultYear = now.getFullYear();

    const {
        filters,
        setFilters,
        loading,
        error,
        regionals,
        costCenters,
        inspections
    } = useSSMADashboard({ year: defaultYear });

    if (error) {
        return (
            <div className="p-8">
                <div className="bg-red-50 text-red-600 p-4 rounded border border-red-200">
                    <h2 className="font-bold">Acesso Negado ou Erro</h2>
                    <p>{error}</p>
                </div>
            </div>
        );
    }

  // 1. Calculate General Metrics
  const total = inspections.length;
  const atendeList = inspections.filter((i) => i.resultadoGeral >= 95);
  const atendeCount = atendeList.length;
  const naoAtendeCount = total - atendeCount;

  const percentAtende = total > 0 ? Math.round((atendeCount / total) * 100) : 0;

  // Helper to ensure numbers
  const getNum = (val: any) => (typeof val === 'number' && !isNaN(val) ? val : 0);

  // Average results
  const avgGeral =
    total > 0
      ? Math.round(inspections.reduce((acc, i) => acc + getNum(i.resultadoGeral), 0) / total)
      : 0;

  const avgGestor =
    total > 0
      ? Math.round(inspections.reduce((acc, i) => acc + getNum(i.resultadoGestor), 0) / total)
      : 0;

  const avgEncarregado =
    total > 0
      ? Math.round(inspections.reduce((acc, i) => acc + getNum(i.resultadoEncarregado), 0) / total)
      : 0;

  const avgSupssma =
    total > 0
      ? Math.round(inspections.reduce((acc, i) => acc + getNum(i.resultadoSupssma), 0) / total)
      : 0;

  const avgTst =
    total > 0
      ? Math.round(inspections.reduce((acc, i) => acc + getNum(i.resultadoTst), 0) / total)
      : 0;

  // 2. Prepare Pie Chart Data (ATENDE vs NÃO ATENDE)
  const pieData = [
    { name: 'ATENDE (≥ 95%)', value: atendeCount, color: '#10b981' }, // emerald-500
    { name: 'NÃO ATENDE (< 95%)', value: naoAtendeCount, color: '#ef4444' }, // red-500
  ].filter((item) => item.value > 0);

  // 3. Prepare Averages by Regional (GREG)
  const gregMap: { [key: string]: { sum: number; count: number } } = {};
  inspections.forEach((i) => {
    if (!gregMap[i.greg]) gregMap[i.greg] = { sum: 0, count: 0 };
    gregMap[i.greg].sum += i.resultadoGeral;
    gregMap[i.greg].count += 1;
  });
  const regionalData = Object.keys(gregMap).map((key) => ({
    name: key,
    media: Math.round(gregMap[key].sum / gregMap[key].count),
  })).sort((a, b) => b.media - a.media);

  // 4. Prepare Averages by Gestor (Código da Obra)
  const gestorMap: { [key: string]: { sum: number; count: number } } = {};
  inspections.forEach((i) => {
    if (!i.gestor || i.gestor === 'Não atribuído') return;
    const key = i.cc;
    if (!gestorMap[key]) gestorMap[key] = { sum: 0, count: 0 };
    gestorMap[key].sum += getNum(i.resultadoGestor);
    gestorMap[key].count += 1;
  });
  const gestorData = Object.keys(gestorMap).map((key) => ({
    name: key,
    media: Math.round(gestorMap[key].sum / gestorMap[key].count),
  })).sort((a, b) => b.media - a.media);

  // 5. Prepare Averages by Encarregado
  const encMap: { [key: string]: { sum: number; count: number } } = {};
  inspections.forEach((i) => {
    if (!i.encarregado || i.encarregado === 'Não atribuído') return;
    const key = i.encarregado;
    if (!encMap[key]) encMap[key] = { sum: 0, count: 0 };
    encMap[key].sum += getNum(i.resultadoEncarregado);
    encMap[key].count += 1;
  });
  const encarregadoData = Object.keys(encMap).map((key) => ({
    name: key,
    media: Math.round(encMap[key].sum / encMap[key].count),
  })).sort((a, b) => b.media - a.media);

  // 6. Prepare Averages by Supervisor SSMA
  const supMap: { [key: string]: { sum: number; count: number } } = {};
  inspections.forEach((i) => {
    if (!i.supssma || i.supssma === 'Não atribuído') return;
    const key = i.supssma;
    if (!supMap[key]) supMap[key] = { sum: 0, count: 0 };
    supMap[key].sum += getNum(i.resultadoSupssma);
    supMap[key].count += 1;
  });
  const supssmaData = Object.keys(supMap).map((key) => ({
    name: key,
    media: Math.round(supMap[key].sum / supMap[key].count),
  })).sort((a, b) => b.media - a.media);

  // 7. Prepare Averages by TST
  const tstMap: { [key: string]: { sum: number; count: number } } = {};
  inspections.forEach((i) => {
    if (!i.tst || i.tst === 'Não atribuído') return;
    const key = i.tst;
    if (!tstMap[key]) tstMap[key] = { sum: 0, count: 0 };
    tstMap[key].sum += getNum(i.resultadoTst);
    tstMap[key].count += 1;
  });
  const tstData = Object.keys(tstMap).map((key) => ({
    name: key,
    media: Math.round(tstMap[key].sum / tstMap[key].count),
  })).sort((a, b) => b.media - a.media);

  // Calculate real unique counts (excluding "Não atribuído")
  const uniqueGestoresCount = new Set(inspections.map(i => i.gestor).filter(n => n && n !== 'Não atribuído')).size;
  const uniqueSupssmaCount = new Set(inspections.map(i => i.supssma).filter(n => n && n !== 'Não atribuído')).size;
  const uniqueTstCount = new Set(inspections.map(i => i.tst).filter(n => n && n !== 'Não atribuído')).size;
  const uniqueEncarregadoCount = new Set(inspections.map(i => i.encarregado).filter(n => n && n !== 'Não atribuído')).size;

  // 8. Prepare General Averages by Role Data
  const roleAveragesData = [
    { name: 'Gestor', media: avgGestor, color: '#3b82f6' }, // blue-500
    { name: 'Encarregado', media: avgEncarregado, color: '#f59e0b' }, // amber-500
    { name: 'Sup. SSMA', media: avgSupssma, color: '#10b981' }, // emerald-500
    { name: 'TST', media: avgTst, color: '#8b5cf6' }, // violet-500
  ];

  const MONTHS_LIST = [
    'Janeiro',
    'Fevereiro',
    'Março',
    'Abril',
    'Maio',
    'Junho',
    'Julho',
    'Agosto',
    'Setembro',
    'Outubro',
    'Novembro',
    'Dezembro'
  ];

  const activeCCs = costCenters && costCenters.length > 0 
    ? costCenters 
    : Array.from(new Set(inspections.map(i => i.cc))).map(ccCode => ({ code: ccCode, name: ccCode }));

    return (
        <div className="p-6 bg-gray-50 min-h-screen">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">Centro de Inteligência SSMA</h1>
                    <p className="text-gray-500 mt-1">Acompanhamento e conformidade de inspeções</p>
                </div>
                {loading && <span className="text-blue-500 font-bold animate-pulse">Atualizando dados...</span>}
            </div>

            <DashboardFilters 
                filters={filters} 
                setFilters={setFilters} 
                regionals={regionals} 
                costCenters={costCenters} 
            />

            {total === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-brand-border shadow-xs text-center px-4">
                    <AlertTriangle className="w-12 h-12 text-slate-400 mb-3 animate-pulse" />
                    <h3 className="text-lg font-medium text-brand-ink">Nenhum registro encontrado</h3>
                    <p className="text-sm text-slate-500 max-w-md mt-1">
                        Não há dados de inspeção correspondentes aos filtros selecionados.
                    </p>
                </div>
            ) : (
                <div className="space-y-6">
                    {/* Cards de Métricas Principais - Bento Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                        {/* Card 1: Gerente Regional */}
                        <div className="bg-white rounded-xl border shadow-sm p-4.5 flex flex-col justify-between hover:shadow-md transition-all">
                            <div className="flex items-start justify-between">
                                <div>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Gerente Regional</span>
                                    <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-1">{avgGeral}%</h3>
                                </div>
                                <div className={`p-2 rounded-lg shrink-0 ${avgGeral >= 95 ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                                    <Briefcase className="w-5 h-5" />
                                </div>
                            </div>
                            <div className="mt-3.5 space-y-1.5">
                                <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                    <div className={`h-full transition-all duration-500 ${avgGeral >= 95 ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${avgGeral}%` }}></div>
                                </div>
                                <div className="flex items-center justify-between text-[9px] font-semibold">
                                    <span className="text-slate-400">Meta: ≥95%</span>
                                    <span className={avgGeral >= 95 ? 'text-emerald-600 uppercase' : 'text-amber-600 uppercase'}>{avgGeral >= 95 ? 'Meta OK' : 'Abaixo'}</span>
                                </div>
                            </div>
                        </div>

                        {/* Card 2: Gestor de Obra */}
                        <div className="bg-white rounded-xl border shadow-sm p-4.5 flex flex-col justify-between hover:shadow-md transition-all">
                            <div className="flex items-start justify-between">
                                <div>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Gestor de Obra</span>
                                    <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-1">{avgGestor}%</h3>
                                </div>
                                <div className={`p-2 rounded-lg shrink-0 ${avgGestor >= 95 ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                                    <Building2 className="w-5 h-5" />
                                </div>
                            </div>
                            <div className="mt-3.5 space-y-1.5">
                                <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                    <div className={`h-full transition-all duration-500 ${avgGestor >= 95 ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${avgGestor}%` }}></div>
                                </div>
                                <div className="flex items-center justify-between text-[9px] font-semibold">
                                    <span className="text-slate-400">Meta: ≥95%</span>
                                    <span className={avgGestor >= 95 ? 'text-emerald-600 uppercase' : 'text-amber-600 uppercase'}>{avgGestor >= 95 ? 'Meta OK' : 'Abaixo'}</span>
                                </div>
                            </div>
                        </div>

                        {/* Card 3: Supervisor SSMA */}
                        <div className="bg-white rounded-xl border shadow-sm p-4.5 flex flex-col justify-between hover:shadow-md transition-all">
                            <div className="flex items-start justify-between">
                                <div>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Supervisor SSMA</span>
                                    <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-1">{avgSupssma}%</h3>
                                </div>
                                <div className={`p-2 rounded-lg shrink-0 ${avgSupssma >= 95 ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                                    <ShieldCheck className="w-5 h-5" />
                                </div>
                            </div>
                            <div className="mt-3.5 space-y-1.5">
                                <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                    <div className={`h-full transition-all duration-500 ${avgSupssma >= 95 ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${avgSupssma}%` }}></div>
                                </div>
                                <div className="flex items-center justify-between text-[9px] font-semibold">
                                    <span className="text-slate-400">Meta: ≥95%</span>
                                    <span className={avgSupssma >= 95 ? 'text-emerald-600 uppercase' : 'text-amber-600 uppercase'}>{avgSupssma >= 95 ? 'Meta OK' : 'Abaixo'}</span>
                                </div>
                            </div>
                        </div>

                        {/* Card 4: TST */}
                        <div className="bg-white rounded-xl border shadow-sm p-4.5 flex flex-col justify-between hover:shadow-md transition-all">
                            <div className="flex items-start justify-between">
                                <div>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">TST</span>
                                    <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-1">{avgTst}%</h3>
                                </div>
                                <div className={`p-2 rounded-lg shrink-0 ${avgTst >= 95 ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                                    <HardHat className="w-5 h-5" />
                                </div>
                            </div>
                            <div className="mt-3.5 space-y-1.5">
                                <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                    <div className={`h-full transition-all duration-500 ${avgTst >= 95 ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${avgTst}%` }}></div>
                                </div>
                                <div className="flex items-center justify-between text-[9px] font-semibold">
                                    <span className="text-slate-400">Meta: ≥95%</span>
                                    <span className={avgTst >= 95 ? 'text-emerald-600 uppercase' : 'text-amber-600 uppercase'}>{avgTst >= 95 ? 'Meta OK' : 'Abaixo'}</span>
                                </div>
                            </div>
                        </div>

                        {/* Card 5: Encarregado */}
                        <div className="bg-white rounded-xl border shadow-sm p-4.5 flex flex-col justify-between hover:shadow-md transition-all">
                            <div className="flex items-start justify-between">
                                <div>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Encarregado</span>
                                    <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-1">{avgEncarregado}%</h3>
                                </div>
                                <div className={`p-2 rounded-lg shrink-0 ${avgEncarregado >= 95 ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                                    <Users className="w-5 h-5" />
                                </div>
                            </div>
                            <div className="mt-3.5 space-y-1.5">
                                <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                    <div className={`h-full transition-all duration-500 ${avgEncarregado >= 95 ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${avgEncarregado}%` }}></div>
                                </div>
                                <div className="flex items-center justify-between text-[9px] font-semibold">
                                    <span className="text-slate-400">Meta: ≥95%</span>
                                    <span className={avgEncarregado >= 95 ? 'text-emerald-600 uppercase' : 'text-amber-600 uppercase'}>{avgEncarregado >= 95 ? 'Meta OK' : 'Abaixo'}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Tabela de Lançamentos */}
                    <div className="bg-white rounded-xl border shadow-sm flex flex-col justify-between p-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 gap-2">
                            <div>
                                <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                    <Building2 className="w-4 h-4 text-blue-600" />
                                    Resultado Consolidado por Obra / Mês
                                </h4>
                                <p className="text-[11px] text-slate-400 mt-0.5">
                                    Resultados de conformidade distribuídos por Obra e Mês
                                </p>
                            </div>
                            <div className="flex items-center gap-2 text-[10px] font-semibold text-slate-500 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100 self-start sm:self-center">
                                <span className="flex items-center gap-1">
                                    <span className="w-2.5 h-2.5 bg-emerald-50 rounded border border-emerald-200"></span>
                                    Meta (≥95%)
                                </span>
                                <span className="flex items-center gap-1">
                                    <span className="w-2.5 h-2.5 bg-amber-50 rounded border border-amber-200"></span>
                                    Abaixo
                                </span>
                            </div>
                        </div>
                        
                        <div className="overflow-x-auto mt-4 border border-slate-200 rounded-xl max-h-[480px] overflow-y-auto bg-slate-50/10 shadow-sm">
                            <table className="w-full text-left border-collapse text-xs">
                                <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0 z-20">
                                    <tr className="border-b border-slate-200">
                                        <th rowSpan={2} className="px-2 py-2.5 align-middle border-r border-slate-200 text-center w-16">
                                            Mês
                                        </th>
                                        {activeCCs.map((ccItem, idx) => (
                                            <th key={ccItem.code || idx} colSpan={3} className={`px-2 py-1.5 text-center border-r border-slate-200 ${idx % 2 === 0 ? 'bg-slate-50' : 'bg-white'}`}>
                                                <div className="flex flex-col items-center justify-center">
                                                    <span className="font-bold text-[10px] truncate max-w-[150px]" title={ccItem.name}>{ccItem.name || ccItem.code}</span>
                                                    {ccItem.name && <span className="text-[8px] font-mono text-slate-400">{ccItem.code}</span>}
                                                </div>
                                            </th>
                                        ))}
                                    </tr>
                                    <tr className="text-[8.5px] bg-slate-50 border-b border-slate-200 font-bold uppercase">
                                        {activeCCs.map((ccItem, idx) => (
                                            <React.Fragment key={`sub-${ccItem.code || idx}`}>
                                                <th className={`px-1 py-1 text-center border-r border-slate-150 w-20`}>Frente Serv.</th>
                                                <th className={`px-1 py-1 text-center border-r border-slate-150 w-20`}>Alojamento</th>
                                                <th className={`px-1 py-1 text-center border-r border-slate-200 w-20 text-slate-800`}>Res. Total</th>
                                            </React.Fragment>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-150 bg-white">
                                    {MONTHS_LIST.map((mesName) => (
                                        <tr key={mesName} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-2 py-1.5 font-bold text-slate-600 border-r border-slate-200 text-center text-[11px] bg-slate-50">
                                                {mesName}
                                            </td>
                                            {activeCCs.map((ccItem, idx) => {
                                                const matchedInspecao = inspections.find(
                                                    (i) => i.mes === mesName && i.cc === ccItem.code
                                                );

                                                if (!matchedInspecao) {
                                                    return (
                                                        <React.Fragment key={`cell-${mesName}-${ccItem.code || idx}`}>
                                                            <td className={`px-1 py-1.5 text-center text-slate-300 border-r border-slate-150`}>-</td>
                                                            <td className={`px-1 py-1.5 text-center text-slate-300 border-r border-slate-150`}>-</td>
                                                            <td className={`px-1 py-1.5 text-center text-slate-300 border-r border-slate-200`}>-</td>
                                                        </React.Fragment>
                                                    );
                                                }

                                                const totalMetaIFS = matchedInspecao.metaGestorIFS + matchedInspecao.metaEncarregadoIFS + matchedInspecao.metaSupssmaIFS + matchedInspecao.metaTstIFS;
                                                const totalRealIFS = matchedInspecao.realizadoGestorIFS + matchedInspecao.realizadoEncarregadoIFS + matchedInspecao.realizadoSupssmaIFS + matchedInspecao.realizadoTstIFS;
                                                const resultadoIFS = totalMetaIFS > 0 
                                                    ? Math.min(100, Math.round((totalRealIFS / totalMetaIFS) * 100)) 
                                                    : 100;

                                                const totalMetaAloj = matchedInspecao.metaGestorAlojamento + matchedInspecao.metaEncarregadoAlojamento + matchedInspecao.metaSupssmaAlojamento + matchedInspecao.metaTstAlojamento;
                                                const totalRealAloj = matchedInspecao.realizadoGestorAlojamento + matchedInspecao.realizadoEncarregadoAlojamento + matchedInspecao.realizadoSupssmaAlojamento + matchedInspecao.realizadoTstAlojamento;
                                                const resultadoAloj = totalMetaAloj > 0 
                                                    ? Math.min(100, Math.round((totalRealAloj / totalMetaAloj) * 100)) 
                                                    : 100;

                                                return (
                                                    <React.Fragment key={`cell-${mesName}-${ccItem.code || idx}`}>
                                                        <td className="px-1 py-1.5 text-center border-r border-slate-150">
                                                            <span className={`inline-flex font-mono text-[10.5px] font-bold px-1 py-0.5 rounded ${resultadoIFS >= 95 ? 'text-emerald-700 bg-emerald-50' : 'text-amber-700 bg-amber-50'}`}>{resultadoIFS}%</span>
                                                        </td>
                                                        <td className="px-1 py-1.5 text-center border-r border-slate-150">
                                                            <span className={`inline-flex font-mono text-[10.5px] font-bold px-1 py-0.5 rounded ${resultadoAloj >= 95 ? 'text-emerald-700 bg-emerald-50' : 'text-amber-700 bg-amber-50'}`}>{resultadoAloj}%</span>
                                                        </td>
                                                        <td className="px-1 py-1.5 text-center border-r border-slate-200">
                                                            <span className={`inline-flex font-mono text-[10.5px] font-extrabold px-1.5 py-0.5 rounded-sm ${matchedInspecao.resultadoGeral >= 95 ? 'text-emerald-800 bg-emerald-100' : 'text-rose-800 bg-rose-100'}`}>{matchedInspecao.resultadoGeral}%</span>
                                                        </td>
                                                    </React.Fragment>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Gráficos em Grade */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Média por Gestor */}
                        <div className="bg-white rounded-xl border p-4 shadow-sm">
                            <h4 className="text-xs font-bold text-slate-500 uppercase mb-4 flex justify-between">
                                <span>Média por Gestor</span>
                                <span className="text-slate-400 font-normal">{uniqueGestoresCount} gestores</span>
                            </h4>
                            <div className="h-56">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={gestorData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                        <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                                        <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} domain={[0, 100]} />
                                        <Tooltip formatter={(value) => [`${value}%`, 'Média']} />
                                        <Bar dataKey="media" radius={[6, 6, 0, 0]} barSize={24} minPointSize={3}>
                                            {gestorData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.media >= 95 ? '#10b981' : '#3b82f6'} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Média por Supervisor */}
                        <div className="bg-white rounded-xl border p-4 shadow-sm">
                            <h4 className="text-xs font-bold text-slate-500 uppercase mb-4 flex justify-between">
                                <span>Média por Supervisor SSMA</span>
                                <span className="text-slate-400 font-normal">{uniqueSupssmaCount} supervisores</span>
                            </h4>
                            <div className="h-56">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={supssmaData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                        <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                                        <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} domain={[0, 100]} />
                                        <Tooltip formatter={(value) => [`${value}%`, 'Média']} />
                                        <Bar dataKey="media" radius={[6, 6, 0, 0]} barSize={24} minPointSize={3}>
                                            {supssmaData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.media >= 95 ? '#10b981' : '#3b82f6'} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Média por TST */}
                        <div className="bg-white rounded-xl border p-4 shadow-sm">
                            <h4 className="text-xs font-bold text-slate-500 uppercase mb-4 flex justify-between">
                                <span>Média por TST</span>
                                <span className="text-slate-400 font-normal">{uniqueTstCount} TSTs</span>
                            </h4>
                            <div className="h-56">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={tstData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                        <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                                        <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} domain={[0, 100]} />
                                        <Tooltip formatter={(value) => [`${value}%`, 'Média']} />
                                        <Bar dataKey="media" radius={[6, 6, 0, 0]} barSize={24} minPointSize={3}>
                                            {tstData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.media >= 95 ? '#10b981' : '#3b82f6'} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Média por Encarregado */}
                        <div className="bg-white rounded-xl border p-4 shadow-sm">
                            <h4 className="text-xs font-bold text-slate-500 uppercase mb-4 flex justify-between">
                                <span>Média por Encarregado</span>
                                <span className="text-slate-400 font-normal">{uniqueEncarregadoCount} encarregados</span>
                            </h4>
                            <div className="h-56">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={encarregadoData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                        <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                                        <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} domain={[0, 100]} />
                                        <Tooltip formatter={(value) => [`${value}%`, 'Média']} />
                                        <Bar dataKey="media" radius={[6, 6, 0, 0]} barSize={24} minPointSize={3}>
                                            {encarregadoData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.media >= 95 ? '#10b981' : '#3b82f6'} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
