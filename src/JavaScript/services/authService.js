import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail,
  onAuthStateChanged
} from 'firebase/auth';

import {
  addDoc,
  collection
} from 'firebase/firestore';

import {
  auth,
  db
} from '../firebase.js';

export async function register(
  nome,
  sobrenome,
  email,
  senha
) {
  const cred = await createUserWithEmailAndPassword(
    auth,
    email,
    senha
  );

  await updateProfile(
    cred.user,
    {
      displayName: `${nome} ${sobrenome}`
    }
  );

  await addDoc(
    collection(db, 'usuarios'),
    {
      uid: cred.user.uid,
      nome,
      sobrenome,
      email,
      createdAt: new Date()
    }
  );

  return cred.user;
}

export async function login(email, senha) {
  const credencial =
    await signInWithEmailAndPassword(
      auth,
      email,
      senha
    );

  return credencial.user;
}

export async function resetPassword(email) {
  if (!email) {
    throw new Error('E-mail inválido.');
  }

  await sendPasswordResetEmail(auth, email);
}

export function observeAuthState(callback) {
  return onAuthStateChanged(auth, callback);
}