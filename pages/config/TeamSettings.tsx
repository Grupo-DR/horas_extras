import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { User } from '../../types/auth';
import { UserModal } from '../../components/users/UserModal';
import { Plus, Edit, Trash2, Shield, Users } from 'lucide-react';
import { toast } from 'sonner';

export const TeamSettings: React.FC = () => {
    const { users, currentUser, removeUser, addUser, updateUser } = useAuth() as any; // Cast to access new methods if TS complains due to context pending update in IDE, but runtime is fine.
    // Actually, I should use the real interface.
    // Let's re-import and rely on the updated context type, hopefully TS picks it up.
    // If not, I'll just use the props that I know exist.

    // Correction: I should access `user` (logged in) from useAuth.
    // Let's rename for clarity in this component.
    const { user: loggedUser, users: allUsers, removeUser: deleteUserCtx, addUser: addUserCtx, updateUser: updateUserCtx } = useAuth();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);

    const handleEdit = (user: User) => {
        setEditingUser(user);
        setIsModalOpen(true);
    };

    const handleDelete = (id: string, name: string) => {
        if (window.confirm(`Tem certeza que deseja remover o usuário ${name}?`)) {
            deleteUserCtx(id);
        }
    };

    const handleSave = (userData: Omit<User, 'id'>) => {
        if (editingUser) {
            updateUserCtx(editingUser.id, userData);
        } else {
            addUserCtx(userData);
        }
    };

    const openNewUserModal = () => {
        setEditingUser(null);
        setIsModalOpen(true);
    };

    const getRoleBadgeColor = (role: string) => {
        switch (role) {
            case 'ADMIN': return 'bg-indigo-100 text-indigo-700 border-indigo-200';
            case 'EDITOR': return 'bg-blue-100 text-blue-700 border-blue-200';
            case 'VIEWER': return 'bg-slate-100 text-slate-700 border-slate-200';
            default: return 'bg-gray-100 text-gray-700';
        }
    };

    return (
        <div className="p-8 max-w-7xl mx-auto">

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Users className="w-6 h-6 text-blue-600" />
                        Gestão de Equipe
                    </h1>
                    <p className="text-slate-500 mt-1">Gerencie os usuários e níveis de acesso do portal.</p>
                </div>

                <button
                    onClick={openNewUserModal}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg shadow-sm hover:shadow transition-all font-medium"
                >
                    <Plus className="w-5 h-5" />
                    Novo Usuário
                </button>
            </div>

            {/* Table Container */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Usuário</th>
                                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Cargo</th>
                                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Nível de Acesso</th>
                                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {allUsers.map((u: User) => (
                                <tr key={u.id} className="hover:bg-slate-50/50 transition-colors group">

                                    {/* User Info */}
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-3">
                                            <img
                                                src={u.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}`}
                                                alt={u.name}
                                                className="w-10 h-10 rounded-full border border-slate-200"
                                            />
                                            <div>
                                                <div className="font-medium text-slate-900">{u.name}</div>
                                                <div className="text-sm text-slate-500">{u.email}</div>
                                            </div>
                                        </div>
                                    </td>

                                    {/* Role */}
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className="text-sm text-slate-700">{u.role}</span>
                                    </td>

                                    {/* System Role Badge */}
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getRoleBadgeColor(u.systemRole)}`}>
                                            {u.systemRole === 'ADMIN' && <Shield className="w-3 h-3 mr-1" />}
                                            {u.systemRole}
                                        </span>
                                    </td>

                                    {/* Actions */}
                                    <td className="px-6 py-4 whitespace-nowrap text-right">
                                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => handleEdit(u)}
                                                className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                title="Editar"
                                            >
                                                <Edit className="w-5 h-5" />
                                            </button>

                                            {/* Prevent deleting self */}
                                            {loggedUser?.id !== u.id && (
                                                <button
                                                    onClick={() => handleDelete(u.id, u.name)}
                                                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                    title="Excluir"
                                                >
                                                    <Trash2 className="w-5 h-5" />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Empty State */}
                {allUsers.length === 0 && (
                    <div className="p-12 text-center text-slate-500">
                        Nenhum usuário encontrado.
                    </div>
                )}
            </div>

            {/* Use Modal */}
            <UserModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSave}
                userToEdit={editingUser}
            />
        </div>
    );
};
