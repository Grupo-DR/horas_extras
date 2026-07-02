import { collection, doc, getDocs, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { COLLECTIONS } from '../constants/firestoreCollections';
import { ContractData } from '../../types';
import { ContractRepository } from './ContractRepository';

const STORAGE_PREFIX = 'contract_data_';

export class FirestoreContractRepository implements ContractRepository {
  async getAll(): Promise<ContractData[]> {
    const snapshot = await getDocs(collection(db, COLLECTIONS.CONTRACTS));
    return snapshot.docs.map((d) => d.data() as ContractData);
  }

  async getById(projectId: string): Promise<ContractData | null> {
    try {
      const snap = await getDoc(doc(db, COLLECTIONS.CONTRACTS, projectId));
      if (snap.exists()) {
        const data = snap.data() as ContractData;
        localStorage.setItem(`${STORAGE_PREFIX}${projectId}`, JSON.stringify(data));
        return data;
      }
    } catch (e) {
      console.warn(`Firestore Contract get failed for project ${projectId} — tentando cache local.`, e);
    }

    const raw = localStorage.getItem(`${STORAGE_PREFIX}${projectId}`);
    return raw ? (JSON.parse(raw) as ContractData) : null;
  }

  async save(contract: ContractData): Promise<void> {
    localStorage.setItem(
      `${STORAGE_PREFIX}${contract.projectId}`,
      JSON.stringify({ ...contract, updatedAt: new Date().toISOString() })
    );

    try {
      await setDoc(doc(db, COLLECTIONS.CONTRACTS, contract.projectId), contract);
    } catch (e) {
      console.warn(`Firestore Contract save failed for project ${contract.projectId}`, e);
    }
  }

  async update(contract: ContractData): Promise<void> {
    await this.save(contract);
  }

  async delete(projectId: string): Promise<void> {
    localStorage.removeItem(`${STORAGE_PREFIX}${projectId}`);
    try {
      await deleteDoc(doc(db, COLLECTIONS.CONTRACTS, projectId));
    } catch (e) {
      console.warn(`Firestore Contract delete failed for project ${projectId}`, e);
    }
  }
}
