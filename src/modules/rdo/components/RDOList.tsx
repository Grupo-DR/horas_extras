import React from 'react';
import { FileText, Upload, Download, Trash2, Calendar, ClipboardList, ArrowRight, DollarSign, CloudRain, AlertTriangle, FileSpreadsheet } from 'lucide-react';
import { exportRDOsToExcel } from '../utils/excelExportUtils';
import * as db from '../services/firestoreService';
import { HistogramItem } from '../types';
import { RDOData, Team, Project } from '../types';
import { formatMoney, calculateRDOTotal, parseDate } from '../utils';

interface RDOListProps {
  rdos: RDOData[];
  selectedTeam: Team | null;
  selectedProject: Project | null;
  onSelectRDO: (rdo: RDOData) => void;
  onExportCSV: (rdo: RDOData) => void;
  onDeleteRDO: (id: string, e: React.MouseEvent) => void;
  onUploadNew: () => void;
}

export const RDOList: React.FC<RDOListProps> = ({ 
  rdos, 
  selectedTeam, 
  selectedProject, 
  onSelectRDO, 
  onExportCSV, 
  onDeleteRDO, 
  onUploadNew 
}) => {
  // Filta por equipe e ordena por data (mais recente primeiro)
  const teamRdos = rdos
    .filter(r => r.teamId === selectedTeam?.id)
    .sort((a, b) => parseDate(b.date).getTime() - parseDate(a.date).getTime());

  const [histograms, setHistograms] = React.useState<HistogramItem[]>([]);

  React.useEffect(() => {
    if (selectedProject?.id) {
      db.getHistograms(selectedProject.id)
        .then(setHistograms)
        .catch(err => console.error("Erro ao carregar histogramas", err));
    }
  }, [selectedProject]);

  const handleExportExcel = () => {
    if (!selectedTeam || !selectedProject) return;
    
    const fileName = `Diario_RDO_Equipe_${selectedTeam.name.replace(/\s+/g, '_')}_${selectedProject.name.replace(/\s+/g, '_')}.xlsx`;
    exportRDOsToExcel(teamRdos, selectedProject.name, histograms, fileName);
  };

  return (
    <div className="animate-fade-in space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-white tracking-tight">Relatórios Diários</h2>
          <p className="text-slate-400 text-sm mt-1">
            Histórico de produção para a turma <span className="text-blue-400 font-bold">{selectedTeam?.name}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {teamRdos.length > 0 && (
            <button 
              onClick={handleExportExcel}
              className="bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 px-6 py-3.5 rounded-2xl flex items-center gap-2.5 hover:scale-105 active:scale-95 transition-all border border-emerald-500/20 w-full md:w-auto justify-center font-bold text-sm tracking-wide"
              title="Exportar apontamento diário desta equipe para Excel"
            >
              <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
              <span>Exportar Excel</span>
            </button>
          )}

          <button 
            onClick={onUploadNew}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-8 py-3.5 rounded-2xl flex items-center gap-3 hover:scale-105 active:scale-95 transition-all shadow-xl shadow-blue-900/40 group border border-white/10 w-full md:w-auto justify-center"
          >
            <Upload className="w-5 h-5 group-hover:-translate-y-1 transition-transform duration-300" />
            <span className="font-black text-sm tracking-wide uppercase">Analisar com IA</span>
          </button>
        </div>
      </div>

      {teamRdos.length === 0 ? (
        <div className="py-24 glass-panel rounded-[40px] border border-dashed border-white/10 flex flex-col items-center justify-center text-center px-6">
           <div className="bg-white/5 p-8 rounded-full mb-8 shadow-inner border border-white/5">
              <ClipboardList className="w-14 h-14 text-slate-700 opacity-20" />
           </div>
           <h4 className="text-xl font-bold text-white mb-3">Histórico Vazio</h4>
           <p className="text-slate-500 max-w-xs leading-relaxed">Não há relatórios processados para esta turma. Utilize a inteligência artificial para extrair dados de imagens ou PDFs.</p>
           <button 
              onClick={onUploadNew}
              className="mt-10 px-8 py-3 bg-white/5 text-white font-bold rounded-2xl border border-white/10 hover:bg-white/10 transition-all backdrop-blur-sm"
            >
              Iniciar primeira análise
           </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="hidden md:grid grid-cols-12 px-10 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] pb-2">
            <div className="col-span-1 text-center">Info</div>
            <div className="col-span-4">Relatório e Data</div>
            <div className="col-span-3 text-right">Valor Produzido</div>
            <div className="col-span-4 text-right">Ações Rápidas</div>
          </div>
          
          {teamRdos.map(rdo => {
            const rdoTotal = calculateRDOTotal(rdo, selectedProject || undefined);

            return (
              <div 
                key={rdo.id}
                onClick={() => onSelectRDO(rdo)}
                className="glass-card p-5 md:px-10 rounded-[28px] border border-white/5 hover:border-blue-500/30 cursor-pointer transition-all duration-300 group relative overflow-hidden flex flex-col md:grid md:grid-cols-12 md:items-center gap-4 md:gap-0"
              >
                {/* Background Decor */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-[50px] opacity-0 group-hover:opacity-100 transition-all duration-500 pointer-events-none" />
                
                {/* Col 1: Identifier Box */}
                <div className="col-span-1 flex justify-center md:block">
                  <div className="bg-blue-500/10 w-12 h-12 flex flex-col items-center justify-center rounded-xl border border-blue-500/10 group-hover:bg-blue-500/20 transition-all shadow-inner group-hover:scale-110 origin-center">
                    <span className="text-[8px] font-black text-blue-400/60 uppercase leading-none mb-0.5">RDO</span>
                    <span className="text-[15px] font-black text-blue-400 leading-none">#{rdo.reportNumber}</span>
                  </div>
                </div>

                {/* Col 2: Info (Cleaned up) */}
                <div className="col-span-4 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest px-2 py-0.5 bg-blue-500/10 rounded-md border border-blue-500/10">DIÁRIO</span>
                    <div className="flex items-center gap-1.5 text-slate-500 font-bold text-[11px] uppercase tracking-wider ml-1">
                      <Calendar className="w-4 h-4 text-slate-600" />
                      {rdo.date}
                    </div>
                  </div>
                  <p className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.15em]">Produção Diária Consolidada</p>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-500/10 border border-sky-500/20 text-[10px] font-black text-sky-400 uppercase tracking-widest">
                      <CloudRain className="w-3 h-3" />
                      {rdo.weather || 'Sem clima'}
                    </span>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px] font-black uppercase tracking-widest ${
                      (rdo.occurrences?.length || 0) > 0
                        ? 'bg-red-500/10 border-red-500/20 text-red-400'
                        : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                    }`}>
                      <AlertTriangle className="w-3 h-3" />
                      {rdo.occurrences?.length || 0} ocorr.
                    </span>
                  </div>
                </div>

                {/* Col 3: Financial */}
                <div className="col-span-3 md:text-right">
                  <div className="flex flex-col md:items-end">
                    <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-0.5">Faturamento Dia</span>
                    <span className="text-xl font-black text-emerald-400 font-mono tracking-tighter">
                      {formatMoney(rdoTotal)}
                    </span>
                  </div>
                </div>

                {/* Col 4: Actions */}
                <div className="col-span-4 flex justify-end items-center gap-4">
                  <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                    <button 
                      onClick={(e) => { e.stopPropagation(); onExportCSV(rdo); }}
                      className="p-3 bg-white/5 text-slate-400 hover:text-emerald-400 hover:bg-emerald-400/10 rounded-xl border border-white/5 transition-all shadow-lg shadow-emerald-900/10"
                      title="Exportar CSV"
                    >
                      <Download className="w-5 h-5" />
                    </button>
                    <button 
                       onClick={(e) => onDeleteRDO(rdo.id, e)}
                       className="p-3 bg-white/5 text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded-xl border border-white/5 transition-all shadow-lg shadow-red-900/10"
                       title="Excluir"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="hidden md:flex ml-2 w-10 h-10 bg-white/5 rounded-full items-center justify-center border border-white/5 group-hover:bg-blue-500/10 group-hover:border-blue-500/20 transition-all">
                    <ArrowRight className="w-5 h-5 text-slate-600 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
