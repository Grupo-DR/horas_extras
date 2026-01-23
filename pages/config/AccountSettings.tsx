import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Lock, Check, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential, getAuth } from 'firebase/auth';
import { auth } from '../../services/firebaseConfig';
import { useNavigate } from 'react-router-dom';

export const AccountSettings: React.FC = () => {
    const { user, updateUser, logout } = useAuth();
    const navigate = useNavigate();

    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (newPassword !== confirmPassword) {
            toast.error('As novas senhas não coincidem');
            return;
        }

        if (newPassword.length < 6) {
            toast.error('A senha deve ter no mínimo 6 caracteres');
            return;
        }

        setLoading(true);

        try {
            const currentUser = auth.currentUser;
            if (!currentUser || !user) throw new Error('Usuário não autenticado');

            // Re-authenticate (required for password change)
            const credential = EmailAuthProvider.credential(currentUser.email!, currentPassword);
            await reauthenticateWithCredential(currentUser, credential);

            // Update Password
            await updatePassword(currentUser, newPassword);

            // Update Firestore Profile (remove mustChangePassword flag)
            if (user.mustChangePassword) {
                await updateUser(user.id, { mustChangePassword: false });
            }

            toast.success('Senha alterada com sucesso!');

            // Optional: Logout or stay logged in? Usually stay logged in.
            // But if it was a forced change, maybe we redirect or just show success.
            // If it was forced, we redirect home.
            if (user.mustChangePassword) {
                navigate('/');
            } else {
                // Clear fields
                setCurrentPassword('');
                setNewPassword('');
                setConfirmPassword('');
            }

        } catch (error: any) {
            console.error(error);
            if (error.code === 'auth/wrong-password') {
                toast.error('Senha atual incorreta');
            } else if (error.code === 'auth/too-many-requests') {
                toast.error('Muitas tentativas. Tente novamente mais tarde.');
            } else {
                toast.error('Erro ao alterar senha: ' + error.message);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-8 max-w-2xl mx-auto">
            <h1 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                <Lock className="w-6 h-6 text-blue-600" />
                Minha Conta
            </h1>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <h2 className="text-lg font-semibold text-slate-800 mb-4">Alterar Senha</h2>

                {user?.mustChangePassword && (
                    <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg mb-6 text-sm flex items-start gap-2">
                        <span className="text-xl">⚠️</span>
                        <div>
                            <strong>Troca Obrigatória:</strong><br />
                            Por segurança, você deve alterar sua senha provisória antes de continuar acessando o sistema.
                        </div>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Senha Atual</label>
                        <input
                            type="password"
                            required
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Nova Senha</label>
                            <input
                                type="password"
                                required
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                minLength={6}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Confirmar Nova Senha</label>
                            <input
                                type="password"
                                required
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                minLength={6}
                            />
                        </div>
                    </div>

                    <div className="pt-4 flex justify-end">
                        <button
                            type="submit"
                            disabled={loading}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {loading ? 'Salvando...' : 'Atualizar Senha'}
                        </button>
                    </div>

                </form>
            </div>
        </div>
    );
};
