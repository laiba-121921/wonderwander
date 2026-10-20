# Verified external facts

Each entry records what was checked, against which source, and when. Recheck anything older than a few months before relying on it.

## 2026-10-19 (Phase 0)

### Node.js

- Latest LTS: v24.22.0 ("Krypton"), from https://nodejs.org/dist/index.json.
- The owner's machine has Node v21.7.2 installed globally, which is end of life and below the engine ranges of Vite 8 (`^20.19.0 || >=22.12.0`), Vitest 5 (`^22.12.0 || ^24.0.0 || >=26.0.0`) and jsdom 30 (`^22.22.2 || ^24.15.0 || >=26.0.0`).
- The global install was not changed (other sessions depend on it). A portable copy of v24.22.0 lives at `C:\Users\UC\tools\node-v24.22.0-win-x64`, checksum verified against the official `SHASUMS256.txt`. `.nvmrc` pins 24.22.0 for CI.

### Library versions installed

| Package | Version | Note |
| --- | --- | --- |
| react, react-dom | 19.3.1 | |
| react-router-dom | 7.18.4 | used with `HashRouter` |
| vite | 8.3.4 | |
| @vitejs/plugin-react | 6.1.2 | |
| typescript | 6.0.3 | 7.0.2 is out, but typescript-eslint 8.71.2 supports only below 7, so npm resolved 6.0.3 |
| tailwindcss, @tailwindcss/vite | 4.3.3 | Tailwind 4 uses the Vite plugin and CSS `@import`, no `tailwind.config.js` |
| eslint | 10.13.0 | flat config |
| typescript-eslint | 8.71.2 | |
| vitest | 5.0.5 | |
| jsdom | 30.1.3 | |
| @testing-library/react | 16.3.3 | |
| @playwright/test | 1.64.1 | Chromium headless shell 156 |
| tsx | 4.23.15 | runs scripts in `scripts/` |

npm 11 blocks install scripts by default; `esbuild@0.28.2` was approved in `allowScripts` in `package.json`.

### GitHub Actions

- `actions/checkout` latest release v7.0.1, `actions/setup-node` latest release v7.1.0 (GitHub releases API). The workflow uses `@v7` of both.

## 2026-10-19 (Phase 2)

| Package | Version | Note |
| --- | --- | --- |
| @fontsource-variable/shantell-sans | 5.3.0 | `full.css` gives every axis: wght, INFM (informality), BNCE (bounce) |
| @fontsource-variable/literata | 5.3.0 | `index.css`, weight axis |
| @fontsource/noto-sans-math | 5.3.0 | see below |
| roughjs | 4.6.6 | last published 2023, no dependencies, API stable; used only through `generator.toPaths` |

- **Noto Sans Math:** the package ships one file called "latin", and its CSS sets a Latin unicode-range. Checked with fontTools: the file has 3,033 glyphs and contains every curriculum logic symbol (U+00AC, U+2192, U+2194, U+2200, U+2203, U+2227, U+2228, U+22A2, U+25A1, U+25C7). `src/styles/fonts.css` declares its own face, "Logic Symbols", over that file, limited to U+00AC, U+2190 to 21FF, U+2200 to 22FF, U+25A0 to 25FF and U+27E8 to 27E9. Shantell Sans and Literata lack these glyphs (their Latin subsets stop short of the arrows and operators).

## 2026-10-19 (Phase 3)

- **Supabase project:** `wonderwander`, ref `ekspkhpcuqkscbndglpy`, organisation "laiba-121921's Org" on the Free plan, created through the Supabase connector at no cost.
- **Region:** `ap-south-1` (Mumbai), the closest of the offered regions to Pakistan.
- **Free plan pausing** (supabase.com/docs/guides/platform/free-project-pausing): a project is paused after low database activity over 7 days, with a warning email about a week before; it can be restored from the dashboard for up to 90 days with data intact. A few requests a day prevent it, so daily use is enough.
- **Free plan database size** (supabase.com/docs/guides/platform/database-size): read-only mode above 500 MB of database data (1 GB disk). A new project uses about 40 to 60 MB.
- **Keys:** the project offers a legacy anon JWT and a modern publishable key (`sb_publishable_...`). The client uses the publishable key through `VITE_SUPABASE_ANON_KEY`; both are public by design and protected by RLS.
- **@supabase/supabase-js:** installed version recorded in `package-lock.json`.
- **Advisors after the init migration:** security, none; performance, only "unused index" notices (expected on empty tables).

## 2026-10-19 (Phase 4)

- **Readings:** 109 reading references in the appendices. 40 now open a bundled public-domain text (47 extracts from 32 Project Gutenberg ebooks, about 235,000 words, 1.5 MB); 85 have at least one verified free link (SEP, IEP, forall x, Wikisource, Internet Archive, Early Modern Texts, marxists.org, New Advent, CCEL, Fordham, consc.net and others). Every link returned HTTP 200 and its page was matched to the work on 2026-10-19. No reading is citation only.
- **Specs and provenance:** `content/texts/sources/<domain>.json` (ebook numbers, section markers, links) and `content/texts/MANIFEST.json` (source URL, words, dash replacements, sha256 per text). Regenerate with `npm run texts`.
- **Translation substitutions** (the label's translator is not on Gutenberg, so a public-domain alternative is bundled and the named one is linked where free):
  - Descartes, Meditations: Molyneux (1680) bundled; Veitch not on Gutenberg; Early Modern Texts linked.
  - Sextus Empiricus, Outlines: Mary Mills Patrick (1899) bundled; Bury's Loeb (1933) has no legitimate free copy.
  - Aristotle, Politics: Ellis bundled; Jowett not on Gutenberg.
  - Calvin, Institutes: Allen (1813) bundled for RE 6; Beveridge linked on CCEL for RE 2 and RE 6.
- **Edition numbering:** Locke's Essay II.27 in Gutenberg #10615 numbers its sections differently from modern editions; personal identity starts at its section 11. Metaphysics 3 takes the chapter up to that point, Mind 8 from it, so the two meet with no gap.
- **Not available free and legitimate:** Locke IV.19 is absent from Gutenberg #10616 (linked via Early Modern Texts); Hume's "Of the Original Contract" and Gettier's and Goldman's papers have no free copy found; the SEP "Concepts of God" entry survives only in the SEP archive (Fall 2020), which is linked.
- **react-markdown 10.1.0, remark-gfm 4.0.1.**

### Link audit (Phase 4 follow-up, 2026-10-19)

Every work named in a reading was checked. 90 of 109 references now carry at least one verified link; 33 works are recorded as paid only (for example Rawls, Nozick, Kripke, Lewis, Gettier, Goldman, Putnam). Singer's "Famine, Affluence, and Morality" is legitimately hosted at utilitarian.net, but the site failed to connect on two days of checks, so it is marked paid only until it can be verified.

## 2026-10-19 (Phase 5)

| Package | Version | Note |
| --- | --- | --- |
| ts-fsrs | 5.4.2 | `fsrs(generatorParameters({ request_retention: 0.9 }))`, `createEmptyCard`, `next(card, now, rating)`; fuzz off by default |
| date-fns | 4.4.0 | |
| @date-fns/tz | 1.5.0 | used instead of date-fns-tz (last released 2024); @date-fns/tz is the date-fns team's maintained timezone package |

- **Asia/Karachi** is UTC+5 with no daylight saving, so local midnight is 19:00 UTC; tests cover crossings at midnight, month end and year end.

## 2026-10-19 (Phase 6)

- **Model:** `gemini-3.8-flash` is the newest stable Flash model (ai.google.dev/gemini-api/docs/models: "For any new projects, use our latest models: 3.5 Flash-Lite or 3.8 Flash"). It is the heavy-tier default in the `llm` function. 2.0 Flash is shut down; 2.5 Flash is limited to past users.
- **Free tier:** the pricing page lists 3.8 Flash, 3.6 Flash, 3.5 Flash-Lite and 3.1 Flash-Lite as "Free of charge" for input and output. Free-tier content is "Used to improve our products" (Google may use prompts and answers).
- **Free-tier rate limits:** no longer printed in the docs (page updated 2026-10-15): "View your active rate limits in AI Studio." Read by the owner in AI Studio on 2026-10-19: gemini-3.8-flash 20 requests a day; gemini-3.5-flash-lite 500; gemini-3.1-flash-lite 500.
- **Two tiers:** grading, auditing, variants and variant checks run on `gemini-3.5-flash-lite` (stops at 450 a day); boss turns, the judge, author replies and the referee on `gemini-3.8-flash` (stops at 18), falling back to Flash-Lite when that is spent. Usage is logged per tier in `llm_usage` as `<mode>@<tier>`.
- **API:** REST `models.generateContent` (v1beta) is current, with `generationConfig.responseMimeType` and `responseSchema`; blocked prompts report `promptFeedback.blockReason`. Safety thresholds are set to `OFF` for harassment, hate speech, sexually explicit and dangerous content; the docs say the default is already off for Gemini 2.5 and later.
- **Edge function `llm`:** deployed with JWT verification on; unauthenticated calls get 401, signed-in non-owners 403.
- **zod 4.6.7** in the app and the function (deno.json import map).
- **Refused keys:** on 2026-10-19 every model returned `403 PERMISSION_DENIED: Your project has been denied access. Please contact support.` for the owner's first key. Google forum threads (discuss.ai.google.dev, topics 175612 and 174574) describe this as a flag on the Google account or project, not on the request. The function now reports a 401 or 403 as `denied`, so the answer stays saved and is never queued or failed.

## Still to verify (in the phase that needs it)

- Supabase free-tier limits, inactivity pause rule, closest region to Pakistan (Phase 3).
- Deno-compatible Web Push library (Phase 12).

## 2026-10-19 (Phase 9)

| Package | Version | Note |
| --- | --- | --- |
| mammoth | 1.13.0 | `extractRawText` on an ArrayBuffer; the package's browser build is used. npm audit reports 3 moderate issues in `argparse` and `sprintf-js`, which only mammoth's command-line tool uses; the app bundle does not include them |
| pdfjs-dist | 6.4.299 | text from `getTextContent()` page by page; the worker is bundled as its own file (`pdf.worker.min.mjs?url`) |

- Both load only when a file is chosen, so they add nothing to the first page load.
- Supabase Storage: the private `drafts` bucket from Phase 3 (10 MB, PDF and DOCX only, owner folder policy) holds originals at `<user_id>/<submission_id>.<ext>`.

## 2026-10-19 (Phase 10)

| Package | Version | Note |
| --- | --- | --- |
| react-zoom-pan-pinch | 4.2.0 | pinch and double tap zoom on the map; panning is off at scale 1 so the page still scrolls |

## 2026-10-19 (Phases 12 and 13)

| Package | Version | Note |
| --- | --- | --- |
| jsr:@negrel/webpush | 0.5.0 | Web Push (RFC 8291) with VAPID (RFC 8292) on WebCrypto only, for Deno and web-compatible runtimes; used in the `push` edge function. `PushMessageError.isGone()` marks a 410 |
| vite-plugin-pwa | 2.0.0 | peer range includes Vite 8; `injectManifest` with `src/sw/sw.ts` |
| workbox-precaching, workbox-core, workbox-window | 7.4.1 | |

- Supabase free plan offers `pg_cron` 1.6.4 and `pg_net` 0.20.4 (extension list, 2026-10-19). The daily call was run once by hand: HTTP 200, `{"due":12,"threshold":12,"sent":0}` (nothing sent at the threshold, as planned).
- 20:00 in Asia/Karachi is scheduled as `0 15 * * *` (UTC).
- Precache: 111 files, about 5.4 MB (app shell, fonts, content, bundled readings, art). The PDF reader is left out; uploads need the network anyway.
- Headless Chromium reports notification permission as denied and has no push service, so the PWA test stands in for `Notification` and `PushManager.subscribe`; the real subscription is checked with the owner's "Send a test" on the phone.

## 2026-10-19 (Phase 14)

| Package | Version | Note |
| --- | --- | --- |
| @axe-core/playwright | 4.14.0 | WCAG 2.0 and 2.1 A and AA rules on 18 screens plus sign-in |

- Prompt regression run on `gemini-3.5-flash-lite` (light tier, grade and audit): results are kept with the private planning documents. The temporary `llm-eval` function used for it is retired (a 410 stub needing sign-in).
- Precache after leaving out non-Latin font subsets: 105 files, about 5.1 MB. On the deployed site the first install took about 40 seconds over this connection; later visits load from the device.
- Unauthenticated GitHub API reads are limited to 60 an hour per IP; CI status checks should be spaced out.

## 2026-10-20 (Phase 16)

- Gemini audio input (ai.google.dev/gemini-api/docs/audio, updated 2026-09-23): WAV, MP3, AIFF, AAC, OGG, FLAC, MPEG, M4A, L16, Opus, ALAW, MULAW and WebM; 20 MB per request in all (inline), Files API above that; up to 9.5 hours; 32 tokens per second of audio.
- Checked on the owner's free key with `gemini-3.5-flash-lite`: a 12 second WAV inline in 2.5 s, word for word; a 10 minute natural reading (19.7 MB WAV) through the Files API in 13 s, 1,499 of 1,505 words (97.6 percent word overlap). A synthetic recording of one paragraph repeated 41 times made the model loop (160 repeats), which is why the repetition guard exists.
- Supabase Edge Functions on the free plan (supabase.com/docs/guides/functions/limits): 150 s wall clock, 256 MB memory, 2 s CPU per request.

## 2026-10-20 (Phase 17)

- supabase-js Storage `download` is a GET to `/storage/v1/object/<bucket>/<path>` with the session's token, so the bucket's RLS policies apply to every pack file.
- Pack `20261020-5eab127c`: 110 files, 3.1 MB. The production bundle went from 67 precached entries (3.7 MB) to 59 (2.0 MB).
- `supabase/tests/content_access.sql`: all six checks ok (a second user sees 56 unit files and no owner-only file and cannot write; the owner sees owner-only; signed out sees nothing).

## 2026-10-20 (Phase 18)

- Gemini API terms (ai.google.dev/gemini-api/terms, updated 2026-04-28): on unpaid services Google uses prompts and responses to provide, improve and develop its products, and human reviewers may read them; in the EEA, Switzerland and the UK the paid-service data terms apply to all services. The privacy note says this.
- Supabase blocks direct SQL deletes on `storage.objects` ("Use the Storage API instead"), so `delete-account` removes drafts through the Storage API before deleting the user.
- Supabase admin `createUser` works while public sign-ups are disabled.
- `supabase/tests/hosted_access.sql`: 17 of 17 ok. `supabase/tests/rls_isolation.sql`: 6 of 6 ok.

## 2026-10-20 (Phase 21)

- GitHub: a private repository answers 404 to unauthenticated API reads, so its existence is not visible to the public.
- Supabase Storage refuses direct SQL deletes on storage.objects; files are removed through the Storage API.
