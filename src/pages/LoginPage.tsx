// NÃO USADO — o app usa pages/LoginPage.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Lock, Mail, Building2, Users, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

// Update to named export to match index.tsx
export const LoginPage = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    type LoginModule = 'COMMERCIAL' | 'HUMAN_CAPITAL';
    const [loginModule, setLoginModule] = useState<LoginModule>('COMMERCIAL');
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

            toast.success('Bem-vindo ao Portal DR Nexus!');
            navigate(loginModule === 'HUMAN_CAPITAL' ? '/human-capital' : '/');
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
                <div className="bg-[#0f172a] p-8 text-center relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-blue-900/20 to-transparent pointer-events-none" />
                    <div className="relative z-10">
                        {/* 
                        <div className="w-16 h-16 bg-white/10 rounded-xl flex items-center justify-center mx-auto mb-4 backdrop-blur-md border border-white/20 shadow-inner">
                            <img src="/assets/dr-logo.png" alt="DR Logo" className="h-10 object-contain" onError={(e) => e.currentTarget.style.display = 'none'} />
                        </div>
                        */}
                        <h2 className="text-3xl font-bold text-white tracking-widest font-sans">NEXUS</h2>
                        <p className="text-blue-200 text-xs mt-1 font-medium tracking-[0.2em] uppercase">Commercial Intelligence</p>
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

                        <div>
                            <label
                                htmlFor="module"
                                className="block text-xs font-medium text-slate-300 mb-1 ml-1 uppercase tracking-wide"
                            >
                                Módulo
                            </label>

                            <select
                                id="module"
                                value={loginModule}
                                onChange={(e) => setLoginModule(e.target.value as LoginModule)}
                                className="w-full bg-black/30 border border-white/10 rounded-lg py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
                            >
                                <option value="COMMERCIAL">Comercial</option>
                                <option value="HUMAN_CAPITAL">Capital Humano</option>
                            </select>

                            <p className="mt-2 text-[11px] text-slate-400">
                                Selecione o módulo antes de entrar.
                            </p>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className={`w-full py-3.5 rounded-xl font-bold text-white shadow-lg transition-all flex items-center justify-center gap-2 ${loginModule === 'COMMERCIAL'
                                ? 'bg-blue-700 hover:bg-blue-800 shadow-blue-200'
                                : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'
                                } disabled:opacity-70 disabled:cursor-not-allowed transform active:scale-[0.98] mt-2`}
                        >
                            {loading ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    <span>Entrar no Portal {loginModule === 'COMMERCIAL' ? 'Comercial' : 'RH'}</span>
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
