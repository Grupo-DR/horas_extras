import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface PrivateRouteProps {
    children?: React.ReactNode;
    requiredModule?: 'commercial' | 'human_capital' | 'construction';
}

export const PrivateRoute: React.FC<PrivateRouteProps> = ({ children, requiredModule }) => {
    const { isAuthenticated, loading, user, profile, hasModuleAccess } = useAuth();
    const location = useLocation();
    const isAccountRoute = location.pathname === '/config/account';

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
    if (user?.mustChangePassword && !isAccountRoute) {
        return <Navigate to="/config/account" replace />;
    }

    // Account settings are global and must remain reachable even when the user
    // does not have access to the commercial shell that declares this route.
    if (isAccountRoute) {
        return children ? <>{children}</> : <Outlet />;
    }

    // Module-level access guard
    if (requiredModule && !profile?.isSuperAdmin && !hasModuleAccess(requiredModule)) {
        // Redirect to the first module the user has access to
        if (hasModuleAccess('human_capital')) return <Navigate to="/human-capital" replace />;
        if (hasModuleAccess('commercial')) return <Navigate to="/" replace />;
        if (profile?.modules?.construction?.enabled) return <Navigate to="/construction" replace />;
        // No module access at all - show login
        return <Navigate to="/login" replace />;
    }

    return children ? <>{children}</> : <Outlet />;
};
