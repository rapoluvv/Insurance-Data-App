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
    planName: 'Jeevan Labh (936-25)',
    premium: 48000,
    sumAssured: 1500000,
    status: 'submitted',
    updatedAt: '2026-09-08T10:32:00.000Z',
    formData: {
      fullName: 'Aarav Mehta',
      proposerName: 'Self',
      dateOfBirth: '1993-04-16',
      age: '33 Years',
      aadhaar: '2345 6789 0123',
      pan: 'ABCDE1234F',
      ckyc: '98765432101234',
      abha: '12-3456-7890-1234',
      fatherName: 'Suresh Mehta',
      motherName: 'Sunita Mehta',
      gender: 'Male',
      maritalStatus: 'Married',
      spouseName: 'Nisha Mehta',
      marriageDate: '2019-11-20',
      mobileAadhaar: '9876543210',
      mobile: '9876501234',
      whatsapp: '9876543210',
      email: 'aarav.mehta@example.com',
      birthPlace: 'Pune',
      residentialStatus: 'Resident Indian',
      corrSameKyc: true,
      address: '14 Lake View Road, Kothrud, Pune - 411038',
      corrAddress: '14 Lake View Road, Kothrud, Pune - 411038',
      city: 'Pune',
      state: 'Maharashtra',
      pincode: '411038',
      education: 'B.Tech Graduate',
      occupation: 'Software Architect',
      typeOfDuty: 'Engineering & Design',
      employer: 'Northstar Studio Pvt Ltd',
      since: '8 Years',
      totalExperience: '11 Years',
      annualIncome: '1800000',
      lyIncome1: '1650000',
      lyIncome2: '1500000',
      lyIncome3: '1350000',
      husbandOccupation: '',
      husbandAnnualIncome: '',
      planName: 'Jeevan Labh (936-25)',
      planNumber: '936',
      policyTerm: '25',
      ppt: '16',
      premiumMode: 'Yearly',
      sumAssured: '1500000',
      accidentalBenefit: 'ADDB',
      termRider: 'Yes',
      premium: '48000',
      datingBack: 'No',
      datingBackDate: '',
      pwb: 'No',
      bocNumber: 'BOC-9921',
      bocDate: '2026-09-08',
      bocAmount: '48000',
      commencementDate: '2026-09-08',
      nominees: [
        { name: 'Nisha Mehta', relation: 'Spouse', share: '100', dob: '1995-08-12', age: '31', aadhaar: '3456 7890 1234', phone: '9876501234' }
      ],
      appointeeName: '',
      appointeeRelation: '',
      appointeeAge: '',
      bankName: 'HDFC Bank',
      accountType: 'Savings',
      accountHolderName: 'Aarav Mehta',
      bankAddress: 'JM Road Branch, Pune',
      accountNumber: '501004561234',
      ifsc: 'HDFC0000103',
      micr: '411240002',
      fatherAge: '63',
      fatherHealth: 'Good',
      fatherDiedAge: '',
      fatherDiedYear: '',
      fatherDiedCause: '',
      motherAge: '59',
      motherHealth: 'Good',
      motherDiedAge: '',
      motherDiedYear: '',
      motherDiedCause: '',
      spouseAge: '31',
      spouseHealth: 'Good',
      spouseDiedAge: '',
      spouseDiedYear: '',
      spouseDiedCause: '',
      siblings: [
        { relation: 'Sister', age: '29', health: 'Good', diedAge: '', diedYear: '', diedCause: '' }
      ],
      children: [
        { age: '4', health: 'Good', diedAge: '', diedYear: '', diedCause: '' }
      ],
      height: '176',
      weight: '72',
      abdomen: '84',
      operations: 'No',
      operationsDetails: '',
      disease: 'No',
      diseaseDetails: '',
      pregnancy: 'No',
      lastDelivery: '',
      previousPolicies: [
        {
          policyNumber: '685412998',
          branch: 'Pune City',
          planTerm: '814-20',
          sumAssured: '500000',
          premium: '24000',
          mode: 'Yearly',
          accidentalBenefit: 'ADDB',
          commencementDate: '2021-03-15',
          rateAccepted: 'Ordinary Rate',
          medicalType: 'Medical',
          inforce: 'Yes'
        }
      ],
    },
  },
  {
    id: 'CASE-1039',
    ownerId: 'customer-2',
    ownerName: 'Ishita Nair',
    agentName: 'Riya Menon',
    applicantName: 'Ishita Nair',
    planName: 'New Jeevan Anand (915-20)',
    premium: 31500,
    sumAssured: 1000000,
    status: 'draft',
    updatedAt: '2026-09-07T16:20:00.000Z',
    formData: {
      fullName: 'Ishita Nair',
      proposerName: 'Self',
      dateOfBirth: '1996-11-03',
      age: '29 Years',
      aadhaar: '4567 8901 2345',
      pan: 'BNYPN4421R',
      ckyc: '',
      abha: '',
      fatherName: 'K. V. Nair',
      motherName: 'Malini Nair',
      gender: 'Female',
      maritalStatus: 'Married',
      spouseName: 'Arjun Menon',
      marriageDate: '2023-01-18',
      mobileAadhaar: '9812345678',
      mobile: '',
      whatsapp: '9812345678',
      email: 'ishita.nair@example.com',
      birthPlace: 'Kochi',
      residentialStatus: 'Resident Indian',
      corrSameKyc: true,
      address: '72 Palm Grove, Marine Drive, Kochi - 682011',
      corrAddress: '72 Palm Grove, Marine Drive, Kochi - 682011',
      city: 'Kochi',
      state: 'Kerala',
      pincode: '682011',
      education: 'B.Arch Graduate',
      occupation: 'Architect',
      typeOfDuty: 'Consulting & Design',
      employer: 'Studio Praxis',
      since: '5 Years',
      totalExperience: '6 Years',
      annualIncome: '950000',
      lyIncome1: '880000',
      lyIncome2: '750000',
      lyIncome3: '',
      husbandOccupation: 'Chartered Accountant',
      husbandAnnualIncome: '1400000',
      planName: 'New Jeevan Anand (915-20)',
      planNumber: '915',
      policyTerm: '20',
      ppt: '20',
      premiumMode: 'Yearly',
      sumAssured: '1000000',
      accidentalBenefit: 'ADDB',
      termRider: 'No',
      premium: '31500',
      datingBack: 'No',
      datingBackDate: '',
      pwb: 'No',
      bocNumber: '',
      bocDate: '',
      bocAmount: '',
      commencementDate: '2026-09-07',
      nominees: [
        { name: 'Arjun Menon', relation: 'Spouse', share: '100', dob: '1994-05-10', age: '32', aadhaar: '', phone: '9845012345' }
      ],
      appointeeName: '',
      appointeeRelation: '',
      appointeeAge: '',
      bankName: 'State Bank of India',
      accountType: 'Savings',
      accountHolderName: 'Ishita Nair',
      bankAddress: 'Marine Drive, Kochi',
      accountNumber: '20348819283',
      ifsc: 'SBIN0001234',
      micr: '682002005',
      fatherAge: '62',
      fatherHealth: 'Good',
      fatherDiedAge: '',
      fatherDiedYear: '',
      fatherDiedCause: '',
      motherAge: '58',
      motherHealth: 'Good',
      motherDiedAge: '',
      motherDiedYear: '',
      motherDiedCause: '',
      spouseAge: '32',
      spouseHealth: 'Good',
      spouseDiedAge: '',
      spouseDiedYear: '',
      spouseDiedCause: '',
      siblings: [],
      children: [],
      height: '165',
      weight: '58',
      abdomen: '74',
      operations: 'No',
      operationsDetails: '',
      disease: 'No',
      diseaseDetails: '',
      pregnancy: 'No',
      lastDelivery: '',
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
  return removeRecords([recordId], session);
}

export async function removeRecords(recordIds, session = null) {
  if (!Array.isArray(recordIds) || recordIds.length === 0) return [];

  const idSet = new Set(recordIds);

  if (!hasFirebaseConfig) {
    const records = readLocalRecords().filter((record) => !idSet.has(record.id));
    writeLocalRecords(records);
    return records;
  }

  if (session?.mode === 'guest') {
    const records = readGuestRecords(session).filter((record) => !idSet.has(record.id));
    return writeGuestRecords(session, records);
  }

  if (!session?.id) {
    throw new Error('Sign in before deleting insurance records.');
  }

  await Promise.all(recordIds.map((id) => deleteDoc(doc(db, COLLECTION, id))));
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

export function convertLegacyRecordToDatabook(item, index = 0, session = null) {
  if (item && item.formData && (item.id || item.applicantName)) {
    return item;
  }

  const parseJsonSafe = (val, fallback = []) => {
    if (Array.isArray(val)) return val;
    if (typeof val === 'string' && val.trim().startsWith('[')) {
      try { return JSON.parse(val); } catch (e) { return fallback; }
    }
    return fallback;
  };

  const rawBrothers = parseJsonSafe(item.fam_brothers, []);
  const rawSisters = parseJsonSafe(item.fam_sisters, []);
  const rawChildren = parseJsonSafe(item.fam_children, []);
  const rawNominees = Array.isArray(item.nominees) ? item.nominees : [];
  const rawPrevPolicies = Array.isArray(item.previous_policies) ? item.previous_policies : [];

  const siblings = [
    ...rawBrothers.map((b) => ({
      relation: 'Brother',
      age: b.age || '',
      health: b.state || 'Good',
      diedAge: b.died_age || '',
      diedYear: b.died_year || '',
      diedCause: b.died_cause || '',
    })),
    ...rawSisters.map((s) => ({
      relation: 'Sister',
      age: s.age || '',
      health: s.state || 'Good',
      diedAge: s.died_age || '',
      diedYear: s.died_year || '',
      diedCause: s.died_cause || '',
    })),
  ];

  const children = rawChildren.map((c) => ({
    age: c.age || '',
    health: c.state || 'Good',
    diedAge: c.died_age || '',
    diedYear: c.died_year || '',
    diedCause: c.died_cause || '',
  }));

  const nominees = rawNominees.length > 0 ? rawNominees.map((n) => ({
    name: n.name || n.nominee || '',
    relation: n.relation || n.nominee_relation || '',
    share: String(n.share ?? n.nominee_share ?? '100'),
    dob: n.dob || n.nominee_dob || '',
    age: n.age || n.nominee_age || '',
    aadhaar: n.aadhaar || n.nominee_aadhaar || '',
    phone: n.phone || n.mobile || '',
  })) : (item.nominee ? [{
    name: item.nominee || '',
    relation: item.nominee_relation || '',
    share: '100',
    dob: '',
    age: item.nominee_age || '',
    aadhaar: item.nominee_aadhaar || '',
    phone: '',
  }] : [{ name: '', relation: '', share: '100', age: '', dob: '', aadhaar: '', phone: '' }]);

  const previousPolicies = rawPrevPolicies.length > 0 ? rawPrevPolicies.map((p) => ({
    policyNumber: p.policy_no || p.prev_policy_no || '',
    branch: p.branch || p.prev_branch || '',
    planTerm: p.plan_term || p.prev_plan_term || '',
    sumAssured: p.sum_assured || p.prev_sa || '',
    premium: p.premium || p.prev_y_premium || '',
    mode: p.mode || p.prev_mode || 'Yearly',
    accidentalBenefit: p.ab_addb || p.prev_ab_addb || '',
    commencementDate: p.doc || p.prev_doc || '',
    rateAccepted: p.rate_accepted || p.prev_or || 'Ordinary Rate',
    medicalType: p.medical_type || p.prev_m_nm || 'Medical',
    inforce: p.inforce || p.prev_inforce || 'Yes',
  })) : (item.prev_policy_no ? [{
    policyNumber: item.prev_policy_no || '',
    branch: item.prev_branch || '',
    planTerm: item.prev_plan_term || '',
    sumAssured: item.prev_sa || '',
    premium: item.prev_y_premium || '',
    mode: item.prev_mode || 'Yearly',
    accidentalBenefit: item.prev_ab_addb || '',
    commencementDate: item.prev_doc || '',
    rateAccepted: item.prev_or || 'Ordinary Rate',
    medicalType: item.prev_m_nm || 'Medical',
    inforce: item.prev_inforce || 'Yes',
  }] : []);

  const corrSameKyc = item.corr_same_kyc === true || item.corr_same_kyc === 'true' || item.corr_same_kyc === 'on';

  const formData = {
    fullName: item.name_of_la || item.fullName || '',
    proposerName: item.proposer || item.proposerName || '',
    aadhaar: item.aadhaar || '',
    pan: item.pan || '',
    ckyc: item.ckyc || '',
    abha: item.abha || '',
    fatherName: item.f_name || item.fatherName || '',
    motherName: item.m_name || item.motherName || '',
    gender: item.gender || '',
    maritalStatus: item.is_married ? (item.is_married === 'Yes' ? 'Married' : 'Single') : (item.maritalStatus || ''),
    spouseName: item.spouse || item.spouseName || '',
    marriageDate: item.d_marriage || item.marriageDate || '',

    mobileAadhaar: item.mobile_adhar || item.mobileAadhaar || item.mobile || '',
    mobile: item.mobile || '',
    whatsapp: item.whatsapp || '',
    email: item.email || '',
    dateOfBirth: item.dob || item.dateOfBirth || '',
    birthPlace: item.birth_place || item.birthPlace || '',
    age: item.near_lb_age || item.age || '',
    residentialStatus: item.residential_status || item.residentialStatus || 'Resident Indian',
    corrSameKyc,
    address: item.address || '',
    corrAddress: corrSameKyc ? (item.address || '') : (item.corr_address || item.corrAddress || ''),
    city: item.city || '',
    state: item.state || '',
    pincode: item.pincode || '',

    education: item.education || '',
    occupation: item.current_job || item.occupation || '',
    typeOfDuty: item.type_of_duty || item.typeOfDuty || '',
    employer: item.co_name || item.employer || '',
    since: item.since || '',
    totalExperience: item.total_experience || item.totalExperience || '',
    annualIncome: item.a_income ? String(item.a_income).replace(/[^\d]/g, '') : (item.annualIncome || ''),
    lyIncome1: item.ly_income1 ? String(item.ly_income1).replace(/[^\d]/g, '') : (item.lyIncome1 || ''),
    lyIncome2: item.ly_income2 ? String(item.ly_income2).replace(/[^\d]/g, '') : (item.lyIncome2 || ''),
    lyIncome3: item.ly_income3 ? String(item.ly_income3).replace(/[^\d]/g, '') : (item.lyIncome3 || ''),
    husbandOccupation: item.husband_occupation || item.husbandOccupation || '',
    husbandAnnualIncome: item.husband_annual_income ? String(item.husband_annual_income).replace(/[^\d]/g, '') : (item.husbandAnnualIncome || ''),

    planName: item.plan_term || item.planName || '',
    planNumber: item.policy_no || item.planNumber || '',
    policyTerm: item.ppt || item.policyTerm || '',
    ppt: item.ppt || '',
    premiumMode: item.mode || item.premiumMode || 'Yearly',
    sumAssured: item.sum_assured || item.sumAssured || '',
    accidentalBenefit: item.ab_addb || item.accidentalBenefit || '',
    termRider: item.term_rider || item.termRider || 'No',
    premium: item.premium ? String(item.premium).replace(/[^\d]/g, '') : '',
    datingBack: item.dating_back || item.datingBack || 'No',
    datingBackDate: item.dating_back_date || item.datingBackDate || '',
    pwb: item.pwb || item.pwb || 'No',
    bocNumber: item.boc_number || item.bocNumber || '',
    bocDate: item.boc_date || item.bocDate || '',
    bocAmount: item.boc_amt || item.bocAmount || '',
    commencementDate: item.doc || item.commencementDate || '',

    nominees,
    appointeeName: item.appointee || item.appointeeName || '',
    appointeeRelation: item.appointee_relation || item.appointeeRelation || '',
    appointeeAge: item.appointee_age || item.appointeeAge || '',

    bankName: item.bank_name || item.bankName || '',
    accountType: item.ac_type || item.accountType || '',
    accountHolderName: item.ac_holder_name || item.accountHolderName || '',
    bankAddress: item.bank_address || item.bankAddress || '',
    accountNumber: item.ac_no || item.accountNumber || '',
    micr: item.micr_code || item.micr || '',
    ifsc: item.ifsc_code || item.ifsc || '',

    fatherAge: item.fam_father_age || item.fatherAge || '',
    fatherHealth: item.fam_father_state || item.fatherHealth || 'Good',
    fatherDiedAge: item.fam_father_died_age || '',
    fatherDiedYear: item.fam_father_died_year || '',
    fatherDiedCause: item.fam_father_died_cause || '',

    motherAge: item.fam_mother_age || item.motherAge || '',
    motherHealth: item.fam_mother_state || item.motherHealth || 'Good',
    motherDiedAge: item.fam_mother_died_age || '',
    motherDiedYear: item.fam_mother_died_year || '',
    motherDiedCause: item.fam_mother_died_cause || '',

    spouseAge: item.fam_spouse_age || item.spouseAge || '',
    spouseHealth: item.fam_spouse_state || item.spouseHealth || 'Good',
    spouseDiedAge: item.fam_spouse_died_age || '',
    spouseDiedYear: item.fam_spouse_died_year || '',
    spouseDiedCause: item.fam_spouse_died_cause || '',

    siblings,
    children,

    height: item.height || '',
    weight: item.weight || '',
    abdomen: item.abd || item.abdomen || '',
    operations: item.any_operations || item.operations || 'No',
    operationsDetails: item.operation_details || item.operationsDetails || '',
    disease: item.any_diseases || item.disease || 'No',
    diseaseDetails: item.disease_details || item.diseaseDetails || '',
    pregnancy: item.are_pregnant || item.pregnancy || 'No',
    lastDelivery: item.last_delivery_date || item.lastDelivery || '',

    previousPolicies,
  };

  const applicantName = formData.fullName || `Applicant ${index + 1}`;
  const now = new Date().toISOString();
  const id = `CASE-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

  const submittedByName = session?.name
    || (session?.role === 'agent' ? 'Rapolu Venkateshwarlu' : '')
    || item.submittedByName
    || (session?.mode === 'guest' ? 'Guest user' : 'Agent');

  return {
    id,
    caseNumber: id,
    ownerId: session?.id || 'imported-customer',
    ownerName: applicantName,
    agentName: session?.role === 'agent' ? session.name : 'Rapolu Venkateshwarlu',
    applicantName,
    planName: formData.planName || 'Proposed Plan',
    premium: Number(formData.premium) || 0,
    sumAssured: Number(formData.sumAssured) || 0,
    status: item.status || 'submitted',
    submittedByName,
    submittedById: session?.id || 'imported',
    updatedAt: item.lastEdited || now,
    submittedAt: item.lastEdited || now,
    formData,
  };
}

export async function importRecords(file, session = null) {
  const contents = await file.text();
  const parsed = JSON.parse(contents);

  let rawList = [];
  if (Array.isArray(parsed)) {
    rawList = parsed;
  } else if (parsed && Array.isArray(parsed.data)) {
    rawList = parsed.data;
  } else {
    throw new Error('The selected file does not contain a recognizable list of records.');
  }

  const imported = rawList.map((item, index) => convertLegacyRecordToDatabook(item, index, session));

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
