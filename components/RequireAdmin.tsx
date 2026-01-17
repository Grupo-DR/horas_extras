import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';

export const RequireAdmin: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user, loading } = useAuth();

    if (loading) {
        return null; // Or a spinner, but AuthContext handles initial loading usually
    }

    if (!user || user.systemRole !== 'ADMIN') {
        toast.error('Acesso negado. Apenas administradores podem acessar esta área.');
        return <Navigate to="/" replace />;
    }

    return <>{children}</>;
};
