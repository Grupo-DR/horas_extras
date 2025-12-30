import React, { useState } from 'react';
import { HelpChainLevel } from '../types';
import { ShieldAlert, Plus, Trash2, Save } from 'lucide-react';

interface Props {
  chain: HelpChainLevel[];
  onSave: (chain: HelpChainLevel[]) => void;
}

export const EscalationSettings: React.FC<Props> = ({ chain, onSave }) => {
  const [levels, setLevels] = useState<HelpChainLevel[]>(chain);

  const addLevel = () => {
    setLevels([
      ...levels,
      {
        level: levels.length + 1,
        roleName: '',
        contactEmail: '',
        triggerDaysBefore: 1,
        triggerWhenLate: true,
      },
    ]);
  };

  const updateLevel = (index: number, field: keyof HelpChainLevel, value: any) => {
    const newLevels = [...levels];
    newLevels[index] = { ...newLevels[index], [field]: value };
    setLevels(newLevels);
  };

  const removeLevel = (index: number) => {
    const newLevels = levels.filter((_, i) => i !== index);
    setLevels(newLevels.map((l, i) => ({ ...l, level: i + 1 }))); // Re-index
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <ShieldAlert className="w-6 h-6 text-orange-600" />
          Configuração da Cadeia de Ajuda
        </h2>
        <button
          onClick={() => onSave(levels)}
          className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
        >
          <Save size={18} /> Salvar Configuração
        </button>
      </div>

      <p className="text-slate-500 mb-6 text-sm">
        Defina quem deve ser acionado automaticamente quando uma concorrência estiver atrasada ou próxima do prazo.
      </p>

      <div className="space-y-4">
        {levels.map((lvl, idx) => (
          <div key={idx} className="flex flex-col md:flex-row gap-4 p-4 bg-slate-50 border border-slate-200 rounded-lg items-start md:items-end">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-slate-500 mb-1">Nível {lvl.level} - Cargo</label>
              <input
                type="text"
                placeholder="Ex: Gerente Comercial"
                className="w-full p-2 border rounded text-sm"
                value={lvl.roleName}
                onChange={(e) => updateLevel(idx, 'roleName', e.target.value)}
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-semibold text-slate-500 mb-1">Email de Contato</label>
              <input
                type="email"
                placeholder="email@construtora.com"
                className="w-full p-2 border rounded text-sm"
                value={lvl.contactEmail}
                onChange={(e) => updateLevel(idx, 'contactEmail', e.target.value)}
              />
            </div>
            <div className="w-32">
              <label className="block text-xs font-semibold text-slate-500 mb-1">Avisar (dias antes)</label>
              <input
                type="number"
                className="w-full p-2 border rounded text-sm"
                value={lvl.triggerDaysBefore}
                onChange={(e) => updateLevel(idx, 'triggerDaysBefore', Number(e.target.value))}
              />
            </div>
             <div className="flex items-center h-10 pb-1">
               <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                 <input 
                   type="checkbox"
                   checked={lvl.triggerWhenLate}
                   onChange={(e) => updateLevel(idx, 'triggerWhenLate', e.target.checked)}
                 />
                 Acionar se Atrasado
               </label>
             </div>
            <button
              onClick={() => removeLevel(idx)}
              className="p-2 text-red-500 hover:bg-red-50 rounded"
              title="Remover nível"
            >
              <Trash2 size={18} />
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={addLevel}
        className="mt-4 flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium text-sm"
      >
        <Plus size={16} /> Adicionar Nível Hierárquico
      </button>
    </div>
  );
};
