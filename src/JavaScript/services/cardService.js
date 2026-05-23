import {
  collection,
  addDoc,
  query,
  where,
  onSnapshot,
  orderBy,
  updateDoc,
  deleteDoc,
  doc
} from 'firebase/firestore';

import { db, auth } from '../firebase.js';

export async function addCreditCard(data) {
  if (!auth.currentUser) return;

  await addDoc(collection(db, 'cartoes'), {
    ...data,
    userId: auth.currentUser.uid,
    createdAt: new Date()
  });
}

export function listenCreditCards(uid, callback) {
  const q = query(
    collection(db, 'cartoes'),
    where('userId', '==', uid),
    orderBy('createdAt', 'asc')
  );

  return onSnapshot(q, (snapshot) => {
    const cards = snapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data()
    }));

    callback(cards);
  });
}

export async function updateCreditCard(cardId, data) {
  await updateDoc(
    doc(db, 'cartoes', cardId),
    data
  );
}

export async function deleteCreditCard(cardId) {
  await deleteDoc(
    doc(db, 'cartoes', cardId)
  );
}