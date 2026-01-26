import React, { useState, useEffect } from 'react';
import { Contract, ContractStatus } from '../types';
import { ContractService } from '../services/contractService';
import { ContractCard } from '../components/ContractCard';
import { ContractForm } from '../components/ContractForm';
import { ContractDetailsModal } from '../components/ContractDetailsModal';
import { Toaster, toast } from 'sonner';
import { FileText, PlusCircle, Search, Filter } from 'lucide-react';
import { DocumentImportModal } from '../components/DocumentImportModal';
import { useNavigate } from 'react-router-dom';

export const ContractsView: React.FC = () => {
    const navigate = useNavigate();
    const [contracts, setContracts] = useState<Contract[]>([]);
    const [filteredContracts, setFilteredContracts] = useState<Contract[]>([]);
    const [statusFilter, setStatusFilter] = useState<ContractStatus | 'ALL'>('ALL');
    const [searchTerm, setSearchTerm] = useState('');

    // UI State
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);
    const [isImportOpen, setIsImportOpen] = useState(false);

    const [selectedContract, setSelectedContract] = useState<Contract | undefined>(undefined);
    const [editingContract, setEditingContract] = useState<Contract | undefined>(undefined);

    useEffect(() => {
        const unsubscribe = ContractService.subscribe((data) => {
            setContracts(data);
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        let result = contracts;

        if (statusFilter !== 'ALL') {
            result = result.filter(c => c.status === statusFilter);
        }

        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            result = result.filter(c =>
                c.name.toLowerCase().includes(term) ||
                c.siteName.toLowerCase().includes(term) ||
                c.clientName.toLowerCase().includes(term)
            );
        }

        setFilteredContracts(result);
    }, [contracts, statusFilter, searchTerm]);

    const handleSave = async (data: Partial<Contract>) => {
        try {
            if (editingContract) {
                await ContractService.update(editingContract.id, data);
                toast.success('Contrato atualizado com sucesso!');
            } else {
                await ContractService.create(data as any);
                toast.success('Contrato criado com sucesso!');
            }
            setIsFormOpen(false);
            setEditingContract(undefined);
        } catch (error) {
            console.error(error);
            toast.error('Erro ao salvar contrato.');
        }
    };

    const handleDelete = async (id: string) => {
        if (window.confirm('Tem certeza que deseja excluir este contrato?')) {
            try {
                await ContractService.delete(id);
                toast.success('Contrato excluído.');
            } catch (error) {
                toast.error('Erro ao excluir contrato.');
            }
        }
    };

    // Measurement Integration (via Import Modal or Details)
    const handleImportData = (data: any) => {
        // Logic for imported data - usually connected to a specific contract
        // For now just show success
        console.log("Imported data:", data);
        toast.success("Dados importados! Vincule ao contrato na tela de detalhes.");
        setIsImportOpen(false);
    };

    return (
        <div className="flex flex-col h-full bg-slate-50/50">
            {/* HEADER */}
            <div className="bg-white border-b border-slate-200 px-8 py-5 flex items-center justify-between sticky top-0 z-20 shadow-sm">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <FileText className="text-blue-600" /> Gestão de Contratos
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">Administração de contratos e medições de obras.</p>
                </div>

                <div className="flex items-center gap-4">
                    {/* SEARCH */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                            type="text"
                            placeholder="Buscar contrato..."
                            className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-100 outline-none w-64 transition-all"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <div className="h-8 w-px bg-slate-200 mx-2"></div>

                    <button
                        onClick={() => { setEditingContract(undefined); setIsFormOpen(true); }}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200"
                    >
                        <PlusCircle size={18} /> Novo Contrato
                    </button>

                    <button
                        onClick={() => setIsImportOpen(true)}
                        className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium border border-slate-200 transition-colors"
                    >
                        Importar Dados
                    </button>
                </div>
            </div>

            {/* FILTERS */}
            <div className="px-8 py-4 bg-white border-b border-slate-200 flex items-center gap-4">
                <div className="flex items-center gap-2 text-slate-600 font-bold text-sm">
                    <Filter size={16} /> Status:
                </div>
                <div className="flex bg-slate-100 p-1 rounded-lg">
                    {['ALL', 'ACTIVE', 'FINISHED', 'SUSPENDED'].map((status) => (
                        <button
                            key={status}
                            onClick={() => setStatusFilter(status as any)}
                            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${statusFilter === status ? 'bg-white shadow text-blue-700' : 'text-slate-500 hover:text-slate-700'
                                }`}
                        >
                            {status === 'ALL' ? 'Todos' : status === 'ACTIVE' ? 'Ativos' : status === 'FINISHED' ? 'Concluídos' : 'Suspensos'}
                        </button>
                    ))}
                </div>
            </div>

            {/* CONTENT */}
            <div className="flex-1 overflow-auto p-8">
                {filteredContracts.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400">
                        <FileText size={48} className="mb-4 opacity-50" />
                        <p className="text-lg font-medium">Nenhum contrato encontrado.</p>
                        <button
                            onClick={() => { setEditingContract(undefined); setIsFormOpen(true); }}
                            className="mt-4 text-blue-600 font-bold hover:underline"
                        >
                            Criar Primeiro Contrato
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        {filteredContracts.map(contract => (
                            <ContractCard
                                key={contract.id}
                                contract={contract}
                                onViewDetails={(c) => { setSelectedContract(c); setIsDetailsOpen(true); }}
                                onEdit={(c) => { setEditingContract(c); setIsFormOpen(true); }}
                                onDelete={handleDelete}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* MODALS */}
            {isFormOpen && (
                <ContractForm
                    isOpen={isFormOpen}
                    initialData={editingContract}
                    onClose={() => { setIsFormOpen(false); setEditingContract(undefined); }}
                    onSave={handleSave}
                />
            )}

            {isDetailsOpen && selectedContract && (
                <ContractDetailsModal
                    isOpen={isDetailsOpen}
                    contract={selectedContract}
                    onClose={() => { setIsDetailsOpen(false); setSelectedContract(undefined); }}
                    onAddMeasurement={async (contractId, measurement) => {
                        await ContractService.addMeasurement(contractId, measurement);
                    }}
                    onRemoveMeasurement={async (contractId, measurementId) => {
                        await ContractService.removeMeasurement(contractId, measurementId);
                    }}
                />
            )}

            <DocumentImportModal
                isOpen={isImportOpen}
                onClose={() => setIsImportOpen(false)}
                onImport={handleImportData}
            />

            <Toaster position="top-right" richColors />
        </div>
    );
};
