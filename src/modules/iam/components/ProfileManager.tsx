
import React, { useState, useEffect } from 'react';
import { UserProfileDoc, HCRole, CommercialRole, Scope, ScopeType } from '../types';
import { getAllProfiles, updateUserRoles } from '../profileService';
import { useAuth } from '@/contexts/AuthContext';
import { Users, Search, Edit2, Shield, AlertTriangle, Save, X, Building2, MapPin } from 'lucide-react';

const ProfileManager: React.FC = () => {
    const { profile } = useAuth();
    const [users, setUsers] = useState<UserProfileDoc[]>([]);
    const [filteredUsers, setFilteredUsers] = useState<UserProfileDoc[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [editingUser, setEditingUser] = useState<UserProfileDoc | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        loadUsers();
    }, []);

    useEffect(() => {
        if (!searchTerm) {
            setFilteredUsers(users);
        } else {
            const lower = searchTerm.toLowerCase();
            setFilteredUsers(users.filter(u =>
                u.email.toLowerCase().includes(lower) ||
                u.displayName.toLowerCase().includes(lower) ||
                (u.jobTitle && u.jobTitle.toLowerCase().includes(lower))
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

            await updateUserRoles(editingUser.uid, {
                commercial,
                human_capital: hc
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

    if (loading) return <div className="p-10 flex justifying-center"><div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full"></div></div>;

    // Check access (Extra safety, though parent should handle)
    const canManage = profile?.isSuperAdmin || profile?.modules.human_capital?.role === 'HC_ADMIN';
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
                <div className="relative w-full md:w-auto">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        placeholder="Buscar usuário..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 pr-4 py-2 border rounded-xl w-full md:w-64 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 border-b border-gray-100 text-gray-500 font-medium uppercase text-xs">
                        <tr>
                            <th className="px-6 py-4">Usuário</th>
                            <th className="px-6 py-4">Comercial</th>
                            <th className="px-6 py-4">Capital Humano</th>
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
                                                <Shield size={12} /> {user.modules.human_capital.role.replace('HC_', '')}
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
                                <td className="px-6 py-4 text-center">
                                    <button onClick={() => handleEdit(user)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-blue-600 transition-colors">
                                        <Edit2 size={16} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

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
                                                            role: enabled ? (editingUser.modules.human_capital?.role || 'HC_AUDITOR_VIEWER') : (editingUser.modules.human_capital?.role || 'HC_AUDITOR_VIEWER'),
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
                                                    modules: { ...editingUser.modules, human_capital: { ...editingUser.modules.human_capital!, role: e.target.value as HCRole } }
                                                })}
                                                className="w-full p-2 border rounded-lg text-sm"
                                            >
                                                <option value="HC_AUDITOR_VIEWER">Auditor (Visualização Total)</option>
                                                <option value="HC_COSTCENTER_PLANNER">Planejador de CC</option>
                                                <option value="HC_MANAGER">Gerente Regional</option>
                                                <option value="HC_ADMIN">Administrador HC</option>
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
        </div>
    );
};

export default ProfileManager;
