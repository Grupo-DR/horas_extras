import React, { useState, useEffect } from 'react';
import { DataSolution, User } from '../types';
import { SolutionService } from '../services/solutionService';
import { SolutionCard } from '../components/SolutionCard';
import { SolutionForm } from '../components/SolutionForm'; // Assuming you created this
import { Lightbulb, Plus, Search, Database } from 'lucide-react';
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
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const unsubscribe = SolutionService.subscribe(setSolutions);
        return () => unsubscribe();
    }, []);

    const handleCreateSolution = async (data: any) => {
        try {
            await SolutionService.create(data);
            toast.success("Solução criada com sucesso!");
            setIsFormOpen(false);
        } catch (error) {
            console.error(error);
            toast.error("Erro ao criar solução.");
        }
    };

    const handleExplore = (solutionId: string) => {
        // Navigate to Commercial View with Filter
        window.location.href = `/comercial?solutionId=${solutionId}`;
    };

    const filteredSolutions = solutions.filter(s =>
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.responsibleName && s.responsibleName.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div className="flex-1 overflow-y-auto bg-slate-50/50 h-full relative">
            {/* HEADER */}
            <div className="bg-white border-b border-slate-200 px-8 py-6 flex flex-col md:flex-row md:items-center justify-between gap-4 sticky top-0 z-10 shadow-sm">
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
                        onClick={() => setIsFormOpen(true)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors shadow-lg shadow-blue-200"
                    >
                        <Plus size={20} />
                        Nova Solução
                    </button>
                </div>
            </div>

            {/* CONTENT GRID */}
            <div className="p-8 max-w-7xl mx-auto">
                {solutions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="bg-slate-100 p-6 rounded-full mb-4">
                            <Database size={48} className="text-slate-300" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-700 mb-2">Nenhuma Solução Criada</h3>
                        <p className="text-slate-500 max-w-md mx-auto mb-6">
                            Comece criando uma nova solução estratégica para organizar seus dados e processos de inteligência.
                        </p>
                        <button
                            onClick={() => setIsFormOpen(true)}
                            className="text-blue-600 font-bold hover:underline"
                        >
                            Criar primeira solução agora
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        {filteredSolutions.map(solution => (
                            <SolutionCard
                                key={solution.id}
                                solution={solution}
                                onExplore={handleExplore}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* MODALS */}
            <SolutionForm
                isOpen={isFormOpen}
                onClose={() => setIsFormOpen(false)}
                onSave={handleCreateSolution}
                users={MOCK_USERS}
            />

            <Toaster position="top-right" richColors />
        </div>
    );
};
