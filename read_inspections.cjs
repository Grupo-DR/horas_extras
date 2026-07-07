const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');
const firebaseConfig = { projectId: 'lume-b68e9' };
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
getDocs(collection(db, 'ssma_inspections')).then(snap => {
  console.log(JSON.stringify(snap.docs.map(d => ({id: d.id, ...d.data()})), null, 2));
  process.exit(0);
});
