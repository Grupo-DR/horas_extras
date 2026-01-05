import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DataSolution, User } from '../types';
import { SolutionService } from '../services/solutionService';
import { SolutionCard } from '../components/SolutionCard';
import { SolutionForm } from '../components/SolutionForm';
import { ProjectModelCanvas } from '../components/ProjectModelCanvas';
import { Lightbulb, Plus, Search, Database, Layout } from 'lucide-react';
import { Toaster, toast } from 'sonner';

// MOCK USERS (Should be shared context in real app)
const MOCK_USERS: User[] = [
    { id: 'u1', name: 'Antonio Augusto da Silva', role: 'Analista Comercial', email: 'antonio.silva@grupodr.com.br' },
    { id: 'u2', name: 'Cintia Ferreira', role: 'Engenheira Orçamentista', email: 'cintia.ferreira@grupodr.com.br' },
    { id: 'u3', name: 'Tatiana Guimarães', role: 'Engenheira Auxiliar', email: 'tatiana.guimaraes@grupodr.com.br' },
    { id: 'u4', name: 'Nilton Camilo', role: 'Gerente Comercial', email: 'nilton.camilo@grupodr.com.br' },
];

export const DataCenterView: React.FC = () => {
    const [solutions, setSolutions] = useState<DataSolution[]>([]);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingSolution, setEditingSolution] = useState<DataSolution | undefined>(undefined);
    const [viewMode, setViewMode] = useState<'GALLERY' | 'SCRUM'>('GALLERY');
    // PMC STATE
    const [isPMCOpen, setIsPMCOpen] = useState(false);
    const [selectedSolutionForPMC, setSelectedSolutionForPMC] = useState<DataSolution | undefined>(undefined);

    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const unsubscribe = SolutionService.subscribe((data) => {
            setSolutions(data);
        });
        return () => unsubscribe();
    }, []);

    const handleCreateSolution = async (data: any) => {
        try {
            if (editingSolution) {
                await SolutionService.update(editingSolution.id, data);
                toast.success("Solução atualizada!");
            } else {
                await SolutionService.create(data);
                toast.success("Solução criada com sucesso!");
            }
            setIsFormOpen(false);
            setEditingSolution(undefined);
        } catch (error) {
            console.error(error);
            toast.error("Erro ao salvar solução.");
        }
    };

    // CRUD
    const handleEdit = (solution: DataSolution) => {
        setEditingSolution(solution);
        setIsFormOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (window.confirm("ATENÇÃO: Tem certeza que deseja excluir esta Solução?")) {
            try {
                await SolutionService.delete(id);
                toast.success("Solução excluída.");
            } catch (error) {
                console.error(error);
                toast.error("Erro ao excluir solução.");
            }
        }
    };

    const navigate = useNavigate();

    const handleOpenPMC = (solutionId: string) => {
        const solution = solutions.find(s => s.id === solutionId);
        if (solution) {
            setSelectedSolutionForPMC(solution);
            setIsPMCOpen(true);
        }
    };

    const filteredSolutions = solutions.filter(s =>
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.responsibleName && s.responsibleName.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div className="flex-1 overflow-y-auto bg-slate-50/50 h-full relative">
            {/* HEADER */}
            <div className="bg-white border-b border-slate-200 px-8 py-6 flex flex-col md:flex-row md:items-center justify-between gap-4 sticky top-0 z-10 shadow-sm transition-all duration-300">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                        <Database className="text-blue-600" />
                        Gestão de Soluções e Dados
                    </h1>
                    <p className="text-slate-500 mt-1">Estratégias de inteligência e governança de dados.</p>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            type="text"
                            placeholder="Buscar solução..."
                            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <button
                        onClick={() => { setEditingSolution(undefined); setIsFormOpen(true); }}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors shadow-lg shadow-blue-200"
                    >
                        <Plus size={20} />
                        Nova Solução
                    </button>

                </div>
            </div>

            {/* TAB SELECTOR */}
            <div className="px-8 mt-6">
                <div className="flex items-center gap-4 border-b border-slate-200">
                    <button
                        onClick={() => setViewMode('GALLERY')}
                        className={`pb-3 px-1 font-bold text-sm flex items-center gap-2 transition-colors ${viewMode === 'GALLERY' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <Layout size={18} /> Galeria de Soluções
                    </button>
                    <button
                        onClick={() => setViewMode('SCRUM')}
                        className={`pb-3 px-1 font-bold text-sm flex items-center gap-2 transition-colors ${viewMode === 'SCRUM' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <Database size={18} /> Fluxo Scrum
                    </button>
                </div>
            </div>

            <div className="p-8 max-w-7xl mx-auto min-h-[500px]">
                {viewMode === 'GALLERY' ? (
                    solutions.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                            <div className="bg-slate-100 p-6 rounded-full mb-4">
                                <Database size={48} className="text-slate-300" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-700 mb-2">Nenhuma Solução Criada</h3>
                            <p className="text-slate-500 max-w-md mx-auto mb-6">
                                Comece criando uma nova solução estratégica para organizar seus dados e processos de inteligência.
                            </p>
                            <button
                                onClick={() => { setEditingSolution(undefined); setIsFormOpen(true); }}
                                className="text-blue-600 font-bold hover:underline"
                            >
                                Criar primeira solução agora
                            </button>
                        </div>
                    ) : (
                        <div
                            className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6"
                        >
                            {filteredSolutions.map(solution => (
                                <SolutionCard
                                    key={solution.id}
                                    solution={solution}
                                    onExplore={handleOpenPMC}
                                    onEdit={handleEdit}
                                    onDelete={handleDelete}
                                />
                            ))}
                        </div>
                    )
                ) : (
                    // SCRUM VIEW
                    <ScrumBoard solutions={filteredSolutions} onEdit={handleEdit} onPMC={handleOpenPMC} />
                )}
            </div>

            {/* MODALS */}
            <SolutionForm
                isOpen={isFormOpen}
                onClose={() => { setIsFormOpen(false); setEditingSolution(undefined); }}
                onSave={handleCreateSolution}
                users={MOCK_USERS}
                initialData={editingSolution}
            />

            {/* PMC MODAL */}
            {selectedSolutionForPMC && (
                <ProjectModelCanvas
                    isOpen={isPMCOpen}
                    onClose={() => { setIsPMCOpen(false); setSelectedSolutionForPMC(undefined); }}
                    solution={selectedSolutionForPMC}
                />
            )}

            <Toaster position="top-right" richColors />
        </div>
    );
};

// SCRUM BOARD COMPONENT
const ScrumBoard = ({ solutions, onEdit, onPMC }: { solutions: DataSolution[], onEdit: (s: DataSolution) => void, onPMC: (id: string) => void }) => {

    const isLate = (date?: Date) => date && new Date() > new Date(date);

    // Filter by statuses from types.ts
    const stages = [
        { id: 'ON_HOLD', label: 'Backlog / Requirements', items: solutions.filter(s => s.status === 'ON_HOLD') },
        { id: 'TODO', label: 'A Fazer', items: solutions.filter(s => s.status === 'TODO') },
        { id: 'ACTIVE', label: 'Em Processo', items: solutions.filter(s => s.status === 'ACTIVE') },
        { id: 'REVIEW', label: 'Revisão / Teste', items: solutions.filter(s => s.status === 'REVIEW') },
        { id: 'COMPLETED', label: 'Concluído', items: solutions.filter(s => s.status === 'COMPLETED') }
    ];

    const handleDragStart = (e: React.DragEvent, id: string) => {
        e.dataTransfer.setData('solutionId', id);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const handleDrop = async (e: React.DragEvent, newStatus: string) => {
        const solutionId = e.dataTransfer.getData('solutionId');
        if (!solutionId) return;

        // Optimistic update would be complex here without state lifting or prop drilling setSolutions
        // We will rely on real-time subscription update for now or just trigger update
        try {
            await SolutionService.update(solutionId, { status: newStatus as any });
            toast.success("Status atualizado!");
        } catch (error) {
            console.error(error);
            toast.error("Erro ao mover solução.");
        }
    };

    return (
        <div className="flex gap-4 h-full overflow-x-auto pb-4">
            {stages.map(stage => (
                <div
                    key={stage.id}
                    className="min-w-[280px] bg-slate-100 rounded-xl p-3 flex flex-col h-full transition-colors hover:bg-slate-200/50"
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, stage.id)}
                >
                    <div className="font-bold text-slate-600 mb-3 flex justify-between items-center">
                        <span className="uppercase text-xs tracking-wider">{stage.label}</span>
                        <span className="bg-slate-200 text-slate-600 text-xs px-2 py-0.5 rounded-full">{stage.items.length}</span>
                    </div>
                    <div className="flex-1 flex flex-col gap-3 overflow-y-auto">
                        {stage.items.length === 0 && (
                            <div className="text-center py-10 opacity-30 text-sm italic">Arrastar para aqui</div>
                        )}
                        {stage.items.map((s: any) => (
                            <div
                                key={s.id}
                                draggable
                                onDragStart={(e) => handleDragStart(e, s.id)}
                                className="bg-white p-3 rounded-lg shadow-sm border border-slate-200 hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing flex flex-col gap-2 relative group"
                            // REMOVED onClick for PMC here to prevent conflict. PMC access via button below.
                            >
                                <div className="flex justify-between items-start">
                                    <span className="font-bold text-slate-800 line-clamp-2 text-sm leading-tight">{s.name}</span>
                                    {isLate(s.deadline) && s.status !== 'COMPLETED' && (
                                        <span className="bg-red-100 text-red-600 text-[10px] uppercase font-bold px-1.5 py-0.5 rounded">ATRASADO</span>
                                    )}
                                </div>
                                <p className="text-xs text-slate-500 line-clamp-2">{s.description}</p>
                                <div className="mt-auto pt-2 flex justify-between items-center text-xs text-slate-400">
                                    <span>{s.responsibleName?.split(' ')[0]}</span>
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={(e) => { e.stopPropagation(); onPMC(s.id); }} className="hover:text-blue-600 p-1 font-bold" title="Abrir PMC">
                                            PMC
                                        </button>
                                        <button onClick={(e) => { e.stopPropagation(); onEdit(s); }} className="hover:text-blue-600 p-1">
                                            Editar
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
};
