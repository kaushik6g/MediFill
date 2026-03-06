import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, initializeAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { Platform } from 'react-native';

const firebaseConfig = {
  apiKey: 'AIzaSyCogyzEhPaUR1JDAAHpYanWTjoSzHeNUSs',
  authDomain: 'medifill-ff219.firebaseapp.com',
  projectId: 'medifill-ff219',
  storageBucket: 'medifill-ff219.firebasestorage.app',
  messagingSenderId: '466309086754',
  appId: '1:466309086754:web:f6d8dbf9c3f2958eb3547b',
  measurementId: 'G-SKQP1HGSYM',
};

// Initialize Firebase — avoid duplicate initialization
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Auth — use the standard getAuth (works on web + Expo Go)
let auth: ReturnType<typeof getAuth>;
try {
  // On native with Expo Go we must use getAuth (not initializeAuth with persistence)
  auth = getAuth(app);
} catch {
  auth = getAuth(app);
}

// Firestore
const db = getFirestore(app);

export { app, auth, db };
