import React, { useState } from 'react';
import { 
  Save, X, Plus, Trash2, HardHat, Truck, ClipboardList, AlertTriangle, 
  MessageSquare, Calendar, FileText, Hash, Cloud, CloudRain
} from 'lucide-react';
import { RDOData, Project, Team, WorkerGroup, Equipment, Activity, Occurence } from '../types';
import { formatMoney, getServiceByCode } from '../utils';

interface RDOEditFormProps {
  rdo: RDOData;
  project: Project;
  team: Team;
  onSave: (updatedRdo: RDOData) => void;
  onCancel: () => void;
}

export const RDOEditForm: React.FC<RDOEditFormProps> = ({ 
  rdo, 
  project, 
  team, 
  onSave, 
  onCancel 
}) => {
  const [formData, setFormData] = useState<RDOData>({ ...rdo });

  const handleChange = (field: keyof RDOData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Workforce Handlers
  const updateWorkforce = (index: number, field: keyof WorkerGroup, value: any) => {
    const newList = [...formData.workforce];
    newList[index] = { ...newList[index], [field]: value };
    setFormData(prev => ({ ...prev, workforce: newList }));
  };

  const addWorkforce = () => {
    setFormData(prev => ({ 
      ...prev, 
      workforce: [...prev.workforce, { role: '', count: 0, totalHours: 0 }] 
    }));
  };

  const removeWorkforce = (index: number) => {
    setFormData(prev => ({ 
      ...prev, 
      workforce: prev.workforce.filter((_, i) => i !== index) 
    }));
  };

  // Equipment Handlers
  const updateEquipment = (index: number, field: keyof Equipment, value: any) => {
    const newList = [...formData.equipment];
    newList[index] = { ...newList[index], [field]: value };
    setFormData(prev => ({ ...prev, equipment: newList }));
  };

  const addEquipment = () => {
    setFormData(prev => ({ 
      ...prev, 
      equipment: [...prev.equipment, { name: '', count: 0, hoursOperated: 0 }] 
    }));
  };

  const removeEquipment = (index: number) => {
    setFormData(prev => ({ 
      ...prev, 
      equipment: prev.equipment.filter((_, i) => i !== index) 
    }));
  };

  // Activity Handlers
  const updateActivity = (index: number, field: keyof Activity, value: any) => {
    const newList = [...formData.activities];
    newList[index] = { ...newList[index], [field]: value };
    setFormData(prev => ({ ...prev, activities: newList }));
  };

  const addActivity = () => {
    setFormData(prev => ({ 
      ...prev, 
      activities: [...prev.activities, { description: '', progress: 0, quantity: 0, status: 'Em andamento' }] 
    }));
  };

  const removeActivity = (index: number) => {
    setFormData(prev => ({ 
      ...prev, 
      activities: prev.activities.filter((_, i) => i !== index) 
    }));
  };

  // Occurrence Handlers
  const updateOccurrence = (index: number, field: keyof Occurence, value: any) => {
    const newList = [...formData.occurrences || []];
    newList[index] = { ...newList[index], [field]: value };
    setFormData(prev => ({ ...prev, occurrences: newList }));
  };

  const addOccurrence = () => {
    setFormData(prev => ({ 
      ...prev, 
      occurrences: [...(prev.occurrences || []), { description: '', impactTimeMinutes: 0 }] 
    }));
  };

  const removeOccurrence = (index: number) => {
    setFormData(prev => ({ 
      ...prev, 
      occurrences: (prev.occurrences || []).filter((_, i) => i !== index) 
    }));
  };

  const totalFinancial = formData.activities.reduce((sum, act) => {
    const serviceItem = act.code ? getServiceByCode(project, act.code) : undefined;
    return sum + (serviceItem && act.quantity ? serviceItem.value * act.quantity : 0);
  }, 0);

  const inputClass = "w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:ring-2 focus:ring-blue-500/50 outline-none transition-all placeholder:text-slate-500";
  const labelClass = "block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1";
  const sectionTitleClass = "text-xl font-bold text-white flex items-center gap-3 mb-6";

  return (
    <div className="animate-fade-in pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-black text-white tracking-tight">Editar Relatório</h2>
          <p className="text-slate-400 text-sm mt-1 font-medium">Alterando informações operacionais para <span className="text-blue-400">{team.name}</span></p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={onCancel} 
            className="flex items-center gap-2 px-6 py-3 text-sm font-bold text-slate-300 bg-white/5 border border-white/10 hover:bg-white/10 rounded-2xl transition-all shadow-xl"
          >
            <X className="w-4 h-4" /> Cancelar
          </button>
          <button 
            onClick={() => onSave(formData)} 
            className="flex items-center gap-2 px-6 py-3 text-sm font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 rounded-2xl transition-all shadow-xl shadow-emerald-900/20"
          >
            <Save className="w-4 h-4" /> Salvar Alterações
          </button>
        </div>
      </div>

      {/* Header Form */}
      <div className="glass-panel p-8 rounded-[32px] border border-white/5 mb-8 shadow-2xl">
        <h3 className={sectionTitleClass}>
          <div className="bg-blue-500/10 p-2 rounded-xl">
            <FileText className="w-5 h-5 text-blue-400" />
          </div>
          Informações Gerais
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div>
            <label className={labelClass}>Nº do Relatório</label>
            <div className="relative">
              <Hash className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input 
                type="text" 
                value={formData.reportNumber} 
                onChange={e => handleChange('reportNumber', e.target.value)}
                className={inputClass.replace("px-4", "pl-11")}
              />
            </div>
          </div>
          <div>
            <label className={labelClass}>Data</label>
            <div className="relative">
              <Calendar className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input 
                type="text" 
                value={formData.date} 
                onChange={e => handleChange('date', e.target.value)}
                placeholder="DD/MM/AAAA"
                className={inputClass.replace("px-4", "pl-11")}
              />
            </div>
          </div>
          <div>
            <label className={labelClass}>Contrato</label>
            <input 
              type="text" 
              value={formData.contractNumber} 
              onChange={e => handleChange('contractNumber', e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Chuva (mm)</label>
            <div className="relative">
              <CloudRain className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input 
                type="number" 
                value={formData.rainIndexMm} 
                onChange={e => handleChange('rainIndexMm', parseFloat(e.target.value) || 0)}
                className={inputClass.replace("px-4", "pl-11")}
              />
            </div>
          </div>
          <div>
            <label className={labelClass}>Clima Manhã</label>
            <div className="relative">
              <Cloud className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input 
                type="text" 
                value={formData.weatherMorning} 
                onChange={e => handleChange('weatherMorning', e.target.value)}
                className={inputClass.replace("px-4", "pl-11")}
              />
            </div>
          </div>
          <div>
            <label className={labelClass}>Clima Tarde</label>
            <div className="relative">
              <Cloud className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input 
                type="text" 
                value={formData.weatherAfternoon} 
                onChange={e => handleChange('weatherAfternoon', e.target.value)}
                className={inputClass.replace("px-4", "pl-11")}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Workforce Editor */}
        <div className="glass-panel rounded-[32px] border border-white/5 overflow-hidden flex flex-col shadow-2xl">
          <div className="px-8 py-6 border-b border-white/5 bg-white/[0.02] flex justify-between items-center">
            <h3 className="font-bold text-white flex items-center gap-3">
              <div className="bg-blue-500/10 p-2 rounded-xl">
                <HardHat className="w-4 h-4 text-blue-400" />
              </div>
              Mão de Obra
            </h3>
            <button 
              onClick={addWorkforce}
              className="text-[10px] font-black uppercase tracking-widest bg-blue-600 text-white px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-blue-500 transition-all shadow-lg shadow-blue-900/20"
            >
              <Plus className="w-3.5 h-3.5" /> Adicionar
            </button>
          </div>
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-sm text-left">
              <thead className="text-[10px] font-black text-slate-500 uppercase tracking-widest bg-white/[0.01]">
                <tr>
                  <th className="px-8 py-4">Função</th>
                  <th className="px-4 py-4 w-20 text-center">Qtd</th>
                  <th className="px-4 py-4 w-24 text-right">Horas</th>
                  <th className="px-8 py-4 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {formData.workforce.map((w, idx) => (
                  <tr key={idx} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="px-8 py-3">
                      <input 
                        type="text" 
                        value={w.role} 
                        onChange={e => updateWorkforce(idx, 'role', e.target.value)}
                        className="w-full bg-transparent border-none text-white focus:ring-0 outline-none p-0 placeholder:text-slate-700 font-medium"
                        placeholder="Ex: Pedreiro"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input 
                        type="number" 
                        value={w.count} 
                        onChange={e => updateWorkforce(idx, 'count', parseInt(e.target.value) || 0)}
                        className="w-full bg-transparent border-none text-white focus:ring-0 outline-none p-0 text-center font-mono"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input 
                        type="number" 
                        value={w.totalHours} 
                        onChange={e => updateWorkforce(idx, 'totalHours', parseFloat(e.target.value) || 0)}
                        className="w-full bg-transparent border-none text-white focus:ring-0 outline-none p-0 text-right font-mono"
                      />
                    </td>
                    <td className="px-8 py-3 text-right">
                      <button 
                        onClick={() => removeWorkforce(idx)}
                        className="text-slate-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="w-4.5 h-4.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Equipment Editor */}
        <div className="glass-panel rounded-[32px] border border-white/5 overflow-hidden flex flex-col shadow-2xl">
          <div className="px-8 py-6 border-b border-white/5 bg-white/[0.02] flex justify-between items-center">
            <h3 className="font-bold text-white flex items-center gap-3">
              <div className="bg-orange-500/10 p-2 rounded-xl">
                <Truck className="w-4 h-4 text-orange-400" />
              </div>
              Equipamentos
            </h3>
            <button 
              onClick={addEquipment}
              className="text-[10px] font-black uppercase tracking-widest bg-orange-600 text-white px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-orange-500 transition-all shadow-lg shadow-orange-900/20"
            >
              <Plus className="w-3.5 h-3.5" /> Adicionar
            </button>
          </div>
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-sm text-left">
              <thead className="text-[10px] font-black text-slate-500 uppercase tracking-widest bg-white/[0.01]">
                <tr>
                  <th className="px-8 py-4">Equipamento</th>
                  <th className="px-4 py-4 w-20 text-center">Qtd</th>
                  <th className="px-4 py-4 w-24 text-right">Horas</th>
                  <th className="px-8 py-4 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {formData.equipment.map((e, idx) => (
                  <tr key={idx} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="px-8 py-3">
                      <input 
                        type="text" 
                        value={e.name} 
                        onChange={val => updateEquipment(idx, 'name', val.target.value)}
                        className="w-full bg-transparent border-none text-white focus:ring-0 outline-none p-0 placeholder:text-slate-700 font-medium"
                        placeholder="Ex: Escavadeira"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input 
                        type="number" 
                        value={e.count} 
                        onChange={val => updateEquipment(idx, 'count', parseInt(val.target.value) || 0)}
                        className="w-full bg-transparent border-none text-white focus:ring-0 outline-none p-0 text-center font-mono"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input 
                        type="number" 
                        value={e.hoursOperated} 
                        onChange={val => updateEquipment(idx, 'hoursOperated', parseFloat(val.target.value) || 0)}
                        className="w-full bg-transparent border-none text-white focus:ring-0 outline-none p-0 text-right font-mono"
                      />
                    </td>
                    <td className="px-8 py-3 text-right">
                      <button 
                        onClick={() => removeEquipment(idx)}
                        className="text-slate-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="w-4.5 h-4.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Activities Editor */}
        <div className="glass-panel rounded-[32px] border border-white/5 overflow-hidden lg:col-span-2 shadow-2xl">
          <div className="px-8 py-6 border-b border-white/5 bg-white/[0.02] flex justify-between items-center">
            <h3 className="font-bold text-white flex items-center gap-3">
              <div className="bg-emerald-500/10 p-2 rounded-xl">
                <ClipboardList className="w-4 h-4 text-emerald-400" />
              </div>
              Atividades e Serviços
            </h3>
            <button 
              onClick={addActivity}
              className="text-[10px] font-black uppercase tracking-widest bg-emerald-600 text-white px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-900/20"
            >
              <Plus className="w-3.5 h-3.5" /> Adicionar
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-[10px] font-black text-slate-500 uppercase tracking-widest bg-white/[0.01]">
                <tr>
                  <th className="px-8 py-4 w-40">Código</th>
                  <th className="px-4 py-4">Descrição da Atividade</th>
                  <th className="px-4 py-4 w-24 text-center">Qtd</th>
                  <th className="px-4 py-4 w-32 text-right">Total R$</th>
                  <th className="px-4 py-4 w-36 text-center">Status</th>
                  <th className="px-8 py-4 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {formData.activities.map((act, idx) => {
                  const serviceItem = act.code ? getServiceByCode(project, act.code) : undefined;
                  const itemTotal = serviceItem && act.quantity ? serviceItem.value * act.quantity : 0;
                  return (
                    <tr key={idx} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="px-8 py-3">
                        <input 
                          type="text" 
                          value={act.code || ''} 
                          onChange={e => updateActivity(idx, 'code', e.target.value)}
                          className="w-full bg-transparent border-none text-blue-400 focus:ring-0 outline-none p-0 font-mono text-xs placeholder:text-slate-700"
                          placeholder="Código"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input 
                          type="text" 
                          value={act.description} 
                          onChange={e => updateActivity(idx, 'description', e.target.value)}
                          className="w-full bg-transparent border-none text-white focus:ring-0 outline-none p-0 font-medium placeholder:text-slate-700"
                          placeholder="Descrição"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input 
                          type="number" 
                          value={act.quantity || 0} 
                          onChange={e => updateActivity(idx, 'quantity', parseFloat(e.target.value) || 0)}
                          className="w-full bg-transparent border-none text-white focus:ring-0 outline-none p-0 text-center font-mono"
                        />
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-emerald-400 font-bold">
                        {formatMoney(itemTotal)}
                      </td>
                      <td className="px-4 py-3">
                        <select 
                          value={act.status} 
                          onChange={e => updateActivity(idx, 'status', e.target.value)}
                          className="w-full bg-transparent border-none text-slate-400 focus:ring-0 outline-none p-0 text-[10px] font-black uppercase tracking-widest cursor-pointer"
                        >
                          <option value="Concluído" className="bg-slate-900">Concluído</option>
                          <option value="Em andamento" className="bg-slate-900">Em andamento</option>
                          <option value="Paralisado" className="bg-slate-900">Paralisado</option>
                        </select>
                      </td>
                      <td className="px-8 py-3 text-right">
                        <button 
                          onClick={() => removeActivity(idx)}
                          className="text-slate-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 className="w-4.5 h-4.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-emerald-500/5 border-t border-emerald-500/10">
                <tr>
                  <td colSpan={3} className="px-8 py-6 text-right font-black text-slate-500 uppercase text-[10px] tracking-[0.2em]">Total Financeiro Estimado</td>
                  <td className="px-4 py-6 text-right font-black text-emerald-400 font-mono text-xl tracking-tighter">{formatMoney(totalFinancial)}</td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Occurrences Editor */}
        <div className="glass-panel rounded-[32px] border border-white/5 overflow-hidden lg:col-span-2 shadow-2xl">
          <div className="px-8 py-6 border-b border-white/5 bg-white/[0.02] flex justify-between items-center">
            <h3 className="font-bold text-white flex items-center gap-3">
              <div className="bg-amber-500/10 p-2 rounded-xl">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
              </div>
              Ocorrências
            </h3>
            <button 
              onClick={addOccurrence}
              className="text-[10px] font-black uppercase tracking-widest bg-amber-600 text-white px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-amber-500 transition-all shadow-lg shadow-amber-900/20"
            >
              <Plus className="w-3.5 h-3.5" /> Adicionar
            </button>
          </div>
          <div className="p-8">
            <div className="space-y-4">
              {(formData.occurrences || []).map((occ, idx) => (
                <div key={idx} className="flex gap-6 items-start p-6 bg-white/[0.02] rounded-3xl border border-white/5 group transition-all hover:bg-white/[0.04]">
                  <div className="bg-amber-500/10 p-3 rounded-2xl text-amber-500 border border-amber-500/10">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="md:col-span-2">
                      <label className={labelClass}>Descrição</label>
                      <textarea 
                        rows={2}
                        value={occ.description} 
                        onChange={e => updateOccurrence(idx, 'description', e.target.value)}
                        className={inputClass}
                        placeholder="Descreva o ocorrido..."
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Categoria</label>
                      <input 
                        type="text" 
                        value={occ.category || ''} 
                        onChange={e => updateOccurrence(idx, 'category', e.target.value)}
                        className={inputClass}
                        placeholder="Ex: Falta de Material"
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Impacto (min)</label>
                      <input 
                        type="number" 
                        value={occ.impactTimeMinutes} 
                        onChange={e => updateOccurrence(idx, 'impactTimeMinutes', parseInt(e.target.value) || 0)}
                        className={inputClass}
                      />
                    </div>
                  </div>
                  <button 
                    onClick={() => removeOccurrence(idx)}
                    className="p-2 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              ))}
              {(!formData.occurrences || formData.occurrences.length === 0) && (
                <div className="text-center py-12 border-2 border-dashed border-white/5 rounded-[32px] bg-white/[0.01]">
                   <p className="text-slate-500 font-medium italic">Nenhuma ocorrência registrada no momento.</p>
                </div>
              )}
            </div>

            <div className="mt-10">
              <h4 className="text-sm font-bold text-white mb-4 flex items-center gap-3">
                <div className="bg-blue-500/10 p-2 rounded-xl">
                  <MessageSquare className="w-4 h-4 text-blue-400" />
                </div>
                Comentários Adicionais
              </h4>
              <textarea 
                rows={4}
                value={formData.comments} 
                onChange={e => handleChange('comments', e.target.value)}
                className={inputClass + " rounded-3xl"}
                placeholder="Observações gerais do dia..."
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
