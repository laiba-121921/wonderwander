import { itemsToLines, linesToParagraphs, tidy, type TextItem, type UploadKind } from './text';

// Text extraction from uploads (BUILD_PLAN 16.2). Both libraries load only when a file is chosen.

export async function extractDocx(data: ArrayBuffer): Promise<string> {
  const mammoth = await import('mammoth');
  const { value } = await mammoth.extractRawText({ arrayBuffer: data });
  return tidy(value);
}

export async function extractPdf(data: ArrayBuffer): Promise<string> {
  const pdfjs = await import('pdfjs-dist');
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const task = pdfjs.getDocument({ data: new Uint8Array(data) });
  const doc = await task.promise;
  const pages: string[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const content = await page.getTextContent();
    const items: TextItem[] = content.items.flatMap((it) =>
      'str' in it ? [{ str: it.str, y: it.transform[5] as number, height: it.height || Math.abs(it.transform[3] as number), eol: it.hasEOL }] : [],
    );
    pages.push(linesToParagraphs(itemsToLines(items)));
  }
  await task.destroy();
  return tidy(pages.join('\n\n'));
}

export const extract = (kind: UploadKind, data: ArrayBuffer) => (kind === 'docx' ? extractDocx(data) : extractPdf(data));
