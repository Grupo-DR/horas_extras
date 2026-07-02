import { RDOData } from '../../types';

export interface RDORepository {
  getAll(): Promise<RDOData[]>;
  getById(id: string): Promise<RDOData | null>;
  save(rdo: RDOData): Promise<void>;
  update(rdo: RDOData): Promise<void>;
  delete(id: string): Promise<void>;
}
