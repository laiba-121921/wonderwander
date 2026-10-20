# Run your own wonderwander

This gets your own copy running on free accounts in about twenty minutes: the app on GitHub Pages, the data and server functions on Supabase, and answer checking on Google's Gemini under each person's own free key. Nothing here costs money.

You need a GitHub account, a Supabase account, Node 24 or newer, and the Supabase CLI (`npm i -g supabase` or see supabase.com/docs/guides/cli).

## 1. Fork and install

1. Fork this repository on GitHub, then clone your fork.
2. `npm ci`

## 2. Make a Supabase project

1. In the Supabase dashboard, create a new project (the free plan is enough). Keep the database password somewhere safe; the CLI asks for it once.
2. Run `npm run setup`. It checks Node and the CLI, asks for two public values from Project Settings, API (the project URL and the publishable key), writes `.env.local`, and lists what is left. It never asks for a secret, and it refuses a secret or service role key if you paste one by mistake.

## 3. Create the database and the functions

1. `supabase login`
2. `supabase link --project-ref <your project ref>` (the 20 letters in your project URL)
3. `supabase db push` creates every table, security policy, storage bucket and the hourly reminder job.
4. `supabase functions deploy` deploys all five functions. `supabase/config.toml` already says which ones need a signed-in caller (`llm`, `delete-account`) and which check their callers themselves (`push`, `invite`, `setup`).

## 4. Settings only you can make, in the Supabase dashboard

1. **Edge Functions, Secrets**: add `OWNER_EMAIL`, the email you will sign in with. This makes you the owner of your copy: the only one who can make invite codes, rename the app and read the owner-only part of a content pack. Optionally add `GEMINI_API_KEY`, your own Gemini key, used for your account only when your phone has none. It is never used for anyone else.
2. **Authentication, Sign In / Providers**: turn off "Allow new users to sign up". People join with your invite codes instead.
3. **Authentication, Users, Add user, Create new user**: your email and a password, with "Auto Confirm User" ticked.
4. Open `https://<your project ref>.supabase.co/functions/v1/setup` once in a browser. Expect `{"owner":"set","push":"set"}`: you are recorded as the owner and the reminder job now calls your own project. It is safe to open again.

The other secrets are optional: `GEMINI_MODEL_LIGHT`, `GEMINI_MODEL_HEAVY`, `LLM_CAP_LIGHT`, `LLM_CAP_HEAVY`: the Gemini model ids for the light and heavy tiers, and each tier's daily call cap.

## 5. Content

The app is the code; the curriculum is a separate content pack that it downloads after sign-in (`docs/CONTENT_PACK.md` describes the format). The original curriculum belongs to its author, Laiba, and is available from the author on request; it is not in any public repository or bucket.

- If you have content files in `content/raw` (from the author, or your own written in the same format), run `npm run content` to parse and check them, then `PACK_AUTHOR="Your Name" npm run pack` to build `.pack/<version>/`. The name goes into the pack's licence and onto the About screen as the curriculum's author.
- `npm run upload-pack` asks for your owner email and password, uploads the pack to your private `content` bucket and points `packs/current.json` at it. Phones pick up a new version within a day.
- Anything under `owner-only/` in a pack can be read by the owner alone.

## 6. Publish the app

1. On GitHub, in your fork: Settings, Secrets and variables, Actions, **Variables** tab. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` with the same two values as in `.env.local`. They are public values, so variables rather than secrets is right.
2. Settings, Pages, Build and deployment, Source: **GitHub Actions**.
3. Push to `main`. The workflow lints, tests, builds and deploys. Your app is at `https://<your GitHub name>.github.io/<repository name>/`.
4. Open it and sign in. The first run asks for your name, your timezone and a Gemini key (free from aistudio.google.com/apikey), then downloads the content.

## 7. Invite people

In the app: Me, Invitations. Make a code, choose how many people may use it, and send it with the link. The code lasts 14 days. The copy holds 25 accounts; the owner can change that in the `app_config` table. Rename your copy in the same section: the name shows on the sign-in screen.

Everyone brings their own Gemini key, kept encrypted on their phone. Each person's checks count against their own key's free allowance, and nobody can see anyone else's work.

## Good to know

- A free Supabase project pauses after about a week without use. Restore it from the dashboard; nothing is lost.
- Daily checking caps reset at midnight in Pakistan time (Asia/Karachi), the time the counter was built around. Each person's locks and reminders follow their own timezone.
- `npm run dev` runs the app on your computer against your project. `npm run test` and `npm run test:e2e` need no project at all.
- After any change to the database, run the checks in `supabase/tests/` in the SQL editor: every line should end in "ok".
