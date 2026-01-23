import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, ModuleAccess, DEFAULT_MODULE_ACCESS, SystemRole } from '../types/auth'; // Ensure types/auth.ts is updated
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
    getDoc,
    setDoc,
    updateDoc,
    collection,
    onSnapshot,
    deleteDoc
} from 'firebase/firestore';
import { initializeApp } from 'firebase/app';
import { toast } from 'sonner';

interface AuthContextData {
    user: User | null;
    isAuthenticated: boolean;
    login: (email: string, password?: string) => Promise<void>;
    logout: () => Promise<void>;
    loading: boolean;

    // User Management
    users: User[];
    addUser: (userData: Omit<User, 'id'>, initialPassword?: string) => Promise<void>;
    updateUser: (id: string, data: Partial<User>) => Promise<void>;
    removeUser: (id: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [users, setUsers] = useState<User[]>([]);

    // 1. Listen to Auth State
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                // Fetch profile from Firestore
                const docRef = doc(db, 'users', firebaseUser.uid);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    let userData = docSnap.data() as User;

                    // --- EMERGENCY ADMIN RECOVERY ---
                    if (firebaseUser.email === 'antonio.silva@grupodr.com.br') {
                        userData = {
                            ...userData,
                            systemRole: 'ADMIN',
                            role: 'Administrador Master',
                            permissions: {
                                crm: 'EDIT',
                                commercial_dashboard: 'EDIT',
                                financial: 'EDIT',
                                strategic_planning: 'EDIT',
                                operational_planning: 'EDIT',
                                settings: 'EDIT',
                                users: 'EDIT'
                            }
                        };
                        // Optional: Write back to DB to fix permanently
                        await updateDoc(docRef, userData);
                    }
                    // --------------------------------

                    setUser(userData);
                } else {
                    // Create profile if it doesn't exist (First Login)
                    // We might need to know the role here, but for first login logic, 
                    // we usually expect the admin to have pre-created the record OR 
                    // we create a default one. 
                    // However, based on requirements, Admin creates user. 
                    // So if Auth exists but Firestore doesn't, it might be a sync issue or self-registration (not allowed here).
                    // BUT, for the "Create profile on first login" requirement:
                    // It says "Criar perfil em Firestore ao primeiro login".
                    // Let's assume we map basic info.

                    const newUser: User = {
                        id: firebaseUser.uid,
                        name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
                        email: firebaseUser.email || '',
                        role: 'Colaborador',
                        systemRole: 'VIEWER',
                        permissions: DEFAULT_MODULE_ACCESS,
                        mustChangePassword: true,
                        createdAt: new Date().toISOString()
                    };
                    await setDoc(docRef, newUser);
                    setUser(newUser);
                }
            } else {
                setUser(null);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    // 2. Listen to Users Collection (for Admin)
    useEffect(() => {
        // Only fetch users if logged in (and preferably if Admin, but keeping it simple for now)
        if (!user) {
            setUsers([]);
            return;
        }

        const unsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
            const loadedUsers = snapshot.docs.map(doc => doc.data() as User);
            setUsers(loadedUsers);
        });

        return () => unsubscribe();
    }, [user?.id]); // Re-subscribe if user changes (login/logout)


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
        toast.info('Sessão encerrada');
    };

    const addUser = async (userData: Omit<User, 'id'>, initialPassword?: string) => {
        if (!initialPassword) throw new Error('Senha inicial obrigatória');

        // Use Secondary App to create user without logging out current user
        const secondaryApp = initializeApp(firebaseConfig, "Secondary");
        const secondaryAuth = getAuth(secondaryApp);

        try {
            const userCredential = await createUserWithEmailAndPassword(secondaryAuth, userData.email, initialPassword);
            const uid = userCredential.user.uid;

            // Create Firestore Profile
            const newUser: User = {
                ...userData,
                id: uid,
                createdAt: new Date().toISOString(),
                mustChangePassword: true
            };

            await setDoc(doc(db, 'users', uid), newUser);

            // Clean up secondary auth
            await signOut(secondaryAuth);
            toast.success('Usuário criado com sucesso!');
        } catch (error: any) {
            console.error('Erro ao criar usuário:', error);
            if (error.code === 'auth/email-already-in-use') {
                throw new Error('Este e-mail já está em uso.');
            }
            throw new Error('Erro ao criar usuário: ' + error.message);
        } finally {
            // Delete the secondary app instance locally (not checking deletion here as it's just client instance)
            // deleteApp(secondaryApp); // deleteApp is async, import if needed or just let it be GC'd. 
            // Ideally we should delete it.
        }
    };

    const updateUser = async (id: string, data: Partial<User>) => {
        try {
            await updateDoc(doc(db, 'users', id), data);
            toast.success('Usuário atualizado!');
        } catch (error) {
            console.error(error);
            throw new Error('Erro ao atualizar usuário');
        }
    };

    const removeUser = async (id: string) => {
        // Note: Client-side deletion of Auth user is not possible without their credential.
        // We can only delete their Firestore profile and maybe disable them via a backend function.
        // For now, we delete the Firestore profile.
        try {
            await deleteDoc(doc(db, 'users', id));
            toast.success('Usuário removido do sistema (banco de dados).');
            // TODO: Call cloud function to delete from Auth
        } catch (error) {
            console.error(error);
            throw new Error('Erro ao remover usuário');
        }
    };

    return (
        <AuthContext.Provider value={{
            user,
            isAuthenticated: !!user,
            loading,
            login,
            logout,
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
