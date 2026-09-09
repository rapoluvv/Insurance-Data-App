import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  setDoc,
  where,
} from 'firebase/firestore';
import { db, hasFirebaseConfig } from './firebase.js';

const DATA_PREFIX = 'databook';
const LEGACY_PREFIX = ['case', 'book'].join('');
const LOCAL_KEY = `${DATA_PREFIX}-insurance-records-v1`;
const LEGACY_LOCAL_KEY = `${LEGACY_PREFIX}-insurance-records-v1`;
const GUEST_RECORDS_KEY = `${DATA_PREFIX}-guest-records-v1`;
const LEGACY_GUEST_RECORDS_KEY = `${LEGACY_PREFIX}-guest-records-v1`;
const DRAFT_KEY = `${DATA_PREFIX}-insurance-draft-v1`;
const LEGACY_DRAFT_KEY = `${LEGACY_PREFIX}-insurance-draft-v1`;
const COLLECTION = 'insuranceSubmissions';

const demoRecords = [
  {
    id: 'CASE-1042',
    ownerId: 'customer-demo',
    ownerName: 'Aarav Mehta',
    agentName: 'Riya Menon',
    applicantName: 'Aarav Mehta',
    planName: 'Jeevan Labh',
    premium: 48000,
    sumAssured: 1500000,
    status: 'submitted',
    updatedAt: '2026-09-08T10:32:00.000Z',
    formData: {
      fullName: 'Aarav Mehta',
      proposerName: 'Aarav Mehta',
      dateOfBirth: '1993-04-16',
      age: '33',
      gender: 'Male',
      maritalStatus: 'Married',
      mobile: '9876543210',
      email: 'aarav.mehta@example.com',
      address: '14 Lake View Road',
      city: 'Pune',
      state: 'Maharashtra',
      pincode: '411001',
      education: 'Graduate',
      occupation: 'Product designer',
      annualIncome: '1200000',
      employer: 'Northstar Studio',
      planName: 'Jeevan Labh',
      planNumber: '936',
      policyTerm: '25',
      sumAssured: '1500000',
      premium: '48000',
      premiumMode: 'Annual',
      commencementDate: '2026-09-08',
      nominees: [{ name: 'Nisha Mehta', relation: 'Spouse', share: '100', age: '31', phone: '9876501234' }],
      bankName: 'HDFC Bank',
      accountType: 'Savings',
      accountNumber: 'XXXXXX4312',
      ifsc: 'HDFC0001234',
      fatherAge: '63',
      fatherHealth: 'Alive and well',
      motherAge: '59',
      motherHealth: 'Alive and well',
      spouseAge: '31',
      spouseHealth: 'Alive and well',
      siblings: [{ relation: 'Sister', age: '29', health: 'Alive' }],
      children: [{ age: '4', health: 'Alive' }],
      height: '176',
      weight: '72',
      operations: 'No',
      disease: 'No',
      pregnancy: 'No',
      previousPolicies: [],
    },
  },
  {
    id: 'CASE-1039',
    ownerId: 'customer-2',
    ownerName: 'Ishita Nair',
    agentName: 'Riya Menon',
    applicantName: 'Ishita Nair',
    planName: 'New Jeevan Anand',
    premium: 31500,
    sumAssured: 1000000,
    status: 'draft',
    updatedAt: '2026-09-07T16:20:00.000Z',
    formData: {
      fullName: 'Ishita Nair',
      proposerName: 'Ishita Nair',
      dateOfBirth: '1996-11-03',
      age: '29',
      gender: 'Female',
      mobile: '9812345678',
      email: 'ishita.nair@example.com',
      occupation: 'Architect',
      planName: 'New Jeevan Anand',
      sumAssured: '1000000',
      premium: '31500',
      premiumMode: 'Annual',
      nominees: [{ name: '', relation: '', share: '100', age: '', phone: '' }],
      siblings: [],
      children: [],
      previousPolicies: [],
    },
  },
  {
    id: 'CASE-1034',
    ownerId: 'customer-3',
    ownerName: 'Devika Shah',
    agentName: 'Riya Menon',
    applicantName: 'Devika Shah',
    planName: 'Tech Term Plus',
    premium: 22000,
    sumAssured: 2500000,
    status: 'submitted',
    updatedAt: '2026-09-05T08:10:00.000Z',
    formData: {
      fullName: 'Devika Shah',
      proposerName: 'Devika Shah',
      dateOfBirth: '1987-01-22',
      age: '39',
      gender: 'Female',
      maritalStatus: 'Single',
      mobile: '9988776655',
      email: 'devika.shah@example.com',
      occupation: 'Software engineer',
      planName: 'Tech Term Plus',
      sumAssured: '2500000',
      premium: '22000',
      premiumMode: 'Annual',
      nominees: [{ name: 'Vijay Shah', relation: 'Father', share: '100', age: '66', phone: '9988771122' }],
      siblings: [],
      children: [],
      previousPolicies: [],
    },
  },
];

function readLocalRecords() {
  const currentStored = window.localStorage.getItem(LOCAL_KEY);
  const legacyStored = window.localStorage.getItem(LEGACY_LOCAL_KEY);
  const stored = currentStored || legacyStored;
  if (!currentStored && legacyStored) {
    window.localStorage.setItem(LOCAL_KEY, legacyStored);
  }
  if (!stored) {
    window.localStorage.setItem(LOCAL_KEY, JSON.stringify(demoRecords));
    return demoRecords;
  }

  try {
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : demoRecords;
  } catch (error) {
    console.error('Unable to read local case records.', error);
    return demoRecords;
  }
}

function writeLocalRecords(records) {
  window.localStorage.setItem(LOCAL_KEY, JSON.stringify(records));
  return records;
}

function getGuestRecordsKey(session) {
  return `${GUEST_RECORDS_KEY}:${session.id}`;
}

function getLegacyGuestRecordsKey(session) {
  return `${LEGACY_GUEST_RECORDS_KEY}:${session.id}`;
}

function readGuestRecords(session) {
  const currentKey = getGuestRecordsKey(session);
  const legacyKey = getLegacyGuestRecordsKey(session);
  const currentStored = window.localStorage.getItem(currentKey);
  const legacyStored = window.localStorage.getItem(legacyKey);
  const stored = currentStored || legacyStored;
  if (!currentStored && legacyStored) {
    window.localStorage.setItem(currentKey, legacyStored);
  }
  if (!stored) return [];

  try {
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('Unable to read guest case records.', error);
    return [];
  }
}

function writeGuestRecords(session, records) {
  window.localStorage.setItem(getGuestRecordsKey(session), JSON.stringify(records));
  return records;
}

export async function loadRecords(session = null) {
  if (!hasFirebaseConfig) {
    return readLocalRecords();
  }

  if (session?.mode === 'guest') {
    return readGuestRecords(session);
  }

  if (!session?.id) {
    throw new Error('Sign in before loading insurance records.');
  }

  const source = session.role === 'agent'
    ? collection(db, COLLECTION)
    : query(collection(db, COLLECTION), where('ownerId', '==', session.id));
  const snapshot = await getDocs(source);
  return snapshot.docs.map((record) => ({ id: record.id, ...record.data() }));
}

export async function saveRecord(record, session = null) {
  if (!hasFirebaseConfig) {
    const records = readLocalRecords();
    const next = records.some((item) => item.id === record.id)
      ? records.map((item) => (item.id === record.id ? record : item))
      : [record, ...records];
    return { record, records: writeLocalRecords(next) };
  }

  if (session?.mode === 'guest') {
    const records = readGuestRecords(session);
    const next = records.some((item) => item.id === record.id)
      ? records.map((item) => (item.id === record.id ? record : item))
      : [record, ...records];
    return { record, records: writeGuestRecords(session, next) };
  }

  if (!session?.id) {
    throw new Error('Sign in before saving an insurance record.');
  }
  if (session.role !== 'agent' && record.ownerId !== session.id) {
    throw new Error('Customers can only save records they own.');
  }

  await setDoc(doc(db, COLLECTION, record.id), record);
  return { record };
}

export async function removeRecord(recordId, session = null) {
  if (!hasFirebaseConfig) {
    const records = readLocalRecords().filter((record) => record.id !== recordId);
    writeLocalRecords(records);
    return records;
  }

  if (session?.mode === 'guest') {
    const records = readGuestRecords(session).filter((record) => record.id !== recordId);
    return writeGuestRecords(session, records);
  }

  if (!session?.id) {
    throw new Error('Sign in before deleting an insurance record.');
  }
  await deleteDoc(doc(db, COLLECTION, recordId));
  return null;
}

function getDraftKey(session = null) {
  return session?.id ? `${DRAFT_KEY}:${session.id}` : DRAFT_KEY;
}

function getLegacyDraftKey(session = null) {
  return session?.id ? `${LEGACY_DRAFT_KEY}:${session.id}` : LEGACY_DRAFT_KEY;
}

export function saveDraftSnapshot(form, session = null) {
  window.localStorage.setItem(getDraftKey(session), JSON.stringify(form));
}

export function readDraftSnapshot(session = null) {
  const currentKey = getDraftKey(session);
  const legacyKey = getLegacyDraftKey(session);
  const currentStored = window.localStorage.getItem(currentKey);
  const legacyStored = window.localStorage.getItem(legacyKey);
  const stored = currentStored || legacyStored;
  if (!currentStored && legacyStored) {
    window.localStorage.setItem(currentKey, legacyStored);
  }
  if (!stored) return null;

  try {
    return JSON.parse(stored);
  } catch (error) {
    console.error('Unable to read the saved draft snapshot.', error);
    return null;
  }
}

export function clearDraftSnapshot(session = null) {
  window.localStorage.removeItem(getDraftKey(session));
}

export function exportRecords(records) {
  const blob = new Blob([JSON.stringify(records, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `databook-insurance-records-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

export async function importRecords(file, session = null) {
  const contents = await file.text();
  const imported = JSON.parse(contents);
  if (!Array.isArray(imported)) {
    throw new Error('The selected file does not contain a list of records.');
  }

  if (!hasFirebaseConfig) {
    return writeLocalRecords(imported);
  }

  if (session?.role !== 'agent') {
    const ownedRecords = imported.map((record) => ({ ...record, ownerId: session.id }));
    if (session?.mode === 'guest') {
      return writeGuestRecords(session, ownedRecords);
    }
    for (const record of ownedRecords) {
      await setDoc(doc(db, COLLECTION, record.id), record);
    }
    return ownedRecords;
  }

  for (const record of imported) {
    await setDoc(doc(db, COLLECTION, record.id), record);
  }

  return imported;
}
