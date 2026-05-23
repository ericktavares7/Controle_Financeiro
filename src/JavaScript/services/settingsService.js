import {
  doc,
  setDoc,
  getDoc
} from 'firebase/firestore';

import { db, auth } from '../firebase.js';

export async function saveUserSettings(settings) {
  if (!auth.currentUser) return;

  await setDoc(
    doc(db, 'configuracoes', auth.currentUser.uid),
    {
      userId: auth.currentUser.uid,
      ...settings,
      updatedAt: new Date()
    },
    { merge: true }
  );
}

export async function getUserSettings(uid) {
  const ref = doc(db, 'configuracoes', uid);
  const snapshot = await getDoc(ref);

  if (!snapshot.exists()) {
    return null;
  }

  return snapshot.data();
}