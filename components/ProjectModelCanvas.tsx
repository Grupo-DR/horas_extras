import React, { useState, useEffect } from 'react';
import { DataSolution } from '../types';
import { X, Plus, Save, Layout, Lock } from 'lucide-react';
import { SolutionService } from '../services/solutionService';
import { toast } from 'sonner';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    solution: DataSolution;
}

const PMC_COLORS = {
    // Simplified solid colors for blocks
    purple: 'bg-indigo-50 border-indigo-200 text-indigo-900',
    yellow: 'bg-amber-50 border-amber-200 text-amber-900',
    orange: 'bg-orange-50 border-orange-200 text-orange-900',
    green: 'bg-emerald-50 border-emerald-200 text-emerald-900',
    blue: 'bg-blue-50 border-blue-200 text-blue-900'
};

const BLOCKS = [
    // ROW 1: STRATEGY (Purple)
    { key: 'justificativas', title: 'Justificativas', color: PMC_COLORS.purple, grid: 'col-span-1 row-span-2' },
    { key: 'objetivoSmart', title: 'Objetivo SMART', color: PMC_COLORS.purple, grid: 'col-span-1 row-span-2' },
    { key: 'beneficios', title: 'Benefícios', color: PMC_COLORS.purple, grid: 'col-span-1 row-span-2' },

    // ROW 2: SCOPE (Yellow)
    { key: 'solucao', title: 'Produto/Solução', color: PMC_COLORS.yellow, grid: 'col-span-1 row-span-2' },
    { key: 'requisitos', title: 'Requisitos', color: PMC_COLORS.yellow, grid: 'col-span-1 row-span-2' },

    // ROW 3: PEOPLE (Orange)
    { key: 'stakeholders', title: 'Stakeholders', color: PMC_COLORS.orange, grid: 'col-span-1 row-span-2' },
    { key: 'equipe', title: 'Equipe', color: PMC_COLORS.orange, grid: 'col-span-1 row-span-2' },

    // ROW 4: SUSTAINABILITY (Green)
    { key: 'premissas', title: 'Premissas', color: PMC_COLORS.green, grid: 'col-span-1 row-span-1' },
    { key: 'entregas', title: 'Grupo de Entregas', color: PMC_COLORS.green, grid: 'col-span-1 row-span-1' },
    { key: 'manutencao', title: 'Manutenção (KPIs)', color: PMC_COLORS.green, grid: 'col-span-1 row-span-1' }, // User Mapping: Manutencao

    // ROW 5: PLANNING (Blue)
    { key: 'riscos', title: 'Riscos', color: PMC_COLORS.blue, grid: 'col-span-1 row-span-1' },
    { key: 'cronograma', title: 'Linha do Tempo', color: PMC_COLORS.blue, grid: 'col-span-1 row-span-1' },
    { key: 'custo', title: 'Custos', color: PMC_COLORS.blue, grid: 'col-span-1 row-span-1' }
];

export const ProjectModelCanvas: React.FC<Props> = ({ isOpen, onClose, solution }) => {
    // Local state to manage immediate UI updates before sync
    const [data, setData] = useState<any>(solution.pmcData || {});
    // We also need to keep track of the solution ID in case it changes or for the update call
    // but solution prop is enough.

    // Sync local state when solution prop updates (real-time from parent subscription)
    useEffect(() => {
        setData(solution.pmcData || {});
    }, [solution.pmcData]);

    if (!isOpen) return null;

    const handleAddItem = async (key: string) => {
        const text = window.prompt(`Adicionar item em ${key}:`);
        if (!text) return;

        const currentList = data[key] || [];
        const newList = [...currentList, text];

        // Optimistic UI
        const newData = { ...data, [key]: newList };
        setData(newData);

        try {
            await SolutionService.update(solution.id, { pmcData: newData });
            toast.success("Item adicionado!");
        } catch (error) {
            console.error(error);
            toast.error("Erro ao salvar.");
            // Revert changes if needed, but for now we rely on re-sync
        }
    };

    // MODAL STATE
    const [editModal, setEditModal] = useState<{ isOpen: boolean, key: string, index: number, text: string } | null>(null);

    const openEditModal = (key: string, index: number, text: string) => {
        setEditModal({ isOpen: true, key, index, text });
    };

    const closeEditModal = () => setEditModal(null);

    const saveEditModal = async () => {
        if (!editModal) return;
        const { key, index, text } = editModal;

        const currentList = data[key] || [];
        const newList = [...currentList];

        if (text.trim() === "") {
            newList.splice(index, 1); // Delete if empty
        } else {
            newList[index] = text;
        }

        const newData = { ...data, [key]: newList };
        setData(newData); // Optimistic

        try {
            await SolutionService.update(solution.id, { pmcData: newData });
            // toast.success("Item atualizado.");
        } catch (error) {
            console.error(error);
            toast.error("Erro ao salvar edição.");
        }
        closeEditModal();
    };

    const handleDeleteItem = async (key: string, index: number) => {
        if (!window.confirm("Remover este item?")) return;

        const currentList = data[key] || [];
        const newList = currentList.filter((_: any, i: number) => i !== index);

        const newData = { ...data, [key]: newList };
        setData(newData);

        try {
            await SolutionService.update(solution.id, { pmcData: newData });
            // toast.success("Item removido.");
        } catch (error) {
            console.error(error);
            toast.error("Erro ao remover.");
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white w-full h-full flex flex-col overflow-hidden">

                {/* HEADER */}
                <div className="bg-white px-6 py-3 border-b border-slate-200 flex justify-between items-center shadow-sm z-10">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                            <Layout className="text-blue-600" />
                            Project Model Canvas
                        </h2>
                        <p className="text-slate-500 text-xs">Planejamento Visual: <span className="font-bold text-blue-700">{solution.name}</span></p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* CANVAS GRID - FULLSCREEN NO SCROLL (Ideally) but we allow scroll if content overflows block height */}
                <div className="flex-1 p-2 bg-slate-50 overflow-hidden">
                    <div className="grid grid-cols-5 gap-2 h-full w-full">

                        {/* 1. WHY (Purple) */}
                        <div className="col-span-1 grid grid-rows-6 gap-2 h-full">
                            <div className="row-span-2"><PMCBlock block={BLOCKS.find(b => b.key === 'justificativas')!} items={data.justificativas} onAdd={() => handleAddItem('justificativas')} onEdit={(i) => openEditModal('justificativas', i, data.justificativas[i])} onDelete={(i) => handleDeleteItem('justificativas', i)} /></div>
                            <div className="row-span-2"><PMCBlock block={BLOCKS.find(b => b.key === 'objetivoSmart')!} items={data.objetivoSmart} onAdd={() => handleAddItem('objetivoSmart')} onEdit={(i) => openEditModal('objetivoSmart', i, data.objetivoSmart[i])} onDelete={(i) => handleDeleteItem('objetivoSmart', i)} /></div>
                            <div className="row-span-2"><PMCBlock block={BLOCKS.find(b => b.key === 'beneficios')!} items={data.beneficios} onAdd={() => handleAddItem('beneficios')} onEdit={(i) => openEditModal('beneficios', i, data.beneficios[i])} onDelete={(i) => handleDeleteItem('beneficios', i)} /></div>
                        </div>

                        {/* 2. WHAT (Yellow) */}
                        <div className="col-span-1 grid grid-rows-2 gap-2 h-full">
                            <div className="row-span-1"><PMCBlock block={BLOCKS.find(b => b.key === 'solucao')!} items={data.solucao} onAdd={() => handleAddItem('solucao')} onEdit={(i) => openEditModal('solucao', i, data.solucao[i])} onDelete={(i) => handleDeleteItem('solucao', i)} /></div>
                            <div className="row-span-1"><PMCBlock block={BLOCKS.find(b => b.key === 'requisitos')!} items={data.requisitos} onAdd={() => handleAddItem('requisitos')} onEdit={(i) => openEditModal('requisitos', i, data.requisitos[i])} onDelete={(i) => handleDeleteItem('requisitos', i)} /></div>
                        </div>

                        {/* 3. WHO (Orange) */}
                        <div className="col-span-1 grid grid-rows-2 gap-2 h-full">
                            <div className="row-span-1"><PMCBlock block={BLOCKS.find(b => b.key === 'stakeholders')!} items={data.stakeholders} onAdd={() => handleAddItem('stakeholders')} onEdit={(i) => openEditModal('stakeholders', i, data.stakeholders[i])} onDelete={(i) => handleDeleteItem('stakeholders', i)} /></div>
                            <div className="row-span-1"><PMCBlock block={BLOCKS.find(b => b.key === 'equipe')!} items={data.equipe} onAdd={() => handleAddItem('equipe')} onEdit={(i) => openEditModal('equipe', i, data.equipe[i])} onDelete={(i) => handleDeleteItem('equipe', i)} /></div>
                        </div>

                        {/* 4. HOW (Green) */}
                        <div className="col-span-1 grid grid-rows-3 gap-2 h-full">
                            <div className="row-span-1"><PMCBlock block={BLOCKS.find(b => b.key === 'premissas')!} items={data.premissas} onAdd={() => handleAddItem('premissas')} onEdit={(i) => openEditModal('premissas', i, data.premissas[i])} onDelete={(i) => handleDeleteItem('premissas', i)} /></div>
                            <div className="row-span-1"><PMCBlock block={BLOCKS.find(b => b.key === 'entregas')!} items={data.entregas} onAdd={() => handleAddItem('entregas')} onEdit={(i) => openEditModal('entregas', i, data.entregas[i])} onDelete={(i) => handleDeleteItem('entregas', i)} /></div>
                            <div className="row-span-1"><PMCBlock block={BLOCKS.find(b => b.key === 'manutencao')!} items={data.manutencao} onAdd={() => handleAddItem('manutencao')} onEdit={(i) => openEditModal('manutencao', i, data.manutencao[i])} onDelete={(i) => handleDeleteItem('manutencao', i)} /></div>
                        </div>

                        {/* 5. WHEN/HOW MUCH (Blue) */}
                        <div className="col-span-1 grid grid-rows-3 gap-2 h-full">
                            <div className="row-span-1"><PMCBlock block={BLOCKS.find(b => b.key === 'riscos')!} items={data.riscos} onAdd={() => handleAddItem('riscos')} onEdit={(i) => openEditModal('riscos', i, data.riscos[i])} onDelete={(i) => handleDeleteItem('riscos', i)} /></div>
                            <div className="row-span-1"><PMCBlock block={BLOCKS.find(b => b.key === 'cronograma')!} items={data.cronograma} onAdd={() => handleAddItem('cronograma')} onEdit={(i) => openEditModal('cronograma', i, data.cronograma[i])} onDelete={(i) => handleDeleteItem('cronograma', i)} /></div>
                            <div className="row-span-1"><PMCBlock block={BLOCKS.find(b => b.key === 'custo')!} items={data.custo} onAdd={() => handleAddItem('custo')} onEdit={(i) => openEditModal('custo', i, data.custo[i])} onDelete={(i) => handleDeleteItem('custo', i)} /></div>
                        </div>

                    </div>
                </div>

                {/* EDIT MODAL */}
                {editModal && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                        <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-lg">
                            <h3 className="text-lg font-bold mb-4 text-slate-800">Editar Post-it</h3>
                            <textarea
                                className="w-full h-32 p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none text-slate-700"
                                value={editModal.text}
                                onChange={(e) => setEditModal({ ...editModal, text: e.target.value })}
                                autoFocus
                            />
                            <div className="flex justify-end gap-3 mt-4">
                                <button
                                    onClick={closeEditModal}
                                    className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-100 rounded-lg transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={saveEditModal}
                                    className="px-4 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors"
                                >
                                    Salvar Alterações
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};


// SUB-COMPONENT FOR BLOCKS
const PMCBlock = ({ block, items = [], onAdd, onEdit, onDelete }: any) => {
    return (
        <div className={`h-full border rounded-xl shadow-sm flex flex-col ${block.color} transition-all hover:shadow-md`}>
            <div className={`p-2 border-b border-black/10 font-bold text-xs uppercase flex justify-between items-center bg-black/5`}>
                {block.title}
                <button onClick={onAdd} className="bg-white/50 hover:bg-white/80 p-0.5 rounded transition-colors">
                    <Plus size={12} />
                </button>
            </div>
            <div className="p-2 flex-1 flex flex-col gap-2 overflow-y-auto">
                {items.map((item: string, idx: number) => (
                    <div
                        key={idx}
                        className="bg-white p-2 rounded text-xs shadow-sm border border-black/5 cursor-pointer hover:ring-2 ring-blue-200 transition-all text-slate-700 break-words group relative"
                        onClick={() => onEdit(idx)}
                    >
                        {item}
                        <button
                            onClick={(e) => { e.stopPropagation(); onDelete(idx); }}
                            className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 p-0.5 bg-red-100 text-red-600 rounded-full transition-opacity"
                        >
                            <X size={10} />
                        </button>
                    </div>
                ))}
                {items.length === 0 && (
                    <div className="flex-1 flex items-center justify-center opacity-30">
                        <Plus size={24} />
                    </div>
                )}
            </div>
        </div>
    );
};
