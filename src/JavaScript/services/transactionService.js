import {
  collection,
  addDoc,
  query,
  where,
  onSnapshot,
  orderBy,
  deleteDoc,
  doc,
  updateDoc,
  getDocs
} from 'firebase/firestore';

import { db, auth } from '../firebase.js';

export async function addTransaction(data) {
  if (!auth.currentUser) return null;

  const docRef = await addDoc(collection(db, 'transacoes'), {
    ...data,
    userId: auth.currentUser.uid
  });

  return docRef;
}
export function listenTransactions(uid, callback) {
  const q = query(
    collection(db, 'transacoes'),
    where('userId', '==', uid),
    orderBy('createdAt', 'asc')
  );

  return onSnapshot(q, (snapshot) => {
    const txs = snapshot.docs.map(docSnap => ({
      ...docSnap.data(),
      id: docSnap.id
    }))

    callback(txs);
  }, (error) => {
    console.error('Erro Firestore:', error);
  });
}

export async function updateTransaction(id, data) {
  await updateDoc(
    doc(db, 'transacoes', id),
    data
  );
}

export async function deleteTransaction(id) {
  await deleteDoc(doc(db, 'transacoes', id));
}

export async function deleteInstallmentGroup(groupId) {
  if (!groupId) return;

  const q = query(
    collection(db, 'transacoes'),
    where('installmentGroupId', '==', groupId)
  );

  const snapshot = await getDocs(q);

  const deletes = snapshot.docs.map((docSnap) => {
    return deleteDoc(doc(db, 'transacoes', docSnap.id));
  });

  await Promise.all(deletes);
}