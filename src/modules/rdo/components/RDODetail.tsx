import React from 'react';
import { 
  FileText, Download, Trash2, X, HardHat, Truck, 
  Activity, Calendar, DollarSign, CheckCircle2, Clock,
  CloudRain, AlertTriangle, MessageSquare, Edit, Save
} from 'lucide-react';
import { RDOData, Project, Team } from '../types';
import { formatMoney, getServiceByCode } from '../utils';
import { RDOEditForm } from './RDOEditForm';

interface RDODetailProps {
  currentRDO: RDOData | null;
  selectedProject: Project | null;
  selectedTeam: Team | null;
  onClose: () => void;
  onExportCSV: (rdo: RDOData) => void;
  onDeleteRDO: (id: string, e: React.MouseEvent) => void;
  onSaveUpdatedRdo: (updatedRdo: RDOData) => void;
}

export const RDODetail: React.FC<RDODetailProps> = ({ 
  currentRDO, 
  selectedProject, 
  selectedTeam,
  onClose, 
  onExportCSV, 
  onDeleteRDO,
  onSaveUpdatedRdo
}) => {
  const [isEditing, setIsEditing] = React.useState(false);

  if (!currentRDO) return null;

  if (isEditing && selectedProject && selectedTeam) {
    return (
      <RDOEditForm 
        rdo={currentRDO}
        project={selectedProject}
        team={selectedTeam}
        onCancel={() => setIsEditing(false)}
        onSave={(updated) => {
          onSaveUpdatedRdo(updated);
          setIsEditing(false);
        }}
      />
    );
  }
  let totalFinancial = 0;

  const workforceCount = currentRDO.workforce.reduce((acc, curr) => acc + curr.count, 0);
  const totalManHours = currentRDO.workforce.reduce((acc, curr) => acc + curr.totalHours, 0);
  const occurrences = currentRDO.occurrences || [];
  const totalOccurrenceImpact = occurrences.reduce((acc, curr) => acc + (curr.impactTimeMinutes || 0), 0);
  const commentsText = (currentRDO.comments || '').trim();
  const shiftMatch = commentsText.match(/\b\d{1,2}(?::|h)\d{2}\s*(?:às|as|a|-)\s*\d{1,2}(?::|h)\d{2}\b/i);
  const workShift = shiftMatch ? shiftMatch[0].replace(/h/gi, ':').replace(/\s+/g, ' ').trim() : null;

  return (
    <div className="animate-fade-in space-y-8 pb-32">
      {/* Header Panel */}
      <div className="glass-panel p-8 rounded-[40px] border border-white/5 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-500" />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <span className="px-3 py-1 bg-blue-500/10 text-blue-400 text-[10px] font-black uppercase tracking-widest rounded-full border border-blue-500/10">
              Relatório Diário de Obra
            </span>
            <div className="flex items-center gap-1.5 text-slate-500 text-[11px] font-bold">
              <Calendar className="w-3.5 h-3.5" />
              {currentRDO.date}
            </div>
          </div>
          <h2 className="text-4xl font-black text-white tracking-tighter">RDO #{currentRDO.reportNumber}</h2>
        </div>
        <div className="flex gap-3 relative z-10">
          <button 
            onClick={() => setIsEditing(true)} 
            className="p-4 bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white rounded-2xl transition-all border border-blue-500/10 shadow-lg shadow-blue-900/10" 
            title="Editar RDO"
          >
            <Edit className="w-6 h-6" />
          </button>
          <button 
            onClick={() => onExportCSV(currentRDO)} 
            className="p-4 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-white rounded-2xl transition-all border border-emerald-500/10 shadow-lg shadow-emerald-900/10" 
            title="Exportar CSV"
          >
            <Download className="w-6 h-6" />
          </button>
          <button 
            onClick={(e) => onDeleteRDO(currentRDO.id, e)} 
            className="p-4 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-2xl transition-all border border-red-500/10 shadow-lg shadow-red-900/10" 
            title="Excluir"
          >
            <Trash2 className="w-6 h-6" />
          </button>
          <button 
            onClick={onClose} 
            className="p-4 bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 rounded-2xl transition-all border border-white/5"
          >
             <X className="w-6 h-6" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        <div className="glass-card p-10 rounded-[40px] border border-white/5 hover:border-blue-500/20 transition-all duration-500 group relative overflow-hidden">
          <div className="absolute top-0 right-0 w-40 h-40 bg-blue-500/5 blur-[60px] pointer-events-none" />
          <div className="flex items-center gap-4 mb-8 relative z-10">
            <div className="bg-blue-500/10 p-3.5 rounded-2xl border border-blue-500/10">
              <CloudRain className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h3 className="text-2xl font-black text-white tracking-tight">Condições e Jornada</h3>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mt-1">Clima e Horário de Trabalho</p>
            </div>
          </div>

          <div className="space-y-3 relative z-10">
            <div className="flex items-center justify-between py-3 px-4 rounded-xl bg-white/[0.03] border border-white/5">
              <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Clima Manhã</span>
              <span className="text-sm font-bold text-blue-300">{currentRDO.weatherMorning || 'Não informado'}</span>
            </div>
            <div className="flex items-center justify-between py-3 px-4 rounded-xl bg-white/[0.03] border border-white/5">
              <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Clima Tarde</span>
              <span className="text-sm font-bold text-blue-300">{currentRDO.weatherAfternoon || 'Não informado'}</span>
            </div>
            <div className="flex items-center justify-between py-3 px-4 rounded-xl bg-white/[0.03] border border-white/5">
              <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Pluviometria</span>
              <span className="text-sm font-bold text-blue-300">{currentRDO.rainIndexMm || 0} mm</span>
            </div>
            <div className="flex items-center justify-between py-3 px-4 rounded-xl bg-white/[0.03] border border-white/5">
              <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Jornada Informada</span>
              <span className="text-sm font-bold text-emerald-300">{workShift || 'Não identificada'}</span>
            </div>
            <div className="flex items-center justify-between py-3 px-4 rounded-xl bg-white/[0.03] border border-white/5">
              <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Horas-Homem</span>
              <span className="text-sm font-bold text-emerald-300">{totalManHours.toFixed(1)}h</span>
            </div>
          </div>
        </div>

        <div className="glass-card p-10 rounded-[40px] border border-white/5 hover:border-red-500/20 transition-all duration-500 group relative overflow-hidden">
          <div className="absolute top-0 right-0 w-40 h-40 bg-red-500/5 blur-[60px] pointer-events-none" />
          <div className="flex items-center justify-between mb-8 relative z-10">
            <div className="flex items-center gap-4">
              <div className="bg-red-500/10 p-3.5 rounded-2xl border border-red-500/10">
                <AlertTriangle className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h3 className="text-2xl font-black text-white tracking-tight">Ocorrências</h3>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mt-1">Impactos Operacionais</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xl font-black text-white">{occurrences.length}</p>
              <p className="text-[10px] font-black text-red-400 uppercase tracking-widest">{totalOccurrenceImpact} min</p>
            </div>
          </div>

          {occurrences.length > 0 ? (
            <div className="space-y-3 max-h-56 overflow-y-auto pr-1 custom-scrollbar relative z-10">
              {occurrences.map((occ, idx) => (
                <div key={`${occ.description}-${idx}`} className="p-4 rounded-xl bg-white/[0.03] border border-white/5">
                  <p className="text-sm text-slate-200 leading-relaxed font-medium">{occ.description || 'Ocorrência sem descrição.'}</p>
                  <p className="text-[10px] font-black text-red-400 uppercase tracking-widest mt-2">
                    Impacto: {occ.impactTimeMinutes || 0} min
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center text-slate-500 font-medium italic border border-dashed border-white/10 rounded-2xl relative z-10">
              Nenhuma ocorrência registrada neste RDO.
            </div>
          )}

          <div className="mt-8 pt-6 border-t border-white/5 relative z-10">
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare className="w-4 h-4 text-blue-400" />
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Observações</p>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">
              {commentsText || 'Sem observações registradas.'}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Workforce Section */}
        <div className="glass-card p-10 rounded-[40px] border border-white/5 hover:border-emerald-500/20 transition-all duration-500 group relative overflow-hidden">
           <div className="absolute top-0 right-0 w-40 h-40 bg-emerald-500/5 blur-[60px] pointer-events-none" />
           <div className="flex justify-between items-center mb-10 relative z-10">
             <div className="flex items-center gap-4">
                <div className="bg-emerald-500/10 p-3.5 rounded-2xl border border-emerald-500/10">
                   <HardHat className="w-6 h-6 text-emerald-400" />
                </div>
                <h3 className="text-2xl font-black text-white tracking-tight">Efetivo Operacional</h3>
             </div>
             <div className="px-4 py-2 bg-emerald-500/10 rounded-xl border border-emerald-500/10">
                <span className="text-xl font-black text-emerald-400 font-mono tracking-tighter">{workforceCount}</span>
             </div>
           </div>
           
           <div className="overflow-x-auto relative z-10">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-white/5 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
                    <th className="pb-4 px-2">Categoria Profissional</th>
                    <th className="pb-4 px-2 text-center">Quantitativo</th>
                    <th className="pb-4 px-2 text-right">Carga Horária</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.02]">
                  {currentRDO.workforce.map((w, idx) => (
                    <tr key={idx} className="group/row">
                      <td className="py-5 px-2 font-bold text-slate-200 group-hover/row:text-emerald-400 transition-colors uppercase text-xs">{w.role}</td>
                      <td className="py-5 px-2 text-center">
                        <span className="bg-white/5 px-3 py-1 rounded-lg text-white font-mono font-bold text-sm border border-white/5 shadow-inner">{w.count}</span>
                      </td>
                      <td className="py-5 px-2 text-right">
                         <div className="flex items-center justify-end gap-1.5 text-slate-400 font-mono font-bold text-sm">
                            <Clock className="w-3.5 h-3.5 text-emerald-500/50" />
                            {w.totalHours}H
                         </div>
                      </td>
                    </tr>
                  ))}
                  {currentRDO.workforce.length === 0 && (
                    <tr><td colSpan={3} className="py-12 text-center text-slate-500 font-medium italic">Nenhum registro de mão de obra identificado.</td></tr>
                  )}
                </tbody>
              </table>
           </div>
        </div>

        {/* Equipment Section */}
        <div className="glass-card p-10 rounded-[40px] border border-white/5 hover:border-blue-500/20 transition-all duration-500 group relative overflow-hidden">
           <div className="absolute top-0 right-0 w-40 h-40 bg-blue-500/5 blur-[60px] pointer-events-none" />
           <div className="flex items-center gap-4 mb-10 relative z-10">
              <div className="bg-blue-500/10 p-3.5 rounded-2xl border border-blue-500/10">
                 <Truck className="w-6 h-6 text-blue-400" />
              </div>
              <h3 className="text-2xl font-black text-white tracking-tight">Equipamentos e Máquinas</h3>
           </div>
           
           <div className="overflow-x-auto relative z-10">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-white/5 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
                    <th className="pb-4 px-2">Designação</th>
                    <th className="pb-4 px-2 text-center">Unidades</th>
                    <th className="pb-4 px-2 text-right">Horas Operativas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.02]">
                  {currentRDO.equipment.map((e, idx) => (
                    <tr key={idx} className="group/row">
                      <td className="py-5 px-2 font-bold text-slate-200 group-hover/row:text-blue-400 transition-colors uppercase text-xs">{e.name}</td>
                      <td className="py-5 px-2 text-center text-white font-mono font-bold text-sm">{e.count}</td>
                      <td className="py-5 px-2 text-right">
                         <div className="flex items-center justify-end gap-1.5 text-slate-400 font-mono font-bold text-sm">
                            <Clock className="w-3.5 h-3.5 text-blue-500/50" />
                            {e.hoursOperated}H
                         </div>
                      </td>
                    </tr>
                  ))}
                  {currentRDO.equipment.length === 0 && (
                     <tr><td colSpan={3} className="py-12 text-center text-slate-500 font-medium italic">Nenhum equipamento registrado nesta data.</td></tr>
                  )}
                </tbody>
              </table>
           </div>
        </div>
      </div>

      {/* Activities Section */}
      <div className="glass-panel rounded-[48px] border border-white/5 overflow-hidden shadow-2xl relative">
        <div className="p-10 border-b border-white/5 bg-white/[0.02] flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="bg-blue-600 p-3 rounded-2xl shadow-lg shadow-blue-900/40">
               <Activity className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-2xl font-black text-white tracking-tight">Fluxo de Atividades</h3>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mt-1">Produção e Metas Cumpridas</p>
            </div>
          </div>
          <div className="px-5 py-2.5 bg-white/5 rounded-2xl border border-white/10">
             <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mr-3">Volume de Dados:</span>
             <span className="text-sm font-black text-white">{currentRDO.activities.length} Atividades</span>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-white/[0.03] border-b border-white/5 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
                <th className="py-6 px-10">Cód. Sistema</th>
                <th className="py-6 px-10">Descrição da Produção Executada</th>
                <th className="py-6 px-10 text-center">Quantitativo</th>
                <th className="py-6 px-10 text-right">Financeiro (Dia)</th>
                <th className="py-6 px-10 text-right">Status Atual</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.02]">
              {currentRDO.activities.map((act, idx) => {
                const serviceItem = act.code && selectedProject ? getServiceByCode(selectedProject, act.code) : undefined;
                const itemTotal = serviceItem && act.quantity ? serviceItem.value * act.quantity : 0;
                totalFinancial += itemTotal;
                
                return (
                  <tr key={idx} className="hover:bg-white/[0.02] transition-all group">
                    <td className="py-7 px-10 font-mono text-blue-400 font-bold text-[11px] group-hover:scale-110 transition-transform origin-left">{act.code || 'S/C'}</td>
                    <td className="py-7 px-10 text-slate-200 font-semibold group-hover:text-white transition-colors leading-relaxed">
                      {act.description}
                    </td>
                    <td className="py-7 px-10 text-center">
                       <span className="bg-white/5 text-slate-300 font-bold px-4 py-1.5 rounded-xl border border-white/5 shadow-inner">{act.quantity || 0}</span>
                    </td>
                    <td className="py-7 px-10 text-right font-black text-emerald-400 font-mono text-lg tracking-tighter">
                      {formatMoney(itemTotal)}
                    </td>
                    <td className="py-7 px-10 text-right">
                       <div className="flex items-center justify-end gap-2 text-[10px] font-black text-blue-500/70 border border-blue-500/10 px-3 py-1.5 rounded-full bg-blue-500/5 group-hover:bg-blue-500/20 group-hover:text-blue-400 transition-all uppercase tracking-widest">
                          <CheckCircle2 className="w-3 h-3" />
                          {act.status}
                       </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {totalFinancial > 0 && (
              <tfoot className="bg-emerald-500/5 border-t border-emerald-500/20">
                <tr>
                  <td colSpan={3} className="py-8 px-10 text-right text-sm font-black text-emerald-500 uppercase tracking-[0.2em]">Resultado Financeiro Consolidado</td>
                  <td className="py-8 px-10 text-right">
                     <div className="flex flex-col items-end">
                       <span className="text-3xl font-black text-emerald-400 font-mono tracking-tighter shimmer">{formatMoney(totalFinancial)}</span>
                       <span className="text-[10px] font-black text-emerald-600/50 uppercase tracking-widest mt-1">Produção do Período Diário</span>
                     </div>
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
};
