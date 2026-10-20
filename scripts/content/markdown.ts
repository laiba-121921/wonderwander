export interface Section {
  heading: string;
  body: string;
  line: number;
}

// Splits Markdown at headings of exactly `level` hashes, ignoring fenced code.
export function splitSections(md: string, level: number): { preamble: string; sections: Section[] } {
  const lines = md.split('\n');
  const headingRe = new RegExp(`^#{1,${level}} `);
  const exactRe = new RegExp(`^#{${level}} (.*)$`);
  const sections: Section[] = [];
  const preamble: string[] = [];
  let current: { heading: string; lines: string[]; line: number } | null = null;
  let inFence = false;

  lines.forEach((line, i) => {
    if (/^```/.test(line)) inFence = !inFence;
    const exact = !inFence && line.match(exactRe);
    if (exact) {
      if (current) sections.push(finish(current));
      current = { heading: exact[1]!.trim(), lines: [], line: i + 1 };
      return;
    }
    if (!inFence && headingRe.test(line) && current) {
      // a higher-level heading closes the current section
      sections.push(finish(current));
      current = null;
      preamble.push(line);
      return;
    }
    (current ? current.lines : preamble).push(line);
  });
  if (current) sections.push(finish(current));
  return { preamble: preamble.join('\n').trim(), sections };
}

function finish(s: { heading: string; lines: string[]; line: number }): Section {
  return { heading: s.heading, body: s.lines.join('\n').trim(), line: s.line };
}

export function paragraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

// Items of a numbered Markdown list ("1. text"), joined across wrapped lines.
export function numberedList(text: string): string[] {
  const items: string[] = [];
  let gap = false; // a paragraph after a blank line is commentary, not part of the last item
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*\d+\.\s+(.*)$/);
    if (m) {
      items.push(m[1]!.trim());
      gap = false;
    } else if (!line.trim()) gap = true;
    else if (items.length > 0 && !gap && !/^\s*[-*]\s/.test(line)) items[items.length - 1] += ' ' + line.trim();
  }
  return items;
}

export function fencedBlocks(text: string): string[] {
  const blocks: string[] = [];
  const re = /```[a-z]*\n([\s\S]*?)\n```/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) blocks.push(m[1]!);
  return blocks;
}

export interface TableRow {
  cells: string[];
}

export function tableRows(text: string): TableRow[] {
  return text
    .split('\n')
    .filter((l) => /^\s*\|/.test(l) && !/^\s*\|\s*-{3,}/.test(l))
    .map((l) =>
      l
        .trim()
        .replace(/^\|/, '')
        .replace(/\|$/, '')
        .split(/(?<!\\)\|/)
        .map((c) => c.trim()),
    )
    .map((cells) => ({ cells }));
}
