import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { initializeFirestore, Firestore } from 'firebase/firestore';
import { getAuth, setPersistence, browserLocalPersistence, Auth } from 'firebase/auth';

export const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
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
