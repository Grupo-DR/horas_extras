import React, { useState } from 'react';
import { Plus, Search, FileText } from 'lucide-react';
import { NewContractModal } from '../components/NewContractModal';
import { ContractCard } from '../components/ContractCard';
import { useContracts } from '../contexts/ContractsContext';
import { useNavigate } from 'react-router-dom';
import { Contract } from '../types';

export const ContractsView: React.FC = () => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const { contracts, addContract, updateContract, deleteContract } = useContracts();
    const navigate = useNavigate();

    // State for editing
    const [selectedContract, setSelectedContract] = useState<Contract | null>(null);

    const handleSaveContract = (contractData: any) => {
        if (selectedContract) {
            updateContract({ ...selectedContract, ...contractData });
        } else {
            addContract(contractData);
        }
        setIsModalOpen(false);
        setSelectedContract(null);
    };

    const handleOpenCreate = () => {
        setSelectedContract(null);
        setIsModalOpen(true);
    };

    const filteredContracts = contracts.filter(c =>
        c.siteName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.contractNumber.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const isEmpty = contracts.length === 0;

    return (
        <div className="flex h-full flex-col bg-slate-50 overflow-hidden">
            {/* HEADER */}
            <div className="bg-white border-b border-slate-200 px-8 py-6 flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <FileText className="text-blue-600" />
                        Módulo de Contratos
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">
                        Gerencie seus contratos, medições e RDOs
                    </p>
                </div>

                {/* HEADER ACTIONS */}
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar contratos..."
                            className="pl-9 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm w-64"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <button
                        onClick={handleOpenCreate}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold flex items-center gap-2 shadow-lg shadow-blue-200 transition-all transform hover:scale-105 active:scale-95"
                    >
                        <Plus size={20} />
                        Novo Contrato
                    </button>
                </div>
            </div>

            {/* CONTENT */}
            <div className="flex-1 overflow-auto p-8">
                {isEmpty ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 animate-in fade-in zoom-in-95 duration-500">
                        <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-6">
                            <FileText size={48} className="text-slate-300" />
                        </div>
                        <h2 className="text-xl font-bold text-slate-600 mb-2">Nenhum contrato encontrado</h2>
                        <p className="text-slate-500 mb-8 max-w-md text-center">
                            Você ainda não possui contratos cadastrados. Crie um novo contrato para começar a gerenciar suas medições.
                        </p>
                        <button
                            onClick={handleOpenCreate}
                            className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold shadow-xl hover:bg-blue-700 transition-all"
                        >
                            Criar Primeiro Contrato
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
                        {filteredContracts.map((contract) => (
                            <ContractCard
                                key={contract.id}
                                contract={contract}
                                onViewDetails={(c) => navigate(`/contratos/${c.id}`)}
                                onEdit={(c) => {
                                    setSelectedContract(c);
                                    setIsModalOpen(true);
                                }}
                                onDelete={(id) => {
                                    if (confirm('Tem certeza que deseja excluir este contrato?')) {
                                        deleteContract(id);
                                    }
                                }}
                            />
                        ))}
                    </div>
                )}
            </div>

            <NewContractModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSaveContract}
                initialData={selectedContract}
            />
        </div>
    );
};
