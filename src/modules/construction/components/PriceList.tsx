
import React, { useState } from 'react';
import { ServicePrice } from '../types';
import { Info, Search, Building2, Truck } from 'lucide-react';

interface PriceListProps {
  prices: ServicePrice[];
}

const PriceList: React.FC<PriceListProps> = ({ prices }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'RENTAL' | 'MOBRA'>('RENTAL');

  const formatCurrency = (val: number | null) => 
    val !== null 
      ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)
      : '---';

  const filtered = prices.filter(p => 
    p.category === activeTab && (
      p.descricao.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.codigo_sap && p.codigo_sap.toLowerCase().includes(searchTerm.toLowerCase())) ||
      p.item.toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="bg-blue-50 p-3 rounded-xl">
              <Info className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800">Catálogo SAP Separado</h3>
              <p className="text-slate-500 text-sm">
                Visualização distinta para itens de Rental e Mão de Obra (Construtora).
              </p>
            </div>
          </div>
          
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Filtrar nesta categoria..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Category Tabs */}
        <div className="flex p-1 bg-slate-100 rounded-xl w-full sm:w-fit">
          <button
            onClick={() => setActiveTab('RENTAL')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${
              activeTab === 'RENTAL' 
                ? 'bg-white text-slate-900 shadow-sm' 
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Truck className="w-4 h-4" />
            Catálogo Rental
          </button>
          <button
            onClick={() => setActiveTab('MOBRA')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${
              activeTab === 'MOBRA' 
                ? 'bg-white text-slate-900 shadow-sm' 
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Building2 className="w-4 h-4" />
            Catálogo Construtora (Mobra)
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Item</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Código SAP</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Descrição</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Unid</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-right">Preço Unitário</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((p, idx) => (
                <tr key={idx} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 text-sm font-medium text-slate-900">{p.item}</td>
                  <td className="px-6 py-4 text-sm text-amber-600 font-mono">
                    {p.codigo_sap || <span className="text-slate-300">---</span>}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600 font-medium">{p.descricao}</td>
                  <td className="px-6 py-4 text-sm text-slate-500">{p.unidade}</td>
                  <td className="px-6 py-4 text-sm font-bold text-slate-900 text-right">
                    {formatCurrency(p.preco_unitario)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="p-12 text-center text-slate-400 italic">
            Nenhum serviço encontrado na categoria {activeTab === 'RENTAL' ? 'Rental' : 'Construtora'}.
          </div>
        )}
      </div>
    </div>
  );
};

export default PriceList;
