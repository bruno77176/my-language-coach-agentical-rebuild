import type { Session } from "@supabase/supabase-js";
import * as Crypto from "expo-crypto";
import * as AppleAuthentication from "expo-apple-authentication";
import {
  GoogleSignin,
  statusCodes,
} from "@react-native-google-signin/google-signin";
import { supabase } from "@/src/lib/supabase";
import { env } from "@/src/lib/env";

const APPLE_CANCEL_CODE = "ERR_REQUEST_CANCELED";

export class SocialSignInCancelled extends Error {
  constructor() {
    super("Sign-in was cancelled");
    this.name = "SocialSignInCancelled";
  }
}

export class SocialSignInError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SocialSignInError";
  }
}

let googleConfigured = false;
function configureGoogle() {
  if (googleConfigured) return;
  GoogleSignin.configure({
    webClientId: env.GOOGLE_WEB_CLIENT_ID,
    iosClientId: env.GOOGLE_IOS_CLIENT_ID,
  });
  googleConfigured = true;
}

export async function signInWithGoogle(): Promise<Session> {
  configureGoogle();
  let result;
  try {
    await GoogleSignin.hasPlayServices();
    result = await GoogleSignin.signIn();
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (
      code === statusCodes.SIGN_IN_CANCELLED ||
      code === statusCodes.IN_PROGRESS
    ) {
      throw new SocialSignInCancelled();
    }
    throw new SocialSignInError(
      (err as Error)?.message ?? "Google sign-in failed",
    );
  }

  const idToken = result.data?.idToken;
  if (!idToken) {
    throw new SocialSignInError("Google did not return an ID token");
  }

  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: "google",
    token: idToken,
  });
  if (error || !data.session) {
    throw new SocialSignInError(
      error?.message ?? "Supabase rejected the token",
    );
  }
  return data.session;
}

export type AppleSignInResult = {
  session: Session;
  /**
   * The given name Apple returned in the credential, if any. Apple only
   * provides `fullName` on the FIRST authorization for an Apple ID, so we
   * capture it here and persist it to Supabase user_metadata below — later
   * sign-ins return null. Callers use this to pre-seed onboarding so the user
   * is never asked to re-type a name Apple already gave us (Guideline 4).
   */
  fullName: string;
};

function formatAppleFullName(
  fullName: AppleAuthentication.AppleAuthenticationFullName | null,
): string {
  if (!fullName) return "";
  return (fullName.givenName ?? fullName.familyName ?? "").trim();
}

export async function signInWithApple(): Promise<AppleSignInResult> {
  const rawNonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    rawNonce,
    { encoding: Crypto.CryptoEncoding.HEX },
  );

  let credential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === APPLE_CANCEL_CODE) {
      throw new SocialSignInCancelled();
    }
    throw new SocialSignInError(
      (err as Error)?.message ?? "Apple sign-in failed",
    );
  }

  if (!credential.identityToken) {
    throw new SocialSignInError("Apple did not return an identity token");
  }

  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: "apple",
    token: credential.identityToken,
    nonce: rawNonce,
  });
  if (error || !data.session) {
    throw new SocialSignInError(
      error?.message ?? "Supabase rejected the token",
    );
  }

  // Apple sends the name only in the authorization response (never in the JWT),
  // and only on the first authorization. Persist it to user_metadata so it
  // survives later sign-ins and an interrupted onboarding. Best-effort: a
  // failure here must not block sign-in.
  const fullName = formatAppleFullName(credential.fullName);
  if (fullName) {
    try {
      await supabase.auth.updateUser({ data: { full_name: fullName } });
    } catch {
      // ignore — the name still flows through the returned value below
    }
  }

  return { session: data.session, fullName };
}
