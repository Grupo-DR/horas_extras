import React, { createContext, useContext, useState, useEffect } from 'react';
import { Contract } from '../types';
import { toast } from 'sonner';

interface ContractsContextType {
    contracts: Contract[];
    addContract: (contract: Contract) => void;
    updateContract: (contract: Contract) => void;
    deleteContract: (id: string) => void;
}

const ContractsContext = createContext<ContractsContextType | undefined>(undefined);

export const ContractsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // Initial state from localStorage or empty
    const [contracts, setContracts] = useState<Contract[]>(() => {
        const saved = localStorage.getItem('commercial_contracts');
        return saved ? JSON.parse(saved) : [];
    });

    useEffect(() => {
        localStorage.setItem('commercial_contracts', JSON.stringify(contracts));
    }, [contracts]);

    const addContract = (contract: Contract) => {
        setContracts(prev => [...prev, contract]);
    };

    const updateContract = (updatedContract: Contract) => {
        setContracts(prev => prev.map(c => c.id === updatedContract.id ? updatedContract : c));
    };

    const deleteContract = (id: string) => {
        setContracts(prev => prev.filter(c => c.id !== id));
        toast.success("Contrato excluído com sucesso!");
    };

    return (
        <ContractsContext.Provider value={{ contracts, addContract, updateContract, deleteContract }}>
            {children}
        </ContractsContext.Provider>
    );
};

export const useContracts = () => {
    const context = useContext(ContractsContext);
    if (context === undefined) {
        throw new Error('useContracts must be used within a ContractsProvider');
    }
    return context;
};
