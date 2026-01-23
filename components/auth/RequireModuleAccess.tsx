import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { ModuleKey, AccessLevel } from '../../types/auth';

interface RequireModuleAccessProps {
    module: ModuleKey;
    minAccess?: AccessLevel;
    redirectTo?: string;
    children?: React.ReactNode;
}

const RequireModuleAccess: React.FC<RequireModuleAccessProps> = ({
    module,
    minAccess = 'VIEW',
    redirectTo = '/unauthorized',
    children
}) => {
    const { user, loading } = useAuth();
    const location = useLocation();

    if (loading) {
        return <div className="flex items-center justify-center h-screen">Loading...</div>;
    }

    if (!user) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // Admin bypass
    if (user.systemRole === 'ADMIN') {
        return <>{children || <Outlet />}</>;
    }

    const userAccess = user.permissions?.[module] || 'NONE';

    // Helper to check access level hierarchy: NONE < VIEW < EDIT
    const hasAccess = () => {
        if (userAccess === 'NONE') return false;
        if (minAccess === 'VIEW') return userAccess === 'VIEW' || userAccess === 'EDIT';
        if (minAccess === 'EDIT') return userAccess === 'EDIT';
        return false;
    };

    if (!hasAccess()) {
        return <Navigate to={redirectTo} replace />;
    }

    return <>{children || <Outlet />}</>;
};

export default RequireModuleAccess;
