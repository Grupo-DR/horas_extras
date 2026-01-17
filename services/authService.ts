import { OFFICIAL_USERS } from '../constants';
import { User, SystemRole } from '../types/auth';

const ROLE_MAP: Record<string, SystemRole> = {
    'Diretor': 'ADMIN',
    'Gerente': 'ADMIN',
    'Coordenador': 'EDITOR',
    'Analista': 'EDITOR',
    'Aprendiz': 'VIEWER',
    'Trainee': 'VIEWER'
};

const mapToSystemRole = (originalRole: string): SystemRole => {
    // Simple keyword matching
    if (originalRole.includes('Diretor') || originalRole.includes('Gerente')) return 'ADMIN';
    if (originalRole.includes('Aprendiz') || originalRole.includes('Trainee')) return 'VIEWER';
    return 'EDITOR';
};

export const AuthService = {
    login: async (email: string, password?: string): Promise<User> => {
        // Simulate Network Delay
        await new Promise(resolve => setTimeout(resolve, 500));

        // Mock Password Check (accepts the specific one or any non-empty in prod envs if we wanted)
        // For now, we just pass through to allow access.

        const foundUser = OFFICIAL_USERS.find(u => u.email.toLowerCase() === email.toLowerCase());

        if (!foundUser) {
            throw new Error('Usuário não encontrado. Verifique o e-mail digitado.');
        }

        const systemRole = mapToSystemRole(foundUser.role || '');

        return {
            id: foundUser.id,
            name: foundUser.name,
            email: foundUser.email,
            role: foundUser.role,
            systemRole,
            avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(foundUser.name)}&background=random`
        };
    }
};
