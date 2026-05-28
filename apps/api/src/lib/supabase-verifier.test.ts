import { describe, expect, it, vi, beforeEach } from "vitest";
import { createSupabaseVerifier } from "./supabase-verifier";
import type { Env } from "../env";

const getUserMock = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: { getUser: getUserMock },
  }),
}));

const FAKE_ENV = {
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
} as unknown as Env;

describe("createSupabaseVerifier", () => {
  beforeEach(() => {
    getUserMock.mockReset();
  });

  it("returns userId for a valid token with a confirmed email", async () => {
    getUserMock.mockResolvedValue({
      data: {
        user: {
          id: "user-123",
          email_confirmed_at: "2026-05-01T00:00:00Z",
        },
      },
      error: null,
    });
    const verify = createSupabaseVerifier(FAKE_ENV);
    await expect(verify("good-token")).resolves.toEqual({ userId: "user-123" });
  });

  it("throws when Supabase returns an error", async () => {
    getUserMock.mockResolvedValue({
      data: { user: null },
      error: { message: "invalid jwt" },
    });
    const verify = createSupabaseVerifier(FAKE_ENV);
    await expect(verify("bad")).rejects.toThrow(/invalid jwt/i);
  });

  it("throws when Supabase returns no user", async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: null });
    const verify = createSupabaseVerifier(FAKE_ENV);
    await expect(verify("bad")).rejects.toThrow(/invalid supabase jwt/i);
  });

  it("rejects users whose email is not confirmed", async () => {
    // This is the regression test for the 2026-05-28 incident where the
    // Supabase project's "Confirm email" toggle was OFF, letting users sign
    // up with anyone's email address. Even if the toggle ever flips OFF
    // again (or a future provider returns email_verified=false), the API
    // must refuse the session.
    getUserMock.mockResolvedValue({
      data: {
        user: { id: "user-456", email_confirmed_at: null },
      },
      error: null,
    });
    const verify = createSupabaseVerifier(FAKE_ENV);
    await expect(verify("squatter-token")).rejects.toThrow(
      /email not confirmed/i,
    );
  });
});
