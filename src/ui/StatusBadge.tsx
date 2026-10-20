export type Status = 'passed' | 'failed' | 'queued' | 'locked' | 'current' | 'available';

const LABEL: Record<Status, string> = {
  passed: 'Passed',
  failed: 'Back tomorrow',
  queued: 'Waiting',
  locked: 'Locked',
  current: 'You are here',
  available: 'Ready',
};

// BUILD_PLAN 19.2: status colours are consistent everywhere and text on fills is always ink.
const STYLE: Record<Status, string> = {
  passed: 'bg-mint border-mint',
  failed: 'bg-coral-tint border-coral',
  queued: 'bg-lilac border-lilac',
  locked: 'border-ink/35 text-ink/70 [background-image:repeating-linear-gradient(135deg,rgb(47_37_70/0.12)_0_2px,transparent_2px_7px)]',
  current: 'bg-paper-raised border-amber',
  available: 'bg-paper-raised border-ink/40',
};

export function StatusBadge({ status, label }: { status: Status; label?: string }) {
  return (
    <span className={`inline-flex items-center rounded-full border-2 px-2.5 py-0.5 text-caption font-semibold text-ink ${STYLE[status]}`}>
      {label ?? LABEL[status]}
    </span>
  );
}
