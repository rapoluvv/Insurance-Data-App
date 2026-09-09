import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const email = process.argv[2] || process.env.AGENT_EMAIL;

if (!email) {
  throw new Error('Provide an agent email: npm run set-agent-role -- agent@example.com');
}

const app = getApps().length ? getApps()[0] : initializeApp();
const auth = getAuth(app);
const user = await auth.getUserByEmail(email);

await auth.setCustomUserClaims(user.uid, {
  ...(user.customClaims || {}),
  agent: true,
});

console.log(`Agent role assigned to ${email} (${user.uid}).`);
console.log('The user must sign out and sign in again before the app sees the new role.');
