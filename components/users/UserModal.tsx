import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import { User, SystemRole } from '../../types/auth';

interface UserModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: Omit<User, 'id'>) => void;
    userToEdit?: User | null;
}

export const UserModal: React.FC<UserModalProps> = ({ isOpen, onClose, onSave, userToEdit }) => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [role, setRole] = useState('');
    const [systemRole, setSystemRole] = useState<SystemRole>('VIEWER');

    useEffect(() => {
        if (userToEdit) {
            setName(userToEdit.name);
            setEmail(userToEdit.email);
            setRole(userToEdit.role);
            setSystemRole(userToEdit.systemRole);
        } else {
            // Reset for creation
            setName('');
            setEmail('');
            setRole('');
            setSystemRole('VIEWER');
        }
    }, [userToEdit, isOpen]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({
            name,
            email,
            role,
            systemRole,
            // Preserve existing avatar if editing, else undefined (let context handle default)
            avatarUrl: userToEdit?.avatarUrl
        });
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            />

            {/* Modal Content */}
            <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                    <h2 className="text-lg font-semibold text-slate-800">
                        {userToEdit ? 'Editar Usuário' : 'Novo Usuário'}
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-1 rounded-full hover:bg-slate-200 text-slate-500 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">

                    {/* Name */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Nome Completo</label>
                        <input
                            type="text"
                            required
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                            placeholder="Ex: Ana Silva"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                    </div>

                    {/* Email */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">E-mail Corporativo</label>
                        <input
                            type="email"
                            required
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                            placeholder="usuario@grupodr.com.br"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>

                    {/* Job Title */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Cargo / Função</label>
                        <input
                            type="text"
                            required
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                            placeholder="Ex: Analista Comercial"
                            value={role}
                            onChange={(e) => setRole(e.target.value)}
                        />
                    </div>

                    {/* System Role */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Nível de Acesso</label>
                        <select
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white"
                            value={systemRole}
                            onChange={(e) => setSystemRole(e.target.value as SystemRole)}
                        >
                            <option value="VIEWER">Visualizador (Apenas Leitura)</option>
                            <option value="EDITOR">Editor (Pode alterar dados)</option>
                            <option value="ADMIN">Administrador (Acesso Total)</option>
                        </select>
                        <p className="text-xs text-slate-500 mt-1">
                            {systemRole === 'ADMIN' && '⚠️ Acesso total ao sistema, incluindo configurações.'}
                            {systemRole === 'EDITOR' && 'ℹ️ Pode gerenciar pipeline, tarefas e propostas.'}
                            {systemRole === 'VIEWER' && '👀 Apenas visualiza dashboards e relatórios.'}
                        </p>
                    </div>

                    {/* Footer Actions */}
                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 mt-6">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm hover:shadow flex items-center gap-2 transition-all"
                        >
                            <Save className="w-4 h-4" />
                            Salvar
                        </button>
                    </div>

                </form>
            </div>
        </div>
    );
};
