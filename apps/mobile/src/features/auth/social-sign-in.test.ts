import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@react-native-google-signin/google-signin", () => ({
  GoogleSignin: {
    configure: vi.fn(),
    hasPlayServices: vi.fn().mockResolvedValue(true),
    signIn: vi.fn(),
  },
  statusCodes: {
    SIGN_IN_CANCELLED: "SIGN_IN_CANCELLED",
    IN_PROGRESS: "IN_PROGRESS",
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
      updateUser: vi.fn().mockResolvedValue({ data: {}, error: null }),
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

  it("throws SocialSignInCancelled when a sign-in is already in progress", async () => {
    (GoogleSignin.signIn as ReturnType<typeof vi.fn>).mockRejectedValue({
      code: "IN_PROGRESS",
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

    const { session, fullName } = await signInWithApple();

    expect(AppleAuthentication.signInAsync).toHaveBeenCalledWith(
      expect.objectContaining({ nonce: "hashed-nonce" }),
    );
    expect(supabase.auth.signInWithIdToken).toHaveBeenCalledWith({
      provider: "apple",
      token: "apple-id-token",
      nonce: "raw-nonce",
    });
    expect(session).toBe(fakeSession);
    // No name in the credential → nothing returned, no profile write.
    expect(fullName).toBe("");
    expect(supabase.auth.updateUser).not.toHaveBeenCalled();
  });

  it("captures Apple's given name and persists it to user_metadata", async () => {
    (
      AppleAuthentication.signInAsync as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      identityToken: "apple-id-token",
      fullName: { givenName: "Bruno", familyName: "Moise" },
    });
    const fakeSession = { user: { id: "u3" } };
    (
      supabase.auth.signInWithIdToken as ReturnType<typeof vi.fn>
    ).mockResolvedValue({ data: { session: fakeSession }, error: null });

    const { fullName } = await signInWithApple();

    expect(fullName).toBe("Bruno");
    expect(supabase.auth.updateUser).toHaveBeenCalledWith({
      data: { full_name: "Bruno" },
    });
  });

  it("still returns the session if persisting the name fails", async () => {
    (
      AppleAuthentication.signInAsync as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      identityToken: "apple-id-token",
      fullName: { givenName: "Bruno" },
    });
    const fakeSession = { user: { id: "u4" } };
    (
      supabase.auth.signInWithIdToken as ReturnType<typeof vi.fn>
    ).mockResolvedValue({ data: { session: fakeSession }, error: null });
    (
      supabase.auth.updateUser as ReturnType<typeof vi.fn>
    ).mockRejectedValueOnce(new Error("network"));

    const { session, fullName } = await signInWithApple();

    expect(session).toBe(fakeSession);
    expect(fullName).toBe("Bruno");
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

  it("throws SocialSignInError when Supabase rejects the token", async () => {
    (
      AppleAuthentication.signInAsync as ReturnType<typeof vi.fn>
    ).mockResolvedValue({ identityToken: "apple-id-token" });
    (
      supabase.auth.signInWithIdToken as ReturnType<typeof vi.fn>
    ).mockResolvedValue({ data: { session: null }, error: { message: "bad" } });
    await expect(signInWithApple()).rejects.toBeInstanceOf(SocialSignInError);
  });
});
