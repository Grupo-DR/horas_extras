
import React, { useState, useMemo } from 'react';
import { ConstructionRecord, ServicePrice } from '../types';
import { Search, Download, MapPin, Timer, TimerOff, Info, Truck } from 'lucide-react';
import { calculateRecordFinancials, formatCurrency, getTrechoInfo } from '../utils/calculations';
import { DEFAULT_SERVICE_PRICES } from '../utils/constants';

interface DataTableProps {
  data: ConstructionRecord[];
  servicePrices?: ServicePrice[];
}

const DataTable: React.FC<DataTableProps> = ({ data, servicePrices = DEFAULT_SERVICE_PRICES }) => {
  const [searchTerm, setSearchTerm] = useState('');

  // Processa dados com informações financeiras e geográficas
  const recordsWithFinancials = useMemo(() => {
    return data
      .map(record => ({
        ...record,
        financials: calculateRecordFinancials(record, servicePrices),
        geo: getTrechoInfo(record.trechoFinal)
      }));
  }, [data, servicePrices]);

  const filtered = recordsWithFinancials.filter(record =>
    Object.values(record).some(val =>
      String(val).toLowerCase().includes(searchTerm.toLowerCase())
    ) ||
    record.geo.cidade.toLowerCase().includes(searchTerm.toLowerCase()) ||
    record.geo.supervisao.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PRODUTIVA':
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded text-[9px] font-bold">
            <Timer className="w-3 h-3" /> PROD
          </span>
        );
      case 'IMPRODUTIVA':
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-[9px] font-bold">
            <TimerOff className="w-3 h-3" /> IMPROD
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-[9px] font-bold">
            <Info className="w-3 h-3" /> OUTRO
          </span>
        );
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar em frotas, cidades, itens..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 rounded-lg transition-colors border border-slate-200">
            <Download className="w-4 h-4" />
            Exportar CSV
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Data</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Frota</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Localização</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right">Produção</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right">Faturamento</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-700 uppercase tracking-wider text-right bg-amber-50/50">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((record, idx) => (
              <tr key={idx} className="hover:bg-slate-50 transition-colors group">
                <td className="px-6 py-3 text-[11px] text-slate-600 whitespace-nowrap">{record.data}</td>
                <td className="px-6 py-3 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <div className="bg-slate-100 p-1.5 rounded-md">
                      <Truck className="w-3.5 h-3.5 text-slate-500" />
                    </div>
                    <span className="text-[11px] font-bold text-slate-900">{record.frota}</span>
                  </div>
                </td>
                <td className="px-6 py-3 whitespace-nowrap">
                  <div className="flex items-center gap-1.5">
                    {record.geo.cidade && <MapPin className="w-3 h-3 text-red-400" />}
                    <div className="flex flex-col">
                      <span className="text-[11px] font-bold text-slate-700">{record.geo.cidade}</span>
                      <div className="flex items-center gap-1">
                        <span className="text-[9px] font-medium text-slate-400 uppercase">{record.geo.trecho}</span>
                        {record.trechoFinal && record.geo.trecho && <span className="text-[9px] text-slate-300">|</span>}
                        <span className="text-[9px] text-slate-400 font-mono">{record.trechoFinal}</span>
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-3">
                  {getStatusBadge(record.financials.status)}
                  <div className="text-[9px] text-slate-400 mt-0.5 truncate max-w-[100px]">{record.item}</div>
                </td>
                <td className="px-6 py-3 text-[11px] font-bold text-slate-900 text-right">
                  {record.producao.toLocaleString()}
                </td>
                <td className="px-6 py-3 text-[11px] text-slate-600 text-right font-medium">
                  <div className="text-[9px] font-semibold text-blue-600">{formatCurrency(record.financials.valorRental)}</div>
                  <div className="text-[9px] font-semibold text-emerald-600">{formatCurrency(record.financials.valorMobra)}</div>
                </td>
                <td className="px-6 py-3 text-[11px] font-bold text-amber-600 text-right bg-amber-50/20 group-hover:bg-amber-50/40">
                  {formatCurrency(record.financials.total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filtered.length === 0 && (
        <div className="p-12 text-center text-slate-400 italic">
          Nenhum registro com faturamento encontrado para os critérios selecionados.
        </div>
      )}
    </div>
  );
};

export default DataTable;
