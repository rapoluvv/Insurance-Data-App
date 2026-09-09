import {
  GoogleAuthProvider,
  getRedirectResult,
  getIdTokenResult,
  onAuthStateChanged,
  signInAnonymously,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { auth, authPersistenceReady, hasFirebaseConfig } from './firebase.js';

const DATA_PREFIX = 'databook';
const LEGACY_PREFIX = ['case', 'book'].join('');
const GUEST_SESSION_KEY = `${DATA_PREFIX}-guest-session-v1`;
const LEGACY_GUEST_SESSION_KEY = `${LEGACY_PREFIX}-guest-session-v1`;

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
  const stored = window.localStorage.getItem(GUEST_SESSION_KEY)
    || window.localStorage.getItem(LEGACY_GUEST_SESSION_KEY);
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

export function getAuthErrorMessage(error) {
  if (!error) return '';
  const code = error?.code;
  const messages = {
    'auth/account-exists-with-different-credential': 'An account already exists with a different sign-in method. Use that method first.',
    'auth/email-already-in-use': 'An account already exists for this email. Try signing in instead.',
    'auth/invalid-credential': 'That sign-in credential is no longer valid. Try again.',
    'auth/invalid-email': 'Enter a valid email address.',
    'auth/popup-blocked': 'Your browser blocked the Google sign-in popup. Allow popups for this site and try again.',
    'auth/popup-closed-by-user': 'The Google sign-in window was closed before it finished.',
    'auth/unauthorized-domain': `Google sign-in is not authorized for ${window.location.hostname}. Add this domain in Firebase Authentication → Settings → Authorized domains.`,
    'auth/user-disabled': 'This account has been disabled. Contact an administrator.',
    'auth/user-not-found': 'No account exists for these credentials.',
    'auth/wrong-password': 'The email or password is incorrect.',
  };
  return messages[code] || error?.message || 'Authentication could not be completed.';
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

  const redirectResult = authPersistenceReady.then(() => getRedirectResult(auth));

  return onAuthStateChanged(auth, async (firebaseUser) => {
    if (!firebaseUser) {
      try {
        const result = await redirectResult;
        const redirectedUser = result?.user || auth.currentUser;
        if (redirectedUser) {
          const user = await toAuthSession(redirectedUser);
          listener({ user, error: null });
        } else {
          listener({ user: null, error: null });
        }
      } catch (error) {
        listener({ user: null, error });
      }
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

export async function createAccount(email, password, displayName = '') {
  if (!hasFirebaseConfig) {
    throw new Error('Firebase authentication is not configured.');
  }

  await authPersistenceReady;
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  if (displayName.trim()) {
    await updateProfile(credential.user, { displayName: displayName.trim() });
  }
  return toAuthSession(credential.user);
}

export async function signInWithGoogle() {
  if (!hasFirebaseConfig) {
    throw new Error('Firebase authentication is not configured.');
  }

  await authPersistenceReady;
  const provider = new GoogleAuthProvider();
  provider.addScope('profile');
  provider.addScope('email');
  try {
    const credential = await signInWithPopup(auth, provider);
    return toAuthSession(credential.user);
  } catch (error) {
    if (['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment'].includes(error.code)) {
      await signInWithRedirect(auth, provider);
      return null;
    }
    throw error;
  }
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
