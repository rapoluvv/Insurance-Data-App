# Casebook — Insurance Data App

React/Vite replacement for the reference `Insurance Data Form` app. The interface keeps the multi-step insurance workflow while giving agents and customers role-scoped views of their records.

## Run locally

```bash
npm install
npm run dev
```

The app runs in an explicit demo mode until Firebase environment values are supplied. Demo records and drafts persist in the browser's local storage so the interface can be reviewed without a backend.

## Firebase setup

1. Copy `.env.example` to `.env.local`.
2. Add the web app values from your Firebase project.
3. Enable Firebase Authentication with email/password.
4. Deploy `firestore.rules`.
5. Give agent accounts the server-side custom claim `{ "agent": true }`. Accounts without that claim are treated as customers.

The client never lets a Firebase-authenticated user choose their role. Agents load the full `insuranceSubmissions` collection; customers query only records whose `ownerId` matches their Firebase UID. Firestore rules enforce the same boundary.

## Included workflow

- Nine-step guided insurance form with validation and review.
- Draft saving and resume behavior.
- Dynamic nominees, siblings, children, and previous-policy rows.
- Submitted/draft record view with search, status filtering, drawer details, edit, delete, JSON export, and JSON import.
- Responsive case-score layout with keyboard-visible focus states and reduced-motion support.
- No AI summary integration; the old client-side API key surface is intentionally not carried over.
