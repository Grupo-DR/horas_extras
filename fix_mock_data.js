import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, updateDoc, doc } from 'firebase/firestore';

const firebaseConfig = { projectId: 'lume-b68e9' };
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const MOCKED_NAMES = ['Ricardo Santos', 'Aline Martins', 'José Silva', 'Eduardo Reis', 'GREG Norte', 'Simulado (Engenheiro de Obra)'];

async function fixMockedData() {
  const snapshot = await getDocs(collection(db, 'ssma_inspections'));
  let updatedCount = 0;
  
  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();
    let needsUpdate = false;
    const updateData: any = {};

    if (data.gestor === 'Ricardo Santos') { updateData.gestor = 'Não atribuído'; needsUpdate = true; }
    if (data.supssma === 'Aline Martins') { updateData.supssma = 'Não atribuído'; needsUpdate = true; }
    if (data.encarregado === 'José Silva') { updateData.encarregado = 'Não atribuído'; needsUpdate = true; }
    if (data.tst === 'Eduardo Reis') { updateData.tst = 'Não atribuído'; needsUpdate = true; }
    if (data.greg === 'GREG Norte') { updateData.greg = 'Não atribuído'; needsUpdate = true; }

    if (data.evidencias && Array.isArray(data.evidencias)) {
      let evChanged = false;
      const newEvidencias = data.evidencias.map((ev: any) => {
        let changed = false;
        if (ev.executorNome === 'Simulado (Engenheiro de Obra)') { ev.executorNome = data.createdBy || 'Sistema'; changed = true; }
        if (ev.executorRole === 'Engenheiro de Obra' && data.createdBy) {
            // Can't easily map the correct role here without IAM, but at least we can fix the name if it's simulated.
        }
        if (changed) evChanged = true;
        return ev;
      });
      if (evChanged) {
        updateData.evidencias = newEvidencias;
        needsUpdate = true;
      }
    }

    if (needsUpdate) {
      await updateDoc(doc(db, 'ssma_inspections', docSnap.id), updateData);
      updatedCount++;
      console.log(`Updated doc ${docSnap.id}`);
    }
  }
  
  console.log(`Finished. Updated ${updatedCount} documents.`);
  process.exit(0);
}

fixMockedData().catch(console.error);
