import React, { useState, useEffect } from 'react';
import { Contract, ContractStatus, ContractMeasurement } from '../types';
import { ContractService } from '../services/contractService';
import { ContractCard } from '../components/ContractCard';
import { ContractForm } from '../components/ContractForm';
import { Toaster, toast } from 'sonner';
import { FileText, PlusCircle, Search, Filter, LayoutDashboard, FolderOpen } from 'lucide-react';
import { DocumentImportModal } from '../components/DocumentImportModal';
import { useNavigate } from 'react-router-dom';
import { ContractGlobalDashboard } from '../components/ContractGlobalDashboard';
import { ContractAnalytics } from '../components/ContractAnalytics';

type ViewMode = 'PORTFOLIO' | 'DASHBOARD';

export const ContractsView: React.FC = () => {
    const navigate = useNavigate();
    const [contracts, setContracts] = useState<Contract[]>([]);
    const [filteredContracts, setFilteredContracts] = useState<Contract[]>([]);
    const [statusFilter, setStatusFilter] = useState<ContractStatus | 'ALL'>('ALL');
    const [searchTerm, setSearchTerm] = useState('');

    // View State
    const [viewMode, setViewMode] = useState<ViewMode>('PORTFOLIO');
    const [selectedContractId, setSelectedContractId] = useState<string | null>(null);

    // UI State
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isImportOpen, setIsImportOpen] = useState(false);

    // Contract Data for Dashboard
    const [dashHistory, setDashHistory] = useState<ContractMeasurement[]>([]);

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

    // Load History when selecting a contract in Dashboard
    useEffect(() => {
        if (selectedContractId) {
            ContractService.getMeasurementHistory(selectedContractId).then(setDashHistory);
        } else {
            setDashHistory([]);
        }
    }, [selectedContractId]);

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

    const handleImportData = (data: any) => {
        toast.success("Dados importados! Vincule ao contrato na aba Dashboard.");
        setIsImportOpen(false);
    };

    // Derived
    const activeContract = contracts.find(c => c.id === selectedContractId);

    return (
        <div className="flex flex-col h-full bg-slate-50/50">
            {/* HEADER */}
            <div className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between sticky top-0 z-20 shadow-sm shrink-0">
                <div className="flex items-center gap-6">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                            <FileText className="text-blue-600" /> Gestão de Contratos
                        </h1>
                        <p className="text-slate-500 text-sm mt-1">Administração de contratos e medições de obras.</p>
                    </div>

                    {/* TABS */}
                    <div className="flex bg-slate-100 p-1 rounded-xl">
                        <button
                            onClick={() => { setViewMode('PORTFOLIO'); setSelectedContractId(null); }}
                            className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${viewMode === 'PORTFOLIO' ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'
                                }`}
                        >
                            <FolderOpen size={16} /> Visão da Carteira
                        </button>
                        <button
                            onClick={() => setViewMode('DASHBOARD')}
                            className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${viewMode === 'DASHBOARD' ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'
                                }`}
                        >
                            <LayoutDashboard size={16} /> Dashboard de Contratos
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    {viewMode === 'PORTFOLIO' && (
                        <>
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
                        </>
                    )}

                    {viewMode === 'DASHBOARD' && (
                        <select
                            className="bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 font-bold outline-none"
                            value={selectedContractId || ''}
                            onChange={(e) => setSelectedContractId(e.target.value || null)}
                        >
                            <option value="">Visão Geral (Todos)</option>
                            <optgroup label="Contratos Ativos">
                                {contracts.filter(c => c.status === ContractStatus.ACTIVE).map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </optgroup>
                            <optgroup label="Outros">
                                {contracts.filter(c => c.status !== ContractStatus.ACTIVE).map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </optgroup>
                        </select>
                    )}
                </div>
            </div>

            {/* CONTENT AREA */}
            <div className="flex-1 overflow-hidden relative">

                {/* PORTFOLIO VIEW */}
                {viewMode === 'PORTFOLIO' && (
                    <div className="absolute inset-0 overflow-auto p-8 flex flex-col animate-in fade-in duration-300">
                        {/* STATUS FILTERS */}
                        <div className="mb-6 flex items-center gap-4">
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

                        {filteredContracts.length === 0 ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
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
                                        onViewDetails={(c) => {
                                            // Switch to Dashboard Tab and Select this Contract
                                            setSelectedContractId(c.id);
                                            setViewMode('DASHBOARD');
                                        }}
                                        onEdit={(c) => { setEditingContract(c); setIsFormOpen(true); }}
                                        onDelete={handleDelete}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* DASHBOARD VIEW */}
                {viewMode === 'DASHBOARD' && (
                    <div className="absolute inset-0 overflow-hidden animate-in zoom-in-95 duration-200">
                        {selectedContractId && activeContract ? (
                            <ContractAnalytics
                                contract={activeContract}
                                history={dashHistory}
                                onAddMeasurement={async (contractId, measurement) => {
                                    await ContractService.addMeasurement(contractId, measurement);
                                }}
                                onRemoveMeasurement={async (contractId, measurementId) => {
                                    await ContractService.removeMeasurement(contractId, measurementId);
                                }}
                                refreshHistory={() => {
                                    if (selectedContractId) ContractService.getMeasurementHistory(selectedContractId).then(setDashHistory);
                                }}
                            />
                        ) : (
                            <ContractGlobalDashboard contracts={contracts} />
                        )}
                    </div>
                )}
            </div>

            {/* MODALS (Only Form and Import now) */}
            {isFormOpen && (
                <ContractForm
                    isOpen={isFormOpen}
                    initialData={editingContract}
                    onClose={() => { setIsFormOpen(false); setEditingContract(undefined); }}
                    onSave={handleSave}
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
