import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowRight, Eye, EyeOff, Info, Loader2, Lock, Mail } from 'lucide-react';
import { getAuth, sendPasswordResetEmail } from 'firebase/auth';

/** Encarregados de obra entram com o CPF; a conta deles usa o domínio interno abaixo. */
const FOREMAN_EMAIL_DOMAIN = 'encarregado.dr';

/** Converte o que foi digitado no e-mail de login: CPF (11 dígitos, sem @) vira a conta do encarregado. */
const toLoginEmail = (typed: string): string => {
    const value = typed.trim();
    const digits = value.replace(/\D/g, '');
    return digits.length === 11 && !value.includes('@') ? `${digits}@${FOREMAN_EMAIL_DOMAIN}` : value;
};

type PendingAction = 'login' | 'reset' | null;

const inputClass =
    'w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm text-slate-900 placeholder-slate-400 shadow-sm transition ' +
    'focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/15 disabled:bg-slate-100';

/** Painel da esquerda: a capa institucional já traz a mensagem e o logo, então fica sem texto por cima. */
const CoverPanel: React.FC = () => (
    <aside className="relative hidden overflow-hidden bg-[#0b1d4f] lg:block lg:w-1/2 xl:w-[55%]">
        <img
            src="/assets/nova_capa.jpeg"
            alt="Obra do Grupo DR vista do alto: planejamento e tecnologia a serviço da engenharia"
            className="absolute inset-0 h-full w-full object-cover object-bottom"
        />
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-[#0b1d4f]/80 to-transparent" />
        <p className="absolute left-10 top-9 text-[11px] font-semibold uppercase tracking-[0.35em] text-white/90">
            DR Nexus · Centro de Inteligência
        </p>
    </aside>
);

export const LoginPage: React.FC = () => {
    const { login } = useAuth();
    const navigate = useNavigate();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [pending, setPending] = useState<PendingAction>(null);
    const isBusy = pending !== null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email.trim()) {
            toast.error('Por favor, informe seu e-mail ou CPF.');
            return;
        }

        try {
            setPending('login');
            await login(toLoginEmail(email), password);
            toast.success('Bem-vindo ao Portal DR Nexus!');
            navigate('/');
        } catch (error: any) {
            console.error('Login Error:', error);
            setPending(null);
            toast.error(error.message || 'Erro ao realizar login.');
        }
    };

    const handleForgotPassword = async () => {
        if (!email.trim()) {
            toast.error('Informe seu e-mail no campo acima para redefinir a senha.');
            return;
        }

        try {
            setPending('reset');
            await sendPasswordResetEmail(getAuth(), email.trim());
            toast.success('E-mail de recuperação enviado! Verifique sua caixa de entrada (e spam).');
        } catch (error: any) {
            console.error('Password Reset Error:', error);
            toast.error(error.code === 'auth/user-not-found'
                ? 'Nenhum usuário encontrado com este e-mail.'
                : 'Erro ao enviar e-mail de recuperação. Verifique o e-mail digitado.');
        } finally {
            setPending(null);
        }
    };

    return (
        <div className="flex min-h-screen w-full bg-slate-50 font-sans">
            <CoverPanel />

            <main className="flex flex-1 flex-col px-6 py-10 sm:px-10">
                <div className="flex flex-1 items-center justify-center">
                    <div className="w-full max-w-md">
                        <div className="mb-10 flex flex-col items-center gap-3">
                            <div className="flex items-center gap-4">
                                <img src="/assets/dr-logo.png" alt="Grupo DR" className="h-12 w-auto" />
                                <span className="h-10 w-px bg-slate-300" aria-hidden="true" />
                                <img src="/assets/nexus.png" alt="Nexus" className="h-6 w-auto" />
                            </div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-slate-500">
                                Centro de Inteligência
                            </p>
                        </div>

                        <h1 className="text-2xl font-bold text-slate-900">Bem-vindo(a)</h1>
                        <p className="mt-1 text-sm text-slate-500">Entre com seu e-mail corporativo ou CPF.</p>

                        <form onSubmit={handleSubmit} className="mt-8 space-y-5" noValidate>
                            <div>
                                <label htmlFor="email" className="mb-1.5 block text-xs font-semibold text-slate-600">
                                    E-mail corporativo ou CPF
                                </label>
                                <div className="relative">
                                    <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                                    <input
                                        id="email"
                                        type="text"
                                        inputMode="email"
                                        autoComplete="username"
                                        autoFocus
                                        className={inputClass}
                                        placeholder="usuario@grupodr.com.br"
                                        value={email}
                                        onChange={e => setEmail(e.target.value)}
                                        disabled={isBusy}
                                    />
                                </div>
                            </div>

                            <div>
                                <div className="mb-1.5 flex items-center justify-between">
                                    <label htmlFor="password" className="block text-xs font-semibold text-slate-600">
                                        Senha
                                    </label>
                                    <button
                                        type="button"
                                        onClick={handleForgotPassword}
                                        disabled={isBusy}
                                        className="text-xs font-medium text-blue-700 hover:text-blue-800 hover:underline disabled:opacity-50"
                                    >
                                        {pending === 'reset' ? 'Enviando...' : 'Esqueci minha senha'}
                                    </button>
                                </div>
                                <div className="relative">
                                    <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                                    <input
                                        id="password"
                                        type={showPassword ? 'text' : 'password'}
                                        autoComplete="current-password"
                                        className={`${inputClass} pr-12`}
                                        placeholder="••••••••"
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        disabled={isBusy}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(visible => !visible)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 hover:text-slate-600"
                                        aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                                    >
                                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={isBusy}
                                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#0b1d4f] py-3.5 text-sm font-semibold text-white shadow-lg shadow-[#0b1d4f]/20 transition hover:bg-[#13296b] focus:outline-none focus:ring-4 focus:ring-blue-500/30 disabled:cursor-not-allowed disabled:opacity-70"
                            >
                                {pending === 'login'
                                    ? <><Loader2 className="h-4 w-4 animate-spin" /> Entrando...</>
                                    : <>Entrar <ArrowRight className="h-4 w-4" /></>}
                            </button>
                        </form>

                        <div className="mt-8 flex gap-3 rounded-xl border border-slate-200 bg-white p-4 text-xs leading-relaxed text-slate-500">
                            <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                            <p>Encarregados de obra entram com o CPF (somente números) e a senha recebida no cadastro.</p>
                        </div>
                    </div>
                </div>

                <p className="mt-10 text-center text-[11px] uppercase tracking-wider text-slate-400">
                    Grupo DR · Construtora e Serviços
                </p>
            </main>
        </div>
    );
};
