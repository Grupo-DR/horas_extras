
import React, { useState, useEffect } from 'react';
import { User, Opportunity, PipelineStage, Task, TaskStatus, TaskOutcome } from '../../types';
import { OpportunityService } from '../../services/opportunityService';
import { UserService } from '../../services/userService';
import { toast } from 'sonner';
import { X, Save } from 'lucide-react';

interface OpportunityFormProps {
    initialData?: Opportunity;
    linkedTasks?: Task[];
    onClose: () => void;
    onSave: () => void; // Trigger reload
    onDelete?: (id: string) => void;
}

export const OpportunityForm: React.FC<OpportunityFormProps> = ({ initialData, linkedTasks = [], onClose, onSave, onDelete }) => {
    const [formData, setFormData] = useState<Partial<Opportunity>>({
        clientName: '',
        title: '',
        estimatedValue: 0,
        deadline: undefined,
        responsibleId: '', // Default empty
        priority: 'MÉDIA', // Default value
        ...initialData // Override with initial if present
    });

    const [loading, setLoading] = useState(false);
    const [users, setUsers] = useState<User[]>([]);

    useEffect(() => {
        const loadUsers = async () => {
            try {
                const data = await UserService.getAll();
                setUsers(data);
                // Set default responsible if not set and users exist
                if (!formData.responsibleId && data.length > 0) {
                    // Optionally set a default, but better to force selection or leave empty
                }
            } catch (e) {
                console.error("Error loading users", e);
            }
        }
        loadUsers();
    }, []);


    // Convert Date object to YYYY-MM-DD for input
    const formatDateForInput = (date?: Date) => {
        if (!date) return '';
        try {
            return new Date(date).toISOString().split('T')[0];
        } catch (e) {
            return '';
        }
    };

    // Calculate Task Stats
    const taskStats = {
        pending: linkedTasks.filter(t => t.status === TaskStatus.PENDING).length,
        inProgress: linkedTasks.filter(t => t.status === TaskStatus.IN_PROGRESS).length,
        late: linkedTasks.filter(t => t.status === TaskStatus.LATE).length,
        completed: linkedTasks.filter(t => t.status === TaskStatus.COMPLETED).length,
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        const dataToSave = { ...formData };
        // AUTO-MOVE: If result is set, move to RESULTADO stage
        if (dataToSave.result && dataToSave.result !== '' as any) {
            dataToSave.pipelineStage = PipelineStage.RESULTADO;
        }

        try {
            if (initialData?.id) {
                // Update
                await OpportunityService.update(initialData.id, dataToSave);
                toast.success("Oportunidade atualizada!");
            } else {
                // Create (Validation happens in Service)
                await OpportunityService.create({
                    title: dataToSave.title || 'Nova Oportunidade',
                    clientName: dataToSave.clientName!,
                    estimatedValue: Number(dataToSave.estimatedValue) || 0,
                    responsibleId: dataToSave.responsibleId!,
                    deadline: new Date(dataToSave.deadline!),
                    priority: dataToSave.priority
                });
                toast.success("Oportunidade criada com sucesso!");
            }
            onSave(); // Reload parent
            onClose();
        } catch (error: any) {
            toast.error(error.message || "Erro ao salvar.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <h2 className="text-lg font-bold text-slate-800">
                        {initialData ? 'Editar Oportunidade' : 'Nova Oportunidade'}
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500">
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto flex-1">
                    <form id="opportunity-form" onSubmit={handleSubmit} className="space-y-4">

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Title */}
                            <div className="col-span-2">
                                <label className="block text-sm font-medium text-slate-600 mb-1">Título / Obra</label>
                                <input
                                    required
                                    type="text"
                                    value={formData.title}
                                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder="Ex: Reforma Galpão Logístico"
                                />
                            </div>

                            {/* Client */}
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1">Cliente</label>
                                <input
                                    required
                                    type="text"
                                    value={formData.clientName}
                                    onChange={e => setFormData({ ...formData, clientName: e.target.value })}
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder="Nome do Cliente"
                                />
                            </div>

                            {/* Responsible */}
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1">Responsável</label>
                                <select
                                    required
                                    value={formData.responsibleId}
                                    onChange={e => setFormData({ ...formData, responsibleId: e.target.value })}
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                >
                                    <option value="">Selecione o responsável</option>
                                    {users.map(u => (
                                        <option key={u.id} value={u.id}>{u.name}</option>
                                    ))}
                                </select>
                            </div>


                            {/* Value (BRL Mask) */}
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1">Valor da Proposta (R$)</label>
                                <input
                                    type="text"
                                    value={formData.estimatedValue
                                        ? (formData.estimatedValue).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                                        : ''}
                                    onChange={e => {
                                        // Remove everything that is not a digit
                                        const rawValue = e.target.value.replace(/\D/g, '');

                                        // Convert to number (cents -> float)
                                        const numericValue = rawValue ? parseInt(rawValue, 10) / 100 : 0;

                                        setFormData({ ...formData, estimatedValue: numericValue });
                                    }}
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder="0,00"
                                />
                            </div>

                            {/* Deadline */}
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1">Prazo Limite</label>
                                <input
                                    required
                                    type="date"
                                    value={formatDateForInput(formData.deadline)}
                                    onChange={e => setFormData({ ...formData, deadline: e.target.valueAsDate || undefined })}
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                        </div>

                        {/* Stage Info & Task Stats */}
                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 mt-4 flex justify-between items-center">
                            <div>
                                <p className="text-xs text-blue-600 font-bold uppercase tracking-wide">Etapa Atual</p>
                                <p className="text-sm font-medium text-blue-900 mt-1">
                                    {initialData ? initialData.pipelineStage : 'LEAD RECEBIDO (Inicial)'}
                                </p>
                            </div>

                            {/* Task Stats Display */}
                            {initialData && (
                                <div className="text-right text-xs">
                                    <p className="font-bold text-slate-700 mb-1">Ações Vinculadas</p>
                                    <div className="flex gap-2 justify-end">
                                        <span className="bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full" title="Pendentes">{taskStats.pending}</span>
                                        <span className="bg-blue-200 text-blue-700 px-2 py-0.5 rounded-full" title="Em Andamento">{taskStats.inProgress}</span>
                                        <span className="bg-red-200 text-red-700 px-2 py-0.5 rounded-full" title="Atrasadas">{taskStats.late}</span>
                                        <span className="bg-green-200 text-green-700 px-2 py-0.5 rounded-full" title="Concluídas">{taskStats.completed}</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* RESULTADO (Replaces Decision) */}
                        <div className="border-t border-slate-100 pt-4 mt-4">
                            <h3 className="text-sm font-bold text-slate-700 mb-3">Conclusão da Oportunidade</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-slate-600 mb-1">Resumo do Escopo / Notas</label>
                                    <textarea
                                        rows={2}
                                        value={formData.scopeSummary || ''}
                                        onChange={e => setFormData({ ...formData, scopeSummary: e.target.value })}
                                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                                        placeholder="Descreva brevemente o escopo ou motivo do resultado..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Resultado da Proposta</label>
                                    <select
                                        value={formData.result || ''}
                                        onChange={e => setFormData({ ...formData, result: e.target.value as TaskOutcome })}
                                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 outline-none font-bold ${formData.result === TaskOutcome.SUCCESS ? 'text-green-700 bg-green-50 border-green-200' :
                                            formData.result === TaskOutcome.FAILURE ? 'text-red-700 bg-red-50 border-red-200' :
                                                formData.result === TaskOutcome.STUDY ? 'text-blue-700 bg-blue-50 border-blue-200' :
                                                    formData.result === TaskOutcome.WITHDRAWAL ? 'text-slate-600 bg-slate-100 border-slate-300' :
                                                        'text-slate-500'
                                            }`}
                                    >
                                        <option value="">Selecione o resultado...</option>
                                        <option value={TaskOutcome.SUCCESS}>Sucesso (Vencemos) 🏆</option>
                                        <option value={TaskOutcome.FAILURE}>Insucesso (Perdemos) ❌</option>
                                        <option value={TaskOutcome.STUDY}>Estudo (Apenas Análise) 📚</option>
                                        <option value={TaskOutcome.WITHDRAWAL}>Desistência 🚫</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Optional Description */}
                        <div>
                            <label className="block text-sm font-medium text-slate-600 mb-1">Observações</label>

                            <textarea
                                rows={3}
                                value={formData.description || ''}
                                onChange={e => setFormData({ ...formData, description: e.target.value })}
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                            />
                        </div>

                    </form>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-between gap-3">
                    {initialData?.id && onDelete && (
                        <button
                            type="button"
                            onClick={() => onDelete(initialData.id)}
                            className="px-4 py-2 text-red-600 font-medium hover:bg-red-50 rounded-lg transition-colors"
                        >
                            Excluir
                        </button>
                    )}
                    <div className="flex gap-3 ml-auto">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-200 rounded-lg transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            form="opportunity-form"
                            disabled={loading}
                            className="px-4 py-2 bg-blue-600 text-white font-bold rounded-lg shadow hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                        >
                            <Save size={18} />
                            {loading ? 'Salvando...' : 'Salvar Oportunidade'}
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};
