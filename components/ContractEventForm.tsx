import React, { useState } from 'react';
import { X, Save, AlertTriangle, Calendar, DollarSign, Clock } from 'lucide-react';
import { ContractEventType, ContractEvent } from '../types';
import { formatDateForInput, safeDateParse } from '../utils/dateUtils';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSave: (event: Omit<ContractEvent, 'id' | 'createdAt' | 'createdBy' | 'contractId'>) => Promise<void>;
}

export const ContractEventForm: React.FC<Props> = ({ isOpen, onClose, onSave }) => {
    const [loading, setLoading] = useState(false);
    const [eventType, setEventType] = useState<ContractEventType>(ContractEventType.ADITIVO_VALOR);

    // Form fields
    const [dateStr, setDateStr] = useState(formatDateForInput(new Date()));
    const [valueDelta, setValueDelta] = useState<number>(0);
    const [termDelta, setTermDelta] = useState<number>(0);
    const [description, setDescription] = useState('');

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            await onSave({
                type: eventType,
                date: safeDateParse(dateStr) || new Date(),
                valueDelta: Number(valueDelta),
                termDeltaDays: Number(termDelta),
                description
            });
            onClose();
        } catch (error) {
            console.error(error);
            alert("Erro ao salvar evento.");
        } finally {
            setLoading(false);
        }
    };

    const isValueType = [ContractEventType.ADITIVO_VALOR, ContractEventType.ADITIVO_MISTO, ContractEventType.REAJUSTE].includes(eventType);
    const isTermType = [ContractEventType.ADITIVO_PRAZO, ContractEventType.ADITIVO_MISTO].includes(eventType);

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-amber-50">
                    <h3 className="font-bold text-amber-800 text-lg flex items-center gap-2">
                        <AlertTriangle size={20} />
                        Registrar Evento Contratual
                    </h3>
                    <button onClick={onClose} className="text-amber-400 hover:text-amber-600 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">

                    {/* TYPE SELECTION */}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Tipo de Evento</label>
                        <div className="grid grid-cols-2 gap-2">
                            {Object.values(ContractEventType).map(t => (
                                <button
                                    key={t}
                                    type="button"
                                    onClick={() => {
                                        setEventType(t);
                                        // Reset fields based on type? Optional.
                                        if (t === ContractEventType.ADITIVO_PRAZO) setValueDelta(0);
                                        if (t === ContractEventType.ADITIVO_VALOR || t === ContractEventType.REAJUSTE) setTermDelta(0);
                                    }}
                                    className={`px-3 py-2 text-xs font-bold rounded-lg border transition-all ${eventType === t
                                            ? 'bg-amber-100 text-amber-700 border-amber-300 ring-2 ring-amber-500/20'
                                            : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                                        }`}
                                >
                                    {t.replace('ADITIVO_', 'ADIT. ')}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* DATE */}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Data de Referência</label>
                        <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <input
                                type="date"
                                required
                                value={dateStr}
                                onChange={e => setDateStr(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                            />
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1">Data da assinatura do aditivo ou reajuste.</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {/* VALUE DELTA */}
                        <div className={!isValueType ? 'opacity-50 pointer-events-none grayscale' : ''}>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Impacto Financeiro (R$)</label>
                            <div className="relative">
                                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                <input
                                    type="number"
                                    step="0.01"
                                    value={valueDelta}
                                    onChange={e => setValueDelta(parseFloat(e.target.value))} // Allow negatives
                                    className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none font-mono"
                                    placeholder="0.00"
                                />
                            </div>
                        </div>

                        {/* TERM DELTA */}
                        <div className={!isTermType ? 'opacity-50 pointer-events-none grayscale' : ''}>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Impacto de Prazo (Dias)</label>
                            <div className="relative">
                                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                <input
                                    type="number"
                                    step="1"
                                    value={termDelta}
                                    onChange={e => setTermDelta(parseFloat(e.target.value))}
                                    className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none font-mono"
                                    placeholder="0"
                                />
                            </div>
                        </div>
                    </div>

                    {/* DESCRIPTION */}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Descrição / Justificativa</label>
                        <textarea
                            required
                            rows={3}
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none resize-none"
                            placeholder="Ex: Aditivo referente a serviços extras de terraplanagem..."
                        />
                    </div>

                    <div className="flex justify-end pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-slate-500 font-bold hover:bg-slate-100 rounded-lg mr-2 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-6 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg flex items-center gap-2 transition-colors shadow-lg shadow-amber-500/20"
                        >
                            {loading ? 'Salvando...' : <><Save size={18} /> Registrar Evento</>}
                        </button>
                    </div>

                </form>
            </div>
        </div>
    );
};
