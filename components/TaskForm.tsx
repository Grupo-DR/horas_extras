import React, { useState, useEffect } from 'react';
import { Task, TaskStatus, User, TaskOutcome } from '../types';
import { X, User as UserIcon, Building, FileText, Phone, Mail, DollarSign, Target, Award, CheckCircle } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (task: Partial<Task>) => void;
  users: User[];
  availableParents: Task[];
  initialData?: Partial<Task>;
  mode?: 'FULL' | 'QUICK_EDIT';
}

export const TaskForm: React.FC<Props> = ({
  isOpen,
  onClose,
  onSave,
  users,
  availableParents,
  initialData,
  mode = 'FULL'
}) => {
  const [isChild, setIsChild] = useState(!!initialData?.parentId || !!initialData?.opportunityId);

  const [formData, setFormData] = useState<Partial<Task>>({
    title: '',
    description: '',
    assigneeId: users[0]?.id || '',
    status: TaskStatus.PENDING,
    priority: 'MEDIO',
    category: '',
    observations: '',
    progress: 0,
    startDate: new Date(),
    endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    value: 0,
    interestScore: 0,
    proposalName: '',
    clientName: '',
    responsibleName: '',
    contactEmail: '',
    contactPhone: '',
    outcome: undefined,
    ...initialData // Merge passed data (edit or template)
  });

  useEffect(() => {
    if (initialData) {
      // SANITIZATION: Ensure we don't pass objects where strings are expected (Fix React Error #31)
      const safeData = {
        ...initialData,
        title: typeof initialData.title === 'object' ? JSON.stringify(initialData.title) : initialData.title || '',
        description: typeof initialData.description === 'object' ? JSON.stringify(initialData.description) : initialData.description || '',
        // Ensure category is string or removed
        category: typeof initialData.category === 'object' ? '' : initialData.category,
      };
      setFormData(safeData);
      setIsChild(!!safeData.parentId || !!safeData.opportunityId);
    } else {
      setFormData({
        title: '',
        description: '',
        assigneeId: users[0]?.id || '',
        status: TaskStatus.PENDING,
        priority: 'MEDIO',
        category: '',
        observations: '',
        progress: 0,
        startDate: new Date(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        parentId: undefined,
        outcome: undefined
      });
      setIsChild(true); // Default to Child as requested
    }
  }, [initialData, users]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (mode === 'FULL' && !isChild && formData.status === TaskStatus.COMPLETED && !formData.outcome) {
      alert("Para concluir uma Ação Mãe, é obrigatório selecionar o Resultado da Concorrência!");
      return;
    }

    const cleanedData = { ...formData };

    if (mode === 'QUICK_EDIT') {
      cleanedData.needsDetails = false;
    }

    // Optional Link Logic: Clean up empty links
    if (!cleanedData.parentId) delete cleanedData.parentId;
    if (!cleanedData.opportunityId) delete cleanedData.opportunityId;

    if (cleanedData.startDate) cleanedData.startDate = new Date(cleanedData.startDate);
    if (cleanedData.endDate) cleanedData.endDate = new Date(cleanedData.endDate);

    if (isChild) {
      delete cleanedData.proposalName;
      delete cleanedData.clientName;
      delete cleanedData.responsibleName;
      delete cleanedData.contactEmail;
      delete cleanedData.contactPhone;
      delete cleanedData.outcome;
    } else {
      delete cleanedData.parentId;
      delete cleanedData.value;
      delete cleanedData.interestScore;
      cleanedData.category = 'Ação Mãe';
    }

    onSave(cleanedData);
    onClose();
  };

  const formatDateForInput = (date: Date | undefined) => {
    if (!date) return '';
    try {
      return new Date(date).toISOString().split('T')[0];
    } catch (e) {
      return '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className={`bg-white rounded-xl shadow-2xl w-full ${mode === 'QUICK_EDIT' ? 'max-w-lg' : 'max-w-4xl'} max-h-[90vh] overflow-y-auto`}>
        <div className="flex justify-between items-center p-6 border-b sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-xl font-bold text-slate-800">
              {mode === 'QUICK_EDIT' ? 'Completar Detalhes da Ação' : (initialData ? 'Editar Ação' : 'Nova Ação')}
            </h2>
            <p className="text-sm text-slate-500">
              {mode === 'QUICK_EDIT' ? 'Preencha as informações necessárias para continuar.' : 'Preencha os detalhes da atividade comercial'}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-8">

          {mode === 'QUICK_EDIT' ? (
            <div className="space-y-4">
              <div className="bg-blue-50 p-3 rounded text-blue-800 text-sm font-medium">
                <strong>Ação Gerada:</strong> {formData.title}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Data Início</label>
                  <input
                    type="date"
                    required
                    className="w-full p-2 border border-slate-300 rounded-lg"
                    value={formatDateForInput(formData.startDate)}
                    onChange={(e) => {
                      if (e.target.value) setFormData({ ...formData, startDate: new Date(e.target.value) })
                    }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Data Entrega</label>
                  <input
                    type="date"
                    required
                    className="w-full p-2 border border-slate-300 rounded-lg"
                    value={formatDateForInput(formData.endDate)}
                    onChange={(e) => {
                      if (e.target.value) setFormData({ ...formData, endDate: new Date(e.target.value) })
                    }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Responsável</label>
                <select
                  className="w-full p-2 border border-slate-300 rounded-lg"
                  value={formData.assigneeId}
                  onChange={(e) => setFormData({ ...formData, assigneeId: e.target.value })}
                >
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Prioridade</label>
                <select
                  className="w-full p-2 border border-slate-300 rounded-lg font-medium"
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                >
                  <option value="BAIXO">Baixa</option>
                  <option value="MEDIO">Média</option>
                  <option value="ALTO">Alta 🚨</option>
                </select>
              </div>
            </div>
          ) : (
            <>
              {/* TOGGLE MOTHERS/DAUGHTERS REMOVED/HIDDEN AS PER REQUEST - ALWAYS CHILD OR CONTEXT AWARE */}
              {/* If we want to allow creating "Legacy Mothers" still, we might keep it but hidden? 
                  The user said: "Ao clicar em inserir nova ação, na aba tarefas só se abre ação filha"
                  So we enforce isChild = true on mount if no data?
                  Let's just hide the toggle for now and rely on isChild state.
              */}
              <div className="hidden">
                {/* Hidden Toggle Code */}
              </div>

              {isChild && (
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                  <label className="block text-sm font-bold text-blue-800 mb-2">Vínculo</label>
                  {formData.opportunityId ? (
                    <div className="flex items-center gap-2 text-blue-700 bg-white p-2 rounded border border-blue-200">
                      <Target size={18} />
                      <span className="font-medium">Vinculado à Oportunidade (Automático)</span>
                    </div>
                  ) : (
                    <>
                      <label className="block text-xs font-medium text-blue-600 mb-1">Vincular a Ação Mãe</label>
                      <select
                        className="w-full p-2.5 border border-blue-200 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                        value={formData.parentId || ''}
                        onChange={(e) => setFormData({ ...formData, parentId: e.target.value })}
                      >
                        <option value="">Sem Vínculo (Ação Avulsa)</option>
                        {availableParents.map(parent => {
                          // BLINDAGEM DE RENDERIZAÇÃO
                          const parentTitle = String(parent.title || 'Ação Sem Título');
                          const clientInfo = String(parent.clientName || 'Sem Cliente');
                          return (
                            <option key={parent.id} value={parent.id}>{parentTitle} - {clientInfo}</option>
                          );
                        })}
                      </select>
                    </>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Título da Ação</label>
                  <input
                    required
                    type="text"
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder={isChild ? "Ex: Visita Técnica - Obra X" : "Ex: Concorrência Complexo Residencial Y"}
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  />
                </div>

                {isChild ? (
                  null // REMOVED CATEGORY FIELD
                ) : (
                  <div className="hidden">
                    <input type="hidden" value="Ação Mãe" />
                  </div>
                )}


                {!isChild && (
                  <>
                    <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-slate-50 border border-slate-200 rounded-lg">
                      <h3 className="md:col-span-2 text-sm font-bold text-slate-700 flex items-center gap-2">
                        <Building size={16} /> Dados do Cliente e Proposta
                      </h3>

                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Nome da Proposta</label>
                        <input
                          type="text"
                          className="w-full p-2 border border-slate-300 rounded text-sm"
                          value={formData.proposalName || ''}
                          onChange={(e) => setFormData({ ...formData, proposalName: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Nome do Cliente</label>
                        <input
                          type="text"
                          className="w-full p-2 border border-slate-300 rounded text-sm"
                          value={formData.clientName || ''}
                          onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Responsável (Contato)</label>
                        <div className="relative">
                          <UserIcon size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
                          <input
                            type="text"
                            className="w-full pl-8 p-2 border border-slate-300 rounded text-sm"
                            value={formData.responsibleName || ''}
                            onChange={(e) => setFormData({ ...formData, responsibleName: e.target.value })}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Email</label>
                        <div className="relative">
                          <Mail size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
                          <input
                            type="email"
                            className="w-full pl-8 p-2 border border-slate-300 rounded text-sm"
                            value={formData.contactEmail || ''}
                            onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Telefone</label>
                        <div className="relative">
                          <Phone size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
                          <input
                            type="tel"
                            className="w-full pl-8 p-2 border border-slate-300 rounded text-sm"
                            value={formData.contactPhone || ''}
                            onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                          />
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {isChild && (formData.category === 'Prévia' || formData.category === 'Proposta Comercial') && (
                  <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                    <h3 className="md:col-span-2 text-sm font-bold text-green-800 flex items-center gap-2">
                      <DollarSign size={16} /> Valores e Métricas
                    </h3>

                    <div>
                      <label className="block text-xs font-medium text-green-700 mb-1">Valor Global (R$)</label>
                      <input
                        type="number"
                        className="w-full p-2 border border-green-200 rounded text-sm"
                        placeholder="0.00"
                        value={formData.value || ''}
                        onChange={(e) => setFormData({ ...formData, value: parseFloat(e.target.value) })}
                      />
                    </div>

                    {formData.category === 'Prévia' && (
                      <div>
                        <label className="block text-xs font-medium text-green-700 mb-1">Nota Matriz de Interesse</label>
                        <div className="relative">
                          <Target size={14} className="absolute left-2.5 top-2.5 text-green-600" />
                          <input
                            type="number"
                            className="w-full pl-8 p-2 border border-green-200 rounded text-sm"
                            placeholder="0 - 10"
                            value={formData.interestScore || ''}
                            onChange={(e) => setFormData({ ...formData, interestScore: parseFloat(e.target.value) })}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                    <select
                      className="w-full p-2 border border-slate-300 rounded-lg font-medium"
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as TaskStatus })}
                    >
                      <option value={TaskStatus.PENDING}>Pendente</option>
                      <option value={TaskStatus.IN_PROGRESS}>Em Andamento</option>
                      <option value={TaskStatus.COMPLETED}>Concluído</option>
                      <option value={TaskStatus.LATE}>Atrasado</option>
                    </select>
                  </div>

                  {!isChild && formData.status === TaskStatus.COMPLETED && (
                    <div className="bg-orange-50 p-2 rounded border border-orange-200 animate-in fade-in slide-in-from-top-2">
                      <label className="block text-sm font-bold text-orange-800 mb-1 flex items-center gap-1">
                        <Award size={14} /> Resultado (Obrigatório)
                      </label>
                      <select
                        required
                        className="w-full p-2 border border-orange-300 rounded-lg text-orange-900 font-bold"
                        value={formData.outcome || ''}
                        onChange={(e) => setFormData({ ...formData, outcome: e.target.value as TaskOutcome })}
                      >
                        <option value="">Selecione o resultado...</option>
                        <option value={TaskOutcome.SUCCESS}>Sucesso (Vencemos) 🏆</option>
                        <option value={TaskOutcome.FAILURE}>Insucesso (Perdemos) ❌</option>
                        <option value={TaskOutcome.STUDY}>Estudo (Apenas Análise) 📚</option>
                        <option value={TaskOutcome.WITHDRAWAL}>Desistência 🚫</option>
                      </select>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Responsável Interno</label>
                  <select
                    className="w-full p-2 border border-slate-300 rounded-lg"
                    value={formData.assigneeId}
                    onChange={(e) => setFormData({ ...formData, assigneeId: e.target.value })}
                  >
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Prioridade</label>
                  <select
                    className="w-full p-2 border border-slate-300 rounded-lg font-medium"
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                  >
                    <option value="BAIXO">Baixa</option>
                    <option value="MEDIO">Média</option>
                    <option value="ALTO">Alta 🚨</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Data Início</label>
                  <input
                    type="date"
                    required
                    className="w-full p-2 border border-slate-300 rounded-lg"
                    value={formatDateForInput(formData.startDate)}
                    onChange={(e) => {
                      if (e.target.value) setFormData({ ...formData, startDate: new Date(e.target.value) })
                    }}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Data Entrega (Deadline)</label>
                  <input
                    type="date"
                    required
                    className="w-full p-2 border border-slate-300 rounded-lg"
                    value={formatDateForInput(formData.endDate)}
                    onChange={(e) => {
                      if (e.target.value) setFormData({ ...formData, endDate: new Date(e.target.value) })
                    }}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Descrição Detalhada</label>
                  <textarea
                    className="w-full p-2 border border-slate-300 rounded-lg h-24"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  ></textarea>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Observações</label>
                  <textarea
                    className="w-full p-2 border border-slate-300 rounded-lg h-24"
                    placeholder="Anotações importantes..."
                    value={formData.observations}
                    onChange={(e) => setFormData({ ...formData, observations: e.target.value })}
                  ></textarea>
                </div>
              </div>
            </>
          )}

          <div className="flex justify-between pt-4 gap-3 bg-white sticky bottom-0 border-t mt-4 py-4">

            {/* DELETE BUTTON (Only if editing) */}
            {initialData && (
              <button
                type="button"
                onClick={() => {
                  if (confirm('Tem certeza que deseja excluir esta ação?')) {
                    // Handler passed from parent? Or simple field update? 
                    // Ideally should be a prop onDelete. For now, assuming standard save/update flow doesn't cover delete.
                    // We need to add onDelete prop to TaskForm.
                    // For this pass, I will just add the button UI.
                    alert('Funcionalidade de Excluir será implementada na próxima etapa de integração.');
                  }
                }}
                className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg font-medium border border-transparent hover:border-red-200 transition-colors"
              >
                Excluir
              </button>
            )}

            <div className="flex gap-2 ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancelar
              </button>

              {/* DYNAMIC ACTION BUTTONS */}
              {initialData && formData.status === TaskStatus.COMPLETED ? (
                <button
                  type="button"
                  onClick={() => {
                    setFormData({ ...formData, status: TaskStatus.IN_PROGRESS });
                    // Auto-submit? Or just change state? Let's just change state for user to Review.
                  }}
                  className="px-6 py-2 bg-yellow-100 text-yellow-800 rounded-lg hover:bg-yellow-200 font-bold border border-yellow-300"
                >
                  Reabrir Ação
                </button>
              ) : (
                <>
                  {initialData && (
                    <button
                      type="button"
                      onClick={() => {
                        setFormData({ ...formData, status: TaskStatus.COMPLETED });
                        // Let user fill outcome if needed, then save.
                      }}
                      className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-bold flex items-center gap-2"
                    >
                      <CheckCircle size={18} />
                      Finalizar Agora
                    </button>
                  )}
                  <button
                    type="submit"
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                  >
                    Salvar
                  </button>
                </>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};