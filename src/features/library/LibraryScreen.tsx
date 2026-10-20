import { Link } from 'react-router-dom';
import { Doodle } from '../../art/Doodle';
import { DOMAINS, hasPaperModule, TRACKS } from '../../content/load';
import { RoughFrame } from '../../ui/RoughFrame';

// Everything here is readable at any time, even for locked units (BUILD_PLAN 17).
export default function LibraryScreen() {
  return (
    <div>
      <header className="mb-6 flex items-center gap-3">
        <h1 className="text-heading">Library</h1>
        <Doodle name="owl" size={36} />
      </header>
      <p className="mb-6 text-small text-ink-soft">Every lesson and reading is open to you, whatever you have unlocked.</p>
      {TRACKS.map((track) => (
        <section key={track.id} className="mb-7">
          <h2 className="mb-3 text-title">{track.title}</h2>
          <div className="flex flex-col gap-3">
            {DOMAINS.filter((d) => d.track === track.id)
              .sort((a, b) => a.order - b.order)
              .map((d, i) => (
                <Link key={d.id} to={`/library/${d.id}`} className="relative block min-h-12 px-4 py-3.5 text-ink no-underline">
                  <RoughFrame radius={18} fill={`var(--${d.id})`} seed={40 + i} sticker />
                  <span className="relative flex items-baseline justify-between gap-3">
                    <span className="text-body font-bold">{d.title}</span>
                    <span className="shrink-0 text-caption">{d.unitIds.length} units</span>
                  </span>
                </Link>
              ))}
          </div>
        </section>
      ))}
      {hasPaperModule() && (
        <Link to="/paper" className="relative block min-h-12 px-4 py-3.5 text-ink no-underline">
          <RoughFrame radius={18} fill="var(--paper-raised)" seed={88} sticker />
          <span className="relative block text-body font-bold">Paper Module</span>
        </Link>
      )}
    </div>
  );
}
