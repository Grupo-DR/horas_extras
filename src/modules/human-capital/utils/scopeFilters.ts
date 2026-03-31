import { Scope } from '../../iam/types';
import { UserProfile } from '../types';
import { normalizeCC, getCCRegional } from '../data/ccMaster';

/**
 * Verifica se um centro de custo esta dentro de um escopo de HC.
 * Para escopo ausente ou `ALL`, retorna true.
 */
export const isCostCenterInHumanCapitalScope = (
  scope: Scope | undefined,
  rawCostCenter: string
): boolean => {
  if (!scope || scope.type === 'ALL') {
    return true;
  }

  const cc = normalizeCC(rawCostCenter || '');
  const reg = getCCRegional(rawCostCenter || '');

  if (scope.type === 'REGIONAL') {
    return scope.regionals.includes(reg);
  }

  if (scope.type === 'COST_CENTER') {
    return scope.costCenters.includes(cc);
  }

  return false;
};

/**
 * Verifica se um centro de custo esta dentro do escopo do usuario.
 * Para usuarios `ALL` e ausencia de escopo, retorna true.
 */
export const isRecordInHumanCapitalScope = (
  user: UserProfile | null,
  rawCostCenter: string
): boolean => {
  if (!user) {
    return true;
  }

  return isCostCenterInHumanCapitalScope(user.scope, rawCostCenter);
};
