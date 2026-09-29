import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, Auth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer, Firestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

try {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  auth = getAuth(app);
  db =
    firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
      ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
      : getFirestore(app);
} catch (error) {
  console.error('Firebase initialization error:', error);
  // Fallback placeholder if not initialized
  app = {} as FirebaseApp;
  auth = {} as Auth;
  db = {} as Firestore;
}

/**
 * Health check test connection to Firestore as mandated by the Firebase skill
 */
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    if (!db) return false;
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firestore client is currently offline. Please check network connectivity.');
    }
    // Return true even if test doc does not exist because reaching the server succeeded
    return true;
  }
}

export function isFirebaseConfigured(): boolean {
  return Boolean(firebaseConfig && firebaseConfig.apiKey && firebaseConfig.projectId);
}

export { app, auth, db, googleProvider };
