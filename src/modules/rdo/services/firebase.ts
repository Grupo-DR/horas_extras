/**
 * services/firebase.ts
 *
 * Infraestrutura Firebase — SDK Modular v10+
 *
 * Exporta:
 *   - `app`  → instância FirebaseApp (singleton)
 *   - `db`   → instância Firestore (singleton)
 *
 * Variáveis de ambiente necessárias no .env (prefixo VITE_ para Vite):
 *   VITE_FIREBASE_API_KEY
 *   VITE_FIREBASE_AUTH_DOMAIN
 *   VITE_FIREBASE_PROJECT_ID
 *   VITE_FIREBASE_STORAGE_BUCKET
 *   VITE_FIREBASE_MESSAGING_SENDER_ID
 *   VITE_FIREBASE_APP_ID
 *
 * Nenhum outro arquivo foi alterado por este módulo.
 */

import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getFirestore, Firestore } from "firebase/firestore";

// ---------------------------------------------------------------------------
// Configuração lida das variáveis de ambiente Vite
// ---------------------------------------------------------------------------

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY            as string,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN        as string,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID         as string,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET     as string,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID             as string,
};

// ---------------------------------------------------------------------------
// Validação de configuração em desenvolvimento
// ---------------------------------------------------------------------------

if (import.meta.env.DEV) {
  const missingKeys = Object.entries(firebaseConfig)
    .filter(([, value]) => !value)
    .map(([key]) => `VITE_FIREBASE_${key.replace(/([A-Z])/g, '_$1').toUpperCase()}`);

  if (missingKeys.length > 0) {
    console.warn(
      `[firebase.ts] Variáveis de ambiente Firebase não encontradas:\n  ${missingKeys.join('\n  ')}\n` +
      `Adicione essas variáveis ao arquivo .env antes de usar o Firestore.`
    );
  }
}

// ---------------------------------------------------------------------------
// Inicialização singleton — evita múltiplas instâncias em HMR (Vite dev)
// ---------------------------------------------------------------------------

const app: FirebaseApp = getApps().length === 0
  ? initializeApp(firebaseConfig)
  : getApp();

const db: Firestore = getFirestore(app);

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export { app, db };
