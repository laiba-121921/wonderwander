# Architecture

A short technical overview. Everything runs on free tiers.

```
 Android Chrome (installed PWA)
 ┌──────────────────────────────────────────────────────────┐
 │ React app (Vite, TypeScript), served by GitHub Pages     │
 │  ├ app shell precached by the service worker             │
 │  ├ content pack downloaded once, kept in IndexedDB       │
 │  ├ deterministic engines on the device: tap drills,      │
 │  │   logic generators, FSRS, gating, mastery, lockouts   │
 │  ├ DOCX and PDF text extraction, speech to text input    │
 │  └ Gemini key, encrypted on the phone                    │
 └───────────────┬───────────────────────────┬──────────────┘
                 │ HTTPS (session token)     │ Web Push
 ┌───────────────▼───────────────────────────┴──────────────┐
 │ Supabase                                                 │
 │  ├ Postgres, row level security on every table           │
 │  ├ Auth: email and password; accounts by invite code     │
 │  ├ Storage: private "content" (packs), "drafts" (uploads)│
 │  ├ Functions: llm, push, invite, delete-account, setup   │
 │  └ pg_cron: hourly reminder job                          │
 └───────────────┬──────────────────────────────────────────┘
                 │ each person's own key
          Gemini API (free tier)
```

## Principles

- **Deterministic work runs on the phone.** The server stores state and runs the Gemini prompts; it does not compute grades any other way.
- **Content and code are separate.** The app carries no curriculum. After sign-in it reads `packs/current.json` from Storage, downloads and validates the pack (zod schemas in `src/content/packSchema.ts`), and keeps it in IndexedDB under its version. It checks for a new version once a day and works offline after the first download. Files under a pack's `owner-only/` are readable by the instance owner alone. Development and tests read `content/` directly instead; the choice is fixed at build time, so production bundles contain no content loader.
- **Content and user data meet only through stable ids**, such as `logic-1:drill:L1-01`.
- **One owner per instance**, named by the `OWNER_EMAIL` secret and recorded by the `setup` function. Everyone else joins with an invite code and brings their own Gemini key.

## Data model

Every table belongs to one user (`user_id`, defaulting to `auth.uid()`, cascading from `auth.users`) and is protected by the same policy: a user reads and writes only their own rows.

| Table | Holds |
| --- | --- |
| `profile` | name, timezone, weekend day, reminder settings, onboarding done |
| `item_state` | each item's status: available, passed, locked (until local midnight), revision required |
| `attempt` | every graded answer with the grader and auditor output |
| `card_state`, `card_review` | spaced repetition (FSRS) per card |
| `boss_session` | boss debates, saved after every turn |
| `writing_submission` | essays and drafts, with uploaded files in Storage |
| `review_queue` | appeals |
| `variant`, `key_override` | generated item variants; amendments to keys after an appeal |
| `session_log`, `llm_usage`, `llm_rate` | sessions, daily model use, the hourly call limit |
| `push_subscription` | Web Push endpoints |
| `owner`, `app_config`, `invite` | the instance: its owner, name and cap, and invite codes (owner only) |

## The llm function

One edge function serves every prompt mode: grade, audit, variant, variant check, author reply, boss turn, judge, referee, and transcribe. It:

- fills the verbatim prompt with the item and the answer, adding only a marked transport suffix;
- uses the Gemini key sent with the request (`x-gemini-key`), or, for the owner only, the server's secret;
- routes high-volume modes to a light model and the few demanding ones to a heavier model, within each day's cap;
- validates JSON replies against schemas and retries once; removes dashes from every reply;
- limits each person to 60 calls an hour.

## Grading and the item lifecycle

Items are drills, comprehension questions, reconstructions, objections, replies, bosses and writing. A typed answer goes to the grader, then to an independent auditor; a decision table (`src/domain/escalation.ts`) settles the result:

- agreement passes or fails the item;
- an uncertain or disputed result gets one soft retry, or a tie-break run at a different temperature (majority, abstain counting as fail);
- a fail locks that item alone until the person's local midnight and opens a revision task;
- results marked appealable can be appealed from the result screen.

Bosses are judged on a rubric with a second judge for ties; writing is refereed against a checklist, twice, with the results reconciled.
