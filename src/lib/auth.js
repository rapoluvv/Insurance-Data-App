import {
  getIdTokenResult,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { auth, hasFirebaseConfig } from './firebase.js';

function makeInitials(name = 'Member') {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
}

export function subscribeToAuth(listener) {
  if (!hasFirebaseConfig) return () => {};

  return onAuthStateChanged(auth, (firebaseUser) => {
    if (!firebaseUser) {
      listener({ user: null, error: null });
      return;
    }

    getIdTokenResult(firebaseUser)
      .then((token) => {
        const name = firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Member';
        listener({
          user: {
            id: firebaseUser.uid,
            email: firebaseUser.email || '',
            name,
            initials: makeInitials(name),
            role: token.claims.agent === true ? 'agent' : 'customer',
          },
          error: null,
        });
      })
      .catch((error) => listener({ user: null, error }));
  });
}

export async function signIn(email, password) {
  if (!hasFirebaseConfig) {
    throw new Error('Firebase authentication is not configured.');
  }
  return signInWithEmailAndPassword(auth, email, password);
}

export async function signOutUser() {
  if (hasFirebaseConfig) await signOut(auth);
}
