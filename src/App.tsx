import { Suspense, lazy } from 'react';
import { NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { PackGate } from './features/auth/PackGate';
import { OnboardingGate } from './features/onboarding/Onboarding';
import SignInScreen from './features/auth/SignInScreen';
import { useSession } from './features/auth/useSession';
import { useOnline } from './lib/online';
import { useUpdateBanner } from './lib/pwa';
import { ErrorBoundary } from './ui/ErrorBoundary';
import { NoKeyBanner } from './ui/NoKeyBanner';
import { tabs } from './routes';

const GalleryScreen = lazy(() => import('./features/gallery/GalleryScreen'));
const DomainScreen = lazy(() => import('./features/library/DomainScreen'));
const UnitLibraryScreen = lazy(() => import('./features/library/UnitLibraryScreen'));
const LessonScreen = lazy(() => import('./features/library/LessonScreen'));
const ReaderScreen = lazy(() => import('./features/library/ReaderScreen'));
const PulseScreen = lazy(() => import('./features/today/PulseScreen'));
const PracticeScreen = lazy(() => import('./features/drill/PracticeScreen'));
const DrillScreen = lazy(() => import('./features/drill/DrillScreen'));
const ReviseScreen = lazy(() => import('./features/drill/ReviseScreen'));
const CardsScreen = lazy(() => import('./features/cards/CardsScreen'));
const DoingScreen = lazy(() => import('./features/doing/DoingScreen'));
const BossScreen = lazy(() => import('./features/boss/BossScreen'));
const WritingScreen = lazy(() => import('./features/writing/WritingScreen'));
const PaperScreen = lazy(() => import('./features/paper/PaperScreen'));
const AppealsScreen = lazy(() => import('./features/appeals/AppealsScreen'));
const AboutScreen = lazy(() => import('./features/settings/AboutScreen'));

export function Shell() {
  const online = useOnline();
  const location = useLocation();
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col">
      {!online && (
        <p role="status" className="border-b-2 border-ink/20 bg-lilac/40 px-4 py-2 text-small">
          You're offline. Lessons, readings and the logic pulse still work; answers are saved and checked when you're back.
        </p>
      )}
      <NoKeyBanner />
      <main className="flex-1 px-4 pt-6 pb-24">
        <ErrorBoundary resetKey={location.pathname}>
          <Suspense fallback={<p className="text-ink-soft">Opening...</p>}>
            <Routes>
              {tabs.map((tab) => (
                <Route key={tab.path} path={tab.path} element={tab.element} />
              ))}
              <Route path="/gallery" element={<GalleryScreen />} />
              <Route path="/library/:domainId" element={<DomainScreen />} />
              <Route path="/library/:domainId/:n" element={<UnitLibraryScreen />} />
              <Route path="/lesson/:unitId" element={<LessonScreen />} />
              <Route path="/read/:textId" element={<ReaderScreen />} />
              <Route path="/pulse" element={<PulseScreen />} />
              <Route path="/practice/:unitId" element={<PracticeScreen />} />
              <Route path="/drill/:itemId" element={<DrillScreen />} />
              <Route path="/revise/:itemId" element={<ReviseScreen />} />
              <Route path="/cards" element={<CardsScreen />} />
              <Route path="/doing/:itemId" element={<DoingScreen />} />
              <Route path="/boss/:itemId" element={<BossScreen />} />
              <Route path="/write/:itemId" element={<WritingScreen />} />
              <Route path="/paper" element={<PaperScreen />} />
              <Route path="/me/appeals" element={<AppealsScreen />} />
              <Route path="/me/about" element={<AboutScreen />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </main>
      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-40 mx-auto flex max-w-md border-t-2 border-ink bg-paper-raised pb-[env(safe-area-inset-bottom)]">
        {tabs.map((tab) => (
          <NavLink
            key={tab.path}
            to={tab.path}
            end={tab.path === '/'}
            className={({ isActive }) =>
              `flex min-h-14 flex-1 items-center justify-center text-small ${isActive ? 'font-bold text-ink underline decoration-amber decoration-[3px] underline-offset-6' : 'text-ink-soft'}`
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

export default function App() {
  const { session, loading } = useSession();
  const update = useUpdateBanner();
  if (loading) return null;
  return (
    <>
      {update.ready && (
        <div role="status" className="sticky top-0 z-50 mx-auto flex max-w-md items-center justify-between gap-3 border-b-2 border-ink bg-butter px-4 py-2 text-small font-semibold">
          A fresh version is ready.
          <button type="button" onClick={update.reload} className="min-h-12 px-2 underline decoration-2 underline-offset-4">
            Reload
          </button>
        </div>
      )}
      {session ? (
        <OnboardingGate key={session.user.id} userId={session.user.id}>
          <PackGate>
            <Shell />
          </PackGate>
        </OnboardingGate>
      ) : (
        <SignInScreen />
      )}
    </>
  );
}
