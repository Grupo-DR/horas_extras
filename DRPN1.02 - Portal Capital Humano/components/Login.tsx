import React, { useState } from 'react';
import { UserProfile } from '../types';
import { authenticateUser, getAvailableUsers } from '../services/auth';
import { LogIn, ShieldCheck } from 'lucide-react';

interface LoginProps {
  onLogin: (user: UserProfile) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [loading, setLoading] = useState(false);
  const users = getAvailableUsers();

  const handleQuickLogin = async (email: string) => {
    setLoading(true);
    const user = await authenticateUser(email);
    setLoading(false);
    if (user) onLogin(user);
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="bg-blue-600 p-8 text-center">
            <div className="mx-auto bg-white/20 w-16 h-16 rounded-xl flex items-center justify-center mb-4 backdrop-blur-sm">
                <ShieldCheck className="text-white" size={32} />
            </div>
            <h1 className="text-2xl font-bold text-white">TOTVS Analytics RH</h1>
            <p className="text-blue-100 mt-2">Portal de Gestão de Horas Extras</p>
        </div>
        
        <div className="p-8">
            <h2 className="text-gray-700 font-semibold mb-6 text-center">Selecione um Perfil para Entrar (Demo)</h2>
            
            <div className="space-y-3">
                {users.map(user => (
                    <button
                        key={user.id}
                        onClick={() => handleQuickLogin(user.email)}
                        disabled={loading}
                        className="w-full flex items-center p-3 rounded-lg border border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition-all group text-left"
                    >
                        <span className="text-2xl mr-4 group-hover:scale-110 transition-transform">{user.avatar}</span>
                        <div>
                            <div className="font-bold text-gray-800">{user.name}</div>
                            <div className="text-xs text-gray-500 flex items-center gap-1">
                                <span className="uppercase font-mono bg-gray-100 px-1 rounded">{user.role.replace(/_/g, ' ')}</span>
                                {user.costCenter && <span>CC: {user.costCenter}</span>}
                            </div>
                        </div>
                        <div className="ml-auto opacity-0 group-hover:opacity-100 text-blue-600">
                            <LogIn size={18} />
                        </div>
                    </button>
                ))}
            </div>

            {loading && (
                <div className="mt-6 text-center text-sm text-gray-500 animate-pulse">
                    Autenticando acesso...
                </div>
            )}
        </div>
        <div className="bg-gray-50 p-4 text-center text-xs text-gray-400 border-t border-gray-100">
            Ambiente Seguro • v1.2.0
        </div>
      </div>
    </div>
  );
};

export default Login;
