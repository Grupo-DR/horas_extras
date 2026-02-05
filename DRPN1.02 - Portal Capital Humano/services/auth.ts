import { UserProfile } from '../types';

// Mock Users to simulate the system
const MOCK_USERS: UserProfile[] = [
  {
    id: '1',
    name: 'Desenvolvedor Master',
    email: 'dev@totvs.com.br',
    role: 'DEV_MASTER',
    avatar: '👨‍💻'
  },
  {
    id: '2',
    name: 'Gerente Master',
    email: 'admin@empresa.com.br',
    role: 'MASTER',
    avatar: '👔'
  },
  {
    id: '3',
    name: 'Diretor (Nível A)',
    email: 'diretor@empresa.com.br',
    role: 'LEVEL_A_01',
    avatar: '📈'
  },
  {
    id: '4',
    name: 'Gestor de Obras (Nível B)',
    email: 'gestor@empresa.com.br',
    role: 'LEVEL_B_01',
    costCenter: '303702', // Matches mock data
    avatar: '👷'
  },
  {
    id: '5',
    name: 'Maria Silva (Nível C)',
    email: 'maria@empresa.com.br',
    role: 'LEVEL_C_01',
    chapa: '9999', // Matches mock data
    costCenter: '101010',
    avatar: '👩‍💼'
  }
];

export const authenticateUser = async (email: string): Promise<UserProfile | null> => {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 500));
  const user = MOCK_USERS.find(u => u.email === email);
  return user || null;
};

export const getAvailableUsers = () => MOCK_USERS;

// Helper to check permissions
export const canManageProfiles = (role: string) => ['DEV_MASTER', 'MASTER'].includes(role);
export const canPlan = (role: string) => ['DEV_MASTER', 'MASTER', 'LEVEL_A_01', 'LEVEL_B_01'].includes(role);
export const isRestrictedToCostCenter = (role: string) => role === 'LEVEL_B_01';
export const isRestrictedToSelf = (role: string) => role === 'LEVEL_C_01';
