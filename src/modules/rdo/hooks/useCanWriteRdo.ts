import { useAuth } from '../../../../contexts/AuthContext';

/** Papéis que gravam no RDO Online (mesmo critério de canWriteModule nas regras do Firestore). */
const WRITE_ROLES = ['CONSTRUCTION_ADMIN', 'CONSTRUCTION_MANAGER'];

/** Gerente, Administrador ou super admin; o Visualizador só lê. */
export const useCanWriteRdo = (): boolean => {
  const { profile } = useAuth();
  const rdoModule = profile?.modules?.construction_rdo;
  return !!profile?.isSuperAdmin || (!!rdoModule?.enabled && WRITE_ROLES.includes(rdoModule.role ?? ''));
};
