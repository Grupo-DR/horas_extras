import { Project } from '../../types';

export interface ProjectRepository {
  getAll(): Promise<Project[]>;
  getById(id: string): Promise<Project | null>;
  save(project: Project): Promise<void>;
  update(project: Project): Promise<void>;
  delete(id: string): Promise<void>;
}
