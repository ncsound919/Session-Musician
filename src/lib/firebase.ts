/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, query, where, getDocs, orderBy, limit, doc, updateDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { getAuth, onAuthStateChanged, signInAnonymously, User } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Only initialize if config is present to avoid invalid key errors
export const app = firebaseConfig ? initializeApp(firebaseConfig) : null;
export const db = app ? getFirestore(app, firebaseConfig.firestoreDatabaseId) : null as any;
export const auth = app ? getAuth(app) : null as any;

export interface SavedSession {
  id: string;
  song: any;
  instrumentStates: any;
  updatedAt: any;
  name: string;
}

export const loginAnonymously = async (): Promise<User | null> => {
  if (!auth) {
    console.warn("Firebase Auth not initialized. Check configuration.");
    return null;
  }
  try {
    const userCredential = await signInAnonymously(auth);
    return userCredential.user;
  } catch (error) {
    console.error("Auth failed:", error);
    return null;
  }
};

export const saveSession = async (userId: string, name: string, song: any, instrumentStates: any, sessionId?: string) => {
  if (!db) {
    console.warn("Firestore not initialized. Cannot save session.");
    return null;
  }
  try {
    const data = {
      userId,
      name,
      song,
      instrumentStates,
      bpm: song.bpm,
      key: song.key,
      updatedAt: serverTimestamp()
    };

    if (sessionId) {
      const docRef = doc(db, 'sessions', sessionId);
      await updateDoc(docRef, data);
      return sessionId;
    } else {
      const docRef = await addDoc(collection(db, 'sessions'), data);
      return docRef.id;
    }
  } catch (error) {
    console.error("Save failed:", error);
    throw error;
  }
};

export const loadLatestSession = async (userId: string): Promise<SavedSession | null> => {
  if (!db) {
    console.warn("Firestore not initialized. Cannot load session.");
    return null;
  }
  try {
    const q = query(
      collection(db, 'sessions'),
      where('userId', '==', userId),
      orderBy('updatedAt', 'desc'),
      limit(1)
    );
    
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      const d = querySnapshot.docs[0];
      return {
        id: d.id,
        ...d.data()
      } as SavedSession;
    }
    return null;
  } catch (error) {
    console.error("Load failed:", error);
    return null;
  }
};
