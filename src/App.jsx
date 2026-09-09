import { useEffect, useMemo, useState } from 'react';
import {
  clearDraftSnapshot,
  exportRecords,
  importRecords,
  loadRecords,
  readDraftSnapshot,
  removeRecord,
  saveDraftSnapshot,
  saveRecord,
} from './lib/storage.js';
import { hasFirebaseConfig } from './lib/firebase.js';
import {
  clearPhoneAuth,
  getGuestSession,
  preparePhoneRecaptcha,
  signIn,
  signInAnonymouslyUser,
  signInWithGoogle,
  requestPhoneCode,
  confirmPhoneCode,
  signOutUser,
  subscribeToAuth,
} from './lib/auth.js';

const ROLE_USERS = {
  agent: {
    id: 'agent-demo',
    name: 'Riya Menon',
    roleLabel: 'Agent',
    initials: 'RM',
  },
  customer: {
    id: 'customer-demo',
    name: 'Aarav Mehta',
    roleLabel: 'Customer',
    initials: 'AM',
  },
};

const STEPS = [
  { id: 'applicant', label: 'Applicant', hint: 'Identity' },
  { id: 'contact', label: 'Contact', hint: 'Reachability' },
  { id: 'work', label: 'Work & income', hint: 'Background' },
  { id: 'plan', label: 'Proposed plan', hint: 'Policy' },
  { id: 'nominee', label: 'Nominee', hint: 'Beneficiary' },
  { id: 'bank', label: 'Bank details', hint: 'Payment' },
  { id: 'family', label: 'Family & health', hint: 'Declarations' },
  { id: 'previous', label: 'Previous policies', hint: 'History' },
  { id: 'review', label: 'Review', hint: 'Submit' },
];

const STATE_OPTIONS = [
  'Andhra Pradesh',
  'Delhi',
  'Goa',
  'Gujarat',
  'Karnataka',
  'Kerala',
  'Maharashtra',
  'Rajasthan',
  'Tamil Nadu',
  'Telangana',
  'Uttar Pradesh',
  'West Bengal',
];

function createInitialForm() {
  return {
    fullName: '',
    proposerName: '',
    dateOfBirth: '',
    age: '',
    aadhaar: '',
    pan: '',
    gender: '',
    maritalStatus: '',
    mobile: '',
    email: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    residentialStatus: '',
    education: '',
    occupation: '',
    annualIncome: '',
    employer: '',
    planName: '',
    planNumber: '',
    policyTerm: '',
    sumAssured: '',
    premium: '',
    premiumMode: 'Annual',
    commencementDate: '',
    nominees: [{ name: '', relation: '', share: '100', age: '', phone: '' }],
    bankName: '',
    accountType: '',
    accountNumber: '',
    ifsc: '',
    micr: '',
    fatherAge: '',
    fatherHealth: '',
    motherAge: '',
    motherHealth: '',
    spouseAge: '',
    spouseHealth: '',
    siblings: [],
    children: [],
    height: '',
    weight: '',
    abdomen: '',
    operations: 'No',
    operationsDetails: '',
    disease: 'No',
    diseaseDetails: '',
    pregnancy: 'No',
    lastDelivery: '',
    previousPolicies: [],
  };
}

function normalizeForm(formData = {}) {
  const initial = createInitialForm();
  return {
    ...initial,
    ...formData,
    nominees: Array.isArray(formData.nominees) && formData.nominees.length
      ? formData.nominees
      : initial.nominees,
    siblings: Array.isArray(formData.siblings) ? formData.siblings : [],
    children: Array.isArray(formData.children) ? formData.children : [],
    previousPolicies: Array.isArray(formData.previousPolicies) ? formData.previousPolicies : [],
  };
}

function calculateAge(dateValue) {
  if (!dateValue) return '';
  const birthDate = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(birthDate.getTime())) return '';

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDelta = today.getMonth() - birthDate.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < birthDate.getDate())) {
    age -= 1;
  }
  return age > 0 ? String(age) : '';
}

function formatMoney(value) {
  const numericValue = Number(value);
  if (!numericValue) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(numericValue);
}

function formatDate(value) {
  if (!value) return 'No date';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'No date';
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function getDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function createCaseId() {
  return `CASE-${String(Date.now()).slice(-4)}`;
}

function hasFormContent(form) {
  return Boolean(
    form.fullName ||
    form.mobile ||
    form.email ||
    form.occupation ||
    form.planName ||
    form.sumAssured ||
    form.premium,
  );
}

function validateStep(stepIndex, form) {
  const errors = {};
  const required = (field, message) => {
    if (!String(form[field] || '').trim()) errors[field] = message;
  };

  if (stepIndex === 0) {
    required('fullName', 'Add the applicant name.');
    required('dateOfBirth', 'Add the date of birth.');
    required('gender', 'Choose a gender.');
  }

  if (stepIndex === 1) {
    required('mobile', 'Add a mobile number.');
    required('email', 'Add an email address.');
    if (form.mobile && !/^\d{10}$/.test(form.mobile.replace(/\s/g, ''))) {
      errors.mobile = 'Use a 10-digit mobile number.';
    }
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      errors.email = 'Check the email format.';
    }
  }

  if (stepIndex === 2) {
    required('occupation', 'Add the current occupation.');
    required('annualIncome', 'Add the annual income.');
  }

  if (stepIndex === 3) {
    required('planName', 'Add a plan name.');
    required('sumAssured', 'Add the sum assured.');
    required('premium', 'Add the premium.');
    required('commencementDate', 'Choose a commencement date.');
  }

  if (stepIndex === 4) {
    const shareTotal = form.nominees.reduce((total, nominee) => total + Number(nominee.share || 0), 0);
    if (!form.nominees.length) {
      errors.nominees = 'Add at least one nominee.';
    } else if (shareTotal !== 100) {
      errors.nominees = `Nominee shares currently total ${shareTotal}%. They must total 100%.`;
    }
    form.nominees.forEach((nominee, index) => {
      if (!String(nominee.name || '').trim()) errors[`nominee-${index}-name`] = 'Add a nominee name.';
      if (!String(nominee.relation || '').trim()) errors[`nominee-${index}-relation`] = 'Choose a relation.';
    });
  }

  return errors;
}

function validateAll(form) {
  return STEPS.slice(0, -1).reduce((allErrors, _step, index) => {
    return { ...allErrors, ...validateStep(index, form) };
  }, {});
}

function Icon({ name, size = 18 }) {
  const paths = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    file: <><path d="M6 3.5h8l4 4V20.5H6z" /><path d="M14 3.5v4h4M9 12h6M9 16h6" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    chevron: <path d="m9 5 7 7-7 7" />,
    back: <><path d="m15 5-7 7 7 7" /><path d="M8 12h11" /></>,
    arrow: <><path d="M5 12h13" /><path d="m13 6 6 6-6 6" /></>,
    search: <><circle cx="10.8" cy="10.8" r="6.3" /><path d="m16 16 4.5 4.5" /></>,
    check: <path d="m5 12 4.2 4.2L19 6.5" />,
    clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3.2 2" /></>,
    shield: <><path d="M12 3.5 19 6v5.3c0 4.3-2.5 7.8-7 9.2-4.5-1.4-7-4.9-7-9.2V6z" /><path d="m9 12 2 2 4-4" /></>,
    users: <><path d="M16 20v-1.8a3.7 3.7 0 0 0-3.7-3.7H7.7A3.7 3.7 0 0 0 4 18.2V20" /><circle cx="10" cy="7.5" r="3.3" /><path d="M16 4.5a3.3 3.3 0 0 1 0 6.4M20 20v-1.8a3.7 3.7 0 0 0-2.8-3.6" /></>,
    phone: <><path d="M7.5 4.5 5.8 5.4a2 2 0 0 0-1 2.1c.8 5.8 5.4 10.4 11.2 11.2a2 2 0 0 0 2.1-1l.9-1.7-3.4-2.2-1.6 1.3a11.2 11.2 0 0 1-4.8-4.8l1.3-1.6z" /></>,
    download: <><path d="M12 3v12" /><path d="m7 10 5 5 5-5M4 20h16" /></>,
    upload: <><path d="M12 16V4" /><path d="m7 9 5-5 5 5M4 20h16" /></>,
    edit: <><path d="m4 16.5-.8 3.4 3.4-.8L18.8 7a2.4 2.4 0 0 0-3.4-3.4z" /><path d="m13.5 5.5 3 3" /></>,
    trash: <><path d="M4.5 7h15M9 7V4.5h6V7M7 7l.8 13h8.4L17 7M10 11v5M14 11v5" /></>,
    close: <><path d="m6 6 12 12M18 6 6 18" /></>,
    logout: <><path d="M10 5H5v14h5M14 8l4 4-4 4M18 12H9" /></>,
    menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
    filter: <><path d="M4 6h16M7 12h10M10 18h4" /></>,
    info: <><circle cx="12" cy="12" r="8.5" /><path d="M12 10.5v5M12 7.5h.01" /></>,
  };

  return (
    <svg
      aria-hidden="true"
      className="icon"
      fill="none"
      height={size}
      viewBox="0 0 24 24"
      width={size}
      xmlns="http://www.w3.org/2000/svg"
    >
      {paths[name] || paths.info}
    </svg>
  );
}

function AuthLoading() {
  return (
    <main className="auth-screen">
      <div className="auth-panel auth-loading">
        <span className="auth-mark" aria-hidden="true"><span /></span>
        <span className="loading-line" />
        <p>Checking your workspace…</p>
      </div>
    </main>
  );
}

function SignInView({
  error,
  isSigningIn,
  onConfirmPhoneCode,
  onContinueGuest,
  onGoogleSignIn,
  onPreparePhoneRecaptcha,
  onRequestPhoneCode,
  onResetPhone,
  onSignIn,
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMethod, setAuthMethod] = useState('password');
  const [countryCode, setCountryCode] = useState('+91');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneCode, setPhoneCode] = useState('');
  const [phoneStep, setPhoneStep] = useState('number');
  const [providerError, setProviderError] = useState('');

  useEffect(() => () => onResetPhone(), []);

  useEffect(() => {
    if (authMethod !== 'phone' || phoneStep !== 'number') return undefined;

    let cancelled = false;
    onPreparePhoneRecaptcha('phone-recaptcha').catch((authError) => {
      if (!cancelled) {
        setProviderError(authError.message || 'The security check could not load.');
      }
    });

    return () => {
      cancelled = true;
    };
  }, [authMethod, phoneStep]);

  function handleSubmit(event) {
    event.preventDefault();
    onSignIn(email, password);
  }

  function handleMethodChange(method) {
    setAuthMethod(method);
    setProviderError('');
    setPhoneStep('number');
    setPhoneCode('');
    onResetPhone();
  }

  async function handleGoogleSignIn() {
    setProviderError('');
    try {
      await onGoogleSignIn();
    } catch (authError) {
      setProviderError(authError.message || 'Google sign-in could not be completed.');
    }
  }

  async function handlePhoneSubmit(event) {
    event.preventDefault();
    setProviderError('');
    try {
      if (phoneStep === 'number') {
        const normalizedPhone = `${countryCode}${phoneNumber.replace(/\D/g, '')}`;
        await onRequestPhoneCode(normalizedPhone);
        setPhoneStep('code');
      } else {
        await onConfirmPhoneCode(phoneCode);
      }
    } catch (authError) {
      setProviderError(authError.message || 'Phone sign-in could not be completed.');
    }
  }

  const visibleError = providerError || error;

  return (
    <main className="auth-screen auth-variant-split-case">
      <aside className="auth-side" aria-label="Casebook overview">
        <div className="auth-side-brand">
          <span className="auth-mark" aria-hidden="true"><span /></span>
          <div><strong>casebook</strong><small>insurance data</small></div>
        </div>
        <div className="auth-side-copy">
          <span className="auth-side-kicker">Secure intake</span>
          <h2>A careful record begins with a clear first step.</h2>
          <p>One guided workspace for the details that help a customer and agent move with confidence.</p>
        </div>
        <div className="auth-score" aria-label="Casebook workflow">
          <div className="auth-score-row"><span className="auth-score-marker">01</span><span><strong>Private identity</strong><small>Protected by role</small></span><Icon name="shield" size={16} /></div>
          <div className="auth-score-row"><span className="auth-score-marker">02</span><span><strong>Guided intake</strong><small>Clear, reviewable steps</small></span><Icon name="check" size={16} /></div>
          <div className="auth-score-row"><span className="auth-score-marker">03</span><span><strong>Agent review</strong><small>Ready when the case is</small></span><Icon name="arrow" size={16} /></div>
        </div>
        <p className="auth-side-footer">The case score keeps every important detail in view.</p>
      </aside>
      <section className="auth-panel" aria-labelledby="sign-in-title">
        <div className="auth-panel-content">
          <div className="auth-panel-intro">
            <div className="auth-copy">
              <span className="auth-kicker">Secure workspace</span>
              <h1 id="sign-in-title">Sign in to your casebook.</h1>
              <p>Use the account created for your role. Customer records stay private; agents see the full submission queue.</p>
            </div>
          </div>
          <div className="auth-panel-methods">
            <button className="button button-secondary auth-google-button" disabled={isSigningIn} onClick={handleGoogleSignIn} type="button">
              <span className="google-mark" aria-hidden="true">G</span>
              Continue with Google
              <Icon name="arrow" size={16} />
            </button>
            <div className="auth-divider"><span>or use</span></div>
            <div className="auth-method-toggle" role="tablist" aria-label="Choose sign-in method">
              <button aria-selected={authMethod === 'password'} className={authMethod === 'password' ? 'is-active' : ''} onClick={() => handleMethodChange('password')} role="tab" type="button">Password</button>
              <button aria-selected={authMethod === 'phone'} className={authMethod === 'phone' ? 'is-active' : ''} onClick={() => handleMethodChange('phone')} role="tab" type="button"><Icon name="phone" size={15} /> Phone</button>
            </div>
            {authMethod === 'password' ? (
              <form className="auth-form" onSubmit={handleSubmit}>
            <Field label="Email address" name="auth-email" onChange={(_, value) => setEmail(value)} placeholder="you@example.com" required type="email" value={email} />
            <Field label="Password" name="auth-password" onChange={(_, value) => setPassword(value)} placeholder="Your password" required type="password" value={password} />
            {visibleError && <div className="auth-error" role="alert"><Icon name="info" size={16} />{visibleError}</div>}
            <button className="button button-primary auth-submit" disabled={isSigningIn || !email || !password} type="submit">
              {isSigningIn ? 'Signing in…' : 'Sign in'}
              {!isSigningIn && <Icon name="arrow" size={16} />}
            </button>
              </form>
            ) : (
              <form className="auth-form phone-auth-form" onSubmit={handlePhoneSubmit}>
            {phoneStep === 'number' ? (
              <>
                <div className="phone-number-row">
                  <div className="field phone-country-field">
                    <label htmlFor="phone-country">Country code</label>
                    <select id="phone-country" onChange={(event) => setCountryCode(event.target.value)} value={countryCode}>
                      <option value="+91">India (+91)</option>
                      <option value="+1">United States (+1)</option>
                    </select>
                  </div>
                  <Field helper={countryCode === '+91' ? '10 digits after +91.' : '10 digits after +1.'} label="Phone number" name="auth-phone" onChange={(_, value) => setPhoneNumber(value)} placeholder={countryCode === '+91' ? '98765 43210' : '555 123 4567'} required type="tel" value={phoneNumber} />
                </div>
                <div className="phone-recaptcha-label">Security check</div>
                <div className="phone-recaptcha" id="phone-recaptcha" />
                {visibleError && <div className="auth-error" role="alert"><Icon name="info" size={16} />{visibleError}</div>}
                <button className="button button-primary auth-submit" disabled={isSigningIn || !phoneNumber} type="submit">
                  {isSigningIn ? 'Sending code…' : 'Send verification code'}
                  {!isSigningIn && <Icon name="arrow" size={16} />}
                </button>
              </>
            ) : (
              <>
                <Field helper={`Code sent to ${countryCode} ${phoneNumber}.`} label="Verification code" name="auth-phone-code" onChange={(_, value) => setPhoneCode(value)} placeholder="6-digit code" required value={phoneCode} />
                {visibleError && <div className="auth-error" role="alert"><Icon name="info" size={16} />{visibleError}</div>}
                <button className="button button-primary auth-submit" disabled={isSigningIn || !phoneCode} type="submit">
                  {isSigningIn ? 'Verifying…' : 'Verify and continue'}
                  {!isSigningIn && <Icon name="arrow" size={16} />}
                </button>
                <button className="text-button phone-change-button" onClick={() => { setPhoneStep('number'); setPhoneCode(''); setProviderError(''); onResetPhone(); }} type="button">Use a different number</button>
              </>
            )}
              </form>
            )}
          </div>
          <div className="auth-panel-footer">
            <div className="auth-guest-row">
              <span>Prefer not to sign in?</span>
              <button className="text-button auth-guest-link" onClick={onContinueGuest} type="button">Continue as guest <Icon name="arrow" size={15} /></button>
            </div>
            <p className="auth-guest-note">Drafts stay in this browser. Submit to your agent through anonymous Firebase access.</p>
            <p className="auth-note"><Icon name="shield" size={15} /> Google and phone users are customers unless an agent claim is assigned server-side.</p>
          </div>
        </div>
      </section>
    </main>
  );
}

function Field({
  name,
  label,
  value,
  onChange,
  type = 'text',
  placeholder = '',
  required = false,
  helper = '',
  error = '',
  readOnly = false,
  min,
  max,
  step,
}) {
  const inputId = `field-${name}`;
  return (
    <div className={`field ${error ? 'has-error' : ''}`}>
      <label htmlFor={inputId}>
        {label}
        {required && <span className="required-mark" aria-hidden="true">*</span>}
      </label>
      <input
        aria-describedby={error ? `${inputId}-error` : helper ? `${inputId}-helper` : undefined}
        aria-invalid={Boolean(error)}
        id={inputId}
        max={max}
        min={min}
        name={name}
        onChange={(event) => onChange(name, event.target.value)}
        placeholder={placeholder}
        readOnly={readOnly}
        step={step}
        type={type}
        value={value ?? ''}
      />
      {helper && !error && <p className="field-helper" id={`${inputId}-helper`}>{helper}</p>}
      {error && <p className="field-error" id={`${inputId}-error`} role="alert">{error}</p>}
    </div>
  );
}

function SelectField({ name, label, value, onChange, options, required = false, helper = '', error = '' }) {
  const inputId = `field-${name}`;
  return (
    <div className={`field ${error ? 'has-error' : ''}`}>
      <label htmlFor={inputId}>
        {label}
        {required && <span className="required-mark" aria-hidden="true">*</span>}
      </label>
      <select
        aria-describedby={error ? `${inputId}-error` : helper ? `${inputId}-helper` : undefined}
        aria-invalid={Boolean(error)}
        id={inputId}
        name={name}
        onChange={(event) => onChange(name, event.target.value)}
        value={value ?? ''}
      >
        <option value="">Select an option</option>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
      {helper && !error && <p className="field-helper" id={`${inputId}-helper`}>{helper}</p>}
      {error && <p className="field-error" id={`${inputId}-error`} role="alert">{error}</p>}
    </div>
  );
}

function TextAreaField({ name, label, value, onChange, placeholder = '', helper = '' }) {
  const inputId = `field-${name}`;
  return (
    <div className="field field-wide">
      <label htmlFor={inputId}>{label}</label>
      <textarea
        id={inputId}
        name={name}
        onChange={(event) => onChange(name, event.target.value)}
        placeholder={placeholder}
        rows="3"
        value={value ?? ''}
      />
      {helper && <p className="field-helper" id={`${inputId}-helper`}>{helper}</p>}
    </div>
  );
}

function StatusBadge({ status }) {
  const label = status === 'draft' ? 'Draft' : 'Submitted';
  return (
    <span className={`status-badge status-${status}`}>
      <span className="status-dot" aria-hidden="true" />
      {label}
    </span>
  );
}

function StepRail({ activeStep, highestStep, onStepChange }) {
  return (
    <nav className="step-rail" aria-label="Form progress">
      <div className="staff-line" aria-hidden="true" />
      <div className="step-rail-heading">
        <span>Case score</span>
        <strong>{String(activeStep + 1).padStart(2, '0')} / {String(STEPS.length).padStart(2, '0')}</strong>
      </div>
      <div className="step-list">
        {STEPS.map((step, index) => {
          const completed = index < activeStep;
          const available = index <= highestStep;
          return (
            <button
              aria-current={index === activeStep ? 'step' : undefined}
              className={`step-button ${index === activeStep ? 'is-active' : ''} ${completed ? 'is-complete' : ''}`}
              disabled={!available}
              key={step.id}
              onClick={() => onStepChange(index)}
              type="button"
            >
              <span className="step-marker" aria-hidden="true">
                {completed ? <Icon name="check" size={14} /> : <span>{String(index + 1).padStart(2, '0')}</span>}
              </span>
              <span className="step-copy">
                <strong>{step.label}</strong>
                <small>{step.hint}</small>
              </span>
              {index === activeStep && <Icon name="chevron" size={15} />}
            </button>
          );
        })}
      </div>
      <div className="step-rail-note">
        <Icon name="shield" size={16} />
        <span>Private by role. Customers see only their own records.</span>
      </div>
    </nav>
  );
}

function SectionHeading({ title, description, number }) {
  return (
    <div className="section-heading">
      <div>
        <span className="section-number">{number}</span>
        <h2>{title}</h2>
      </div>
      <p>{description}</p>
    </div>
  );
}

function ActivityChart({ records }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (6 - index));
    return date;
  });
  const activity = days.map((date) => {
    const dateKey = getDateKey(date);
    const updates = records.filter((record) => getDateKey(new Date(record.updatedAt)) === dateKey);
    return {
      date,
      submitted: updates.filter((record) => record.status === 'submitted').length,
      drafts: updates.filter((record) => record.status === 'draft').length,
    };
  });
  const maxValue = Math.max(1, ...activity.map((day) => Math.max(day.submitted, day.drafts)));
  const totalUpdates = activity.reduce((sum, day) => sum + day.submitted + day.drafts, 0);
  const chart = { width: 460, height: 175, left: 27, right: 13, top: 15, bottom: 31 };
  const plotWidth = chart.width - chart.left - chart.right;
  const plotHeight = chart.height - chart.top - chart.bottom;
  const xFor = (index) => chart.left + (index * plotWidth) / (activity.length - 1);
  const yFor = (value) => chart.top + plotHeight - (value / maxValue) * plotHeight;
  const pointsFor = (key) => activity.map((day, index) => `${xFor(index)},${yFor(day[key])}`).join(' ');
  const formatDay = (date) => new Intl.DateTimeFormat('en-IN', { weekday: 'short' }).format(date).slice(0, 3);

  return (
    <aside className="surface-panel chart-panel" aria-labelledby="activity-title">
      <div className="panel-heading">
        <div>
          <h2 id="activity-title">Case activity</h2>
          <p>Updates across the last seven days.</p>
        </div>
        <div className="chart-total">
          <strong>{totalUpdates}</strong>
          <span>updates</span>
        </div>
      </div>
      <div className="chart-wrap">
        <svg
          aria-labelledby="activity-chart-title activity-chart-description"
          className="activity-chart"
          role="img"
          viewBox={`0 0 ${chart.width} ${chart.height}`}
        >
          <title id="activity-chart-title">Submitted and draft case activity</title>
          <desc id="activity-chart-description">A seven-day line chart showing submitted and draft record updates.</desc>
          {[0, 0.5, 1].map((position) => {
            const y = chart.top + plotHeight * position;
            return <line className="chart-grid-line" key={position} x1={chart.left} x2={chart.width - chart.right} y1={y} y2={y} />;
          })}
          <text className="chart-scale" x="3" y={chart.top + 3}>{maxValue}</text>
          <text className="chart-scale" x="9" y={chart.top + plotHeight + 3}>0</text>
          <polyline className="chart-submitted-line" points={pointsFor('submitted')} />
          <polyline className="chart-draft-line" points={pointsFor('drafts')} />
          {activity.map((day, index) => (
            <g key={getDateKey(day.date)}>
              <circle className="chart-point chart-point-submitted" cx={xFor(index)} cy={yFor(day.submitted)} r="3.5" />
              <circle className="chart-point chart-point-draft" cx={xFor(index)} cy={yFor(day.drafts)} r="3.5" />
              <text className="chart-label" textAnchor="middle" x={xFor(index)} y={chart.height - 8}>{formatDay(day.date)}</text>
            </g>
          ))}
        </svg>
      </div>
      <div className="chart-footer">
        <div className="chart-legend">
          <span><i className="legend-swatch legend-submitted" />Submitted</span>
          <span><i className="legend-swatch legend-draft" />Drafts</span>
        </div>
        <span className="chart-note">{totalUpdates ? 'A clear view of recent movement.' : 'No updates in this window.'}</span>
      </div>
    </aside>
  );
}

function OverviewView({ role, user, records, isGuest, isAnonymousGuest, onExitGuest, onStartNew, onContinueDraft, onViewRecords, browserDraft }) {
  const submitted = records.filter((record) => record.status === 'submitted');
  const drafts = records.filter((record) => record.status === 'draft');
  const totalPremium = submitted.reduce((sum, record) => sum + Number(record.premium || 0), 0);
  const latestRecords = records.slice().sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)).slice(0, 4);
  const isAgent = role === 'agent';

  return (
    <div className="page-view overview-view">
      <header className="view-header">
        <div>
          <h1>{isAgent ? 'Your casebook' : 'Your submissions'}</h1>
          <p>{isAgent ? 'A clear working view of every customer record in motion.' : 'Pick up where you left off or review a submitted record.'}</p>
        </div>
        <button className="button button-primary" onClick={onStartNew} type="button">
          <Icon name="plus" size={17} />
          New intake
        </button>
      </header>

      {isGuest && (
        <div className="guest-banner" role="status">
          <span className="guest-mark"><Icon name="info" size={15} /></span>
          <span>
            <strong>{isAnonymousGuest ? 'Guest submission.' : 'Guest mode.'}</strong>{' '}
            {isAnonymousGuest
              ? 'Submitted records sync securely to your agent through this temporary browser session.'
              : 'Drafts stay in this browser. Submitting a record creates a temporary anonymous account so your agent can review it.'}
          </span>
          <button className="text-button" onClick={onExitGuest} type="button">Sign in instead <Icon name="arrow" size={15} /></button>
        </div>
      )}

      {!hasFirebaseConfig && !isGuest && (
        <div className="demo-banner" role="status">
          <span className="demo-mark"><Icon name="info" size={15} /></span>
          <span><strong>Demo workspace.</strong> Add Firebase environment values to sync authentication and records across devices.</span>
        </div>
      )}

      <section className="welcome-band" aria-labelledby="welcome-title">
        <div className="welcome-copy">
          <span className="welcome-mark" aria-hidden="true"><span /></span>
          <div>
            <h2 id="welcome-title">Good morning, {user.name.split(' ')[0]}.</h2>
            <p>{isAgent ? 'The next careful entry is usually the one that keeps a case moving.' : 'Your information stays together from first detail to final review.'}</p>
          </div>
        </div>
        <div className="welcome-action">
          {browserDraft ? (
            <>
              <span className="mini-status"><Icon name="clock" size={14} /> Unsaved form found</span>
              <button className="text-button" onClick={onContinueDraft} type="button">Continue draft <Icon name="arrow" size={15} /></button>
            </>
          ) : (
            <span className="mini-status"><Icon name="shield" size={14} /> {isAgent ? 'Agent view' : 'Customer view'}</span>
          )}
        </div>
      </section>

      <section className="metric-strip" aria-label="Workspace summary">
        <div className="metric">
          <span className="metric-label">{isAgent ? 'All submissions' : 'Your submissions'}</span>
          <strong>{records.length}</strong>
          <span className="metric-note">records in scope</span>
        </div>
        <div className="metric">
          <span className="metric-label">Open drafts</span>
          <strong>{drafts.length}</strong>
          <span className="metric-note">ready to continue</span>
        </div>
        <div className="metric">
          <span className="metric-label">Submitted</span>
          <strong>{submitted.length}</strong>
          <span className="metric-note">through review</span>
        </div>
        <div className="metric metric-accent">
          <span className="metric-label">Premium in view</span>
          <strong>{formatMoney(totalPremium)}</strong>
          <span className="metric-note">annualized total</span>
        </div>
      </section>

      <div className="overview-columns">
        <section className="surface-panel recent-panel" aria-labelledby="recent-title">
          <div className="panel-heading">
            <div>
              <h2 id="recent-title">Recent movement</h2>
              <p>Latest changes across the case score.</p>
            </div>
            <button className="text-button" onClick={onViewRecords} type="button">View all <Icon name="arrow" size={15} /></button>
          </div>
          <div className="recent-list">
            {latestRecords.map((record) => (
              <button className="recent-row" key={record.id} onClick={onViewRecords} type="button">
                <span className="record-index">{record.id.slice(-2)}</span>
                <span className="recent-main">
                  <strong>{record.applicantName || 'Unnamed applicant'}</strong>
                  <small>{record.planName || 'Plan not selected'} · {formatDate(record.updatedAt)}</small>
                </span>
                <span className="recent-value">
                  <StatusBadge status={record.status} />
                  <strong>{formatMoney(record.premium)}</strong>
                </span>
                <Icon name="chevron" size={16} />
              </button>
            ))}
            {!latestRecords.length && <p className="empty-copy">No records yet. Start the first intake to create your case score.</p>}
          </div>
        </section>
        <ActivityChart records={records} />
      </div>
    </div>
  );
}

function RecordsView({
  role,
  records,
  isGuest,
  isAnonymousGuest,
  search,
  setSearch,
  statusFilter,
  setStatusFilter,
  onEdit,
  onOpen,
  onDelete,
  onExport,
  onImport,
  onStartNew,
}) {
  const filteredRecords = records.filter((record) => {
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || [record.id, record.applicantName, record.planName, record.ownerName]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(query));
    const matchesStatus = statusFilter === 'all' || record.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="page-view records-view">
      <header className="view-header">
        <div>
          <h1>{role === 'agent' ? 'All submissions' : 'My submissions'}</h1>
          <p>{role === 'agent' ? 'Every customer record, in one reviewable line of sight.' : 'Your drafts and submitted policy information.'}</p>
        </div>
        <button className="button button-primary" onClick={onStartNew} type="button">
          <Icon name="plus" size={17} />
          New intake
        </button>
      </header>

      <div className="records-toolbar">
        <div className="search-field">
          <Icon name="search" size={17} />
          <label className="visually-hidden" htmlFor="record-search">Search records</label>
          <input
            id="record-search"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name, case ID, or plan"
            type="search"
            value={search}
          />
        </div>
        <div className="toolbar-actions">
          <div className="filter-select">
            <Icon name="filter" size={16} />
            <label className="visually-hidden" htmlFor="status-filter">Filter by status</label>
            <select id="status-filter" onChange={(event) => setStatusFilter(event.target.value)} value={statusFilter}>
              <option value="all">All status</option>
              <option value="submitted">Submitted</option>
              <option value="draft">Drafts</option>
            </select>
          </div>
          <button className="button button-quiet" onClick={onExport} type="button">
            <Icon name="download" size={16} />
            Export
          </button>
          <label className="button button-quiet file-button">
            <Icon name="upload" size={16} />
            Import
            <input accept="application/json" onChange={onImport} type="file" />
          </label>
        </div>
      </div>

      <div className="records-meta">
        <span><strong>{filteredRecords.length}</strong> {filteredRecords.length === 1 ? 'record' : 'records'} in view</span>
        <span className="records-meta-note">{isGuest ? isAnonymousGuest ? 'Guest scope · synced submissions' : 'Guest scope · this browser only' : role === 'agent' ? 'Agent scope · all customers' : 'Customer scope · private to you'}</span>
      </div>

      <section className="surface-panel table-panel" aria-label="Insurance records">
        <div className="records-table-head">
          <span>Applicant</span>
          <span>Plan & premium</span>
          <span>Updated</span>
          <span>Status</span>
          <span className="visually-hidden">Actions</span>
        </div>
        {filteredRecords.map((record) => (
          <div className="record-row" key={record.id}>
            <button className="record-person" onClick={() => onOpen(record)} type="button">
              <span className="person-mark">{(record.applicantName || '?').slice(0, 1).toUpperCase()}</span>
              <span>
                <strong>{record.applicantName || 'Unnamed applicant'}</strong>
                <small>{record.id} · {role === 'agent' ? record.ownerName || 'Customer' : 'Your case'}</small>
              </span>
            </button>
            <div className="record-plan">
              <strong>{record.planName || 'Plan not selected'}</strong>
              <small>{formatMoney(record.premium)} / year · {formatMoney(record.sumAssured)} cover</small>
            </div>
            <span className="record-date">{formatDate(record.updatedAt)}</span>
            <StatusBadge status={record.status} />
            <div className="row-actions">
              <button aria-label={`Edit ${record.applicantName || 'record'}`} className="icon-button" onClick={() => onEdit(record)} title="Edit record" type="button"><Icon name="edit" size={16} /></button>
              <button aria-label={`Delete ${record.applicantName || 'record'}`} className="icon-button icon-danger" onClick={() => onDelete(record)} title="Delete record" type="button"><Icon name="trash" size={16} /></button>
            </div>
          </div>
        ))}
        {!filteredRecords.length && (
          <div className="empty-state">
            <span className="empty-icon"><Icon name="search" size={20} /></span>
            <h2>No records match that line.</h2>
            <p>Try another name or clear the filters to see everything in scope.</p>
            <button className="button button-secondary button-small" onClick={() => { setSearch(''); setStatusFilter('all'); }} type="button">Clear filters</button>
          </div>
        )}
      </section>
    </div>
  );
}

function FormView({
  role,
  user,
  form,
  activeStep,
  highestStep,
  fieldErrors,
  editingId,
  isSaving,
  onChange,
  onRepeaterChange,
  onAddRepeater,
  onRemoveRepeater,
  onStepChange,
  onBack,
  onNext,
  onSaveDraft,
  onSubmit,
  isGuest,
  isAnonymousGuest,
}) {
  const step = STEPS[activeStep];
  const isLastStep = activeStep === STEPS.length - 1;

  return (
    <div className="page-view form-view">
      <header className="form-topbar">
        <button className="back-link" onClick={onBack} type="button"><Icon name="back" size={16} /> Back to {role === 'agent' ? 'casebook' : 'submissions'}</button>
        <div className="form-topbar-meta">
          <span>{editingId ? `Editing ${editingId}` : 'New case score'}</span>
          <span className="topbar-divider" aria-hidden="true" />
          <span>{user.roleLabel} view</span>
        </div>
      </header>

      <div className="form-layout">
        <StepRail activeStep={activeStep} highestStep={highestStep} onStepChange={onStepChange} />
        <main className="form-main">
          <div className="form-main-header">
            <div>
              <span className="form-kicker">Insurance data form</span>
              <h1>{step.label}</h1>
              <p>{step.id === 'review' ? 'Check the record once before it leaves your workspace.' : 'Add only what this section needs. You can return to any completed movement.'}</p>
            </div>
            <div className="form-save-state" aria-live="polite">
              <span className={`save-dot ${isSaving ? 'is-saving' : ''}`} />
              {isSaving ? 'Saving…' : 'Ready to save'}
            </div>
          </div>

          <div className="form-section-wrap">
            {activeStep === 0 && (
              <>
                <SectionHeading description="Start with the person this case is about." number="01" title="Applicant details" />
                <div className="field-grid">
                  <Field error={fieldErrors.fullName} label="Applicant name" name="fullName" onChange={onChange} placeholder="e.g. Aarav Mehta" required value={form.fullName} />
                  <Field label="Proposer name" name="proposerName" onChange={onChange} placeholder="If different from applicant" value={form.proposerName} />
                  <Field error={fieldErrors.dateOfBirth} label="Date of birth" name="dateOfBirth" onChange={onChange} required type="date" value={form.dateOfBirth} />
                  <Field helper="Calculated from date of birth" label="Age" name="age" onChange={onChange} readOnly value={form.age} />
                  <SelectField error={fieldErrors.gender} label="Gender" name="gender" onChange={onChange} options={['Female', 'Male', 'Non-binary', 'Prefer not to say']} required value={form.gender} />
                  <SelectField label="Marital status" name="maritalStatus" onChange={onChange} options={['Single', 'Married', 'Widowed', 'Divorced']} value={form.maritalStatus} />
                  <Field helper="12 digits, stored securely" label="Aadhaar number" name="aadhaar" onChange={onChange} placeholder="0000 0000 0000" value={form.aadhaar} />
                  <Field helper="Format: AAAAA9999A" label="PAN number" name="pan" onChange={onChange} placeholder="ABCDE1234F" value={form.pan} />
                </div>
              </>
            )}

            {activeStep === 1 && (
              <>
                <SectionHeading description="Give the case a reliable line back to the customer." number="02" title="Contact & address" />
                <div className="field-grid">
                  <Field error={fieldErrors.mobile} label="Mobile number" name="mobile" onChange={onChange} placeholder="10-digit mobile number" required type="tel" value={form.mobile} />
                  <Field error={fieldErrors.email} label="Email address" name="email" onChange={onChange} placeholder="name@example.com" required type="email" value={form.email} />
                  <TextAreaField helper="Include house number, street, and locality." label="Full address" name="address" onChange={onChange} placeholder="Address line" value={form.address} />
                  <Field label="City / town" name="city" onChange={onChange} placeholder="e.g. Pune" value={form.city} />
                  <SelectField label="State" name="state" onChange={onChange} options={STATE_OPTIONS} value={form.state} />
                  <Field label="PIN code" name="pincode" onChange={onChange} placeholder="6-digit PIN" value={form.pincode} />
                  <SelectField label="Residential status" name="residentialStatus" onChange={onChange} options={['Resident Indian', 'NRI', 'Foreign resident']} value={form.residentialStatus} />
                </div>
              </>
            )}

            {activeStep === 2 && (
              <>
                <SectionHeading description="Capture the context that supports the proposed cover." number="03" title="Work & income" />
                <div className="field-grid">
                  <SelectField label="Highest education" name="education" onChange={onChange} options={['School', 'Diploma', 'Graduate', 'Postgraduate', 'Professional']} value={form.education} />
                  <Field error={fieldErrors.occupation} label="Current occupation" name="occupation" onChange={onChange} placeholder="e.g. Product designer" required value={form.occupation} />
                  <Field error={fieldErrors.annualIncome} label="Annual income" name="annualIncome" onChange={onChange} placeholder="₹ 0" required type="number" value={form.annualIncome} />
                  <Field label="Employer / business" name="employer" onChange={onChange} placeholder="Company or practice name" value={form.employer} />
                </div>
                <div className="inline-note"><Icon name="info" size={16} /><span>Use the income figure the customer is comfortable supporting with documentation.</span></div>
              </>
            )}

            {activeStep === 3 && (
              <>
                <SectionHeading description="Define the cover and the rhythm of the premium." number="04" title="Proposed plan" />
                <div className="field-grid">
                  <Field error={fieldErrors.planName} label="Plan name" name="planName" onChange={onChange} placeholder="e.g. Jeevan Labh" required value={form.planName} />
                  <Field label="Plan number" name="planNumber" onChange={onChange} placeholder="Optional plan code" value={form.planNumber} />
                  <Field label="Policy term" name="policyTerm" onChange={onChange} placeholder="Years" type="number" value={form.policyTerm} />
                  <SelectField label="Premium mode" name="premiumMode" onChange={onChange} options={['Monthly', 'Quarterly', 'Half-yearly', 'Annual', 'Single']} value={form.premiumMode} />
                  <Field error={fieldErrors.sumAssured} label="Sum assured" name="sumAssured" onChange={onChange} placeholder="₹ 0" required type="number" value={form.sumAssured} />
                  <Field error={fieldErrors.premium} label="Premium" name="premium" onChange={onChange} placeholder="₹ 0" required type="number" value={form.premium} />
                  <Field error={fieldErrors.commencementDate} label="Commencement date" name="commencementDate" onChange={onChange} required type="date" value={form.commencementDate} />
                </div>
                <div className="plan-callout">
                  <span className="callout-rule" aria-hidden="true" />
                  <div><strong>Proposal rhythm</strong><p>{form.premium ? `${formatMoney(form.premium)} ${form.premiumMode.toLowerCase()} premium` : 'Add the premium to see the case rhythm.'}</p></div>
                </div>
              </>
            )}

            {activeStep === 4 && (
              <>
                <SectionHeading description="Set the people who should receive the policy benefit." number="05" title="Nominee & appointee" />
                {fieldErrors.nominees && <div className="validation-summary" role="alert"><Icon name="info" size={16} />{fieldErrors.nominees}</div>}
                <div className="repeater-stack">
                  {form.nominees.map((nominee, index) => (
                    <div className="repeater-row nominee-row" key={`nominee-${index}`}>
                      <div className="repeater-heading"><span className="repeater-index">0{index + 1}</span><div><strong>Nominee {index + 1}</strong><small>Benefit allocation</small></div>{form.nominees.length > 1 && <button className="remove-link" onClick={() => onRemoveRepeater('nominees', index)} type="button"><Icon name="trash" size={15} /> Remove</button>}</div>
                      <div className="field-grid compact-grid">
                        <Field error={fieldErrors[`nominee-${index}-name`]} label="Full name" name={`nominees.${index}.name`} onChange={(_, value) => onRepeaterChange('nominees', index, 'name', value)} placeholder="Nominee name" required value={nominee.name} />
                        <SelectField error={fieldErrors[`nominee-${index}-relation`]} label="Relation" name={`nominees.${index}.relation`} onChange={(_, value) => onRepeaterChange('nominees', index, 'relation', value)} options={['Spouse', 'Father', 'Mother', 'Son', 'Daughter', 'Sibling', 'Other']} required value={nominee.relation} />
                        <Field label="Age" name={`nominees.${index}.age`} onChange={(_, value) => onRepeaterChange('nominees', index, 'age', value)} type="number" value={nominee.age} />
                        <Field label="Share %" name={`nominees.${index}.share`} onChange={(_, value) => onRepeaterChange('nominees', index, 'share', value)} type="number" value={nominee.share} />
                        <Field label="Mobile number" name={`nominees.${index}.phone`} onChange={(_, value) => onRepeaterChange('nominees', index, 'phone', value)} type="tel" value={nominee.phone} />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="repeater-footer"><button className="button button-quiet" onClick={() => onAddRepeater('nominees')} type="button"><Icon name="plus" size={16} /> Add another nominee</button><span className={form.nominees.reduce((sum, item) => sum + Number(item.share || 0), 0) === 100 ? 'share-total is-valid' : 'share-total'}><span>Allocated</span><strong>{form.nominees.reduce((sum, item) => sum + Number(item.share || 0), 0)}%</strong></span></div>
              </>
            )}

            {activeStep === 5 && (
              <>
                <SectionHeading description="Keep payment details ready for the final review." number="06" title="Bank details" />
                <div className="field-grid">
                  <Field label="Bank name" name="bankName" onChange={onChange} placeholder="e.g. HDFC Bank" value={form.bankName} />
                  <SelectField label="Account type" name="accountType" onChange={onChange} options={['Savings', 'Current', 'Salary']} value={form.accountType} />
                  <Field label="Account number" name="accountNumber" onChange={onChange} placeholder="Account number" value={form.accountNumber} />
                  <Field helper="11 characters" label="IFSC code" name="ifsc" onChange={onChange} placeholder="HDFC0000000" value={form.ifsc} />
                  <Field label="MICR code" name="micr" onChange={onChange} placeholder="9-digit MICR" value={form.micr} />
                </div>
                <div className="inline-note"><Icon name="shield" size={16} /><span>Bank fields are treated as sensitive and should be protected by your Firebase security rules.</span></div>
              </>
            )}

            {activeStep === 6 && (
              <>
                <SectionHeading description="Record the family and medical context that changes the case." number="07" title="Family & health" />
                <div className="subsection-label">Immediate family</div>
                <div className="family-grid">
                  <div className="family-person"><strong>Father</strong><div className="field-grid compact-grid"><Field label="Age" name="fatherAge" onChange={onChange} type="number" value={form.fatherAge} /><Field label="State of health" name="fatherHealth" onChange={onChange} placeholder="Healthy, deceased…" value={form.fatherHealth} /></div></div>
                  <div className="family-person"><strong>Mother</strong><div className="field-grid compact-grid"><Field label="Age" name="motherAge" onChange={onChange} type="number" value={form.motherAge} /><Field label="State of health" name="motherHealth" onChange={onChange} placeholder="Healthy, deceased…" value={form.motherHealth} /></div></div>
                  <div className="family-person"><strong>Spouse</strong><div className="field-grid compact-grid"><Field label="Age" name="spouseAge" onChange={onChange} type="number" value={form.spouseAge} /><Field label="State of health" name="spouseHealth" onChange={onChange} placeholder="Healthy, deceased…" value={form.spouseHealth} /></div></div>
                </div>
                <div className="subsection-label">Siblings</div>
                <div className="mini-repeater">
                  {form.siblings.map((sibling, index) => <div className="mini-repeater-row" key={`sibling-${index}`}><span>{String(index + 1).padStart(2, '0')}</span><SelectField label="Relation" name={`siblings.${index}.relation`} onChange={(_, value) => onRepeaterChange('siblings', index, 'relation', value)} options={['Brother', 'Sister']} value={sibling.relation} /><Field label="Age" name={`siblings.${index}.age`} onChange={(_, value) => onRepeaterChange('siblings', index, 'age', value)} type="number" value={sibling.age} /><SelectField label="State" name={`siblings.${index}.health`} onChange={(_, value) => onRepeaterChange('siblings', index, 'health', value)} options={['Alive', 'Dead']} value={sibling.health} /><button aria-label="Remove sibling" className="icon-button icon-danger" onClick={() => onRemoveRepeater('siblings', index)} type="button"><Icon name="trash" size={15} /></button></div>)}
                  <button className="button button-quiet button-small" onClick={() => onAddRepeater('siblings')} type="button"><Icon name="plus" size={15} /> Add sibling</button>
                </div>
                <div className="subsection-label">Children & measurements</div>
                <div className="mini-repeater">
                  {form.children.map((child, index) => <div className="mini-repeater-row" key={`child-${index}`}><span>{String(index + 1).padStart(2, '0')}</span><Field label="Age" name={`children.${index}.age`} onChange={(_, value) => onRepeaterChange('children', index, 'age', value)} type="number" value={child.age} /><SelectField label="State" name={`children.${index}.health`} onChange={(_, value) => onRepeaterChange('children', index, 'health', value)} options={['Alive', 'Dead']} value={child.health} /><button aria-label="Remove child" className="icon-button icon-danger" onClick={() => onRemoveRepeater('children', index)} type="button"><Icon name="trash" size={15} /></button></div>)}
                  <button className="button button-quiet button-small" onClick={() => onAddRepeater('children')} type="button"><Icon name="plus" size={15} /> Add child</button>
                </div>
                <div className="field-grid compact-grid health-measurements"><Field label="Height (cm)" name="height" onChange={onChange} type="number" value={form.height} /><Field label="Weight (kg)" name="weight" onChange={onChange} type="number" value={form.weight} /><Field label="Abdomen (cm)" name="abdomen" onChange={onChange} type="number" value={form.abdomen} /><SelectField label="Past operations" name="operations" onChange={onChange} options={['No', 'Yes']} value={form.operations} /></div>
                <div className="field-grid compact-grid"><SelectField label="Disease history" name="disease" onChange={onChange} options={['No', 'Yes']} value={form.disease} />{form.disease === 'Yes' && <Field label="Disease details" name="diseaseDetails" onChange={onChange} value={form.diseaseDetails} />}{form.operations === 'Yes' && <Field label="Operation details" name="operationsDetails" onChange={onChange} value={form.operationsDetails} />}</div>
              </>
            )}

            {activeStep === 7 && (
              <>
                <SectionHeading description="A short history prevents duplicate or incomplete records." number="08" title="Previous policies" />
                <div className="repeater-stack">
                  {form.previousPolicies.map((policy, index) => (
                    <div className="repeater-row previous-row" key={`policy-${index}`}>
                      <div className="repeater-heading"><span className="repeater-index">0{index + 1}</span><div><strong>Previous policy {index + 1}</strong><small>Policy history</small></div><button className="remove-link" onClick={() => onRemoveRepeater('previousPolicies', index)} type="button"><Icon name="trash" size={15} /> Remove</button></div>
                      <div className="field-grid compact-grid">
                        <Field label="Policy number" name={`previousPolicies.${index}.policyNumber`} onChange={(_, value) => onRepeaterChange('previousPolicies', index, 'policyNumber', value)} value={policy.policyNumber} />
                        <Field label="Branch" name={`previousPolicies.${index}.branch`} onChange={(_, value) => onRepeaterChange('previousPolicies', index, 'branch', value)} value={policy.branch} />
                        <Field label="Plan / term" name={`previousPolicies.${index}.planTerm`} onChange={(_, value) => onRepeaterChange('previousPolicies', index, 'planTerm', value)} value={policy.planTerm} />
                        <Field label="Sum assured" name={`previousPolicies.${index}.sumAssured`} onChange={(_, value) => onRepeaterChange('previousPolicies', index, 'sumAssured', value)} type="number" value={policy.sumAssured} />
                        <Field label="Premium" name={`previousPolicies.${index}.premium`} onChange={(_, value) => onRepeaterChange('previousPolicies', index, 'premium', value)} type="number" value={policy.premium} />
                        <SelectField label="Inforce status" name={`previousPolicies.${index}.inforce`} onChange={(_, value) => onRepeaterChange('previousPolicies', index, 'inforce', value)} options={['In force', 'Lapsed', 'Matured', 'Surrendered']} value={policy.inforce} />
                      </div>
                    </div>
                  ))}
                </div>
                <button className="button button-quiet" onClick={() => onAddRepeater('previousPolicies')} type="button"><Icon name="plus" size={16} /> Add previous policy</button>
                {!form.previousPolicies.length && <div className="empty-inline"><Icon name="check" size={15} /><span>No previous policies recorded. You can continue.</span></div>}
              </>
            )}

            {activeStep === 8 && (
              <ReviewPanel fieldErrors={fieldErrors} form={form} isAnonymousGuest={isAnonymousGuest} isGuest={isGuest} onStepChange={onStepChange} />
            )}
          </div>

          <footer className="form-footer">
            <button className="button button-quiet" disabled={activeStep === 0} onClick={() => onStepChange(activeStep - 1)} type="button"><Icon name="back" size={16} /> Previous</button>
            <div className="form-footer-actions">
              <button className="button button-secondary" disabled={isSaving} onClick={onSaveDraft} type="button">{isSaving ? 'Saving…' : 'Save draft'}</button>
              {isLastStep ? (
                <button className="button button-primary" disabled={isSaving} onClick={onSubmit} type="button"><Icon name="check" size={16} /> Submit record</button>
              ) : (
                <button className="button button-primary" onClick={onNext} type="button">Continue <Icon name="arrow" size={16} /></button>
              )}
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}

function ReviewPanel({ form, fieldErrors, isAnonymousGuest, isGuest, onStepChange }) {
  const reviewSections = [
    { step: 0, title: 'Applicant', fields: [['fullName', 'Name'], ['dateOfBirth', 'Date of birth'], ['gender', 'Gender'], ['maritalStatus', 'Marital status']] },
    { step: 1, title: 'Contact', fields: [['mobile', 'Mobile'], ['email', 'Email'], ['city', 'City'], ['state', 'State']] },
    { step: 2, title: 'Work & income', fields: [['occupation', 'Occupation'], ['annualIncome', 'Annual income'], ['employer', 'Employer']] },
    { step: 3, title: 'Proposed plan', fields: [['planName', 'Plan'], ['sumAssured', 'Sum assured'], ['premium', 'Premium'], ['premiumMode', 'Mode']] },
    { step: 4, title: 'Nominee', fields: [['nominees', 'Nominees']] },
    { step: 5, title: 'Bank details', fields: [['bankName', 'Bank'], ['accountType', 'Account type'], ['ifsc', 'IFSC']] },
  ];

  return (
    <div className="review-panel">
      <SectionHeading description="A final pass keeps the submitted record useful to everyone who touches it." number="09" title="Review & submit" />
      {Object.keys(fieldErrors).length > 0 && <div className="validation-summary" role="alert"><Icon name="info" size={16} /><span>There are a few details to resolve. Use the edit links below to return to their section.</span></div>}
      <div className="review-grid">
        {reviewSections.map((section) => (
          <section className="review-block" key={section.title}>
            <div className="review-block-heading"><h3>{section.title}</h3><button className="text-button" onClick={() => onStepChange(section.step)} type="button">Edit <Icon name="edit" size={14} /></button></div>
            <dl>
              {section.fields.map(([field, label]) => {
                const value = field === 'nominees'
                  ? form.nominees.map((nominee) => nominee.name || 'Unnamed').join(', ')
                  : form[field];
                return <div className={fieldErrors[field] ? 'review-field has-error' : 'review-field'} key={field}><dt>{label}</dt><dd>{field === 'premium' || field === 'sumAssured' || field === 'annualIncome' ? formatMoney(value) : value || 'Not added'}</dd></div>;
              })}
            </dl>
          </section>
        ))}
      </div>
      <div className="review-ready"><span className="ready-mark"><Icon name={isGuest ? 'info' : 'shield'} size={18} /></span><div><strong>Ready for a careful submit?</strong><p>{isGuest ? isAnonymousGuest ? 'This record will sync securely so your agent can review it. Your guest access remains tied to this browser.' : 'Submitting will create a temporary anonymous Firebase account and send this record securely to your agent.' : 'This record will be visible to the agent workspace and to the customer who owns it.'}</p></div></div>
    </div>
  );
}

function RecordDrawer({ record, onClose, onEdit }) {
  if (!record) return null;
  const data = record.formData || {};
  return (
    <div className="drawer-layer" role="presentation">
      <button aria-label="Close record details" className="drawer-backdrop" onClick={onClose} type="button" />
      <aside aria-labelledby="drawer-title" className="record-drawer" role="dialog">
        <div className="drawer-header">
          <div><span className="drawer-label">{record.id}</span><h2 id="drawer-title">{record.applicantName || 'Unnamed applicant'}</h2></div>
          <button aria-label="Close details" className="icon-button" onClick={onClose} type="button"><Icon name="close" size={18} /></button>
        </div>
        <div className="drawer-summary"><StatusBadge status={record.status} /><span>{formatDate(record.updatedAt)}</span><span>{record.planName || 'Plan not selected'}</span></div>
        <div className="drawer-content">
          <div className="drawer-total"><span>Sum assured</span><strong>{formatMoney(record.sumAssured)}</strong><small>{formatMoney(record.premium)} {data.premiumMode?.toLowerCase() || 'annual'} premium</small></div>
          <div className="drawer-section"><span className="drawer-section-label">Applicant</span><dl><div><dt>Date of birth</dt><dd>{formatDate(data.dateOfBirth)}</dd></div><div><dt>Mobile</dt><dd>{data.mobile || 'Not added'}</dd></div><div><dt>Email</dt><dd>{data.email || 'Not added'}</dd></div><div><dt>Occupation</dt><dd>{data.occupation || 'Not added'}</dd></div></dl></div>
          <div className="drawer-section"><span className="drawer-section-label">Nominee</span><dl>{(data.nominees || []).map((nominee, index) => <div key={`${nominee.name}-${index}`}><dt>{nominee.relation || 'Nominee'} · {nominee.share || 0}%</dt><dd>{nominee.name || 'Not added'}</dd></div>)}</dl></div>
          <div className="drawer-section"><span className="drawer-section-label">Ownership</span><p className="drawer-note">This case is owned by <strong>{record.ownerName || 'the customer'}</strong>{record.agentName ? ` and visible to ${record.agentName}.` : '.'}</p></div>
        </div>
        <div className="drawer-footer"><button className="button button-secondary" onClick={onClose} type="button">Close</button><button className="button button-primary" onClick={() => onEdit(record)} type="button"><Icon name="edit" size={15} /> Edit record</button></div>
      </aside>
    </div>
  );
}

function App() {
  const [role, setRole] = useState('agent');
  const [authSession, setAuthSession] = useState({
    loading: hasFirebaseConfig,
    user: null,
    error: null,
  });
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [view, setView] = useState('overview');
  const [records, setRecords] = useState([]);
  const [form, setForm] = useState(createInitialForm);
  const [activeStep, setActiveStep] = useState(0);
  const [highestStep, setHighestStep] = useState(0);
  const [editingId, setEditingId] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [toast, setToast] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [browserDraft, setBrowserDraft] = useState(() => readDraftSnapshot());

  const isGuestMode = hasFirebaseConfig && ['guest', 'anonymous'].includes(authSession.user?.mode);
  const isAnonymousGuest = hasFirebaseConfig && authSession.user?.mode === 'anonymous';
  const user = hasFirebaseConfig
    ? isGuestMode
      ? authSession.user
      : { ...ROLE_USERS[role], ...authSession.user, roleLabel: role === 'agent' ? 'Agent' : 'Customer' }
    : ROLE_USERS[role];
  const scopedRecords = useMemo(
    () => records.filter((record) => user.role === 'agent' || record.ownerId === user.id),
    [records, user.id, user.role],
  );

  useEffect(() => {
    if (!hasFirebaseConfig) return undefined;
    return subscribeToAuth(({ user: signedInUser, error }) => {
      setAuthSession({ loading: false, user: signedInUser, error });
      if (signedInUser) setRole(signedInUser.role);
    });
  }, []);

  useEffect(() => {
    if (hasFirebaseConfig && (authSession.loading || !authSession.user)) return undefined;
    let isMounted = true;
    loadRecords(authSession.user)
      .then((loadedRecords) => {
        if (isMounted) setRecords(loadedRecords);
      })
      .catch((error) => {
        if (isMounted) {
          setLoadError(error.message || 'Records could not be loaded.');
          notify('Records could not be loaded. Check your Firebase connection.', 'error');
        }
      });
    return () => { isMounted = false; };
  }, [authSession.loading, authSession.user]);

  useEffect(() => {
    if (view === 'form' && hasFormContent(form)) saveDraftSnapshot(form, authSession.user);
  }, [authSession.user, form, view]);

  useEffect(() => {
    setBrowserDraft(readDraftSnapshot(authSession.user));
  }, [authSession.user]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function notify(message, tone = 'success') {
    setToast({ message, tone });
  }

  async function handleSignIn(email, password) {
    setIsSigningIn(true);
    try {
      await signIn(email, password);
    } catch (error) {
      setAuthSession((current) => ({ ...current, error }));
    } finally {
      setIsSigningIn(false);
    }
  }

  async function handleGoogleSignIn() {
    setIsSigningIn(true);
    try {
      await signInWithGoogle();
    } catch (error) {
      setAuthSession((current) => ({ ...current, error }));
      throw error;
    } finally {
      setIsSigningIn(false);
    }
  }

  async function handleRequestPhoneCode(phoneNumber) {
    setIsSigningIn(true);
    try {
      await requestPhoneCode(phoneNumber, 'phone-recaptcha');
    } finally {
      setIsSigningIn(false);
    }
  }

  async function handlePreparePhoneRecaptcha(containerId) {
    await preparePhoneRecaptcha(containerId);
  }

  async function handleConfirmPhoneCode(code) {
    setIsSigningIn(true);
    try {
      await confirmPhoneCode(code);
    } finally {
      setIsSigningIn(false);
    }
  }

  function handleResetPhone() {
    clearPhoneAuth();
  }

  function handleContinueGuest() {
    const guest = getGuestSession();
    setRole('customer');
    setAuthSession({ loading: false, user: guest, error: null });
    setRecords([]);
    setSelectedRecord(null);
    setLoadError('');
    setView('overview');
    notify('Guest mode enabled. Your entries will stay in this browser.');
  }

  async function handleExitGuest() {
    try {
      await signOutUser();
    } catch (error) {
      notify(error.message || 'Could not leave guest mode.', 'error');
      return;
    }
    setAuthSession({ loading: false, user: null, error: null });
    setRecords([]);
    setSelectedRecord(null);
    setBrowserDraft(null);
    setView('overview');
  }

  async function handleSignOut() {
    try {
      await signOutUser();
      setRecords([]);
      setView('overview');
    } catch (error) {
      notify(error.message || 'Could not sign out.', 'error');
    }
  }

  function handleChange(field, value) {
    setForm((current) => ({
      ...current,
      [field]: field === 'dateOfBirth' ? value : value,
      ...(field === 'dateOfBirth' ? { age: calculateAge(value) } : {}),
    }));
    setFieldErrors((current) => {
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function handleRepeaterChange(type, index, field, value) {
    setForm((current) => ({
      ...current,
      [type]: current[type].map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item),
    }));
    setFieldErrors((current) => {
      const next = { ...current };
      delete next[`${type}-${index}-${field}`];
      delete next[type];
      return next;
    });
  }

  function handleAddRepeater(type) {
    const templates = {
      nominees: { name: '', relation: '', share: '0', age: '', phone: '' },
      siblings: { relation: 'Brother', age: '', health: 'Alive' },
      children: { age: '', health: 'Alive' },
      previousPolicies: { policyNumber: '', branch: '', planTerm: '', sumAssured: '', premium: '', inforce: 'In force' },
    };
    setForm((current) => ({ ...current, [type]: [...current[type], templates[type]] }));
  }

  function handleRemoveRepeater(type, index) {
    setForm((current) => ({ ...current, [type]: current[type].filter((_item, itemIndex) => itemIndex !== index) }));
  }

  function openNewForm() {
    setForm(createInitialForm());
    setEditingId(null);
    setActiveStep(0);
    setHighestStep(0);
    setFieldErrors({});
    setView('form');
  }

  function continueBrowserDraft() {
    const draft = readDraftSnapshot(authSession.user);
    if (!draft) {
      notify('That browser draft is no longer available.', 'error');
      setBrowserDraft(null);
      return;
    }
    setForm(normalizeForm(draft));
    setEditingId(null);
    setActiveStep(0);
    setHighestStep(0);
    setFieldErrors({});
    setView('form');
    notify('Draft restored. Continue where you left off.');
  }

  function openEdit(record) {
    setForm(normalizeForm(record.formData));
    setEditingId(record.id);
    setActiveStep(0);
    setHighestStep(STEPS.length - 1);
    setFieldErrors({});
    setSelectedRecord(null);
    setView('form');
  }

  function handleStepChange(nextStep) {
    if (nextStep < 0 || nextStep >= STEPS.length) return;
    setActiveStep(nextStep);
    setHighestStep((current) => Math.max(current, nextStep));
    setFieldErrors({});
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleNext() {
    const errors = validateStep(activeStep, form);
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      notify('Complete the highlighted details before continuing.', 'error');
      return;
    }
    handleStepChange(activeStep + 1);
  }

  function buildRecord(status, session = authSession.user) {
    const existing = records.find((record) => record.id === editingId);
    return {
      ...(existing || {}),
      id: editingId || createCaseId(),
      ownerId: session?.mode === 'anonymous'
        ? session.id
        : existing?.ownerId || session?.id || user.id,
      ownerName: form.fullName || existing?.ownerName || 'Unnamed customer',
      agentName: role === 'agent' ? user.name : existing?.agentName || 'Riya Menon',
      applicantName: form.fullName || 'Unnamed applicant',
      planName: form.planName || 'Plan not selected',
      premium: Number(form.premium || 0),
      sumAssured: Number(form.sumAssured || 0),
      status,
      submissionMode: session?.mode === 'anonymous' ? 'anonymous' : session?.mode === 'guest' ? 'local-guest' : 'authenticated',
      updatedAt: new Date().toISOString(),
      formData: form,
    };
  }

  async function persistRecord(status, session = authSession.user) {
    setIsSaving(true);
    try {
      const record = buildRecord(status, session);
      const result = await saveRecord(record, session);
      setRecords((current) => result.records || [record, ...current.filter((item) => item.id !== record.id)]);
      return record;
    } catch (error) {
      notify(error.message || 'The record could not be saved.', 'error');
      return null;
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSaveDraft() {
    const record = await persistRecord('draft');
    if (!record) return;
    setEditingId(record.id);
    setBrowserDraft(form);
    notify(`${record.id} saved as a draft.`);
  }

  async function handleSubmit() {
    const errors = validateAll(form);
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      const firstErrorStep = STEPS.slice(0, -1).findIndex((_step, index) => Object.keys(validateStep(index, form)).length > 0);
      setActiveStep(firstErrorStep >= 0 ? firstErrorStep : 0);
      notify('A few required details still need attention.', 'error');
      return;
    }

    let submitSession = authSession.user;
    if (submitSession?.mode === 'guest') {
      try {
        submitSession = await signInAnonymouslyUser();
        setAuthSession({ loading: false, user: submitSession, error: null });
        setRole('customer');
      } catch (error) {
        notify('Guest submission needs Firebase Anonymous Authentication enabled. No data was uploaded.', 'error');
        return;
      }
    }

    const record = await persistRecord('submitted', submitSession);
    if (!record) return;
    clearDraftSnapshot(submitSession?.mode === 'anonymous' ? authSession.user : submitSession);
    setBrowserDraft(null);
    if (submitSession?.mode === 'anonymous' && authSession.user?.mode === 'guest') {
      setRecords([record]);
    }
    setEditingId(null);
    setView('records');
    setActiveStep(0);
    notify(`${record.id} submitted and ready for review.`);
  }

  async function handleDelete(record) {
    const confirmed = window.confirm(`Delete ${record.id}? This cannot be undone.`);
    if (!confirmed) return;
    try {
      await removeRecord(record.id, authSession.user);
      setRecords((current) => current.filter((item) => item.id !== record.id));
      setSelectedRecord(null);
      notify(`${record.id} was deleted.`);
    } catch (error) {
      notify(error.message || 'The record could not be deleted.', 'error');
    }
  }

  function handleImport(event) {
    const [file] = event.target.files || [];
    if (!file) return;
    importRecords(file, authSession.user)
      .then((imported) => {
        setRecords(imported);
        notify(`${imported.length} records imported.`);
      })
      .catch((error) => notify(error.message || 'The file could not be imported.', 'error'))
      .finally(() => { event.target.value = ''; });
  }

  function handleRoleChange(nextRole) {
    if (hasFirebaseConfig) return;
    setRole(nextRole);
    setSelectedRecord(null);
    setView('overview');
    setSearch('');
    setStatusFilter('all');
  }

  if (hasFirebaseConfig && authSession.loading) {
    return <AuthLoading />;
  }

  if (hasFirebaseConfig && !authSession.user) {
    return <SignInView error={authSession.error?.message} isSigningIn={isSigningIn} onConfirmPhoneCode={handleConfirmPhoneCode} onContinueGuest={handleContinueGuest} onGoogleSignIn={handleGoogleSignIn} onPreparePhoneRecaptcha={handlePreparePhoneRecaptcha} onRequestPhoneCode={handleRequestPhoneCode} onResetPhone={handleResetPhone} onSignIn={handleSignIn} />;
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true"><span className="brand-mark-line" /></span>
          <div><strong>casebook</strong><small>insurance data</small></div>
        </div>
        <div className="sidebar-divider" />
        {!hasFirebaseConfig && <div className="role-switcher">
          <span className="sidebar-label">Viewing as</span>
          <div className="role-toggle" role="group" aria-label="Choose workspace role">
            <button className={role === 'agent' ? 'is-active' : ''} onClick={() => handleRoleChange('agent')} type="button">Agent</button>
            <button className={role === 'customer' ? 'is-active' : ''} onClick={() => handleRoleChange('customer')} type="button">Customer</button>
          </div>
        </div>}
        <nav className="main-nav" aria-label="Main navigation">
          <span className="sidebar-label">Workspace</span>
          <button className={view === 'overview' ? 'nav-item is-active' : 'nav-item'} onClick={() => setView('overview')} type="button"><Icon name="grid" size={18} /><span>Overview</span><span className="nav-marker" /></button>
          <button className={view === 'records' ? 'nav-item is-active' : 'nav-item'} onClick={() => setView('records')} type="button"><Icon name="file" size={18} /><span>{role === 'agent' ? 'Submissions' : 'My submissions'}</span><span className="nav-count">{scopedRecords.length}</span></button>
        </nav>
        <div className="sidebar-bottom">
          <div className="security-note"><Icon name={isGuestMode ? 'info' : 'shield'} size={17} /><div><strong>{isGuestMode ? 'Guest mode' : 'Role-aware by design'}</strong><span>{isAnonymousGuest ? 'Submitted records sync securely.' : isGuestMode ? 'Records stay on this device.' : 'Private information stays in scope.'}</span></div></div>
          <div className="user-card"><span className="avatar">{user.initials}</span><div><strong>{user.name}</strong><span>{user.roleLabel} workspace</span></div>{hasFirebaseConfig && <button aria-label={isGuestMode ? 'Exit guest mode' : 'Sign out'} className="user-more" onClick={isGuestMode ? handleExitGuest : handleSignOut} title={isGuestMode ? 'Exit guest mode' : 'Sign out'} type="button"><Icon name="logout" size={15} /></button>}</div>
        </div>
      </aside>

      <main className="main-content">
        {loadError && <div className="load-error" role="alert"><Icon name="info" size={16} />{loadError}</div>}
        {view === 'overview' && <OverviewView browserDraft={browserDraft} isAnonymousGuest={isAnonymousGuest} isGuest={isGuestMode} onContinueDraft={continueBrowserDraft} onExitGuest={handleExitGuest} onStartNew={openNewForm} onViewRecords={() => setView('records')} records={scopedRecords} role={role} user={user} />}
        {view === 'records' && <RecordsView isAnonymousGuest={isAnonymousGuest} isGuest={isGuestMode} onDelete={handleDelete} onEdit={openEdit} onExport={() => { exportRecords(scopedRecords); notify('Export started.'); }} onImport={handleImport} onOpen={setSelectedRecord} onStartNew={openNewForm} records={scopedRecords} role={role} search={search} setSearch={setSearch} setStatusFilter={setStatusFilter} statusFilter={statusFilter} />}
        {view === 'form' && <FormView activeStep={activeStep} editingId={editingId} fieldErrors={fieldErrors} form={form} highestStep={highestStep} isAnonymousGuest={isAnonymousGuest} isGuest={isGuestMode} isSaving={isSaving} onAddRepeater={handleAddRepeater} onBack={() => setView('overview')} onChange={handleChange} onNext={handleNext} onRemoveRepeater={handleRemoveRepeater} onRepeaterChange={handleRepeaterChange} onSaveDraft={handleSaveDraft} onStepChange={handleStepChange} onSubmit={handleSubmit} role={role} user={user} />}
      </main>

      <RecordDrawer onClose={() => setSelectedRecord(null)} onEdit={openEdit} record={selectedRecord} />
      {toast && <div aria-live="polite" className={`toast toast-${toast.tone}`}><span className="toast-icon"><Icon name={toast.tone === 'error' ? 'info' : 'check'} size={15} /></span><span>{toast.message}</span><button aria-label="Dismiss message" className="toast-close" onClick={() => setToast(null)} type="button"><Icon name="close" size={15} /></button></div>}
    </div>
  );
}

export default App;
