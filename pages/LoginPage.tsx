import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Play } from 'lucide-react';
import loginBgVideo from '../src/assets/login-bg.mp4';
import nexusLoadingVideo from '../src/assets/loading-nexus.mp4';

export const LoginPage: React.FC = () => {
    const { login } = useAuth();
    const navigate = useNavigate();

    // UI State
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false); // Controls the visual transition
    const [showLoadingVideo, setShowLoadingVideo] = useState(false); // Controls the overlay

    // Refs for Video Control
    const loadingVideoRef = useRef<HTMLVideoElement>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!email.trim()) {
            toast.error('Por favor, informe seu e-mail.');
            return;
        }

        try {
            // 1. Start Cinematic Transition
            setIsLoading(true);
            setShowLoadingVideo(true);

            // 2. Play Loading Video from 0
            if (loadingVideoRef.current) {
                loadingVideoRef.current.currentTime = 0;
                loadingVideoRef.current.play().catch(err => console.error("Video play error:", err));
            }

            // 3. Wait for Video Duration (4000ms as requested)
            // We use a Promise to sync the wait
            await new Promise(resolve => setTimeout(resolve, 4000));

            // 4. Perform Auth
            await login(email, password);

            // 5. Success - Redirect
            // Optional: Wait a tiny bit for fade? No, redirect immediately after video.
            toast.success('Bem-vindo ao Portal DR Nexus!');
            navigate('/comercial');

        } catch (error: any) {
            // 6. Error Handling - Revert UI
            console.error('Login Error:', error);

            // Fade out video?
            setShowLoadingVideo(false);
            setIsLoading(false);

            // Stop video to save resources
            if (loadingVideoRef.current) {
                loadingVideoRef.current.pause();
            }

            toast.error(error.message || 'Erro ao realizar login.');
        }
    };

    return (
        <div className="relative w-full h-screen overflow-hidden bg-black font-sans text-white">

            {/* 1. LAYER - BACKGROUND VIDEO (LOOP) */}
            <video
                className="absolute top-0 left-0 w-full h-full object-cover opacity-60 z-0"
                autoPlay
                loop
                muted
                playsInline
                src={loginBgVideo}
            />

            {/* 2. LAYER - LOADING VIDEO OVERLAY (CINEMATIC) */}
            <div
                className={`absolute inset-0 z-50 bg-black flex items-center justify-center transition-opacity duration-700 ${showLoadingVideo ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
                    }`}
            >
                <video
                    ref={loadingVideoRef}
                    className="w-full h-full object-cover"
                    muted // Muted needed for autoplay policy usually, but we forced play() in JS
                    playsInline
                    src={nexusLoadingVideo}
                />
            </div>

            {/* 3. LAYER - LOGIN FORM */}
            <div className={`relative z-10 w-full h-full flex flex-col items-center justify-center transition-all duration-500 ${isLoading ? 'opacity-0 scale-95' : 'opacity-100 scale-100'
                }`}>

                {/* Glassmorphism Card */}
                <div className="w-full max-w-md p-8 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 shadow-2xl animate-in fade-in zoom-in duration-500">

                    {/* Header */}
                    <div className="mb-8 text-center">
                        <h1 className="text-4xl font-bold tracking-tighter mb-2 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-white">
                            NEXUS
                        </h1>
                        <p className="text-sm text-slate-300 tracking-widest uppercase">
                            Commercial Intelligence
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
                                ENTRAR <Play className="w-3 h-3 fill-current" />
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
