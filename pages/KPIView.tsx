import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { KPI, User } from '../types';
import { KPIService } from '../services/kpiService';
import { KPICard } from '../components/KPICard';
import { KPIForm } from '../components/KPIForm';
import { KPIUpdateModal } from '../components/KPIUpdateModal';
import { KPIDetailsModal } from '../components/KPIDetailsModal';
import { Plus, Search, Target, LayoutDashboard } from 'lucide-react';
import { Toaster, toast } from 'sonner';

// MOCK USERS (Shared Context in Real App)
const MOCK_USERS: User[] = [
    { id: 'u1', name: 'Antonio Augusto da Silva', role: 'Analista Comercial', email: 'antonio.silva@grupodr.com.br' },
    { id: 'u2', name: 'Cintia Ferreira', role: 'Engenheira Orçamentista', email: 'cintia.ferreira@grupodr.com.br' },
    { id: 'u3', name: 'Tatiana Guimarães', role: 'Engenheira Auxiliar', email: 'tatiana.guimaraes@grupodr.com.br' },
    { id: 'u4', name: 'Nilton Camilo', role: 'Gerente Comercial', email: 'nilton.camilo@grupodr.com.br' },
    { id: 'u5', name: 'Maria Tereza', role: 'Engenheiro Trainee', email: 'maria.tereza@grupodr.com.br' },
    { id: 'u6', name: 'Isabela Costa', role: 'Assistente Comercial', email: 'isabela.costa@grupodr.com.br' },
    { id: 'u7', name: 'Fabiana Fernandes', role: 'Analista Comercial Jr', email: 'fabiana.fernandes@grupodr.com.br' },
    { id: 'u8', name: 'Clara Santos', role: 'Jovem Aprendiz', email: 'clara.santos@grupodr.com.br' },
];

export const KPIView: React.FC = () => {
    const [kpis, setKpis] = useState<KPI[]>([]);
    const [searchTerm, setSearchTerm] = useState('');

    // Modal States
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingKPI, setEditingKPI] = useState<KPI | undefined>(undefined);

    // New Modals
    const [updatingKPI, setUpdatingKPI] = useState<KPI | null>(null);
    const [detailsKPI, setDetailsKPI] = useState<KPI | null>(null);

    useEffect(() => {
        const unsubscribe = KPIService.subscribe(setKpis);
        return () => unsubscribe();
    }, []);

    const handleCreateKPI = async (data: any) => {
        try {
            if (editingKPI) {
                await KPIService.update(editingKPI.id, data);
                toast.success("Indicador atualizado!");
            } else {
                await KPIService.create(data);
                toast.success("Indicador criado com sucesso!");
            }
            setIsFormOpen(false);
            setEditingKPI(undefined);
        } catch (error) {
            console.error(error);
            toast.error("Erro ao salvar KPI.");
        }
    };

    const handleEdit = (kpi: KPI) => {
        setEditingKPI(kpi);
        setIsFormOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (window.confirm("ATENÇÃO: Tem certeza que deseja excluir este KPI?")) {
            try {
                await KPIService.delete(id);
                toast.success("KPI excluído.");
            } catch (error) {
                console.error(error);
                toast.error("Erro ao excluir KPI.");
            }
        }
    };

    const handleUpdateClick = (kpiId: string) => {
        const kpi = kpis.find(k => k.id === kpiId);
        if (kpi) setUpdatingKPI(kpi);
    };

    const handleUpdateSave = async (value: number, date: Date) => {
        if (!updatingKPI) return;
        try {
            // UpdatedBy is MOCK here. In real app, get from Auth Context.
            const updatedBy = "Antonio Augusto";
            await KPIService.updateProgress(updatingKPI.id, value, date, updatedBy);
            toast.success("Progresso atualizado!");
        } catch (e) {
            console.error(e);
            toast.error("Erro ao atualizar progresso.");
        }
    };

    const handleExplore = (kpiId: string) => {
        const kpi = kpis.find(k => k.id === kpiId);
        if (kpi) setDetailsKPI(kpi);
    };

    const navigate = useNavigate();

    const filteredKpis = kpis.filter(k =>
        k.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (k.responsibleName && k.responsibleName.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div className="flex-1 overflow-y-auto bg-slate-50/50 h-full relative">
            {/* HEADER */}
            <div className="bg-white border-b border-slate-200 px-8 py-6 flex flex-col md:flex-row md:items-center justify-between gap-4 sticky top-0 z-10 shadow-sm">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                        <LayoutDashboard className="text-blue-600" />
                        Gestão de Indicadores (KPIs)
                    </h1>
                    <p className="text-slate-500 mt-1">Acompanhamento de metas e performance estratégica.</p>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            type="text"
                            placeholder="Buscar indicador..."
                            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <button
                        onClick={() => { setEditingKPI(undefined); setIsFormOpen(true); }}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors shadow-lg shadow-blue-200"
                    >
                        <Plus size={20} />
                        Novo Indicador
                    </button>
                </div>
            </div>

            {/* CONTENT GRID */}
            <div className="p-8 max-w-7xl mx-auto">
                {kpis.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="bg-slate-100 p-6 rounded-full mb-4">
                            <Target size={48} className="text-slate-300" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-700 mb-2">Nenhum Indicador Definido</h3>
                        <p className="text-slate-500 max-w-md mx-auto mb-6">
                            Defina metas claras e acompanhe o progresso da sua equipe em tempo real.
                        </p>
                        <button
                            onClick={() => { setEditingKPI(undefined); setIsFormOpen(true); }}
                            className="text-blue-600 font-bold hover:underline"
                        >
                            Criar primeiro KPI agora
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        {filteredKpis.map(kpi => (
                            <KPICard
                                key={kpi.id}
                                kpi={kpi}
                                onExplore={handleExplore}
                                onUpdate={handleUpdateClick}
                                onEdit={handleEdit}
                                onDelete={handleDelete}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* MODALS */}
            <KPIForm
                isOpen={isFormOpen}
                onClose={() => { setIsFormOpen(false); setEditingKPI(undefined); }}
                onSave={handleCreateKPI}
                users={MOCK_USERS}
                initialData={editingKPI}
                onDelete={handleDelete}
            />

            {updatingKPI && (
                <KPIUpdateModal
                    isOpen={!!updatingKPI}
                    onClose={() => setUpdatingKPI(null)}
                    onSave={handleUpdateSave}
                    kpi={updatingKPI}
                />
            )}

            <KPIDetailsModal
                isOpen={!!detailsKPI}
                onClose={() => setDetailsKPI(null)}
                kpi={detailsKPI}
            />

            <Toaster position="top-right" richColors />
        </div>
    );
};
