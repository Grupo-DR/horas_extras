import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { initializeFirestore, Firestore } from 'firebase/firestore';
import { getAuth, setPersistence, browserLocalPersistence, Auth } from 'firebase/auth';

export const firebaseConfig = {
    apiKey: "AIzaSyCCIPZr7nfdZZKHPQ5VdwIzwglSM7bXapo",
    authDomain: "kanbancomercial-af561.firebaseapp.com",
    projectId: "kanbancomercial-af561",
    storageBucket: "kanbancomercial-af561.appspot.com",
    messagingSenderId: "1034446322680",
    appId: "1:1034446322680:web:d3d8778a6131d9bb22740d",
    measurementId: "G-SR7KRPM38D"
};

import { getStorage, FirebaseStorage } from 'firebase/storage';

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let storage: FirebaseStorage;

if (!getApps().length) {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    // Persistence is local by default in web, but explicitly setting it is fine
    setPersistence(auth, browserLocalPersistence).catch(console.error);

    db = initializeFirestore(app, {
        ignoreUndefinedProperties: true
    });

    storage = getStorage(app);
} else {
    app = getApp();
    auth = getAuth(app);
    db = initializeFirestore(app, {
        ignoreUndefinedProperties: true
    });
    storage = getStorage(app);
}

export { app, auth, db, storage };
