import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Lock, Mail, Building2, Users, ArrowRight } from 'lucide-react';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [selectedModule, setSelectedModule] = useState<'COMMERCIAL' | 'HUMAN_CAPITAL'>('COMMERCIAL');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const { login: signIn } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setError('');
            setLoading(true);
            await signIn(email, password);

            // Lógica de Roteamento por Módulo
            if (selectedModule === 'HUMAN_CAPITAL') {
                navigate('/human-capital');
            } else {
                navigate('/'); // Vai para o Dashboard Comercial (Padrão)
            }
        } catch (err) {
            console.error(err);
            setError('Falha no login. Verifique suas credenciais.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
                <div className="bg-[#1e3a8a] p-8 text-center relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-white/10 to-transparent pointer-events-none" />
                    <div className="relative z-10">
                        <div className="w-16 h-16 bg-white/10 rounded-xl flex items-center justify-center mx-auto mb-4 backdrop-blur-md border border-white/20 shadow-inner">
                            <img src="/assets/dr-logo.png" alt="DR Logo" className="h-10 object-contain" onError={(e) => e.currentTarget.style.display = 'none'} />
                            <Building2 className="text-white" size={32} style={{ display: 'none' }} />
                        </div>
                        <h2 className="text-2xl font-bold text-white tracking-tight">Portal Corporativo</h2>
                        <p className="text-blue-200 text-sm mt-1 font-medium">Acesso Unificado DR Nexus</p>
                    </div>
                </div>

                <div className="p-8">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {error && (
                            <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm text-center border border-red-100 flex items-center justify-center gap-2 font-medium animate-pulse">
                                <Lock size={14} /> {error}
                            </div>
                        )}

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 ml-1">Email Corporativo</label>
                                <div className="relative group">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-600 transition-colors" size={18} />
                                    <input
                                        type="email"
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-gray-50 focus:bg-white text-gray-700 font-medium placeholder-gray-400"
                                        placeholder="seu.nome@empresa.com.br"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 ml-1">Senha</label>
                                <div className="relative group">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-600 transition-colors" size={18} />
                                    <input
                                        type="password"
                                        required
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-gray-50 focus:bg-white text-gray-700 font-medium placeholder-gray-400"
                                        placeholder="••••••••"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="pt-0">
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 ml-1">Módulo de Acesso</label>
                            <div className="relative group">
                                {selectedModule === 'COMMERCIAL' ? (
                                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-600 transition-colors" size={18} />
                                ) : (
                                    <Users className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-600 transition-colors" size={18} />
                                )}
                                <select
                                    value={selectedModule}
                                    onChange={(e) => setSelectedModule(e.target.value as any)}
                                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-gray-50 focus:bg-white text-gray-700 font-medium appearance-none cursor-pointer"
                                >
                                    <option value="COMMERCIAL">Comercial</option>
                                    <option value="HUMAN_CAPITAL">Capital Humano</option>
                                </select>
                                <ArrowRight className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={14} />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className={`w-full py-3.5 rounded-xl font-bold text-white shadow-lg transition-all flex items-center justify-center gap-2 ${selectedModule === 'COMMERCIAL'
                                ? 'bg-blue-700 hover:bg-blue-800 shadow-blue-200'
                                : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'
                                } disabled:opacity-70 disabled:cursor-not-allowed transform active:scale-[0.98] mt-2`}
                        >
                            {loading ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    <span>Entrar no Portal {selectedModule === 'COMMERCIAL' ? 'Comercial' : 'RH'}</span>
                                    <ArrowRight size={18} />
                                </>
                            )}
                        </button>
                    </form>
                </div>
                <div className="bg-gray-50 p-4 text-center border-t border-gray-100">
                    <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">© 2026 DR Nexus Corporation • v2.4.0</p>
                </div>
            </div>
        </div>
    );
}
