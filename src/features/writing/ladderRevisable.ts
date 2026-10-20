import { findWriting } from '../../content/writing';

// A failed ladder step is revised against its own task and rubric, with the feedback shown above.
export async function ladderRevisable(itemId: string) {
  const w = await findWriting(itemId);
  return {
    prompt: [w.prompt, '', '**Rubric**', ...w.rubric.map((r, i) => `${i + 1}. ${r}`)].join('\n'),
    back: `/write/${encodeURIComponent(itemId)}`,
    sections: [],
    guide: null,
    title: 'The task',
  };
}
