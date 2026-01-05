import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Contract } from '../types';
import { ContractService } from '../services/contractService';
import { ContractCard } from '../components/ContractCard';
import { ContractForm } from '../components/ContractForm';
import { ContractDetailsModal } from '../components/ContractDetailsModal';
import { PlusCircle, Search, FileText } from 'lucide-react';
import { Toaster, toast } from 'sonner';

export const ContractsView: React.FC = () => {
    const [contracts, setContracts] = useState<Contract[]>([]);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingContract, setEditingContract] = useState<Contract | undefined>(undefined);

    const [searchTerm, setSearchTerm] = useState('');
    const navigate = useNavigate();

    // DASHBOARD METRICS
    const stats = React.useMemo(() => {
        const activeContracts = contracts.filter(c => c.status === 'ACTIVE');
        const activeCount = activeContracts.length;

        const walletValue = activeContracts.reduce((acc, c) => acc + c.totalValue, 0);

        const executedValue = activeContracts.reduce((acc, c) => {
            return acc + (c.measurements || []).reduce((sum, m) => sum + (m.value || 0), 0);
        }, 0);

        const totalBalance = activeContracts.reduce((acc, c) => {
            const accumulated = (c.measurements || []).reduce((sum, m) => sum + (m.value || 0), 0);
            return acc + (c.totalValue - accumulated);
        }, 0);

        return { activeCount, walletValue, executedValue, totalBalance };
    }, [contracts]);


    const [detailsContract, setDetailsContract] = useState<Contract | null>(null);

    useEffect(() => {
        // Subscribe to real-time updates
        const unsubscribe = ContractService.subscribe((data) => {
            setContracts(data);
            // Update details view live if open (optional but good)
            setDetailsContract(curr => curr ? data.find(d => d.id === curr.id) || null : null);
        });
        return () => unsubscribe();
    }, []);

    const handleCreateContract = async (contractData: any) => {
        try {
            if (editingContract) {
                await ContractService.update(editingContract.id, contractData);
                toast.success("Contrato atualizado!");
            } else {
                await ContractService.create(contractData);
                toast.success("Contrato criado com sucesso!");
            }
            setIsFormOpen(false);
            setEditingContract(undefined);
        } catch (error) {
            console.error(error);
            toast.error("Erro ao salvar contrato.");
        }
    };

    // CRUD Handlers
    const handleEdit = (contract: Contract) => {
        setEditingContract(contract);
        setIsFormOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (window.confirm("ATENÇÃO: Tem certeza que deseja excluir este contrato? Essa ação não pode ser desfeita.")) {
            try {
                await ContractService.delete(id);
                toast.success("Contrato excluído.");
            } catch (error) {
                console.error(error);
                toast.error("Erro ao excluir contrato.");
            }
        }
    };

    const handleAddMeasurement = async (contractId: string, measurement: any) => {
        try {
            await ContractService.addMeasurement(contractId, measurement);
            toast.success("Medição adicionada com sucesso!");
        } catch (error) {
            console.error(error);
            toast.error("Erro ao adicionar medição.");
        }
    };

    const handleRemoveMeasurement = async (contractId: string, measurementId: string) => {
        if (!window.confirm("Confirma a exclusão desta medição?")) return;
        try {
            await ContractService.removeMeasurement(contractId, measurementId);
            toast.success("Medição excluída.");
        } catch (error) {
            console.error(error);
            toast.error("Erro ao excluir medição.");
        }
    };

    const filteredContracts = contracts.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.siteName.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="flex-1 overflow-y-auto bg-slate-50/50 h-full relative">
            {/* HEADER */}
            <header className="bg-white border-b border-slate-200 px-8 py-5 sticky top-0 z-30 flex justify-between items-center shadow-sm">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <FileText className="text-blue-600" /> Gestão de Contratos
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">Acompanhamento físico-financeiro de obras</p>
                </div>

                <div className="flex gap-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            type="text"
                            placeholder="Buscar contratos..."
                            className="pl-10 pr-4 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none w-64"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <button
                        onClick={() => { setEditingContract(undefined); setIsFormOpen(true); }}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-bold shadow hover:bg-blue-700 transition-colors"
                    >
                        <PlusCircle size={18} /> Novo Contrato
                    </button>
                </div>
            </header>

            {/* BI DASHBOARD */}
            <div className="bg-white border-b border-indigo-100 px-8 py-6 mb-6">
                <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl shadow-sm flex flex-col justify-between">
                        <p className="text-slate-500 font-bold text-xs uppercase tracking-wide">Contratos Ativos</p>
                        <p className="text-4xl font-bold text-slate-800 mt-2">{stats.activeCount}</p>
                    </div>

                    <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl shadow-sm flex flex-col justify-between">
                        <p className="text-slate-500 font-bold text-xs uppercase tracking-wide">Valor em Carteira</p>
                        <p className="text-3xl font-bold text-slate-800 mt-2">
                            {stats.walletValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </p>
                    </div>

                    <div className="bg-purple-50 border border-purple-100 p-4 rounded-xl shadow-sm flex flex-col justify-between">
                        <p className="text-slate-500 font-bold text-xs uppercase tracking-wide">Valor Executado Ativo</p>
                        <p className="text-3xl font-bold text-slate-800 mt-2">
                            {stats.executedValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </p>
                    </div>

                    <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl shadow-sm flex flex-col justify-between">
                        <p className="text-slate-500 font-bold text-xs uppercase tracking-wide">Saldo a Executar</p>
                        <p className="text-3xl font-bold text-slate-800 mt-2">
                            {stats.totalBalance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </p>
                    </div>
                </div>


            </div>

            {/* CONTENT GRID */}
            <div className="p-8 max-w-7xl mx-auto">
                {contracts.length === 0 ? (
                    <div className="text-center py-20 opacity-50">
                        <FileText size={48} className="mx-auto mb-4 text-slate-300" />
                        <p className="text-lg text-slate-500">Nenhum contrato cadastrado.</p>
                        <p className="text-sm text-slate-400">Clique em "Novo Contrato" para começar.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        {filteredContracts.map(contract => (
                            <ContractCard
                                key={contract.id}
                                contract={contract}
                                onViewDetails={(c) => setDetailsContract(c)}
                                onEdit={handleEdit}
                                onDelete={handleDelete}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* MODALS */}
            <ContractForm
                isOpen={isFormOpen}
                onClose={() => { setIsFormOpen(false); setEditingContract(undefined); }}
                onSave={handleCreateContract}
                initialData={editingContract}
                onDelete={handleDelete}
            />

            <ContractDetailsModal
                isOpen={!!detailsContract}
                onClose={() => setDetailsContract(null)}
                contract={detailsContract}
                onAddMeasurement={handleAddMeasurement}
                onRemoveMeasurement={handleRemoveMeasurement}
            />

            <Toaster position="top-right" richColors />
        </div>
    );
};
