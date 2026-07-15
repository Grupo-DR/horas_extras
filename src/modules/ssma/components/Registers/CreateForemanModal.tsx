import React, { useState } from 'react';
import { X, UserPlus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '../../../../../services/firebaseConfig';

interface CreateForemanModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export const CreateForemanModal: React.FC<CreateForemanModalProps> = ({ isOpen, onClose, onSuccess }) => {
    const [name, setName] = useState('');
    const [cpf, setCpf] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    const formatCpf = (value: string) => {
        const v = value.replace(/\D/g, '');
        return v.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    };

    const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value.replace(/\D/g, '');
        if (val.length <= 11) {
            setCpf(formatCpf(val));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const cleanCpf = cpf.replace(/\D/g, '');
        
        if (!name.trim()) return toast.warning('Preencha o nome do encarregado.');
        if (cleanCpf.length !== 11) return toast.warning('CPF inválido.');
        if (password.length < 6) return toast.warning('A senha deve ter no mínimo 6 caracteres.');

        try {
            setLoading(true);
            const functions = getFunctions(app, 'us-central1');
            const createForeman = httpsCallable(functions, 'ssmaCreateForemanAccount');
            
            await createForeman({
                name: name.trim(),
                cpf: cleanCpf,
                password: password
            });

            toast.success('Encarregado cadastrado com sucesso!');
            onSuccess();
            onClose();
        } catch (error: any) {
            console.error(error);
            toast.error(error.message || 'Erro ao cadastrar encarregado.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between p-4 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                            <UserPlus className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-800 leading-tight">Novo Encarregado</h2>
                            <p className="text-xs text-slate-500 font-medium">Cadastrar acesso ao app de inspeção</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                            Nome Completo
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="Ex: João da Silva"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                            autoFocus
                        />
                    </div>
                    
                    <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                            CPF (Usuário)
                        </label>
                        <input
                            type="text"
                            value={cpf}
                            onChange={handleCpfChange}
                            placeholder="000.000.000-00"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-mono"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                            Senha
                        </label>
                        <input
                            type="text"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            placeholder="Mínimo 6 caracteres"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-mono"
                        />
                    </div>

                    <div className="pt-4 flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2.5 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 px-4 py-2.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Cadastrar'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
