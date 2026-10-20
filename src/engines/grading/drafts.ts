import { readPref, writePref } from '../../lib/prefs';

// Dictated work must survive an app kill or a dropped connection (BUILD_PLAN 9.4): keep it until the attempt is written.
export interface Draft {
  text: string;
  savedAt: string;
}

export const loadDraft = (itemId: string): Draft | null => readPref<Draft | null>(`draft.${itemId}`, null);
export const saveDraft = (itemId: string, text: string) => writePref(`draft.${itemId}`, { text, savedAt: new Date().toISOString() });
export const clearDraft = (itemId: string) => writePref(`draft.${itemId}`, null);
