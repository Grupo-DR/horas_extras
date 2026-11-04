import { ContractData } from '../types';

/**
 * Os dados de contrato ficam no Firestore (src/repositories/FirestoreContractRepository.ts).
 * Cópias antigas do localStorage são recuperadas por services/localRecoveryService.ts.
 */

/**
 * Retorna um ContractData vazio para um projeto (estado inicial).
 */
export const emptyContractData = (projectId: string): ContractData => ({
  projectId,
  contractValue: 0,
  contractStartDate: '',
  contractEndDate: '',
  monthlyEntries: [],
  addenda: [],
  updatedAt: new Date().toISOString(),
});
