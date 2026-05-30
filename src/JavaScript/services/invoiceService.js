import {
  collection,
  addDoc,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  getDocs,
  deleteDoc,
  doc
} from 'firebase/firestore';

import { db, auth } from '../firebase.js';

export async function markInvoiceAsPaid({
  cardId,
  invoiceYear,
  invoiceMonth,
  amount
}) {
  if (!auth.currentUser) return;

  await addDoc(collection(db, 'invoicePayments'), {
    userId: auth.currentUser.uid,
    cardId,
    invoiceYear,
    invoiceMonth,
    amount,
    status: 'paid',
    paidAt: serverTimestamp(),
    createdAt: serverTimestamp()
  });
}

export function listenInvoicePayments(uid, callback) {
  const q = query(
    collection(db, 'invoicePayments'),
    where('userId', '==', uid)
  );

  return onSnapshot(q, (snapshot) => {
    const payments = snapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data()
    }));

    callback(payments);
  });
}

export function isInvoicePaid({
  payments = [],
  cardId,
  invoiceYear,
  invoiceMonth
}) {
  return payments.some(p =>
    p.cardId === cardId &&
    Number(p.invoiceYear) === Number(invoiceYear) &&
    Number(p.invoiceMonth) === Number(invoiceMonth) &&
    p.status === 'paid'
  );
}

export async function unmarkInvoiceAsPaid({
  cardId,
  invoiceYear,
  invoiceMonth
}) {
  if (!auth.currentUser) return;

  const q = query(
    collection(db, 'invoicePayments'),
    where('userId', '==', auth.currentUser.uid),
    where('cardId', '==', cardId),
    where('invoiceYear', '==', invoiceYear),
    where('invoiceMonth', '==', invoiceMonth),
    where('status', '==', 'paid')
  );

  const snapshot = await getDocs(q);

  await Promise.all(
    snapshot.docs.map(docSnap =>
      deleteDoc(doc(db, 'invoicePayments', docSnap.id))
    )
  );
}