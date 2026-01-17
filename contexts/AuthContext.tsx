import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types/auth';
import { AuthService } from '../services/authService';
import { toast } from 'sonner';

interface AuthContextData {
    user: User | null;
    isAuthenticated: boolean;
    login: (email: string, password?: string) => Promise<void>;
    logout: () => void;
    loading: boolean;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const storedUser = localStorage.getItem('@Portal:User');
        if (storedUser) {
            setUser(JSON.parse(storedUser));
        }
        setLoading(false);
    }, []);

    const login = async (email: string, password?: string) => {
        try {
            const user = await AuthService.login(email, password);
            setUser(user);
            localStorage.setItem('@Portal:User', JSON.stringify(user));
        } catch (error) {
            // Error handling is managed by the caller (LoginPage) mainly for UI feedback, 
            // but we can log or re-throw.
            throw error;
        }
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem('@Portal:User');
        toast.info('Sessão encerrada.');
    };

    return (
        <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, logout, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
