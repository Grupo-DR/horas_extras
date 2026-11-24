import React from 'react';
import { useUiState, useUiActions } from '../../../stores/uiStore';
import { useProjectActions, useSelectedProject } from '../../../stores/projectStore';
import { useTeamActions } from '../../../stores/teamStore';
import { RdoModelId } from '../../../../types';
import { RDO_MODEL_OPTIONS } from '../../../../services/rdoModels';
import { KNOWN_CLIENTS } from '../../../../utils/projectSummary';

export const ProjectModal: React.FC = () => {
  const {
    isModalOpen,
    isEditMode,
    currentView,
    newItemName,
    newItemRegional,
    newItemRdoModel,
    newItemClient,
    editingItemId
  } = useUiState();

  const {
    setNewItemName,
    setNewItemRegional,
    setNewItemRdoModel,
    setNewItemClient,
    setIsModalOpen
  } = useUiActions();

  const selectedProject = useSelectedProject();
  const { saveProject } = useProjectActions();
  const { saveTeam } = useTeamActions();

  if (!isModalOpen) return null;

  const handleSave = async () => {
    try {
      if (currentView === 'PROJECT_LIST') {
        await saveProject(
          { name: newItemName, regional: newItemRegional, client: newItemClient, rdoModel: newItemRdoModel },
          isEditMode,
          editingItemId
        );
      } else {
        await saveTeam(newItemName, selectedProject?.id, isEditMode, editingItemId);
      }
      setIsModalOpen(false);
    } catch (e) {
      alert("Erro ao salvar dados.");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6">
        <h3 className="text-lg font-bold text-slate-900 mb-6">
          {isEditMode ? 'Editar' : 'Criar'} {currentView === 'PROJECT_LIST' ? 'Obra' : 'Equipe'}
        </h3>
        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nome</label>
            <input 
              autoFocus 
              type="text" 
              value={newItemName} 
              onChange={(e) => setNewItemName(e.target.value)} 
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-900" 
            />
          </div>
          {currentView === 'PROJECT_LIST' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Regional</label>
              <input 
                type="text" 
                value={newItemRegional} 
                onChange={(e) => setNewItemRegional(e.target.value)} 
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-800" 
              />
            </div>
          )}
          {currentView === 'PROJECT_LIST' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Cliente</label>
              <input
                type="text"
                list="rdo-clientes"
                value={newItemClient}
                onChange={(e) => setNewItemClient(e.target.value)}
                placeholder="Ex.: Vale, VLI, Rumo"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-800"
              />
              <datalist id="rdo-clientes">
                {KNOWN_CLIENTS.map(c => <option key={c} value={c} />)}
              </datalist>
            </div>
          )}
          {currentView === 'PROJECT_LIST' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Modelo de RDO</label>
              <select
                value={newItemRdoModel}
                onChange={(e) => setNewItemRdoModel(e.target.value as RdoModelId)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-800 bg-white"
              >
                {RDO_MODEL_OPTIONS.map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
              <p className="text-xs text-slate-500 mt-1">
                {RDO_MODEL_OPTIONS.find((m) => m.id === newItemRdoModel)?.hint}
              </p>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-3">
          <button 
            onClick={() => setIsModalOpen(false)} 
            className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded-lg"
          >
            Cancelar
          </button>
          <button 
            onClick={handleSave} 
            className="px-4 py-2 bg-blue-600 text-white rounded-lg flex items-center gap-2"
          >
            {isEditMode ? 'Salvar' : 'Criar'}
          </button>
        </div>
      </div>
    </div>
  );
};
