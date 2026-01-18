import { useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { User } from '../types';

export const useEntityLookup = () => {
    const { users } = useAuth();

    const getInternalUser = useCallback((id: string): User | undefined => {
        return users.find(u => u.id === id);
    }, [users]);

    return {
        getInternalUser
    };
};
