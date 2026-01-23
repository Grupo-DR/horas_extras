import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export const PrivateRoute: React.FC = () => {
    const { isAuthenticated, loading, user } = useAuth(); // Destructure user
    const location = useLocation();

    if (loading) {
        return (
            <div className="h-screen w-full flex items-center justify-center bg-black text-white">
                <div className="animate-pulse">Autenticando...</div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    // Force Password Change
    if (user?.mustChangePassword && location.pathname !== '/config/conta') {
        return <Navigate to="/config/conta" replace />;
    }

    return <Outlet />;
};
