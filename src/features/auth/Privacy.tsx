import { PRIVACY_NOTE, PRIVACY_TITLE } from './privacyText';

export function PrivacyNote({ heading = 'h2' }: { heading?: 'h2' | 'h3' }) {
  const H = heading;
  return (
    <div className="rounded-card border-2 border-ink/20 bg-paper-raised p-4">
      <H className="mb-2 text-title">{PRIVACY_TITLE}</H>
      {PRIVACY_NOTE.map((p) => (
        <p key={p.slice(0, 24)} className="mb-2 text-small last:mb-0">
          {p}
        </p>
      ))}
    </div>
  );
}
