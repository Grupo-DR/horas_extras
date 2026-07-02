import { collection, doc, getDocs, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { COLLECTIONS } from '../constants/firestoreCollections';
import { RDOData } from '../../types';
import { RDORepository } from './RDORepository';

export class FirestoreRDORepository implements RDORepository {
  async getAll(): Promise<RDOData[]> {
    const snapshot = await getDocs(collection(db, COLLECTIONS.RDOS));
    return snapshot.docs.map((d) => d.data() as RDOData);
  }

  async getById(id: string): Promise<RDOData | null> {
    const snap = await getDoc(doc(db, COLLECTIONS.RDOS, id));
    return snap.exists() ? (snap.data() as RDOData) : null;
  }

  async save(rdo: RDOData): Promise<void> {
    await setDoc(doc(db, COLLECTIONS.RDOS, rdo.id), rdo);
  }

  async update(rdo: RDOData): Promise<void> {
    await setDoc(doc(db, COLLECTIONS.RDOS, rdo.id), rdo);
  }

  async delete(id: string): Promise<void> {
    await deleteDoc(doc(db, COLLECTIONS.RDOS, id));
  }
}
