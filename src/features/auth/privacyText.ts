// PHASE_15_PLUS 4.4: the privacy note shown before an account is made and in Settings. It is a statement made in the
// instance owner's name, approved by the owner on 2026-10-20.
export const PRIVACY_TITLE = 'What this app keeps, and where';

export const PRIVACY_NOTE: string[] = [
  'Your account (email and password) and everything you do here, your answers, verdicts, cards, debates, essays and any drafts you upload, are stored in the Supabase project of the person who runs this copy of wonderwander and invited you. It sits in a data centre in Mumbai.',
  'That person can technically see the database, including your answers. Other users cannot: every record is locked to the account it belongs to.',
  "Your Gemini key stays on this phone, encrypted. It travels with each check to the app's server function, which passes it straight to Google and never stores or logs it.",
  "To check your work, what you write (and any recording you choose to have written down) is sent to Google's Gemini under your own key, and Google's terms for that key apply. On the free tier, outside the EEA, Switzerland and the UK, Google may use what it receives to improve its products and people at Google may read it, so do not put anything private in an answer.",
  'You can delete everything at any time: Me, then Delete my account. Your records, your uploaded files and the account itself go straight away.',
];
