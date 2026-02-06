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
import { getOrCreateUserProfile, updateUserProfile } from '../src/modules/iam/profileService';

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

    // Legacy User Management (Kept for compatibility, but might need refactor)
    users: User[];
    addUser: (userData: Omit<User, 'id'>, initialPassword?: string) => Promise<void>;
    updateUser: (id: string, data: Partial<User>) => Promise<void>;
    removeUser: (id: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<UserProfileDoc | null>(null);
    const [loading, setLoading] = useState(true);
    const [isProfileLoading, setIsProfileLoading] = useState(true);
    const [users, setUsers] = useState<User[]>([]);

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
            mustChangePassword: false,
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
                } catch (error) {
                    console.error("Failed to load user profile", error);
                    toast.error("Erro ao carregar perfil de usuário.");
                    setProfile(null);
                    setUser(null);
                }
            } else {
                setProfile(null);
                setUser(null);
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

    // Legacy Add User (Modified to create Profile in user_profiles as well?)
    // For now, keeping legacy behavior but noting it might need update.
    // Use the ProfileManager for real IAM management.
    const addUser = async (userData: Omit<User, 'id'>, initialPassword?: string) => {
        if (!initialPassword) throw new Error('Senha inicial obrigatória');
        const secondaryApp = initializeApp(firebaseConfig, "Secondary");
        const secondaryAuth = getAuth(secondaryApp);

        try {
            const userCredential = await createUserWithEmailAndPassword(secondaryAuth, userData.email, initialPassword);
            const uid = userCredential.user.uid;

            // Create Legacy User Doc (users) - Keeping for compatibility if needed
            // await setDoc(doc(db, 'users', uid), { ...userData, id: uid });

            // Create IAM Profile (user_profiles)
            // We can't use getOrCreateUserProfile because we aren't logged in as them.
            // Manually create:
            const newProfile: UserProfileDoc = {
                uid,
                email: userData.email,
                displayName: userData.name,
                modules: {
                    commercial: {
                        enabled: true, // Legacy default behavior
                        role: 'COMMERCIAL_VIEWER'
                    },
                    human_capital: {
                        enabled: false,
                        role: 'HC_AUDITOR_VIEWER',
                        scope: { type: 'ALL' }
                    }
                },
                createdAt: new Date().toISOString(),
                createdBy: user?.id || 'system',
                updatedAt: new Date().toISOString(),
                updatedBy: user?.id || 'system'
            };

            await setDoc(doc(db, 'user_profiles', uid), newProfile);

            await signOut(secondaryAuth);
            toast.success('Usuário criado com sucesso!');
        } catch (error: any) {
            console.error('Erro ao criar usuário:', error);
            throw new Error('Erro: ' + error.message);
        }
    };

    // Stubbed legacy updates
    const updateUser = async (id: string, data: Partial<User>) => {
        // This updates 'users' collection. 
        // Ideally should update 'user_profiles'.
        // For now, no-op or log warning.
        console.warn("Legacy updateUser called. Use ProfileManager.");
    };

    const removeUser = async (id: string) => {
        try {
            await deleteDoc(doc(db, 'user_profiles', id));
            // await deleteDoc(doc(db, 'users', id));
            toast.success('Perfil removido.');
        } catch (error) {
            console.error(error);
            throw new Error('Erro ao remover usuário');
        }
    };

    return (
        <AuthContext.Provider value={{
            user,
            profile,
            isAuthenticated: !!user,
            loading,
            isProfileLoading,
            login,
            logout,
            hasModuleAccess,
            users,
            addUser,
            updateUser,
            removeUser
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
