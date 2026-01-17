import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types/auth';
import { AuthService } from '../services/authService';
import { toast } from 'sonner';
import { OFFICIAL_USERS } from '../constants';

interface AuthContextData {
    user: User | null;
    isAuthenticated: boolean;
    login: (email: string, password?: string) => Promise<void>;
    logout: () => void;
    loading: boolean;

    // User Management
    users: User[];
    addUser: (userData: Omit<User, 'id'>) => void;
    updateUser: (id: string, data: Partial<User>) => void;
    removeUser: (id: string) => void;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);

    // Initial Load
    useEffect(() => {
        const loadData = () => {
            // 1. Load Session
            const storedSession = localStorage.getItem('@Portal:User');
            if (storedSession) {
                setUser(JSON.parse(storedSession));
            }

            // 2. Load Users DB
            const storedUsersDB = localStorage.getItem('@construtora:users_db');
            if (storedUsersDB) {
                setUsers(JSON.parse(storedUsersDB));
            } else {
                // Initialize with Official Users if empty
                // We need to map them to the correct structure if they aren't already fully compatible,
                // but checking authService, they seem to be mapped on login. 
                // Let's assume OFFICIAL_USERS need to be mapped to have 'systemRole'.
                // Ideally, we should unify this mapping. For now, let's map them.

                // Helper to map role (duplicated from authService for simplicity/independence here or import?)
                // Better to map them here once.
                const mapToSystemRole = (originalRole: string): 'ADMIN' | 'EDITOR' | 'VIEWER' => {
                    if (originalRole.includes('Diretor') || originalRole.includes('Gerente')) return 'ADMIN';
                    if (originalRole.includes('Aprendiz') || originalRole.includes('Trainee')) return 'VIEWER';
                    return 'EDITOR';
                };

                const initialUsers: User[] = OFFICIAL_USERS.map(u => ({
                    id: u.id,
                    name: u.name,
                    email: u.email,
                    role: u.role || 'Colaborador',
                    systemRole: mapToSystemRole(u.role || ''),
                    avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&background=random`
                }));

                setUsers(initialUsers);
                localStorage.setItem('@construtora:users_db', JSON.stringify(initialUsers));
            }

            setLoading(false);
        };

        loadData();
    }, []);

    const login = async (email: string, password?: string) => {
        try {
            // Updated Login: Check against LOCAL users state, not just the static service simulation
            // This ensures we can login with newly created users.

            // Simulate Network Delay
            await new Promise(resolve => setTimeout(resolve, 500));

            const foundUser = users.find(u => u.email.toLowerCase() === email.toLowerCase());

            if (!foundUser) {
                throw new Error('Usuário não encontrado. Verifique o e-mail digitado.');
            }

            setUser(foundUser);
            localStorage.setItem('@Portal:User', JSON.stringify(foundUser));
        } catch (error) {
            throw error;
        }
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem('@Portal:User');
        toast.info('Sessão encerrada.');
    };

    // --- CRUD Operations ---

    const addUser = (userData: Omit<User, 'id'>) => {
        const newUser: User = {
            ...userData,
            id: crypto.randomUUID(), // Native UUID
            avatarUrl: userData.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.name)}&background=random`
        };

        const updatedUsers = [...users, newUser];
        setUsers(updatedUsers);
        localStorage.setItem('@construtora:users_db', JSON.stringify(updatedUsers));
        toast.success('Usuário adicionado com sucesso!');
    };

    const updateUser = (id: string, data: Partial<User>) => {
        const updatedUsers = users.map(u => u.id === id ? { ...u, ...data } : u);
        setUsers(updatedUsers);
        localStorage.setItem('@construtora:users_db', JSON.stringify(updatedUsers));

        // If updating the current logged user, update session too
        if (user && user.id === id) {
            const updatedCurrentUser = { ...user, ...data };
            setUser(updatedCurrentUser);
            localStorage.setItem('@Portal:User', JSON.stringify(updatedCurrentUser));
        }

        toast.success('Usuário atualizado com sucesso!');
    };

    const removeUser = (id: string) => {
        const updatedUsers = users.filter(u => u.id !== id);
        setUsers(updatedUsers);
        localStorage.setItem('@construtora:users_db', JSON.stringify(updatedUsers));
        toast.success('Usuário removido com sucesso!');
    };

    return (
        <AuthContext.Provider value={{
            user,
            isAuthenticated: !!user,
            login,
            logout,
            loading,
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
