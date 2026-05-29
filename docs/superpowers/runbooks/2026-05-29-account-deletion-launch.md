# Account Deletion Launch Runbook

**Date:** 2026-05-29
**Status:** In progress
**Related:**

- Spec: [`docs/superpowers/specs/2026-05-29-account-deletion-design.md`](../specs/2026-05-29-account-deletion-design.md)
- Plan: [`docs/superpowers/plans/2026-05-29-account-deletion.md`](../plans/2026-05-29-account-deletion.md)
- PR: [#19](https://github.com/bruno77176/my-language-coach-agentical-rebuild/pull/19) (merged 2026-05-29)

The code is on `main`. This runbook is the launch sequence — Resend setup, Fly secrets, mobile builds, device testing, and the Play Console resubmit that unblocks versionCode 43.

---

## 1. Resend setup

- [x] Sign up at [resend.com](https://resend.com) with `bruno.a.moise@gmail.com`.
- [x] Add domain `mylanguagecoach.app`. DNS records (SPF, DKIM, optional DMARC) added in **Porkbun** (DNS-powered by Cloudflare).
- [x] Wait for verification — Resend shows the domain as **Verified**.
- [x] **API Keys → Create API key** → name `api-prod`, scope `Sending access` (not Full access — backend only sends, doesn't manage). Use a **dedicated** key, not the `supabase-smtp` one Supabase uses for auth emails: independent blast radius means rotating one doesn't break the other.

**Why no Vercel DNS step:** Vercel only manages routing for the web app's domain attachment. Email DNS lives in Porkbun (the registrar), proxied through Cloudflare. The four Resend records are already there: A, CNAME, MX (two), TXT (three for DKIM + SPF + DMARC).

**Rotation reminder:** if the `re_…` key ever lands in plaintext anywhere (chat, log, screenshot), rotate it in Resend and re-set the Fly secret. Sending-access keys can only send emails so the worst-case is impersonation spam, but rotation is cheap.

---

## 2. Set the Fly secrets

From `apps/api/` (so fly picks up the local fly.toml — or pass `-a my-language-coach-agentical-rebuild` from anywhere).

**Do not** try to inline `$(node -e ...)` substitution. It tends to silently capture an empty string when the full one-liner is long, and zod will reject `ACCOUNT_DELETION_SECRET` for being too short — the app then crash-loops until Fly hits its max-restart limit. Generate the secret separately, paste it.

```bash
# 1. Generate the secret. Copy the 64-character hex output.
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 2. Set all three secrets (one fly secrets set triggers ONE redeploy).
cd "C:/Users/bruno.moise/My Language Coach - rebuild/app/apps/api"
fly secrets set \
  ACCOUNT_DELETION_SECRET=<paste-64-char-hex-here> \
  RESEND_API_KEY=re_paste_yours_here \
  PUBLIC_WEB_BASE_URL=https://www.mylanguagecoach.app
```

**Watch out:** Resend keys (`re_…`) and the `PUBLIC_WEB_BASE_URL` must include their full value. If your terminal wraps the line and chops a character, the app boots but emails will fail (Resend rejects the key) or links will point at a wrong domain. Verify with `fly secrets list` (values are masked but the timestamps show what got updated when).

Fly auto-redeploys. Watch:

```bash
fly logs --app my-language-coach-agentical-rebuild --no-tail
```

Use `--no-tail` — without it, `fly logs` only follows new lines and a crash-looping app may look quiet between attempts. The boot error appears every restart cycle until secrets are right.

---

## 3. Backend smoke test (~2 min)

```bash
# Should return {"status":"ok","dbOk":true,...}
curl -s https://my-language-coach-agentical-rebuild.fly.dev/health

# Should return {"ok":true} regardless of whether the email exists:
curl -s -X POST https://my-language-coach-agentical-rebuild.fly.dev/account-deletion/request \
  -H 'content-type: application/json' \
  -d '{"email":"nobody@example.com"}'

# Should return {"error":{"code":"INVALID_INPUT"}} with HTTP 400:
curl -s -X POST https://my-language-coach-agentical-rebuild.fly.dev/account-deletion/request \
  -H 'content-type: application/json' \
  -d '{"email":"not-an-email"}'

# Should return {"error":{"code":"INVALID_TOKEN"}} with HTTP 400:
curl -s -X POST https://my-language-coach-agentical-rebuild.fly.dev/account-deletion/confirm \
  -H 'content-type: application/json' \
  -d '{"token":"not.a.real.token"}'
```

If `/health` returns 503 → the app is crash-looping. Always check `fly logs --no-tail` for the boot error.
If the second call returns 200 → the zod email validator isn't firing; check `apps/api/src/routes/account-deletion.ts`.

---

## 4. Web smoke test (~5 min)

Vercel auto-deployed on PR merge. Open in a private window:

- [ ] https://www.mylanguagecoach.app/delete-account — page renders, form visible, "What gets deleted" / "What we keep" sections present.
- [ ] https://www.mylanguagecoach.app/fr/delete-account — French copy renders.
- [ ] https://www.mylanguagecoach.app/privacy — confirm the new "Data deletion" section is at the bottom.
- [ ] Footer on any page — "Delete account" link is between Terms and Contact.

**Do not submit the form yet** — wait until you have throwaway accounts (step 6).

---

## 5. Build + distribute the mobile apps

From `apps/mobile/` in the main repo. versionCode is already 43, iOS buildNumber is already 9.

### Android (Bruno's own device)

```bash
eas build --profile production --platform android
eas submit --platform android --latest
```

- Play Console → **Internal testing → Releases → Edit release** → roll the new AAB out to the internal track.
- On Android: open the Play Store **internal testers** opt-in link, accept, install the update.
- Open the app → confirm Profile → "Delete account" row appears at the bottom (red text, underlined).

### iOS (friend's iPad via TestFlight)

```bash
eas build --profile production --platform ios
eas submit --platform ios --latest
```

- App Store Connect → TestFlight → wait for processing (~10–30 min).
- Add friend's Apple ID as internal tester (or reuse an existing TestFlight group).
- Friend installs/updates via TestFlight on their iPad.
- Confirm the same Profile row + sheet appears.

---

## 6. Create throwaway test accounts

You need three so you can exercise each path without nuking your own:

| Account                      | Sign-in method            | Tests                                      |
| ---------------------------- | ------------------------- | ------------------------------------------ |
| `bruno+del-email@gmail.com`  | Email + OTP, set password | In-app email-identity path (password gate) |
| `bruno+del-google@gmail.com` | Google sign-in            | In-app OAuth path (no password)            |
| `bruno+del-web@gmail.com`    | Email + OTP               | Public web URL path                        |

For each: sign up in the mobile app, complete onboarding (so the `profiles` row exists), and run one short practice session (so there's chat/streak data to confirm gets deleted).

---

## 7. In-app deletion — Android (email user)

1. Sign in as `bruno+del-email@gmail.com`.
2. Profile → tap **Delete account** at the bottom.
3. Sheet opens. Confirm body says "This will permanently delete…".
4. Enter the **wrong** password → toast: "Password is incorrect." Confirm no deletion.
5. Enter the **correct** password → tap **Delete my account** → toast "Your account has been deleted." App routes to Welcome.
6. Try signing back in with the same email — should fail with "Invalid login".
7. In **Supabase Studio**:
   - Auth → Users: the user is gone.
   - Tables `profiles`, `messages`, `conversations`, `streak_days`, `vocab_items`, `entitlements`, `push_tokens`, `topics`: no rows for that user_id.
   - Tables `revenue_events`, `usage_events`: any rows for that user_id now have `user_id = NULL` (anonymized, not deleted — this matches the privacy disclosure).

---

## 8. In-app deletion — iOS (OAuth user)

Same device or friend's iPad with TestFlight build.

1. Sign in as `bruno+del-google@gmail.com` (Google).
2. Profile → **Delete account**.
3. Sheet shows the OAuth body ("You'll be signed out and your account removed…") with **no password field**.
4. Tap **Delete my account** → same outcome as step 7.

---

## 9. Public web flow

1. Any browser → https://www.mylanguagecoach.app/delete-account.
2. Enter `bruno+del-web@gmail.com` → click **Send confirmation link** → "If an account with that email exists…" message appears.
3. Check inbox. Subject: **"Confirm account deletion — My Language Coach"**, from `noreply@mylanguagecoach.app`.
4. Click the link → lands on `/delete-account/confirm` → tap **Delete my account** → redirects to `/delete-account/done`.
5. Confirm in Supabase Studio that the user is gone.

### Negative cases

- [ ] Visit `/delete-account/confirm` with no token → shows "invalid link" message.
- [ ] Click the same email link twice → second click should error (token still valid for 24h but user is gone; current behavior is a generic failure toast — acceptable for v1).
- [ ] Request a link for an email that doesn't exist → still shows "If an account…" (no enumeration leak).

---

## 10. Play Console resubmit

Only after steps 7–9 pass.

1. Play Console → **App content → Data safety → Manage**.
2. Answer:
   - Q1 (Does your app collect or share data?) → **Yes**.
   - Q2 (Encrypted in transit?) → **Yes**.
   - Q3 (Account creation methods) → check **Username + password** AND **OAuth**.
3. Account deletion URL → `https://www.mylanguagecoach.app/delete-account`.
4. Data types to declare:
   - **Personal info → Email address** — Collected, not shared, Account management, Required.
   - **Personal info → Name** — Collected, not shared, Account management, Required.
   - **Personal info → User IDs** — Collected, not shared, App functionality, Required.
   - **Audio → Voice or sound recordings** — Collected, not shared, App functionality, Processed ephemerally = **Yes**.
   - **App activity → In-app actions** — Collected, not shared, App functionality + Analytics.
   - **App info and performance → Crash logs** — Collected, **shared with Sentry**, App functionality + Analytics.
   - **App info and performance → Diagnostics** — Collected, **shared with Sentry**, App functionality + Analytics.
5. Save + **Submit for review**.
6. **Production → Create release** → pick the AAB (versionCode 43) → review → start rollout.

---

## 11. Cleanup after testing

- The two known fraudulent accounts from the universal-links plan (`bruno.moise@gmail.com` uuid `e6dafbbc-…`, `albeniz_77@hotmail.com` uuid `87f80fe2-…`): nuke through the same flow as a sanity test, or delete in Supabase Studio.
- Any leftover `bruno+del-*` accounts should already be gone from steps 7–9.

---

## Failure modes worth watching for

| Symptom                                     | Likely cause                                                           | Fix                                                                  |
| ------------------------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------- |
| No email arrives                            | Resend domain not verified, or `RESEND_API_KEY` wrong/missing on Fly   | Check `fly logs` for `[account-deletion] sendEmail failed`           |
| 400 INVALID_TOKEN on confirm                | `ACCOUNT_DELETION_SECRET` on Fly doesn't match what signed the token   | Re-set the secret; tokens are HMAC, mismatch = invalid               |
| In-app delete returns 500                   | Supabase RLS or DB error                                               | `fly logs` will surface the underlying error                         |
| iOS sheet footer offscreen with keyboard up | `BottomSheetFooter` `bottomInset` calc wrong                           | Adjust `footerInset` in `delete-account-sheet.tsx`                   |
| Google's URL checker rejects the form       | Page returns 4xx/5xx, or content doesn't match data-safety disclosures | Confirm `/delete-account` returns 200 in prod, and copy matches form |

---

## Status checklist (tick as you go)

- [x] Resend API key created (`api-prod`, Sending access)
- [x] Fly secrets set (after one stumble with empty-substitution)
- [x] Backend smoke (curl) passes — `/health`, `/account-deletion/request` (200 + 400), `/confirm` (400 on bad token)
- [x] Web pages render in prod
- [ ] Android build + internal-track install
- [ ] iOS build + TestFlight install (friend's iPad)
- [ ] Throwaway accounts created
- [ ] In-app email-user delete verified end-to-end
- [ ] In-app OAuth-user delete verified end-to-end
- [ ] Web flow + email + confirm verified end-to-end
- [ ] Negative cases verified
- [ ] Play Console form updated + submitted
- [ ] Production rollout started
