import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FileText, Users, ArrowLeft, Building, Calendar, DollarSign, Plus } from 'lucide-react';
import { useContracts } from '../contexts/ContractsContext';
import { DocumentImportModal } from '../components/DocumentImportModal';
import { ContractTeamModal } from '../components/ContractTeamModal';
import { ContractTeam } from '../types';
import { toast } from 'sonner';

export const ContractDashboardView: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { contracts, updateContract } = useContracts();

    const contract = contracts.find(c => c.id === id);

    const [isImportModalOpen, setIsImportModalOpen] = useState(false);

    // Placeholder for Team Modal
    const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);

    if (!contract) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-slate-500">
                <p>Contrato não encontrado.</p>
                <button onClick={() => navigate('/contratos')} className="text-blue-600 mt-2 hover:underline">
                    Voltar para lista
                </button>
            </div>
        );
    }

    const formatCurrency = (val: number) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    const handleImportSuccess = (data: any) => {
        // Validation for RDO
        if (data.type === 'RDO' || data.documentType === 'RDO' || data.relatorio) {
            // Check if attached to team
            if (data.teamId) {
                const updatedTeams = contract.teams?.map(team => {
                    if (team.id === data.teamId) {
                        return {
                            ...team,
                            rdos: [...(team.rdos || []), data]
                        };
                    }
                    return team;
                });

                const updatedContract = { ...contract, teams: updatedTeams };
                updateContract(updatedContract);
                toast.success(`RDO vinculado à equipe com sucesso!`);
            } else {
                toast.warning("RDO importado sem vínculo de equipe (Apenas Visualização)");
            }
        } else {
            toast.success("Boletim Importado com Sucesso! (Simulação)");
        }
        setIsImportModalOpen(false);
    };

    const handleCreateTeam = (team: ContractTeam) => {
        const updatedContract = {
            ...contract,
            teams: [...(contract.teams || []), team]
        };
        updateContract(updatedContract);
        setIsTeamModalOpen(false);
    };

    return (
        <div className="flex h-full flex-col bg-slate-50 overflow-hidden">
            {/* HEADER */}
            <div className="bg-white border-b border-slate-200 px-8 py-6">
                <button
                    onClick={() => navigate('/contratos')}
                    className="flex items-center gap-2 text-slate-500 hover:text-slate-700 mb-4 text-sm font-medium transition-colors"
                >
                    <ArrowLeft size={16} /> Voltar para Contratos
                </button>

                <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-bold rounded">
                                {contract.contractNumber}
                            </span>
                            <h1 className="text-2xl font-bold text-slate-800">
                                {contract.siteName}
                            </h1>
                        </div>
                        <p className="text-slate-500 text-sm flex items-center gap-2">
                            <Building size={14} />
                            {contract.clientName}
                        </p>
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={() => setIsImportModalOpen(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium transition-colors shadow-sm"
                        >
                            <FileText size={18} className="text-slate-400" />
                            Inserir Boletim
                        </button>
                        <button
                            onClick={() => setIsTeamModalOpen(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium transition-colors shadow-sm"
                        >
                            <Users size={18} className="block text-slate-400" />
                            Inserir Equipe
                        </button>
                        <button
                            onClick={() => setIsImportModalOpen(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-bold transition-colors shadow-sm"
                        >
                            <FileText size={18} />
                            Inserir RDO
                        </button>
                    </div>
                </div>
            </div>

            {/* CONTENT */}
            <div className="flex-1 overflow-auto p-8 space-y-8">

                {/* METRICS CARDS */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Valor Contratual</label>
                        <p className="text-2xl font-bold text-slate-800">{formatCurrency(contract.totalValue)}</p>
                    </div>
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Total Medido</label>
                        <p className="text-2xl font-bold text-green-600">
                            {formatCurrency(contract.measurements?.reduce((acc, m) => acc + m.value, 0) || 0)}
                        </p>
                    </div>
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Saldo</label>
                        <p className="text-2xl font-bold text-blue-600">
                            {formatCurrency(contract.totalValue - (contract.measurements?.reduce((acc, m) => acc + m.value, 0) || 0))}
                        </p>
                    </div>
                </div>

                {/* TEAMS SECTION (Placeholder) */}
                <div>
                    <h3 className="text-lg font-bold text-slate-700 mb-4 flex items-center gap-2">
                        <Users size={20} className="text-slate-400" />
                        Equipes Vinculadas
                    </h3>

                    {(!contract.teams || contract.teams.length === 0) ? (
                        <div className="bg-slate-100 border-2 border-dashed border-slate-300 rounded-xl p-8 text-center">
                            <Users size={32} className="text-slate-300 mx-auto mb-3" />
                            <p className="text-slate-500 font-medium mb-1">Nenhuma equipe cadastrada</p>
                            <p className="text-xs text-slate-400 mb-4">Cadastre equipes para vincular os RDOs e gerenciar atividades.</p>
                            <button
                                onClick={() => setIsTeamModalOpen(true)}
                                className="text-blue-600 text-sm font-bold hover:underline"
                            >
                                + Cadastrar Primeira Equipe
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {contract.teams.map(team => (
                                <div key={team.id} className="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <h4 className="font-bold text-slate-800">{team.name}</h4>
                                            <p className="text-sm text-slate-500">{team.location}</p>
                                        </div>
                                        <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-1 rounded-full">
                                            {team.rdos?.length || 0} RDOs
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-400 mt-2">Líder: {team.leaderName}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* MEASUREMENTS HISTORY */}
                <div>
                    <h3 className="text-lg font-bold text-slate-700 mb-4 flex items-center gap-2">
                        <FileText size={20} className="text-slate-400" />
                        Boletins de Medição
                    </h3>

                    {(!contract.measurements || contract.measurements.length === 0) ? (
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center text-slate-400 text-sm italic">
                            Nenhuma medição registrada.
                        </div>
                    ) : (
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                                    <tr>
                                        <th className="px-6 py-3">Período</th>
                                        <th className="px-6 py-3 text-right">Valor Medido</th>
                                        <th className="px-6 py-3 text-right">Data Importação</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {contract.measurements.map((bm, index) => (
                                        <tr key={index} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-6 py-3 font-medium text-slate-700">{bm.period}</td>
                                            <td className="px-6 py-3 text-right text-green-600 font-bold">{formatCurrency(bm.value)}</td>
                                            <td className="px-6 py-3 text-right text-slate-400 text-xs">{new Date(bm.date).toLocaleDateString('pt-BR')}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            <DocumentImportModal
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
                onImport={handleImportSuccess}
                teams={contract.teams}
            />

            <ContractTeamModal
                isOpen={isTeamModalOpen}
                onClose={() => setIsTeamModalOpen(false)}
                onSave={handleCreateTeam}
            />
        </div>
    );
};
