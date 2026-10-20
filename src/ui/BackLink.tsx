import { Link } from 'react-router-dom';

export function BackLink({ to, label }: { to: string; label: string }) {
  return (
    <Link to={to} className="inline-flex min-h-12 items-center text-small font-semibold text-ink no-underline">
      <span aria-hidden="true" className="mr-1.5">
        {'<'}
      </span>
      {label}
    </Link>
  );
}
