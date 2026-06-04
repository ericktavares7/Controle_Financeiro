import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy
} from 'firebase/firestore';

import { db, auth } from '../firebase.js';

function getUserId() {
  return auth.currentUser?.uid;
}

function getCollectionRef() {
  const uid = getUserId();

  if (!uid) {
    throw new Error('Usuário não autenticado.');
  }

  return collection(db, 'users', uid, 'fixedBills');
}

export function listenFixedBills(callback) {
  const uid = getUserId();

  if (!uid) {
    console.warn('listenFixedBills: usuário não autenticado.');
    return () => { };
  }

  const q = query(
    collection(db, 'users', uid, 'fixedBills'),
    orderBy('dueDay', 'asc')
  );

  return onSnapshot(q, snapshot => {
    const bills = snapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data()
    }));

    callback(bills);
  });
}

export async function addFixedBill(data) {
  return addDoc(getCollectionRef(), {
    ...data,
    paid: false,
    paidAt: null,
    paymentTxId: null,
    active: true,
    createdAt: new Date()
  });
}

export async function updateFixedBill(id, data) {
  const uid = getUserId();

  if (!uid) {
    throw new Error('Usuário não autenticado.');
  }

  return updateDoc(
    doc(db, 'users', uid, 'fixedBills', id),
    data
  );
}

export async function deleteFixedBill(id) {
  const uid = getUserId();

  if (!uid) {
    throw new Error('Usuário não autenticado.');
  }

  return deleteDoc(
    doc(db, 'users', uid, 'fixedBills', id)
  );
}