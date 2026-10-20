import { FALLACIES } from './banks';

// The fallacy finder's answer key is Logic 7's own wording: under each fallacy's heading in the lesson, the first
// sentence of the paragraph that follows. It is read from the content pack when the content loads, so no curriculum
// text lives in the code. Without it (a pack with no Logic 7), the fallacy finder is simply not offered.

export interface LessonSection {
  markdown?: string;
}

function firstSentence(paragraph: string): string {
  const end = paragraph.search(/\.(\s|$)/);
  return end < 0 ? paragraph.trim() : paragraph.slice(0, end + 1).trim();
}

// Each bank name to the first sentence under the lesson heading that begins with it (case aside).
export function extractDiagnoses(sections: LessonSection[]): Record<string, string> {
  const lines = sections.map((s) => s.markdown ?? '').join('\n').split('\n');
  const out: Record<string, string> = {};
  for (let i = 0; i < lines.length; i++) {
    const heading = lines[i]!.match(/^###\s+(.+)$/)?.[1]?.toLowerCase();
    if (!heading) continue;
    const name = FALLACIES.find((f) => heading.startsWith(f.name.toLowerCase()))?.name;
    if (!name || out[name]) continue;
    let j = i + 1;
    while (j < lines.length && !lines[j]!.trim()) j++;
    if (j < lines.length && !lines[j]!.startsWith('#')) out[name] = firstSentence(lines[j]!);
  }
  return out;
}

let diagnoses: Record<string, string> = {};

export function setFallacyDiagnoses(next: Record<string, string>): void {
  diagnoses = next;
}

// The fallacies the finder can ask about: those whose diagnosis the content supplied.
export function availableFallacies(): { name: string; diagnosis: string; examples: string[] }[] {
  return FALLACIES.filter((f) => diagnoses[f.name]).map((f) => ({ ...f, diagnosis: diagnoses[f.name]! }));
}

// Four choices are needed for an item.
export const fallacyFinderReady = () => availableFallacies().length >= 4;
