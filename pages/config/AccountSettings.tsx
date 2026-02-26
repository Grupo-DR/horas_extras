import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Lock, Check, AlertCircle, Camera } from 'lucide-react';
import { toast } from 'sonner';
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential, getAuth } from 'firebase/auth';
import { auth } from '../../services/firebaseConfig';
import { useNavigate } from 'react-router-dom';
import { updateUserProfile } from '../../src/modules/iam/profileService';

export const AccountSettings: React.FC = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // 1. Validate File
        const isImage = file.type.startsWith('image/');
        const isSizeOk = file.size <= 3 * 1024 * 1024; // 3MB

        if (!isImage) {
            toast.error('Por favor, selecione um arquivo de imagem (JPG ou PNG).');
            return;
        }

        if (!isSizeOk) {
            toast.error('A imagem deve ter no máximo 3MB.');
            return;
        }

        try {
            setUploading(true);
            const { storage } = await import('../../services/firebaseConfig');
            const { ref, uploadBytes, getDownloadURL } = await import('firebase/storage');

            // 2. Upload to Firebase Storage
            const storageRef = ref(storage, `avatars/${user?.id}`);
            const snapshot = await uploadBytes(storageRef, file);

            // 3. Get URL
            const downloadURL = await getDownloadURL(snapshot.ref);

            // 4. Update Profile
            await updateUserProfile(user!.id, { avatarUrl: downloadURL });
            toast.success('Foto de perfil atualizada!');

        } catch (error: any) {
            console.error('Erro ao enviar foto:', error);
            toast.error('Erro ao enviar foto. Tente novamente.');
        } finally {
            setUploading(false);
        }
    };

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

            // Update Firestore Profile (remove mustChangePassword flag / set active)
            if (user.mustChangePassword) {
                await updateUserProfile(user.id, { status: 'active' });
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

            {/* Profile Photo Section */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
                <h2 className="text-lg font-semibold text-slate-800 mb-4">Foto de Perfil</h2>

                <div className="flex items-center gap-6">
                    <div className="relative group">
                        <img
                            src={user?.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || '')}`}
                            alt="Profile"
                            className="w-24 h-24 rounded-full object-cover border-4 border-slate-50 shadow-sm"
                        />
                        <label className="absolute bottom-0 right-0 p-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-full cursor-pointer shadow-md transition-transform hover:scale-105">
                            <input
                                type="file"
                                className="hidden"
                                accept="image/png, image/jpeg"
                                onChange={handlePhotoUpload}
                                disabled={uploading}
                            />
                            {uploading ? (
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <Camera size={16} />
                            )}
                        </label>
                    </div>

                    <div className="text-sm text-slate-500">
                        <p className="font-medium text-slate-700 mb-1">Alterar sua foto</p>
                        <p>Formatos permitidos: JPG, PNG.</p>
                        <p>Tamanho máximo: 3MB.</p>
                    </div>
                </div>
            </div>

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
