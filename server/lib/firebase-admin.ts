import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

// Initialize Firebase Admin (only once)
if (!getApps().length) {
  try {
    // Initialize with minimal config - projectId only
    // Firebase Admin will use application default credentials if available
    // For Firestore operations in development, we can still use the Firestore client
    initializeApp({
      projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    });
    console.log('Firebase Admin initialized successfully');
  } catch (error) {
    console.error('Firebase Admin initialization error:', error);
    console.warn('Note: For full functionality, set up Firebase Admin service account credentials');
  }
}

export const adminDb = getFirestore();
export const adminAuth = getAuth();
