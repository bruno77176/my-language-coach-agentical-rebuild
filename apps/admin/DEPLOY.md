# Admin Dashboard — Deployment Runbook

This document lists the manual ops steps needed to deploy `apps/admin` to Vercel and bring the cost dashboard online in production. Code changes are all in `feat/cost-dashboard` (this branch); the steps below are dashboard-clicking + CLI commands you run yourself.

## Prereqs

- Branch `feat/cost-dashboard` is merged or at least pushed to GitHub.
- The Fly API at `https://my-language-coach-agentical-rebuild.fly.dev` has the new schema migrations applied (Tasks 1 + 2 already ran against the prod Supabase DB during development).
- You have your Supabase user ID handy. To find it: in the Supabase dashboard → Authentication → Users → click your row → copy the UUID.

## Step 1 — Set API env vars on Fly

The API needs three new env vars in production:

```
flyctl secrets set \
  ADMIN_USER_IDS=<your-supabase-user-id-uuid> \
  ADMIN_ALLOWED_ORIGINS=https://<your-vercel-domain>.vercel.app \
  INTERNAL_CRON_SECRET=<the-cron-secret-from-apps/api/.env-locally> \
  --app my-language-coach-agentical-rebuild
```

`INTERNAL_CRON_SECRET` was generated locally by Task 10. The value is in your local `apps/api/.env`. **Don't paste it into chat or commit it.**

You'll only know `<your-vercel-domain>` AFTER Step 3 (Vercel deploys give it to you). It's fine to set this with a placeholder now and re-run the command after Step 3 with the real domain. Or do Step 3 first and come back.

After `flyctl secrets set`, deploy: `flyctl deploy --app my-language-coach-agentical-rebuild`.

## Step 2 — Configure Supabase Auth redirect URLs

1. Open Supabase Dashboard → Authentication → URL Configuration.
2. Under "Redirect URLs", add: `https://<your-vercel-domain>.vercel.app/auth/callback`.
3. Also add `http://localhost:3001/auth/callback` if not already there (for local dev).
4. Save.

Without this, the magic-link sign-in flow on the admin app will fail with a `redirect_to is not allowed` error.

## Step 3 — Create Vercel project for `apps/admin`

From inside `apps/admin/`:

```
npx vercel link
```

Choose:

- Existing scope: your Vercel personal account.
- New project: `my-language-coach-admin` (or similar).
- Root directory: just press Enter (the link sets it to `.` since you're already inside `apps/admin/`).
- Override settings: No.

Then deploy a preview:

```
npx vercel
```

It'll print a preview URL. Open it — you should see the login page (or a Server Error if env vars aren't set yet; that's expected — Step 4).

## Step 4 — Set Vercel env vars

```
npx vercel env add NEXT_PUBLIC_SUPABASE_URL production
npx vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
npx vercel env add ADMIN_USER_IDS production
npx vercel env add API_BASE_URL production
```

Values to enter when prompted:

- `NEXT_PUBLIC_SUPABASE_URL` → `https://nzrrqykcloanoaqwbexv.supabase.co` (from `apps/api/.env`)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` → `sb_publishable_02kfSiKQsU_hhoCQ4imRig_vTVsWY0m` (from `apps/api/.env`)
- `ADMIN_USER_IDS` → your Supabase user ID UUID
- `API_BASE_URL` → `https://my-language-coach-agentical-rebuild.fly.dev`

Repeat for `preview` and `development` envs if you want them populated for branch previews and `vercel dev`.

## Step 5 — Deploy to production

```
npx vercel --prod
```

This gives you your production URL like `https://my-language-coach-admin.vercel.app`.

**Now go back to Step 1** and update `ADMIN_ALLOWED_ORIGINS` on Fly with this actual URL. Then `flyctl deploy` again.

## Step 6 — Configure Supabase pg_cron (one-time)

Open the Supabase SQL editor and paste the contents of `apps/api/src/db/cron-setup.sql`. **Before running**, replace the `paste-INTERNAL_CRON_SECRET-here` placeholder with your actual `INTERNAL_CRON_SECRET` value (from your local `.env`).

This sets up the 5-minute cron job that refreshes the `daily_cost_by_user` materialized view.

Verify in Supabase: Database → Cron → see `refresh-cost-views` listed and active.

## Step 7 — Smoke test

1. Open your Vercel admin URL.
2. Expect a redirect to `/login`.
3. Enter your email (the one whose UUID is in `ADMIN_USER_IDS`).
4. Click "Send magic link".
5. Open the email, click the link. You should land on `/` (Dashboard).
6. Dashboard loads. With near-zero usage events from real production users, expect mostly-empty charts but no errors. If you see "Application error: a server-side exception" — check Vercel function logs.
7. Visit `/settings`. Add a `fixed_cost` row: service=`fly`, amount=`5`, period=`monthly`, startedOn=today's date. Click "Add". The page should reload and show the new row. The Infrastructure KPI on `/` should now show the pro-rated Fly cost.
8. Trigger one voice turn in the mobile app (or wait for natural usage). Wait 5 minutes (cron tick) OR hit the refresh-views endpoint manually:
   ```
   curl -X POST -H "X-Cron-Secret: <your-cron-secret>" \
     https://my-language-coach-agentical-rebuild.fly.dev/admin/internal/refresh-views
   ```
9. Reload `/`. Total cost ticks up; OpenAI + Deepgram appear in the service breakdown.

## Step 8 — Verify allowlist actually works

If you have a second Supabase account (or a friend with one), try signing in with that. They should be redirected to `/login?error=not-admin` on the Vercel side AND any direct API call would 403.

If you don't have a second account, you can test by temporarily setting `ADMIN_USER_IDS` to a different UUID on the API, redeploying, and confirming your own user gets 403. Then revert.

## Failure-mode quick reference

| Symptom                                            | Likely fix                                                                                                                                         |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/login` shows "redirect_to is not allowed"        | Add the Vercel callback URL to Supabase Auth (Step 2).                                                                                             |
| Dashboard shows "Application error" with no detail | Open Vercel function logs — usually a missing env var.                                                                                             |
| Dashboard loads but API calls return 403           | Either `ADMIN_USER_IDS` on Fly doesn't include your UUID, or `ADMIN_ALLOWED_ORIGINS` is missing/wrong.                                             |
| Cron not running                                   | Check Supabase Database → Cron. If `refresh-cost-views` isn't listed, re-run Step 6.                                                               |
| Cron runs but `usage_events` stays empty           | Mobile/API instrumentation isn't firing. Check Sentry for `[cost-recording] no rate card for ...` warnings — means an op needs a rate card seeded. |
