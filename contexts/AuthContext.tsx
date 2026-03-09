import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, ModuleAccess, DEFAULT_MODULE_ACCESS, SystemRole } from '../types/auth';
import { auth, db, firebaseConfig } from '../services/firebaseConfig';
import {
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    User as FirebaseUser,
    getAuth,
    createUserWithEmailAndPassword
} from 'firebase/auth';
import {
    doc,
    updateDoc,
    deleteDoc,
    setDoc
} from 'firebase/firestore';
import { initializeApp } from 'firebase/app';
import { toast } from 'sonner';

// IAM Imports
import { UserProfileDoc, CommercialRole, Scope, canPlan, canManageProfiles, canReadAll } from '../src/modules/iam/types';
import { getOrCreateUserProfile, updateUserProfile, getUsersDirectory } from '../src/modules/iam/profileService';

interface AuthContextData {
    user: User | null; // Legacy User Object (Mapped)
    profile: UserProfileDoc | null; // New IAM Profile
    isAuthenticated: boolean;
    login: (email: string, password?: string) => Promise<void>;
    logout: () => Promise<void>;
    loading: boolean;

    // IAM Helpers
    hasModuleAccess: (module: 'commercial' | 'human_capital') => boolean;
    isProfileLoading: boolean;
    refreshProfile: () => Promise<void>;

    // Legacy Support for CRM Dropdowns
    users: User[];
    getUserById: (id: string) => User | undefined;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<UserProfileDoc | null>(null);
    const [users, setUsers] = useState<User[]>([]);
    const [usersById, setUsersById] = useState<Record<string, User>>({});
    const [loading, setLoading] = useState(true);
    const [isProfileLoading, setIsProfileLoading] = useState(true);

    // Adapter: Convert IAM Profile to Legacy User
    const mapProfileToLegacyUser = (p: UserProfileDoc): User => {
        let systemRole: SystemRole = 'VIEWER';
        let permissions = JSON.parse(JSON.stringify(DEFAULT_MODULE_ACCESS)); // Clone

        const isSuper = p.isSuperAdmin;
        const commRole = p.modules.commercial?.role;
        const commEnabled = p.modules.commercial?.enabled;

        // Commercial Logic
        if (isSuper || (commEnabled && commRole === 'COMMERCIAL_ADMIN')) {
            systemRole = 'ADMIN';
            Object.keys(permissions).forEach(k => permissions[k] = 'EDIT');
        } else if (commEnabled && commRole === 'COMMERCIAL_VIEWER') {
            systemRole = 'VIEWER';
            Object.keys(permissions).forEach(k => permissions[k] = 'VIEW');
            // Restrict settings/users even for viewer if needed, but keeping simple
            permissions.settings = 'NONE';
            permissions.users = 'NONE';
        } else if (commEnabled && commRole === 'IAM_ADMIN') {
            // IAM Admin might not see commercial dashboards but sees Users
            systemRole = 'VIEWER';
            permissions.users = 'EDIT';
            permissions.settings = 'VIEW';
        } else {
            // No commercial access
            Object.keys(permissions).forEach(k => permissions[k] = 'NONE');
        }

        return {
            id: p.uid,
            name: p.displayName,
            email: p.email,
            role: p.jobTitle || 'Colaborador',
            systemRole,
            permissions,
            avatarUrl: p.avatarUrl,
            mustChangePassword: p.status === 'invited',
            createdAt: p.createdAt,
            lastLoginAt: new Date().toISOString()
        };
    };

    // 1. Listen to Auth State
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            setLoading(true);
            setIsProfileLoading(true);

            if (firebaseUser) {
                try {
                    // Load or Create Profile (Firestore: user_profiles)
                    const userProfile = await getOrCreateUserProfile(firebaseUser);
                    setProfile(userProfile);
                    setUser(mapProfileToLegacyUser(userProfile));

                    // Load all users for CRM / Pipeline (Legacy Support securely from Directory)
                    try {
                        const directory = await getUsersDirectory();

                        // Active CRM Users
                        const activeDirectoryUsers: User[] = directory
                            .filter(d => d.status !== 'disabled')
                            .map(d => ({
                                id: d.uid,
                                name: d.displayName,
                                email: d.email,
                                role: d.jobTitle || 'Colaborador',
                                avatarUrl: d.avatarUrl,
                                // Dummy fields for CRM compatibility (to avoid strict type errors in old components)
                                systemRole: 'VIEWER' as SystemRole,
                                permissions: JSON.parse(JSON.stringify(DEFAULT_MODULE_ACCESS)),
                                mustChangePassword: d.status === 'invited',
                                createdAt: d.createdAt || new Date().toISOString(),
                                lastLoginAt: new Date().toISOString()
                            }));

                        setUsers(activeDirectoryUsers);

                        // O(1) Lookups Dictionary
                        const map: Record<string, User> = {};
                        activeDirectoryUsers.forEach(u => map[u.id] = u);
                        setUsersById(map);

                    } catch (err) {
                        console.warn('Could not load directory users', err);
                    }

                } catch (error) {
                    console.error("Failed to load user profile", error);
                    toast.error("Erro ao carregar perfil de usuário.");
                    setProfile(null);
                    setUser(null);
                }
            } else {
                setProfile(null);
                setUser(null);
                setUsers([]);
                setUsersById({});
            }

            setLoading(false);
            setIsProfileLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const hasModuleAccess = (module: 'commercial' | 'human_capital'): boolean => {
        if (!profile) return false;
        if (profile.isSuperAdmin) return true;

        return !!profile.modules[module]?.enabled;
    };

    const refreshProfile = async () => {
        const currentFirebaseUser = auth.currentUser;
        if (!currentFirebaseUser) return;
        try {
            const updatedProfile = await getOrCreateUserProfile(currentFirebaseUser);
            setProfile(updatedProfile);
            setUser(mapProfileToLegacyUser(updatedProfile));
        } catch (err) {
            console.error('Failed to refresh profile', err);
        }
    };


    const getUserById = (id: string) => {
        return usersById[id];
    };

    const login = async (email: string, password?: string) => {
        if (!password) throw new Error('Senha obrigatória');
        try {
            await signInWithEmailAndPassword(auth, email, password);
            toast.success('Login realizado com sucesso!');
        } catch (error: any) {
            console.error(error);
            let msg = 'Erro ao fazer login';
            if (error.code === 'auth/invalid-credential') msg = 'E-mail ou senha inválidos';
            if (error.code === 'auth/user-not-found') msg = 'Usuário não encontrado';
            if (error.code === 'auth/wrong-password') msg = 'Senha incorreta';
            throw new Error(msg);
        }
    };

    const logout = async () => {
        await signOut(auth);
        setUser(null);
        setProfile(null);
        toast.info('Sessão encerrada');
    };

    return (
        <AuthContext.Provider value={{
            user,
            profile,
            users,
            getUserById,
            isAuthenticated: !!user,
            loading,
            isProfileLoading,
            login,
            logout,
            hasModuleAccess,
            refreshProfile
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
