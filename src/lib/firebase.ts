
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// IMPORTANT: To point this app to a different Firebase project (e.g., "sipnread"),
// you MUST update the environment variables in your .env file (or your hosting environment)
// with the Firebase config values for that specific project.
// These values include NEXT_PUBLIC_FIREBASE_API_KEY, NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
// NEXT_PUBLIC_FIREBASE_PROJECT_ID (should be "sipnread"), NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET, etc.
// You can find these values in your Firebase project settings (Project settings > General > Your apps > Firebase SDK snippet > Config).

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Log the config to ensure it's being picked up correctly on the client
if (typeof window !== 'undefined') {
  console.log('[FirebaseContext] Initializing Firebase with config:', firebaseConfig);
  if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
    console.error('[FirebaseContext] CRITICAL: Firebase API Key or Project ID is missing from the config. Login will likely fail. Check .env.local and NEXT_PUBLIC_ prefixes.');
  }
}

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };
