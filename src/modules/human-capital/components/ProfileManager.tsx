
import React, { useState } from 'react';
import { UserProfile } from '../types';
import { getAvailableUsers } from '../services/auth';
import { User, Shield, ChevronDown, Check } from 'lucide-react';

interface ProfileManagerProps {
    currentUser: UserProfile;
    onProfileChange: (user: UserProfile) => void;
}

const ProfileManager: React.FC<ProfileManagerProps> = ({ currentUser, onProfileChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const users = getAvailableUsers();

    const handleSelect = (user: UserProfile) => {
        onProfileChange(user);
        setIsOpen(false);
    };

    const roleColors: Record<string, string> = {
        'DEV_MASTER': 'bg-purple-100 text-purple-700 border-purple-200',
        'MASTER': 'bg-red-100 text-red-700 border-red-200',
        'LEVEL_A_01': 'bg-blue-100 text-blue-700 border-blue-200',
        'LEVEL_B_01': 'bg-green-100 text-green-700 border-green-200',
        'LEVEL_C_01': 'bg-orange-100 text-orange-700 border-orange-200',
    };

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-3 bg-white hover:bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 transition-all shadow-sm group"
            >
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold shadow-md group-hover:shadow-lg transition-shadow">
                    {currentUser.avatar || currentUser.name.charAt(0)}
                </div>
                <div className="text-left hidden md:block">
                    <p className="text-xs font-bold text-gray-800">{currentUser.name}</p>
                    <div className="flex items-center gap-1">
                        <Shield size={10} className="text-gray-400" />
                        <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wide">{currentUser.role.replace(/_/g, ' ')}</p>
                    </div>
                </div>
                <ChevronDown size={14} className={`text-gray-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <>
                    <div
                        className="fixed inset-0 z-40 bg-black/10 backdrop-blur-[1px]"
                        onClick={() => setIsOpen(false)}
                    />
                    <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden ring-4 ring-black/5 animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-4 border-b border-gray-50 bg-gray-50/50">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                <User size={12} /> Selecionar Perfil (Simulação)
                            </p>
                        </div>

                        <div className="max-h-[300px] overflow-y-auto p-2 space-y-1">
                            {users.map((user) => (
                                <button
                                    key={user.id}
                                    onClick={() => handleSelect(user)}
                                    className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left group ${currentUser.id === user.id
                                            ? 'bg-blue-50 border border-blue-100 shadow-sm'
                                            : 'hover:bg-gray-50 border border-transparent'
                                        }`}
                                >
                                    <div className="relative">
                                        <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-lg shadow-sm border border-gray-200 group-hover:scale-105 transition-transform">
                                            {user.avatar || user.name.charAt(0)}
                                        </div>
                                        {currentUser.id === user.id && (
                                            <div className="absolute -bottom-1 -right-1 bg-blue-500 text-white rounded-full p-0.5 border-2 border-white">
                                                <Check size={8} strokeWidth={4} />
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <p className={`text-xs font-bold truncate ${currentUser.id === user.id ? 'text-blue-700' : 'text-gray-700'}`}>
                                            {user.name}
                                        </p>
                                        <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider mt-1 ${roleColors[user.role] || 'bg-gray-100 text-gray-600'}`}>
                                            {user.role}
                                        </span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default ProfileManager;
