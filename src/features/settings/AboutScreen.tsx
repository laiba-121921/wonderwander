import { loadManifest, loadPackInfo, useLoad } from '../../content/load';
import { BackLink } from '../../ui/BackLink';
import { PrivacyNote } from '../auth/Privacy';

// PHASE_15_PLUS 6: who made what, under which licence, and which versions are in use. The curriculum's author and
// licence come from the content pack, so a self-hosted copy with its own pack shows its own notice.
export const APP_AUTHOR = 'Laiba';
export const REPOSITORY = 'https://github.com/laiba-121921/wonderwander';
const CC_BY_NC_SA = 'https://creativecommons.org/licenses/by-nc-sa/4.0/';

export function attribution(curriculumAuthor: string, year: string): string {
  return `Curriculum written by ${curriculumAuthor}, ${year}. App designed and built by ${APP_AUTHOR}.`;
}

export default function AboutScreen() {
  const { data } = useLoad(() => Promise.all([loadPackInfo(), loadManifest()]), []);
  const pack = data?.[0] ?? null;
  const readings = data?.[1].length ?? 0;
  const year = pack?.version.slice(0, 4) || '2026';

  return (
    <div>
      <BackLink to="/me" label="Me" />
      <h1 className="mt-1 mb-5 text-heading">About</h1>

      <section className="mb-8">
        <p className="text-body">{attribution(pack?.author ?? 'the curriculum author', year)}</p>
      </section>

      <section className="mb-8">
        <h2 className="mb-2 text-title">Licences</h2>
        <dl className="flex flex-col gap-3 text-small">
          <div>
            <dt className="font-semibold">The app</dt>
            <dd>
              MIT licence, copyright {APP_AUTHOR}. The code is public:{' '}
              <a href={REPOSITORY} target="_blank" rel="noreferrer" className="inline-flex min-h-12 items-center">
                github.com/laiba-121921/wonderwander
              </a>
            </dd>
          </div>
          <div>
            <dt className="font-semibold">The curriculum</dt>
            <dd>
              {pack ? (
                <>
                  {pack.licence === 'CC BY-NC-SA 4.0' ? 'Creative Commons Attribution-NonCommercial-ShareAlike 4.0' : pack.licence}, copyright {pack.author}.{' '}
                  {pack.licence === 'CC BY-NC-SA 4.0' && (
                    <a href={CC_BY_NC_SA} target="_blank" rel="noreferrer" className="inline-flex min-h-12 items-center">
                      Read the licence
                    </a>
                  )}
                </>
              ) : (
                'Read from the content files on this computer (development).'
              )}
            </dd>
          </div>
          <div>
            <dt className="font-semibold">The readings</dt>
            <dd>{readings ? `${readings} public-domain texts from Project Gutenberg, each with its source in the reader.` : 'Public-domain texts from Project Gutenberg.'}</dd>
          </div>
        </dl>
      </section>

      <section className="mb-8">
        <h2 className="mb-2 text-title">Versions</h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-small">
          <dt className="font-semibold">App</dt>
          <dd className="font-mono">{__APP_VERSION__}</dd>
          <dt className="font-semibold">Content</dt>
          <dd className="font-mono">{pack?.version ?? 'local'}</dd>
        </dl>
      </section>

      <PrivacyNote />
    </div>
  );
}
