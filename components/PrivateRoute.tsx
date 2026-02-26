import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

// Define props to accept children
interface PrivateRouteProps {
    children?: React.ReactNode;
}

export const PrivateRoute: React.FC<PrivateRouteProps> = ({ children }) => {
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

    // Force Password Change / Account Activation
    if (user?.mustChangePassword && location.pathname !== '/config/account') {
        return <Navigate to="/config/account" replace />;
    }

    // Render children if provided, otherwise render Outlet
    return children ? <>{children}</> : <Outlet />;
};
