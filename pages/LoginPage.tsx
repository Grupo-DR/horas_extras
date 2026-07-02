import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Play, Loader2 } from 'lucide-react';
// @ts-expect-error - Video import handled by Vite
import loginBgVideo from '../src/assets/login-bg.mp4';

export const LoginPage: React.FC = () => {
    const { login } = useAuth();
    const navigate = useNavigate();

    // UI State
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false); // Controls the visual transition

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!email.trim()) {
            toast.error('Por favor, informe seu e-mail.');
            return;
        }

        try {
            setIsLoading(true);

            // 1. Perform Auth
            await login(email, password);

            // 2. Success - Redirect
            toast.success('Bem-vindo ao Portal DR Nexus!');

            navigate('/');

        } catch (error: any) {
            // 3. Error Handling - Revert UI
            console.error('Login Error:', error);
            setIsLoading(false);

            toast.error(error.message || 'Erro ao realizar login.');
        }
    };

    const handleVideoLoad = (e: React.SyntheticEvent<HTMLVideoElement>) => {
        const video = e.currentTarget;
        const targetDuration = 60; // 10 minutes (600 seconds)

        // Calculate needed playback rate: current_duration / target_duration
        // Example: 30s video / 600s target = 0.05x speed
        const rate = video.duration / targetDuration;

        // Safety: Browsers may ignore extremely low rates. 
        // 0.0625 is often a safe lower bound (1/16x speed).
        // If the calculation demands lower, we clamp it to the minimum safe value 
        // and accept that it won't be exactly 10 min, but close enough without breaking.
        const safeRate = Math.max(rate, 0.625);

        video.playbackRate = safeRate;
    };

    return (
        <div className="relative w-full h-screen overflow-hidden bg-black font-sans text-white">

            {/* 1. LAYER - BACKGROUND VIDEO (LOOP) */}
            {/* 1. LAYER - BACKGROUND VIDEO (ONCE) */}
            <video
                className="absolute top-0 left-0 w-full h-full object-cover opacity-60 z-0 scale-105"
                autoPlay
                muted
                playsInline
                src={loginBgVideo}
                onLoadedMetadata={handleVideoLoad}
            />

            {/* 2. LAYER - LOGIN FORM */}
            <div className={`relative z-10 w-full h-full flex flex-col items-center justify-center transition-all duration-500 ${isLoading ? 'opacity-0 scale-95' : 'opacity-100 scale-100'
                }`}>

                {/* Glassmorphism Card */}
                <div className="w-full max-w-md p-8 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 shadow-2xl animate-in fade-in zoom-in duration-500">

                    {/* Header */}
                    <div className="mb-8 text-center">
                        <h1 className="text-4xl font-bold tracking-tighter mb-2 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-white">
                            GRUPO DR
                        </h1>
                        <p className="text-sm text-slate-300 tracking-widest uppercase">
                            Centro de Inteligência
                        </p>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label htmlFor="email" className="block text-xs font-medium text-slate-300 mb-1 ml-1 uppercase tracking-wide">
                                Acesso Corporativo
                            </label>
                            <input
                                type="email"
                                id="email"
                                className="w-full bg-black/30 border border-white/10 rounded-lg py-3 px-4 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
                                placeholder="usuario@grupodr.com.br"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                autoFocus
                            />
                        </div>

                        <div>
                            <label htmlFor="password" className="block text-xs font-medium text-slate-300 mb-1 ml-1 uppercase tracking-wide">
                                Senha
                            </label>
                            <input
                                type="password"
                                id="password"
                                className="w-full bg-black/30 border border-white/10 rounded-lg py-3 px-4 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all font-mono"
                                placeholder="••••••••"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full group relative overflow-hidden bg-white text-black font-bold py-3.5 rounded-lg transition-all hover:scale-[1.02] hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <span className="relative z-10 flex items-center justify-center gap-2">
                                Entrar <Play className="w-3 h-3 fill-current" />
                            </span>
                            <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-blue-200 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                        </button>
                    </form>

                    {/* Footer */}
                    <div className="mt-8 text-center flex flex-col items-center gap-2 opacity-60">
                        <img src="/assets/dr-logo.png" alt="DR" className="h-6 brightness-0 invert" />
                    </div>

                </div>
            </div>

            {/* Overlay Gradient (Vignette) */}
            <div className="absolute inset-0 z-1 pointer-events-none bg-radial-gradient from-transparent to-black/80" />

        </div>
    );
};
