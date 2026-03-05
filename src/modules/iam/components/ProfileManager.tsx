
import React, { useState, useEffect } from 'react';
import { UserProfileDoc, CHRole, CommercialRole, Scope, ScopeType, ConstructionRole, canManageProfiles } from '../types';
import { getAllProfiles, updateUserRoles, createUserProfile } from '../profileService';
import { useAuth } from '@/contexts/AuthContext';
import { Users, Search, Edit2, Shield, AlertTriangle, Save, X, Building2, MapPin, Plus, HardHat, KeyRound, Ban, CheckCircle2, Trash2, Copy, ExternalLink, Check } from 'lucide-react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getAuth, sendPasswordResetEmail } from 'firebase/auth';
import { app } from '@/services/firebaseConfig';

const ProfileManager: React.FC = () => {
    const { profile } = useAuth();
    const [users, setUsers] = useState<UserProfileDoc[]>([]);
    const [filteredUsers, setFilteredUsers] = useState<UserProfileDoc[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [editingUser, setEditingUser] = useState<UserProfileDoc | null>(null);
    const [saving, setSaving] = useState(false);

    // Manual Add State
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [newUserUid, setNewUserUid] = useState('');
    const [newUserEmail, setNewUserEmail] = useState('');
    const [newUserName, setNewUserName] = useState('');
    const [creatingUser, setCreatingUser] = useState(false);
    const [linkModal, setLinkModal] = useState<{ isOpen: boolean; link: string; title: string }>({
        isOpen: false,
        link: '',
        title: ''
    });

    useEffect(() => {
        loadUsers();
    }, []);

    useEffect(() => {
        if (!searchTerm) {
            setFilteredUsers(users.filter(u => !u.isSuperAdmin));
        } else {
            const lower = searchTerm.toLowerCase();
            setFilteredUsers(users.filter(u =>
                (!u.isSuperAdmin) && (
                    u.email.toLowerCase().includes(lower) ||
                    u.displayName.toLowerCase().includes(lower) ||
                    (u.jobTitle && u.jobTitle.toLowerCase().includes(lower))
                )
            ));
        }
    }, [searchTerm, users]);

    const loadUsers = async () => {
        setLoading(true);
        try {
            const data = await getAllProfiles();
            setUsers(data);
            setFilteredUsers(data);
        } catch (err) {
            setError("Erro ao carregar usuários.");
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (user: UserProfileDoc) => {
        setEditingUser(JSON.parse(JSON.stringify(user))); // Deep copy
    };

    const handleSave = async () => {
        if (!editingUser) return;
        setSaving(true);
        try {
            // Extract module configs
            const commercial = editingUser.modules.commercial ? {
                enabled: editingUser.modules.commercial.enabled,
                role: editingUser.modules.commercial.role
            } : undefined;

            const hc = editingUser.modules.human_capital ? {
                enabled: editingUser.modules.human_capital.enabled,
                role: editingUser.modules.human_capital.role,
                scope: editingUser.modules.human_capital.scope
            } : undefined;

            const construction = editingUser.modules.construction ? {
                enabled: editingUser.modules.construction.enabled,
                role: editingUser.modules.construction.role
            } : undefined;

            await updateUserRoles(editingUser.uid, {
                commercial,
                human_capital: hc,
                construction
            });

            // Update local state
            setUsers(prev => prev.map(u => u.uid === editingUser.uid ? editingUser : u));
            setEditingUser(null);
            alert("Perfil atualizado com sucesso!");
        } catch (err) {
            alert("Erro ao salvar perfil.");
            console.error(err);
        } finally {
            setSaving(false);
        }
    };

    const handleCreateUser = async () => {
        if (!newUserEmail || !newUserName) {
            alert("Preencha E-mail e Nome.");
            return;
        }
        setCreatingUser(true);
        try {
            const functions = getFunctions(app, 'us-central1');
            const inviteUser = httpsCallable(functions, 'adminCreateUserInvite');
            const result = await inviteUser({ email: newUserEmail, displayName: newUserName });
            const link = (result.data as any).passwordResetLink; // Manual link fallback

            try {
                const authInstance = getAuth();
                await sendPasswordResetEmail(authInstance, newUserEmail, {
                    url: "https://gdr-nexus.netlify.app/config/account",
                    handleCodeInApp: false,
                });
                alert(`Usuário convidado com sucesso!\n\nUm e-mail de definição de senha foi enviado automaticamente para: ${newUserEmail}`);
            } catch (emailError: any) {
                console.error("Failed to send reset email natively", emailError);
                setLinkModal({
                    isOpen: true,
                    title: "Convite Criado (Envio de E-mail Falhou)",
                    link: link
                });
            }

            setIsAddModalOpen(false);
            setNewUserUid('');
            setNewUserEmail('');
            setNewUserName('');
            loadUsers(); // Refresh list
        } catch (error: any) {
            alert("Erro ao criar usuário: " + error.message);
        } finally {
            setCreatingUser(false);
        }
    };

    const handleAdminAction = async (action: 'disable' | 'enable' | 'delete' | 'reset-password', userDoc: UserProfileDoc) => {
        const functions = getFunctions(app, 'us-central1');
        try {
            if (action === 'disable') {
                if (!window.confirm(`Desativar o acesso de ${userDoc.displayName}? O usuário será desconectado imediatamente.`)) return;
                const disableUser = httpsCallable(functions, 'adminDisableUser');
                await disableUser({ uid: userDoc.uid, reason: 'Desativado pelo admin via painel' });
                alert('Usuário desativado com sucesso.');
            } else if (action === 'enable') {
                if (!window.confirm(`Reativar o acesso de ${userDoc.displayName}?`)) return;
                const enableUser = httpsCallable(functions, 'adminEnableUser');
                await enableUser({ uid: userDoc.uid });
                alert('Usuário reativado com sucesso.');
            } else if (action === 'delete') {
                if (!window.confirm(`ATENÇÃO: Excluir PERMANENTEMENTE o usuário ${userDoc.displayName}?\n\nEsta ação apagará a conta do Firebase Auth e o perfil de acessos irreparavelmente.`)) return;
                const deleteUser = httpsCallable(functions, 'adminDeleteUser');
                await deleteUser({ uid: userDoc.uid });
                alert('Usuário excluído permanentemente.');
            } else if (action === 'reset-password') {
                if (!window.confirm(`Gerar link de redefinição de senha para ${userDoc.displayName}?`)) return;
                const resetPassword = httpsCallable(functions, 'adminGeneratePasswordResetLink');
                const result = await resetPassword({ email: userDoc.email });
                const link = (result.data as any).link;
                setLinkModal({
                    isOpen: true,
                    title: "Link de Redefinição Gerado",
                    link: link
                });
            }
            loadUsers();
        } catch (error: any) {
            console.error(error);
            alert(`Erro ao executar a ação: ${error.message}`);
        }
    };

    if (loading) return <div className="p-10 flex check-center"><div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full"></div></div>;

    // Check access (Extra safety, though parent should handle)
    const canManage = canManageProfiles(profile);
    if (!canManage) return <div className="p-10 text-red-600 font-bold">Acesso negado.</div>;

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div>
                    <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        <Users className="text-blue-600" /> Gestão de Acessos (IAM)
                    </h2>
                    <p className="text-sm text-gray-500">Gerencie permissões e escopos dos usuários</p>
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                    <div className="relative flex-1 md:w-auto">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="Buscar usuário..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 pr-4 py-2 border rounded-xl w-full md:w-64 focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>

                    {profile?.isSuperAdmin && (
                        <button
                            onClick={async () => {
                                if (window.confirm('Executar backfill de usuários legados?\n\nIsso definirá status "active" e removerá "mustChangePassword" de todos que já existiam, além de garantir privilégios de Super Admin para seu e-mail.\n\nRode apenas 1x após implantar o novo IAM.')) {
                                    try {
                                        const functions = getFunctions(app, 'us-central1');
                                        const backfill = httpsCallable(functions, 'adminBackfillUserProfiles');
                                        const res = await backfill();
                                        alert('Script de backfill concluído com sucesso:\n\n' + (res.data as any).message);
                                        loadUsers();
                                    } catch (e: any) {
                                        alert('Erro no script de backfill: ' + e.message);
                                    }
                                }
                            }}
                            title="Recurso temporário para transição do banco"
                            className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors"
                        >
                            <AlertTriangle size={16} /> Backfill
                        </button>
                    )}

                    <button
                        onClick={() => setIsAddModalOpen(true)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors"
                    >
                        <Plus size={16} /> Adicionar
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 border-b border-gray-100 text-gray-500 font-medium uppercase text-xs">
                        <tr>
                            <th className="px-6 py-4">Usuário</th>
                            <th className="px-6 py-4">Comercial</th>
                            <th className="px-6 py-4">Capital Humano</th>
                            <th className="px-6 py-4">Obras</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4 text-center">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {filteredUsers.map(user => (
                            <tr key={user.uid} className="hover:bg-gray-50/50">
                                <td className="px-6 py-4">
                                    <div className="font-bold text-gray-900">{user.displayName}</div>
                                    <div className="text-gray-500 text-xs">{user.email}</div>
                                    <div className="text-gray-400 text-[10px] mt-0.5">{user.jobTitle || 'Sem cargo'}</div>
                                </td>
                                <td className="px-6 py-4">
                                    {user.modules.commercial?.enabled ? (
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-100">
                                            <Shield size={12} /> {user.modules.commercial.role.replace('COMMERCIAL_', '')}
                                        </span>
                                    ) : (
                                        <span className="text-gray-400 text-xs italic">Desativado</span>
                                    )}
                                </td>
                                <td className="px-6 py-4">
                                    {user.modules.human_capital?.enabled ? (
                                        <div className="flex flex-col gap-1 items-start">
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-bold border border-indigo-100">
                                                <Shield size={12} /> {user.modules.human_capital.role.replace('CH_', '')}
                                            </span>
                                            {user.modules.human_capital.scope.type !== 'ALL' && (
                                                <span className="text-[10px] text-gray-500 flex items-center gap-1 bg-gray-100 px-1.5 py-0.5 rounded">
                                                    {user.modules.human_capital.scope.type === 'REGIONAL' ? <MapPin size={10} /> : <Building2 size={10} />}
                                                    {user.modules.human_capital.scope.type === 'REGIONAL'
                                                        ? `${user.modules.human_capital.scope.regionals.length} Regionais`
                                                        : `${user.modules.human_capital.scope.costCenters.length} CCs`}
                                                </span>
                                            )}
                                        </div>
                                    ) : (
                                        <span className="text-gray-400 text-xs italic">Desativado</span>
                                    )}
                                </td>
                                <td className="px-6 py-4">
                                    {user.modules.construction?.enabled ? (
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 text-xs font-bold border border-amber-100">
                                            <HardHat size={12} /> {user.modules.construction.role.replace('CONSTRUCTION_', '')}
                                        </span>
                                    ) : (
                                        <span className="text-gray-400 text-xs italic">Desativado</span>
                                    )}
                                </td>
                                <td className="px-6 py-4">
                                    {user.status === 'active' && <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 text-xs font-bold"><CheckCircle2 size={12} /> Ativo</span>}
                                    {user.status === 'invited' && <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-100 text-blue-800 text-xs font-bold"><KeyRound size={12} /> Pendente</span>}
                                    {user.status === 'disabled' && <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-100 text-red-800 text-xs font-bold"><Ban size={12} /> Desativado</span>}
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center justify-center gap-2">
                                        <button onClick={() => handleEdit(user)} title="Editar Acessos" className="p-2 hover:bg-gray-200 rounded-lg text-gray-500 hover:text-blue-600 transition-colors">
                                            <Edit2 size={16} />
                                        </button>
                                        <button onClick={() => handleAdminAction('reset-password', user)} title="Resetar Senha" className="p-2 hover:bg-gray-200 rounded-lg text-gray-500 hover:text-amber-600 transition-colors">
                                            <KeyRound size={16} />
                                        </button>
                                        {user.status === 'disabled' ? (
                                            <button onClick={() => handleAdminAction('enable', user)} title="Reativar Acesso" className="p-2 hover:bg-gray-200 rounded-lg text-gray-500 hover:text-emerald-600 transition-colors">
                                                <CheckCircle2 size={16} />
                                            </button>
                                        ) : (
                                            <button onClick={() => handleAdminAction('disable', user)} title="Desativar Acesso" className="p-2 hover:bg-gray-200 rounded-lg text-gray-500 hover:text-red-500 transition-colors">
                                                <Ban size={16} />
                                            </button>
                                        )}
                                        {profile?.uid !== user.uid && (
                                            <button onClick={() => handleAdminAction('delete', user)} title="Excluir Definitivamente" className="p-2 hover:bg-red-100 rounded-lg text-gray-500 hover:text-red-700 transition-colors">
                                                <Trash2 size={16} />
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Manual Add User Modal */}
            {isAddModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                        <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50">
                            <h3 className="font-bold text-lg text-gray-800">Adicionar Usuário Manualmente</h3>
                            <button onClick={() => setIsAddModalOpen(false)} className="p-2 hover:bg-gray-200 rounded-full"><X size={20} /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="bg-blue-50 border border-blue-100 p-3 rounded-lg text-xs text-blue-700 mb-4">
                                <p>Cria um convite seguro. O usuário receberá um perfil e você receberá um link temporário para que ele cadastre a senha inicial.</p>
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase text-gray-500 mb-1">E-mail Corporativo</label>
                                <input
                                    type="email"
                                    value={newUserEmail}
                                    onChange={(e) => setNewUserEmail(e.target.value)}
                                    className="w-full p-2 border rounded-lg text-sm"
                                    placeholder="usuario@grupodr.com.br"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Nome</label>
                                <input
                                    type="text"
                                    value={newUserName}
                                    onChange={(e) => setNewUserName(e.target.value)}
                                    className="w-full p-2 border rounded-lg text-sm"
                                    placeholder="Nome Completo"
                                />
                            </div>
                        </div>
                        <div className="p-4 bg-gray-100 flex justify-end gap-3">
                            <button onClick={() => setIsAddModalOpen(false)} className="px-4 py-2 text-sm font-bold text-gray-500 hover:text-gray-700">Cancelar</button>
                            <button onClick={handleCreateUser} disabled={creatingUser} className="px-6 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold shadow-lg hover:bg-emerald-700 transition-all flex items-center gap-2">
                                {creatingUser ? <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> : <Plus size={16} />}
                                Adicionar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {editingUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50">
                            <h3 className="font-bold text-lg text-gray-800">Editar Acessos: {editingUser.displayName}</h3>
                            <button onClick={() => setEditingUser(null)} className="p-2 hover:bg-gray-200 rounded-full"><X size={20} /></button>
                        </div>

                        <div className="p-6 overflow-y-auto space-y-8">
                            {/* Commercial Module */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h4 className="font-bold text-gray-700 flex items-center gap-2"><Shield size={16} /> Módulo Comercial</h4>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={editingUser.modules.commercial?.enabled ?? false}
                                            onChange={(e) => {
                                                const enabled = e.target.checked;
                                                setEditingUser({
                                                    ...editingUser,
                                                    modules: {
                                                        ...editingUser.modules,
                                                        commercial: {
                                                            enabled,
                                                            role: enabled ? (editingUser.modules.commercial?.role || 'COMMERCIAL_VIEWER') : (editingUser.modules.commercial?.role || 'COMMERCIAL_VIEWER')
                                                        }
                                                    }
                                                });
                                            }}
                                            className="sr-only peer"
                                        />
                                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                    </label>
                                </div>
                                {editingUser.modules.commercial?.enabled && (
                                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                                        <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Função</label>
                                        <select
                                            value={editingUser.modules.commercial.role}
                                            onChange={(e) => setEditingUser({
                                                ...editingUser,
                                                modules: { ...editingUser.modules, commercial: { ...editingUser.modules.commercial!, role: e.target.value as CommercialRole } }
                                            })}
                                            className="w-full p-2 border rounded-lg text-sm"
                                        >
                                            <option value="COMMERCIAL_VIEWER">Visualizador</option>
                                            <option value="COMMERCIAL_ADMIN">Administrador Comercial</option>
                                            <option value="IAM_ADMIN">Administrador IAM</option>
                                        </select>
                                    </div>
                                )}
                            </div>

                            <hr className="border-gray-100" />

                            {/* Construction Module */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h4 className="font-bold text-gray-700 flex items-center gap-2"><HardHat size={16} /> Módulo de Obras</h4>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={editingUser.modules.construction?.enabled ?? false}
                                            onChange={(e) => {
                                                const enabled = e.target.checked;
                                                setEditingUser({
                                                    ...editingUser,
                                                    modules: {
                                                        ...editingUser.modules,
                                                        construction: {
                                                            enabled,
                                                            role: enabled ? (editingUser.modules.construction?.role || 'CONSTRUCTION_VIEWER') : (editingUser.modules.construction?.role || 'CONSTRUCTION_VIEWER')
                                                        }
                                                    }
                                                });
                                            }}
                                            className="sr-only peer"
                                        />
                                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                                    </label>
                                </div>
                                {editingUser.modules.construction?.enabled && (
                                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                                        <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Função</label>
                                        <select
                                            value={editingUser.modules.construction.role}
                                            onChange={(e) => setEditingUser({
                                                ...editingUser,
                                                modules: { ...editingUser.modules, construction: { ...editingUser.modules.construction!, role: e.target.value as ConstructionRole } }
                                            })}
                                            className="w-full p-2 border rounded-lg text-sm"
                                        >
                                            <option value="CONSTRUCTION_VIEWER">Visualizador (Apenas Leitura)</option>
                                            <option value="CONSTRUCTION_MANAGER">Gerente (Operacional)</option>
                                            <option value="CONSTRUCTION_ADMIN">Administrador (Acesso Total)</option>
                                        </select>
                                    </div>
                                )}
                            </div>

                            <hr className="border-gray-100" />

                            {/* HC Module */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h4 className="font-bold text-gray-700 flex items-center gap-2"><Users size={16} /> Módulo Capital Humano</h4>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={editingUser.modules.human_capital?.enabled ?? false}
                                            onChange={(e) => {
                                                const enabled = e.target.checked;
                                                // Initialize default scope if enabling
                                                const currentScope = editingUser.modules.human_capital?.scope || { type: 'ALL' };

                                                setEditingUser({
                                                    ...editingUser,
                                                    modules: {
                                                        ...editingUser.modules,
                                                        human_capital: {
                                                            enabled,
                                                            role: enabled ? (editingUser.modules.human_capital?.role || 'CH_AUDITOR_VIEWER') : (editingUser.modules.human_capital?.role || 'CH_AUDITOR_VIEWER'),
                                                            scope: currentScope
                                                        }
                                                    }
                                                });
                                            }}
                                            className="sr-only peer"
                                        />
                                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                                    </label>
                                </div>
                                {editingUser.modules.human_capital?.enabled && (
                                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-4">
                                        <div>
                                            <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Função</label>
                                            <select
                                                value={editingUser.modules.human_capital.role}
                                                onChange={(e) => setEditingUser({
                                                    ...editingUser,
                                                    modules: { ...editingUser.modules, human_capital: { ...editingUser.modules.human_capital!, role: e.target.value as import('../types').CHRole } }
                                                })}
                                                className="w-full p-2 border rounded-lg text-sm"
                                            >
                                                <option value="CH_AUDITOR_VIEWER">Auditor (Visualização Total)</option>
                                                <option value="CH_COSTCENTER_PLANNER">Planejador de CC</option>
                                                <option value="CH_MANAGER">Gerente Regional</option>
                                                <option value="CH_APPROVER">Aprovador CH</option>
                                                <option value="CH_ADMIN">Administrador CH</option>
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Tipo de Escopo</label>
                                            <div className="flex gap-2">
                                                {(['ALL', 'REGIONAL', 'COST_CENTER'] as ScopeType[]).map(type => (
                                                    <button
                                                        key={type}
                                                        onClick={() => {
                                                            let newScope: Scope = { type: 'ALL' };
                                                            if (type === 'REGIONAL') newScope = { type: 'REGIONAL', regionals: [] };
                                                            if (type === 'COST_CENTER') newScope = { type: 'COST_CENTER', costCenters: [] };

                                                            setEditingUser({
                                                                ...editingUser,
                                                                modules: {
                                                                    ...editingUser.modules,
                                                                    human_capital: {
                                                                        ...editingUser.modules.human_capital!,
                                                                        scope: newScope
                                                                    }
                                                                }
                                                            });
                                                        }}
                                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${editingUser.modules.human_capital!.scope.type === type ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-100'}`}
                                                    >
                                                        {type === 'ALL' ? 'Total' : type === 'REGIONAL' ? 'Regional' : 'Centro de Custo'}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Scope Details Input */}
                                        {editingUser.modules.human_capital.scope.type === 'REGIONAL' && (
                                            <div>
                                                <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Regionais (separadas por vírgula)</label>
                                                <input
                                                    type="text"
                                                    placeholder="Regional 01, Regional 02..."
                                                    value={(editingUser.modules.human_capital.scope as any).regionals?.join(', ') || ''}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        const regionals = val.split(',').map(s => s.trim()).filter(s => s);
                                                        setEditingUser({
                                                            ...editingUser,
                                                            modules: {
                                                                ...editingUser.modules,
                                                                human_capital: {
                                                                    ...editingUser.modules.human_capital!,
                                                                    scope: { type: 'REGIONAL', regionals }
                                                                }
                                                            }
                                                        });
                                                    }}
                                                    className="w-full p-2 border rounded-lg text-sm"
                                                />
                                                <p className="text-[10px] text-gray-400 mt-1">Ex: Regional 01, Sede</p>
                                            </div>
                                        )}

                                        {editingUser.modules.human_capital.scope.type === 'COST_CENTER' && (
                                            <div>
                                                <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Centros de Custo (separados por vírgula)</label>
                                                <input
                                                    type="text"
                                                    placeholder="1001, 301201..."
                                                    value={(editingUser.modules.human_capital.scope as any).costCenters?.join(', ') || ''}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        const costCenters = val.split(',').map(s => s.trim()).filter(s => s);
                                                        setEditingUser({
                                                            ...editingUser,
                                                            modules: {
                                                                ...editingUser.modules,
                                                                human_capital: {
                                                                    ...editingUser.modules.human_capital!,
                                                                    scope: { type: 'COST_CENTER', costCenters }
                                                                }
                                                            }
                                                        });
                                                    }}
                                                    className="w-full p-2 border rounded-lg text-sm"
                                                />
                                                <p className="text-[10px] text-gray-400 mt-1">Ex: 3.012.01 (pontos são removidos automaticamente na validação se preferir)</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="p-4 bg-gray-100 flex justify-end gap-3 mt-auto">
                            <button onClick={() => setEditingUser(null)} className="px-5 py-2 text-sm font-bold text-gray-500 hover:text-gray-700">Cancelar</button>
                            <button onClick={handleSave} disabled={saving} className="px-6 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold shadow-lg hover:bg-blue-700 transition-all flex items-center gap-2">
                                {saving ? <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> : <Save size={16} />}
                                Salvar Alterações
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Link de Convite/Redefinição */}
            {linkModal.isOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-100 animate-in fade-in zoom-in duration-200">
                        <div className="p-6 border-b border-gray-50 flex justify-between items-center bg-blue-50/30">
                            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                <KeyRound className="text-blue-600" size={20} />
                                {linkModal.title}
                            </h3>
                            <button
                                onClick={() => setLinkModal({ ...linkModal, isOpen: false })}
                                className="p-2 hover:bg-white rounded-full transition-colors text-gray-400 hover:text-gray-600"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-8 space-y-6">
                            <p className="text-sm text-gray-600 leading-relaxed">
                                O link foi gerado com sucesso. Como o envio automático de e-mail pode ser bloqueado por filtros de spam,
                                você pode copiar o link abaixo e enviá-lo diretamente ao usuário.
                            </p>

                            <div className="relative group">
                                <div className="absolute -top-2.5 left-4 px-2 bg-white text-[10px] font-bold text-blue-600 uppercase tracking-wider">
                                    Link de Acesso
                                </div>
                                <div className="flex items-center gap-2 p-4 bg-gray-50 rounded-2xl border-2 border-gray-100 group-hover:border-blue-100 transition-colors">
                                    <input
                                        type="text"
                                        readOnly
                                        value={linkModal.link}
                                        className="bg-transparent border-none outline-none text-xs text-gray-500 w-full font-mono truncate"
                                    />
                                    <button
                                        onClick={() => {
                                            navigator.clipboard.writeText(linkModal.link);
                                            alert("Link copiado para a área de transferência!");
                                        }}
                                        className="p-2 bg-white shadow-sm border border-gray-100 rounded-xl text-blue-600 hover:bg-blue-50 transition-all flex items-center gap-2 group/btn"
                                        title="Copiar Link"
                                    >
                                        <Copy size={16} />
                                    </button>
                                </div>
                            </div>

                            <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100 flex gap-3 items-start">
                                <AlertTriangle className="text-amber-600 shrink-0" size={18} />
                                <p className="text-xs text-amber-800 leading-relaxed">
                                    <strong>Atenção:</strong> Este link é temporário. Por segurança, não o compartilhe publicamente.
                                </p>
                            </div>
                        </div>

                        <div className="p-6 bg-gray-50 flex justify-end gap-3">
                            <button
                                onClick={() => setLinkModal({ ...linkModal, isOpen: false })}
                                className="px-6 py-2.5 bg-gray-800 text-white rounded-xl text-sm font-bold shadow-lg hover:bg-black transition-all"
                            >
                                Entendi
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProfileManager;
