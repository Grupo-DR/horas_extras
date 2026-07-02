import { collection, doc, getDocs, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { COLLECTIONS } from '../constants/firestoreCollections';
import { Project } from '../../types';
import { ProjectRepository } from './ProjectRepository';

export class FirestoreProjectRepository implements ProjectRepository {
  async getAll(): Promise<Project[]> {
    const snapshot = await getDocs(collection(db, COLLECTIONS.PROJECTS));
    return snapshot.docs.map((d) => d.data() as Project);
  }

  async getById(id: string): Promise<Project | null> {
    const snap = await getDoc(doc(db, COLLECTIONS.PROJECTS, id));
    return snap.exists() ? (snap.data() as Project) : null;
  }

  async save(project: Project): Promise<void> {
    await setDoc(doc(db, COLLECTIONS.PROJECTS, project.id), project);
  }

  async update(project: Project): Promise<void> {
    await setDoc(doc(db, COLLECTIONS.PROJECTS, project.id), project);
  }

  async delete(id: string): Promise<void> {
    await deleteDoc(doc(db, COLLECTIONS.PROJECTS, id));
  }
}
