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
    purple: 'bg-purple-50 border-purple-200 text-purple-900',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-900',
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

    const handleEditItem = async (key: string, index: number) => {
        const currentList = data[key] || [];
        const currentText = currentList[index];
        const newText = window.prompt("Editar item:", currentText);

        if (newText === null || newText === currentText) return;

        const newList = [...currentList];
        if (newText === "") {
            // Treat empty string as delete? Or just ignore? Let's ignore empty edits for safety, explicitly delete via X
        } else {
            newList[index] = newText;
        }

        const newData = { ...data, [key]: newList };
        setData(newData);

        try {
            await SolutionService.update(solution.id, { pmcData: newData });
            // No toast for edit to keep it fluid
        } catch (error) {
            toast.error("Erro ao editar.");
        }
    };

    const handleDeleteItem = async (key: string, index: number) => {
        if (!window.confirm("Remover este item?")) return;

        const currentList = data[key] || [];
        const newList = currentList.filter((_: any, i: number) => i !== index);

        const newData = { ...data, [key]: newList };
        setData(newData);

        try {
            await SolutionService.update(solution.id, { pmcData: newData });
            toast.success("Item removido.");
        } catch (error) {
            toast.error("Erro ao remover.");
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
            <div className="bg-white w-full h-full max-w-[95vw] max-h-[95vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">

                {/* HEADER */}
                <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                            <Layout className="text-blue-600" />
                            Project Model Canvas
                        </h2>
                        <p className="text-slate-500 text-sm">Planejamento Visual para: <span className="font-bold text-blue-700">{solution.name}</span></p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* CANVAS GRID - SCROLLABLE */}
                <div className="flex-1 overflow-y-auto p-6 bg-slate-100/50">
                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 min-h-[800px]">

                        {/* 
                            PMC LAYOUT STRATEGY: 
                            Standard PMC is 5 columns.
                            Col 1: Justificativas (Purple)
                            Col 2: Objetivos (Purple) + Beneficios (Purple)
                            Col 3: Produto (Yellow) + Requisitos (Yellow)
                            Col 4: Stakeholders (Orange) + Equipe (Orange)
                            Col 5: Premissas (Green) + Entregas (Green) + Riscos(Blue) etc...
                            
                            Adapting to User's Color Groups and 13 Blocks.
                            We will use a Masonry-like or defined Grid approach.
                            Let's try to group them visually by columns as per standard PMC logical flow:
                            WHY (Purple) -> WHAT (Yellow) -> WHO (Orange) -> HOW (Green/Blue) -> WHEN/HOW MUCH (Blue)
                        */}

                        {/* COLUMN 1: POR QUÊ? (Purple) */}
                        <div className="space-y-4">
                            <PMCBlock
                                block={BLOCKS.find(b => b.key === 'justificativas')!}
                                items={data.justificativas}
                                onAdd={() => handleAddItem('justificativas')}
                                onEdit={(i) => handleEditItem('justificativas', i)}
                                onDelete={(i) => handleDeleteItem('justificativas', i)}
                            />
                            <PMCBlock
                                block={BLOCKS.find(b => b.key === 'objetivoSmart')!}
                                items={data.objetivoSmart}
                                onAdd={() => handleAddItem('objetivoSmart')}
                                onEdit={(i) => handleEditItem('objetivoSmart', i)}
                                onDelete={(i) => handleDeleteItem('objetivoSmart', i)}
                            />
                            <PMCBlock
                                block={BLOCKS.find(b => b.key === 'beneficios')!}
                                items={data.beneficios}
                                onAdd={() => handleAddItem('beneficios')}
                                onEdit={(i) => handleEditItem('beneficios', i)}
                                onDelete={(i) => handleDeleteItem('beneficios', i)}
                            />
                        </div>

                        {/* COLUMN 2: O QUÊ? (Yellow) */}
                        <div className="space-y-4">
                            <PMCBlock
                                block={BLOCKS.find(b => b.key === 'solucao')!}
                                items={data.solucao}
                                onAdd={() => handleAddItem('solucao')}
                                onEdit={(i) => handleEditItem('solucao', i)}
                                onDelete={(i) => handleDeleteItem('solucao', i)}
                            />
                            <PMCBlock
                                block={BLOCKS.find(b => b.key === 'requisitos')!}
                                items={data.requisitos}
                                onAdd={() => handleAddItem('requisitos')}
                                onEdit={(i) => handleEditItem('requisitos', i)}
                                onDelete={(i) => handleDeleteItem('requisitos', i)}
                            />
                        </div>

                        {/* COLUMN 3: QUEM? (Orange) */}
                        <div className="space-y-4">
                            <PMCBlock
                                block={BLOCKS.find(b => b.key === 'stakeholders')!}
                                items={data.stakeholders}
                                onAdd={() => handleAddItem('stakeholders')}
                                onEdit={(i) => handleEditItem('stakeholders', i)}
                                onDelete={(i) => handleDeleteItem('stakeholders', i)}
                            />
                            <PMCBlock
                                block={BLOCKS.find(b => b.key === 'equipe')!}
                                items={data.equipe}
                                onAdd={() => handleAddItem('equipe')}
                                onEdit={(i) => handleEditItem('equipe', i)}
                                onDelete={(i) => handleDeleteItem('equipe', i)}
                            />
                        </div>

                        {/* COLUMN 4: COMO? (Green) */}
                        <div className="space-y-4">
                            <PMCBlock
                                block={BLOCKS.find(b => b.key === 'premissas')!}
                                items={data.premissas}
                                onAdd={() => handleAddItem('premissas')}
                                onEdit={(i) => handleEditItem('premissas', i)}
                                onDelete={(i) => handleDeleteItem('premissas', i)}
                            />
                            <PMCBlock
                                block={BLOCKS.find(b => b.key === 'entregas')!}
                                items={data.entregas}
                                onAdd={() => handleAddItem('entregas')}
                                onEdit={(i) => handleEditItem('entregas', i)}
                                onDelete={(i) => handleDeleteItem('entregas', i)}
                            />
                            <PMCBlock
                                block={BLOCKS.find(b => b.key === 'manutencao')!}
                                items={data.manutencao}
                                onAdd={() => handleAddItem('manutencao')}
                                onEdit={(i) => handleEditItem('manutencao', i)}
                                onDelete={(i) => handleDeleteItem('manutencao', i)}
                            />
                        </div>

                        {/* COLUMN 5: QUANDO E QUANTO? (Blue) */}
                        <div className="space-y-4">
                            <PMCBlock
                                block={BLOCKS.find(b => b.key === 'riscos')!}
                                items={data.riscos}
                                onAdd={() => handleAddItem('riscos')}
                                onEdit={(i) => handleEditItem('riscos', i)}
                                onDelete={(i) => handleDeleteItem('riscos', i)}
                            />
                            <PMCBlock
                                block={BLOCKS.find(b => b.key === 'cronograma')!}
                                items={data.cronograma}
                                onAdd={() => handleAddItem('cronograma')}
                                onEdit={(i) => handleEditItem('cronograma', i)}
                                onDelete={(i) => handleDeleteItem('cronograma', i)}
                            />
                            <PMCBlock
                                block={BLOCKS.find(b => b.key === 'custo')!}
                                items={data.custo}
                                onAdd={() => handleAddItem('custo')}
                                onEdit={(i) => handleEditItem('custo', i)}
                                onDelete={(i) => handleDeleteItem('custo', i)}
                            />
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
};

// SUB-COMPONENT FOR BLOCKS
const PMCBlock = ({ block, items = [], onAdd, onEdit, onDelete }: any) => {
    return (
        <div className={`h-full border rounded-xl shadow-sm flex flex-col ${block.color} transition-all hover:shadow-md`}>
            <div className={`p-3 border-b border-black/5 font-bold text-sm uppercase flex justify-between items-center`}>
                {block.title}
                <button onClick={onAdd} className="bg-white/50 hover:bg-white/80 p-1 rounded-md transition-colors">
                    <Plus size={14} />
                </button>
            </div>
            <div className="p-3 flex-1 flex flex-col gap-2 min-h-[150px]">
                {items.map((item: string, idx: number) => (
                    <div
                        key={idx}
                        className="bg-white p-2 rounded text-sm shadow-sm border border-black/5 cursor-pointer group relative hover:ring-2 ring-blue-200 transition-all text-slate-700"
                        onClick={() => onEdit(idx)}
                    >
                        {item}
                        <button
                            onClick={(e) => { e.stopPropagation(); onDelete(idx); }}
                            className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity shadow"
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
