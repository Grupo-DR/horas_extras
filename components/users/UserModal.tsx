import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import { User, SystemRole, ModuleAccess, AccessLevel, DEFAULT_MODULE_ACCESS, ModuleKey } from '../../types/auth'; // Updated imports

interface UserModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: Omit<User, 'id'>, initialPassword?: string) => void; // Updated signature
    userToEdit?: User | null;
}

export const UserModal: React.FC<UserModalProps> = ({ isOpen, onClose, onSave, userToEdit }) => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [role, setRole] = useState('');
    const [systemRole, setSystemRole] = useState<SystemRole>('VIEWER');
    const [tempPassword, setTempPassword] = useState(''); // New State
    const [permissions, setPermissions] = useState<ModuleAccess>(DEFAULT_MODULE_ACCESS); // New State

    useEffect(() => {
        if (userToEdit) {
            setName(userToEdit.name);
            setEmail(userToEdit.email);
            setRole(userToEdit.role);
            setSystemRole(userToEdit.systemRole);
            setPermissions(userToEdit.permissions || DEFAULT_MODULE_ACCESS);
            setTempPassword('');
        } else {
            // Reset for creation
            setName('');
            setEmail('');
            setRole('');
            setSystemRole('VIEWER');
            setPermissions(DEFAULT_MODULE_ACCESS);
            setTempPassword('');
        }
    }, [userToEdit, isOpen]);

    const handlePermissionChange = (module: ModuleKey, level: AccessLevel) => {
        setPermissions(prev => ({ ...prev, [module]: level }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({
            name,
            email,
            role,
            systemRole,
            permissions: systemRole === 'ADMIN' ? DEFAULT_MODULE_ACCESS : permissions, // Admin gets all anyway, but keep clean
            // Preserve existing avatar if editing, else undefined (let context handle default)
            avatarUrl: userToEdit?.avatarUrl
        }, tempPassword);
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
                            {systemRole === 'ADMIN' && '⚠️ Acesso total ao sistema, incluindo configurações e todos os módulos.'}
                            {systemRole === 'EDITOR' && 'ℹ️ Pode gerenciar pipeline, tarefas e propostas, mas acesso aos módulos depende das permissões abaixo.'}
                            {systemRole === 'VIEWER' && '👀 Apenas visualiza os módulos permitidos.'}
                        </p>
                    </div>

                    {/* Password - Only for new users */}
                    {!userToEdit && (
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Senha Inicial</label>
                            <input
                                type="password"
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                placeholder="Defina uma senha inicial (min. 6 caracteres)"
                                value={tempPassword}
                                onChange={(e) => setTempPassword(e.target.value)}
                            />
                            <p className="text-xs text-slate-500 mt-1">O usuário será forçado a trocar esta senha no primeiro login.</p>
                        </div>
                    )}

                    {/* Permissions Matrix - Hide if ADMIN */}
                    {systemRole !== 'ADMIN' && (
                        <div className="pt-2">
                            <label className="block text-sm font-medium text-slate-700 mb-2">Permissões por Módulo</label>
                            <div className="space-y-2 bg-slate-50 p-3 rounded-lg border border-slate-100">
                                {Object.keys(DEFAULT_MODULE_ACCESS).map((key) => {
                                    const mKey = key as ModuleKey;
                                    return (
                                        <div key={mKey} className="flex items-center justify-between">
                                            <span className="text-sm text-slate-600 capitalize">{mKey.replace('_', ' ')}</span>
                                            <select
                                                className="text-sm border-slate-200 rounded px-2 py-1"
                                                value={permissions[mKey]}
                                                onChange={(e) => handlePermissionChange(mKey, e.target.value as AccessLevel)}
                                            >
                                                <option value="NONE">Sem Acesso</option>
                                                <option value="VIEW">Visualizar</option>
                                                <option value="EDIT">Editar</option>
                                            </select>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}

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
