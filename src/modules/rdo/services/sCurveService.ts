import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { withFirestoreError } from './firestoreErrors';
import { COLLECTIONS } from '../src/constants/firestoreCollections';
import { SCurveDoc } from '../types';

/** Curva S da obra (Document ID = projectId); null se ainda não foi criada. */
export const getSCurve = async (projectId: string): Promise<SCurveDoc | null> =>
  withFirestoreError('carregar a Curva S', async () => {
    const snap = await getDoc(doc(db, COLLECTIONS.S_CURVES, projectId));
    return snap.exists() ? (snap.data() as SCurveDoc) : null;
  });

export const saveSCurve = async (curve: SCurveDoc): Promise<SCurveDoc> => {
  const saved = { ...curve, updatedAt: new Date().toISOString() };
  await withFirestoreError('salvar a Curva S', () => setDoc(doc(db, COLLECTIONS.S_CURVES, curve.projectId), saved));
  return saved;
};
