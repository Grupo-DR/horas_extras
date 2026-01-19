
import React from 'react';
import { Bid, PipelineStage } from '../../types';
import { BidCard } from './BidCard';

interface PipelineColumnProps {
    stage: PipelineStage;
    bids: Bid[];
    onDrop: (e: React.DragEvent, stage: PipelineStage) => void;
    onDragOver: (e: React.DragEvent) => void;
    onCardClick: (id: string) => void;
    onDelete: (id: string) => void;
}

export const PipelineColumn: React.FC<PipelineColumnProps> = ({
    stage,
    bids,
    onDrop,
    onDragOver,
    onCardClick,
    onDelete
}) => {
    const totalValue = bids.reduce((sum, op) => sum + (op.estimatedValue || 0), 0);

    // Helper to get formatted stage name
    const formatStageName = (stage: string) => {
        return stage.replace(/_/g, ' ');
    };

    return (
        <div
            className="flex-shrink-0 w-80 flex flex-col h-full bg-slate-50/50 rounded-xl border border-slate-200/60"
            onDrop={(e) => onDrop(e, stage)}
            onDragOver={onDragOver}
        >
            {/* Header */}
            <div className="p-3 border-b border-slate-100 flex flex-col gap-1">
                <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-slate-700 text-sm uppercase tracking-wide">
                        {formatStageName(stage)}
                    </h3>
                    <span className="bg-slate-200 text-slate-600 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                        {bids.length}
                    </span>
                </div>
                <div className="text-right">
                    <span className="text-xs font-bold text-emerald-600">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(totalValue)}
                    </span>
                </div>
            </div>

            {/* Cards Container */}
            <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-[150px]">
                {bids.map((op) => (
                    <BidCard
                        key={op.id}
                        bid={op}
                        onDragStart={(e, id) => e.dataTransfer.setData('bidId', id)}
                        onClick={onCardClick}
                        onDelete={onDelete}
                    />
                ))}

                {bids.length === 0 && (
                    <div className="h-full flex items-center justify-center text-slate-300 text-xs italic border-2 border-dashed border-slate-100 rounded-lg">
                        Arraste aqui
                    </div>
                )}
            </div>
        </div>
    );
};
