import React, { useState, useEffect } from 'react';
import { Contract } from '../types';
import { ContractService } from '../services/contractService';
import { ContractCard } from '../components/ContractCard';
import { ContractForm } from '../components/ContractForm';
import { PlusCircle, Search, FileText } from 'lucide-react';
import { Toaster, toast } from 'sonner';

export const ContractsView: React.FC = () => {
    const [contracts, setContracts] = useState<Contract[]>([]);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        // Subscribe to real-time updates
        const unsubscribe = ContractService.subscribe((data) => {
            setContracts(data);
        });
        return () => unsubscribe();
    }, []);

    const handleCreateContract = async (contractData: any) => {
        try {
            await ContractService.create(contractData);
            toast.success("Contrato criado com sucesso!");
        } catch (error) {
            console.error(error);
            toast.error("Erro ao criar contrato.");
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

    const filteredContracts = contracts.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.siteName.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="flex-1 overflow-y-auto bg-slate-50/50 h-full relative">
            {/* HEADER */}
            <header className="bg-white/70 backdrop-blur-md border-b border-white/20 px-8 py-5 sticky top-0 z-30 flex justify-between items-center">
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
                        onClick={() => setIsFormOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-bold shadow hover:bg-blue-700 transition-colors"
                    >
                        <PlusCircle size={18} /> Novo Contrato
                    </button>
                </div>
            </header>

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
                                onAddMeasurement={handleAddMeasurement}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* MODALS */}
            <ContractForm
                isOpen={isFormOpen}
                onClose={() => setIsFormOpen(false)}
                onSave={handleCreateContract}
            />

            <Toaster position="top-right" richColors />
        </div>
    );
};
