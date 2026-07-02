import { Team } from '../../types';

export interface TeamRepository {
  getAll(): Promise<Team[]>;
  getById(id: string): Promise<Team | null>;
  save(team: Team): Promise<void>;
  update(team: Team): Promise<void>;
  delete(id: string): Promise<void>;
}
