import { ContractData } from '../../types';

export interface ContractRepository {
  getAll(): Promise<ContractData[]>;
  getById(projectId: string): Promise<ContractData | null>;
  save(contract: ContractData): Promise<void>;
  update(contract: ContractData): Promise<void>;
  delete(projectId: string): Promise<void>;
}
