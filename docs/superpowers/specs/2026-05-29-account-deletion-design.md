# Account Deletion (Play Console Compliance) — Design

**Date:** 2026-05-29
**Status:** Approved for planning
**Author:** Bruno + Claude (brainstorming session)

## Why

Play Console rejected versionCode 42 with a Data Safety violation: the form did not declare that the app collects email addresses. Updating the form requires answering "Yes" or "No" to "Do users have a way to request data deletion?" To answer "Yes," Play policy requires **two** mechanisms:

1. A **publicly-accessible web URL** where any user — including users who have uninstalled the app or never signed in — can initiate deletion without first downloading the app.
2. An **in-app deletion option** for users who still have the app installed.

This spec covers both. Once shipped, Bruno pastes the public URL into the Data Safety form and resubmits a new build (versionCode 43) to Play Console.

The deletion flow also satisfies analogous Apple App Store guideline 5.1.1(v) ("Account Sign-In") for the eventual iOS submission, so we build it once and use it on both platforms.

## Scope

### In this plan

- **`apps/web`**: new public route `/delete-account` (and French mirror `/fr/delete-account`) that accepts an email, plus a confirmation route `/delete-account/confirm?token=...` that finalizes the deletion. Done state at `/delete-account/done`.
- **`apps/api`**: new module `apps/api/src/routes/account-deletion.ts` exposing three endpoints — `POST /api/account-deletion/request` (anonymous, email lookup + sends confirmation email), `POST /api/account-deletion/confirm` (anonymous, validates signed token + hard-deletes), `POST /api/account-deletion/self` (authenticated, in-app path, deletes the caller).
- **`apps/mobile`**: new "Delete account" entry at the bottom of the Profile screen, styled in danger color, separated from normal settings. Confirm sheet re-authenticates (password for email users, OAuth re-tap for Google/Apple users) before calling `/self`.
- **Email template**: one new Supabase auth-email template (or a transactional email via existing provider — see Open Questions) sent by the `request` endpoint. Subject "Confirm account deletion — My Language Coach"; body links to `/delete-account/confirm?token=...`.
- **Privacy policy**: add a "Data deletion" section to `apps/web/content/privacy.en.mdx` and `privacy.fr.mdx` linking to `/delete-account` and listing what is deleted vs retained.
- **Play Console**: paste the public URL into the Data Safety form. Bump `versionCode 42→43` and resubmit.

### Explicitly deferred

- **Soft-delete with a 30-day undo window** — considered and dropped. Adds a scheduled job, two table states, and an extra "are you sure?" flow on the auth side. Users who really want to undo will sign up again; the streak loss is the cost. Revisit only if support requests pile up.
- **Anonymized-chat-retention-for-training** — considered and dropped. Hard-delete everything for v1; revisit if we ever start using user transcripts as training data (which would require a separate consent flow anyway).
- **Web-based sign-in flow** — the public page accepts an email and emails a link; it does not log the user in. Adding a real web auth surface is a separate, larger project (the rebuild is mobile-first; the web app today is marketing + auth-verify only).
- **Account export before deletion** — GDPR Article 20 (data portability) would normally pair with deletion, but no user has asked, and Play doesn't require it for the deletion declaration. Defer.
- **Deletion audit log** — we could log "user X requested deletion at T" to a separate table for compliance, but that table itself becomes PII. Skip for v1; rely on Supabase's auth event log.
- **Renaming the Android package** from `com.anonymous.mylanguagecoach` to `com.brunomoise.mylanguagecoach` to match iOS — same blocker noted in the prior universal-links spec, still out of scope.

## Architecture

### Surfaces and flow

**Path A — Public web (user without app or signed out):**

```
1. User visits https://www.mylanguagecoach.app/delete-account
2. Enters email, clicks "Send confirmation link"
3. Web POSTs { email } to POST /api/account-deletion/request
4. API:
   - Always returns 200 (no enumeration leak)
   - If a user with that email exists, signs a JWT { user_id, exp: now+24h }
     with HMAC over ACCOUNT_DELETION_SECRET (new env var) and emails them
     https://www.mylanguagecoach.app/delete-account/confirm?token=<jwt>
5. User clicks the email link → /delete-account/confirm renders a single
   "Confirm permanent deletion" button
6. Confirm button POSTs { token } to POST /api/account-deletion/confirm
7. API verifies the JWT, then runs the deletion routine (see below)
8. Web redirects to /delete-account/done with success message
```

**Path B — In-app (user signed in on mobile):**

```
1. User taps "Delete account" at the bottom of Profile
2. Bottom sheet: "This will permanently delete your account and all your
   practice history. This cannot be undone." → "Continue"
3. Re-auth step:
   - Email users: password prompt → mobile calls supabase.auth.signInWithPassword
     using current email + entered password. If success, proceed.
   - Google/Apple users: button "Re-confirm with Google" / "...with Apple" →
     runs the existing socialSignIn flow → if the returned identity matches
     the current session user, proceed.
4. Final "Delete my account" button → mobile POSTs to /api/account-deletion/self
   with the user's existing session JWT in Authorization: Bearer header
5. API verifies the JWT (existing supabase-verifier.ts), runs the deletion
   routine targeting req.user.id
6. On 200: mobile calls supabase.auth.signOut(), navigates to Welcome,
   shows toast "Your account has been deleted"
```

### Deletion routine (shared by `/confirm` and `/self`)

Given a verified `user_id`, run inside one Supabase transaction where possible (deletions from the Postgres tables are transactional; the Supabase Auth user delete and Storage cleanup are separate calls and run after the DB commit succeeds):

```ts
// 1. App tables — order matters only for explicit FKs; with ON DELETE CASCADE
//    on user_id columns it could be one row in profiles, but we delete
//    explicitly per-table to make the operation auditable in logs.
await db.delete(messages).where(eq(messages.userId, userId));
await db.delete(conversations).where(eq(conversations.userId, userId));
await db.delete(streakDays).where(eq(streakDays.userId, userId));
await db.delete(pushTokens).where(eq(pushTokens.userId, userId));
await db.delete(entitlements).where(eq(entitlements.userId, userId));
await db.delete(usageEvents).where(eq(usageEvents.userId, userId));
await db.delete(vocabItems).where(eq(vocabItems.userId, userId));
await db.delete(topics).where(eq(topics.userId, userId));
// revenueEvents — see Retention below; NOT deleted in v1
await db.delete(profiles).where(eq(profiles.id, userId));

// 2. Storage — greeting audio is keyed by language+name not user, so
//    nothing to remove unless we add per-user assets later. Verify this
//    before merging (see Open Questions).

// 3. Supabase Auth user (last, after DB commit)
await supabaseAdmin.auth.admin.deleteUser(userId);
```

Errors mid-routine: any failure aborts and returns 500. Partial-state recovery is manual for now (admin can re-run with the same user_id; deletes are idempotent because subsequent calls will find zero rows). Acceptable risk for v1; revisit if it ever fires.

### What is deleted vs retained

**Deleted within 24 hours of confirmation:**

- Email, name, profile picture URL
- All chat messages and conversation threads
- Practice session history, streaks, daily-goal records
- Saved vocabulary, custom topics
- Push notification tokens
- Subscription entitlements
- Per-user analytics events stored in our DB

**Retained:**

- `revenue_events` — purchase / refund history. Required for tax reporting and platform-fee reconciliation; retained 7 years per standard financial-records guidance. User_id is kept on these rows because the platform receipt IDs (Apple/Google) tie back to it. This is disclosed on the deletion page and in the privacy policy.
- Anonymized aggregate metrics (e.g. "N sessions today"). No row-level link to the deleted user remains.
- Sentry crash logs — auto-expire after 90 days; not on us to delete proactively.

### Token format and security

JWT signed with HMAC-SHA256 using a new secret `ACCOUNT_DELETION_SECRET` (32+ random bytes; added to Fly + EAS env). Payload: `{ sub: user_id, purpose: "account-deletion", exp: <24h>, iat }`. The `purpose` claim prevents reuse of any other JWT we issue. Verified in `/confirm` with the same secret; tokens are single-use enforced by checking `auth.users` still exists before deleting (a second click on the same link returns 404 since the user is gone).

Rate limit on `/request`: 5 per IP per hour to slow down spammers from enumerating accounts via the "email sent" UX even though the response is uniform.

### Email content

Subject: **"Confirm account deletion — My Language Coach"**
Body: Plain text + minimal HTML. Includes the user's display name if available, the link, a 24-hour expiry note, and "If you didn't request this, ignore this email — your account will not be deleted." From: existing transactional sender (`noreply@mylanguagecoach.app` per Supabase config).

## Components

### Web — `apps/web`

- `app/delete-account/page.tsx` — server component, renders the form. Client component handles submit + API call + success state.
- `app/delete-account/confirm/page.tsx` — server component reads `?token` from searchParams, renders client confirm-button component.
- `app/delete-account/done/page.tsx` — static success page.
- `app/fr/delete-account/page.tsx`, `app/fr/delete-account/confirm/page.tsx`, `app/fr/delete-account/done/page.tsx` — French mirrors. Use existing i18n strings pattern from privacy/terms pages.
- Add nav link from `components/Footer.tsx` ("Delete account") so the page is reachable from the marketing site.
- Add `messages/en.json` + `messages/fr.json` keys: `deleteAccount.*`.

### API — `apps/api`

- `apps/api/src/routes/account-deletion.ts` — new file. Three handlers as above.
- `apps/api/src/lib/account-deletion.ts` — extracted shared deletion routine (called by `/confirm` and `/self`). Keeps the route file thin and unit-testable.
- `apps/api/src/lib/account-deletion-token.ts` — sign/verify JWT helpers; thin wrapper over `jose` or `jsonwebtoken` (use whichever is already in the API). Unit tested.
- `apps/api/src/routes/account-deletion.test.ts` — integration tests: happy path, expired token, missing user, wrong purpose, rate-limit trigger.
- Register the new router in `apps/api/src/app.ts`.

### Mobile — `apps/mobile`

- `apps/mobile/src/features/profile/delete-account-row.tsx` — new component, rendered at the bottom of the Profile screen.
- `apps/mobile/src/features/profile/delete-account-sheet.tsx` — bottom sheet with confirm + re-auth UI.
- `apps/mobile/src/features/profile/use-delete-account.ts` — hook wrapping the `/self` call, signOut, and navigation.
- `apps/mobile/src/features/profile/delete-account-sheet.test.tsx` — unit tests for the re-auth branching (password user vs OAuth user).

### Email

- Either: a new Supabase email template ("Account deletion confirmation") and trigger via the admin API
- Or: send directly via whatever transactional provider already serves the verification email (check `apps/api/src/lib/` for existing send-email helper before adding a new dependency)

To resolve in the plan, not here. See Open Questions.

## Error handling

| Scenario                                   | Behavior                                                                                                                                         |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/request` with unknown email              | 200, no email sent. Don't leak existence.                                                                                                        |
| `/request` rate-limit exceeded             | 429 with retry-after; the web page shows "Too many attempts, try again in an hour"                                                               |
| `/confirm` with expired token              | 410 Gone; web page shows "Link expired" + button to restart at `/delete-account`                                                                 |
| `/confirm` with invalid signature          | 400; web page shows generic "Link invalid"                                                                                                       |
| `/confirm` with already-deleted user       | 404; web page shows "Account already deleted" (treated as success-ish)                                                                           |
| `/self` with stale JWT                     | 401; mobile signs out and routes to Welcome with a generic toast                                                                                 |
| DB transaction failure mid-routine         | 500; user sees error, can retry. Auth user not deleted, so the data may be partially gone. Acceptable per v1 risk note above; surface in Sentry. |
| Supabase Auth delete fails after DB commit | Log to Sentry as a critical alert. Auth row will still exist with no associated profile; admin manually retries. Rare.                           |

## Testing

- **API integration tests** (`account-deletion.test.ts`): every error row in the table above is covered. Hard-delete is verified by querying the tables before and after.
- **API token tests** (`account-deletion-token.test.ts`): sign + verify round-trip, expired token, wrong-purpose token, tampered signature.
- **Mobile component test** (`delete-account-sheet.test.tsx`): password user sees password prompt, OAuth user sees OAuth re-confirm button.
- **Manual E2E**:
  - Web: create a throwaway test user, request deletion, receive email, click link, confirm — verify the user is gone in Supabase Studio.
  - Mobile: same with a throwaway user; verify post-deletion the app routes to Welcome and re-signing-in fails as "user not found."
  - Play Console: paste the URL into the Data Safety form, verify Google's URL-checker doesn't reject it (it crawls the page).

## Rollout

1. Land the API + web changes first; deploy. Test the web flow end-to-end with a throwaway account.
2. Land the mobile changes second; submit a new build (versionCode 43, iOS buildNumber 9).
3. Update the Data Safety form: paste the URL, declare the data types per the chat exchange that preceded this spec, submit for review.
4. Once Play accepts, this is also ready for the eventual iOS Apple submission with no additional work.

No staged rollout — the deletion flow is gated behind a confirmation, and an empty backend response is functionally identical to "do nothing," so the blast radius of a bug is small.

## Open questions to resolve in the plan

1. **Email provider**: does `apps/api` already have a transactional email helper, or do we add one? Supabase's built-in email is rate-limited at 4 per hour per project on the free tier, which is fine for v1 deletion volumes but worth confirming.
2. **Storage cleanup**: are there any per-user files in Supabase Storage today (e.g. avatar uploads)? The Plan 7 follow-up notes "Avatar upload on Profile" was _deferred_, so probably no — but verify before merging the deletion routine.
3. **revenue_events FK**: confirm that `revenue_events.user_id` is nullable or that the FK is `ON DELETE SET NULL` if we want to keep it after the profile row is gone. If it's `ON DELETE CASCADE`, we have to either change the FK or anonymize the column before the profile delete.
