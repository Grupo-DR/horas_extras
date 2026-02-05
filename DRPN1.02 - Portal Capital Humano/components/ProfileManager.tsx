import React from 'react';
import { UserProfile, UserRole } from '../types';
import { getAvailableUsers } from '../services/auth';
import { UserCog, ShieldAlert, Check } from 'lucide-react';

interface ProfileManagerProps {
  currentUser: UserProfile;
}

const ProfileManager: React.FC<ProfileManagerProps> = ({ currentUser }) => {
  // In a real app, this would be state fetched from API.
  // Using the mock service getter for visualization.
  const users = getAvailableUsers();

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
        case 'DEV_MASTER': return 'bg-purple-100 text-purple-800 border-purple-200';
        case 'MASTER': return 'bg-red-100 text-red-800 border-red-200';
        case 'LEVEL_A_01': return 'bg-blue-100 text-blue-800 border-blue-200';
        case 'LEVEL_B_01': return 'bg-green-100 text-green-800 border-green-200';
        case 'LEVEL_C_01': return 'bg-gray-100 text-gray-800 border-gray-200';
        default: return 'bg-gray-100 text-gray-600';
    }
  };

  const canEdit = (targetUser: UserProfile) => {
    if (currentUser.role === 'DEV_MASTER') return true;
    if (currentUser.role === 'MASTER') {
        return targetUser.role !== 'DEV_MASTER';
    }
    return false;
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
            <div>
                <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                    <UserCog className="text-blue-600" />
                    Gestão de Perfis e Permissões
                </h2>
                <p className="text-sm text-gray-500 mt-1">Gerencie quem acessa o sistema e seus níveis de visibilidade.</p>
            </div>
            <button className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
                + Novo Usuário
            </button>
        </div>

        <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
                <thead className="bg-white text-gray-500 font-medium border-b border-gray-100">
                    <tr>
                        <th className="px-6 py-4">Usuário</th>
                        <th className="px-6 py-4">Perfil (Nível)</th>
                        <th className="px-6 py-4">Restrições de Visibilidade</th>
                        <th className="px-6 py-4 text-right">Ações</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {users.map(user => (
                        <tr key={user.id} className="hover:bg-gray-50/50">
                            <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                    <span className="text-2xl bg-gray-100 rounded-full w-10 h-10 flex items-center justify-center">{user.avatar}</span>
                                    <div>
                                        <div className="font-bold text-gray-900">{user.name}</div>
                                        <div className="text-xs text-gray-400">{user.email}</div>
                                    </div>
                                </div>
                            </td>
                            <td className="px-6 py-4">
                                <span className={`px-2 py-1 rounded text-xs font-semibold border ${getRoleBadge(user.role)}`}>
                                    {user.role}
                                </span>
                            </td>
                            <td className="px-6 py-4 text-xs">
                                {user.role === 'DEV_MASTER' && <span className="text-purple-600 font-bold flex items-center gap-1"><ShieldAlert size={12}/> Acesso Irrestrito (Manutenção)</span>}
                                {user.role === 'MASTER' && <span className="text-red-600 font-bold">Gestão Completa</span>}
                                {user.role === 'LEVEL_A_01' && <span className="text-blue-600 font-medium">Visualização Global</span>}
                                {user.role === 'LEVEL_B_01' && <span className="text-green-600 font-medium">Apenas Centro de Custo: {user.costCenter}</span>}
                                {user.role === 'LEVEL_C_01' && <span className="text-gray-600">Apenas Dados Pessoais (Chapa: {user.chapa})</span>}
                            </td>
                            <td className="px-6 py-4 text-right">
                                {canEdit(user) ? (
                                    <button className="text-blue-600 hover:text-blue-800 font-medium text-xs border border-blue-200 px-3 py-1 rounded hover:bg-blue-50 transition-colors">
                                        Editar
                                    </button>
                                ) : (
                                    <span className="text-gray-300 italic text-xs">Bloqueado</span>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
        
        <div className="p-4 bg-yellow-50 text-yellow-800 text-xs border-t border-yellow-100 flex items-start gap-2">
            <ShieldAlert size={14} className="mt-0.5 shrink-0" />
            <p>
                <strong>Nota de Segurança:</strong> O perfil DEV Master não pode ser editado por Masters comuns. 
                Nível A visualiza tudo. Nível B é restrito por Centro de Custo. Nível C visualiza apenas a própria Chapa.
            </p>
        </div>
    </div>
  );
};

export default ProfileManager;
