import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Calendar, Check, AlertCircle } from 'lucide-react';
import { KPI } from '../types';

interface KPIUpdateModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (value: number, date: Date) => Promise<void>;
    kpi: KPI;
}

export const KPIUpdateModal: React.FC<KPIUpdateModalProps> = ({ isOpen, onClose, onSave, kpi }) => {
    const [value, setValue] = useState<string>('');
    const [date, setDate] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            setValue('');
            // Default to today's date formatted as YYYY-MM-DD
            setDate(new Date().toISOString().split('T')[0]);
            setError(null);
            setLoading(false);
        }
    }, [isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!value || !date) {
            setError("Por favor, preencha o valor e a data.");
            return;
        }

        const numValue = parseFloat(value.replace(',', '.'));
        if (isNaN(numValue)) {
            setError("O valor inserido não é válido.");
            return;
        }

        try {
            setLoading(true);
            const dateObj = new Date(date);
            // Adjust for timezone offset if needed, but YYYY-MM-DD usually parses to UTC in some contexts or local in others.
            // new Date('2023-01-01') is UTC, new Date('2023-01-01T00:00') is local.
            // Let's ensure we treat it as local day start or noon to avoid timezone shifts jumping days.
            const localDate = new Date(date + 'T12:00:00');

            await onSave(numValue, localDate);
            onClose();
        } catch (err) {
            console.error(err);
            setError("Erro ao salvar atualização.");
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-white/90 backdrop-blur-md border border-white/20 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
                >
                    <div className="p-6 border-b border-slate-200/50 flex justify-between items-center bg-white/50">
                        <div>
                            <h3 className="text-xl font-bold text-slate-800">Atualizar Indicador</h3>
                            <p className="text-sm text-slate-500 mt-1">{kpi?.name}</p>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors">
                            <X size={20} />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="p-6 space-y-4">
                        {error && (
                            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm flex items-center gap-2">
                                <AlertCircle size={16} />
                                {error}
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-slate-700">Novo Valor Realizado</label>
                            <div className="relative">
                                <input
                                    type="text" // Text to allow easy decimal input
                                    value={value}
                                    onChange={(e) => setValue(e.target.value)}
                                    placeholder="0.00"
                                    className="w-full pl-4 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-lg font-mono font-medium text-slate-800"
                                    autoFocus
                                />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">
                                    {kpi?.unit}
                                </span>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-slate-700">Data de Referência</label>
                            <div className="relative">
                                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                <input
                                    type="date"
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                    className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-slate-800"
                                    required
                                />
                            </div>
                            <p className="text-xs text-slate-500 pl-1">A data que este valor representa.</p>
                        </div>

                        <div className="pt-4 flex gap-3">
                            <button
                                type="button"
                                onClick={onClose}
                                className="flex-1 py-3 px-4 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className="flex-1 py-3 px-4 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {loading ? 'Salvando...' : (
                                    <>
                                        <Check size={18} />
                                        Confirmar
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};
