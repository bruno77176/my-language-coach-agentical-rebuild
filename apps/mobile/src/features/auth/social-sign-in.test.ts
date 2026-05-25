import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@react-native-google-signin/google-signin", () => ({
  GoogleSignin: {
    configure: vi.fn(),
    hasPlayServices: vi.fn().mockResolvedValue(true),
    signIn: vi.fn(),
  },
  statusCodes: {
    SIGN_IN_CANCELLED: "SIGN_IN_CANCELLED",
  },
}));

vi.mock("expo-apple-authentication", () => ({
  signInAsync: vi.fn(),
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
  isAvailableAsync: vi.fn().mockResolvedValue(true),
}));

vi.mock("expo-crypto", () => ({
  digestStringAsync: vi.fn().mockResolvedValue("hashed-nonce"),
  CryptoDigestAlgorithm: { SHA256: "SHA256" },
  CryptoEncoding: { HEX: "HEX" },
  randomUUID: () => "raw-nonce",
}));

vi.mock("@/src/lib/supabase", () => ({
  supabase: {
    auth: {
      signInWithIdToken: vi.fn(),
    },
  },
}));

vi.mock("@/src/lib/env", () => ({
  env: {
    GOOGLE_WEB_CLIENT_ID: "test-web-client",
    GOOGLE_IOS_CLIENT_ID: "test-ios-client",
  },
}));

import { GoogleSignin } from "@react-native-google-signin/google-signin";
import * as AppleAuthentication from "expo-apple-authentication";
import { supabase } from "@/src/lib/supabase";
import {
  signInWithGoogle,
  signInWithApple,
  SocialSignInCancelled,
  SocialSignInError,
} from "./social-sign-in";

describe("signInWithGoogle", () => {
  beforeEach(() => vi.clearAllMocks());

  it("passes the ID token to Supabase and returns the session", async () => {
    (GoogleSignin.signIn as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { idToken: "google-id-token" },
    });
    const fakeSession = { user: { id: "u1" } };
    (
      supabase.auth.signInWithIdToken as ReturnType<typeof vi.fn>
    ).mockResolvedValue({ data: { session: fakeSession }, error: null });

    const session = await signInWithGoogle();

    expect(supabase.auth.signInWithIdToken).toHaveBeenCalledWith({
      provider: "google",
      token: "google-id-token",
    });
    expect(session).toBe(fakeSession);
  });

  it("throws SocialSignInCancelled when the user cancels", async () => {
    (GoogleSignin.signIn as ReturnType<typeof vi.fn>).mockRejectedValue({
      code: "SIGN_IN_CANCELLED",
    });
    await expect(signInWithGoogle()).rejects.toBeInstanceOf(
      SocialSignInCancelled,
    );
  });

  it("throws SocialSignInError when Google returns no ID token", async () => {
    (GoogleSignin.signIn as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { idToken: null },
    });
    await expect(signInWithGoogle()).rejects.toBeInstanceOf(SocialSignInError);
  });

  it("throws SocialSignInError when Supabase rejects the token", async () => {
    (GoogleSignin.signIn as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { idToken: "google-id-token" },
    });
    (
      supabase.auth.signInWithIdToken as ReturnType<typeof vi.fn>
    ).mockResolvedValue({ data: { session: null }, error: { message: "bad" } });
    await expect(signInWithGoogle()).rejects.toBeInstanceOf(SocialSignInError);
  });
});

describe("signInWithApple", () => {
  beforeEach(() => vi.clearAllMocks());

  it("hashes the nonce and passes raw nonce + identity token to Supabase", async () => {
    (
      AppleAuthentication.signInAsync as ReturnType<typeof vi.fn>
    ).mockResolvedValue({ identityToken: "apple-id-token" });
    const fakeSession = { user: { id: "u2" } };
    (
      supabase.auth.signInWithIdToken as ReturnType<typeof vi.fn>
    ).mockResolvedValue({ data: { session: fakeSession }, error: null });

    const session = await signInWithApple();

    expect(AppleAuthentication.signInAsync).toHaveBeenCalledWith(
      expect.objectContaining({ nonce: "hashed-nonce" }),
    );
    expect(supabase.auth.signInWithIdToken).toHaveBeenCalledWith({
      provider: "apple",
      token: "apple-id-token",
      nonce: "raw-nonce",
    });
    expect(session).toBe(fakeSession);
  });

  it("throws SocialSignInCancelled when the user cancels", async () => {
    (
      AppleAuthentication.signInAsync as ReturnType<typeof vi.fn>
    ).mockRejectedValue({ code: "ERR_REQUEST_CANCELED" });
    await expect(signInWithApple()).rejects.toBeInstanceOf(
      SocialSignInCancelled,
    );
  });

  it("throws SocialSignInError when Apple returns no identity token", async () => {
    (
      AppleAuthentication.signInAsync as ReturnType<typeof vi.fn>
    ).mockResolvedValue({ identityToken: null });
    await expect(signInWithApple()).rejects.toBeInstanceOf(SocialSignInError);
  });
});
