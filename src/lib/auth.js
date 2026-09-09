import {
  GoogleAuthProvider,
  getIdTokenResult,
  onAuthStateChanged,
  signInAnonymously,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { auth, authPersistenceReady, hasFirebaseConfig } from './firebase.js';

const GUEST_SESSION_KEY = 'casebook-guest-session-v1';

function makeInitials(name = 'Member') {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
}

function createGuestId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `guest-${crypto.randomUUID()}`;
  }
  return `guest-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function getGuestSession() {
  const stored = window.localStorage.getItem(GUEST_SESSION_KEY);
  let guestId = '';
  let storedName = 'Guest';

  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      guestId = typeof parsed?.id === 'string' ? parsed.id : '';
      storedName = typeof parsed?.name === 'string' && parsed.name.trim() ? parsed.name : storedName;
    } catch (error) {
      console.error('Unable to read the guest session.', error);
    }
  }

  const session = {
    id: guestId || createGuestId(),
    initials: makeInitials(storedName),
    mode: 'guest',
    name: storedName,
    role: 'customer',
    roleLabel: 'Guest mode',
  };
  window.localStorage.setItem(GUEST_SESSION_KEY, JSON.stringify(session));
  return session;
}

export function updateGuestDisplayName(name) {
  const session = getGuestSession();
  const updated = {
    ...session,
    name,
    initials: makeInitials(name),
  };
  window.localStorage.setItem(GUEST_SESSION_KEY, JSON.stringify(updated));
  return updated;
}

async function toAuthSession(firebaseUser) {
  const token = await getIdTokenResult(firebaseUser);
  const isAnonymous = firebaseUser.isAnonymous;
  const name = isAnonymous
    ? 'Guest'
    : firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Member';

  return {
    id: firebaseUser.uid,
    email: firebaseUser.email || '',
    initials: isAnonymous ? 'G' : makeInitials(name),
    mode: isAnonymous ? 'anonymous' : 'authenticated',
    name,
    role: token.claims.agent === true ? 'agent' : 'customer',
    roleLabel: isAnonymous ? 'Guest submission' : token.claims.agent === true ? 'Agent' : 'Customer',
  };
}

export function subscribeToAuth(listener) {
  if (!hasFirebaseConfig) return () => {};

  return onAuthStateChanged(auth, (firebaseUser) => {
    if (!firebaseUser) {
      listener({ user: null, error: null });
      return;
    }

    toAuthSession(firebaseUser)
      .then((user) => listener({ user, error: null }))
      .catch((error) => listener({ user: null, error }));
  });
}

export async function signInAnonymouslyUser() {
  if (!hasFirebaseConfig) {
    throw new Error('Firebase authentication is not configured.');
  }

  await authPersistenceReady;
  const credential = await signInAnonymously(auth);
  return toAuthSession(credential.user);
}

export async function signIn(email, password) {
  if (!hasFirebaseConfig) {
    throw new Error('Firebase authentication is not configured.');
  }
  await authPersistenceReady;
  return signInWithEmailAndPassword(auth, email, password);
}

export async function signInWithGoogle() {
  if (!hasFirebaseConfig) {
    throw new Error('Firebase authentication is not configured.');
  }

  await authPersistenceReady;
  const provider = new GoogleAuthProvider();
  provider.addScope('profile');
  provider.addScope('email');
  const credential = await signInWithPopup(auth, provider);
  return toAuthSession(credential.user);
}

export async function updateUserDisplayName(name) {
  if (!hasFirebaseConfig || !auth.currentUser) {
    throw new Error('You must be signed in to update your profile.');
  }

  await updateProfile(auth.currentUser, { displayName: name });
  return toAuthSession(auth.currentUser);
}

export async function signOutUser() {
  if (hasFirebaseConfig) {
    await authPersistenceReady;
    await signOut(auth);
  }
}
