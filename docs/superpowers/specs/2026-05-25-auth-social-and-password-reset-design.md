# Auth: social sign-in + password reset — design

**Date:** 2026-05-25
**Status:** Approved, pending implementation plan
**Supersedes:** the current `app/apps/mobile/app/(auth)/sign-in.tsx` "sign-in-or-sign-up" combined flow

## Problem

Today the rebuild app supports only Supabase email/password auth, and the sign-in screen serves both new and returning users through a single button that tries `signInWithPassword` and falls through to `signUp` if that fails. There are two concrete user-facing problems:

1. **No password recovery.** A real user (Bruno's girlfriend) was locked out because she couldn't remember her password and there is no "Forgot password?" flow.
2. **No social sign-in.** Email/password is the only option, which is friction for new sign-ups and offers no recovery path when a password is lost.

A secondary problem: the auto-fallback-to-signup logic in `sign-in.tsx` leaks the existence of an account through the error message ("This email is registered but the password didn't match"), and conflates two distinct user intents (sign in vs. create) into one button.

## Goals

- Add Google sign-in.
- Add Apple sign-in (required by App Store guideline 4.8 once any other social provider is offered; iOS-only UI).
- Add email-based password recovery (magic link).
- Replace the fragile sign-in/sign-up combined button with explicit modes.
- When a social provider returns an email that already has an email/password account, auto-link the identities so the user lands in their existing account (same streak, same profile).
- Let users change their password and unlink social identities from the Profile screen.

## Non-goals

- Facebook, phone/SMS, passkeys, biometric unlock.
- AsyncStorage → SecureStore session token migration (already tracked for Plan 8).
- Any backend (`apps/server`) changes — auth lives entirely in Supabase.
- Re-skinning the rest of the auth flow (verify, change-email, onboarding) beyond the additions described below.

## Design

### 1. Sign-in screen redesign

Replaces `app/apps/mobile/app/(auth)/sign-in.tsx`. Top-to-bottom layout:

- Headline + subhead (Editorial type, same as today)
- `Continue with Apple` button — **rendered only on iOS** (`Platform.OS === 'ios'`)
- `Continue with Google` button
- "or" divider
- Tab toggle: **Sign in** / **Create account** (defaults to Sign in)
- Email field
- Password field
- `Forgot password?` link — only shown when on the Sign in tab
- Primary action button: label is `Sign in` on the Sign in tab, `Create account` on the Create account tab
- Sub-copy: terms/privacy acknowledgement (reuse existing copy from current screen)

The auto-fallback-to-signup logic is **deleted**. Each tab calls exactly one Supabase method: `signInWithPassword` on Sign in, `signUp` on Create account. The "wrong password" message no longer leaks — sign-in errors map to a single "Email or password is incorrect" toast.

### 2. Social auth — Google + Apple via native SDKs

Use native SDKs + Supabase `signInWithIdToken`, not the browser-bounce OAuth flow. This matches the Expo + Supabase recommended path and is required on iOS for Apple.

**Google:**

- Package: `@react-native-google-signin/google-signin`.
- Flow: tap → native Google chooser → returns ID token → call `supabase.auth.signInWithIdToken({ provider: 'google', token })`.
- Configuration: Google OAuth client IDs for Android, iOS, and Web. The Web client ID is the audience Supabase verifies against; Android/iOS client IDs are needed by the native SDK on each platform.
- Stored as env vars and wired through `app.config.ts` plugin configuration. Reuses GCP project `language-coach-app` (number `446154042539`).

**Apple:**

- Package: `expo-apple-authentication`.
- Flow: tap → native Apple sheet → returns identity token + nonce → `supabase.auth.signInWithIdToken({ provider: 'apple', token, nonce })`.
- Configuration: `usesAppleSignIn: true` in `app.config.ts`; Service ID + key configured in Apple Developer console (Team ID `428X7TF9S6`).
- Apple button is hidden on Android (Apple sign-in is iOS/web only).

**Error/loading:**

- Each social button has its own spinner.
- User cancellation (closed sheet) is silent.
- Other errors → toast (`src/lib/toast.ts`), matching the rest of the app. No `Alert.alert`.

**Build implication:** native modules → requires a new EAS dev build (or local prebuild) before the buttons can be tested. The implementation plan will sequence builds accordingly.

### 3. Password reset — email magic link

Three pieces:

**`Forgot password?` link → new screen `app/apps/mobile/app/(auth)/forgot-password.tsx`:**

- Single email input + "Send reset link" button.
- Calls `supabase.auth.resetPasswordForEmail(email, { redirectTo: 'mylanguagecoach://reset-password' })`.
- Always shows the same success state regardless of whether the email is registered ("If that email is registered, we've sent a reset link"). Prevents email enumeration.

**Deep link handler:**

- The reset email contains `mylanguagecoach://reset-password?...`.
- The existing URL listener in `_layout.tsx` picks it up; we add a branch that routes to `app/(auth)/reset-password.tsx`.
- Supabase's recovery flow establishes a session from the link's tokens automatically.

**`Reset password` screen — `app/apps/mobile/app/(auth)/reset-password.tsx`:**

- New password + confirm password fields.
- "Save" → `supabase.auth.updateUser({ password })`.
- On success → route to `/` and show toast "Password updated."
- On expired link → toast "Link expired — request a new one" + route back to `forgot-password.tsx`.

**Supabase dashboard config (one-time, done as part of implementation):**

- Add `mylanguagecoach://reset-password` to the redirect URL allowlist.
- Verify the "Reset Password" email template renders the link correctly (Supabase default works).

### 4. Account linking — auto-merge by verified email

**Behavior:** when a user with an existing email/password account signs in via Google or Apple using the same email, they land in their existing account — same streak, profile, history.

**Mechanism:** enable Supabase's "automatically link identities by email" setting (Auth → Settings in the dashboard). When on, Supabase attaches a new provider identity to an existing user if the new provider returns a verified email that matches. Both Google and Apple return verified emails; email/password accounts are verified after the confirmation step. No app-side merging code is needed — we rely on the platform.

**Edge case — unconfirmed email account:** if a user has signed up with email/password but not yet confirmed their email, Supabase will not auto-link a social sign-in. Detect this case (Supabase returns a specific error code) and show: "This email already has an unconfirmed account. Check your inbox or use 'Forgot password' to reset."

**No code-side merge logic.** Everything is dashboard configuration + relying on Supabase to do the right thing.

### 5. Profile additions — change password + linked identities

Two new rows in `app/apps/mobile/app/(tabs)/profile.tsx`, below the existing change-email row. Both open bottom sheets (no new full screens — matches the change-email pattern).

**Change password sheet:**

- Visible only if the user has an email/password identity (i.e., not for Google-only / Apple-only users — they have no password to change).
- Fields: current password, new password.
- Flow: silent `signInWithPassword` against current password to verify → on success, `supabase.auth.updateUser({ password: new })` → toast "Password updated."
- On failure of current-password check: toast "Current password is incorrect."

**Sign-in methods sheet:**

- Lists the user's identities: "Email" (if present), "Google" (if linked), "Apple" (if linked).
- Each identity has an Unlink button.
- The last remaining identity has Unlink **disabled** with helper text "You need at least one way to sign in."
- Unlink calls `supabase.auth.unlinkIdentity(identity)`.
- "Link Google" / "Link Apple" buttons shown for providers the user doesn't yet have. Implementation detail to resolve in the plan: Supabase's `linkIdentity` API is documented for browser-OAuth flows; for the native ID-token flow we use elsewhere, the equivalent is to call `signInWithIdToken` while already authenticated, which the auto-link dashboard setting from section 4 will merge into the current account. The plan will pick the cleanest of the two and confirm behavior against Supabase docs at implementation time.

### 6. Existing users — no migration needed

- Current users keep working unchanged; their email/password identity is preserved.
- The "Confirm email" warning path from today's `sign-in.tsx` still applies to fresh password sign-ups, surfaced via toast.
- The auto-sign-up fallback code is deleted, not preserved — explicit tabs replace it.
- AsyncStorage → SecureStore session migration is **out of scope** (stays on Plan 8 backlog).

## Component breakdown

New files:

- `app/apps/mobile/app/(auth)/forgot-password.tsx`
- `app/apps/mobile/app/(auth)/reset-password.tsx`
- `app/apps/mobile/src/features/auth/social-sign-in.ts` — wraps Google + Apple native SDK calls behind a uniform `signInWithGoogle()` / `signInWithApple()` API that returns a Supabase session or throws a typed error.
- `app/apps/mobile/src/features/auth/use-identities.ts` — hook reading `session.user.identities` and exposing link/unlink mutations.
- `app/apps/mobile/src/features/profile/change-password-sheet.tsx`
- `app/apps/mobile/src/features/profile/sign-in-methods-sheet.tsx`

Modified files:

- `app/apps/mobile/app/(auth)/sign-in.tsx` — full redesign per section 1.
- `app/apps/mobile/app/_layout.tsx` — add `reset-password` branch in deep-link handler.
- `app/apps/mobile/app/(tabs)/profile.tsx` — add two rows.
- `app/apps/mobile/app.config.ts` — add `usesAppleSignIn`, Google sign-in plugin config.
- `app/apps/mobile/src/lib/env.ts` — add Google client ID env vars.

## Error handling

| Scenario                                    | UX                                                                                       |
| ------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Sign-in: wrong password                     | Toast: "Email or password is incorrect."                                                 |
| Sign-in: unknown email                      | Same toast as wrong password (no enumeration).                                           |
| Create account: email already exists        | Toast: "This email already has an account — sign in instead." Switch tab to Sign in.     |
| Create account: email confirmation required | Toast + sub-copy: "Check your inbox to confirm your email."                              |
| Social: user cancels native sheet           | Silent (no toast).                                                                       |
| Social: network failure                     | Toast: "Couldn't reach the sign-in provider. Try again."                                 |
| Social: existing unconfirmed email          | Toast: "This email has an unconfirmed account. Check your inbox or use Forgot password." |
| Forgot password: any input                  | Always success message (no enumeration).                                                 |
| Reset password: expired link                | Toast + route back to forgot-password.                                                   |
| Reset password: weak password               | Inline error under field, button disabled.                                               |
| Change password: wrong current              | Toast: "Current password is incorrect."                                                  |
| Unlink: last identity attempt               | Button disabled with helper text (not a runtime error).                                  |

## Testing

- Unit tests for `social-sign-in.ts` (mock Google + Apple SDKs + Supabase client) — verify token plumbing and error mapping.
- Unit tests for `use-identities.ts` — link/unlink mutation behavior, last-identity guard.
- Manual E2E checklist (no automated mobile E2E exists in this project):
  - Sign in with existing password — success.
  - Sign in with wrong password — toast, no enumeration.
  - Create account with new email — success or confirmation required.
  - Create account with existing email — toast + tab switch.
  - Forgot password → reset via email link → sign in with new password.
  - Sign in with Google as new user — account created.
  - Sign in with Google as user with existing password account (same email) — auto-link, same streak preserved.
  - Sign in with Apple — same matrix as Google, iOS only.
  - Profile → change password → sign out → sign in with new password.
  - Profile → link Google to a password-only account → sign out → sign in with Google → lands in same account.
  - Profile → unlink Google when password identity still present → success.
  - Profile → unlink last identity → button disabled.

## Out of scope (explicit)

- Facebook sign-in.
- Phone/SMS auth.
- Passkeys.
- Biometric unlock for the app.
- Backend (`apps/server`) changes.
- Re-skinning verify.tsx, change-email.tsx, onboarding screens.
- SecureStore migration for Supabase session tokens.
