const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');
const firebaseConfig = { projectId: 'lume-b68e9' };
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
getDocs(collection(db, 'users')).then(snap => {
  const user = snap.docs.find(d => d.data().displayName === '01teste');
  console.log(JSON.stringify(user ? user.data() : null, null, 2));
  process.exit(0);
});
