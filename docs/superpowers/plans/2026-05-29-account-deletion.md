# Account Deletion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a Play-Console-compliant account deletion flow with both a publicly-accessible web URL (`mylanguagecoach.app/delete-account`) and an in-app "Delete account" option in the mobile Profile screen, so the Data Safety form can answer "yes" to user-initiated deletion and the rejected versionCode 42 can be resubmitted as 43.

**Architecture:** New backend module (`apps/api/src/routes/account-deletion.ts`) with three endpoints: anonymous `request` (email + send confirmation link), anonymous `confirm` (token-verified hard delete), authenticated `self` (in-app delete). Email is sent via Resend (new dep). Token is a `jose`-signed JWT (new dep). DB cleanup leans on existing `ON DELETE CASCADE` FKs on `profiles` — a single `DELETE FROM profiles WHERE user_id = X` removes conversations/messages/streak_days/vocab_items/entitlements/push_tokens and sets the `user_id` on `usage_events` and `revenue_events` to NULL (financial-record anonymization). The `topics` table needs an explicit delete because its `user_id` has no FK. The Supabase Auth user is removed last via the admin SDK.

**Tech Stack:** Hono 4 + Drizzle ORM + Vitest 4 (API); Next.js 14 App Router + Vitest 2 (web); Expo Router 6 + Vitest 4 + `@gorhom/bottom-sheet` 5 (mobile); Supabase Auth admin API; Resend; `jose` for JWTs.

---

## Spec Coverage Map

Every requirement in `docs/superpowers/specs/2026-05-29-account-deletion-design.md` is implemented by a task:

- Public web flow → Tasks 6, 7, 8
- API endpoints → Tasks 3, 4, 5
- Deletion routine → Task 4
- Email confirmation → Tasks 2, 3
- In-app mobile flow → Tasks 10, 11
- Privacy policy update + Footer link → Task 9
- Play Console form submission + version bump → Task 12

---

## File Structure

**New files:**

- `apps/api/src/lib/account-deletion-token.ts` — sign/verify the deletion-confirmation JWT
- `apps/api/src/lib/account-deletion-token.test.ts`
- `apps/api/src/lib/account-deletion-email.ts` — send the confirmation email via Resend
- `apps/api/src/lib/account-deletion-email.test.ts`
- `apps/api/src/lib/account-deletion.ts` — shared deletion routine (DB cascade + auth user delete)
- `apps/api/src/lib/account-deletion.test.ts`
- `apps/api/src/routes/account-deletion.ts` — Hono router with 3 endpoints
- `apps/api/src/routes/account-deletion.test.ts`
- `apps/web/app/delete-account/page.tsx` — public form (EN)
- `apps/web/app/delete-account/RequestForm.client.tsx` — client component for the form
- `apps/web/app/delete-account/confirm/page.tsx` — confirm screen (EN)
- `apps/web/app/delete-account/confirm/ConfirmButton.client.tsx`
- `apps/web/app/delete-account/done/page.tsx` — success state (EN)
- `apps/web/app/fr/delete-account/page.tsx` — FR mirror
- `apps/web/app/fr/delete-account/confirm/page.tsx` — FR mirror
- `apps/web/app/fr/delete-account/done/page.tsx` — FR mirror
- `apps/mobile/src/features/profile/delete-account-sheet.tsx`
- `apps/mobile/src/features/profile/delete-account-sheet.test.tsx`
- `apps/mobile/src/features/profile/use-delete-account.ts`

**Modified files:**

- `apps/api/package.json` — add `jose`, `resend`
- `apps/api/src/env.ts` — add `ACCOUNT_DELETION_SECRET`, `RESEND_API_KEY`, `PUBLIC_WEB_BASE_URL`
- `apps/api/src/app.ts` — mount the new router
- `apps/web/messages/en.json` — add `deleteAccount.*` keys
- `apps/web/messages/fr.json` — same, in French
- `apps/web/components/Footer.tsx` — add the "Delete account" link
- `apps/web/content/privacy.en.mdx` — add "Data deletion" section
- `apps/web/content/privacy.fr.mdx` — same, French
- `apps/mobile/src/lib/api-client.ts` — add `selfDeleteAccount()`
- `apps/mobile/app/(tabs)/profile.tsx` — wire in the new sheet + danger-zone row
- `apps/mobile/app.config.ts` — bump `versionCode` 42→43, `buildNumber` 8→9

**Out-of-band:**

- Fly secrets: set `ACCOUNT_DELETION_SECRET`, `RESEND_API_KEY`, `PUBLIC_WEB_BASE_URL`
- Resend account: create, verify `mylanguagecoach.app` sender domain, get an API key
- Play Console: paste URL into Data Safety form, submit new build for review

---

## Task 1: Add dependencies + env vars

**Files:**
- Modify: `apps/api/package.json`
- Modify: `apps/api/src/env.ts`

- [ ] **Step 1: Install `jose` and `resend` in the API workspace**

```bash
cd "C:/Users/bruno.moise/My Language Coach - rebuild/app"
pnpm --filter @language-coach/api add jose resend
```

Expected: `package.json` updated; both packages appear under `dependencies`.

- [ ] **Step 2: Extend the env schema**

In `apps/api/src/env.ts`, add to `EnvSchema`:

```ts
ACCOUNT_DELETION_SECRET: z.string().min(32), // 32+ random bytes hex for JWT HMAC
RESEND_API_KEY: z.string().min(1),
PUBLIC_WEB_BASE_URL: z.string().url(), // e.g. https://www.mylanguagecoach.app
```

- [ ] **Step 3: Generate the secret locally**

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Save the output. You'll set this as a Fly secret in Task 13 — but **also paste it into `apps/api/.env` now** so the local test suite + dev server can boot.

Add the placeholders to `apps/api/.env` (do not commit `.env`):

```
ACCOUNT_DELETION_SECRET=<paste hex from above>
RESEND_API_KEY=re_placeholder_will_set_in_resend_dashboard
PUBLIC_WEB_BASE_URL=http://localhost:3002
```

- [ ] **Step 4: Verify typecheck still passes**

```bash
pnpm --filter @language-coach/api typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/package.json apps/api/src/env.ts pnpm-lock.yaml
git commit -m "feat(api): add jose + resend deps + deletion env vars"
```

---

## Task 2: Account-deletion JWT helper

**Files:**
- Create: `apps/api/src/lib/account-deletion-token.ts`
- Test: `apps/api/src/lib/account-deletion-token.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `apps/api/src/lib/account-deletion-token.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { signDeletionToken, verifyDeletionToken } from "./account-deletion-token";

const secret = "a".repeat(64); // 32 bytes hex
const userId = "00000000-0000-0000-0000-000000000001";

describe("account-deletion JWT", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-29T12:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("signs and verifies a token round-trip", async () => {
    const token = await signDeletionToken(secret, userId);
    const payload = await verifyDeletionToken(secret, token);
    expect(payload.userId).toBe(userId);
  });

  it("rejects an expired token", async () => {
    const token = await signDeletionToken(secret, userId);
    vi.setSystemTime(new Date("2026-05-31T12:00:01Z")); // +25h
    await expect(verifyDeletionToken(secret, token)).rejects.toThrow();
  });

  it("rejects a tampered signature", async () => {
    const token = await signDeletionToken(secret, userId);
    const tampered = token.slice(0, -4) + "XXXX";
    await expect(verifyDeletionToken(secret, tampered)).rejects.toThrow();
  });

  it("rejects a token signed with a different secret", async () => {
    const token = await signDeletionToken(secret, userId);
    await expect(verifyDeletionToken("b".repeat(64), token)).rejects.toThrow();
  });

  it("rejects a token with the wrong purpose claim", async () => {
    // Manually craft a token with no purpose to ensure the verifier checks it.
    const { SignJWT } = await import("jose");
    const key = new TextEncoder().encode(secret);
    const bad = await new SignJWT({ userId, purpose: "something-else" })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("24h")
      .sign(key);
    await expect(verifyDeletionToken(secret, bad)).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm --filter @language-coach/api test -- account-deletion-token
```

Expected: FAIL with "Cannot find module './account-deletion-token'".

- [ ] **Step 3: Implement the helper**

Create `apps/api/src/lib/account-deletion-token.ts`:

```ts
import { SignJWT, jwtVerify } from "jose";

const PURPOSE = "account-deletion";
const EXPIRY = "24h";

function toKey(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

export async function signDeletionToken(
  secret: string,
  userId: string,
): Promise<string> {
  return new SignJWT({ userId, purpose: PURPOSE })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(EXPIRY)
    .sign(toKey(secret));
}

export type DeletionPayload = { userId: string };

export async function verifyDeletionToken(
  secret: string,
  token: string,
): Promise<DeletionPayload> {
  const { payload } = await jwtVerify(token, toKey(secret), {
    algorithms: ["HS256"],
  });
  if (payload.purpose !== PURPOSE) {
    throw new Error("Invalid token purpose");
  }
  if (typeof payload.userId !== "string") {
    throw new Error("Invalid token payload");
  }
  return { userId: payload.userId };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm --filter @language-coach/api test -- account-deletion-token
```

Expected: PASS — all 5 tests green.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/lib/account-deletion-token.ts apps/api/src/lib/account-deletion-token.test.ts
git commit -m "feat(api): account-deletion JWT sign/verify helpers"
```

---

## Task 3: Email-sender helper

**Files:**
- Create: `apps/api/src/lib/account-deletion-email.ts`
- Test: `apps/api/src/lib/account-deletion-email.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `apps/api/src/lib/account-deletion-email.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { sendDeletionConfirmationEmail } from "./account-deletion-email";

describe("sendDeletionConfirmationEmail", () => {
  it("calls Resend with the confirmation link and the user's email", async () => {
    const send = vi.fn().mockResolvedValue({ data: { id: "msg_1" }, error: null });
    const resend = { emails: { send } };

    await sendDeletionConfirmationEmail({
      resend: resend as never,
      to: "user@example.com",
      displayName: "Alice",
      confirmUrl: "https://www.mylanguagecoach.app/delete-account/confirm?token=abc",
    });

    expect(send).toHaveBeenCalledTimes(1);
    const args = send.mock.calls[0]![0];
    expect(args.to).toBe("user@example.com");
    expect(args.subject).toMatch(/account deletion/i);
    expect(args.html).toContain(
      "https://www.mylanguagecoach.app/delete-account/confirm?token=abc",
    );
    expect(args.html).toContain("Alice");
    expect(args.text).toContain(
      "https://www.mylanguagecoach.app/delete-account/confirm?token=abc",
    );
  });

  it("throws when Resend returns an error", async () => {
    const send = vi
      .fn()
      .mockResolvedValue({ data: null, error: { message: "rate limited" } });
    const resend = { emails: { send } };
    await expect(
      sendDeletionConfirmationEmail({
        resend: resend as never,
        to: "u@e.com",
        displayName: "x",
        confirmUrl: "https://e/x",
      }),
    ).rejects.toThrow(/rate limited/);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm --filter @language-coach/api test -- account-deletion-email
```

Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement the helper**

Create `apps/api/src/lib/account-deletion-email.ts`:

```ts
import type { Resend } from "resend";

const FROM = "My Language Coach <noreply@mylanguagecoach.app>";

export type SendDeletionEmailInput = {
  resend: Resend;
  to: string;
  displayName: string;
  confirmUrl: string;
};

export async function sendDeletionConfirmationEmail(
  input: SendDeletionEmailInput,
): Promise<void> {
  const { resend, to, displayName, confirmUrl } = input;
  const subject = "Confirm account deletion — My Language Coach";
  const safeName = displayName || "there";

  const text =
    `Hi ${safeName},\n\n` +
    `Someone (hopefully you) asked to delete your My Language Coach account ` +
    `and all associated data.\n\n` +
    `Confirm by opening this link within 24 hours:\n${confirmUrl}\n\n` +
    `If you didn't request this, ignore this email — your account will not be deleted.\n\n` +
    `— My Language Coach`;

  const html =
    `<p>Hi ${escapeHtml(safeName)},</p>` +
    `<p>Someone (hopefully you) asked to delete your My Language Coach account and all associated data.</p>` +
    `<p>Confirm by opening this link within 24 hours:</p>` +
    `<p><a href="${escapeHtml(confirmUrl)}">${escapeHtml(confirmUrl)}</a></p>` +
    `<p>If you didn't request this, ignore this email — your account will not be deleted.</p>` +
    `<p>— My Language Coach</p>`;

  const result = await resend.emails.send({
    from: FROM,
    to,
    subject,
    text,
    html,
  });
  if (result.error) {
    throw new Error(`Resend error: ${result.error.message ?? "unknown"}`);
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm --filter @language-coach/api test -- account-deletion-email
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/lib/account-deletion-email.ts apps/api/src/lib/account-deletion-email.test.ts
git commit -m "feat(api): Resend wrapper for deletion confirmation email"
```

---

## Task 4: Deletion routine

**Files:**
- Create: `apps/api/src/lib/account-deletion.ts`
- Test: `apps/api/src/lib/account-deletion.test.ts`

This is the function called by both the `/confirm` and `/self` endpoints. Because of the `ON DELETE CASCADE` FKs on `profiles`, the routine is short: delete the user's rows in `topics` (no FK there), delete the `profiles` row (cascades + nulls everything), then delete the Supabase Auth user.

- [ ] **Step 1: Write the failing tests**

Create `apps/api/src/lib/account-deletion.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { deleteUserAccount } from "./account-deletion";

const userId = "00000000-0000-0000-0000-000000000001";

function makeDeps() {
  const where = vi.fn().mockResolvedValue(undefined);
  const dbDelete = vi.fn(() => ({ where }));
  const db = { delete: dbDelete };
  const deleteUser = vi.fn().mockResolvedValue({ data: {}, error: null });
  const supabaseAdmin = { auth: { admin: { deleteUser } } };
  return { db, supabaseAdmin, dbDelete, where, deleteUser };
}

describe("deleteUserAccount", () => {
  it("deletes topics rows, then profiles, then the auth user, in order", async () => {
    const { db, supabaseAdmin, dbDelete, deleteUser } = makeDeps();
    const order: string[] = [];
    dbDelete.mockImplementation((table: { _: { name: string } }) => {
      order.push(table._.name);
      return { where: () => Promise.resolve(undefined) };
    });
    deleteUser.mockImplementation(async () => {
      order.push("auth.users");
      return { data: {}, error: null };
    });

    await deleteUserAccount({
      db: db as never,
      supabaseAdmin: supabaseAdmin as never,
      userId,
    });

    expect(order).toEqual(["topics", "profiles", "auth.users"]);
  });

  it("throws if the auth user delete fails", async () => {
    const { db, supabaseAdmin, deleteUser } = makeDeps();
    deleteUser.mockResolvedValueOnce({
      data: null,
      error: { message: "boom" },
    });
    await expect(
      deleteUserAccount({
        db: db as never,
        supabaseAdmin: supabaseAdmin as never,
        userId,
      }),
    ).rejects.toThrow(/boom/);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm --filter @language-coach/api test -- account-deletion.test
```

Expected: FAIL (module not found).

- [ ] **Step 3: Implement the routine**

Create `apps/api/src/lib/account-deletion.ts`:

```ts
import { and, eq } from "drizzle-orm";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../db";
import { profiles } from "../db/schema/profiles";
import { topics } from "../db/schema/topics";

export type DeleteUserAccountInput = {
  db: Database;
  supabaseAdmin: SupabaseClient;
  userId: string;
};

/**
 * Hard-deletes a user account and all owned rows.
 *
 * Order matters: topics first (no FK on user_id), then profiles (cascades to
 * conversations, messages via conversations, streak_days, vocab_items,
 * entitlements, push_tokens; sets user_id to NULL on usage_events and
 * revenue_events to preserve anonymized analytics + financial records),
 * then the auth user (after the DB rows are gone, so the auth row can be
 * removed even if something later re-references it).
 */
export async function deleteUserAccount(
  input: DeleteUserAccountInput,
): Promise<void> {
  const { db, supabaseAdmin, userId } = input;

  // Delete user-owned custom topics. Built-in topics have user_id = null
  // and stay. We filter by user_id only since is_built_in is irrelevant
  // when user_id matches a specific user.
  await db.delete(topics).where(eq(topics.userId, userId));

  // Delete the profile row. FKs do the rest.
  await db.delete(profiles).where(eq(profiles.userId, userId));

  // Delete the Supabase Auth user.
  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (error) {
    throw new Error(`Failed to delete auth user: ${error.message}`);
  }
}
```

Note: the `and` import is unused; if your eslint config rejects unused imports, remove it. Keeping the example minimal here.

- [ ] **Step 4: Remove the unused `and` import if lint complains**

Replace `import { and, eq } from "drizzle-orm";` with `import { eq } from "drizzle-orm";`.

- [ ] **Step 5: Run tests to verify they pass**

```bash
pnpm --filter @language-coach/api test -- account-deletion.test
```

Expected: PASS — both tests green.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/lib/account-deletion.ts apps/api/src/lib/account-deletion.test.ts
git commit -m "feat(api): hard-delete routine for user accounts"
```

---

## Task 5: Account-deletion route handlers + wire-up

**Files:**
- Create: `apps/api/src/routes/account-deletion.ts`
- Create: `apps/api/src/routes/account-deletion.test.ts`
- Modify: `apps/api/src/app.ts`

- [ ] **Step 1: Write the failing tests**

Create `apps/api/src/routes/account-deletion.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { createAccountDeletionRoutes } from "./account-deletion";
import { signDeletionToken } from "../lib/account-deletion-token";

const SECRET = "a".repeat(64);
const USER_ID = "00000000-0000-0000-0000-000000000001";

function mountAnon(routes: ReturnType<typeof createAccountDeletionRoutes>) {
  const app = new Hono();
  app.route("/account-deletion", routes);
  return app;
}

function mountAuthed(routes: ReturnType<typeof createAccountDeletionRoutes>) {
  const app = new Hono<{ Variables: { userId: string } }>();
  app.use("/v1/*", async (c, next) => {
    c.set("userId", USER_ID);
    await next();
  });
  app.route("/v1/account-deletion", routes);
  return app;
}

describe("POST /account-deletion/request", () => {
  it("returns 200 even when the email is unknown (no enumeration)", async () => {
    const findUserByEmail = vi.fn().mockResolvedValue(null);
    const sendEmail = vi.fn();
    const routes = createAccountDeletionRoutes({
      secret: SECRET,
      publicWebBaseUrl: "https://www.mylanguagecoach.app",
      findUserByEmail,
      sendEmail,
      deleteUser: vi.fn(),
    });
    const app = mountAnon(routes);
    const res = await app.request("/account-deletion/request", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "nobody@example.com" }),
    });
    expect(res.status).toBe(200);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("sends a confirmation email when the user exists", async () => {
    const findUserByEmail = vi
      .fn()
      .mockResolvedValue({ id: USER_ID, displayName: "Alice" });
    const sendEmail = vi.fn().mockResolvedValue(undefined);
    const routes = createAccountDeletionRoutes({
      secret: SECRET,
      publicWebBaseUrl: "https://www.mylanguagecoach.app",
      findUserByEmail,
      sendEmail,
      deleteUser: vi.fn(),
    });
    const app = mountAnon(routes);
    const res = await app.request("/account-deletion/request", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "user@example.com" }),
    });
    expect(res.status).toBe(200);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const args = sendEmail.mock.calls[0]![0];
    expect(args.to).toBe("user@example.com");
    expect(args.displayName).toBe("Alice");
    expect(args.confirmUrl).toMatch(
      /^https:\/\/www\.mylanguagecoach\.app\/delete-account\/confirm\?token=/,
    );
  });

  it("rejects malformed email payloads with 400", async () => {
    const routes = createAccountDeletionRoutes({
      secret: SECRET,
      publicWebBaseUrl: "https://www.mylanguagecoach.app",
      findUserByEmail: vi.fn(),
      sendEmail: vi.fn(),
      deleteUser: vi.fn(),
    });
    const app = mountAnon(routes);
    const res = await app.request("/account-deletion/request", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "not-an-email" }),
    });
    expect(res.status).toBe(400);
  });
});

describe("POST /account-deletion/confirm", () => {
  it("deletes the user when token is valid", async () => {
    const deleteUser = vi.fn().mockResolvedValue(undefined);
    const routes = createAccountDeletionRoutes({
      secret: SECRET,
      publicWebBaseUrl: "https://www.mylanguagecoach.app",
      findUserByEmail: vi.fn(),
      sendEmail: vi.fn(),
      deleteUser,
    });
    const app = mountAnon(routes);
    const token = await signDeletionToken(SECRET, USER_ID);

    const res = await app.request("/account-deletion/confirm", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    });

    expect(res.status).toBe(200);
    expect(deleteUser).toHaveBeenCalledWith(USER_ID);
  });

  it("returns 400 on a tampered token", async () => {
    const routes = createAccountDeletionRoutes({
      secret: SECRET,
      publicWebBaseUrl: "https://www.mylanguagecoach.app",
      findUserByEmail: vi.fn(),
      sendEmail: vi.fn(),
      deleteUser: vi.fn(),
    });
    const app = mountAnon(routes);
    const res = await app.request("/account-deletion/confirm", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: "not.a.real.token" }),
    });
    expect(res.status).toBe(400);
  });
});

describe("POST /account-deletion/self (authenticated)", () => {
  it("deletes the caller's account", async () => {
    const deleteUser = vi.fn().mockResolvedValue(undefined);
    const routes = createAccountDeletionRoutes({
      secret: SECRET,
      publicWebBaseUrl: "https://www.mylanguagecoach.app",
      findUserByEmail: vi.fn(),
      sendEmail: vi.fn(),
      deleteUser,
    });
    const app = mountAuthed(routes);
    const res = await app.request("/v1/account-deletion/self", {
      method: "POST",
    });
    expect(res.status).toBe(200);
    expect(deleteUser).toHaveBeenCalledWith(USER_ID);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm --filter @language-coach/api test -- account-deletion.test
```

Expected: FAIL with module not found for `./account-deletion` route.

- [ ] **Step 3: Implement the routes**

Create `apps/api/src/routes/account-deletion.ts`:

```ts
import { Hono } from "hono";
import { z } from "zod";
import {
  signDeletionToken,
  verifyDeletionToken,
} from "../lib/account-deletion-token";

export type FindUserByEmailFn = (
  email: string,
) => Promise<{ id: string; displayName: string } | null>;

export type SendDeletionEmailFn = (input: {
  to: string;
  displayName: string;
  confirmUrl: string;
}) => Promise<void>;

export type DeleteUserFn = (userId: string) => Promise<void>;

export type AccountDeletionDeps = {
  secret: string;
  publicWebBaseUrl: string;
  findUserByEmail: FindUserByEmailFn;
  sendEmail: SendDeletionEmailFn;
  deleteUser: DeleteUserFn;
};

const RequestSchema = z.object({ email: z.string().email() });
const ConfirmSchema = z.object({ token: z.string().min(1) });

export function createAccountDeletionRoutes(deps: AccountDeletionDeps) {
  const app = new Hono<{ Variables: { userId?: string } }>();

  app.post("/request", async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: { code: "INVALID_INPUT" } }, 400);
    }
    const user = await deps.findUserByEmail(parsed.data.email);
    if (user) {
      const token = await signDeletionToken(deps.secret, user.id);
      const confirmUrl = `${deps.publicWebBaseUrl}/delete-account/confirm?token=${encodeURIComponent(token)}`;
      try {
        await deps.sendEmail({
          to: parsed.data.email,
          displayName: user.displayName,
          confirmUrl,
        });
      } catch (err) {
        // Surface in logs but still return 200 to avoid enumeration.
        console.error("[account-deletion] sendEmail failed", err);
      }
    }
    return c.json({ ok: true });
  });

  app.post("/confirm", async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = ConfirmSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: { code: "INVALID_INPUT" } }, 400);
    }
    let payload: { userId: string };
    try {
      payload = await verifyDeletionToken(deps.secret, parsed.data.token);
    } catch {
      return c.json({ error: { code: "INVALID_TOKEN" } }, 400);
    }
    try {
      await deps.deleteUser(payload.userId);
    } catch (err) {
      console.error("[account-deletion] deleteUser failed", err);
      return c.json({ error: { code: "DELETION_FAILED" } }, 500);
    }
    return c.json({ ok: true });
  });

  app.post("/self", async (c) => {
    const userId = c.get("userId");
    if (!userId) return c.json({ error: { code: "UNAUTHORIZED" } }, 401);
    try {
      await deps.deleteUser(userId);
    } catch (err) {
      console.error("[account-deletion] deleteUser failed", err);
      return c.json({ error: { code: "DELETION_FAILED" } }, 500);
    }
    return c.json({ ok: true });
  });

  return app;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm --filter @language-coach/api test -- account-deletion.test
```

Expected: PASS — 5 tests green (3 request + 2 confirm + 1 self).

- [ ] **Step 5: Wire the routes into `app.ts`**

In `apps/api/src/app.ts`, after the existing imports add:

```ts
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { createAccountDeletionRoutes } from "./routes/account-deletion";
import { deleteUserAccount } from "./lib/account-deletion";
import { sendDeletionConfirmationEmail } from "./lib/account-deletion-email";
```

Inside `createApp`, **before** the `app.use("/v1/*", auth);` line, mount the anonymous endpoints:

```ts
const supabaseAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY);
const resend = new Resend(env.RESEND_API_KEY);

const accountDeletionDeps = {
  secret: env.ACCOUNT_DELETION_SECRET,
  publicWebBaseUrl: env.PUBLIC_WEB_BASE_URL,
  findUserByEmail: async (email: string) => {
    // Supabase admin listUsers paginated query — small user base, page=1 is fine.
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    if (error) throw error;
    const u = data.users.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase(),
    );
    if (!u) return null;
    const profile = await db.query.profiles.findFirst({
      where: (p, { eq }) => eq(p.userId, u.id),
    });
    return { id: u.id, displayName: profile?.displayName ?? "" };
  },
  sendEmail: (input: {
    to: string;
    displayName: string;
    confirmUrl: string;
  }) =>
    sendDeletionConfirmationEmail({
      resend,
      to: input.to,
      displayName: input.displayName,
      confirmUrl: input.confirmUrl,
    }),
  deleteUser: (userId: string) =>
    deleteUserAccount({ db, supabaseAdmin, userId }),
};

app.route(
  "/account-deletion",
  createAccountDeletionRoutes(accountDeletionDeps),
);
```

Then **after** `app.use("/v1/*", auth);` add:

```ts
app.route(
  "/v1/account-deletion",
  createAccountDeletionRoutes(accountDeletionDeps),
);
```

(The same router is mounted twice — under `/account-deletion` for anonymous `request` + `confirm` and under `/v1/account-deletion` for the authenticated `self`. Hono ignores routes that don't match; harmless that all three handlers exist under both mounts.)

- [ ] **Step 6: Run the full API test suite**

```bash
pnpm --filter @language-coach/api test
```

Expected: PASS, no new failures.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/routes/account-deletion.ts apps/api/src/routes/account-deletion.test.ts apps/api/src/app.ts
git commit -m "feat(api): account deletion endpoints (request, confirm, self)"
```

---

## Task 6: Web — public request page (EN)

**Files:**
- Create: `apps/web/app/delete-account/page.tsx`
- Create: `apps/web/app/delete-account/RequestForm.client.tsx`
- Create: `apps/web/app/delete-account/done/page.tsx`
- Modify: `apps/web/messages/en.json`

- [ ] **Step 1: Add EN i18n keys**

In `apps/web/messages/en.json`:

1. Add a `deleteAccount` link to `footer.links` — change

```json
"links": {
  "privacy": "Privacy",
  "terms": "Terms",
  "contact": "Contact"
},
```

to

```json
"links": {
  "privacy": "Privacy",
  "terms": "Terms",
  "deleteAccount": "Delete account",
  "contact": "Contact"
},
```

2. Append the `deleteAccount` block to the root object (after `footer`):

```json
"deleteAccount": {
  "title": "Delete your My Language Coach account",
  "intro": "Enter the email you signed up with. We'll send a one-time confirmation link. Click it to permanently delete your account and all associated data.",
  "emailLabel": "Email",
  "submit": "Send confirmation link",
  "submitting": "Sending…",
  "sent": "If an account with that email exists, we sent a confirmation link. Check your inbox (and spam folder). The link expires in 24 hours.",
  "errorGeneric": "Something went wrong. Please try again in a few minutes.",
  "whatIsDeleted": "What gets deleted",
  "whatIsDeletedList": "Your email, name, profile picture, chat messages, conversation history, streaks, saved vocabulary, push notification tokens, and subscription entitlements.",
  "whatIsKept": "What we keep",
  "whatIsKeptList": "Anonymized financial records of purchases (no longer linked to you, retained for tax-reporting purposes), and anonymized aggregate analytics (no longer linked to you).",
  "confirmTitle": "Confirm permanent deletion",
  "confirmIntro": "This will permanently delete your account and all your practice history. This cannot be undone.",
  "confirmButton": "Delete my account",
  "confirmInvalid": "This deletion link is invalid or has already been used.",
  "confirmExpired": "This deletion link has expired. Request a new one.",
  "confirmFailed": "We couldn't complete the deletion. Try again, or contact support.",
  "doneTitle": "Account deleted",
  "doneBody": "Your account and all associated data have been deleted. We're sorry to see you go."
}
```

- [ ] **Step 2: Create the success page**

`apps/web/app/delete-account/done/page.tsx`:

```tsx
import { LegalLayout } from "@/components/LegalLayout";
import { getMessages } from "@/lib/i18n";

export const metadata = {
  title: "Account deleted — My Language Coach",
};

export default function Page() {
  const m = getMessages("en").deleteAccount;
  return (
    <LegalLayout locale="en">
      <h1>{m.doneTitle}</h1>
      <p>{m.doneBody}</p>
    </LegalLayout>
  );
}
```

- [ ] **Step 3: Create the client form**

`apps/web/app/delete-account/RequestForm.client.tsx`:

```tsx
"use client";

import { useState } from "react";
import { getMessages } from "@/lib/i18n";

type Props = {
  apiBaseUrl: string;
  locale: "en" | "fr";
};

export function RequestForm({ apiBaseUrl, locale }: Props) {
  const m = getMessages(locale).deleteAccount;
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    try {
      const res = await fetch(`${apiBaseUrl}/account-deletion/request`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setState("sent");
    } catch {
      setState("error");
    }
  }

  if (state === "sent") {
    return <p>{m.sent}</p>;
  }

  return (
    <form onSubmit={onSubmit} className="not-prose flex flex-col gap-3 max-w-md">
      <label className="font-body text-sm">
        {m.emailLabel}
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 block w-full rounded-md border border-ink/20 px-3 py-2 font-body"
        />
      </label>
      <button
        type="submit"
        disabled={state === "sending"}
        className="rounded-md bg-ink text-cream px-4 py-2 font-body disabled:opacity-50"
      >
        {state === "sending" ? m.submitting : m.submit}
      </button>
      {state === "error" ? (
        <p className="text-danger text-sm">{m.errorGeneric}</p>
      ) : null}
    </form>
  );
}
```

- [ ] **Step 4: Create the EN page**

`apps/web/app/delete-account/page.tsx`:

```tsx
import { LegalLayout } from "@/components/LegalLayout";
import { getMessages } from "@/lib/i18n";
import { RequestForm } from "./RequestForm.client";

export const metadata = {
  title: "Delete your account — My Language Coach",
  alternates: {
    canonical: "/delete-account",
    languages: { en: "/delete-account", fr: "/fr/delete-account" },
  },
};

export default function Page() {
  const m = getMessages("en").deleteAccount;
  const apiBaseUrl =
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    "https://my-language-coach-agentical-rebuild.fly.dev";
  return (
    <LegalLayout locale="en">
      <h1>{m.title}</h1>
      <p>{m.intro}</p>
      <RequestForm apiBaseUrl={apiBaseUrl} locale="en" />
      <h2>{m.whatIsDeleted}</h2>
      <p>{m.whatIsDeletedList}</p>
      <h2>{m.whatIsKept}</h2>
      <p>{m.whatIsKeptList}</p>
    </LegalLayout>
  );
}
```

- [ ] **Step 5: Set NEXT_PUBLIC_API_BASE_URL in `.env.local` if needed**

If `apps/web/.env.local` doesn't yet have it:

```
NEXT_PUBLIC_API_BASE_URL=https://my-language-coach-agentical-rebuild.fly.dev
```

- [ ] **Step 6: Manual smoke test**

```bash
pnpm --filter @language-coach/web dev
```

Visit `http://localhost:3002/delete-account`. Confirm the page renders, the form submits, and you see the "sent" message. (The API call will land on Fly's prod backend; with a non-existent email it returns 200 silently and the UI flips to "sent".)

- [ ] **Step 7: Run web tests + typecheck**

```bash
pnpm --filter @language-coach/web typecheck
pnpm --filter @language-coach/web test
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/web/app/delete-account apps/web/messages/en.json
git commit -m "feat(web): public account-deletion request page (EN)"
```

---

## Task 7: Web — confirm page (EN)

**Files:**
- Create: `apps/web/app/delete-account/confirm/page.tsx`
- Create: `apps/web/app/delete-account/confirm/ConfirmButton.client.tsx`

- [ ] **Step 1: Create the confirm button client component**

`apps/web/app/delete-account/confirm/ConfirmButton.client.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getMessages } from "@/lib/i18n";

type Props = {
  apiBaseUrl: string;
  token: string;
  locale: "en" | "fr";
};

export function ConfirmButton({ apiBaseUrl, token, locale }: Props) {
  const m = getMessages(locale).deleteAccount;
  const router = useRouter();
  const donePath = locale === "fr" ? "/fr/delete-account/done" : "/delete-account/done";
  const [state, setState] = useState<"idle" | "deleting" | "error">("idle");

  async function onClick() {
    setState("deleting");
    try {
      const res = await fetch(`${apiBaseUrl}/account-deletion/confirm`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (!res.ok) throw new Error(String(res.status));
      router.push(donePath);
    } catch {
      setState("error");
    }
  }

  return (
    <div className="not-prose flex flex-col gap-3 max-w-md">
      <button
        onClick={onClick}
        disabled={state === "deleting"}
        className="rounded-md bg-danger text-cream px-4 py-2 font-body disabled:opacity-50"
      >
        {state === "deleting" ? "…" : m.confirmButton}
      </button>
      {state === "error" ? (
        <p className="text-danger text-sm">{m.confirmFailed}</p>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 2: Create the confirm page**

`apps/web/app/delete-account/confirm/page.tsx`:

```tsx
import { LegalLayout } from "@/components/LegalLayout";
import { getMessages } from "@/lib/i18n";
import { ConfirmButton } from "./ConfirmButton.client";

export const metadata = {
  title: "Confirm account deletion — My Language Coach",
};

type Props = {
  searchParams: Promise<{ token?: string }>;
};

export default async function Page({ searchParams }: Props) {
  const m = getMessages("en").deleteAccount;
  const params = await searchParams;
  const token = params.token;
  const apiBaseUrl =
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    "https://my-language-coach-agentical-rebuild.fly.dev";

  if (!token) {
    return (
      <LegalLayout locale="en">
        <h1>{m.confirmTitle}</h1>
        <p>{m.confirmInvalid}</p>
      </LegalLayout>
    );
  }

  return (
    <LegalLayout locale="en">
      <h1>{m.confirmTitle}</h1>
      <p>{m.confirmIntro}</p>
      <ConfirmButton apiBaseUrl={apiBaseUrl} token={token} locale="en" />
    </LegalLayout>
  );
}
```

- [ ] **Step 3: Manual smoke test**

With the dev server still running, visit `http://localhost:3002/delete-account/confirm` — should show "invalid" message. Then visit with a fake token: `?token=fake` — should show the confirm button (which will 400 on click; that's correct).

- [ ] **Step 4: Typecheck**

```bash
pnpm --filter @language-coach/web typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/delete-account/confirm
git commit -m "feat(web): account-deletion confirm page (EN)"
```

---

## Task 8: Web — French mirrors

**Files:**
- Create: `apps/web/app/fr/delete-account/page.tsx`
- Create: `apps/web/app/fr/delete-account/confirm/page.tsx`
- Create: `apps/web/app/fr/delete-account/done/page.tsx`
- Modify: `apps/web/messages/fr.json`

- [ ] **Step 1: Add FR i18n keys**

In `apps/web/messages/fr.json`:

1. Add `deleteAccount` to `footer.links` (mirror the EN change).

```json
"links": {
  "privacy": "Confidentialité",
  "terms": "Conditions",
  "deleteAccount": "Supprimer le compte",
  "contact": "Contact"
}
```

(The exact existing FR strings may differ slightly — keep your existing translations for `privacy`/`terms`/`contact` and just add the new `deleteAccount` line.)

2. Append the FR `deleteAccount` block to the root:

```json
"deleteAccount": {
  "title": "Supprimer votre compte My Language Coach",
  "intro": "Entrez l'adresse e-mail utilisée à l'inscription. Nous vous enverrons un lien de confirmation à usage unique. Cliquez dessus pour supprimer définitivement votre compte et toutes les données associées.",
  "emailLabel": "E-mail",
  "submit": "Envoyer le lien de confirmation",
  "submitting": "Envoi…",
  "sent": "Si un compte associé à cet e-mail existe, nous avons envoyé un lien de confirmation. Vérifiez votre boîte de réception (et les spams). Le lien expire dans 24 heures.",
  "errorGeneric": "Une erreur est survenue. Réessayez dans quelques minutes.",
  "whatIsDeleted": "Ce qui est supprimé",
  "whatIsDeletedList": "Votre e-mail, nom, photo de profil, messages, historique de conversations, séries, vocabulaire enregistré, jetons de notifications et droits d'abonnement.",
  "whatIsKept": "Ce que nous gardons",
  "whatIsKeptList": "Les enregistrements financiers anonymisés des achats (non rattachés à vous, conservés pour les obligations fiscales), et les statistiques d'usage anonymisées.",
  "confirmTitle": "Confirmer la suppression définitive",
  "confirmIntro": "Cela supprimera définitivement votre compte et tout votre historique de pratique. Cette action est irréversible.",
  "confirmButton": "Supprimer mon compte",
  "confirmInvalid": "Ce lien de suppression est invalide ou a déjà été utilisé.",
  "confirmExpired": "Ce lien de suppression a expiré. Demandez-en un nouveau.",
  "confirmFailed": "Nous n'avons pas pu finaliser la suppression. Réessayez, ou contactez le support.",
  "doneTitle": "Compte supprimé",
  "doneBody": "Votre compte et toutes les données associées ont été supprimés. Nous sommes désolés de vous voir partir."
}
```

- [ ] **Step 2: Create FR pages**

Three files, each minimal — same component code as EN but passing `locale="fr"` to `getMessages` and `RequestForm` / `ConfirmButton`:

`apps/web/app/fr/delete-account/page.tsx`:

```tsx
import { LegalLayout } from "@/components/LegalLayout";
import { getMessages } from "@/lib/i18n";
import { RequestForm } from "../../delete-account/RequestForm.client";

export const metadata = {
  title: "Supprimer votre compte — My Language Coach",
  alternates: {
    canonical: "/fr/delete-account",
    languages: { en: "/delete-account", fr: "/fr/delete-account" },
  },
};

export default function Page() {
  const m = getMessages("fr").deleteAccount;
  const apiBaseUrl =
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    "https://my-language-coach-agentical-rebuild.fly.dev";
  return (
    <LegalLayout locale="fr">
      <h1>{m.title}</h1>
      <p>{m.intro}</p>
      <RequestForm apiBaseUrl={apiBaseUrl} locale="fr" />
      <h2>{m.whatIsDeleted}</h2>
      <p>{m.whatIsDeletedList}</p>
      <h2>{m.whatIsKept}</h2>
      <p>{m.whatIsKeptList}</p>
    </LegalLayout>
  );
}
```

`apps/web/app/fr/delete-account/confirm/page.tsx`:

```tsx
import { LegalLayout } from "@/components/LegalLayout";
import { getMessages } from "@/lib/i18n";
import { ConfirmButton } from "../../../delete-account/confirm/ConfirmButton.client";

export const metadata = {
  title: "Confirmer la suppression — My Language Coach",
};

type Props = {
  searchParams: Promise<{ token?: string }>;
};

export default async function Page({ searchParams }: Props) {
  const m = getMessages("fr").deleteAccount;
  const params = await searchParams;
  const token = params.token;
  const apiBaseUrl =
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    "https://my-language-coach-agentical-rebuild.fly.dev";

  if (!token) {
    return (
      <LegalLayout locale="fr">
        <h1>{m.confirmTitle}</h1>
        <p>{m.confirmInvalid}</p>
      </LegalLayout>
    );
  }

  return (
    <LegalLayout locale="fr">
      <h1>{m.confirmTitle}</h1>
      <p>{m.confirmIntro}</p>
      <ConfirmButton apiBaseUrl={apiBaseUrl} token={token} locale="fr" />
    </LegalLayout>
  );
}
```

`apps/web/app/fr/delete-account/done/page.tsx`:

```tsx
import { LegalLayout } from "@/components/LegalLayout";
import { getMessages } from "@/lib/i18n";

export const metadata = {
  title: "Compte supprimé — My Language Coach",
};

export default function Page() {
  const m = getMessages("fr").deleteAccount;
  return (
    <LegalLayout locale="fr">
      <h1>{m.doneTitle}</h1>
      <p>{m.doneBody}</p>
    </LegalLayout>
  );
}
```

- [ ] **Step 3: Manual smoke test**

Visit `http://localhost:3002/fr/delete-account`. Confirm French copy renders.

- [ ] **Step 4: Typecheck + tests**

```bash
pnpm --filter @language-coach/web typecheck
pnpm --filter @language-coach/web test
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/fr/delete-account apps/web/messages/fr.json
git commit -m "feat(web): FR mirrors for account-deletion pages"
```

---

## Task 9: Footer link + privacy policy update

**Files:**
- Modify: `apps/web/components/Footer.tsx`
- Modify: `apps/web/content/privacy.en.mdx`
- Modify: `apps/web/content/privacy.fr.mdx`

- [ ] **Step 1: Add footer link**

In `apps/web/components/Footer.tsx`, update the `<nav>` block to add the link. Locate:

```tsx
<a href={`mailto:${contactEmail}`} className="hover:text-ink">
  {messages.links.contact}
</a>
```

…and add this **before** that line:

```tsx
<Link href={`${prefix}/delete-account`} className="hover:text-ink">
  {messages.links.deleteAccount}
</Link>
```

This works because the Footer receives `messages: Messages["footer"]` and we added the new key to `footer.links` in Tasks 6 and 8.

- [ ] **Step 2: Add a "Data deletion" section to the EN privacy MDX**

Append to `apps/web/content/privacy.en.mdx`:

```mdx
## Data deletion

You can delete your account and all associated data at any time. There are two ways:

- **From the app**: go to Profile → "Delete account" (at the bottom of the screen).
- **From the web**: visit [mylanguagecoach.app/delete-account](/delete-account), enter the email you signed up with, and click the confirmation link we send you.

Either path performs the same hard delete within 24 hours: your email, name, profile picture, chat messages, conversation history, streaks, saved vocabulary, push notification tokens, and subscription entitlements are removed.

We retain anonymized records of any past purchases (no longer linked to you) for tax-reporting purposes, and anonymized aggregate analytics (no longer linked to you).
```

- [ ] **Step 3: Add the same to FR privacy MDX**

Append to `apps/web/content/privacy.fr.mdx`:

```mdx
## Suppression des données

Vous pouvez supprimer votre compte et toutes les données associées à tout moment. Deux options :

- **Depuis l'app** : ouvrez Profil → « Supprimer le compte » (en bas de l'écran).
- **Depuis le web** : rendez-vous sur [mylanguagecoach.app/fr/delete-account](/fr/delete-account), entrez l'e-mail utilisé à l'inscription, et cliquez sur le lien de confirmation que nous vous envoyons.

Les deux parcours effectuent la même suppression définitive sous 24 heures : votre e-mail, nom, photo de profil, messages, historique de conversations, séries, vocabulaire enregistré, jetons de notifications et droits d'abonnement.

Nous conservons des enregistrements anonymisés des achats passés (non rattachés à vous) pour les obligations fiscales, et des statistiques d'usage anonymisées (non rattachées à vous).
```

- [ ] **Step 4: Typecheck**

```bash
pnpm --filter @language-coach/web typecheck
```

Expected: PASS.

- [ ] **Step 5: Manual smoke test**

Visit `http://localhost:3002` — scroll to the footer, confirm "Delete account" appears. Visit `/privacy` — confirm the new section appears at the bottom.

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/Footer.tsx apps/web/content/privacy.en.mdx apps/web/content/privacy.fr.mdx
git commit -m "feat(web): footer link + privacy policy section for deletion"
```

---

## Task 10: Mobile — delete-account sheet + hook

**Files:**
- Create: `apps/mobile/src/features/profile/use-delete-account.ts`
- Create: `apps/mobile/src/features/profile/delete-account-sheet.tsx`
- Create: `apps/mobile/src/features/profile/delete-account-sheet.test.tsx`
- Modify: `apps/mobile/src/lib/api-client.ts`

- [ ] **Step 1: Add the API client call**

In `apps/mobile/src/lib/api-client.ts`, after the `endSession` function, add:

```ts
export async function selfDeleteAccount(): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/v1/account-deletion/self`, {
    method: "POST",
    headers: {
      authorization: await authHeader(),
      ...clientPlatformHeader(),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`selfDeleteAccount ${res.status}: ${text}`);
  }
}
```

- [ ] **Step 2: Build the hook**

Create `apps/mobile/src/features/profile/use-delete-account.ts`:

```ts
import { useState } from "react";
import { useRouter } from "expo-router";
import { selfDeleteAccount } from "@/src/lib/api-client";
import { supabase } from "@/src/lib/supabase";
import { showToast } from "@/src/lib/toast";

export function useDeleteAccount() {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function run() {
    setDeleting(true);
    try {
      await selfDeleteAccount();
      await supabase.auth.signOut();
      router.replace("/(auth)/sign-in");
      showToast("Your account has been deleted.");
    } catch (err) {
      showToast(
        `Couldn't delete your account: ${(err as Error).message}. Try again or contact support.`,
      );
    } finally {
      setDeleting(false);
    }
  }

  return { deleting, run };
}
```

- [ ] **Step 3: Write the failing component tests**

Create `apps/mobile/src/features/profile/delete-account-sheet.test.tsx`:

```tsx
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { DeleteAccountSheet } from "./delete-account-sheet";

vi.mock("@/src/lib/supabase", () => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
    },
  },
}));

vi.mock("./use-delete-account", () => ({
  useDeleteAccount: () => ({ deleting: false, run: mockRun }),
}));

const mockRun = vi.fn();

function setup(props: { email: string; hasEmailIdentity: boolean }) {
  return render(
    <BottomSheetModalProvider>
      <DeleteAccountSheet
        email={props.email}
        hasEmailIdentity={props.hasEmailIdentity}
      />
    </BottomSheetModalProvider>,
  );
}

describe("DeleteAccountSheet", () => {
  beforeEach(() => {
    mockRun.mockReset();
  });

  it("shows the password field for email-identity users", () => {
    const { queryByPlaceholderText } = setup({
      email: "a@b.com",
      hasEmailIdentity: true,
    });
    expect(queryByPlaceholderText(/password/i)).toBeTruthy();
  });

  it("does NOT show the password field for OAuth-only users", () => {
    const { queryByPlaceholderText, queryByText } = setup({
      email: "a@b.com",
      hasEmailIdentity: false,
    });
    expect(queryByPlaceholderText(/password/i)).toBeNull();
    expect(queryByText(/re-confirm/i)).toBeTruthy();
  });
});
```

- [ ] **Step 4: Run tests to verify they fail**

```bash
pnpm --filter @language-coach/mobile test -- delete-account-sheet
```

Expected: FAIL with module-not-found for `./delete-account-sheet`.

- [ ] **Step 5: Build the sheet**

Create `apps/mobile/src/features/profile/delete-account-sheet.tsx`:

```tsx
import { forwardRef, useCallback, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import {
  BottomSheetFooter,
  BottomSheetModal,
  BottomSheetTextInput,
  BottomSheetView,
  type BottomSheetFooterProps,
} from "@gorhom/bottom-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "@/src/lib/supabase";
import { showToast } from "@/src/lib/toast";
import { EditorialText, GlassCard, TAB_BAR_RESERVE } from "@/src/design";
import {
  palette,
  radius,
  shadow,
  spacing,
  type as typeTokens,
} from "@language-coach/design-tokens";
import { useDeleteAccount } from "./use-delete-account";

type Props = {
  email: string;
  hasEmailIdentity: boolean;
};

export const DeleteAccountSheet = forwardRef<BottomSheetModal, Props>(
  function DeleteAccountSheet({ email, hasEmailIdentity }, ref) {
    const insets = useSafeAreaInsets();
    const footerInset = insets.bottom + TAB_BAR_RESERVE;
    const [password, setPassword] = useState("");
    const [verifying, setVerifying] = useState(false);
    const { deleting, run } = useDeleteAccount();

    const handleConfirm = useCallback(async () => {
      if (hasEmailIdentity) {
        setVerifying(true);
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        setVerifying(false);
        if (error) {
          showToast("Password is incorrect.");
          return;
        }
      }
      // OAuth-only users: re-authentication via the live Supabase session
      // is implicit — they're already signed in, and the /self endpoint
      // verifies their JWT server-side. No re-tap of Google/Apple needed
      // for v1; the destructive-confirm UX is sufficient.
      await run();
      (ref as { current: BottomSheetModal | null }).current?.dismiss();
    }, [email, hasEmailIdentity, password, ref, run]);

    const busy = verifying || deleting;
    const valid = hasEmailIdentity ? password.length >= 1 : true;

    const renderFooter = useCallback(
      (props: BottomSheetFooterProps) => (
        <BottomSheetFooter {...props} bottomInset={footerInset}>
          <Pressable
            onPress={handleConfirm}
            disabled={busy || !valid}
            style={[styles.deleteButton, (busy || !valid) && styles.disabled]}
          >
            <EditorialText
              kind="bodyLg"
              color={palette.cream}
              style={{ fontWeight: "600" }}
            >
              {busy ? "Deleting…" : "Delete my account"}
            </EditorialText>
          </Pressable>
        </BottomSheetFooter>
      ),
      [busy, valid, handleConfirm, footerInset],
    );

    return (
      <BottomSheetModal
        ref={ref}
        snapPoints={["65%"]}
        footerComponent={renderFooter}
        backgroundStyle={styles.background}
        handleIndicatorStyle={styles.handle}
      >
        <BottomSheetView style={styles.content}>
          <View style={styles.titleRow}>
            <EditorialText kind="displayMd">Delete your account</EditorialText>
          </View>
          <EditorialText kind="bodyMd" color={palette.inkSoft} style={styles.body}>
            This will permanently delete your account and all your practice
            history. This cannot be undone.
          </EditorialText>
          {hasEmailIdentity ? (
            <GlassCard padding="md" style={styles.field}>
              <EditorialText
                kind="bodySm"
                color={palette.inkSoft}
                style={styles.fieldLabel}
              >
                Confirm your password
              </EditorialText>
              <BottomSheetTextInput
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholder="password"
                autoCapitalize="none"
                style={[typeTokens.bodyLg, styles.input]}
                placeholderTextColor={palette.inkSoft}
              />
            </GlassCard>
          ) : (
            <EditorialText kind="bodySm" color={palette.inkSoft}>
              You'll be signed out and your account removed. Tap "Re-confirm"
              below to proceed.
            </EditorialText>
          )}
        </BottomSheetView>
      </BottomSheetModal>
    );
  },
);

const styles = StyleSheet.create({
  background: {
    backgroundColor: palette.peach,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
  },
  handle: { backgroundColor: palette.glassFaint },
  content: { paddingHorizontal: spacing.xl, paddingBottom: spacing.base },
  titleRow: { paddingTop: spacing.md, paddingBottom: spacing.lg },
  body: { marginBottom: spacing.md },
  field: { marginTop: spacing.sm },
  fieldLabel: { marginBottom: spacing.xs },
  input: { color: palette.ink, padding: 0, minHeight: 28 },
  deleteButton: {
    backgroundColor: palette.danger,
    paddingVertical: spacing.base + 2,
    borderRadius: radius.lg,
    alignItems: "center",
    marginHorizontal: spacing.xl,
    marginBottom: spacing.md,
    ...shadow.cta,
  },
  disabled: { opacity: 0.5 },
});
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
pnpm --filter @language-coach/mobile test -- delete-account-sheet
```

Expected: PASS.

Note: the test for the OAuth path looks for "re-confirm" text; the sheet's body says "Tap 'Re-confirm'" so it matches case-insensitive. If a test is flaky because RN's text-node lookup is case-sensitive, adjust the regex or text content to align.

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/src/features/profile/delete-account-sheet.tsx apps/mobile/src/features/profile/delete-account-sheet.test.tsx apps/mobile/src/features/profile/use-delete-account.ts apps/mobile/src/lib/api-client.ts
git commit -m "feat(mobile): delete account sheet + hook + API call"
```

---

## Task 11: Mobile — wire into Profile screen

**Files:**
- Modify: `apps/mobile/app/(tabs)/profile.tsx`

- [ ] **Step 1: Import the sheet**

Add to the imports near the top of `apps/mobile/app/(tabs)/profile.tsx`:

```tsx
import { DeleteAccountSheet } from "@/src/features/profile/delete-account-sheet";
```

- [ ] **Step 2: Add a ref**

Inside `ProfileScreen`, after the other refs:

```tsx
const deleteAccountRef = useRef<BottomSheetModal>(null);
```

- [ ] **Step 3: Add a danger-zone row**

After the Sign-out button (the `<Pressable onPress={onSignOut} style={styles.signOutButton}>` block) and BEFORE the version text, add:

```tsx
<Pressable
  onPress={() => deleteAccountRef.current?.present()}
  style={styles.deleteAccountRow}
>
  <EditorialText
    kind="bodyMd"
    color={palette.danger}
    align="center"
    style={styles.deleteAccountText}
  >
    Delete account
  </EditorialText>
</Pressable>
```

- [ ] **Step 4: Mount the sheet**

After the `<ChangePasswordSheet ... />` block, add:

```tsx
<DeleteAccountSheet
  ref={deleteAccountRef}
  email={email}
  hasEmailIdentity={hasEmailIdentity}
/>
```

- [ ] **Step 5: Add styles**

Add to the `StyleSheet.create({...})` block:

```ts
deleteAccountRow: {
  marginTop: spacing.md,
  paddingVertical: spacing.sm,
  alignItems: "center",
},
deleteAccountText: {
  textDecorationLine: "underline",
},
```

- [ ] **Step 6: Typecheck**

```bash
pnpm --filter @language-coach/mobile typecheck
```

Expected: PASS.

- [ ] **Step 7: Manual smoke test in dev build**

```bash
pnpm --filter @language-coach/mobile start
```

Open the app on Bruno's device. Profile screen should now have a small underlined "Delete account" link below Sign out. Tapping it opens the bottom sheet. **Do not actually confirm — we don't have a throwaway test user yet.** Just verify the sheet UI.

- [ ] **Step 8: Commit**

```bash
git add apps/mobile/app/(tabs)/profile.tsx
git commit -m "feat(mobile): wire delete-account into Profile screen"
```

---

## Task 12: Version bump + deploy + Play Console form

**Files:**
- Modify: `apps/mobile/app.config.ts`

- [ ] **Step 1: Bump Android versionCode and iOS buildNumber**

In `apps/mobile/app.config.ts`:

- Line 46: `buildNumber: "8"` → `buildNumber: "9"`
- Line 57: `versionCode: 42` → `versionCode: 43`

- [ ] **Step 2: Create Resend account + verify domain**

This is out-of-band:

1. Sign up at [resend.com](https://resend.com) with `bruno.a.moise@gmail.com`.
2. Add the domain `mylanguagecoach.app`. Resend prints DNS records (SPF, DKIM, optional DMARC).
3. Add those records in your DNS host (likely Vercel DNS for the apex). Wait for verification (usually <10 min).
4. Create an API key. Copy it (`re_...`).

- [ ] **Step 3: Set Fly secrets**

```bash
cd "C:/Users/bruno.moise/My Language Coach - rebuild/app/apps/api"
fly secrets set \
  ACCOUNT_DELETION_SECRET=<the 64-hex value from Task 1 Step 3> \
  RESEND_API_KEY=<re_... from Resend dashboard> \
  PUBLIC_WEB_BASE_URL=https://www.mylanguagecoach.app
```

Fly will redeploy. Watch the logs: `fly logs --app my-language-coach-agentical-rebuild`. Expect a successful boot with no env errors.

- [ ] **Step 4: Smoke-test the live deletion request endpoint**

```bash
curl -X POST https://my-language-coach-agentical-rebuild.fly.dev/account-deletion/request \
  -H 'content-type: application/json' \
  -d '{"email":"nobody@example.com"}'
```

Expected: `{"ok":true}` with status 200.

Then with a real test account email (create one ahead of time via the mobile app sign-up):

```bash
curl -X POST https://my-language-coach-agentical-rebuild.fly.dev/account-deletion/request \
  -H 'content-type: application/json' \
  -d '{"email":"<your-throwaway>@gmail.com"}'
```

Check the inbox — the confirmation email should arrive. Click the link → confirm in browser → it should redirect to `/delete-account/done`. Then verify in Supabase Studio that the user is gone from `auth.users` and the profile row no longer exists.

- [ ] **Step 5: Deploy the web app**

```bash
cd "C:/Users/bruno.moise/My Language Coach - rebuild/app/apps/web"
vercel --prod
```

(Or merge to main and let Vercel's auto-deploy do it — whichever matches the team's flow.)

After the deploy, visit `https://www.mylanguagecoach.app/delete-account` and confirm the page loads in prod.

- [ ] **Step 6: Build and submit the mobile app**

```bash
cd "C:/Users/bruno.moise/My Language Coach - rebuild/app/apps/mobile"
eas build --profile production --platform android
```

Once the AAB is built:

```bash
eas submit --platform android --latest
```

Or upload manually to the Play Console internal track.

- [ ] **Step 7: Update Play Console Data Safety form**

In Play Console → App content → Data safety:

1. Click "Manage" (or whatever the resubmit button is).
2. **Q1**: Your app collects user data? → **Yes** (already set).
3. **Q2**: Encrypted in transit? → **Yes**.
4. **Q3**: Account creation methods → check **Nom d'utilisateur et mot de passe** + **OAuth**.
5. **Q4** (next screen): Account deletion URL → paste `https://www.mylanguagecoach.app/delete-account`.
6. Continue through data-type screens. Declare:
   - **Personal info → Email address** (Collected, not shared, Account management, Required)
   - **Personal info → Name** (Collected, not shared, Account management, Required)
   - **Personal info → User IDs** (Collected, not shared, App functionality, Required)
   - **Audio → Voice or sound recordings** (Collected, not shared, App functionality, Processed ephemerally = yes)
   - **App activity → In-app actions** (Collected, not shared, App functionality + Analytics)
   - **App info and performance → Crash logs** (Collected, **shared with Sentry**, App functionality + Analytics)
   - **App info and performance → Diagnostics** (Collected, shared with Sentry, App functionality + Analytics)
7. Save + submit for review.

- [ ] **Step 8: Promote the build to production**

In Play Console → Production → Create new release → pick the build that uploaded → roll out to internal testers first, then production.

- [ ] **Step 9: Commit the version bump**

```bash
git add apps/mobile/app.config.ts
git commit -m "chore(mobile): bump versionCode 42→43 + iOS buildNumber 8→9"
```

---

## Final Sanity Checks

- [ ] Run the full test suites one more time:

```bash
pnpm --filter @language-coach/api test
pnpm --filter @language-coach/web test
pnpm --filter @language-coach/mobile test
```

Expected: All PASS.

- [ ] Run typecheck across the workspace:

```bash
pnpm --filter @language-coach/api typecheck
pnpm --filter @language-coach/web typecheck
pnpm --filter @language-coach/mobile typecheck
```

Expected: All PASS.

- [ ] Verify the live URL is reachable and renders:

Open `https://www.mylanguagecoach.app/delete-account` in a private browser window — should load without errors, no sign-in prompt.

- [ ] Confirm the Play Console submission shows "Under review" status.

---

## Open Items Surfaced During Planning

Mostly resolved during recon, recording for the next session:

1. **Email provider**: chose Resend (no existing email helper found in `apps/api`). Adds a dependency but is the lowest-friction option for a one-shot transactional email.
2. **Storage cleanup**: no per-user buckets exist today — greeting audio is keyed by `(languageCode, userName)` and is shared cache, not user-owned. Nothing to clean. If avatar upload lands in a future plan, that plan must extend `deleteUserAccount` to clear the user's Storage prefix.
3. **`revenue_events` FK behavior**: confirmed `ON DELETE SET NULL` in `apps/api/src/db/schema/revenue-events.ts:18`. Deletion of the profile row anonymizes these records automatically — no extra code needed. Same for `usage_events`.
