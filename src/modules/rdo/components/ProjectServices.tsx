import React from 'react';
import { FileSpreadsheet, Plus, Users, Table as TableIcon, BarChart2 } from 'lucide-react';
import { Project, ServiceItem } from '../types';
import { formatMoney } from '../utils';

interface ProjectServicesProps {
  selectedProject: Project | null;
  projectTab: 'TEAMS' | 'SERVICES';
  onSetTab: (tab: 'TEAMS' | 'SERVICES') => void;
  onServicesUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

export const ProjectServices: React.FC<ProjectServicesProps> = ({ 
  selectedProject, 
  projectTab, 
  onSetTab, 
  onServicesUpload 
}) => {
  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex space-x-2 glass-panel p-2 rounded-2xl border border-white/5 shadow-inner mb-8">
        <button
          onClick={() => onSetTab('TEAMS')}
          className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 text-sm font-bold rounded-xl transition-all duration-300 ${
            projectTab === 'TEAMS' 
              ? 'bg-gradient-premium text-white shadow-lg shadow-blue-600/20 scale-[1.02]' 
              : 'text-slate-500 hover:text-white hover:bg-white/5'
          }`}
        >
          <Users className="w-4 h-4" />
          TURMAS E EQUIPES
        </button>
        <button
          onClick={() => onSetTab('SERVICES')}
          className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 text-sm font-bold rounded-xl transition-all duration-300 ${
            projectTab === 'SERVICES' 
              ? 'bg-gradient-premium text-white shadow-lg shadow-blue-600/20 scale-[1.02]' 
              : 'text-slate-500 hover:text-white hover:bg-white/5'
          }`}
        >
          <TableIcon className="w-4 h-4" />
          TABELA DE PREÇOS
        </button>
      </div>

      {projectTab === 'SERVICES' && (
        <div className="animate-fade-in space-y-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h2 className="text-3xl font-bold text-white tracking-tight text-gradient">Serviços Disponíveis</h2>
              <p className="text-slate-400 text-sm mt-1">
                Catálogo de serviços e valores unitários para <span className="text-blue-400 font-semibold">{selectedProject?.name}</span>
              </p>
            </div>
            <div className="relative group">
              <input
                type="file"
                accept=".xlsx, .xls"
                onChange={onServicesUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
              <button 
                className="bg-emerald-600/10 text-emerald-400 px-6 py-3 rounded-2xl flex items-center gap-3 border border-emerald-500/20 group-hover:bg-emerald-600 group-hover:text-white transition-all shadow-xl shadow-emerald-900/10"
              >
                <FileSpreadsheet className="w-5 h-5" />
                <span className="font-bold text-sm">Atualizar Tabela</span>
              </button>
            </div>
          </div>

          {!selectedProject?.services || selectedProject.services.length === 0 ? (
            <div className="py-24 glass-panel rounded-[40px] border border-dashed border-white/10 flex flex-col items-center justify-center text-center px-6">
              <div className="bg-white/5 p-8 rounded-full mb-8 shadow-inner border border-white/5">
                 <FileSpreadsheet className="w-14 h-14 text-slate-700 opacity-20" />
              </div>
              <h4 className="text-xl font-bold text-white mb-3">Tabela Vazia</h4>
              <p className="text-slate-500 max-w-xs leading-relaxed">Nenhum serviço importado para esta obra. Importe uma planilha XLSX para configurar os preços.</p>
            </div>
          ) : (
            <div className="glass-panel rounded-3xl border border-white/5 overflow-hidden shadow-2xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-white/[0.03] border-b border-white/5">
                      <th className="py-5 px-8 text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em]">Cód. Item</th>
                      <th className="py-5 px-8 text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em]">Escopo e Descritivo</th>
                      <th className="py-5 px-8 text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em] text-center">Unid.</th>
                      <th className="py-5 px-8 text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em] text-right">Preço Unitário</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.02]">
                    {selectedProject.services.map((service, idx) => (
                      <tr key={idx} className="hover:bg-white/[0.03] transition-colors group">
                        <td className="py-5 px-8 font-mono text-xs text-blue-400/70 font-bold tracking-tight">{service.code}</td>
                        <td className="py-5 px-8 font-semibold text-slate-200 group-hover:text-white transition-colors">{service.scope}</td>
                        <td className="py-5 px-8 text-center bg-white/[0.01]">
                           <span className="px-2 py-1 bg-white/5 text-slate-400 text-[10px] font-bold rounded-md border border-white/5">{service.unit}</span>
                        </td>
                        <td className="py-5 px-8 text-right font-mono font-bold text-emerald-400 group-hover:scale-105 transition-transform">
                          {formatMoney(service.value)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
