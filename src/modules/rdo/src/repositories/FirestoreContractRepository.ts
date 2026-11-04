import { collection, doc, getDocs, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { withFirestoreError } from '../../services/firestoreErrors';
import { COLLECTIONS } from '../constants/firestoreCollections';
import { ContractData } from '../../types';
import { ContractRepository } from './ContractRepository';

/**
 * Dados de contrato de cada obra (Document ID = projectId).
 * Até a versão 1.4.2 havia uma cópia no localStorage e falhas de gravação eram ignoradas;
 * agora o Firestore é a única fonte. Cópias antigas: services/localRecoveryService.ts.
 */
export class FirestoreContractRepository implements ContractRepository {
  async getAll(): Promise<ContractData[]> {
    return withFirestoreError('carregar os dados de contrato', async () => {
      const snapshot = await getDocs(collection(db, COLLECTIONS.CONTRACTS));
      return snapshot.docs.map((d) => ({ ...d.data(), projectId: d.data().projectId ?? d.id }) as ContractData);
    });
  }

  async getById(projectId: string): Promise<ContractData | null> {
    return withFirestoreError('carregar os dados de contrato', async () => {
      const snap = await getDoc(doc(db, COLLECTIONS.CONTRACTS, projectId));
      return snap.exists() ? (snap.data() as ContractData) : null;
    });
  }

  async save(contract: ContractData): Promise<void> {
    await withFirestoreError('salvar os dados de contrato', () =>
      setDoc(doc(db, COLLECTIONS.CONTRACTS, contract.projectId), {
        ...contract,
        updatedAt: new Date().toISOString(),
      })
    );
  }

  async update(contract: ContractData): Promise<void> {
    await this.save(contract);
  }

  async delete(projectId: string): Promise<void> {
    await withFirestoreError('excluir os dados de contrato', () =>
      deleteDoc(doc(db, COLLECTIONS.CONTRACTS, projectId))
    );
  }
}
