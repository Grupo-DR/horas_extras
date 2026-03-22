import { UserProfile } from '../types';
import { normalizeCC, getCCRegional } from '../data/ccMaster';

/**
 * Verifica se um centro de custo está dentro do escopo do usuário.
 * Para usuários 'ALL' e ausência de escopo, retorna true livremente.
 * @param user Perfil do usuário logado
 * @param rawCostCenter O código do centro de custo bruto a ser avaliado
 */
export const isRecordInHumanCapitalScope = (
  user: UserProfile | null,
  rawCostCenter: string
): boolean => {
  if (!user || !user.scope || user.scope.type === 'ALL') {
    return true;
  }

  const cc = normalizeCC(rawCostCenter || '');
  const reg = getCCRegional(rawCostCenter || '');

  if (user.scope.type === 'REGIONAL') {
    return user.scope.regionals.includes(reg);
  }

  if (user.scope.type === 'COST_CENTER') {
    return user.scope.costCenters.includes(cc);
  }

  return false;
};
