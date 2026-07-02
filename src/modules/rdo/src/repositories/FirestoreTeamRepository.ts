import { collection, doc, getDocs, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { COLLECTIONS } from '../constants/firestoreCollections';
import { Team } from '../../types';
import { TeamRepository } from './TeamRepository';

export class FirestoreTeamRepository implements TeamRepository {
  async getAll(): Promise<Team[]> {
    const snapshot = await getDocs(collection(db, COLLECTIONS.TEAMS));
    return snapshot.docs.map((d) => d.data() as Team);
  }

  async getById(id: string): Promise<Team | null> {
    const snap = await getDoc(doc(db, COLLECTIONS.TEAMS, id));
    return snap.exists() ? (snap.data() as Team) : null;
  }

  async save(team: Team): Promise<void> {
    await setDoc(doc(db, COLLECTIONS.TEAMS, team.id), team);
  }

  async update(team: Team): Promise<void> {
    await setDoc(doc(db, COLLECTIONS.TEAMS, team.id), team);
  }

  async delete(id: string): Promise<void> {
    await deleteDoc(doc(db, COLLECTIONS.TEAMS, id));
  }
}
